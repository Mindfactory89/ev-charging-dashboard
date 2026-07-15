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

## Session management contract

- Details and editing stay inside one predictable side-drawer workflow; editing never expands the data table or shifts its rows.
- The editor separates charging data from optional context, previews derived values live, and validates required fields next to the input.
- Closing a changed draft requires confirmation, successful saves are announced, and deletion remains reversible through the existing undo feedback.
- Both drawers trap keyboard focus, restore it to the launcher, support Escape, and keep their primary actions reachable above mobile safe areas.
- `session-management.css` owns package 7 and only consumes semantic design-system tokens.

## CSV import contract

- Import follows three visible stages: select a file, review the detected data, and confirm the final result.
- File type, size, empty content, and unusable structures fail next to the upload control before any request is sent.
- Profile and fallback settings recalculate the preview immediately; status summaries double as accessible row filters.
- Valid rows continue importing when an individual request fails, and the final result identifies partial failures without losing the successful work.
- `import-overhaul.css` owns package 8 and only consumes semantic design-system tokens.

## Data state and recovery contract

- Initial loading, recoverable data errors, empty results, and fatal rendering failures each have a distinct visual and semantic state.
- Recoverable failures preserve the surrounding context, explain that stored data is safe, expose optional technical details, and offer one retry action.
- Lazy boundaries announce their label to assistive technology while decorative skeletons stay hidden.
- Fatal errors offer a direct reload action and keep diagnostic output behind a disclosure control.
- `state-overhaul.css` owns package 9 and only consumes semantic design-system tokens.

## Accessibility and responsive contract

- Dense history views render an initial twelve rows and expose more records progressively, reducing initial DOM work without hiding the total.
- History rows preserve a responsive card layout while exposing table, row, header, and cell semantics to assistive technology.
- Form controls use a mobile-safe font size, long headings wrap, and primary controls remain full width where horizontal space is limited.
- Forced-colors, increased-contrast, reduced-motion, keyboard-focus, and screen-reader states remain functional independently of visual styling.
- Shared session-edit parsing, validation, change detection, and payload construction live in `sessionEditForm.js` instead of being duplicated in the history component.
- `accessibility-polish.css` owns package 10 and only consumes semantic design-system tokens.
