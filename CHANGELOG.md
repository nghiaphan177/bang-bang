# Changelog

## [2026-05-21]
- **Client**: Extracted `SceneBuilder` from `GameManager` (Task 1.1). Reduced `GameManager` footprint by moving scene construction logic to a dedicated builder class.
- **Client**: Wired `HUD`, `MatchOverlay`, and `Minimap` into `GameManager` (Task 1.2). Programmatically created Canvas UI node hierarchy in `SceneBuilder` and updated them from `GameManager`'s state.
- **Client**: Fixed invisible HP bar by refactoring `HUDController` to draw the bar programmatically via a `Graphics` component instead of an unconfigured `ProgressBar`.
- **Client**: Fixed "label" text overlay by initializing the countdown label as inactive by default and dynamically showing/hiding match overlay panels in `GameManager` depending on active match phases.
- **Build**: Implemented root CI scripts (Task 8.1) to typecheck both `shared` and `server` packages with `npm run check:all`.
