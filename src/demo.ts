// A deterministic, synthetic page load. No captured traffic or personal data.
export function demoHar() {
  const specs: [string, string, number, number, number, number][] = [
    ["/", "text/html", 0, 182, 12480, 200],
    ["/assets/app.css", "text/css", 186, 98, 18920, 200],
    ["/assets/app.js", "text/javascript", 187, 410, 184200, 200],
    ["/assets/vendor.js", "text/javascript", 188, 625, 326800, 200],
    ["/fonts/mono.woff2", "font/woff2", 291, 163, 28600, 200],
    ["/fonts/sans.woff2", "font/woff2", 292, 194, 42300, 200],
    ["/api/session", "application/json", 603, 148, 940, 200],
    ["/api/workspaces", "application/json", 607, 286, 6200, 200],
    ["/api/projects", "application/json", 610, 1240, 24860, 200],
    ["/images/cover.avif", "image/avif", 650, 840, 486000, 200],
    ["/images/avatar-01.webp", "image/webp", 655, 134, 4800, 200],
    ["/images/avatar-02.webp", "image/webp", 658, 142, 5200, 200],
    ["/api/notifications", "application/json", 760, 385, 3120, 200],
    ["/api/activity", "application/json", 896, 1720, 88400, 200],
    ["/assets/chart.js", "text/javascript", 902, 270, 96300, 200],
    ["/api/usage", "application/json", 1150, 610, 1200, 503],
    ["/images/project-01.avif", "image/avif", 1494, 340, 92000, 200],
    ["/images/project-02.avif", "image/avif", 1496, 520, 148000, 200],
    ["/api/search-index", "application/json", 1854, 680, 164000, 200],
    ["/api/usage", "application/json", 2110, 245, 2600, 200],
    ["/api/preferences", "application/json", 2120, 110, 840, 200],
    ["/assets/print.css", "text/css", 2300, 67, 3200, 200],
    ["/images/project-03.avif", "image/avif", 2400, 370, 124000, 200],
    ["/api/presence", "application/json", 2650, 136, 1100, 200],
  ];
  return {
    log: {
      version: "1.2",
      creator: { name: "Tracefold synthetic fixture", version: "1" },
      entries: specs.map(([path, mime, start, duration, size, status]) => ({
        startedDateTime: new Date(Date.UTC(2026, 0, 1) + start).toISOString(),
        time: duration,
        request: {
          method: "GET",
          url: `https://${mime.startsWith("image") ? "media.example.test" : "app.example.test"}${path}`,
        },
        response: { status, bodySize: size, content: { mimeType: mime, size } },
        timings: {
          blocked: 0,
          dns: 0,
          connect: 0,
          ssl: -1,
          send: 1,
          wait: duration * 0.78 - 1,
          receive: duration * 0.22,
        },
      })),
    },
  };
}
