#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ANDROID_DIR="$ROOT_DIR/android"
CONFIGURATION=${CONFIGURATION:-Release}
CLEAR=0
BUILD_TYPE=""

for arg in "$@"; do
  case "$arg" in
    --clear|-c)
      CLEAR=1
      ;;
    apk|app)
      BUILD_TYPE="$arg"
      ;;
  esac
done

BUILD_TYPE=${BUILD_TYPE:-apk}

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

install_js_dependencies() {
  if [ -f "$ROOT_DIR/package-lock.json" ]; then
    need_cmd npm
    log "Installing JS dependencies with npm..."
    (
      cd "$ROOT_DIR"
      npm install
    )
    return
  fi

  if [ -f "$ROOT_DIR/yarn.lock" ]; then
    need_cmd yarn
    log "Installing JS dependencies with yarn..."
    (
      cd "$ROOT_DIR"
      yarn install
    )
    return
  fi

  fail "No supported lockfile found. Expected package-lock.json or yarn.lock."
}

ensure_android_project() {
  if [ -d "$ANDROID_DIR" ]; then
    return
  fi

  need_cmd npx
  log "android directory not found. Running Expo prebuild..."
  (
    cd "$ROOT_DIR"
    npx expo prebuild -p android
  )
}

sync_android_project() {
  if [ "${SYNC_EXPO_CONFIG:-1}" != "1" ]; then
    return
  fi

  need_cmd npx
  log "Syncing Expo Android config into native project..."
  (
    cd "$ROOT_DIR"
    npx expo prebuild -p android --no-install
  )
}

resolve_expo_app_name() {
  if ! command -v npx >/dev/null 2>&1; then
    return
  fi

  if ! command -v node >/dev/null 2>&1; then
    return
  fi

  (
    cd "$ROOT_DIR"
    npx expo config --json 2>/dev/null | node -e 'const fs = require("fs");
try {
  const config = JSON.parse(fs.readFileSync(0, "utf8"));
  const name = typeof config.name === "string" ? config.name.trim() : "";
  if (name) {
    process.stdout.write(name);
  }
} catch {}'
  )
}

# Validate build type
case "$BUILD_TYPE" in
  apk|app)
    ;;
  *)
    fail "Invalid build type: $BUILD_TYPE. Use 'apk' or 'app'."
    ;;
esac

need_cmd find

if [ ! -d "$ROOT_DIR/node_modules" ] || [ "${FORCE_INSTALL:-0}" = "1" ]; then
  install_js_dependencies
fi

if [ "$CLEAR" = "1" ]; then
  need_cmd npx
  log "Running expo prebuild --clean for Android..."
  (
    cd "$ROOT_DIR"
    npx expo prebuild --platform android --clean
  )
else
  ensure_android_project
  sync_android_project
fi

if [ ! -f "$ANDROID_DIR/gradlew" ]; then
  fail "gradlew not found under android/. Check Expo prebuild output first."
fi

APP_DISPLAY_NAME=$(resolve_expo_app_name || true)
if [ -z "$APP_DISPLAY_NAME" ]; then
  APP_DISPLAY_NAME="app"
fi

OUTPUT_DIR="$ANDROID_DIR/app/build/outputs"
mkdir -p "$OUTPUT_DIR"

if [ "$BUILD_TYPE" = "apk" ]; then
  log "Building APK ($CONFIGURATION)..."
  (
    cd "$ANDROID_DIR"
    ./gradlew assembleRelease
  )

  APK_DIR="$OUTPUT_DIR/apk/release"
  if [ ! -d "$APK_DIR" ]; then
    fail "APK output directory not found: $APK_DIR"
  fi

  APK_PATH=$(find "$APK_DIR" -maxdepth 1 -name '*.apk' | sort | head -n 1)

  if [ -z "$APK_PATH" ]; then
    fail "No .apk artifact found under $APK_DIR."
  fi

  OUTPUT_NAME=${OUTPUT_NAME:-$(printf '%s-%s.apk' "$APP_DISPLAY_NAME" "$(date +%Y%m%d%H%M%S)" | tr ' ' '-')}
  FINAL_PATH="$OUTPUT_DIR/$OUTPUT_NAME"
  cp "$APK_PATH" "$FINAL_PATH"
  log "APK created: $FINAL_PATH"

else
  log "Building AAB ($CONFIGURATION)..."
  (
    cd "$ANDROID_DIR"
    ./gradlew bundleRelease
  )

  AAB_DIR="$OUTPUT_DIR/bundle/release"
  if [ ! -d "$AAB_DIR" ]; then
    fail "AAB output directory not found: $AAB_DIR"
  fi

  AAB_PATH=$(find "$AAB_DIR" -maxdepth 1 -name '*.aab' | sort | head -n 1)

  if [ -z "$AAB_PATH" ]; then
    fail "No .aab artifact found under $AAB_DIR."
  fi

  OUTPUT_NAME=${OUTPUT_NAME:-$(printf '%s-%s.aab' "$APP_DISPLAY_NAME" "$(date +%Y%m%d%H%M%S)" | tr ' ' '-')}
  FINAL_PATH="$OUTPUT_DIR/$OUTPUT_NAME"
  cp "$AAB_PATH" "$FINAL_PATH"
  log "AAB created: $FINAL_PATH"
fi
