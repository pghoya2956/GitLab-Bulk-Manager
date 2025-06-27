#!/usr/bin/env bash
# /srcbackup/version/kostar-gitlab-sync/force-push.sh
# Git 1.8.3.1 compatible: use cd/pushd instead of git -C
# ----------------------------------------------------
set -euo pipefail

BASE_DIR="$HOME/kostar-gitlab-sync"
LIST_FILE="$BASE_DIR/repos.list"

PREFIX="skip-ci:"
TS_FMT='+%F %T'
ts() { date "$TS_FMT"; }

while IFS= read -r line || [ -n "$line" ]; do
  # skip blank lines and lines starting with #
  [ -z "$line" ] && continue
  case "$line" in \#*) continue ;; esac

  repo=$(echo "$line" | awk '{print $1}')
  branch=$(echo "$line" | awk '{print $2}')
  branch=${branch:-main}

  if [ ! -d "$repo/.git" ]; then
    printf '%s SKIP not git repo %s\n' "$(ts)" "$repo"
    continue
  fi

  pushd "$repo" >/dev/null

  git add -A
  if git diff --cached --quiet; then
    printf '%s NO CHANGE %s\n' "$(ts)" "$repo"
    popd >/dev/null
    continue
  fi

  git commit -m "${PREFIX} $(basename "$repo") $(ts)"
  git push origin "HEAD:${branch}" --force
  printf '%s PUSHED %s %s\n' "$(ts)" "$repo" "$branch"

  popd >/dev/null
done < "$LIST_FILE"
