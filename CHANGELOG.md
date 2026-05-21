# Changelog

## [2026-05-21]
- **Client**: Extracted `SceneBuilder` from `GameManager` (Task 1.1). Reduced `GameManager` footprint by moving scene construction logic to a dedicated builder class.
- **Client**: Wired `HUD`, `MatchOverlay`, and `Minimap` into `GameManager` (Task 1.2). Programmatically created Canvas UI node hierarchy in `SceneBuilder` and updated them from `GameManager`'s state.
- **Client**: Fixed invisible HP bar by refactoring `HUDController` to draw the bar programmatically via a `Graphics` component instead of an unconfigured `ProgressBar`.
- **Client**: Fixed "label" text overlay by initializing the countdown label as inactive by default and dynamically showing/hiding match overlay panels in `GameManager` depending on active match phases.
- **Client**: Implemented a floating 3D HP bar directly on top of each tank with relationship-based coloring (Green for player, Blue for ally, Red for enemy).
- **Client**: Added 100 HP divider lines to the 3D HP bar, configured to automatically hide when a tank's max HP is greater than 10,000 HP.
- **Build**: Implemented root CI scripts (Task 8.1) to typecheck both `shared` and `server` packages with `npm run check:all`.
- **Build**: Fixed TypeScript compilation issues in the Cocos Creator client copy of the shared package by re-exporting core type declarations from `network.ts`.
