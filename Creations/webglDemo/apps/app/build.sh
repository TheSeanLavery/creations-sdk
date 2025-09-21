#!/bin/bash

# Build script for Template projects
# Generates unique project name and builds to apps/static/

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_NAME_FILE=".project-name"
STATIC_DIR="../static"

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

# Ensure libs exist (copy from bouncing_ball_game if available)
if [ ! -f "src/lib/device-controls.js" ]; then
    echo -e "${YELLOW}Libraries missing, copying from main libs directory if present...${NC}"
    mkdir -p src/lib
    if [ -d "../../bouncing_ball_game/apps/app/src/lib" ]; then
      cp ../../bouncing_ball_game/apps/app/src/lib/*.js src/lib/
    fi
fi

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm ci || npm install
fi

echo -e "${BLUE}Building project...${NC}"
if ! npm run build; then
    echo -e "${YELLOW}npm run build failed, attempting npx vite build...${NC}"
    npx vite build || ./node_modules/.bin/vite build || exit 1
fi

mkdir -p "$STATIC_DIR"

echo -e "${BLUE}Copying build to $STATIC_DIR/$PROJECT_NAME...${NC}"
rm -rf "$STATIC_DIR/$PROJECT_NAME"
cp -r dist "$STATIC_DIR/$PROJECT_NAME"

cd "$STATIC_DIR/$PROJECT_NAME"
find . -name "*.html" -exec sed -i.bak 's|href="/|href="./|g' {} +
find . -name "*.html" -exec sed -i.bak 's|src="/|src="./|g' {} +
find . -name "*.js" -exec sed -i.bak 's|from "/|from "./|g' {} +
find . -name "*.bak" -delete
cd - > /dev/null

# Update upper-level redirect index.html in creations/template
UPPER_INDEX="$(cd .. && cd .. && pwd)/index.html"
if [ -f "$UPPER_INDEX" ]; then
  REL_PATH="apps/static/$PROJECT_NAME/index.html"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -E -i '' "s|apps/static/[A-Za-z0-9]+/index.html|$REL_PATH|g" "$UPPER_INDEX"
  else
    sed -E -i "s|apps/static/[A-Za-z0-9]+/index.html|$REL_PATH|g" "$UPPER_INDEX"
  fi
  echo -e "${BLUE}Updated upper index.html to point to ${GREEN}$REL_PATH${NC}"
fi

echo -e "${GREEN}Build complete!${NC}"
echo -e "${BLUE}Your project is available at:${NC}"
echo -e "  Local: http://localhost:8080/$PROJECT_NAME/"
echo -e "  Public: {ngrok-url}/$PROJECT_NAME/"
echo -e "\n${YELLOW}Run '../start-hosting.sh' from the apps directory to serve your project${NC}"


