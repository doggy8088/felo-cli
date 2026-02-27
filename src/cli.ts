#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { FeloApiError, createFeloClient, type FeloChatData } from "./felo-client";

marked.use(markedTerminal() as unknown as Parameters<typeof marked.use>[0]);

type CliOptions = {
  apiKey?: string;
  debug?: boolean;
  json?: boolean;
  raw?: boolean;
};

const applyUnparsedBoldFallback = (text: string): string =>
  text.replace(/(^|[^\\])\*\*([^\n*]+?)\*\*/g, (_match, prefix: string, boldText: string) => {
    return `${prefix}\u001b[1m${boldText}\u001b[22m`;
  });

const debugLog = (isDebugEnabled: boolean, message: string): void => {
  if (isDebugEnabled) {
    console.error(`[debug] ${message}`);
  }
};

const getCliVersion = (): string => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  return packageJson.version;
};

const createProgram = (): Command =>
  new Command()
    .name("felo-cli")
    .usage("[--api-key <key>] [--debug] [--json] [--raw] <query>")
    .option("--api-key <key>", "Felo API key (overrides FELO_API_KEY)")
    .option("--debug", "Enable debug logging")
    .option("--json", "Output full JSON response")
    .option("--raw", "Output raw markdown answer")
    .addHelpText(
      "after",
      "\nEnvironment:\n  FELO_API_KEY  Felo API key used when --api-key is not provided.\n",
    )
    .version(getCliVersion())
    .argument("[query...]", "Query text to send");

export const runCli = async (argv: string[] = process.argv.slice(2)): Promise<void> => {
  const program = createProgram().exitOverride();

  if (argv.length === 0) {
    program.outputHelp();
    return;
  }

  try {
    program.parse(argv, { from: "user" });
  } catch (error) {
    if (
      error instanceof CommanderError &&
      (error.code === "commander.helpDisplayed" || error.code === "commander.version")
    ) {
      return;
    }

    throw error;
  }

  const options = program.opts<CliOptions>();
  const apiKey = options.apiKey;
  const debug = options.debug ?? false;
  const json = options.json ?? false;
  const raw = options.raw ?? false;
  const queryParts = (program.processedArgs[0] as string[] | undefined) ?? [];

  if (json && raw) {
    throw new Error("Options --json and --raw cannot be used together.");
  }

  const query = queryParts.join(" ").trim();
  debugLog(
    debug,
    `Parsed arguments: apiKeyFlag=${apiKey ? "set" : "unset"}, json=${json ? "true" : "false"}, raw=${raw ? "true" : "false"}, queryLength=${query.length}.`,
  );
  if (!query) {
    console.log(`Usage: ${program.name()} ${program.usage()}`);
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
  if (raw) {
    console.log(response.answer);
    return;
  }

  const renderedAnswer = await marked.parse(response.answer);
  const output = renderedAnswer.includes("**") ? applyUnparsedBoldFallback(renderedAnswer) : renderedAnswer;
  console.log(output.trimEnd());
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
