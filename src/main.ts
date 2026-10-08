import "./style.css";
import {
  parseHar,
  summarize,
  exportSummary,
  type Capture,
  type RequestRow,
} from "./model.ts";
import { demoHar } from "./demo.ts";
import { requestPage } from "./pagination.ts";
import recordedHar from "../tests/fixtures/portfolio.chromium.json";
const app = document.querySelector<HTMLDivElement>("#app")!;
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const ms = (n: number | null) =>
  n === null
    ? "Unknown"
    : n >= 1000
      ? `${(n / 1000).toFixed(2)} s`
      : `${Math.round(n)} ms`;
const size = (n: number | null) =>
  n === null
    ? "Unknown"
    : n >= 1e6
      ? `${(n / 1e6).toFixed(2)} MB`
      : `${(n / 1e3).toFixed(1)} kB`;
let capture: Capture = parseHar(demoHar()),
  filename = "Workspace page load",
  example: "synthetic" | "recorded" | null = "synthetic",
  selected = 0;
let query = "",
  category = "all",
  sort = "start",
  error = "",
  loadVersion = 0,
  pageIndex = 0;
app.innerHTML = /* HTML */ ` <header class="app-header">
    <a class="brand" href="./">Tracefold</a
    ><span class="app-label">HAR inspector</span
    ><span class="local-note">Local analysis · no upload</span
    ><a href="https://github.com/Miiduoa/tracefold">GitHub</a>
  </header>
  <main>
    <section class="source-strip" aria-label="Capture source">
      <div class="source-info">
        <span class="source-icon" aria-hidden="true">HAR</span>
        <div>
          <h1 id="capture-name"></h1>
          <p id="source-note"></p>
        </div>
      </div>
      <div class="source-actions">
        <button id="demo" class="text-button">Synthetic example</button
        ><button id="recorded" class="text-button">Recorded capture</button
        ><label class="primary file-button" for="file"
          >Open HAR<input
            id="file"
            type="file"
            accept=".har,.json,application/json"
        /></label>
        <div class="export-control">
          <button id="export" class="secondary" aria-describedby="export-note">
            Export summary</button
          ><span id="export-note">Hosts and paths included</span>
        </div>
      </div>
    </section>
    <div id="error" role="alert"></div>
    <section class="workbench" aria-label="Request analysis">
      <div
        id="stats"
        class="capture-summary"
        aria-label="Whole capture summary"
      ></div>
      <div class="toolbar">
        <label class="search"
          ><span class="sr-only">Filter path or host</span
          ><input
            id="search"
            type="search"
            placeholder="Filter path or host"
            aria-label="Filter path or host" /></label
        ><label class="sr-only" for="category">Request type</label
        ><select id="category">
          <option value="all">All requests</option>
          <option value="errors">Failed requests</option>
          <option value="data">Fetch / data</option>
          <option value="script">JavaScript</option>
          <option value="image">Images</option>
          <option value="style">Stylesheets</option>
          <option value="font">Fonts</option>
          <option value="document">Documents</option>
          <option value="other">Other</option></select
        ><label class="sr-only" for="sort">Sort order</label
        ><select id="sort">
          <option value="start">Start time</option>
          <option value="duration">Slowest first</option>
          <option value="bytes">Largest first</option></select
        ><button id="reset-view" class="text-button">Reset view</button
        ><span id="result-count" aria-live="polite"></span>
      </div>
      <div
        id="insights"
        class="outlier-controls"
        role="group"
        aria-label="Inspect capture outliers"
      ></div>
      <div class="workspace">
        <div class="request-pane">
          <p class="scroll-hint">Scroll table sideways for timing →</p>
          <div class="request-scroll">
            <div class="table-head">
              <span>Request / status</span><span>Transfer</span
              ><span class="timeline-header"
                ><span>Duration</span
                ><span
                  class="waterfall-axis"
                  aria-label="Capture-relative waterfall scale"
                  ><span>0</span><span id="timeline-mid"></span
                  ><span id="timeline-end"></span></span
              ></span>
            </div>
            <div id="requests"></div>
          </div>
          <nav class="pagination" aria-label="Request pages">
            <span id="page-status" aria-live="polite"></span
            ><button id="previous-page" class="secondary">Previous</button
            ><button id="next-page" class="secondary">Next</button>
          </nav>
        </div>
        <aside id="detail" aria-label="Request details" tabindex="-1"></aside>
      </div>
      <div class="legend">
        <span><i class="data"></i>Data</span
        ><span><i class="script"></i>Script</span
        ><span><i class="image"></i>Image</span
        ><span><i class="style"></i>Style</span
        ><span><i class="font"></i>Font</span
        ><span><i class="document"></i>Document</span
        ><span><i class="other"></i>Other</span
        ><span class="timeline-note"
          >Waterfall begins at the first request, not navigation start.</span
        >
      </div>
    </section>
    <div id="warnings" class="warnings"></div>
    <footer>
      <details>
        <summary>About this analysis</summary>
        <p>
          p95 uses nearest rank. Transfer uses the browser’s transfer size when
          available, otherwise encoded body size. Unknown sizes are excluded.
          TLS is part of connect time, never added twice. Capture span is not
          page load time.
        </p>
        <p>
          Files stay in memory in this tab. The summary omits headers, cookies,
          bodies, query strings and fragments. Hostnames and paths remain;
          review them before sharing.
        </p>
      </details>
      <span>Up to 25 MB / 20,000 requests</span
      ><a href="https://github.com/Miiduoa/tracefold#readme">Documentation</a>
    </footer>
  </main>`;
function draw() {
  const s = summarize(capture.rows);
  document.querySelector("#error")!.textContent = error;
  document.querySelector("#timeline-end")!.textContent = ms(s.span);
  document.querySelector("#timeline-mid")!.textContent = ms(s.span / 2);
  document.querySelector("#stats")!.innerHTML =
    `<span class="summary-scope">Whole capture</span><span><strong>${s.count}</strong> requests</span><span title="${s.unknownSizes} unknown sizes excluded">Transfer <strong>${size(s.bytes)}</strong>${s.unknownSizes ? ` · ${s.unknownSizes} unknown` : ""}</span><span>p95 <strong>${ms(s.p95)}</strong></span><span>Peak concurrent <strong>${s.peak}</strong></span><span class="${s.errors ? "has-errors" : ""}"><strong>${s.errors}</strong> failed</span>`;
  document.querySelector("#capture-name")!.innerHTML =
    `${esc(filename)} <span class="badge ${example ? "" : "file-source"}">${example === "synthetic" ? "Synthetic example" : example === "recorded" ? "Recorded example" : "Local file"}</span>`;
  document.querySelector("#source-note")!.textContent =
    example === "synthetic"
      ? "Generated requests for exploring slow responses, large transfers and failures."
      : example === "recorded"
        ? "Recorded from the public portfolio in Chromium. Timing warnings are retained."
        : "Opened locally. The source file is not modified or stored by this page.";
  for (const [id, active] of [
    ["demo", example === "synthetic"],
    ["recorded", example === "recorded"],
  ] as const)
    document
      .querySelector(`#${id}`)!
      .setAttribute("aria-pressed", String(active));
  const slow = [...capture.rows].sort((a, b) => b.duration - a.duration)[0];
  const heavy = [...capture.rows]
    .filter((r) => r.bytes !== null)
    .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))[0];
  document.querySelector("#insights")!.innerHTML =
    `<span class="outlier-label">Inspect</span><button id="inspect-slow" class="outlier" title="${esc(slow.path)}"><span>Longest</span><strong>${ms(slow.duration)}</strong><span class="outlier-path">${esc(slow.path)}</span><span aria-hidden="true">↗</span></button>${heavy ? `<button id="inspect-heavy" class="outlier" title="${esc(heavy.path)}"><span>Largest</span><strong>${size(heavy.bytes)}</strong><span class="outlier-path">${esc(heavy.path)}</span><span aria-hidden="true">↗</span></button>` : ""}<button id="inspect-failed" class="outlier failure" ${s.errors ? "" : "disabled"}>Failed <strong>${s.errors}</strong></button>`;
  document
    .querySelector("#inspect-slow")!
    .addEventListener("click", () => inspectOutlier(slow.id, "duration"));
  document
    .querySelector("#inspect-heavy")
    ?.addEventListener("click", () => inspectOutlier(heavy.id, "bytes"));
  document.querySelector("#inspect-failed")!.addEventListener("click", () => {
    setView("", "errors", "start");
    selected = capture.rows
      .filter((r) => r.status === 0 || r.status >= 400)
      .sort((a, b) => a.start - b.start)[0].id;
    drawRows();
  });
  document.querySelector("#warnings")!.innerHTML = capture.warnings.length
    ? `<details><summary>${capture.warnings.length} timing warning${capture.warnings.length === 1 ? "" : "s"} in this capture</summary><p>${capture.warnings.slice(0, 30).map(esc).join("<br>")}</p></details>`
    : "";
  drawRows();
}
function drawRows() {
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.id;
  const rows = capture.rows.filter(
    (r) =>
      (r.path + " " + r.host).toLowerCase().includes(query.toLowerCase()) &&
      (category === "all" ||
        (category === "errors"
          ? r.status === 0 || r.status >= 400
          : r.kind === category)),
  );
  rows.sort((a, b) =>
    sort === "duration"
      ? b.duration - a.duration
      : sort === "bytes"
        ? (b.bytes ?? -1) - (a.bytes ?? -1)
        : a.start - b.start,
  );
  document.querySelector("#result-count")!.textContent =
    `${rows.length} / ${capture.rows.length} requests`;
  const current = requestPage(rows, pageIndex);
  pageIndex = current.page;
  document.querySelector("#page-status")!.textContent =
    `${current.start}–${current.end} of ${rows.length} matches`;
  (document.querySelector("#previous-page") as HTMLButtonElement).disabled =
    current.page === 0;
  (document.querySelector("#next-page") as HTMLButtonElement).disabled =
    current.page === current.totalPages - 1;
  const span = Math.max(...capture.rows.map((r) => r.start + r.duration), 1);
  document.querySelector("#requests")!.innerHTML = rows.length
    ? current.rows
        .map(
          (r) =>
            `<button class="request ${r.id === selected ? "selected" : ""}" data-id="${r.id}" aria-pressed="${r.id === selected}"><span class="request-name"><span class="status ${r.status === 0 || r.status >= 400 ? "bad" : ""}">${r.status || "ERR"}</span><span><strong>${esc(r.path)}</strong><small>${esc(r.host)} · ${esc(r.method)}</small></span></span><span class="bytes">${size(r.bytes)}</span><span class="timeline"><span class="duration">${ms(r.duration)}</span><span class="track"><i class="${r.kind}" style="margin-left:${(r.start / span) * 100}%;width:${Math.max((r.duration / span) * 100, 0.25)}%"></i></span></span></button>`,
        )
        .join("")
    : '<div class="empty">No requests match. Try another filter.</div>';
  document.querySelectorAll<HTMLButtonElement>("[data-id]").forEach((b) =>
    b.addEventListener("click", () => {
      selected = Number(b.dataset.id);
      drawRows();
      revealDetail();
    }),
  );
  if (focusedId !== undefined)
    document
      .querySelector<HTMLButtonElement>(`[data-id="${Number(focusedId)}"]`)
      ?.focus({ preventScroll: true });
  for (const [id, active] of [
    ["inspect-slow", !query && category === "all" && sort === "duration"],
    ["inspect-heavy", !query && category === "all" && sort === "bytes"],
    ["inspect-failed", !query && category === "errors"],
  ] as const)
    document
      .querySelector(`#${id}`)
      ?.setAttribute("aria-pressed", String(active));
  (document.querySelector("#reset-view") as HTMLButtonElement).disabled =
    !query && category === "all" && sort === "start";
  const row = current.rows.find((r) => r.id === selected);
  document.querySelector("#detail")!.innerHTML = row
    ? detail(row)
    : '<div class="detail-empty"><h2>No selection in this view</h2><p>Choose a visible request to inspect its timing phases and response details.</p></div>';
  document.querySelector("#back-to-list")?.addEventListener("click", () => {
    const button = document.querySelector<HTMLButtonElement>(
      `.request[data-id="${selected}"]`,
    );
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "center" });
  });
}
function revealDetail() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    document
      .querySelector<HTMLElement>("#detail")!
      .focus({ preventScroll: true });
    document.querySelector("#detail")!.scrollIntoView({ block: "start" });
  }
}
function setView(nextQuery: string, nextCategory: string, nextSort: string) {
  query = nextQuery;
  category = nextCategory;
  sort = nextSort;
  pageIndex = 0;
  (document.querySelector("#search") as HTMLInputElement).value = query;
  (document.querySelector("#category") as HTMLSelectElement).value = category;
  (document.querySelector("#sort") as HTMLSelectElement).value = sort;
  document.querySelector(".request-scroll")!.scrollTop = 0;
}
function inspectOutlier(id: number, order: string) {
  setView("", "all", order);
  selected = id;
  drawRows();
  document.querySelector(".request-scroll")!.scrollTop = 0;
  revealDetail();
}
document.querySelector("#reset-view")!.addEventListener("click", () => {
  setView("", "all", "start");
  drawRows();
});
for (const [selector, delta] of [
  ["#previous-page", -1],
  ["#next-page", 1],
] as const) {
  document.querySelector(selector)!.addEventListener("click", () => {
    pageIndex += delta;
    drawRows();
    document.querySelector(".request-scroll")!.scrollTop = 0;
  });
}
function detail(r: RequestRow) {
  const phases = [
    ["blocked", "Queue"],
    ["dns", "DNS"],
    ["connect", "Connect"],
    ["ssl", "TLS (within connect)"],
    ["send", "Send"],
    ["wait", "Server wait"],
    ["receive", "Receive"],
  ];
  return `<div class="detail-heading"><h2>Request details</h2><span class="detail-index">#${r.id + 1}</span></div><button id="back-to-list" class="text-button">← Back to requests</button><h3>${esc(r.path)}</h3><p class="detail-host">${esc(r.host)}</p><div class="detail-total">${ms(r.duration)}<span>elapsed</span></div><div class="detail-meta"><span>${esc(r.method)}</span><span>HTTP ${r.status || "unavailable"}</span><span>${size(r.bytes)}</span></div><h4>Timing phases</h4>${phases.map(([k, label]) => `<div class="phase ${k === "ssl" ? "subset" : ""}"><div><span>${label}</span><strong>${ms(r.timings[k])}</strong></div><div class="phase-track"><i style="width:${Math.min(100, ((r.timings[k] ?? 0) / Math.max(1, r.duration)) * 100)}%"></i></div></div>`).join("")}<p class="detail-foot">Starts ${ms(r.start)} into the capture.<br>Unknown phases were not recorded.</p>`;
}
document.querySelector("#search")!.addEventListener("input", (e) => {
  query = (e.target as HTMLInputElement).value;
  pageIndex = 0;
  drawRows();
  document.querySelector(".request-scroll")!.scrollTop = 0;
});
document.querySelector("#category")!.addEventListener("change", (e) => {
  category = (e.target as HTMLSelectElement).value;
  pageIndex = 0;
  drawRows();
  document.querySelector(".request-scroll")!.scrollTop = 0;
});
document.querySelector("#sort")!.addEventListener("change", (e) => {
  sort = (e.target as HTMLSelectElement).value;
  pageIndex = 0;
  drawRows();
  document.querySelector(".request-scroll")!.scrollTop = 0;
});
function reset(next: Capture, name: string, source: typeof example) {
  capture = next;
  filename = name;
  example = source;
  selected = next.rows[0].id;
  pageIndex = 0;
  query = "";
  category = "all";
  sort = "start";
  error = "";
  (document.querySelector("#search") as HTMLInputElement).value = "";
  (document.querySelector("#category") as HTMLSelectElement).value = "all";
  (document.querySelector("#sort") as HTMLSelectElement).value = "start";
  draw();
}
document.querySelector("#demo")!.addEventListener("click", () => {
  loadVersion++;
  reset(parseHar(demoHar()), "Workspace page load", "synthetic");
});
document.querySelector("#recorded")!.addEventListener("click", () => {
  loadVersion++;
  reset(parseHar(recordedHar), "Portfolio · Oct 7, 2026", "recorded");
});
document.querySelector("#file")!.addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0],
    version = ++loadVersion;
  if (!file) return;
  try {
    if (file.size > 25 * 1024 * 1024)
      throw new Error("Choose a HAR file smaller than 25 MB.");
    const text = await file.text();
    if (version !== loadVersion) return;
    reset(parseHar(JSON.parse(text)), file.name, null);
  } catch (err) {
    if (version === loadVersion) {
      error =
        err instanceof SyntaxError
          ? "This file is not valid JSON. Export a HAR from the Network panel."
          : (err as Error).message;
      draw();
    }
  } finally {
    input.value = "";
  }
});
document.querySelector("#export")!.addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([exportSummary(capture)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "tracefold-summary.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
draw();
