---
description: Review all staged/unstaged changes, identify issues, and produce a summary report
---

# Review Staged Changes

## Description
Reviews all current staged and unstaged changes (git diff HEAD), identifies potential issues such as compile errors, missing types, dead code, and produces a structured review report as an artifact.

## Steps

// turbo
1. List all changed files with stats:
   ```bash
   git diff HEAD --stat
   ```

// turbo
2. Get the full diff for review:
   ```bash
   git diff HEAD
   ```

3. For each changed file, review for:
   - **Type errors**: Missing imports, `any` types, incorrect interfaces
   - **Null/Undefined safety**: Proper checks for optional fields
   - **Dead code**: Unused variables, functions, or imports
   - **Consistency**: If a shared type changed, verify it's updated in both client and server
   - **Race conditions**: Network sync issues or state mutation bugs

// turbo
4. Run type checks to catch any issues:
   ```bash
   npm run check:types
   ```

5. Produce a review artifact with:
   - Table of all changed files with verdict (✅/⚠️/🔴)
   - Detailed description of any issues found
   - Suggested fixes for critical issues
   - Summary table: Critical / Minor / Info counts

## Output
Write the review to an artifact file named `staged_review.md` in the conversation artifacts directory.
