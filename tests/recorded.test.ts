import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHar, summarize } from "../src/model.ts";
import { reduceCapture } from "../scripts/reduce-capture.mjs";
const recorded = () =>
  JSON.parse(
    readFileSync(
      new URL("./fixtures/portfolio.chromium.json", import.meta.url),
      "utf8",
    ),
  );
test("recorded portfolio capture retains its observed measurements", () => {
  const c = parseHar(recorded()),
    s = summarize(c.rows);
  assert.equal(s.count, 3);
  assert.equal(s.bytes, 89344);
  assert.equal(s.peak, 2);
  assert.equal(s.errors, 0);
  assert.equal(s.p95, 635.435);
  assert.equal(s.span, 1396.829);
});
test("recorder timing mismatch is visible; elapsed values are not silently repaired", () => {
  const c = parseHar(recorded());
  assert.equal(c.warnings.length, 2);
  assert.equal(c.rows[0].duration, 588.124);
  assert.equal(c.rows[0].timings.ssl, 77.554);
  assert.equal(c.rows[1].duration, 635.435);
});
test("fixture reduction drops sensitive fields while preserving measurement results", () => {
  const raw = recorded();
  const e = raw.log.entries[0];
  e.request.url =
    "https://user:password@miiduoa.github.io/?secret=token#hidden";
  e.request.headers = [{ name: "Authorization", value: "private_header" }];
  e.request.postData = { text: "private_body" };
  e.response.cookies = [{ name: "private_cookie" }];
  e.response.content.text = "private_response";
  e.serverIPAddress = "private_ip";
  e.timings.extra = "private_extension";
  const reduced = reduceCapture(raw),
    text = JSON.stringify(reduced);
  for (const secret of ["user:", "password", "secret", "hidden", "private_"])
    assert.ok(!text.includes(secret));
  assert.deepEqual(
    summarize(parseHar(reduced).rows),
    summarize(parseHar(raw).rows),
  );
  assert.deepEqual(Object.keys(reduced.log.entries[0]).sort(), [
    "request",
    "response",
    "startedDateTime",
    "time",
    "timings",
  ]);
});

test("malformed numeric size fields cannot smuggle raw content into a fixture", () => {
  const raw = recorded();
  raw.log.entries[0].response.bodySize = { private: "synthetic-secret" };
  raw.log.entries[0].response._transferSize = "another-secret";
  const reduced = reduceCapture(raw);
  assert.equal(reduced.log.entries[0].response.bodySize, -1);
  assert.ok(!JSON.stringify(reduced).includes("secret"));
  assert.equal(parseHar(reduced).rows[0].bytes, null);
  assert.deepEqual(
    summarize(parseHar(reduced).rows),
    summarize(parseHar(raw).rows),
  );
});
