---
description: Full pipeline — review staged changes, check types, then commit to a new branch
---

# Ship Changes

## Description
Runs the full pre-commit pipeline in sequence:
1. **Review** all staged/unstaged changes for issues
2. **Commit** source code to a new branch and push

This is a convenience workflow that chains `/review-staged` and `/commit-staged`.

## Arguments
- `branch_name` (required): Branch name, e.g. `feature/tank-movement`
- `commit_message` (required): Commit message, e.g. `feat(server): implement movement`

## Steps

1. **Run `/review-staged`**: Review all changes for type errors, null safety, dead code, and consistency. Produce `staged_review.md` artifact.

2. **Gate check**: If the review found any 🔴 Critical issues:
   - Show the issues to the user
   - Ask whether to fix them now or proceed anyway
   - If fixing, apply the fixes and re-run type checks

3. **Run `/commit-staged`**: Create branch, stage **only** `packages/`, `docs/`, `tools/`, then commit, and push.

## What gets committed
✅ `packages/` — Client, server, and shared code
✅ `docs/` — Documentation
✅ `tools/` — Utility scripts

## What does NOT get committed
❌ `.agent/` — Workflows and rules
❌ `node_modules/` or build artifacts

## Notes
- If the user doesn't provide `branch_name` or `commit_message`, infer from the changes:
  - Branch: `feature/<module>-<brief-description>`
  - Message: `feat(<module>): <brief description>` following conventional commits
- Always ask user to confirm the branch name and commit message before committing
