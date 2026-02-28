# Felo Chat API Contract Reference

This contract is aligned with the official docs at https://openapi.felo.ai/docs/api-reference/v2/chat.html.

## Repository-first usage

For this repository, prefer the local tooling before direct HTTP calls:

1. CLI: `npx -y @willh/felo-cli "<query>"` or `npx -y @willh/felo-cli --json "<query>"`.
2. SDK: `createFeloClient()` / `feloChat()` from `src/felo-client.ts`.
3. Use direct API contract details below when implementing/verifying low-level HTTP behavior.

## Base URL

`https://openapi.felo.ai`

## Endpoint

`POST /v2/chat`

## Authentication

- Env var: `FELO_API_KEY`
- Required header: `Authorization: Bearer <FELO_API_KEY>`
- Required header: `Content-Type: application/json`

## Request body schema

```json
{
  "query": "What are the latest developments in quantum computing?"
}
```

Constraints:

- `query` is required.
- `query` must be a string with length 1..2000 characters.

## Success response schema (`200`)

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

Field meanings:

- `status`: `"ok"` on success.
- `message`: `null` on success.
- `data.id`: chat session ID.
- `data.message_id`: message ID.
- `data.answer`: generated answer text.
- `data.query_analysis.queries[]`: optimized queries.
- `data.resources[]`: cited sources with `link`, `title`, `snippet`.

## Error response schema

```json
{
  "status": "error",
  "code": "INVALID_API_KEY",
  "message": "The provided API Key is invalid or has been revoked",
  "request_id": "req_abc123xyz789"
}
```

Field meanings:

- `status`: always `"error"`.
- `code`: machine-readable error code.
- `message`: human-readable error details.
- `request_id`: request identifier for support/debugging.

## Rate-limit headers

Read these headers from responses:

- `X-RateLimit-Limit`: max requests per minute.
- `X-RateLimit-Remaining`: remaining requests in current window.
- `X-RateLimit-Reset`: Unix timestamp when the limit resets.

Documented default limit: `100 requests per minute per API Key`.

## Common error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `INVALID_API_KEY` | 401 | API key is invalid, malformed, or revoked. |
| `MISSING_AUTHORIZATION` | 401 | Authorization header is missing. |
| `MALFORMED_AUTHORIZATION` | 401 | Authorization header is not `Bearer <API_KEY>`. |
| `MISSING_PARAMETER` | 400 | Required parameter is missing. |
| `INVALID_PARAMETER` | 400 | Parameter value is invalid (for example empty query). |
| `QUERY_TOO_LONG` | 400 | `query` exceeds 2000 characters. |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in a short time. |
| `CHAT_FAILED` | 502 | Internal chat processing failure. |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable. |

For usage flow, see [workflow.md](workflow.md).
