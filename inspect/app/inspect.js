// JaDE 검수 시트 표준 앱. 전 고객사가 함께 쓴다. 고객사별 값은 각 index.html 의 window.INSPECT 에만 둔다.
//   window.INSPECT = { key: "<프로젝트키>", api: "https://<worker 주소>" }
// 시나리오와 기록은 저장 API 에서 비밀번호가 맞을 때만 받아온다. 이 파일에는 고객사 정보가 없다.
(() => {
  const VER = "1";
  const CFG = window.INSPECT || {};
  const API = String(CFG.api || "").replace(/\/$/, "") + "/api/" + CFG.key;
  const PASS_KEY = "inspect-pass:" + CFG.key;
  const NAME_KEY = "inspect-name";
  const POLL_MS = 15000;

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rich = s => esc(s)
    .replace(/\[\[(.+?)\]\]/g, "<mark>$1</mark>")
    .replace(/\*\*(.+?)\*\*/g, '<span class="ui">$1</span>')
    .replace(/!!(.+?)!!/g, '<span class="todo">$1</span>');
  const store = {
    get: (k, s = localStorage) => { try { return s.getItem(k) || ""; } catch (e) { return ""; } },
    set: (k, v, s = localStorage) => { try { s.setItem(k, v); } catch (e) {} },
    del: (k, s = localStorage) => { try { s.removeItem(k); } catch (e) {} },
  };

  let pass = store.get(PASS_KEY, sessionStorage);
  let name = store.get(NAME_KEY);
  let S = { mods: [], rows: [], checks: {}, opinions: {} };
  let mod = "", filter = "all", pollTimer = 0;
  const drafts = {};

  // ── 서버 ──────────────────────────────────────────
  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts, headers: { "Content-Type": "application/json", "X-Inspect-Pass": pass },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { const e = new Error(data.message || "비밀번호가 맞지 않습니다."); e.auth = true; throw e; }
    if (!res.ok) throw new Error(data.message || "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    return data;
  }

  async function load() {
    const d = await api("/sheet");
    S.mods = d.scenario.mods || [];
    S.rows = d.scenario.rows || [];
    S.checks = {};
    d.checks.forEach(c => { S.checks[c.item_id] = c; });
    S.opinions = {};
    d.opinions.forEach(o => { (S.opinions[o.item_id] = S.opinions[o.item_id] || []).push(o); });
    if (!S.mods.some(m => m.id === mod)) mod = store.get("inspect-mod:" + CFG.key) || (S.mods[0] || {}).id;
    if (!S.mods.some(m => m.id === mod)) mod = (S.mods[0] || {}).id;
  }

  // ── 입장 화면 ─────────────────────────────────────
  function gate(msg = "") {
    clearInterval(pollTimer);
    document.body.innerHTML = `
      <div class="gate"><form class="gate-card" id="gateForm">
        <div class="eyebrow">검수용 테스트 시나리오</div>
        <h1>검수 시트</h1>
        <p class="sub">안내받은 비밀번호와 본인 이름을 입력해 주세요.<br>체크와 의견에 이 이름이 함께 남습니다.</p>
        <label for="gatePass">비밀번호<input type="password" id="gatePass" autocomplete="off" required></label>
        <label for="gateName">이름<input type="text" id="gateName" maxlength="20" required value="${esc(name)}" placeholder="예: 홍길동"></label>
        <button type="submit" class="btn primary" id="gateGo">들어가기</button>
        <p class="gate-msg" id="gateMsg" role="alert">${esc(msg)}</p>
      </form></div>`;
    $(pass ? "#gateName" : "#gatePass").focus();
    if (pass) $("#gatePass").value = pass;
    $("#gateForm").addEventListener("submit", async e => {
      e.preventDefault();
      pass = $("#gatePass").value;
      name = $("#gateName").value.trim();
      if (!name) return;
      $("#gateGo").disabled = true;
      $("#gateMsg").textContent = "";
      try {
        await load();
        store.set(PASS_KEY, pass, sessionStorage);
        store.set(NAME_KEY, name);
        start();
      } catch (err) {
        $("#gateGo").disabled = false;
        $("#gateMsg").textContent = err.auth ? "비밀번호가 맞지 않습니다." : "연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
      }
    });
  }

  // ── 화면 틀 ───────────────────────────────────────
  function start() {
    document.body.innerHTML = `
      <header class="top"><div class="wrap">
        <span class="brand">JaDE</span>
        <div class="tools">
          <span class="toast" id="toast" role="status"></span>
          <span class="me">검수자 <b id="meName"></b> <button type="button" class="link" id="meChange">변경</button></span>
          <button type="button" class="btn" id="copyBtn">결과 복사</button>
        </div>
      </div></header>
      <section class="hero"><div class="wrap"><div class="hero-text">
        <div class="eyebrow">검수용 테스트 시나리오</div>
        <h1>모듈별 검수</h1>
        <p class="sub">설명대로 실행한 뒤 확인에 체크해 주세요.<br>다르게 동작하면 의견을 남겨 주세요. <mark>노란 표시</mark>는 예시 값입니다.</p>
      </div></div></section>
      <div class="wrap"><div class="band" id="mods" role="group" aria-label="모듈별 진척도"></div></div>
      <div class="bar"><div class="wrap"><div class="tablist" role="tablist" aria-label="모듈" id="tabs"></div></div></div>
      <main class="wrap">
        <div class="mhead">
          <h2 id="modName"></h2><span class="tag" id="draftTag" hidden>시나리오 초안</span>
          <div class="filters" role="group" aria-label="항목 필터">
            <button type="button" class="fbtn" data-f="all">전체</button>
            <button type="button" class="fbtn" data-f="open">미확인</button>
            <button type="button" class="fbtn" data-f="done">확인 완료</button>
          </div>
        </div>
        <div class="prep" id="prep"></div>
        <div class="groups" id="rows"></div>
      </main>`;
    $("#meName").textContent = name;
    $("#meChange").addEventListener("click", () => gate());
    ["#mods", "#tabs"].forEach(q => $(q).addEventListener("click", e => {
      const b = e.target.closest("[data-m]"); if (b) selectMod(b.dataset.m);
    }));
    document.querySelectorAll(".fbtn").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; renderRows(); }));
    $("#rows").addEventListener("change", onCheck);
    $("#rows").addEventListener("click", onRowClick);
    $("#rows").addEventListener("input", e => { if (e.target.matches("textarea[data-item]")) drafts[e.target.dataset.item] = e.target.value; });
    $("#copyBtn").addEventListener("click", copyResult);
    renderAll();
    pollTimer = setInterval(poll, POLL_MS);
  }

  function selectMod(id) { mod = id; filter = "all"; store.set("inspect-mod:" + CFG.key, id); renderAll(); }

  // ── 그리기 ────────────────────────────────────────
  const modRows = m => S.rows.filter(r => r.m === m);
  const isDone = r => !!(S.checks[r.id] && S.checks[r.id].checked);
  const doneOf = rows => rows.filter(isDone).length;
  const fmt = iso => { const d = new Date(iso); const p = n => String(n).padStart(2, "0"); return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

  function lineHtml(t) {
    const [head, ...lines] = t.split("\n");
    return rich(head) + (lines.length ? `<ul class="sub">${lines.map(l => `<li>${rich(l)}</li>`).join("")}</ul>` : "");
  }
  const linesHtml = t => t.split("\n").map(rich).join("<br>");
  function prepItem(t) {
    if (!t.includes("\n")) t = t.replace(": ", "\n");
    const [head, ...lines] = t.split("\n");
    return `<div class="ph">${rich(head)}</div>${lines.map(l => `<div>${rich(l)}</div>`).join("")}`;
  }
  function notesHtml(note = []) {
    const red = note.filter(t => t[0] === "!").map(t => t.slice(1));
    const plain = note.filter(t => t[0] !== "!");
    const block = (items, cls, label) => items.length
      ? `<div class="notes ${cls}"><b>${label}</b><ul>${items.map(t => `<li>${rich(t)}</li>`).join("")}</ul></div>` : "";
    return block(red, "red", "주의") + block(plain, "", "참고");
  }
  function opinionsHtml(id) {
    return (S.opinions[id] || []).map(o => `<li><span class="op-text">${esc(o.text)}</span> <span class="op-by">- ${esc(o.name)} <time>${fmt(o.at)}</time></span>`
      + (o.name === name ? ` <button type="button" class="link op-del" data-del="${o.id}" data-item="${esc(id)}">삭제</button>` : "") + `</li>`).join("");
  }

  function rowHtml(r, who) {
    const c = S.checks[r.id], on = isDone(r);
    return `<article class="row ${on ? "done" : ""}" data-id="${esc(r.id)}">
      <div class="who-col"><div class="name">${esc(r.n)}</div>
        <div class="place">${r.menu.map(m => { const p = m.split(" > "); const last = p.pop(); return `<div><span class="crumb">${esc(p.join(" > "))}</span><span class="chip">${esc(last)}</span></div>`; }).join("")}<span class="who">${esc(r.who || who)}</span></div></div>
      <div class="desc"><ol class="steps">${r.steps.map(t => `<li>${lineHtml(t)}</li>`).join("")}</ol>
        <div class="result"><b>기대 결과</b><span>${linesHtml(r.expect)}</span></div>${notesHtml(r.note)}</div>
      <div class="check"><label class="lbl" for="chk-${esc(r.id)}">확인</label><input type="checkbox" id="chk-${esc(r.id)}" data-item="${esc(r.id)}" ${on ? "checked" : ""}>
        ${c ? `<div class="check-by">${on ? "" : "해제 "}${esc(c.name)}<br><time>${fmt(c.at)}</time></div>` : ""}</div>
      <div class="opinion"><label class="lbl" for="op-${esc(r.id)}">의견</label>
        <ul class="op-list">${opinionsHtml(r.id)}</ul>
        <div class="op-new"><textarea id="op-${esc(r.id)}" data-item="${esc(r.id)}" placeholder="의견이 있으면 적어 주세요">${esc(drafts[r.id] || "")}</textarea>
        <button type="button" class="btn small" data-add="${esc(r.id)}">의견 등록</button></div></div>
    </article>`;
  }

  function renderRows() {
    const m = S.mods.find(x => x.id === mod) || {};
    const focus = document.activeElement && document.activeElement.id;
    const list = modRows(mod).filter(r => filter === "all" || (filter === "done") === isDone(r));
    const groups = [...new Set(list.map(r => r.g))];
    $("#rows").innerHTML = groups.length ? groups.map(g => {
      const all = modRows(mod).filter(r => r.g === g);
      return `<section><div class="gh"><h3>${esc(g)}</h3><span>${doneOf(all)} / ${all.length}</span></div>
        <div class="cols"><span>항목</span><span>설명</span><span class="ctr">확인</span><span>의견</span></div>
        ${list.filter(r => r.g === g).map(r => rowHtml(r, m.who)).join("")}</section>`;
    }).join("") : `<div class="empty">${filter === "open" ? "이 모듈에 남은 미확인 항목이 없습니다." : "이 모듈에 아직 확인한 항목이 없습니다."}</div>`;
    document.querySelectorAll(".fbtn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === filter)));
    if (focus) { const el = document.getElementById(focus); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } }
  }

  function renderShell() {
    const m = S.mods.find(x => x.id === mod) || {};
    $("#mods").innerHTML = `<div class="sc all"><div class="sc-l">전체 모듈 진척도</div><div class="sc-v"><span id="pAll">0</span><small>%</small></div><div class="trk"><i id="bAll"></i></div><div class="sc-s" id="sAll"></div></div>`
      + S.mods.map(x => `<button type="button" class="sc" data-m="${esc(x.id)}" aria-pressed="${x.id === mod}"><div class="sc-l">${esc(x.name)}</div><div class="sc-v"><span data-p="${esc(x.id)}">0</span><small>%</small></div><div class="trk"><i data-b="${esc(x.id)}"></i></div><div class="sc-s" data-s="${esc(x.id)}"></div></button>`).join("");
    $("#tabs").innerHTML = S.mods.map(x => `<button type="button" class="tab" role="tab" data-m="${esc(x.id)}" aria-selected="${x.id === mod}">${esc(x.name)}<b data-c="${esc(x.id)}"></b></button>`).join("");
    $("#modName").textContent = m.name || "";
    $("#draftTag").hidden = !m.draft;
    $("#prep").innerHTML = (m.prep || []).length ? `<b>시작 전 준비</b><ul>${m.prep.map(t => `<li>${prepItem(t)}</li>`).join("")}</ul>` : "";
    $("#prep").hidden = !(m.prep || []).length;
  }

  function progress() {
    const set = (k, rows) => {
      const d = doneOf(rows), p = rows.length ? Math.round(d / rows.length * 100) : 0;
      return [d, p];
    };
    const [dAll, pAll] = set("all", S.rows);
    $("#pAll").textContent = pAll; $("#bAll").style.width = pAll + "%";
    $("#sAll").textContent = `${S.rows.length}개 중 ${dAll}개 확인`;
    S.mods.forEach(x => {
      const rows = modRows(x.id), [d, p] = set(x.id, rows);
      document.querySelector(`[data-p="${x.id}"]`).textContent = p;
      document.querySelector(`[data-b="${x.id}"]`).style.width = p + "%";
      document.querySelector(`[data-s="${x.id}"]`).textContent = `${rows.length}개 중 ${d}개 확인`;
      document.querySelector(`[data-c="${x.id}"]`).textContent = `${d}/${rows.length}`;
    });
  }

  function renderAll() { renderShell(); renderRows(); progress(); }

  // ── 동작 ──────────────────────────────────────────
  function toast(msg) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.textContent = ""; }, 3000);
  }

  async function onCheck(e) {
    if (e.target.type !== "checkbox" || !e.target.dataset.item) return;
    const id = e.target.dataset.item, checked = e.target.checked, prev = S.checks[id];
    S.checks[id] = { item_id: id, checked: checked ? 1 : 0, name, at: new Date().toISOString() };
    renderRows(); progress();
    try {
      const r = await api("/check", { method: "POST", body: JSON.stringify({ itemId: id, checked, name }) });
      S.checks[id].at = r.at;
      toast(checked ? "확인을 저장했습니다." : "확인을 해제했습니다.");
    } catch (err) {
      if (prev) S.checks[id] = prev; else delete S.checks[id];
      renderRows(); progress();
      if (err.auth) return gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요.");
      toast(err.message);
    }
  }

  async function onRowClick(e) {
    const add = e.target.closest("[data-add]");
    const del = e.target.closest("[data-del]");
    if (add) {
      const id = add.dataset.add, text = (drafts[id] || "").trim();
      if (!text) { toast("의견을 입력해 주세요."); return; }
      add.disabled = true;
      try {
        const r = await api("/opinion", { method: "POST", body: JSON.stringify({ itemId: id, text, name }) });
        (S.opinions[id] = S.opinions[id] || []).push({ id: r.id, item_id: id, name, text, at: r.at });
        delete drafts[id];
        renderRows();
        toast("의견을 등록했습니다.");
      } catch (err) {
        add.disabled = false;
        if (err.auth) return gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요.");
        toast(err.message);
      }
    }
    if (del) {
      const id = del.dataset.item, oid = Number(del.dataset.del);
      if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "삭제 확인"; return; }
      try {
        await api("/opinion/" + oid, { method: "DELETE", body: JSON.stringify({ name }) });
        S.opinions[id] = (S.opinions[id] || []).filter(o => o.id !== oid);
        renderRows();
        toast("의견을 삭제했습니다.");
      } catch (err) {
        if (err.auth) return gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요.");
        toast(err.message);
      }
    }
  }

  async function poll() {
    if (document.visibilityState !== "visible") return;
    try { await load(); renderShell(); renderRows(); progress(); }
    catch (err) { if (err.auth) gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요."); }
  }

  function copyResult() {
    const cell = s => '"' + String(s).replace(/"/g, '""') + '"';
    const head = ["모듈", "프로세스", "항목", "확인", "확인자", "확인 시각", "의견", "메뉴"].join("\t");
    const body = S.rows.map(r => {
      const c = S.checks[r.id] || {}, m = S.mods.find(x => x.id === r.m) || {};
      const ops = (S.opinions[r.id] || []).map(o => `${o.text} - ${o.name} (${fmt(o.at)})`).join("\n");
      return [cell(m.name || ""), cell(r.g), cell(r.n), c.checked ? "Y" : "", cell(c.checked ? c.name : ""), cell(c.checked ? fmt(c.at) : ""), cell(ops), cell(r.menu.join(" / "))].join("\t");
    });
    navigator.clipboard.writeText([head, ...body].join("\n"))
      .then(() => toast("복사했습니다. 엑셀에 붙여넣으세요."))
      .catch(() => toast("복사하지 못했습니다. 브라우저 권한을 확인해 주세요."));
  }

  // ── 시작 ──────────────────────────────────────────
  if (!CFG.key || !CFG.api) { document.body.textContent = "검수 시트 설정(window.INSPECT)이 없습니다."; return; }
  if (pass && name) load().then(start).catch(err => gate(err.auth ? "" : "연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요."));
  else gate();
  window.__INSPECT_VER = VER;
})();
