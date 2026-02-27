export const FELO_BASE_URL = "https://openapi.felo.ai";

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 2000;

export interface FeloChatRequest {
  query: string;
}

export interface FeloResource {
  link: string;
  title: string;
  snippet: string;
}

export interface FeloQueryAnalysis {
  queries: string[];
}

export interface FeloChatData {
  id: string;
  message_id: string;
  answer: string;
  query_analysis: FeloQueryAnalysis;
  resources: FeloResource[];
}

export interface FeloChatSuccessResponse {
  status: "ok";
  message: null;
  data: FeloChatData;
}

export interface FeloChatErrorResponse {
  status: "error";
  code: string | number;
  message: string;
  request_id: string;
}

export interface FeloClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface FeloClient {
  chat(query: string): Promise<FeloChatData>;
}

interface FeloApiErrorOptions {
  code?: string | number;
  requestId?: string;
  statusCode?: number;
  cause?: unknown;
}

export class FeloApiError extends Error {
  readonly code?: string | number;
  readonly requestId?: string;
  readonly statusCode?: number;

  constructor(message: string, options: FeloApiErrorOptions = {}) {
    super(message);
    this.name = "FeloApiError";
    this.code = options.code;
    this.requestId = options.requestId;
    this.statusCode = options.statusCode;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const validateQuery = (query: string): void => {
  if (typeof query !== "string") {
    throw new TypeError("Query must be a string.");
  }
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    throw new RangeError("Query length must be between 1 and 2000 characters.");
  }
};

const parseSuccessResponse = (value: unknown): FeloChatSuccessResponse | null => {
  if (!isRecord(value) || value.status !== "ok" || value.message !== null) {
    return null;
  }

  const data = value.data;
  if (!isRecord(data)) {
    return null;
  }

  const id = data.id;
  const messageId = data.message_id;
  const answer = data.answer;
  const queryAnalysis = data.query_analysis;
  const resourcesValue = data.resources;

  if (
    typeof id !== "string" ||
    typeof messageId !== "string" ||
    typeof answer !== "string" ||
    !isRecord(queryAnalysis) ||
    !Array.isArray(resourcesValue)
  ) {
    return null;
  }

  const queries = queryAnalysis.queries;
  if (!Array.isArray(queries) || !queries.every((query) => typeof query === "string")) {
    return null;
  }

  const resources: FeloResource[] = [];
  for (const resource of resourcesValue) {
    if (!isRecord(resource)) {
      return null;
    }

    const link = resource.link;
    const title = resource.title;
    const snippet = resource.snippet;

    if (typeof link !== "string" || typeof title !== "string" || typeof snippet !== "string") {
      return null;
    }

    resources.push({ link, title, snippet });
  }

  return {
    status: "ok",
    message: null,
    data: {
      id,
      message_id: messageId,
      answer,
      query_analysis: { queries },
      resources,
    },
  };
};

const parseErrorResponse = (value: unknown): FeloChatErrorResponse | null => {
  if (!isRecord(value) || value.status !== "error") {
    return null;
  }

  const code = value.code;
  const message = value.message;
  const requestId = value.request_id;

  if ((typeof code !== "string" && typeof code !== "number") || typeof message !== "string" || typeof requestId !== "string") {
    return null;
  }

  return {
    status: "error",
    code,
    message,
    request_id: requestId,
  };
};

const parseJson = (rawBody: string, statusCode: number): unknown => {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch (error) {
    throw new FeloApiError("Felo API returned invalid JSON.", {
      statusCode,
      cause: error,
    });
  }
};

export const createFeloClient = (options: FeloClientOptions = {}): FeloClient => {
  const baseUrl = (options.baseUrl ?? FELO_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async chat(query: string): Promise<FeloChatData> {
      const normalizedQuery = query.trim();
      validateQuery(normalizedQuery);

      const apiKey = options.apiKey ?? process.env.FELO_API_KEY;
      if (!apiKey) {
        throw new FeloApiError("Missing FELO_API_KEY. Set FELO_API_KEY or pass apiKey in options.");
      }

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v2/chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: normalizedQuery } satisfies FeloChatRequest),
        });
      } catch (error) {
        throw new FeloApiError("Failed to call Felo API.", { cause: error });
      }

      const rawBody = await response.text();
      const parsedBody = parseJson(rawBody, response.status);

      if (response.ok) {
        const success = parseSuccessResponse(parsedBody);
        if (!success) {
          throw new FeloApiError("Felo API returned an unexpected success payload.", {
            statusCode: response.status,
          });
        }
        return success.data;
      }

      const apiError = parseErrorResponse(parsedBody);
      if (apiError) {
        throw new FeloApiError(apiError.message, {
          code: apiError.code,
          requestId: apiError.request_id,
          statusCode: response.status,
        });
      }

      throw new FeloApiError(`Felo API request failed with status ${response.status}.`, {
        statusCode: response.status,
      });
    },
  };
};

export const feloChat = async (query: string, options: FeloClientOptions = {}): Promise<FeloChatData> =>
  createFeloClient(options).chat(query);
