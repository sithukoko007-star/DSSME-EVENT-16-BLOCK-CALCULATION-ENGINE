#!/usr/bin/env node
/**
 * Applies phase3-checkpoint-2-bundle.json to the current directory (the repository root).
 *
 *   node apply-phase3-bundle.mjs [bundle.json] [--check]
 *
 * Safety properties:
 *   - ALL-OR-NOTHING: every file is decoded and SHA-256-verified, and every precondition is checked, BEFORE anything is written.
 *   - Corruption in transit is detected per file (hash mismatch) and named; nothing is written.
 *   - Wrong base is detected: a file to be modified must still match the expected original (main 513e992) or already be the final version.
 *   - Writes only whitelisted Phase 3 paths; frozen files are never touched; no deletions; no dependencies.
 *   - Idempotent: running it again on an already-patched tree reports "already applied" and changes nothing.
 *   - --check: report the plan and exit, writing nothing.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const check = args.includes("--check");
const bundlePath = args.find((a) => !a.startsWith("--")) ?? "phase3-checkpoint-2-bundle.json";
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const die = (lines) => { console.error(lines.join("\n")); process.exit(1); };

const ALLOWED = [/^reports\/PHASE_3_[A-Za-z0-9_]+\.md$/, /^src\/engine\/blocks\/[A-Za-z0-9_]+\.ts$/, /^tests\/blocks\/(fixtures\/)?[A-Za-z0-9_]+(\.test)?\.ts$/, /^tests\/run_all_tests\.ts$/];

let bundle;
try { bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8")); }
catch (e) { die([`CANNOT READ BUNDLE "${bundlePath}": ${e.message}`, "The bundle file was damaged or truncated in transit. Re-copy the original file; nothing was written."]); }
if (bundle?.format !== "dssme-file-bundle-v1" || !Array.isArray(bundle.files)) die(["NOT A DSSME FILE BUNDLE (bad or missing 'format'/'files'). Nothing was written."]);
if (bundle.files.length !== bundle.file_count) die([`BUNDLE INCOMPLETE: declares ${bundle.file_count} files, contains ${bundle.files.length}. Nothing was written.`]);

const problems = [];
const plan = [];
for (const f of bundle.files) {
  const rel = f.path;
  if (typeof rel !== "string" || rel.includes("..") || path.isAbsolute(rel) || !ALLOWED.some((re) => re.test(rel))) { problems.push(`REFUSED path outside the Phase 3 whitelist: ${rel}`); continue; }
  let data;
  try { data = Buffer.from(Array.isArray(f.b64) ? f.b64.join("") : "", "base64"); } catch { data = Buffer.alloc(0); }
  if (data.length !== f.bytes || sha256(data) !== f.sha256) { problems.push(`CORRUPT IN TRANSIT: ${rel} (decoded ${data.length}/${f.bytes} bytes, sha256 ${sha256(data).slice(0, 12)} != ${f.sha256.slice(0, 12)})`); continue; }
  const target = path.join(process.cwd(), rel);
  const exists = fs.existsSync(target);
  const current = exists ? fs.readFileSync(target) : null;
  const curSha = current ? sha256(current) : null;
  if (curSha === f.sha256) { plan.push({ rel, action: "already applied", data, target }); continue; }
  if (f.status === "A") {
    if (exists) problems.push(`CONFLICT: ${rel} already exists with different content (expected it to be absent).`);
    else plan.push({ rel, action: "add", data, target });
  } else {
    if (!exists) problems.push(`MISSING BASE FILE: ${rel} (this bundle was built on main ${String(bundle.base_commit).slice(0, 7)}).`);
    else if (curSha !== f.base_sha256) problems.push(`WRONG BASE: ${rel} matches neither the expected original nor the final version. Wrong commit, local edits, or CRLF conversion? (expected base sha256 ${f.base_sha256.slice(0, 12)}, found ${curSha.slice(0, 12)})`);
    else plan.push({ rel, action: "modify", data, target });
  }
}
if (problems.length) die(["STOPPED - nothing was written.", ...problems.map((p) => "  - " + p)]);

for (const p of plan) console.log(`${check ? "would " : ""}${p.action.padEnd(15)} ${p.rel}`);
const todo = plan.filter((p) => p.action !== "already applied");
if (check) { console.log(`\n--check: ${todo.length} change(s) pending, ${plan.length - todo.length} already applied. Nothing written.`); process.exit(0); }
for (const p of todo) {
  fs.mkdirSync(path.dirname(p.target), { recursive: true });
  fs.writeFileSync(p.target, p.data);
  if (sha256(fs.readFileSync(p.target)) !== sha256(p.data)) die([`WRITE VERIFICATION FAILED for ${p.rel}`]);
}
console.log(`\nDONE: ${todo.length} file(s) written, ${plan.length - todo.length} already applied. Every written file re-read and SHA-256 verified.`);
console.log(`Bundle base: main ${String(bundle.base_commit).slice(0, 7)}. Now run: npm ci && npx tsc --noEmit && npm run lint:phase3 && npm test && npm run build`);
