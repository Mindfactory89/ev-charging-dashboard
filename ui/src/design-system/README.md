# Mobility Dashboard Design Foundation

The design system uses three layers:

1. `primitives.css` contains raw palette, spacing, typography, radius, motion, and elevation values.
2. `semantic.css` assigns purpose and owns Dark/Light theme mappings.
3. `components.css` defines stable contracts for controls, cards, tables, dialogs, and tooltips.

`integration.css` maps the existing UI onto those contracts while screens are migrated incrementally. New component code must use semantic or component tokens and must not introduce raw color values.

## Theme contract

- `data-theme="dark"` is the product default.
- `data-theme="light"` enables the light palette.
- The persisted preference may be `dark`, `light`, or `system`.
- Theme changes also update `color-scheme` and the browser theme color.

## Interaction contract

- Interactive controls are at least 44px high.
- Focus indicators use `--color-focus` and remain visible in both themes.
- Hover, active, focus, loading, and disabled states use the shared duration and easing tokens.
- Motion is disabled when `prefers-reduced-motion: reduce` is active.

## App shell contract

- `shell.css` owns the application frame, primary navigation, context header, and responsive navigation changes.
- Viewports from 1024px use the persistent sidebar; smaller viewports use the three-destination bottom navigation.
- The floating add action is only used where the sidebar action is unavailable and always clears the bottom navigation safe area.
- Top-level navigation updates the URL, restores correctly through browser back, and moves assistive-technology focus to the active main region.
- The vehicle hero is overview-specific; analysis and history start directly with their task content.

## Onboarding contract

- `onboarding.css` and `OnboardingFlow.jsx` provide a voluntary three-step first-run flow with progress, back, skip, and escape routes.
- Completion is persisted locally; `?onboarding=1` and the settings action can replay the introduction without clearing application data.
- Focus moves into the dialog, remains trapped while open, returns to the launcher on close, and background scrolling is suspended.
- First-run choices reuse the live theme system and can route users to their preferred top-level section or directly into session entry.
- Empty data years use one contextual primary action and suppress competing global add actions.

## Dashboard hierarchy contract

- The overview starts with the vehicle context and one prioritized annual signal; supporting KPIs form a separate, scannable row.
- KPI context labels explain the comparison period or trend instead of repeating the metric value.
- Charts expose peak, average, and low values before the plot and provide the same data in an accessible table.
- Metric switches are limited to primary modes, remain at least 44px high, and use a compact two-column layout on small screens.
- `dashboard-overhaul.css` owns the overview hierarchy and may only consume semantic or component tokens.
