import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseHar,
  summarize,
  exportSummary,
  percentile,
} from "../src/model.ts";
import { demoHar } from "../src/demo.ts";
const fixture = () => JSON.parse(JSON.stringify(demoHar()));
test("synthetic capture yields known counts, duration and errors", () => {
  const c = parseHar(fixture());
  const s = summarize(c.rows);
  assert.equal(s.count, 24);
  assert.equal(s.errors, 1);
  assert.equal(s.span, 2786);
  assert.equal(s.p95, 1240);
  assert.equal(c.warnings.length, 0);
});
test("TLS is already included in connect", () => {
  const h = fixture();
  h.log.entries = [h.log.entries[0]];
  const e = h.log.entries[0];
  e.time = 100;
  e.timings = {
    blocked: 0,
    dns: 10,
    connect: 30,
    ssl: 20,
    send: 5,
    wait: 40,
    receive: 15,
  };
  assert.equal(parseHar(h).warnings.length, 0);
});
test("missing transfer data remains unknown; decoded content size is not substituted", () => {
  const h = fixture();
  h.log.entries[0].response.bodySize = -1;
  assert.equal(parseHar(h).rows[0].bytes, null);
  assert.equal(summarize(parseHar(h).rows).unknownSizes, 1);
});
test("zero transfer size survives fallback", () => {
  const h = fixture();
  h.log.entries[0].response._transferSize = 0;
  assert.equal(parseHar(h).rows[0].bytes, 0);
});
test("unknown timing phases are not mistaken for zero", () => {
  const h = fixture();
  h.log.entries[0].timings.wait = -1;
  assert.equal(parseHar(h).rows[0].wait, null);
});
test("negative elapsed duration rejects the whole capture", () => {
  const h = fixture();
  h.log.entries[5].time = -1;
  assert.throws(() => parseHar(h), /Request 6/);
});
test("malformed entry rejects with entry number", () => {
  const h = fixture();
  h.log.entries[2].request.url = "nope";
  assert.throws(() => parseHar(h), /Request 3/);
});
test("empty or missing entries are actionable", () => {
  assert.throws(() => parseHar({ log: { entries: [] } }), /no requests/);
  assert.throws(() => parseHar(null), /object/);
});
test("normalization removes credential, query, fragment, headers and body", () => {
  const h = fixture();
  h.log.entries[0].request.url =
    "https://user:password@example.test/path?token=secret#private";
  h.log.entries[0].request.headers = [
    { name: "Authorization", value: "bearer hidden" },
  ];
  const c = parseHar(h);
  const text = exportSummary(c);
  for (const secret of [
    "password",
    "secret",
    "private",
    "Authorization",
    "hidden",
  ])
    assert.ok(!text.includes(secret));
  assert.equal(c.rows[0].path, "/path");
  assert.equal(c.rows[0].host, "example.test");
});
test("out-of-order capture normalizes against earliest start", () => {
  const h = fixture();
  h.log.entries.reverse();
  assert.equal(Math.min(...parseHar(h).rows.map((r) => r.start)), 0);
});
test("touching intervals do not inflate concurrency and zero intervals do not decrement it", () => {
  const row = parseHar(fixture()).rows[0];
  const rows = [
    { ...row, start: 0, duration: 10 },
    { ...row, id: 1, start: 10, duration: 10 },
    { ...row, id: 2, start: 10, duration: 0 },
  ];
  assert.equal(summarize(rows).peak, 1);
});
test("parallel intervals produce real peak concurrency", () => {
  const row = parseHar(fixture()).rows[0];
  assert.equal(
    summarize([
      { ...row, start: 0, duration: 10 },
      { ...row, start: 5, duration: 10 },
    ]).peak,
    2,
  );
});
test("nearest-rank percentile includes tail for small samples without mutating", () => {
  const a = [100, 1, 2];
  assert.equal(percentile(a, 0.95), 100);
  assert.deepEqual(a, [100, 1, 2]);
  assert.equal(percentile([], 0.95), null);
});
test("status zero is a failure", () => {
  const h = fixture();
  h.log.entries[0].response.status = 0;
  assert.equal(summarize(parseHar(h).rows).errors, 2);
});
test("timing mismatch warns instead of silently changing elapsed time", () => {
  const h = fixture();
  h.log.entries[0].time = 500;
  const c = parseHar(h);
  assert.equal(c.rows[0].duration, 500);
  assert.equal(c.warnings.length, 1);
});
test("capture limit prevents accidental enormous rendering", () => {
  const h = fixture();
  h.log.entries = Array(20001).fill(h.log.entries[0]);
  assert.throws(() => parseHar(h), /20,000/);
});
test("non-HTTP schemes are rejected", () => {
  const h = fixture();
  h.log.entries[0].request.url = "javascript:alert(1)";
  assert.throws(() => parseHar(h), /HTTP/);
});
test("empty summary is well defined", () => {
  assert.deepEqual(summarize([]), {
    count: 0,
    bytes: 0,
    unknownSizes: 0,
    span: 0,
    errors: 0,
    p95: null,
    peak: 0,
  });
});
