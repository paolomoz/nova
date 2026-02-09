#!/bin/bash
TOKEN="nova-test-session-token-2025"
BASE="http://localhost:8787"
H="Authorization: Bearer $TOKEN"
PID="proj-impeccable"

test_endpoint() {
  local label="$1"
  local method="${2:-GET}"
  local url="$3"
  local body="$4"

  echo "=== $label ==="
  if [ "$method" = "POST" ]; then
    result=$(curl -s -w "\n%{http_code}" -H "$H" -X POST -H "Content-Type: application/json" -d "$body" "$url" 2>&1)
  else
    result=$(curl -s -w "\n%{http_code}" -H "$H" "$url" 2>&1)
  fi

  http_code=$(echo "$result" | tail -1)
  response=$(echo "$result" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "  STATUS: $http_code OK"
    echo "  RESPONSE: $(echo "$response" | cut -c1-200)"
  else
    echo "  STATUS: $http_code FAIL"
    echo "  RESPONSE: $(echo "$response" | cut -c1-300)"
  fi
  echo ""
}

echo "========================================="
echo "  Nova API Backend E2E Test"
echo "  Project: paolomoz/impeccable"
echo "========================================="
echo ""

test_endpoint "Health" GET "$BASE/api/health"
test_endpoint "Auth: Get Me" GET "$BASE/api/auth/me"
test_endpoint "Auth: List Orgs" GET "$BASE/api/auth/orgs"
test_endpoint "Org: List Projects" GET "$BASE/api/org/projects"
test_endpoint "Content: List Root" GET "$BASE/api/content/$PID/list?path=/"
test_endpoint "Content: List /docs" GET "$BASE/api/content/$PID/list?path=/docs"
test_endpoint "Content: Get Source /index" GET "$BASE/api/content/$PID/source?path=/index"
test_endpoint "Content: Templates" GET "$BASE/api/content/$PID/templates"
test_endpoint "Content: Block Library" GET "$BASE/api/content/$PID/block-library"
test_endpoint "Content: Suggestions" GET "$BASE/api/content/$PID/suggestions"
test_endpoint "Search" POST "$BASE/api/search/$PID" '{"query":"hello"}'
test_endpoint "AI: Action History" GET "$BASE/api/ai/$PID/history?limit=5"
test_endpoint "AI: Execute" POST "$BASE/api/ai/$PID/execute" '{"prompt":"list all pages"}'
test_endpoint "Brand: List Profiles" GET "$BASE/api/brand/$PID"
test_endpoint "SEO: List Pages" GET "$BASE/api/seo/$PID"
test_endpoint "Fragments: Models" GET "$BASE/api/fragments/$PID/models"
test_endpoint "Fragments: List" GET "$BASE/api/fragments/$PID"
test_endpoint "Enterprise: Workflows" GET "$BASE/api/enterprise/$PID/workflows"
test_endpoint "Enterprise: Launches" GET "$BASE/api/enterprise/$PID/launches"
test_endpoint "Enterprise: Notifications" GET "$BASE/api/enterprise/notifications/inbox"
test_endpoint "Enterprise: Translations" GET "$BASE/api/enterprise/$PID/translations"
test_endpoint "Assets: List" GET "$BASE/api/assets/$PID/list"
test_endpoint "Generative: Configs" GET "$BASE/api/generative/$PID/config"
test_endpoint "Generative: Stats" GET "$BASE/api/generative/$PID/monitoring/stats"
test_endpoint "Generative: Recent" GET "$BASE/api/generative/$PID/monitoring/recent"
test_endpoint "Value: (no compute yet)" GET "$BASE/api/value/$PID/scores"
test_endpoint "Blocks: List" GET "$BASE/api/blocks/$PID"
test_endpoint "Design: Get Tokens" GET "$BASE/api/design/$PID/tokens"

echo "========================================="
echo "  Tests Complete"
echo "========================================="
