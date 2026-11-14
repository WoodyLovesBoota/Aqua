// 회귀 게이트: tsc → lint → 렌더 계측 → 조작 흐름(데스크톱·세로) → 소크(수조) 를 차례로 돌리고 요약한다.
// usage: pnpm check:all <라벨> [baseUrl]   (SOAK=초, SKIP=matrix,soak 처럼 생략 가능) → .visual-check/step<라벨>/summary.json, 실패가 있으면 exit 1
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] ?? "all";
const base = process.argv[3];
const soakSecs = process.env.SOAK ?? "60";
const skip = new Set((process.env.SKIP ?? "").split(",").filter(Boolean));
const root = path.join(import.meta.dirname, "../..");
const outDir = path.join(root, ".visual-check", `step${label}`);
fs.mkdirSync(outDir, { recursive: true });

const steps = [
  { name: "tsc", cmd: ["npx", "tsc", "--noEmit"] },
  { name: "lint", cmd: ["pnpm", "lint"] },
  { name: "render", cmd: ["node", "scripts/visual-check/check.mjs", label, ...(base ? [base] : [])], env: { DPR: "2" } },
  { name: "flow", cmd: ["node", "scripts/visual-check/flow.mjs", label, ...(base ? [base] : [])] },
  { name: "flow-mobile", cmd: ["node", "scripts/visual-check/flow.mjs", label + "m", ...(base ? [base] : [])], env: { VW: "390", VH: "844", DPR: "2" } },
  { name: "soak-sea", cmd: ["node", "scripts/visual-check/soak.mjs", ...(base ? [base] : [])], env: { SECS: soakSecs, URL: "/lagoon" } },
];

const summary = {};
let failed = 0;
for (const s of steps) {
  if (skip.has(s.name)) { summary[s.name] = "skipped"; continue; }
  const t0 = Date.now();
  const r = spawnSync(s.cmd[0], s.cmd.slice(1), { cwd: root, env: { ...process.env, ...s.env }, encoding: "utf8" });
  const out = (r.stdout + r.stderr).split("\n").filter((l) => l && !l.includes("THREE.Clock"));
  const ok = r.status === 0;
  if (!ok) failed++;
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  let note = "";
  if (s.name === "render") {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(outDir, "metrics.json"), "utf8"));
      note = Object.entries(m).map(([k, v]) => `${k}: ${v.fps}fps draws ${v.drawsPerFrame} gpu ${v.gpuMs?.median}ms long [${v.longTasks}] console ${v.console.filter((c) => !c.includes("THREE.Clock")).length}`).join(" | ");
    } catch {}
  } else if (s.name === "tsc" || s.name === "lint") note = ok ? "" : out.slice(-3).join(" / ").slice(0, 160);
  else note = (out.find((l) => /^(soak |FLOW |sheet:)/.test(l)) ?? out.slice(-1)[0] ?? "").slice(0, 160);
  summary[s.name] = { ok, secs: Number(secs), note };
  console.log(`${ok ? "PASS" : "FAIL"} ${s.name.padEnd(12)} ${secs.padStart(4)}s  ${note}`);
  if (!ok) console.log(out.slice(-8).map((l) => "      " + l).join("\n"));
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(failed ? `\n${failed} step(s) FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
