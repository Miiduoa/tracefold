import "./style.css";
import {
  parseHar,
  summarize,
  exportSummary,
  type Capture,
  type RequestRow,
} from "./model.ts";
import { demoHar } from "./demo.ts";
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
  demo = true,
  selected = 13;
let query = "",
  category = "all",
  sort = "start",
  error = "",
  loadVersion = 0;
app.innerHTML = `<header><a class="brand" href="./"><span class="mark" aria-hidden="true">≋</span>Tracefold</a><span class="header-note">NETWORK WORKBENCH</span><a href="https://github.com/Miiduoa/tracefold">Source code ↗</a></header>
<main><section class="intro"><div><p class="eyebrow">HAR INSPECTOR</p><h1>Inspect a capture.<br><span>Find what slowed it down.</span></h1><p class="lede">Find the wait, the weight, and the requests that failed.</p></div><div class="import-box"><span class="local-label">LOCAL FILES · NO UPLOAD</span><label class="primary" for="file">Open HAR file <span aria-hidden="true">＋</span></label><input id="file" type="file" accept=".har,.json,application/json"><button id="demo" class="text-button">Load example capture</button><p>Export a HAR from your browser’s Network panel.<br>Up to 25 MB / 20,000 requests.</p></div></section>
<div id="error" role="alert"></div><section aria-label="Capture statistics" id="stats" class="stats"></section>
<section class="workbench"><div class="section-heading"><div><span class="eyebrow">01 / REQUEST WATERFALL</span><h2 id="capture-name"></h2></div><button id="export" class="secondary">Export summary</button></div>
<div class="toolbar"><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Filter path or host" aria-label="Filter path or host"></label><label class="sr-only" for="category">Request type</label><select id="category"><option value="all">All requests</option><option value="errors">Failed requests</option><option value="data">Fetch / data</option><option value="script">JavaScript</option><option value="image">Images</option><option value="style">Stylesheets</option><option value="font">Fonts</option><option value="document">Documents</option><option value="other">Other</option></select><label class="sr-only" for="sort">Sort order</label><select id="sort"><option value="start">Start time</option><option value="duration">Slowest first</option><option value="bytes">Largest first</option></select><span id="result-count"></span></div>
<div class="workspace"><div class="request-pane"><div class="table-head"><span>REQUEST / STATUS</span><span>SIZE</span><span>DURATION / TIMELINE</span></div><div id="requests"></div></div><aside id="detail" aria-label="Request details"></aside></div>
<div class="legend"><span><i class="data"></i>Data</span><span><i class="script"></i>Script</span><span><i class="image"></i>Image</span><span><i class="style"></i>Style</span><span><i class="other"></i>Other</span><span>Timeline is relative to capture start.</span></div></section>
<section class="bottom"><div><span class="eyebrow">02 / READING THIS CAPTURE</span><h2>Start with the outliers.</h2><div id="insights"></div></div><div class="privacy"><h3>Your capture stays here.</h3><p>Analysis runs in this tab. No account, analytics, or upload endpoint. Closing the tab clears the capture.</p><p>Summary exports omit headers, cookies, bodies, query strings and fragments. Hostnames and paths remain; review them before sharing.</p><details><summary>How the numbers work</summary><p>p95 uses nearest rank. Transfer uses the browser’s transfer size when available, otherwise encoded body size. Unknown sizes are excluded. TLS is part of connect time, never added twice. Capture span is not page load time.</p></details></div></section><footer><span>Tracefold / 0.1</span><span>Request timing · Transfer size · HTTP status</span><a href="https://github.com/Miiduoa/tracefold#readme">Documentation ↗</a></footer></main>`;
function draw() {
  const s = summarize(capture.rows);
  document.querySelector("#error")!.textContent = error;
  document.querySelector("#stats")!.innerHTML = [
    ["Requests", String(s.count), `${s.peak} peak concurrent`],
    [
      "Transferred",
      size(s.bytes),
      s.unknownSizes
        ? `${s.unknownSizes} unknown sizes excluded`
        : "Known transfer / encoded body",
    ],
    ["p95 duration", ms(s.p95), "95% of requests finish within"],
    ["Failed", String(s.errors), "HTTP 4xx / 5xx or status 0"],
  ]
    .map(
      ([label, value, note]) =>
        `<div class="stat"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`,
    )
    .join("");
  document.querySelector("#capture-name")!.innerHTML =
    `${esc(filename)} ${demo ? '<span class="badge">SYNTHETIC EXAMPLE</span>' : ""}`;
  const slow = [...capture.rows].sort((a, b) => b.duration - a.duration)[0];
  const heavy = [...capture.rows]
    .filter((r) => r.bytes !== null)
    .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))[0];
  document.querySelector("#insights")!.innerHTML =
    `<div class="insight"><span>01</span><p><strong>${esc(slow.path)}</strong> has the longest request duration: ${ms(slow.duration)}. Server wait accounts for ${ms(slow.wait)}.</p></div>${heavy ? `<div class="insight"><span>02</span><p><strong>${esc(heavy.path)}</strong> is the largest known transfer at ${size(heavy.bytes)}.</p></div>` : ""}<div class="insight"><span>03</span><p>${s.errors ? `${s.errors} request${s.errors === 1 ? "" : "s"} failed. Filter failed requests to inspect the status and timing.` : "No HTTP errors or status-0 requests in this capture."}</p></div>${capture.warnings.length ? `<details><summary>${capture.warnings.length} timing warning(s)</summary><p>${capture.warnings.slice(0, 30).map(esc).join("<br>")}</p></details>` : ""}`;
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
    `${rows.length} / ${capture.rows.length}`;
  const span = Math.max(...capture.rows.map((r) => r.start + r.duration), 1);
  document.querySelector("#requests")!.innerHTML = rows.length
    ? rows
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
    }),
  );
  if (focusedId !== undefined)
    document
      .querySelector<HTMLButtonElement>(`[data-id="${Number(focusedId)}"]`)
      ?.focus({ preventScroll: true });
  const row = rows.find((r) => r.id === selected);
  document.querySelector("#detail")!.innerHTML = row
    ? detail(row)
    : '<div class="detail-empty"><span class="eyebrow">REQUEST DETAIL</span><h3>Select a request</h3><p>Inspect timing phases and response details.</p></div>';
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
  return `<span class="eyebrow">REQUEST DETAIL <span class="detail-index">#${String(r.id + 1).padStart(2, "0")}</span></span><h3>${esc(r.path)}</h3><p class="detail-host">${esc(r.host)}</p><div class="detail-total">${ms(r.duration)}<span>elapsed</span></div><div class="detail-meta"><span>${esc(r.method)}</span><span>HTTP ${r.status || "unavailable"}</span><span>${size(r.bytes)}</span></div><h4>TIMING BREAKDOWN</h4>${phases.map(([k, label]) => `<div class="phase ${k === "ssl" ? "subset" : ""}"><div><span>${label}</span><strong>${ms(r.timings[k])}</strong></div><div class="phase-track"><i style="width:${Math.min(100, ((r.timings[k] ?? 0) / Math.max(1, r.duration)) * 100)}%"></i></div></div>`).join("")}<p class="detail-foot">Starts ${ms(r.start)} into the capture.<br>Unknown phases were not recorded.</p>`;
}
document.querySelector("#search")!.addEventListener("input", (e) => {
  query = (e.target as HTMLInputElement).value;
  drawRows();
});
document.querySelector("#category")!.addEventListener("change", (e) => {
  category = (e.target as HTMLSelectElement).value;
  drawRows();
});
document.querySelector("#sort")!.addEventListener("change", (e) => {
  sort = (e.target as HTMLSelectElement).value;
  drawRows();
});
function reset(next: Capture, name: string, isDemo: boolean) {
  capture = next;
  filename = name;
  demo = isDemo;
  selected = next.rows[0].id;
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
  reset(parseHar(demoHar()), "Workspace page load", true);
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
    reset(parseHar(JSON.parse(text)), file.name, false);
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
