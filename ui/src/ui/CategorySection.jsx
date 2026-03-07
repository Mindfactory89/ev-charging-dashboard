import React from "react";

export default function CategorySection({
  id,
  kicker,
  title,
  summary,
  pills = [],
  open,
  onToggle,
  children,
  tone = "neutral",
  icon = null,
}) {
  const panelId = `${id}-panel`;

  return (
    <section className="row">
      <div className={`card glass categoryCard ${tone} ${open ? "open" : "closed"}`}>
        <button
          type="button"
          className="categoryHeader"
          onClick={() => onToggle?.(id)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <div className="categoryHeaderLeft">
            <div className="categoryTitleRow">
              {icon ? <span className={`categoryIcon ${tone}`}>{icon}</span> : null}
              <div>
                <div className="sectionKicker">{kicker}</div>
                <div className="sectionTitle categoryTitle">{title}</div>
              </div>
            </div>
            {summary ? <div className="categorySummary">{summary}</div> : null}
          </div>

          <div className="categoryHeaderRight">
            {pills.length ? (
              <div className="categoryPills">
                {pills.map((pill) => (
                  <span key={pill} className="categoryMiniPill">
                    {pill}
                  </span>
                ))}
              </div>
            ) : null}

            <span className="categoryToggle" aria-hidden="true">
              <svg className="categoryToggleIcon" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </button>

        {open ? (
          <div id={panelId} className="categoryBody">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
