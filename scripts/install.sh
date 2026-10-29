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
#   VARG_NO_MODIFY_PATH=1   no link on PATH, no shell profile edits
#
# Uninstall: rm -rf ~/.varg/bin, and the vargai link it names (e.g. ~/bin/vargai).
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
  # The releases/latest page redirects to the newest release's tag. It is a
  # page, not the API, so it has no 60-an-hour anonymous limit (offices and CI
  # share an IP). This repo's latest release is the CLI's (release-cli.sh);
  # if it ever is not, ask the API for the newest cli-v* tag.
  latest_url="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" 2>/dev/null || true)"
  case "$latest_url" in
    */tag/cli-v*) VERSION="${latest_url##*/tag/cli-v}" ;;
    *)
      VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases?per_page=30" 2>/dev/null \
        | grep -o '"tag_name": *"cli-v[^"]*"' | head -n 1 | sed 's/.*cli-v//; s/"$//') || true
      ;;
  esac
  [ -n "$VERSION" ] || fail "could not find the latest vargai release (https://github.com/$REPO/releases). Set VARG_VERSION=<version> to pick one."
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
# `curl | sh` runs in a child process: it cannot change the PATH of the
# terminal it was started from, so a profile line alone leaves `vargai` "not
# found" until a new terminal. Link it into a directory that terminal already
# searches instead, and it works on the very next line.
on_path() { case ":$PATH:" in *":$1:"*) return 0 ;; *) return 1 ;; esac; }

ready=0
if on_path "$INSTALL_DIR"; then
  ready=1
elif [ -z "${VARG_NO_MODIFY_PATH:-}" ]; then
  for dir in "$HOME/.local/bin" "$HOME/bin" /usr/local/bin /opt/homebrew/bin; do
    on_path "$dir" && [ -d "$dir" ] && [ -w "$dir" ] || continue
    # Never replace another program's vargai: only a free name or our own link.
    if [ -e "$dir/vargai" ] || [ -L "$dir/vargai" ]; then
      [ "$(readlink "$dir/vargai" 2>/dev/null)" = "$INSTALL_DIR/vargai" ] || continue
    fi
    ln -sf "$INSTALL_DIR/vargai" "$dir/vargai"
    printf '%s\n' "${GREEN}✓${RESET} linked $dir/vargai"
    ready=1
    break
  done

  # No such directory: add ~/.varg/bin to the shell profile for new terminals.
  if [ "$ready" = 0 ]; then
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
      printf '%s\n' "${GREEN}✓${RESET} added $INSTALL_DIR to PATH in ${profile#"$HOME"/} (new terminals)"
    fi
  fi
fi

# Another vargai earlier on PATH would answer instead of this one.
found="$(command -v vargai 2>/dev/null || true)"
if [ "$ready" = 1 ] && [ -n "$found" ] && [ "$found" != "$INSTALL_DIR/vargai" ] && [ "$(readlink "$found" 2>/dev/null)" != "$INSTALL_DIR/vargai" ]; then
  printf '%s\n' "${BOLD}note${RESET}: $found comes first on your PATH; remove it to use this vargai."
fi

if [ "$ready" = 1 ]; then
  printf '\n%s\n' "${BOLD}vargai is ready.${RESET} Try it:"
  printf '%s\n' "  vargai search \"captions for reels\"   ${DIM}find skills, no key needed${RESET}"
  printf '%s\n' "  vargai login                        ${DIM}then every varg model and tool${RESET}"
else
  printf '\n%s\n' "${BOLD}One more step:${RESET} this terminal does not see $INSTALL_DIR yet. Run:"
  printf '\n%s\n' "  ${BOLD}export PATH=\"$INSTALL_DIR:\$PATH\"${RESET}"
  printf '\n%s\n' "Then try it:"
  printf '%s\n' "  vargai search \"captions for reels\"   ${DIM}find skills, no key needed${RESET}"
  printf '%s\n' "  vargai login                        ${DIM}then every varg model and tool${RESET}"
fi
