import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseHar } from "../src/model.ts";

/** Measurement-only fixture, not a full browser-replay HAR. Paths may be sensitive. */
export function reduceCapture(input) {
  parseHar(input);
  const measured = (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  return {
    log: {
      version: "1.2",
      creator: { name: "Tracefold measurement fixture", version: "1" },
      entries: input.log.entries.map((e) => {
        const url = new URL(e.request.url);
        const response = {
          status: e.response.status,
          bodySize: measured(e.response.bodySize) ? e.response.bodySize : -1,
          content: { mimeType: String(e.response.content.mimeType ?? "") },
        };
        if (measured(e.response._transferSize))
          response._transferSize = e.response._transferSize;
        return {
          startedDateTime: e.startedDateTime,
          time: e.time,
          request: { method: e.request.method, url: url.origin + url.pathname },
          response,
          timings: Object.fromEntries(
            ["blocked", "dns", "connect", "ssl", "send", "wait", "receive"]
              .filter((key) => typeof e.timings[key] === "number")
              .map((key) => [key, e.timings[key]]),
          ),
        };
      }),
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [, , source, destination] = process.argv;
  if (!source || !destination)
    throw new Error(
      "Usage: node scripts/reduce-capture.mjs input.har output.json",
    );
  const reduced = reduceCapture(JSON.parse(readFileSync(source, "utf8")));
  writeFileSync(destination, JSON.stringify(reduced, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    `Wrote ${reduced.log.entries.length} measurement records. Review retained hosts and paths before publishing.`,
  );
}
