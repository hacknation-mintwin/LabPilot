#!/usr/bin/env bash
set -euo pipefail

# Local fallback maintainer for mcp-server branch.
# It periodically:
# 1) fetches new upstream refs
# 2) syncs source -> mcp-server
# 3) runs mcp-server tests
# 4) optionally triggers a Cursor repair command on failures

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TARGET_BRANCH="${TARGET_BRANCH:-mcp-server}"
FEATURE_BRANCH="${FEATURE_BRANCH:-feature/experiment-similarity-onepager}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-1800}"
RUN_ONCE="${RUN_ONCE:-0}"
AUTO_PUSH="${AUTO_PUSH:-0}"

ARTIFACT_DIR="${ARTIFACT_DIR:-$REPO_ROOT/.artifacts/local-maintainer}"
LOCK_FILE="$ARTIFACT_DIR/maintainer.lock"
PID_FILE="$ARTIFACT_DIR/maintainer.pid"
LOG_FILE="$ARTIFACT_DIR/maintainer.log"
WORKTREE_DIR="${WORKTREE_DIR:-$ARTIFACT_DIR/worktree}"
mkdir -p "$ARTIFACT_DIR"

log() {
  local line
  line="[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
  printf '%s\n' "$line"
  printf '%s\n' "$line" >> "$LOG_FILE"
}

choose_source_branch() {
  if git -C "$WORKTREE_DIR" show-ref --verify --quiet "refs/remotes/origin/$FEATURE_BRANCH"; then
    printf '%s' "$FEATURE_BRANCH"
  else
    printf '%s' "$MAIN_BRANCH"
  fi
}

trigger_cursor_repair() {
  local reason="$1"
  local source_branch="$2"
  local run_id
  run_id="$(date -u +'%Y%m%dT%H%M%SZ')"
  local prompt_file="$ARTIFACT_DIR/cursor-repair-$run_id.md"

  cat > "$prompt_file" <<EOF
# Local MCP Maintainer Repair Request

Reason: $reason
Source branch: $source_branch
Target branch: $TARGET_BRANCH
Repository: $REPO_ROOT
Worktree: $WORKTREE_DIR

Please do the following:
1. Inspect current branch state and identify sync/test failure cause.
2. Fix mcp-server issues to restore passing tests.
3. Keep changes scoped to MCP server maintenance.
4. Re-run: npm --prefix ./mcp-server test
EOF

  if [[ -n "${CURSOR_REPAIR_COMMAND:-}" ]]; then
    log "Triggering Cursor repair command."
    export CURSOR_REPAIR_REASON="$reason"
    export CURSOR_REPAIR_SOURCE_BRANCH="$source_branch"
    export CURSOR_REPAIR_TARGET_BRANCH="$TARGET_BRANCH"
    export CURSOR_REPAIR_PROMPT_FILE="$prompt_file"
    # shellcheck disable=SC2086
    eval "$CURSOR_REPAIR_COMMAND"
  else
    log "No CURSOR_REPAIR_COMMAND configured. Wrote repair prompt: $prompt_file"
  fi
}

ensure_target_branch() {
  local source_branch="$1"
  if git -C "$WORKTREE_DIR" show-ref --verify --quiet "refs/remotes/origin/$TARGET_BRANCH"; then
    git -C "$WORKTREE_DIR" checkout "$TARGET_BRANCH" >/dev/null 2>&1 || git -C "$WORKTREE_DIR" checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
    git -C "$WORKTREE_DIR" reset --hard "origin/$TARGET_BRANCH" >/dev/null
  else
    git -C "$WORKTREE_DIR" checkout -B "$TARGET_BRANCH" "origin/$source_branch" >/dev/null
  fi
}

ensure_worktree() {
  if [[ ! -e "$WORKTREE_DIR/.git" ]]; then
    log "Creating maintainer worktree at $WORKTREE_DIR"
    git worktree add --force "$WORKTREE_DIR" "$MAIN_BRANCH" >/dev/null
  fi
}

run_cycle() {
  log "Starting maintainer cycle."
  ensure_worktree
  if ! git -C "$WORKTREE_DIR" fetch origin --prune; then
    log "Fetch failed; remote refs may be stale."
    trigger_cursor_repair "fetch_failed" "unknown"
    return 1
  fi

  local source_branch
  source_branch="$(choose_source_branch)"
  log "Resolved source branch: $source_branch"
  if ! git -C "$WORKTREE_DIR" show-ref --verify --quiet "refs/remotes/origin/$source_branch"; then
    log "Resolved source ref origin/$source_branch not found after fetch."
    trigger_cursor_repair "source_ref_missing" "$source_branch"
    return 1
  fi

  ensure_target_branch "$source_branch"

  if ! git -C "$WORKTREE_DIR" merge --no-edit --no-ff "origin/$source_branch"; then
    log "Merge failed; aborting merge and requesting Cursor repair."
    git -C "$WORKTREE_DIR" merge --abort || true
    trigger_cursor_repair "merge_conflict_or_sync_failure" "$source_branch"
    return 1
  fi

  log "Running MCP tests."
  npm --prefix "$WORKTREE_DIR/mcp-server" install >/dev/null
  if ! npm --prefix "$WORKTREE_DIR/mcp-server" test; then
    log "Tests failed; trying one self-heal pass."
    npm --prefix "$WORKTREE_DIR/mcp-server" install >/dev/null
    if ! npm --prefix "$WORKTREE_DIR/mcp-server" test; then
      trigger_cursor_repair "mcp_tests_failed" "$source_branch"
      return 1
    fi
  fi

  if [[ "$AUTO_PUSH" == "1" ]]; then
    log "AUTO_PUSH=1, pushing $TARGET_BRANCH."
    git -C "$WORKTREE_DIR" push origin "$TARGET_BRANCH"
  else
    log "AUTO_PUSH=0, keeping updates local."
  fi

  log "Cycle completed successfully."
}

if [[ -f "$LOCK_FILE" ]]; then
  if [[ -f "$PID_FILE" ]]; then
    existing_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${existing_pid}" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      log "Lock file exists and process $existing_pid is running. Exiting."
      exit 1
    fi
    log "Stale lock detected for PID ${existing_pid:-unknown}; recovering."
  else
    log "Stale lock detected without PID file; recovering."
  fi
  rm -f "$LOCK_FILE" "$PID_FILE"
fi

touch "$LOCK_FILE"
echo "$$" > "$PID_FILE"
trap 'rm -f "$LOCK_FILE" "$PID_FILE"' EXIT

while true; do
  if ! run_cycle; then
    log "Cycle ended with errors."
  fi

  if [[ "$RUN_ONCE" == "1" ]]; then
    break
  fi

  log "Sleeping for ${INTERVAL_SECONDS}s."
  sleep "$INTERVAL_SECONDS"
done
