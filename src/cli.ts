#!/usr/bin/env node
import { FeloApiError, createFeloClient, type FeloResource } from "./felo-client";

const printUsage = (): void => {
  console.log("Usage: felo-cli [--api-key <key>] <query>");
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

    queryParts.push(arg);
  }

  const query = queryParts.join(" ").trim();
  if (!query) {
    printUsage();
    throw new Error("Query text is required.");
  }

  const client = createFeloClient({ apiKey });
  const response = await client.chat(query);
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
