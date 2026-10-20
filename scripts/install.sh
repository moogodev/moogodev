#!/usr/bin/env sh
set -e

REPO="moogodev/moogodev"
BINARY="moogo"

info() { printf '\033[1;34m[moogo]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[moogo]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[moogo]\033[0m %s\n' "$*"; exit 1; }

info "Installing Moogo CLI..."

OS="$(uname -s)"
case "$OS" in
  Darwin) OS="darwin" ;;
  Linux)  OS="linux"  ;;
  *)      err "Unsupported operating system: $OS" ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)            err "Unsupported architecture: $ARCH" ;;
esac

info "Detected: ${OS}/${ARCH}"

info "Fetching latest release..."
TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep -m 1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
[ -z "$TAG" ] && err "Could not determine latest release. Make sure a release exists on GitHub."

info "Latest version: ${TAG}"

FILENAME="${BINARY}_${OS}_${ARCH}.tar.gz"
URL="https://github.com/${REPO}/releases/download/${TAG}/${FILENAME}"

TMPDIR="$(mktemp -d 2>/dev/null || mktemp -d -t moogo)"
cleanup() { rm -rf "$TMPDIR" 2>/dev/null || true; }
trap cleanup EXIT

info "Downloading ${URL}..."
curl -fsSL "$URL" -o "${TMPDIR}/${FILENAME}" || err "Download failed. Check if the release asset exists for ${OS}/${ARCH}."

info "Extracting..."
tar -xzf "${TMPDIR}/${FILENAME}" -C "$TMPDIR" || err "Failed to extract archive."

BIN="$(find "$TMPDIR" -type f -name "$BINARY" | head -n 1)"
[ -z "$BIN" ] && err "Binary not found in archive."

chmod +x "$BIN"

if [ -w "/usr/local/bin" ]; then
  mv "$BIN" "/usr/local/bin/${BINARY}"
  ok "Installed to /usr/local/bin/${BINARY}"
elif command -v sudo >/dev/null 2>&1 && [ -d "/usr/local/bin" ]; then
  info "Installing to /usr/local/bin (requires sudo)..."
  sudo mv "$BIN" "/usr/local/bin/${BINARY}"
  sudo chmod +x "/usr/local/bin/${BINARY}"
  ok "Installed to /usr/local/bin/${BINARY}"
elif mkdir -p "$HOME/.local/bin" 2>/dev/null; then
  mv "$BIN" "$HOME/.local/bin/${BINARY}"
  ok "Installed to $HOME/.local/bin/${BINARY}"
  info "Make sure $HOME/.local/bin is in your PATH."
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
else
  err "Could not find a suitable install location. Move $(basename "$BIN") to a directory in your PATH."
fi

if command -v "$BINARY" >/dev/null 2>&1; then
  "$BINARY" version 2>/dev/null || true
  ok "Done. Run 'moogo help' to get started."
else
  info "Run '$BINARY' directly or add its directory to PATH."
fi
