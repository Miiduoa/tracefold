import { test } from "node:test";
import assert from "node:assert/strict";
import { requestPage, PAGE_SIZE } from "../src/pagination.ts";
import { parseHar } from "../src/model.ts";
import { demoHar } from "../src/demo.ts";
const row = parseHar(demoHar()).rows[0];
const rows = (n: number) =>
  Array.from({ length: n }, (_, id) => ({ ...row, id }));
test("empty results have no phantom range or extra page", () => {
  assert.deepEqual(requestPage([], 50), {
    page: 0,
    totalPages: 1,
    start: 0,
    end: 0,
    rows: [],
  });
});
test("a full page never exposes a blank next page", () => {
  const r = requestPage(rows(PAGE_SIZE), 1);
  assert.equal(r.page, 0);
  assert.equal(r.end, PAGE_SIZE);
  assert.equal(r.totalPages, 1);
});
test("last partial page is reachable", () => {
  const r = requestPage(rows(201), 1);
  assert.equal(r.start, 201);
  assert.equal(r.end, 201);
  assert.equal(r.rows[0].id, 200);
});
test("filtering from a late page clamps into remaining results", () => {
  const r = requestPage(rows(3), 99);
  assert.equal(r.page, 0);
  assert.equal(r.rows.length, 3);
});
test("walking 20,000 rows neither loses nor repeats a request", () => {
  const all = rows(20000),
    seen: number[] = [];
  for (let page = 0; page < 100; page++) {
    const current = requestPage(all, page);
    assert.ok(current.rows.length <= PAGE_SIZE);
    seen.push(...current.rows.map((r) => r.id));
  }
  assert.deepEqual(
    seen,
    all.map((r) => r.id),
  );
});
test("negative and fractional page input clamps to a valid page", () => {
  const all = rows(501);
  assert.equal(requestPage(all, -1).page, 0);
  assert.equal(requestPage(all, 1.9).page, 1);
});
