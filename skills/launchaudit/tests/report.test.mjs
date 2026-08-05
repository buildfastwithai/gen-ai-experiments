import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  calculateReadiness,
  renderReport,
  validateReport
} from "../launchaudit/scripts/generate_report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "tests", "fixtures", "sample-report.json");
const generatorPath = path.join(
  root,
  "launchaudit",
  "scripts",
  "generate_report.mjs"
);
const installerPath = path.join(root, "scripts", "install.js");

async function fixture() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

test("sample report validates and calculates the expected readiness", async () => {
  const data = await fixture();
  assert.deepEqual(validateReport(data), []);
  assert.deepEqual(calculateReadiness(data.dimensions), {
    score: 73,
    coverage: 100
  });
});

test("renderer includes required sections and escapes untrusted text", async () => {
  const html = renderReport(await fixture());
  assert.match(html, /Launch after critical fixes/);
  assert.match(html, /Where the launch signal is strong/);
  assert.match(html, /Seven days to a safer launch/);
  assert.match(html, /&lt;script&gt;alert\(&#039;escaped&#039;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\('escaped'\)<\/script>/);
});

test("validator catches score drift", async () => {
  const data = await fixture();
  data.verdict.score = 99;
  assert.ok(
    validateReport(data).some((error) =>
      error.includes("verdict.score must equal calculated score 73")
    )
  );
});

test("generator creates a standalone report", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "launchaudit-report-"));
  const output = path.join(temp, "report.html");
  const result = spawnSync(process.execPath, [generatorPath, fixturePath, output], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok((await stat(output)).size > 10000);
  assert.match(await readFile(output, "utf8"), /LaunchAudit/);
  assert.match(await readFile(output, "utf8"), /premium-progress/);
});

test("installer copies the complete skill to a custom directory", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "launchaudit-install-"));
  const result = spawnSync(
    process.execPath,
    [installerPath, "--skills-dir", temp],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  const installed = path.join(temp, "launchaudit");
  assert.ok((await stat(path.join(installed, "SKILL.md"))).isFile());
  assert.ok(
    (await stat(path.join(installed, "scripts", "generate_report.mjs"))).isFile()
  );
});
