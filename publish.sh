#!/usr/bin/env bash

set -e

# Default values
VERSION_TYPE=${1:-patch}
COMMIT_MSG=${2:-"chore(release): bump version"}

echo "Starting release process..."
echo "Version bump type: $VERSION_TYPE"
echo "Commit message: $COMMIT_MSG"

git add .
git commit -m "$COMMIT_MSG"

# 2. Run quality checks & build
npm run build

# 3. Bump version and generate commit + git tag
npm version "$VERSION_TYPE" -m "$COMMIT_MSG - v%s"

# 4. Push commit and tags to remote
git push --follow-tags

echo "Successfully bumped version and pushed to origin!"

npm login
npm publish