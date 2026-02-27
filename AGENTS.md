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
