#!/usr/bin/env bash
# Deploy every Edge Function to a Supabase project. Needs the Supabase CLI, logged in (`supabase login`).
#   SUPABASE_PROJECT_REF=<ref> supabase/scripts/deploy-functions.sh [function ...]
# With no arguments it deploys all of them. Secrets are not touched: see docs/DEPLOY.md.
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF to the project ref}"
cd "$(dirname "$0")/../.."

# Functions that must be reachable without a Supabase user token. The Stripe webhook is authenticated by its
# signature (verified in the function); the others check the service-role key themselves.
NO_VERIFY_JWT=(stripe-webhook stripe-reconcile daily-maintenance)

if [ "$#" -gt 0 ]; then
  FUNCTIONS=("$@")
else
  FUNCTIONS=()
  for dir in supabase/functions/*/; do FUNCTIONS+=("$(basename "$dir")"); done
fi

for fn in "${FUNCTIONS[@]}"; do
  flags=()
  for open in "${NO_VERIFY_JWT[@]}"; do
    if [ "$fn" = "$open" ]; then flags+=(--no-verify-jwt); fi
  done
  echo "Deploying $fn ${flags[*]:-}"
  supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF" ${flags[@]+"${flags[@]}"}
done
echo "Done. Set the secrets listed in docs/DEPLOY.md if you have not yet."
