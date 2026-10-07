import type { RequestRow } from "./model.ts";

export const PAGE_SIZE = 200;

/** Bound DOM work without truncating the searchable capture or its statistics. */
export function requestPage(rows: RequestRow[], requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(totalPages - 1, Math.max(0, Math.floor(requestedPage)));
  const offset = page * PAGE_SIZE;
  return {
    page,
    totalPages,
    start: rows.length ? offset + 1 : 0,
    end: Math.min(offset + PAGE_SIZE, rows.length),
    rows: rows.slice(offset, offset + PAGE_SIZE),
  };
}
