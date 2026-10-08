# Measurement decisions

## Why a separate workbench?

A saved HAR is useful when the original debugging session is gone. Tracefold provides a small inspection surface for those files. It does not replace DevTools or attempt to diagnose rendering and JavaScript execution from network timings.

## Data flow

```text
File (size check)
  → JSON parse
  → entry validation + minimal normalized records
  → statistics / filter / sort
  → escaped DOM or reduced JSON summary
```

The raw JSON is local to the import handler; long-lived application state stores only normalized records. There is no fetch call during analysis. New imports increment a sequence number so an old asynchronous read cannot replace the latest capture or a subsequently selected example.

## Concurrency

For each positive-duration request, create `(start, +1)` and `(end, -1)`. Sort by time and then delta, so endings precede beginnings on ties. The largest running sum is peak concurrency. Zero-duration entries do not open an interval. Complexity is O(n log n) time and O(n) space.

This is recorded request overlap, not a count of TCP connections. HTTP/2 streams and connection reuse make those different quantities.

## Unknown is not zero

A cached zero-byte response is a measured zero. HAR's `-1` means unavailable. Unknown sizes are omitted from the sum and their count is shown. Decoded `content.size` cannot replace encoded transfer bytes. Mixed `_transferSize` and `bodySize` sources mean the total can mix header-inclusive and body-only values; the UI labels that fallback rather than calling it an exact wire-byte total.

## Rendering and scope

A fixed-height scrollable request list renders at most 200 rows per page. All matches are filtered and sorted before slicing; page state resets on import, search, category and sort changes. A live range and native Previous/Next buttons expose the full result set. Filtering leaves capture-level statistics unchanged; the result count makes the filtered subset explicit. Outlier shortcuts clear the current filters, use the full capture to sort or filter, reset to page one, and select a request in that displayed order. The waterfall scale shares the row geometry and stays relative to the whole capture when filtering. On narrow screens, request selection moves to details and the return action restores focus to that row.

Resource categories are inferred from MIME types. Multi-page captures share a single timeline.

A worker remains an option for large-file parsing. The list now bounds DOM work through pagination; parsing and filtering still run on the main thread. The [stress experiment](cases/stress.md) records three local automation measurements per version and their limitations.

## Validation record

- Core tests: malformed entries, empty captures, capture limit, invalid schemes, timing mismatch, unknown/zero bytes, TLS accounting, unsorted entries, zero-length/touching/overlapping intervals, percentile definition and export reduction.
- Local Chromium: filter to one HTTP 503; select details; search to empty state; duration ordering; download JSON; import one valid request; reject invalid JSON while retaining the previous capture.
- Desktop and 390 × 844 layout inspected. The compact inspector also received a 201-row paging/outlier check and a 205-row reverse-ordered failure case; downloaded summaries retained the full capture. Invalid import retention and stale import versus example selection were checked. No horizontal overflow on the mobile viewport; no console errors during the workbench flow.

Tests are reproducible with `npm test`. Browser checks above describe a manual automation pass, not a cross-browser CI suite.
