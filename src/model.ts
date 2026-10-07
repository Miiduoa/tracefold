export type Kind =
  "document" | "script" | "style" | "image" | "font" | "data" | "other";
export type RequestRow = {
  id: number;
  host: string;
  path: string;
  method: string;
  status: number;
  kind: Kind;
  start: number;
  duration: number;
  bytes: number | null;
  wait: number | null;
  timings: Record<string, number | null>;
};
export type Capture = { rows: RequestRow[]; warnings: string[] };
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Expected an object in the HAR file.");
  return v as Record<string, unknown>;
};
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const timing = (v: unknown) => (finite(v) && v >= 0 ? v : null);
function kind(mime: string): Kind {
  if (/html/i.test(mime)) return "document";
  if (/javascript|ecmascript/i.test(mime)) return "script";
  if (/css/i.test(mime)) return "style";
  if (/^image\//i.test(mime)) return "image";
  if (/font|woff/i.test(mime)) return "font";
  if (/json|xml/i.test(mime)) return "data";
  return "other";
}
/** Deliberately retain no headers, cookies, body, URL credentials, query or fragment. */
export function parseHar(input: unknown): Capture {
  const entries = object(object(input).log).entries;
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error(
      "This HAR has no requests. Export a capture with network activity.",
    );
  if (entries.length > 20_000)
    throw new Error(
      "This capture exceeds the 20,000 request limit. Export a shorter capture.",
    );
  const warnings: string[] = [];
  const rows = entries.map((entry, id): RequestRow => {
    try {
      const e = object(entry),
        req = object(e.request),
        res = object(e.response);
      const content = object(res.content),
        t = object(e.timings);
      if (
        typeof req.url !== "string" ||
        typeof req.method !== "string" ||
        typeof e.startedDateTime !== "string"
      )
        throw new Error("Missing URL, method or start time.");
      const url = new URL(req.url);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Only HTTP and HTTPS requests are supported.");
      const start = Date.parse(e.startedDateTime);
      if (!Number.isFinite(start) || !finite(e.time) || e.time < 0)
        throw new Error("Invalid start time or duration.");
      if (
        !Number.isInteger(res.status) ||
        (res.status as number) < 0 ||
        (res.status as number) > 599
      )
        throw new Error("Invalid response status.");
      const timings = Object.fromEntries(
        ["blocked", "dns", "connect", "ssl", "send", "wait", "receive"].map(
          (k) => [k, timing(t[k])],
        ),
      );
      const sum = [
        "blocked",
        "dns",
        "connect",
        "send",
        "wait",
        "receive",
      ].reduce((s, k) => s + (timings[k] ?? 0), 0);
      if (Math.abs(sum - e.time) > Math.max(2, e.time * 0.05))
        warnings.push(
          `Request ${id + 1}: timing phases differ from elapsed time; waterfall uses HAR time.`,
        );
      // Chrome's extension includes headers. HAR bodySize is the encoded body, not content.size.
      const bytes = timing(res._transferSize) ?? timing(res.bodySize);
      return {
        id,
        host: url.host,
        path: url.pathname,
        method: req.method,
        status: res.status as number,
        kind: kind(String(content.mimeType ?? "")),
        start,
        duration: e.time,
        bytes,
        wait: timings.wait,
        timings,
      };
    } catch (error) {
      throw new Error(
        `Request ${id + 1}: ${error instanceof Error ? error.message : "Invalid entry"}`,
      );
    }
  });
  const origin = Math.min(...rows.map((r) => r.start));
  rows.forEach((r) => (r.start -= origin));
  return { rows, warnings };
}
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}
export function summarize(rows: RequestRow[]) {
  const events = rows
    .filter((r) => r.duration > 0)
    .flatMap((r) => [
      [r.start, 1],
      [r.start + r.duration, -1],
    ]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0,
    peak = 0;
  events.forEach(([, delta]) => {
    active += delta;
    peak = Math.max(peak, active);
  });
  return {
    count: rows.length,
    bytes: rows.reduce((s, r) => s + (r.bytes ?? 0), 0),
    unknownSizes: rows.filter((r) => r.bytes === null).length,
    span: rows.length
      ? Math.max(...rows.map((r) => r.start + r.duration)) -
        Math.min(...rows.map((r) => r.start))
      : 0,
    errors: rows.filter((r) => r.status === 0 || r.status >= 400).length,
    p95: percentile(
      rows.map((r) => r.duration),
      0.95,
    ),
    peak,
  };
}
export function exportSummary(capture: Capture) {
  return JSON.stringify(
    {
      format: "tracefold-summary-v1",
      summary: summarize(capture.rows),
      warnings: capture.warnings,
      requests: capture.rows.map(({ timings, ...row }) => row),
    },
    null,
    2,
  );
}
