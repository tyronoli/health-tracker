#!/usr/bin/env bash
# Builds one text file you can attach to a new chat: the project tree, recent commits,
# docs/CONTEXT.md, TASK.md, and any extra files you name.
#
# Usage (from anywhere in the repo):
#   scripts/context.sh backend/apps/reminders/services.py backend/apps/reminders/tasks.py > /tmp/context.txt
#
# Only files tracked by git are listed, so .env and other secrets are never included
# unless you pass them yourself. Do not.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "# Repository files"
git ls-files | grep -vE '(package-lock\.json|\.svg$|\.png$|\.ico$)'

echo
echo "# Recent commits"
git log --oneline -15

for file in docs/CONTEXT.md TASK.md "$@"; do
  case "$file" in
    .env|*/.env|*.pem|*.key) echo "Refusing to include $file" >&2; continue ;;
  esac
  echo
  echo "===== $file ====="
  cat "$file"
done