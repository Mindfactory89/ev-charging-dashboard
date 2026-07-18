const PATHS = {
  add: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  bolt: <><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z" /></>,
  budget: <><path d="M4 7.5h16v10H4zM16 12.5h2" /><path d="M6 7.5V5h11" /></>,
  check: <><path d="M5 12.5 9.2 17 19 7" /><path d="M5 5.5h5M5 19.5h14" /></>,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  compass: <><circle cx="12" cy="12" r="8" /><path d="m14.8 9.2-1.7 3.9-3.9 1.7 1.7-3.9 3.9-1.7Z" /></>,
  efficiency: <><path d="M4 16a8 8 0 1 1 16 0" /><path d="m12 12 4-3M7 19h10" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
  import: <><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 19h14" /></>,
  leaf: <><path d="M19 4C10 4 5 8.5 5 15c0 2.5 1.8 4 4.2 4C15.6 19 19 12.8 19 4Z" /><path d="M7 17c2.5-3.5 5.5-6 9-8" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 14.8 6L14.5 3h-5L9.2 6a8 8 0 0 0-1.7 1.1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A8 8 0 0 0 9.2 18l.3 3h5l.3-3a8 8 0 0 0 1.7-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" /></>,
  solar: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  spark: <><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5" /><circle cx="12" cy="12" r="3.2" /></>,
  tag: <><path d="m4 12 8-8h7v7l-8 8-7-7Z" /><circle cx="15.5" cy="7.5" r="1" /></>,
  warning: <><path d="M12 4v9" /><path d="M12 17.5v.5" /><path d="m4.8 19 6.1-14a1.2 1.2 0 0 1 2.2 0l6.1 14H4.8Z" /></>,
};

export default function AppIcon({ name, size = 24, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {PATHS[name] || PATHS.spark}
    </svg>
  );
}
