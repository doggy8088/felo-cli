# Copilot Instructions for felo-cli

## Build, test, and checks
- Install dependencies: `bun install`
- Build: `bun run build`
- Run all tests: `bun run test`
- Run a single test file: `bun test tests\felo-client.test.ts`
- Run a single test case by name: `bun test tests\felo-client.test.ts -t "parses structured API error payloads"`
- Type-check: `bun run typecheck`
- Lint: no dedicated lint script is defined in `package.json` (use `typecheck` as the code-quality gate in this repo).

## High-level architecture
- `src/felo-client.ts` is the core implementation and API contract boundary.
  - Exposes `createFeloClient`, `feloChat`, `FeloApiError`, and typed response models.
  - Normalizes input with `trim()` and enforces query length `1..2000` before making requests.
  - Calls `POST https://openapi.felo.ai/v2/chat` (or `options.baseUrl`) and validates response payloads at runtime.
  - Parses with `response.text()` + `JSON.parse` so invalid JSON can raise a controlled `FeloApiError`.
- `src/cli.ts` is a thin adapter over the client.
  - Parses `--help`, `--api-key <key>`, and positional query parts.
  - Joins positional args into one query string.
  - Prints `answer` first, then optional `Resources:` block.
  - Formats `FeloApiError` output with optional `Code:` and `Request ID:`.
- `src/index.ts` is the package barrel export (`felo-client` + `cli`) and includes `healthcheck()` used by scaffold tests.
- `tests/` maps to runtime behavior:
  - `felo-client.test.ts`: request/response parsing, validation, and error propagation.
  - `cli.test.ts`: CLI argument parsing and exact output format checks.
  - `skill-files.test.ts`: enforces consistency of `skill/felo-api` docs against the API contract.
- `skill/felo-api/` is a maintained artifact (not loose docs): tests assert required frontmatter, endpoint/auth details, query constraints, and error-code coverage.

## Key repository conventions
- Runtime/tooling:
  - Bun is the expected runtime for scripts, tests, and build (`bun test`, `bun build`).
  - TypeScript is strict ESM (`"type": "module"`, `moduleResolution: "Bundler"`).
- API key precedence:
  - Client: `options.apiKey` overrides `process.env.FELO_API_KEY`.
  - CLI: `--api-key` is passed into client options and therefore overrides env.
- Input and payload strictness:
  - Query validation must happen after trimming; valid range is exactly `1..2000`.
  - Success payload must match full expected shape (`status: "ok"`, `message: null`, full `data` object).
  - Error payload must preserve `code`, `request_id`, and HTTP status in `FeloApiError`.
  - Unexpected success/error shapes should fail explicitly (do not silently coerce).
- Testing patterns:
  - Prefer `fetchImpl` injection in client tests.
  - CLI tests replace `globalThis.fetch` and capture `console.log`; exact output lines are part of the contract.
- Skill-doc constraints (test-enforced):
  - `skill/felo-api/SKILL.md` frontmatter must only contain `name` and `description`.
  - `SKILL.md`, `references/api-contract.md`, and `references/workflow.md` must stay synchronized on endpoint/auth/query/error-code details.

## Known runtime quirks

- **`npm run cli -- --json "..."`** does NOT work: npm intercepts its own `--json` flag before passing args to the script.
  Always use `bun run src/cli.ts --json "..."` (or the compiled `felo-cli` binary) to pass `--json`.
- **Nullable `snippet` in resources**: The Felo API may return `resources[].snippet` as `null` or omit it entirely (i.e. `undefined`), despite the official docs declaring it as `string`. The client normalizes both cases to `""` so downstream code can always treat `snippet` as `string`.
- **Inline error envelope**: The Felo API may return HTTP 200 with `{ "error": { "code": <number>, "summary": "<string>", "detail": "<string>" } }` for internal failures. This is an undocumented format distinct from the standard `{ "status": "error", ... }` error response. The client detects and converts it to a `FeloApiError` using `summary || detail` as the message, falling back to `"Felo API returned an error (code <n>)."` when both are empty.
- **Distinct error messages for bad responses**: The client uses different `FeloApiError` messages depending on the failure mode:
  - `"Felo API returned an empty response."` — HTTP response body was empty.
  - `"Felo API returned invalid JSON."` — body was non-empty but not valid JSON.
  - `"Felo API returned an unexpected success payload."` — HTTP 2xx with valid JSON that does not match any known success envelope.
  - `"Felo API returned an error (code <n>)."` — inline error envelope with empty summary/detail.
  - `"Felo API request failed with status <n>."` — non-2xx status with unrecognized body shape.
