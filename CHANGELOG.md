# Changelog

## [2026-05-21]
- **Client**: Extracted `SceneBuilder` from `GameManager` (Task 1.1). Reduced `GameManager` footprint by moving scene construction logic to a dedicated builder class.
- **Client**: Wired `HUD`, `MatchOverlay`, and `Minimap` into `GameManager` (Task 1.2). Programmatically created Canvas UI node hierarchy in `SceneBuilder` and updated them from `GameManager`'s state.
