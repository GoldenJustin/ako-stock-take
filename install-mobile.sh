#!/usr/bin/env bash
# =============================================================================
# AKO Stock Take — mobile (Expo SDK 54) bootstrap
#
# Usage:
#   bash install-mobile.sh
#   bash install-mobile.sh /path/to/put/project
# =============================================================================
set -euo pipefail

TARGET="${1:-${PWD}/ako-stock-take}"
REPO_URL="${REPO_URL:-https://github.com/GoldenJustin/ako-stock-take.git}"
BRANCH="${BRANCH:-main}"

grn() { printf '\033[1;32m%s\033[0m\n' "$*"; }
inf() { printf '\033[1;34m%s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*"; exit 1; }

command -v git >/dev/null || die "git required"
command -v npm >/dev/null || die "npm required (Node 18+)"

if [[ -d "${TARGET}/.git" ]]; then
  inf "==> Updating existing clone ${TARGET}"
  git -C "${TARGET}" fetch origin
  git -C "${TARGET}" checkout "${BRANCH}"
  git -C "${TARGET}" pull --ff-only origin "${BRANCH}"
else
  inf "==> Cloning into ${TARGET}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${TARGET}"
fi

cd "${TARGET}/mobile"
[[ -f package.json ]] || die "mobile/package.json missing"

inf "==> npm install (Expo SDK 54)"
rm -rf node_modules package-lock.json
npm install

grn "==> Done. Start with:"
grn "  cd ${TARGET}/mobile"
grn "  npx expo start"
grn ""
grn "Login: ERPNext user/password → https://erpnext.kodatechnologies.co.tz"
grn "Auth: POST /api/method/login (same as SFA-CRM)"
