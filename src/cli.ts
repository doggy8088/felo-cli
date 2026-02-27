#!/usr/bin/env node
import { FeloApiError, createFeloClient, type FeloChatData, type FeloResource } from "./felo-client";

const printUsage = (): void => {
  console.log("Usage: felo-cli [--api-key <key>] [--debug] [--json] <query>");
};

const debugLog = (isDebugEnabled: boolean, message: string): void => {
  if (isDebugEnabled) {
    console.error(`[debug] ${message}`);
  }
};

const printResources = (resources: FeloResource[]): void => {
  if (resources.length === 0) {
    return;
  }

  console.log("");
  console.log("Resources:");
  for (const resource of resources) {
    console.log(`- ${resource.title}`);
    console.log(`  ${resource.link}`);
    if (resource.snippet) {
      console.log(`  ${resource.snippet}`);
    }
  }
};

export const runCli = async (argv: string[] = process.argv.slice(2)): Promise<void> => {
  let apiKey: string | undefined;
  let debug = false;
  let json = false;
  const queryParts: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      return;
    }

    if (arg === "--api-key") {
      const key = argv[index + 1];
      if (!key) {
        throw new Error("Missing value for --api-key.");
      }
      apiKey = key;
      index += 1;
      continue;
    }

    if (arg === "--debug") {
      debug = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    queryParts.push(arg);
  }

  const query = queryParts.join(" ").trim();
  debugLog(debug, `Parsed arguments: apiKeyFlag=${apiKey ? "set" : "unset"}, queryLength=${query.length}.`);
  if (!query) {
    printUsage();
    throw new Error("Query text is required.");
  }

  const client = createFeloClient({ apiKey });
  debugLog(debug, "Calling Felo API.");
  let response: FeloChatData;
  try {
    response = await client.chat(query);
  } catch (error) {
    if (error instanceof FeloApiError) {
      debugLog(
        debug,
        `API error metadata: statusCode=${String(error.statusCode ?? "unknown")}, code=${String(error.code ?? "unknown")}, requestId=${error.requestId ?? "unknown"}.`,
      );
    } else if (error instanceof Error) {
      debugLog(debug, `Request failed: ${error.message}`);
    } else {
      debugLog(debug, "Request failed with unknown error.");
    }
    throw error;
  }

  debugLog(
    debug,
    `API response metadata: id=${response.id}, messageId=${response.message_id}, resources=${response.resources.length}.`,
  );
  if (json) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }
  console.log(response.answer);
  printResources(response.resources);
};

const printCliError = (error: unknown): void => {
  if (error instanceof FeloApiError) {
    console.error(`Error: ${error.message}`);
    if (error.code !== undefined) {
      console.error(`Code: ${String(error.code)}`);
    }
    if (error.requestId) {
      console.error(`Request ID: ${error.requestId}`);
    }
    return;
  }

  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    return;
  }

  console.error("Error: Unknown failure.");
};

if (import.meta.main) {
  runCli().catch((error) => {
    printCliError(error);
    process.exitCode = 1;
  });
}
