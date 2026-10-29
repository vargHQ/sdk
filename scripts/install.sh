#!/bin/sh
# vargai installer — macOS and Linux.
#
#   curl -fsSL https://varg.ai/install | sh
#
# Puts the standalone vargai CLI (one file, no Node or Bun needed) in
# ~/.varg/bin and adds that to your PATH. Run it again, or `vargai update`,
# to update. Releases: https://github.com/vargHQ/sdk/releases (tags cli-v*).
#
#   VARG_VERSION=0.17.0     install this version instead of the latest
#   VARG_INSTALL_DIR=/path  install here instead of ~/.varg/bin
#   VARG_NO_MODIFY_PATH=1   leave shell profiles alone
#   VARG_RELEASE_BASE=url   download from this mirror (holds the assets + SHA256SUMS)
set -eu

REPO="vargHQ/sdk"
INSTALL_DIR="${VARG_INSTALL_DIR:-$HOME/.varg/bin}"
VERSION="${VARG_VERSION:-}"

if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"; DIM="$(printf '\033[2m')"; GREEN="$(printf '\033[32m')"; RED="$(printf '\033[31m')"; RESET="$(printf '\033[0m')"
else
  BOLD=""; DIM=""; GREEN=""; RED=""; RESET=""
fi
fail() { printf '%s\n' "${RED}error${RESET}: $*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v gzip >/dev/null 2>&1 || fail "gzip is required"

# ── platform ──────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  MINGW* | MSYS* | CYGWIN*) fail "on Windows, run in PowerShell: irm https://varg.ai/install.ps1 | iex" ;;
  *) fail "unsupported OS: $(uname -s)" ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) fail "unsupported CPU: $(uname -m)" ;;
esac
# An x64 shell under Rosetta on Apple silicon still wants the arm64 build.
if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi
# Alpine and other musl systems need the musl build.
if [ "$os" = linux ] && { [ -f /etc/alpine-release ] || ldd --version 2>&1 | grep -qi musl; }; then
  arch="$arch-musl"
fi
asset="vargai-$os-$arch"

# ── version ───────────────────────────────────────────────────────────
if [ -z "$VERSION" ] && [ -z "${VARG_RELEASE_BASE:-}" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases?per_page=30" \
    | grep -o '"tag_name": *"cli-v[^"]*"' | head -n 1 | sed 's/.*cli-v//; s/"$//') \
    || fail "could not reach GitHub to find the latest vargai"
  [ -n "$VERSION" ] || fail "no vargai release found"
fi
VERSION="${VERSION#cli-}"
VERSION="${VERSION#v}"
base="${VARG_RELEASE_BASE:-https://github.com/$REPO/releases/download/cli-v$VERSION}"

printf '%s\n' "${BOLD}vargai ${VERSION:-from $base}${RESET} ${DIM}($os-$arch)${RESET}"

# ── download + verify ─────────────────────────────────────────────────
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

curl -fL --progress-bar "$base/$asset.gz" -o "$tmp/$asset.gz" || fail "download failed: $base/$asset.gz"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" || fail "could not download SHA256SUMS"

expected="$(grep " $asset.gz\$" "$tmp/SHA256SUMS" | cut -d ' ' -f 1)"
[ -n "$expected" ] || fail "$asset.gz is not in SHA256SUMS"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$asset.gz" | cut -d ' ' -f 1)"
else
  actual="$(shasum -a 256 "$tmp/$asset.gz" | cut -d ' ' -f 1)"
fi
[ "$expected" = "$actual" ] || fail "checksum mismatch for $asset.gz"

gzip -d "$tmp/$asset.gz"
chmod +x "$tmp/$asset"
mkdir -p "$INSTALL_DIR"
mv -f "$tmp/$asset" "$INSTALL_DIR/vargai"

# It has to start here, not just be on disk.
if ! "$INSTALL_DIR/vargai" help >/dev/null 2>&1; then
  case "$arch" in
    *musl) fail "vargai is installed but does not start. On Alpine: apk add libstdc++ libgcc" ;;
    *) fail "vargai is installed at $INSTALL_DIR/vargai but does not start on this system" ;;
  esac
fi

printf '%s\n' "${GREEN}✓${RESET} installed $INSTALL_DIR/vargai"

# ── PATH ──────────────────────────────────────────────────────────────
case ":$PATH:" in
  *":$INSTALL_DIR:"*) on_path=1 ;;
  *) on_path=0 ;;
esac

if [ "$on_path" = 0 ] && [ -z "${VARG_NO_MODIFY_PATH:-}" ]; then
  line="export PATH=\"$INSTALL_DIR:\$PATH\""
  case "$(basename "${SHELL:-sh}")" in
    zsh) profile="${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) if [ "$os" = darwin ]; then profile="$HOME/.bash_profile"; else profile="$HOME/.bashrc"; fi ;;
    fish) profile="$HOME/.config/fish/config.fish"; line="fish_add_path \"$INSTALL_DIR\"" ;;
    *) profile="$HOME/.profile" ;;
  esac
  if ! grep -qsF "$INSTALL_DIR" "$profile"; then
    mkdir -p "$(dirname "$profile")"
    printf '\n# vargai\n%s\n' "$line" >> "$profile"
    printf '%s\n' "${GREEN}✓${RESET} added $INSTALL_DIR to PATH in ${profile#"$HOME"/}"
  fi
  printf '\n%s\n' "Open a new terminal, or run:  ${BOLD}$line${RESET}"
fi

printf '\n%s\n' "Try it:"
printf '%s\n' "  vargai search \"captions for reels\"   ${DIM}find skills, no key needed${RESET}"
printf '%s\n' "  vargai login                        ${DIM}then every varg model and tool${RESET}"
