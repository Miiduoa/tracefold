# A recorded capture, including the awkward parts

On 2026-10-07, a fresh Playwright Chromium context loaded [the public portfolio](https://miiduoa.github.io/). The recorder used `recordHar: { content: 'omit', mode: 'full' }`; the context was closed after network idle so the HAR was flushed. No signed-in browser state was used.

The [measurement fixture](../../tests/fixtures/portfolio.chromium.json) keeps timings, method, response status, MIME type, known sizes, and reviewed public hostnames/paths. Headers, cookies, request/response bodies, query strings, fragments, URL credentials and server addresses are not published. It is a reduced measurement fixture, not a complete HAR for browser replay.

Choose **Recorded capture** in the workbench to inspect it. **Synthetic example** remains separate and is labeled accordingly.

| Observation | Recorded value |
|---|---:|
| Requests | 3 |
| Known transfer/encoded-body bytes | 89,344 |
| Request-duration p95 (nearest rank) | 635.435 ms |
| Capture span | 1,396.829 ms |
| Peak recorded overlap | 2 |
| Failed requests | 0 |
| Timing consistency warnings | 2 |

With just three requests, p95 is the maximum request duration. This one observation is not a stable estimate of visitor experience or page-load performance.

## Why there are two warnings

The recorder identifies itself as Playwright `1.64.0-alpha-1790635538000`; Chromium was `155.0.8059.40`.

| Entry | Recorded elapsed | Sum excluding separate TLS | Difference | Recorded TLS |
|---|---:|---:|---:|---:|
| Portfolio document | 588.124 ms | 510.570 ms | 77.554 ms | 77.554 ms |
| Screenshot image | 635.435 ms | 571.968 ms | 63.467 ms | 63.467 ms |

The differences exactly equal the TLS durations in this recording. The [HAR timing definition](https://webperfwg.org/specs/HAR/Overview.html) includes TLS inside connect. Tracefold warns and preserves the recorded elapsed values; it does not silently subtract TLS or claim to repair the trace.

This is evidence about **this Playwright recording**, not a claim that native Chrome exports or other recorder versions have the same behavior. Native Chrome, Firefox and Safari exports still need separate compatibility checks.

## Reproduce the reduction and checks

Given a HAR you have recorded separately:

```sh
node --experimental-strip-types scripts/reduce-capture.mjs input.har output.json
npm test
```

The reducer creates a new file and refuses to overwrite one. Review the remaining hosts and paths before publishing. Numeric size fields are normalized; arbitrary raw objects in a malformed `bodySize` field cannot pass through the measurement-only reduction.

Fixture SHA-256: `46dc5c68391d17e4805de1150eb9c855177cdf9fc53001a0f17f6dec5bc26a0f`.

The tests assert the captured totals and both timing warnings. They also check that malformed numeric fields cannot smuggle unrelated content into a reduced fixture.

## 繁體中文

這是實際載入公開作品集網站產生的紀錄，不是合成流量；但它只有三筆請求，不能當成所有使用者體驗的效能結論。原始 HAR 未公開，保留下來的 fixture 已移除 header、cookie、body、query 與 IP 等欄位。

其中兩筆的總耗時比非 TLS 分段加總多出的數值，恰好等於各自 TLS 時間。工具保留匯出值並顯示警告，沒有自行改數字。這個案例的價值在於保留可重現的輸入差異，也清楚標示匯出器與相容性限制。
