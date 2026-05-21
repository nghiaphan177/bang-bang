---
description: Create a new branch from main, stage all changes, and commit with a descriptive message
---

# Commit Staged Changes

## Description
Creates a new feature branch, stages only the relevant code and docs, then commits with a conventional commit message. Optionally pushes to remote.

Only these paths are staged:
- `packages/` — Client (Cocos), server, and shared code
- `docs/` — Game design and context docs
- `tools/` — Utility scripts and Blender source files
- `package.json`, `package-lock.json`, `tsconfig.*.json`

## Arguments
- `branch_name` (required): The branch name to create, e.g. `feature/tank-movement`
- `commit_message` (required): The commit message, e.g. `feat(server): authoritative tank physics`

## Steps

// turbo
1. Ensure we're on main and it's up to date:
   ```bash
   git checkout main && git pull
   ```

// turbo
2. Verify types pass before committing:
   ```bash
   npm run check:types
   ```

3. If type checks fail, STOP and report errors. Do not proceed.

// turbo
4. Create and switch to the new branch:
   ```bash
   git checkout -b <branch_name>
   ```

5. Stage ONLY relevant code:
   ```bash
   git add packages/ docs/ tools/ package.json package-lock.json tsconfig.base.json
   ```

   > Note: `packages/client/` is legacy Phaser — it will be staged if modified but should NOT be modified.

// turbo
6. Show what will be committed:
   ```bash
   git diff --cached --stat
   ```

7. Commit with the provided message:
   ```bash
   git commit -m "<commit_message>"
   ```

8. Ask user if they want to push to remote:
   ```bash
   git push -u origin <branch_name>
   ```

## What NOT to stage
- `.agent/` — workflows and rules (local dev tooling only)
- `.env` or other local secrets
- Raw assets before processing (unless requested)

## Notes
- Branch names should follow: `feature/`, `fix/`, `refactor/`, `chore/` prefixes
- Commit messages should follow conventional commits: `feat(scope): description`
- If the user doesn't provide branch_name or commit_message, ask them before proceeding
