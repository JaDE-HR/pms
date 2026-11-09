// 검수 시트 저장 API (Cloudflare Worker + D1)
//
//   GET    /api/<key>/sheet                 시나리오 + 결과 + 이력 + 의견 + 검수 + 내 역할
//   POST   /api/<key>/result                { itemId, status, name, text? }
//   POST   /api/<key>/opinion               { itemId, text, name }
//   DELETE /api/<key>/opinion/<id>          { name }   본인이 쓴 의견만
//   POST   /api/<key>/approve               { modId, name }   고객사: 모듈 검수 완료
//   DELETE /api/<key>/approve/<modId>       { name }   JaDE: 검수 취소
//
// X-Inspect-Pass 헤더로 역할을 정한다. 고객사 비밀번호면 client, JaDE 비밀번호면 jade.
//   client: 정상 / 문제 있음(의견 필수) / 해당 없음, 모듈 검수 완료
//   jade:   조치 완료(문제 있음 항목만), 답변, 검수 취소
// 검수 완료된 모듈의 결과는 바꿀 수 없다. 시나리오는 비밀번호가 맞을 때만 내려간다.

const ITER = 10000;           // PBKDF2 반복 횟수. 무료 플랜 CPU 한도 안에서 도는 값
const MAX_NAME = 20;
const MAX_TEXT = 2000;
const CLIENT_STATUS = ["ok", "issue", "na"];
const PASSING = ["ok", "na"];

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(req, env);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      return json({ error: "server", message: "처리 중 오류가 났습니다." }, 500, cors);
    }
  },
};

async function route(req, env) {
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/api\/([a-z0-9-]{1,40})\/(sheet|result|opinion|approve)(?:\/([a-z0-9-]{1,40}))?$/);
  if (!m) return json({ error: "not_found" }, 404);
  const [, key, what, sub] = m;

  const project = await env.DB.prepare(
    "SELECT salt, pass_hash, admin_salt, admin_hash, scenario FROM projects WHERE key = ?").bind(key).first();
  if (!project) return json({ error: "not_found" }, 404);
  const pass = req.headers.get("X-Inspect-Pass") || "";
  let role = null;
  if (pass && await verify(pass, project.salt, project.pass_hash)) role = "client";
  else if (pass && project.admin_hash && await verify(pass, project.admin_salt, project.admin_hash)) role = "jade";
  if (!role) return json({ error: "bad_password", message: "비밀번호가 맞지 않습니다." }, 401);

  const scenario = JSON.parse(project.scenario);
  const DB = env.DB;

  if (what === "sheet" && req.method === "GET") {
    const [results, history, opinions, approvals] = await DB.batch([
      DB.prepare("SELECT item_id, status, name, role, at FROM results WHERE key = ?").bind(key),
      DB.prepare("SELECT item_id, status, name, role, at FROM history WHERE key = ? ORDER BY id").bind(key),
      DB.prepare("SELECT id, item_id, name, text, at, role FROM opinions WHERE key = ? ORDER BY id").bind(key),
      DB.prepare("SELECT mod_id, name, at FROM approvals WHERE key = ?").bind(key),
    ]);
    return json({ role, scenario, results: results.results, history: history.results, opinions: opinions.results, approvals: approvals.results });
  }

  const body = await req.json().catch(() => ({}));
  const name = clean(body.name, MAX_NAME);
  if (!name) return json({ error: "bad_request", message: "이름을 입력해 주세요." }, 400);
  const now = new Date().toISOString();
  const approved = async modId => !!(await DB.prepare("SELECT 1 FROM approvals WHERE key = ? AND mod_id = ?").bind(key, modId).first());

  if (what === "result" && req.method === "POST") {
    const row = scenario.rows.find(r => r.id === body.itemId);
    if (!row) return json({ error: "bad_request" }, 400);
    if (await approved(row.m)) return json({ error: "locked", message: "검수 완료된 모듈은 결과를 바꿀 수 없습니다." }, 423);
    const status = String(body.status || "");
    const text = String(body.text || "").trim().slice(0, MAX_TEXT);
    if (role === "client" && !CLIENT_STATUS.includes(status)) return json({ error: "forbidden", message: "선택할 수 없는 결과입니다." }, 403);
    if (role === "jade") {
      if (status !== "fixed") return json({ error: "forbidden", message: "JaDE 는 조치 완료만 표시할 수 있습니다." }, 403);
      const cur = await DB.prepare("SELECT status FROM results WHERE key = ? AND item_id = ?").bind(key, row.id).first();
      if (!cur || cur.status !== "issue") return json({ error: "bad_request", message: "문제 있음 항목만 조치 완료로 바꿀 수 있습니다." }, 400);
    }
    if (status === "issue" && !text) return json({ error: "bad_request", message: "무엇이 달랐는지 의견을 적어 주세요." }, 400);
    const stmts = [
      DB.prepare("INSERT INTO results (key, item_id, status, name, role, at) VALUES (?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(key, item_id) DO UPDATE SET status = excluded.status, name = excluded.name, role = excluded.role, at = excluded.at")
        .bind(key, row.id, status, name, role, now),
      DB.prepare("INSERT INTO history (key, item_id, status, name, role, at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(key, row.id, status, name, role, now),
    ];
    if (text) stmts.push(DB.prepare("INSERT INTO opinions (key, item_id, name, text, at, role) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(key, row.id, name, text, now, role));
    const out = await DB.batch(stmts);
    return json({ ok: true, at: now, opinionId: text ? out[2].meta.last_row_id : null });
  }

  if (what === "opinion" && req.method === "POST" && !sub) {
    const row = scenario.rows.find(r => r.id === body.itemId);
    const text = String(body.text || "").trim().slice(0, MAX_TEXT);
    if (!row || !text) return json({ error: "bad_request", message: "의견을 입력해 주세요." }, 400);
    const r = await DB.prepare("INSERT INTO opinions (key, item_id, name, text, at, role) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(key, row.id, name, text, now, role).run();
    return json({ ok: true, id: r.meta.last_row_id, at: now });
  }

  if (what === "opinion" && req.method === "DELETE" && /^\d+$/.test(sub || "")) {
    const r = await DB.prepare("DELETE FROM opinions WHERE key = ? AND id = ? AND name = ? AND role = ?")
      .bind(key, Number(sub), name, role).run();
    if (!r.meta.changes) return json({ error: "forbidden", message: "본인이 쓴 의견만 지울 수 있습니다." }, 403);
    return json({ ok: true });
  }

  if (what === "approve" && req.method === "POST") {
    if (role !== "client") return json({ error: "forbidden", message: "검수 완료는 고객사 담당자가 합니다." }, 403);
    const modId = String(body.modId || "");
    const rows = scenario.rows.filter(r => r.m === modId);
    if (!rows.length) return json({ error: "bad_request" }, 400);
    const res = await DB.prepare("SELECT item_id, status FROM results WHERE key = ?").bind(key).all();
    const st = Object.fromEntries(res.results.map(r => [r.item_id, r.status]));
    const left = rows.filter(r => !PASSING.includes(st[r.id])).length;
    if (left) return json({ error: "not_ready", message: `정상 / 해당 없음이 아닌 항목이 ${left}개 남아 있습니다.` }, 409);
    await DB.prepare("INSERT INTO approvals (key, mod_id, name, at) VALUES (?, ?, ?, ?) ON CONFLICT(key, mod_id) DO NOTHING")
      .bind(key, modId, name, now).run();
    return json({ ok: true, at: now });
  }

  if (what === "approve" && req.method === "DELETE" && sub) {
    if (role !== "jade") return json({ error: "forbidden", message: "검수 취소는 JaDE 담당자만 할 수 있습니다." }, 403);
    await DB.prepare("DELETE FROM approvals WHERE key = ? AND mod_id = ?").bind(key, sub).run();
    return json({ ok: true });
  }

  return json({ error: "not_found" }, 404);
}

function clean(v, max) {
  return String(v || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

async function verify(pass, saltHex, hashHex) {
  if (!saltHex || !hashHex) return false;
  const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: ITER }, keyMat, 256);
  const got = new Uint8Array(bits), want = hexToBytes(hashHex);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return ok ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Inspect-Pass",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  } : { "Vary": "Origin" };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}
