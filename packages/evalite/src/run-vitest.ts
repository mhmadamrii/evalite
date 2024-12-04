import path from "path";
import { Writable } from "stream";
import { createVitest } from "vitest/node";
import EvaliteReporter from "./reporter.js";
import { createHash } from "crypto";
import { DEFAULT_SERVER_PORT } from "@evalite/core";
import { createServer } from "@evalite/core/server";

export const runVitest = async (opts: {
  path: string | undefined;
  cwd: string | undefined;
  testOutputWritable?: Writable;
  mode: "watch-for-file-changes" | "run-once-and-exit";
}) => {
  const jsonDbLocation = path.join(opts.cwd ?? "", "./evalite-report.jsonl");
  const server = createServer({
    jsonDbLocation,
  });

  if (opts.mode === "watch-for-file-changes") {
    server.start(DEFAULT_SERVER_PORT);
  }

  const vitest = await createVitest(
    "test",
    {
      root: opts.cwd,
      include: ["**/*.eval.{js,ts}"],
      watch: opts.mode === "watch-for-file-changes",
      reporters: [
        new EvaliteReporter({
          jsonDbLocation,
          logEvent: (event) => {
            server.send(event);
          },
          port: DEFAULT_SERVER_PORT,
          isWatching: opts.mode === "watch-for-file-changes",
        }),
      ],
      testTimeout: 30_000,
    },
    {},
    {
      stdout: opts.testOutputWritable || process.stdout,
      stderr: opts.testOutputWritable || process.stderr,
    }
  );

  await vitest.collect();

  const allFileResults = Array.from(vitest.vitenode.fetchCache);

  const sourceFileResults = allFileResults.filter(([path, item]) => {
    return !(path.endsWith(".eval.ts") || path.endsWith(".eval.js"));
  });

  const codeFromSourceFiles = sourceFileResults.reduce((acc, [path, item]) => {
    return acc + (item.result.code ?? "");
  }, "");

  const hash = createHash("sha256").update(codeFromSourceFiles).digest("hex");

  vitest.provide("evaliteInputHash", hash);

  await vitest.start();

  if (!vitest.shouldKeepServer()) {
    return await vitest.exit();
  }
};
