# Felo Chat API Workflow Reference

This workflow is aligned with the official docs at https://openapi.felo.ai/docs/api-reference/v2/chat.html.

## 0) Prefer repository tools first

In this codebase, default to repository interfaces before raw HTTP:

1. CLI: `npx -y @willh/felo-cli "<query>"` (answer only) or `npx -y @willh/felo-cli --json "<query>"` (full payload).
2. SDK: `createFeloClient().chat(query)` or `feloChat(query)` from `src/felo-client.ts`.
3. Raw API call only for protocol verification, troubleshooting, or SDK/CLI parity checks.

## 1) Preflight

1. Read `FELO_API_KEY` from environment.
2. Stop immediately if missing.
3. Validate `query` as a string with length 1..2000.

## 2) Send request

1. Use base URL `https://openapi.felo.ai`.
2. Call `POST /v2/chat`.
3. Set headers:
   - `Authorization: Bearer <FELO_API_KEY>`
   - `Content-Type: application/json`
4. Send JSON body:

```json
{
  "query": "What are the latest developments in quantum computing?"
}
```

## 3) Parse success response (`200`)

Expect this schema:

```json
{
  "status": "ok",
  "message": null,
  "data": {
    "id": "HabCj883yHLSXc8mWqu4Eq",
    "message_id": "18ea8517-5559-4f48-a355-1f8a79e73b71",
    "answer": "Recent developments in quantum computing include...",
    "query_analysis": {
      "queries": [
        "quantum computing latest developments 2025",
        "quantum computing breakthroughs"
      ]
    },
    "resources": [
      {
        "link": "https://example.com/quantum-news",
        "title": "Latest Quantum Computing Breakthroughs",
        "snippet": "Scientists have achieved a major milestone..."
      }
    ]
  }
}
```

Return `data.answer`, preserve `data.id` and `data.message_id`, and include `data.resources`.

## 4) Parse error response

Expect this schema:

```json
{
  "status": "error",
  "code": "INVALID_API_KEY",
  "message": "The provided API Key is invalid or has been revoked",
  "request_id": "req_abc123xyz789"
}
```

Preserve `status`, `code`, `message`, HTTP status, and `request_id` exactly.

## 5) Respect rate limits

Read these response headers on every request:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

If the API returns `429` (`RATE_LIMIT_EXCEEDED`), back off and retry after reset.

## 6) Handle common error codes

Handle these documented codes: `INVALID_API_KEY`, `MISSING_AUTHORIZATION`, `MALFORMED_AUTHORIZATION`, `MISSING_PARAMETER`, `INVALID_PARAMETER`, `QUERY_TOO_LONG`, `RATE_LIMIT_EXCEEDED`, `CHAT_FAILED`, `SERVICE_UNAVAILABLE`.

For field-level details, see [api-contract.md](api-contract.md).
