#!/usr/bin/env bash
# Deploys web/ to Vercel production (project garden-qloo). Deploys from a git-free copy: Vercel's free plan
# blocks deployments whose latest commit author isn't the Vercel account owner.
# Needs: `npx vercel login`, `npx vercel link --project garden-qloo` run once in web/, and the env vars
# QLOO_API_KEY and ILMU_API_KEY set in the Vercel project (Production).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
rsync -a --exclude node_modules --exclude .next --exclude .next-export --exclude .env.local "$ROOT/web/" "$TMP/"
cd "$TMP" && npx -y vercel@64.7.0 deploy --prod --yes
