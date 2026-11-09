// 검수 시트 저장 API (Cloudflare Worker + D1)
//
//   GET    /api/<key>/sheet              시나리오 + 체크 + 의견 전체
//   POST   /api/<key>/check              { itemId, checked, name }
//   POST   /api/<key>/opinion            { itemId, text, name }
//   DELETE /api/<key>/opinion/<id>       { name }   본인이 쓴 의견만 삭제
//
// 모든 요청은 X-Inspect-Pass 헤더의 열람 비밀번호를 확인한다.
// 시나리오는 비밀번호가 맞을 때만 내려가므로 공개 저장소에는 고객사 정보가 남지 않는다.

const ITER = 10000;           // PBKDF2 반복 횟수. 무료 플랜 CPU 한도 안에서 도는 값
const MAX_NAME = 20;
const MAX_TEXT = 2000;

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
  const m = url.pathname.match(/^\/api\/([a-z0-9-]{1,40})\/(sheet|check|opinion)(?:\/(\d+))?$/);
  if (!m) return json({ error: "not_found" }, 404);
  const [, key, what, id] = m;

  const project = await env.DB.prepare("SELECT salt, pass_hash, scenario FROM projects WHERE key = ?").bind(key).first();
  if (!project) return json({ error: "not_found" }, 404);
  const pass = req.headers.get("X-Inspect-Pass") || "";
  if (!pass || !(await verify(pass, project.salt, project.pass_hash))) {
    return json({ error: "bad_password", message: "비밀번호가 맞지 않습니다." }, 401);
  }

  if (what === "sheet" && req.method === "GET") {
    const checks = await env.DB.prepare("SELECT item_id, checked, name, at FROM checks WHERE key = ?").bind(key).all();
    const opinions = await env.DB.prepare("SELECT id, item_id, name, text, at FROM opinions WHERE key = ? ORDER BY id").bind(key).all();
    return json({ scenario: JSON.parse(project.scenario), checks: checks.results, opinions: opinions.results });
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const name = clean(body.name, MAX_NAME);
  if (!name) return json({ error: "bad_request", message: "이름을 입력해 주세요." }, 400);
  const now = new Date().toISOString();

  if (what === "check" && req.method === "POST") {
    const itemId = clean(body.itemId, 60);
    if (!itemId) return json({ error: "bad_request" }, 400);
    await env.DB.prepare(
      "INSERT INTO checks (key, item_id, checked, name, at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(key, item_id) DO UPDATE SET checked = excluded.checked, name = excluded.name, at = excluded.at"
    ).bind(key, itemId, body.checked ? 1 : 0, name, now).run();
    return json({ ok: true, at: now });
  }

  if (what === "opinion" && req.method === "POST" && !id) {
    const itemId = clean(body.itemId, 60);
    const text = String(body.text || "").trim().slice(0, MAX_TEXT);
    if (!itemId || !text) return json({ error: "bad_request", message: "의견을 입력해 주세요." }, 400);
    const r = await env.DB.prepare("INSERT INTO opinions (key, item_id, name, text, at) VALUES (?, ?, ?, ?, ?)")
      .bind(key, itemId, name, text, now).run();
    return json({ ok: true, id: r.meta.last_row_id, at: now });
  }

  if (what === "opinion" && req.method === "DELETE" && id) {
    const r = await env.DB.prepare("DELETE FROM opinions WHERE key = ? AND id = ? AND name = ?").bind(key, Number(id), name).run();
    if (!r.meta.changes) return json({ error: "forbidden", message: "본인이 쓴 의견만 지울 수 있습니다." }, 403);
    return json({ ok: true });
  }

  return json({ error: "not_found" }, 404);
}

function clean(v, max) {
  return String(v || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

async function verify(pass, saltHex, hashHex) {
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
