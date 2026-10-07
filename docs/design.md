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

A fixed-height scrollable request list keeps the workspace compact. Filtering leaves capture-level statistics unchanged; the result count makes the filtered subset explicit. Resource categories are inferred from MIME types. Multi-page captures share a single timeline.

A worker and virtualized rows would be sensible next steps for large captures. Neither is implemented or claimed here. The present limit bounds input volume but does not establish a responsiveness benchmark.

## Validation record

- Core tests: malformed entries, empty captures, capture limit, invalid schemes, timing mismatch, unknown/zero bytes, TLS accounting, unsorted entries, zero-length/touching/overlapping intervals, percentile definition and export reduction.
- Local Chromium: filter to one HTTP 503; select details; search to empty state; duration ordering; download JSON; import one valid request; reject invalid JSON while retaining the previous capture.
- Desktop and 390 × 844 layout inspected. No horizontal overflow on the mobile viewport; no console errors during the workbench flow.

Tests are reproducible with `npm test`. Browser checks above describe a manual automation pass, not a cross-browser CI suite.
