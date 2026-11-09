// JaDE 검수 시트 표준 앱. 전 고객사가 함께 쓴다. 고객사별 값은 각 index.html 의 window.INSPECT 에만 둔다.
//   window.INSPECT = { key: "<프로젝트키>", api: "https://<worker 주소>" }
// 흐름: 테스트(정상 / 오류) → JaDE 조치 완료 → 재테스트 → 항목 검수 체크 → 모듈 검수 완료(자동)
// 시나리오와 기록은 저장 API 에서 비밀번호가 맞을 때만 받아온다. 이 파일에는 고객사 정보가 없다.
(() => {
  const VER = "6";
  const CFG = window.INSPECT || {};
  const API = String(CFG.api || "").replace(/\/$/, "") + "/api/" + CFG.key;
  const PASS_KEY = "inspect-pass:" + CFG.key;
  const NAME_KEY = "inspect-name";
  const POLL_MS = 15000;
  const ST = {
    ok: { label: "정상", cls: "ok" },
    issue: { label: "오류", cls: "issue" },
    fixed: { label: "조치 완료", cls: "fixed" },
    na: { label: "해당 없음", cls: "na" },
    "": { label: "미실행", cls: "none" },
  };
  const HIST = { ...Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, "테스트 " + v.label])), review: "검수 체크", review_off: "검수 해제" };
  const PASSING = ["ok", "na"];

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rich = s => esc(s)
    .replace(/\[\[(.+?)\]\]/g, "<mark>$1</mark>")
    .replace(/\*\*(.+?)\*\*/g, '<span class="ui">$1</span>')
    .replace(/!!(.+?)!!/g, '<span class="todo">$1</span>');
  const store = {
    get: (k, s = localStorage) => { try { return s.getItem(k) || ""; } catch (e) { return ""; } },
    set: (k, v, s = localStorage) => { try { s.setItem(k, v); } catch (e) {} },
  };

  let pass = store.get(PASS_KEY, sessionStorage);
  let name = store.get(NAME_KEY);
  let role = "client";
  let S = { mods: [], rows: [], results: {}, reviews: {}, history: {}, opinions: {} };
  let mod = "", filter = "all", pollTimer = 0;
  const drafts = {};

  // ── 서버 ──────────────────────────────────────────
  async function api(path, opts = {}) {
    const res = await fetch(API + path, { ...opts, headers: { "Content-Type": "application/json", "X-Inspect-Pass": pass } });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { const e = new Error(data.message || "비밀번호가 맞지 않습니다."); e.auth = true; throw e; }
    if (!res.ok) throw new Error(data.message || "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    return data;
  }
  const group = (list, k) => list.reduce((o, x) => ((o[x[k]] = o[x[k]] || []).push(x), o), {});

  async function load() {
    const d = await api("/sheet");
    role = d.role;
    S.mods = d.scenario.mods || [];
    S.rows = d.scenario.rows || [];
    S.results = Object.fromEntries(d.results.map(r => [r.item_id, r]));
    S.reviews = Object.fromEntries(d.reviews.map(r => [r.item_id, r]));
    S.history = group(d.history, "item_id");
    S.opinions = group(d.opinions, "item_id");
    if (!S.mods.some(m => m.id === mod)) mod = store.get("inspect-mod:" + CFG.key);
    if (!S.mods.some(m => m.id === mod)) mod = (S.mods[0] || {}).id;
  }

  // ── 입장 화면 ─────────────────────────────────────
  function gate(msg = "") {
    clearInterval(pollTimer);
    document.body.innerHTML = `
      <div class="gate"><form class="gate-card" id="gateForm">
        <div class="eyebrow">검수용 테스트 시나리오</div>
        <h1>검수 시트</h1>
        <p class="sub">안내받은 비밀번호와 본인 이름을 입력해 주세요.<br>테스트 결과, 검수, 의견에 이 이름이 함께 남습니다.</p>
        <label for="gatePass">비밀번호<input type="password" id="gatePass" autocomplete="off" required></label>
        <label for="gateName">이름<input type="text" id="gateName" maxlength="20" required value="${esc(name)}" placeholder="예: 홍길동"></label>
        <button type="submit" class="btn primary" id="gateGo">들어가기</button>
        <p class="gate-msg" id="gateMsg" role="alert">${esc(msg)}</p>
      </form></div>`;
    if (pass) $("#gatePass").value = pass;
    $(pass ? "#gateName" : "#gatePass").focus();
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
      <div class="prod-bar">운영 서버입니다. 테스트 사번(테스트1 ~ 테스트5)으로만 진행해 주세요.</div>
      <header class="top"><div class="wrap">
        <span class="brand">JaDE</span>
        <div class="tools">
          <span class="toast" id="toast" role="status"></span>
          <span class="me">${role === "jade" ? '<span class="role-jade">JaDE</span> ' : ""}검수자 <b id="meName"></b> <button type="button" class="link" id="meChange">변경</button></span>
          <button type="button" class="btn" id="copyBtn">결과 복사</button>
        </div>
      </div></header>
      <section class="hero"><div class="wrap"><div class="hero-text">
        <div class="eyebrow">검수용 테스트 시나리오</div>
        <h1>모듈별 테스트 / 검수</h1>
        <ol class="flow"><li>테스트: 항목대로 실행하고 결과를 고릅니다.</li><li>조치: 오류는 JaDE 가 고친 뒤 조치 완료로 표시합니다.</li><li>재테스트: 다시 실행해 정상으로 바꿉니다.</li><li>검수: 테스트가 정상인 항목에 검수 체크를 합니다. 모두 체크되면 모듈 검수 완료입니다.</li></ol>
      </div></div></section>
      <div class="wrap"><div class="band" id="mods" role="group" aria-label="모듈별 진행"></div></div>
      <div class="bar"><div class="wrap"><div class="tablist" role="tablist" aria-label="모듈" id="tabs"></div></div></div>
      <main class="wrap">
        <div class="mhead">
          <h2 id="modName"></h2><span class="tag" id="draftTag" hidden>시나리오 초안</span>
          <div class="filters" role="group" aria-label="항목 필터">
            <button type="button" class="fbtn" data-f="all">전체</button>
            <button type="button" class="fbtn" data-f="none">미실행</button>
            <button type="button" class="fbtn" data-f="issue">오류</button>
            <button type="button" class="fbtn" data-f="fixed">조치 완료</button>
            <button type="button" class="fbtn" data-f="wait">검수 대기</button>
          </div>
        </div>
        <div class="approve" id="approve"></div>
        <div class="prep" id="prep"></div>
        <div class="groups" id="rows"></div>
      </main>`;
    $("#meName").textContent = name;
    $("#meChange").addEventListener("click", () => gate());
    ["#mods", "#tabs"].forEach(q => $(q).addEventListener("click", e => {
      const b = e.target.closest("[data-m]"); if (b) selectMod(b.dataset.m);
    }));
    document.querySelectorAll(".fbtn").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; renderRows(); }));
    $("#rows").addEventListener("click", onRowClick);
    $("#rows").addEventListener("change", onReview);
    $("#rows").addEventListener("input", e => { if (e.target.matches("textarea[data-item]")) drafts[e.target.dataset.item] = e.target.value; });
    $("#copyBtn").addEventListener("click", copyResult);
    renderAll();
    pollTimer = setInterval(poll, POLL_MS);
  }

  function selectMod(id) { mod = id; filter = "all"; store.set("inspect-mod:" + CFG.key, id); renderAll(); }

  // ── 계산 ──────────────────────────────────────────
  const modRows = m => S.rows.filter(r => r.m === m);
  const statusOf = r => (S.results[r.id] || {}).status || "";
  const passing = r => PASSING.includes(statusOf(r));
  const reviewed = r => !!S.reviews[r.id];
  const countOf = rows => rows.reduce((c, r) => (c[statusOf(r)] = (c[statusOf(r)] || 0) + 1, c), {});
  const passOf = rows => rows.filter(passing).length;
  const reviewOf = rows => rows.filter(reviewed).length;
  const modDone = m => { const rows = modRows(m); return rows.length && reviewOf(rows) === rows.length; };
  const lastReview = m => modRows(m).map(r => S.reviews[r.id]).filter(Boolean).sort((a, b) => a.at < b.at ? 1 : -1)[0];
  const fmt = iso => { const d = new Date(iso); const p = n => String(n).padStart(2, "0"); return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

  // ── 그리기 ────────────────────────────────────────
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
  function notesHtml(note = [], risk) {
    const red = note.filter(t => t[0] === "!").map(t => t.slice(1));
    if (risk) red.unshift("운영 데이터가 바뀌는 항목입니다. JaDE 담당자와 함께 진행합니다.");
    const plain = note.filter(t => t[0] !== "!");
    const block = (items, cls, label) => items.length
      ? `<div class="notes ${cls}"><b>${label}</b><ul>${[...new Set(items)].map(t => `<li>${rich(t)}</li>`).join("")}</ul></div>` : "";
    return block(red, "red", "주의") + block(plain, "", "참고");
  }

  function testHtml(r) {
    const cur = statusOf(r), res = S.results[r.id];
    const btn = (st, key) => `<button type="button" class="rbtn" data-status="${key}" data-item="${esc(r.id)}" aria-pressed="${cur === st}">${ST[st].label}</button>`;
    const buttons = role === "jade"
      ? (cur === "issue" ? btn("fixed", "fixed") : `<div class="status-text">${ST[cur].label}</div>`)
      : btn("", "none") + btn("ok", "ok") + btn("issue", "issue");
    return `<div class="rbtns">${buttons}</div>
      ${cur === "fixed" && role !== "jade" ? '<div class="fixed-note">JaDE 조치 완료</div>' : ""}
      ${res ? `<div class="check-by">${esc(res.name)}${res.role === "jade" ? " (JaDE)" : ""}<br><time>${fmt(res.at)}</time></div>` : ""}`;
  }

  function reviewHtml(r) {
    const rv = S.reviews[r.id], ready = passing(r), can = role === "client" && ready;
    return `<label class="rv-box ${rv ? "on" : ""} ${can ? "" : "off"}" for="rv-${esc(r.id)}">
        <input type="checkbox" id="rv-${esc(r.id)}" data-review="${esc(r.id)}" ${rv ? "checked" : ""} ${can ? "" : "disabled"}>
        <span>${rv ? "검수 완료" : "검수"}</span></label>
      ${rv ? `<div class="check-by">${esc(rv.name)}<br><time>${fmt(rv.at)}</time></div>`
           : `<div class="rv-hint">${ready ? (role === "client" ? "체크해 주세요" : "고객사 검수 대기") : "테스트 정상 후"}</div>`}`;
  }

  function opinionsHtml(id) {
    return (S.opinions[id] || []).map(o => `<li class="${o.role === "jade" ? "op-jade" : ""}">${o.role === "jade" ? '<span class="role-jade">JaDE 답변</span> ' : ""}<span class="op-text">${esc(o.text)}</span> <span class="op-by">- ${esc(o.name)} <time>${fmt(o.at)}</time></span>`
      + (o.name === name && o.role === role ? ` <button type="button" class="link op-del" data-del="${o.id}" data-item="${esc(id)}">삭제</button>` : "") + `</li>`).join("");
  }

  function rowHtml(r, who) {
    const cls = reviewed(r) ? "st-reviewed" : "st-" + ST[statusOf(r)].cls;
    return `<article class="row ${cls}" data-id="${esc(r.id)}">
      <div class="who-col"><div class="name">${esc(r.n)}</div>${r.risk ? '<span class="risk">운영 영향</span>' : ""}
        <div class="place">${r.menu.map(m => { const p = m.split(" > "); const last = p.pop(); return `<div><span class="crumb">${esc(p.join(" > "))}</span><span class="chip">${esc(last)}</span></div>`; }).join("")}<span class="who">${esc(r.who || who)}</span></div></div>
      <div class="desc"><ol class="steps">${r.steps.map(t => `<li>${lineHtml(t)}</li>`).join("")}</ol>
        <div class="result"><b>기대 결과</b><span>${linesHtml(r.expect)}</span></div>${notesHtml(r.note, r.risk)}</div>
      <div class="check">${testHtml(r)}</div>
      <div class="review">${reviewHtml(r)}</div>
      <div class="opinion">
        <ul class="op-list">${opinionsHtml(r.id)}</ul>
        <div class="op-new"><textarea id="op-${esc(r.id)}" data-item="${esc(r.id)}" placeholder="${role === "jade" ? "조치 내용 / 답변을 적어 주세요" : "의견이 있으면 적어 주세요\n오류면 어떤 내용인지 적어 주세요"}">${esc(drafts[r.id] || "")}</textarea>
        <button type="button" class="btn small" data-add="${esc(r.id)}">${role === "jade" ? "답변 등록" : "의견 등록"}</button></div></div>
    </article>`;
  }

  function matches(r) {
    if (filter === "all") return true;
    if (filter === "wait") return passing(r) && !reviewed(r);
    return ST[statusOf(r)].cls === filter;
  }

  function renderRows() {
    const m = S.mods.find(x => x.id === mod) || {};
    const focus = document.activeElement && document.activeElement.id;
    const list = modRows(mod).filter(matches);
    const groups = [...new Set(list.map(r => r.g))];
    $("#rows").innerHTML = groups.length ? groups.map(g => {
      const all = modRows(mod).filter(r => r.g === g);
      return `<section><div class="gh"><h3>${esc(g)}</h3><span>테스트 ${passOf(all)} / ${all.length} · 검수 ${reviewOf(all)} / ${all.length}</span></div>
        <div class="cols"><span>항목</span><span>설명</span><span class="ctr">테스트</span><span class="ctr">검수</span><span>의견</span></div>
        ${list.filter(r => r.g === g).map(r => rowHtml(r, m.who)).join("")}</section>`;
    }).join("") : `<div class="empty">이 조건에 해당하는 항목이 없습니다.</div>`;
    document.querySelectorAll(".fbtn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === filter)));
    if (focus) { const el = document.getElementById(focus); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } }
  }

  function renderApprove() {
    const rows = modRows(mod), c = countOf(rows), n = rows.length;
    const counts = `<span class="cnt ok">정상 ${c.ok || 0}</span><span class="cnt issue">오류 ${c.issue || 0}</span><span class="cnt fixed">조치 완료 ${c.fixed || 0}</span>${c.na ? `<span class="cnt na">해당 없음 ${c.na}</span>` : ""}<span class="cnt none">미실행 ${c[""] || 0}</span>`;
    const last = lastReview(mod);
    const state = modDone(mod)
      ? `<div class="approved">모듈 검수 완료${last ? ` - 마지막 검수 ${esc(last.name)} <time>${fmt(last.at)}</time>` : ""}</div>`
      : `<div class="approve-prog"><b>테스트</b> ${passOf(rows)} / ${n}<b>검수</b> ${reviewOf(rows)} / ${n}</div>
         <span class="approve-hint">모든 항목이 검수되면 모듈 검수 완료로 바뀝니다.</span>`;
    $("#approve").innerHTML = `<div class="counts">${counts}</div><div class="approve-act">${state}</div>`;
  }

  function renderShell() {
    const m = S.mods.find(x => x.id === mod) || {};
    $("#mods").innerHTML = `<div class="sc all"><div class="sc-l">전체 검수</div><div class="sc-v"><span id="pAll">0</span><small>%</small></div><div class="trk"><i id="bAll"></i></div><div class="sc-s" id="sAll"></div></div>`
      + S.mods.map(x => `<button type="button" class="sc" data-m="${esc(x.id)}" aria-pressed="${x.id === mod}"><div class="sc-l">${esc(x.name)}${modDone(x.id) ? ' <span class="sc-done">검수 완료</span>' : ""}</div><div class="sc-v"><span data-p="${esc(x.id)}">0</span><small>%</small></div><div class="trk"><i data-b="${esc(x.id)}"></i></div><div class="sc-s" data-s="${esc(x.id)}"></div></button>`).join("");
    $("#tabs").innerHTML = S.mods.map(x => `<button type="button" class="tab" role="tab" data-m="${esc(x.id)}" aria-selected="${x.id === mod}">${esc(x.name)}<b data-c="${esc(x.id)}"></b></button>`).join("");
    $("#modName").textContent = m.name || "";
    $("#draftTag").hidden = !m.draft;
    $("#prep").innerHTML = (m.prep || []).length ? `<b>시작 전 준비</b><ul>${m.prep.map(t => `<li>${prepItem(t)}</li>`).join("")}</ul>` : "";
    $("#prep").hidden = !(m.prep || []).length;
    renderApprove();
  }

  function progress() {
    const n = S.rows.length, rv = reviewOf(S.rows), p = n ? Math.round(rv / n * 100) : 0, c = countOf(S.rows);
    $("#pAll").textContent = p; $("#bAll").style.width = p + "%";
    $("#sAll").textContent = `테스트 ${passOf(S.rows)}/${n} · 검수 ${rv}/${n}${c.issue ? ` · 오류 ${c.issue}` : ""}`;
    S.mods.forEach(x => {
      const rows = modRows(x.id), r = reviewOf(rows), t = passOf(rows), cc = countOf(rows), pp = rows.length ? Math.round(r / rows.length * 100) : 0;
      document.querySelector(`[data-p="${x.id}"]`).textContent = pp;
      document.querySelector(`[data-b="${x.id}"]`).style.width = pp + "%";
      document.querySelector(`[data-s="${x.id}"]`).textContent = `테스트 ${t}/${rows.length} · 검수 ${r}/${rows.length}${cc.issue ? ` · 오류 ${cc.issue}` : ""}`;
      document.querySelector(`[data-c="${x.id}"]`).textContent = `${r}/${rows.length}`;
    });
  }

  function renderAll() { renderShell(); renderRows(); progress(); }

  // ── 동작 ──────────────────────────────────────────
  function toast(msg) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.textContent = ""; }, 3500);
  }
  const fail = err => err.auth ? gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요.") : toast(err.message);

  async function setResult(id, status) {
    const text = (drafts[id] || "").trim();
    const sendText = status === "issue" || status === "fixed" ? text : "";
    try {
      const r = await api("/result", { method: "POST", body: JSON.stringify({ itemId: id, status, name, text: sendText }) });
      const entry = { item_id: id, status, name, role, at: r.at };
      if (status === "none") delete S.results[id]; else S.results[id] = entry;
      (S.history[id] = S.history[id] || []).push(entry);
      if (r.reviewCleared) { delete S.reviews[id]; S.history[id].push({ item_id: id, status: "review_off", name, role, at: r.at }); }
      if (sendText) { (S.opinions[id] = S.opinions[id] || []).push({ id: r.opinionId, item_id: id, name, text: sendText, at: r.at, role }); delete drafts[id]; }
      renderAll();
      toast(`${ST[status === "none" ? "" : status].label}(으)로 저장했습니다.${r.reviewCleared ? " 검수 체크가 풀렸습니다." : ""}`);
    } catch (err) { fail(err); }
  }

  async function onReview(e) {
    const cb = e.target.closest("[data-review]"); if (!cb) return;
    const id = cb.dataset.review, checked = cb.checked;
    try {
      const r = await api("/review", { method: "POST", body: JSON.stringify({ itemId: id, checked, name }) });
      if (checked) S.reviews[id] = { item_id: id, name, at: r.at }; else delete S.reviews[id];
      (S.history[id] = S.history[id] || []).push({ item_id: id, status: checked ? "review" : "review_off", name, role, at: r.at });
      renderAll();
      toast(checked ? "검수를 체크했습니다." : "검수 체크를 해제했습니다.");
    } catch (err) { cb.checked = !checked; fail(err); }
  }

  async function onRowClick(e) {
    const rb = e.target.closest("[data-status]");
    if (rb) return setResult(rb.dataset.item, rb.dataset.status);
    const add = e.target.closest("[data-add]");
    if (add) {
      const id = add.dataset.add, text = (drafts[id] || "").trim();
      if (!text) { toast("의견을 입력해 주세요."); return; }
      add.disabled = true;
      try {
        const r = await api("/opinion", { method: "POST", body: JSON.stringify({ itemId: id, text, name }) });
        (S.opinions[id] = S.opinions[id] || []).push({ id: r.id, item_id: id, name, text, at: r.at, role });
        delete drafts[id];
        renderRows();
        toast(role === "jade" ? "답변을 등록했습니다." : "의견을 등록했습니다.");
      } catch (err) { add.disabled = false; fail(err); }
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const id = del.dataset.item, oid = Number(del.dataset.del);
      if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "삭제 확인"; return; }
      try {
        await api("/opinion/" + oid, { method: "DELETE", body: JSON.stringify({ name }) });
        S.opinions[id] = (S.opinions[id] || []).filter(o => o.id !== oid);
        renderRows();
        toast("의견을 삭제했습니다.");
      } catch (err) { fail(err); }
    }
  }

  async function poll() {
    if (document.visibilityState !== "visible") return;
    try { await load(); renderAll(); }
    catch (err) { if (err.auth) gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요."); }
  }

  function copyResult() {
    const cell = s => '"' + String(s).replace(/"/g, '""') + '"';
    const head = ["모듈", "프로세스", "항목", "테스트", "테스트 입력자", "테스트 시각", "검수", "검수자", "검수 시각", "의견", "메뉴"].join("\t");
    const body = S.rows.map(r => {
      const res = S.results[r.id] || {}, rv = S.reviews[r.id], m = S.mods.find(x => x.id === r.m) || {};
      const ops = (S.opinions[r.id] || []).map(o => `${o.role === "jade" ? "[JaDE] " : ""}${o.text} - ${o.name} (${fmt(o.at)})`).join("\n");
      return [cell(m.name || ""), cell(r.g), cell(r.n), cell(ST[res.status || ""].label), cell(res.name || ""), cell(res.at ? fmt(res.at) : ""),
        rv ? "Y" : "", cell(rv ? rv.name : ""), cell(rv ? fmt(rv.at) : ""), cell(ops), cell(r.menu.join(" / "))].join("\t");
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
