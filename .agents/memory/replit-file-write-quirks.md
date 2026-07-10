---
name: Replit file write quirks
description: Non-obvious file write behaviors in this Replit workspace that cause silent failures.
---

## The problem
Overwriting existing git-tracked files silently fails in this workspace:
- `WriteFile` tool reports "Wrote N bytes" but disk content stays at old version
- Python `open(path,'w').write(...)` also appears to succeed but old content remains
- Shell `cat > file << 'EOF'` heredocs similarly don't persist for existing tracked files
- `wc -l` and `grep` may briefly show new content right after write, then revert

## Root cause
The workspace has a file sync mechanism (likely tied to git checkpoints) that resets modified tracked files back to their committed state shortly after writes.

## Working solutions
1. **Delete first, then write**: `rm file && cat > /tmp/new.ts << 'EOF' ... cp /tmp/new.ts file`
2. **Shell /tmp staging**: Write to /tmp with heredoc, then `cp` to workspace path
3. For `WriteFile` tool on new (untracked) files: works fine
4. **Small test files** (new, not tracked by git): writes persist normally

## Verification pattern
After writing, always confirm with `stat -c "%i %s" <path>` — if the inode matches the old file, the write didn't persist.

## pnpm install
`pnpm add` and `pnpm install` occasionally disconnect the shell process under heavy load. Workaround: run with `nohup ... > /tmp/log.txt 2>&1` and `wait`.

**Why:** Discovered during PostgreSQL migration when all route file rewrites seemed to work but tsc kept seeing old SQLite code.

**How to apply:** Any time you need to modify a source file that already exists and is git-tracked in this workspace, use delete+recreate via /tmp staging.
