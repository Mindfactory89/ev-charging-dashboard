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
- `session-management.css` contains the responsive presentation for this workflow.

## CSV import contract

- Import follows three visible stages: select a file, review the detected data, and confirm the final result.
- File type, size, empty content, and unusable structures fail next to the upload control before any request is sent.
- Profile and fallback settings recalculate the preview immediately; status summaries double as accessible row filters.
- Valid rows continue importing when an individual request fails, and the final result identifies partial failures without losing the successful work.
- Automatic mapping remains the default; manual column mapping is progressively disclosed and shows required fields plus first-row examples next to each selection.
- Custom profiles persist mapping, provider profile, and fallback values locally, can be updated or deleted, and never require a server account.
- `import-overhaul.css` contains the responsive presentation for this workflow.

## Data state and recovery contract

- Initial loading, recoverable data errors, empty results, and fatal rendering failures each have a distinct visual and semantic state.
- Recoverable failures preserve the surrounding context, explain that stored data is safe, expose optional technical details, and offer one retry action.
- Lazy boundaries announce their label to assistive technology while decorative skeletons stay hidden.
- Fatal errors offer a direct reload action and keep diagnostic output behind a disclosure control.
- `state-overhaul.css` contains the visual states and recovery presentation.

## Accessibility and responsive contract

- Dense history views render an initial twelve rows and expose more records progressively, reducing initial DOM work without hiding the total.
- History rows preserve a responsive card layout while exposing table, row, header, and cell semantics to assistive technology.
- Form controls use a mobile-safe font size, long headings wrap, and primary controls remain full width where horizontal space is limited.
- Forced-colors, increased-contrast, reduced-motion, keyboard-focus, and screen-reader states remain functional independently of visual styling.
- Shared session-edit parsing, validation, change detection, and payload construction live in `sessionEditForm.js` instead of being duplicated in the history component.
- `accessibility-polish.css` contains the shared responsive and accessibility adjustments.

## History discovery contract

- Search and sorting remain in the first interaction layer; metadata filters open progressively when needed.
- Search matches provider, location, vehicle, connector, tags, notes, and both ISO and localized dates without requiring submission.
- Active criteria remain visible as removable chips, result counts update accessibly, and empty results explain how to recover.
- Saved views include search, sorting, and metadata filters, persist only in the current browser, and can be updated or deleted without an account.
- Sorting is stable, missing numeric values remain at the end, and the corresponding table header exposes its sort state where applicable.
- `history-tools.css` contains the history search, filtering, and saved-view presentation.

## Vehicle profile contract

- Built-in and user-created vehicle profiles share one selector; only custom profiles can be edited or deleted.
- A custom profile requires a name, usable battery capacity, and reference consumption; charging power remains optional.
- The active profile persists locally and supplies the default vehicle for new sessions and CSV imports.
- Reference consumption is matched to the session vehicle and drives recovered-range estimates instead of relying on one global constant.
- Custom profiles render without external image dependencies and remain fully usable offline.
- `vehicle-profiles.css` contains the vehicle catalogue and profile presentation.

## Personal charging goals contract

- Annual budget, maximum weighted kWh price, and minimum efficiency score are independent optional targets; at least one is required to activate the compass.
- Targets are stored only in the current browser, apply consistently to every selected year, and never mutate charging data.
- Lower-is-better and higher-is-better metrics expose their direction in plain language instead of relying on color or progress alone.
- The overview shows only configured targets, current values, explicit thresholds, and an accessible status summary.
- Target editing uses a focus-managed drawer, field-level validation, discard protection, and a deliberate reset action.
- `charging-goals.css` contains the goal compass and editor presentation.

## Data control contract

- Charging sessions, monthly summaries, and seasonal comparisons are available from one clearly scoped export area.
- Full-history export deliberately omits the year query while year-level exports keep the currently selected dashboard context.
- Server-stored charging data and browser-only personalisation are explained as separate data sources in plain language.
- Local backups contain only allowlisted dashboard preferences, never charging sessions, credentials, or unrelated browser storage.
- Restore files are size-limited, format- and version-checked, previewed before use, and applied only after explicit confirmation.
- The data drawer traps focus, restores it on close, supports Escape, and remains operable across mobile, landscape, forced-colors, and reduced-motion modes.
- `data-control.css` contains the export, backup, and restore presentation.

## Personal action centre contract

- Recommendations are derived from existing goals, signals, and charging behaviour and are ordered by practical impact.
- The overview initially exposes only the highest-priority actions; additional recommendations remain progressively disclosed.
- Dismissed recommendations are scoped to the selected year, stay in the current browser, and can always be restored.
- Each recommendation leads directly to the relevant filtered history or analysis view instead of ending in a dead-end card.
- `personal-action-center.css` contains the recommendation presentation.

## Data quality contract

- Missing context, missing core measurements, statistical outliers, and likely duplicates are reported without changing source data automatically.
- Every issue exposes the affected session, a plain-language reason, direct editing, and an explicit reviewed state.
- Bulk actions require a deliberate selection and support safe metadata tagging or local review acknowledgement; destructive bulk deletion is intentionally excluded.
- Reviewed issue IDs and unfinished session drafts stay in the current browser and are included in allowlisted preference backups.
- `data-quality.css` contains the issue review and bulk-action presentation.

## Notification centre contract

- Notifications are generated from existing goals, data quality, monthly summaries, and saving opportunities; no parallel analytics model is introduced.
- The header badge reflects only visible unread items. Reading, dismissing, category preferences, and seven-day snoozing persist locally.
- Notification destinations reuse the app's established history and analysis navigation and move users directly to the relevant context.
- The drawer traps focus, restores it on close, supports Escape, mobile safe areas, forced colors, and reduced motion.
- Telegram `/summary` provides an on-demand annual snapshot without enabling unsolicited outbound alerts.
- `notifications.css` contains the notification centre presentation.

## Installable web-app contract

- The production UI registers one same-origin service worker and caches only the app shell and static assets; API responses remain network-owned.
- Navigation uses a network-first strategy and falls back to a cached shell or a dedicated offline explanation when the shell has not been loaded before.
- Online loss, a waiting update, installation availability, and installed display mode are separate states and never rely on color alone.
- A waiting worker activates only after an explicit user action; the first service-worker install does not trigger an unnecessary reload.
- The manifest provides standalone presentation, home-screen icons, and direct shortcuts into session entry and history.
- `pwa-experience.css` contains install, offline, and update-status presentation.

## Global quick-access contract

- `Cmd/Ctrl + K` opens quick access globally; `/` does the same only when focus is not inside an editable control.
- Results combine top-level destinations, established drawers, primary actions, and the selected year's charging sessions without creating a second navigation model.
- Search is case- and accent-insensitive and covers provider, location, vehicle, connector, tags, notes, date, and energy.
- Arrow keys move through results, Enter activates, Escape closes, focus stays inside the dialog, and launcher focus is restored afterwards.
- Selecting a session reuses the existing history editor and direct actions reuse existing application callbacks.
- Mobile presentation becomes a safe-area-aware bottom sheet while desktop keeps a centred command palette.
- `quick-access.css` contains the desktop command palette and mobile bottom-sheet presentation.

## Performance and architecture contract

- Shared interface icons live in `icons.jsx`; new cross-feature icons must not duplicate inline path definitions.
- Below-the-fold reports, charts, and configuration drawers load in dedicated chunks and retain labelled loading feedback.
- Long history rows use browser rendering containment in addition to progressive row disclosure, so off-screen content skips paint work without losing table semantics.
- The production build is checked against explicit JavaScript and CSS size budgets through `npm run check:bundle`.
- Performance work must keep mobile, landscape, reduced-motion, and keyboard behaviour intact while reducing initial work.

## Explainability contract

- Goal scores and personal recommendations expose their data basis, sample-derived confidence, expected effect, and limitations on demand.
- Explanations remain progressively disclosed and never rely on colour alone to communicate confidence.
- Savings estimates are presented as directional annualised potential, never as a guaranteed amount.
- Shared explanation logic lives in `explainability.js`; its presentation lives in `explainability.css`.

## Charging profile contract

- Charging profiles combine home or public context, grid/PV source, fixed or time-dependent prices, and a preferred charging window.
- The active profile persists locally, is included in allowlisted preference backups, and pre-fills new sessions without overwriting a restored draft.
- Time windows may span midnight; price selection and session defaults remain covered by pure unit tests.
- Editing uses a focus-managed responsive drawer and the overview presents only one compact active-profile summary.
- `charging-profiles.css` contains the profile card and editor presentation.
