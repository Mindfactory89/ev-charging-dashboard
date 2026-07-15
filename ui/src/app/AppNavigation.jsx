function NavigationIcon({ kind }) {
  if (kind === "analysis") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
      </svg>
    );
  }

  if (kind === "verlauf") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 7v5l3.2 2M5.1 5.1A9 9 0 1 1 3 12" />
        <path d="M3 5v5h5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function NavigationItems({ activeScreen, options, onSelectScreen }) {
  return options.map((option) => {
    const isActive = activeScreen === option.id;
    return (
      <button
        key={option.id}
        type="button"
        className={isActive ? "appNavItem active" : "appNavItem"}
        onClick={() => onSelectScreen(option.id)}
        aria-current={isActive ? "page" : undefined}
        aria-controls="main-content"
        title={option.meta}
      >
        <span className="appNavIcon">
          <NavigationIcon kind={option.id} />
        </span>
        <span className="appNavItemCopy">
          <span className="appNavLabel">{option.label}</span>
          <span className="appNavDescription">{option.shortMeta}</span>
        </span>
      </button>
    );
  });
}

export default function AppNavigation({
  activeScreen,
  addOpen,
  label,
  onAdd,
  onSelectScreen,
  options,
  addLabel,
  showAddAction = true,
}) {
  return (
    <>
      <aside className="appSidebar">
        <div className="appSidebarBrand" aria-hidden="true">
          <span className="appSidebarBrandMark">e</span>
          <span>
            <strong>Mobility</strong>
            <small>Intelligence</small>
          </span>
        </div>

        <nav className="appSidebarNav" aria-label={label}>
          <NavigationItems activeScreen={activeScreen} options={options} onSelectScreen={onSelectScreen} />
        </nav>

        {showAddAction ? (
          <button
            type="button"
            className="appSidebarAction"
            onClick={onAdd}
            aria-expanded={addOpen}
            aria-controls="add-session-composer"
          >
            <span className="appNavIcon"><AddIcon /></span>
            <span>{addLabel}</span>
          </button>
        ) : null}
      </aside>

      <nav className="appBottomNav" aria-label={label}>
        <NavigationItems activeScreen={activeScreen} options={options} onSelectScreen={onSelectScreen} />
      </nav>
    </>
  );
}
