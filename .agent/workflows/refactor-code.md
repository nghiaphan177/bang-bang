---
description: Refactor a module or component following the project's standards
---

# Refactor Code

## Description
Systematically refactor a specified module, class, or component within the TypeScript monorepo.

## Input
- **Target**: Module path, class name, or component description provided by the user after invoking `/refactor-code`.

## Steps

### Phase 1: Research & Understand

1. Locate and read the target file(s). Understand:
   - Current responsibility
   - Dependencies (shared, server, or client)
   - Layer placement (is it in the correct package?)
   - Existing test coverage

2. Read all files that import or are imported by the target to understand the dependency graph.

### Phase 2: Create Implementation Plan

3. Create `implementation_plan.md` artifact with:
   - **Current State Analysis**: What is being refactored
   - **Proposed Changes**: File-by-file breakdown
   - **Risk Assessment**: What could break, which types need updating
   - **Verification Plan**: How to verify the refactor is correct

4. **STOP and wait for user approval** before proceeding to Phase 3.

### Phase 3: Refactor Step-by-Step

5. Apply refactoring:
   - Rename variables/methods to be self-documenting
   - Extract logic into focused functions/classes
   - Enforce TypeScript best practices (strict typing, avoid `any`)
   - Clean up imports

6. Run type checks frequently to catch errors:
   ```bash
   npm run check:types
   ```

### Phase 4: Verify

7. Full type check:
   ```bash
   npm run check:types
   ```

8. Verify the server and client build/start correctly.

9. Create `walkthrough.md` artifact summarizing:
   - What was refactored and why
   - Files created/modified/deleted
   - Test results
