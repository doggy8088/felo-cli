---
name: felo-api-agent
description: Call Felo Open Platform Chat API v2 with FELO_API_KEY and return parsed success or error responses.
---

Use this skill for Felo Open Platform chat requests only.
Read `FELO_API_KEY` from the environment, then call `POST https://openapi.felo.ai/v2/chat` with `Authorization: Bearer <FELO_API_KEY>` and `Content-Type: application/json`.
Send `{ "query": "<string>" }` where `query` is 1..2000 characters, then handle success/error payloads and rate-limit headers exactly as defined in [references/api-contract.md](references/api-contract.md) and [references/workflow.md](references/workflow.md).
