// 검수 시트 시나리오와 열람 비밀번호를 저장 API(D1)에 올린다.
//
//   node inspect/tools/push.mjs <프로젝트키>                     시나리오만 갱신 (체크 / 의견은 유지)
//   node inspect/tools/push.mjs <프로젝트키> --pass-file <경로>   처음 올릴 때 / 비밀번호를 바꿀 때
//
// 시나리오 원본: <프로젝트키>/inspect/scenario.local.json  (커밋되지 않음)
// 비밀번호 파일: 한 줄짜리 텍스트. 읽은 뒤 화면에 출력하지 않는다. 해시만 저장한다.
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORKER = join(ROOT, "inspect", "worker");
const ITER = 10000;   // worker/src/index.js 와 같아야 한다

const [key, flag, passFile] = process.argv.slice(2);
if (!key || !/^[a-z0-9-]{1,40}$/.test(key)) {
  console.log("사용법: node inspect/tools/push.mjs <프로젝트키> [--pass-file <경로>]");
  process.exit(1);
}
const scenarioPath = join(ROOT, key, "inspect", "scenario.local.json");
if (!existsSync(scenarioPath)) { console.log("시나리오 파일이 없습니다:", scenarioPath); process.exit(1); }
const scenario = JSON.stringify(JSON.parse(readFileSync(scenarioPath, "utf8")));
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const now = new Date().toISOString();

let sql;
if (flag === "--pass-file") {
  const pass = readFileSync(passFile, "utf8").replace(/[\r\n]+$/, "");
  if (pass.length < 6) { console.log("비밀번호는 6자 이상이어야 합니다."); process.exit(1); }
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pass, salt, ITER, 32, "sha256").toString("hex");
  sql = `INSERT INTO projects (key, salt, pass_hash, scenario, updated_at) VALUES (${q(key)}, ${q(salt.toString("hex"))}, ${q(hash)}, ${q(scenario)}, ${q(now)})
ON CONFLICT(key) DO UPDATE SET salt = excluded.salt, pass_hash = excluded.pass_hash, scenario = excluded.scenario, updated_at = excluded.updated_at;`;
} else {
  sql = `UPDATE projects SET scenario = ${q(scenario)}, updated_at = ${q(now)} WHERE key = ${q(key)};`;
}

const tmp = join(tmpdir(), `inspect-${key}-${Date.now()}.sql`);
writeFileSync(tmp, sql, "utf8");
try {
  const out = execFileSync("npx", ["--yes", "wrangler@4.20.0", "d1", "execute", "jade-inspect", "--remote", "--file", tmp, "--json"],
    { cwd: WORKER, encoding: "utf8", shell: process.platform === "win32" });
  const res = JSON.parse(out.slice(out.indexOf("[")));
  const changes = res[0]?.meta?.changes ?? 0;
  if (!changes) { console.log("올라간 행이 없습니다. 처음이라면 --pass-file 로 비밀번호를 함께 지정하세요."); process.exit(1); }
  console.log(`${key}: 시나리오 ${JSON.parse(scenario).rows.length}개 항목을 올렸습니다.${flag ? " 비밀번호도 새로 설정했습니다." : ""}`);
} finally {
  unlinkSync(tmp);
}
