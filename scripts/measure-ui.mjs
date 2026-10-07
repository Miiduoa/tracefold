// Optional local experiment. Uses Playwright CLI; not part of the application bundle.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { cpus, platform, release } from "node:os";
import { createHash } from "node:crypto";
import { demoHar } from "../src/demo.ts";
const url = process.argv[2] ?? "http://127.0.0.1:4320/";
const destination = resolve(
  process.argv[3] ?? "output/playwright/stress-result.json",
);
if (existsSync(destination))
  throw new Error(
    "Choose a new result path; previous measurements are retained.",
  );
const fixture = resolve("output/playwright/10000.har");
mkdirSync(dirname(fixture), { recursive: true });
const template = demoHar().log.entries[0];
const content = JSON.stringify({
  log: {
    version: "1.2",
    entries: Array.from({ length: 10000 }, (_, id) => ({
      ...template,
      startedDateTime: new Date(Date.UTC(2026, 0, 1) + id * 2).toISOString(),
      request: {
        ...template.request,
        url: `https://stress.example.test/resource/${id}`,
      },
    })),
  },
});
if (existsSync(fixture) && readFileSync(fixture, "utf8") !== content)
  throw new Error("An unrelated fixture exists at the output path.");
if (!existsSync(fixture)) writeFileSync(fixture, content, { flag: "wx" });
const command = process.env.PLAYWRIGHT_CLI
  ? [process.env.PLAYWRIGHT_CLI]
  : ["npx", "--yes", "--package", "@playwright/cli", "playwright-cli"];
const cli = (...args) =>
  execFileSync(
    command[0],
    [...command.slice(1), "-s=tracefold-stress", ...args],
    { encoding: "utf8", timeout: 120000 },
  );
const code = `async page => {
 const trials=[];
 for(let i=0;i<3;i++){
   await page.reload();
   const start=Date.now();
   await page.locator('input[type=file]').setInputFiles(${JSON.stringify(fixture)});
   await page.getByRole('heading',{name:'10000.har',exact:true}).waitFor();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const importMs=Date.now()-start;
   const renderedRows=await page.locator('.request').count();
   const searchStart=Date.now();
   await page.getByLabel('Filter path or host').fill('/9999');
   await page.getByRole('button',{name:/\\/resource\\/9999 /}).waitFor();
   trials.push({importMs,filterMs:Date.now()-searchStart,renderedRows});
 }
 return {browser:await page.context().browser().version(),count:10000,trials};
}`;
try {
  cli("open", url);
  const measurements = JSON.parse(cli("--raw", "run-code", code));
  const result = {
    recordedAt: new Date().toISOString(),
    platform: platform(),
    osRelease: release(),
    cpu: cpus()[0]?.model,
    node: process.version,
    fixtureSha256: createHash("sha256").update(content).digest("hex"),
    method:
      "Automation-observed import and filter; includes protocol and locator overhead, not isolated JS execution.",
    ...measurements,
  };
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  cli("close");
}
