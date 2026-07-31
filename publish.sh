#!/usr/bin/env bash

set -e

# Default values
VERSION_TYPE=${1:-patch}
COMMIT_MSG=${2:-"chore(release): bump version"}

echo "Starting release process..."
echo "Version bump type: $VERSION_TYPE"
echo "Commit message: $COMMIT_MSG"

# 1. Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Stashing or committing changes first."
  exit 1
fi

# 2. Run quality checks & build
npm run build

# 3. Bump version and generate commit + git tag
npm version "$VERSION_TYPE" -m "$COMMIT_MSG - v%s"

# 4. Push commit and tags to remote
git push origin main --follow-tags

echo "Successfully bumped version and pushed to origin!"