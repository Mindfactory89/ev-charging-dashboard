import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Premium Tooltip (Cupra Glass)
 * - Renders via Portal into document.body (never clipped by overflow)
 * - Stays open on hover of trigger OR tooltip
 * - Supports focus (keyboard)
 * - Uses existing CSS classes: tt, ttOpen, ttInner, ttCopper, ttContent
 */
export default function Tooltip({
  content,
  placement = "top", // top | bottom
  children,
  openDelayMs = 60,
  closeDelayMs = 180,
  maxWidth = 320,
}) {
  const triggerRef = useRef(null);
  const tipRef = useRef(null);
  const tooltipId = useId();

  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  // Mount flag (SSR-safe)
  useEffect(() => setMounted(true), []);

  const safeContent = useMemo(() => {
    if (content === null || content === undefined) return "";
    if (typeof content === "string") return content;
    return content;
  }, [content]);

  function clearTimers() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }

  function scheduleOpen() {
    clearTimers();
    openTimer.current = setTimeout(() => setOpen(true), Math.max(0, openDelayMs));
  }

  function scheduleClose() {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), Math.max(0, closeDelayMs));
  }

  function hardClose() {
    clearTimers();
    setOpen(false);
  }

  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  function computePosition() {
    const el = triggerRef.current;
    const tip = tipRef.current;
    if (!el || !tip) return;

    const r = el.getBoundingClientRect();

    // Measure tooltip (after render)
    const tr = tip.getBoundingClientRect();

    const padding = 10;
    const gap = 10;

    // Prefer top, else bottom
    const preferTop = placement === "top";

    const topCandidateTop = r.top - tr.height - gap;
    const bottomCandidateTop = r.bottom + gap;

    // Decide actual placement based on space
    const canTop = topCandidateTop >= padding;
    const canBottom = bottomCandidateTop + tr.height <= window.innerHeight - padding;

    let top;
    if (preferTop) {
      top = canTop ? topCandidateTop : bottomCandidateTop;
    } else {
      top = canBottom ? bottomCandidateTop : topCandidateTop;
    }

    let left = r.left + r.width / 2 - tr.width / 2;

    top = clamp(top, padding, window.innerHeight - tr.height - padding);
    left = clamp(left, padding, window.innerWidth - tr.width - padding);

    setPos({ top, left });
  }

  // Reposition when opened
  useLayoutEffect(() => {
    if (!open) return;
    // next frame to ensure tip DOM is measurable
    const raf = requestAnimationFrame(() => computePosition());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement, safeContent]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;

    const onScroll = () => computePosition();
    const onResize = () => computePosition();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") hardClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Clone child and attach handlers
  const child = React.Children.only(children);
  const childProps = child.props || {};

  const onMouseEnter = (e) => {
    childProps.onMouseEnter?.(e);
    scheduleOpen();
  };
  const onMouseLeave = (e) => {
    childProps.onMouseLeave?.(e);
    scheduleClose();
  };
  const onFocus = (e) => {
    childProps.onFocus?.(e);
    scheduleOpen();
  };
  const onBlur = (e) => {
    childProps.onBlur?.(e);
    scheduleClose();
  };

  const trigger = React.cloneElement(child, {
    ref: triggerRef,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    "aria-describedby": open ? tooltipId : undefined,
  });

  const tip = open && mounted ? (
    <div
      id={tooltipId}
      className={`tt ${open ? "ttOpen" : ""}`}
      ref={tipRef}
      style={{
        top: pos.top,
        left: pos.left,
        maxWidth,
      }}
      onMouseEnter={() => {
        // Keep open when hovering tooltip itself
        clearTimers();
        setOpen(true);
      }}
      onMouseLeave={() => scheduleClose()}
      role="tooltip"
    >
      <div className="ttInner">
        <div className="ttCopper" />
        <div className="ttContent">{safeContent}</div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {mounted ? createPortal(tip, document.body) : null}
    </>
  );
}
