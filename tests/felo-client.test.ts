import { describe, expect, it } from "bun:test";
import { FeloApiError, createFeloClient } from "../src/felo-client";

const validSuccessPayload = {
  status: "ok" as const,
  message: null,
  data: {
    id: "chat-1",
    message_id: "msg-1",
    answer: "Hello from Felo.",
    query_analysis: {
      queries: ["hello"],
    },
    resources: [
      {
        link: "https://example.com/1",
        title: "Example 1",
        snippet: "Reference 1",
      },
    ],
  },
};

const getRejectedError = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    return error;
  }
};

describe("createFeloClient", () => {
  it("returns chat data on valid success payload", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: typeof input === "string" ? input : input.toString(),
        init,
      });
      return new Response(JSON.stringify(validSuccessPayload), { status: 200 });
    };

    const client = createFeloClient({
      apiKey: "test-key",
      baseUrl: "https://mock.felo.ai/",
      fetchImpl,
    });

    const result = await client.chat("  hello  ");
    expect(result).toEqual(validSuccessPayload.data);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://mock.felo.ai/v2/chat");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ query: "hello" }));
    expect(calls[0]?.init?.headers).toEqual({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
  });

  it("throws on empty query", async () => {
    const client = createFeloClient({
      apiKey: "test-key",
      fetchImpl: async () => {
        throw new Error("fetch must not be called for empty queries");
      },
    });

    const error = await getRejectedError(client.chat("   "));
    expect(error).toBeInstanceOf(RangeError);
    expect((error as Error).message).toBe("Query length must be between 1 and 2000 characters.");
  });

  it("throws on query longer than 2000 characters", async () => {
    const client = createFeloClient({
      apiKey: "test-key",
      fetchImpl: async () => {
        throw new Error("fetch must not be called for oversized queries");
      },
    });

    const error = await getRejectedError(client.chat("a".repeat(2001)));
    expect(error).toBeInstanceOf(RangeError);
    expect((error as Error).message).toBe("Query length must be between 1 and 2000 characters.");
  });

  it("throws when FELO_API_KEY is missing", async () => {
    const previousApiKey = process.env.FELO_API_KEY;
    delete process.env.FELO_API_KEY;
    let fetchCalled = false;

    try {
      const client = createFeloClient({
        fetchImpl: async () => {
          fetchCalled = true;
          return new Response(JSON.stringify(validSuccessPayload), { status: 200 });
        },
      });

      const error = await getRejectedError(client.chat("hello"));
      expect(fetchCalled).toBe(false);
      expect(error).toBeInstanceOf(FeloApiError);
      expect((error as Error).message).toBe("Missing FELO_API_KEY. Set FELO_API_KEY or pass apiKey in options.");
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.FELO_API_KEY;
      } else {
        process.env.FELO_API_KEY = previousApiKey;
      }
    }
  });

  it("parses structured API error payloads", async () => {
    const client = createFeloClient({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            status: "error",
            code: "INVALID_QUERY",
            message: "Query is invalid.",
            request_id: "req-123",
          }),
          { status: 400 },
        ),
    });

    const error = await getRejectedError(client.chat("bad query"));
    expect(error).toBeInstanceOf(FeloApiError);
    expect((error as Error).message).toBe("Query is invalid.");
    expect((error as FeloApiError).code).toBe("INVALID_QUERY");
    expect((error as FeloApiError).requestId).toBe("req-123");
    expect((error as FeloApiError).statusCode).toBe(400);
  });

  it("throws a clear error when payload is invalid JSON", async () => {
    const client = createFeloClient({
      apiKey: "test-key",
      fetchImpl: async () => new Response("not-json", { status: 502 }),
    });

    const error = await getRejectedError(client.chat("hello"));
    expect(error).toBeInstanceOf(FeloApiError);
    expect((error as Error).message).toBe("Felo API returned invalid JSON.");
    expect((error as FeloApiError).statusCode).toBe(502);
  });

  it("throws when success payload shape is unexpected", async () => {
    const client = createFeloClient({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            message: null,
            data: {
              id: "chat-1",
            },
          }),
          { status: 200 },
        ),
    });

    const error = await getRejectedError(client.chat("hello"));
    expect(error).toBeInstanceOf(FeloApiError);
    expect((error as Error).message).toBe("Felo API returned an unexpected success payload.");
    expect((error as FeloApiError).statusCode).toBe(200);
  });
});
