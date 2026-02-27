import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { runCli } from "../src/cli";
import { FELO_BASE_URL } from "../src/felo-client";

const captureConsoleLog = (): { logs: string[]; restore: () => void } => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };

  return {
    logs,
    restore: () => {
      console.log = originalLog;
    },
  };
};

const captureConsoleError = (): { errors: string[]; restore: () => void } => {
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map((arg) => String(arg)).join(" "));
  };

  return {
    errors,
    restore: () => {
      console.error = originalError;
    },
  };
};

const captureStdout = (): { chunks: string[]; restore: () => void } => {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write;
  Object.defineProperty(process.stdout, "write", {
    value: ((chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stdout.write,
    writable: true,
    configurable: true,
  });

  return {
    chunks,
    restore: () => {
      Object.defineProperty(process.stdout, "write", {
        value: originalWrite,
        writable: true,
        configurable: true,
      });
    },
  };
};

const replaceGlobalFetch = (fetchImpl: typeof fetch): (() => void) => {
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "fetch", {
    value: fetchImpl,
    writable: true,
    configurable: true,
  });

  return () => {
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      writable: true,
      configurable: true,
    });
  };
};

describe("runCli", () => {
  it("prints commander help and exits on --help", async () => {
    let fetchCalled = false;
    const restoreFetch = replaceGlobalFetch(
      (async () => {
        fetchCalled = true;
        return new Response("");
      }) as typeof fetch,
    );
    const { chunks, restore } = captureStdout();

    try {
      await runCli(["--help"]);
    } finally {
      restore();
      restoreFetch();
    }

    expect(fetchCalled).toBe(false);
    const output = chunks.join("");
    expect(output).toContain("Usage: felo-cli [--api-key <key>] [--debug] [--json] [--raw] <query>");
    expect(output).toContain("--raw            Output raw markdown answer");
    expect(output).toContain("-V, --version    output the version number");
    expect(output).toContain("FELO_API_KEY  Felo API key used when --api-key is not provided.");
  });

  it("prints commander help and exits when no arguments are provided", async () => {
    let fetchCalled = false;
    const restoreFetch = replaceGlobalFetch(
      (async () => {
        fetchCalled = true;
        return new Response("");
      }) as typeof fetch,
    );
    const { chunks, restore } = captureStdout();

    try {
      await runCli([]);
    } finally {
      restore();
      restoreFetch();
    }

    expect(fetchCalled).toBe(false);
    const output = chunks.join("");
    expect(output).toContain("Usage: felo-cli [--api-key <key>] [--debug] [--json] [--raw] <query>");
    expect(output).toContain("FELO_API_KEY  Felo API key used when --api-key is not provided.");
  });

  it("prints version and exits on --version", async () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    let fetchCalled = false;
    const restoreFetch = replaceGlobalFetch(
      (async () => {
        fetchCalled = true;
        return new Response("");
      }) as typeof fetch,
    );
    const { chunks, restore } = captureStdout();

    try {
      await runCli(["--version"]);
    } finally {
      restore();
      restoreFetch();
    }

    expect(fetchCalled).toBe(false);
    expect(chunks.join("").trim()).toBe(packageJson.version);
  });

  it("throws when --api-key is missing its value", async () => {
    const error = await (async () => {
      try {
        await runCli(["--api-key"]);
        throw new Error("Expected runCli to throw");
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("error: option '--api-key <key>' argument missing");
  });

  it("throws when --json and --raw are used together", async () => {
    let fetchCalled = false;
    const restoreFetch = replaceGlobalFetch(
      (async () => {
        fetchCalled = true;
        return new Response("");
      }) as typeof fetch,
    );

    const error = await (async () => {
      try {
        await runCli(["--json", "--raw", "--api-key", "abc123", "hello"]);
        throw new Error("Expected runCli to throw");
      } catch (caught) {
        return caught;
      }
    })();

    restoreFetch();

    expect(fetchCalled).toBe(false);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Options --json and --raw cannot be used together.");
  });

  it("prints usage and throws when query is empty", async () => {
    let fetchCalled = false;
    const restoreFetch = replaceGlobalFetch(
      (async () => {
        fetchCalled = true;
        return new Response("");
      }) as typeof fetch,
    );
    const { logs, restore } = captureConsoleLog();

    const error = await (async () => {
      try {
        await runCli(["--api-key", "abc123"]);
        throw new Error("Expected runCli to throw");
      } catch (caught) {
        return caught;
      }
    })();

    restore();
    restoreFetch();

    expect(fetchCalled).toBe(false);
    expect(logs).toEqual(["Usage: felo-cli [--api-key <key>] [--debug] [--json] [--raw] <query>"]);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Query text is required.");
  });

  it("parses arguments, calls API, and renders markdown by default", async () => {
    let calledUrl = "";
    let calledInit: RequestInit | undefined;
    const restoreFetch = replaceGlobalFetch(
      (async (input, init) => {
        calledUrl = typeof input === "string" ? input : input.toString();
        calledInit = init;
        return new Response(
          JSON.stringify({
              status: "ok",
              message: null,
              data: {
                id: "chat-1",
                message_id: "msg-1",
                answer: "# CLI answer\n\n**hello world**",
                query_analysis: {
                  queries: ["hello world"],
                },
              resources: [
                {
                  title: "Doc 1",
                  link: "https://example.com/doc-1",
                  snippet: "First snippet",
                },
                {
                  title: "Doc 2",
                  link: "https://example.com/doc-2",
                  snippet: "",
                },
              ],
            },
          }),
          { status: 200 },
        );
      }) as typeof fetch,
    );
    const { logs, restore } = captureConsoleLog();

    try {
      await runCli(["--api-key", "cli-key", "hello", "world"]);
    } finally {
      restore();
      restoreFetch();
    }

    expect(calledUrl).toBe(`${FELO_BASE_URL}/v2/chat`);
    const headers = calledInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer cli-key");
    expect(calledInit?.method).toBe("POST");
    expect(JSON.parse(String(calledInit?.body))).toEqual({ query: "hello world" });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("CLI answer");
    expect(logs[0]).toContain("hello world");
    expect(logs[0]).not.toContain("**hello world**");
  });

  it("applies bold fallback when malformed markdown keeps **text** markers", async () => {
    const restoreFetch = replaceGlobalFetch(
      (async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            message: null,
            data: {
              id: "chat-bold-fallback",
              message_id: "msg-bold-fallback",
              answer: "１. 比較\n\n    * **Perplexity.ai**：說明",
              query_analysis: {
                queries: ["bold fallback"],
              },
              resources: [],
            },
          }),
          { status: 200 },
        )) as typeof fetch,
    );
    const { logs, restore } = captureConsoleLog();

    try {
      await runCli(["--api-key", "cli-key", "bold", "fallback"]);
    } finally {
      restore();
      restoreFetch();
    }

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("\u001b[1mPerplexity.ai\u001b[22m");
    expect(logs[0]).not.toContain("**Perplexity.ai**");
  });

  it("outputs raw markdown answer when --raw is enabled", async () => {
    const markdownAnswer = "# Raw title\n\n**raw markdown**";
    const restoreFetch = replaceGlobalFetch(
      (async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            message: null,
            data: {
              id: "chat-raw",
              message_id: "msg-raw",
              answer: markdownAnswer,
              query_analysis: {
                queries: ["hello raw"],
              },
              resources: [],
            },
          }),
          { status: 200 },
        )) as typeof fetch,
    );
    const { logs, restore } = captureConsoleLog();

    try {
      await runCli(["--raw", "--api-key", "cli-key", "hello", "raw"]);
    } finally {
      restore();
      restoreFetch();
    }

    expect(logs).toEqual([markdownAnswer]);
  });

  it("prints debug information to stderr when --debug is enabled", async () => {
    const restoreFetch = replaceGlobalFetch(
      (async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            message: null,
            data: {
              id: "chat-debug",
              message_id: "msg-debug",
              answer: "CLI debug answer",
              query_analysis: {
                queries: ["hello debug"],
              },
              resources: [],
            },
          }),
          { status: 200 },
        )) as typeof fetch,
    );
    const { logs, restore: restoreLog } = captureConsoleLog();
    const { errors, restore: restoreError } = captureConsoleError();

    try {
      await runCli(["--debug", "--api-key", "cli-key", "hello", "debug"]);
    } finally {
      restoreLog();
      restoreError();
      restoreFetch();
    }

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("CLI debug answer");
    expect(errors).toEqual([
      "[debug] Parsed arguments: apiKeyFlag=set, json=false, raw=false, queryLength=11.",
      "[debug] Calling Felo API.",
      "[debug] API response metadata: id=chat-debug, messageId=msg-debug, resources=0.",
    ]);
  });

  it("prints debug API metadata on request failures", async () => {
    const restoreFetch = replaceGlobalFetch(
      (async () =>
        new Response(
          JSON.stringify({
            status: "error",
            code: "invalid_api_key",
            message: "Invalid API key",
            request_id: "req-debug-1",
          }),
          { status: 401 },
        )) as typeof fetch,
    );
    const { errors, restore: restoreError } = captureConsoleError();

    const error = await (async () => {
      try {
        await runCli(["--debug", "--api-key", "bad-key", "hello"]);
        throw new Error("Expected runCli to throw");
      } catch (caught) {
        return caught;
      }
    })();

    restoreError();
    restoreFetch();

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Invalid API key");
    expect(errors).toEqual([
      "[debug] Parsed arguments: apiKeyFlag=set, json=false, raw=false, queryLength=5.",
      "[debug] Calling Felo API.",
      "[debug] API error metadata: statusCode=401, code=invalid_api_key, requestId=req-debug-1.",
    ]);
  });

  it("outputs raw JSON response when --json is enabled", async () => {
    const apiData = {
      id: "chat-json",
      message_id: "msg-json",
      answer: "JSON answer",
      query_analysis: { queries: ["hello json"] },
      resources: [{ title: "R1", link: "https://example.com/r1", snippet: "snippet" }],
    };
    const restoreFetch = replaceGlobalFetch(
      (async () =>
        new Response(
          JSON.stringify({ status: "ok", message: null, data: apiData }),
          { status: 200 },
        )) as typeof fetch,
    );
    const { logs, restore } = captureConsoleLog();

    try {
      await runCli(["--json", "--api-key", "cli-key", "hello", "json"]);
    } finally {
      restore();
      restoreFetch();
    }

    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!)).toEqual(apiData);
  });
});
