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
  it("prints usage and exits on --help", async () => {
    let fetchCalled = false;
    const restoreFetch = replaceGlobalFetch(
      (async () => {
        fetchCalled = true;
        return new Response("");
      }) as typeof fetch,
    );
    const { logs, restore } = captureConsoleLog();

    try {
      await runCli(["--help"]);
    } finally {
      restore();
      restoreFetch();
    }

    expect(fetchCalled).toBe(false);
    expect(logs).toEqual(["Usage: felo-cli [--api-key <key>] <query>"]);
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
    expect((error as Error).message).toBe("Missing value for --api-key.");
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
    expect(logs).toEqual(["Usage: felo-cli [--api-key <key>] <query>"]);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Query text is required.");
  });

  it("parses arguments, calls API, and prints answer/resources", async () => {
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
              answer: "CLI answer",
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
    expect(logs).toEqual([
      "CLI answer",
      "",
      "Resources:",
      "- Doc 1",
      "  https://example.com/doc-1",
      "  First snippet",
      "- Doc 2",
      "  https://example.com/doc-2",
    ]);
  });
});
