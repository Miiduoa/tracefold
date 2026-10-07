async (page) => {
  const entries = Array.from({ length: 201 }, (_, id) => ({
    startedDateTime: new Date(Date.UTC(2026, 0, 1) + id).toISOString(),
    time: id + 1,
    request: {
      method: "GET",
      url: `https://check.example.test/requests/${id}`,
    },
    response: {
      status: id === 200 ? 503 : 200,
      bodySize: id,
      content: { mimeType: "application/json" },
    },
    timings: { send: 0, wait: id + 1, receive: 0 },
  }));
  const require = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "check.har",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ log: { entries } })),
    });
  await page.getByRole("heading", { name: "check.har", exact: true }).waitFor();
  require((await page.locator(".request").count()) ===
    200, "First page must be bounded to 200");
  require(await page
    .getByRole("button", { name: "Previous", exact: true })
    .isDisabled(), "Previous must be disabled on first page");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  require((await page.locator(".request").count()) ===
    1, "Last row must be reachable");
  require(await page
    .getByRole("button", { name: "Next", exact: true })
    .isDisabled(), "Last page must disable Next");
  require((await page.locator("#page-status").innerText()) ===
    "201–201 of 201 matches", "Page range is wrong");
  await page.getByLabel("Filter path or host").fill("/requests/0");
  require((await page.locator("#page-status").innerText()) ===
    "1–1 of 1 matches", "Search must reset page");
  await page.getByLabel("Filter path or host").fill("");
  await page.getByLabel("Sort order").selectOption("duration");
  require((await page.locator(".request").first().innerText()).includes(
    "/requests/200",
  ), "Sort must cover all rows");
  await page.getByLabel("Request type").selectOption("errors");
  require((await page.locator(".request").count()) ===
    1, "Failure filter must include row outside first page");
  await page.locator(".request").first().focus();
  await page.keyboard.press("Enter");
  require((await page.locator(".request:focus").count()) ===
    1, "Request activation lost keyboard focus");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export summary", exact: true })
    .click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  require(exported.requests.length === 201 && exported.summary.count === 201,
    'Export must include all requests, not only the visible filter/page');
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "broken.har",
      mimeType: "application/json",
      buffer: Buffer.from("broken"),
    });
  await page.getByRole("alert").filter({ hasText: "not valid JSON" }).waitFor();
  require((await page.locator("#capture-name").innerText()) ===
    "check.har", "Broken input replaced the capture");
  await page
    .getByRole("button", { name: "Recorded capture", exact: true })
    .click();
  require((await page.locator(".request").count()) ===
    3, "Recorded example did not load");
  await page.getByText("2 timing warning(s)", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  require(await page.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  ), "Mobile layout overflows");
  await page
    .getByRole("button", { name: "Synthetic example", exact: true })
    .click();
  require((await page.locator(".request").count()) ===
    24, "Synthetic example did not reset");
  await page.setViewportSize({ width: 1440, height: 1080 });
  return {
    passed: true,
    checks: [
      "page bounds",
      "last-page reachability",
      "page controls",
      "filter resets page",
      "global sorting",
      "global failure filter",
      "keyboard focus",
      "export download",
      "malformed import preserves capture",
      "recorded example + warnings",
      "mobile width",
      "synthetic reset",
    ],
  };
}
