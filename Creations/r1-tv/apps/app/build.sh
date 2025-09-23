#!/bin/bash

# Build script for r1-tv (Create React App)
# - Builds the CRA app at the r1-tv root
# - Copies output to apps/static/<random>/
# - Updates top-level redirect index.html

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_NAME_FILE=".project-name"
STATIC_DIR="../static"
# Resolve paths relative to this script's directory regardless of invocation cwd
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# apps/app -> r1-tv project root
R1TV_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$R1TV_ROOT/build"

generate_random_name() {
  cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 12 | head -n 1
}

validate_name() {
  if [[ "$1" =~ ^[a-zA-Z0-9]+$ ]]; then
    return 0
  else
    return 1
  fi
}

if [ -f "$PROJECT_NAME_FILE" ]; then
  PROJECT_NAME=$(cat "$PROJECT_NAME_FILE")
  echo -e "${BLUE}Building project: ${GREEN}$PROJECT_NAME${NC}"
else
  echo -e "${YELLOW}First build detected!${NC}"
  RANDOM_NAME=$(generate_random_name)
  echo -e "${BLUE}Generated project name: ${GREEN}$RANDOM_NAME${NC}"
  PROJECT_NAME=$RANDOM_NAME

  if [ -d "$STATIC_DIR/$PROJECT_NAME" ]; then
    echo -e "${RED}Error: A project with name '$PROJECT_NAME' already exists!${NC}"
    echo -e "${YELLOW}Please run the script again to generate a new name.${NC}"
    exit 1
  fi

  echo "$PROJECT_NAME" > "$PROJECT_NAME_FILE"
  echo -e "${GREEN}Project name saved: $PROJECT_NAME${NC}"
fi

# Ensure deps exist in r1-tv root
if [ ! -d "$R1TV_ROOT/node_modules" ] || [ ! -f "$R1TV_ROOT/node_modules/.bin/react-scripts" ]; then
  echo -e "${YELLOW}Installing dependencies in r1-tv root...${NC}"
  (cd "$R1TV_ROOT" && (npm ci || npm install)) || {
    echo -e "${RED}Dependency install failed${NC}"; exit 1; }
fi

echo -e "${BLUE}Building CRA app in r1-tv root...${NC}"
(cd "$R1TV_ROOT" && PUBLIC_URL=. npm run build) || {
  echo -e "${RED}npm run build failed${NC}"; exit 1; }

mkdir -p "$STATIC_DIR"

echo -e "${BLUE}Copying build to $STATIC_DIR/$PROJECT_NAME...${NC}"
rm -rf "$STATIC_DIR/$PROJECT_NAME"
cp -r "$BUILD_DIR" "$STATIC_DIR/$PROJECT_NAME" || {
  echo -e "${RED}Copy build output failed${NC}"; exit 1; }

# Ensure a local dist/ exists so the repo watcher can skip future builds when unchanged
mkdir -p "$SCRIPT_DIR/dist"

# Make asset references relative for static hosting
cd "$STATIC_DIR/$PROJECT_NAME" || exit 1
find . -name "*.html" -exec sed -i.bak 's|href="/|href="./|g' {} +
find . -name "*.html" -exec sed -i.bak 's|src="/|src="./|g' {} +
find . -name "*.js" -exec sed -i.bak 's|from \"/|from \"./|g' {} +
find . -name "*.bak" -delete
cd - > /dev/null

# Update upper-level redirect index.html
UPPER_INDEX="$(cd .. && cd .. && pwd)/index.html"
REL_PATH="apps/static/$PROJECT_NAME/index.html"
if [ -f "$UPPER_INDEX" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -E -i '' "s|apps/static/[A-Za-z0-9]+/index.html|$REL_PATH|g" "$UPPER_INDEX"
  else
    sed -E -i "s|apps/static/[A-Za-z0-9]+/index.html|$REL_PATH|g" "$UPPER_INDEX"
  fi
  echo -e "${BLUE}Updated upper index.html to point to ${GREEN}$REL_PATH${NC}"
else
  cat > "$UPPER_INDEX" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>r1-tv</title>
  <meta http-equiv="refresh" content="0; url=$REL_PATH">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <p>If you are not redirected automatically, follow this <a href="$REL_PATH">$REL_PATH</a>.</p>
</body>
</html>
EOF
  echo -e "${BLUE}Created upper index.html pointing to ${GREEN}$REL_PATH${NC}"
fi

echo -e "${GREEN}Build complete!${NC}"
echo -e "${BLUE}Your project is available at:${NC}"
echo -e "  Local: http://localhost:5000/creations/r1-tv/index.html"
echo -e "  Static: /creations/r1-tv/$REL_PATH"


