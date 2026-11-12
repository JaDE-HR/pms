// JaDE 검수 시트 표준 앱. 전 고객사가 함께 쓴다. 고객사별 값은 각 index.html 의 window.INSPECT 에만 둔다.
//   window.INSPECT = { key: "<프로젝트키>", api: "https://<worker 주소>" }
// 흐름: 테스트(정상 / 오류) → JaDE 조치 완료 → 재테스트 → 항목 검수 체크 → 모듈 검수 완료(자동)
// 시나리오와 기록은 저장 API 에서 비밀번호가 맞을 때만 받아온다. 이 파일에는 고객사 정보가 없다.
(() => {
  const VER = "20";
  const CFG = window.INSPECT || {};
  const API = String(CFG.api || "").replace(/\/$/, "") + "/api/" + CFG.key;
  const PASS_KEY = "inspect-pass:" + CFG.key;
  const NAME_KEY = "inspect-name";
  const POLL_MS = 15000;
  const APP = (document.currentScript && document.currentScript.src || "").replace(/[^/]*$/, "");
  const HCG = APP + "hcg.png";
  const brandHtml = () => (CFG.logo ? `<img class="cl" src="${CFG.logo}" alt="${CFG.client || ""}">` : (CFG.client ? `<b>${CFG.client}</b>` : ""))
    + (CFG.logo || CFG.client ? "<i></i>" : "") + `<img class="hcg" src="${HCG}" alt="HCG">`;
  const ST = {
    ok: { label: "정상", cls: "ok" },
    issue: { label: "오류", cls: "issue" },
    fixed: { label: "조치 완료", cls: "fixed" },
    na: { label: "해당 없음", cls: "na" },
    "": { label: "미실행", cls: "none" },
  };
  const HIST = { ...Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, "테스트 " + v.label])), review: "검수 체크", review_off: "검수 해제" };
  const PASSING = ["ok", "na"];
  const FL = { all: "전체", none: "미실행", ok: "정상", issue: "오류" };

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
    let res;
    try {
      res = await fetch(API + path, { ...opts, headers: { "Content-Type": "application/json", "X-Inspect-Pass": pass } });
    } catch (err) {
      // 브라우저 네트워크 오류(영문 메시지)는 그대로 보여주지 않는다
      const e = new Error("연결이 잠시 끊겨 저장하지 못했습니다. 다시 눌러 주세요."); e.net = true; throw e;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { const e = new Error(data.message || "비밀번호가 맞지 않습니다."); e.auth = true; throw e; }
    if (!res.ok) { const e = new Error(data.message || "저장하지 못했습니다. 화면을 새로 불러왔으니 다시 눌러 주세요."); e.stale = res.status === 400; throw e; }
    return data;
  }
  const group = (list, k) => list.reduce((o, x) => ((o[x[k]] = o[x[k]] || []).push(x), o), {});

  let seq = 0;   // 저장할 때마다 1씩 올린다. 자동 새로고침이 그 사이 받은 옛 데이터로 덮어쓰지 않게 한다
  async function load(onlyIfSeq) {
    const d = await api("/sheet");
    if (onlyIfSeq !== undefined && onlyIfSeq !== seq) return false;
    role = d.role;
    // 잠긴 모듈(lock)은 시나리오 owners 에 있는 이름으로 들어온 사람에게만 보이고, 나머지에게는 준비중으로 보인다
    const owner = (d.scenario.owners || []).includes((name || "").trim());
    S.mods = (d.scenario.mods || []).map(m => (m.lock && !owner ? { ...m, prepare: true } : m));
    const prep = new Set(S.mods.filter(m => m.prepare).map(m => m.id));
    S.rows = (d.scenario.rows || []).filter(r => !prep.has(r.m));
    S.cert = d.scenario.cert || {};
    S.results = Object.fromEntries(d.results.map(r => [r.item_id, r]));
    S.reviews = Object.fromEntries(d.reviews.map(r => [r.item_id, r]));
    S.history = group(d.history, "item_id");
    S.opinions = group(d.opinions, "item_id");
    if (!S.mods.some(m => m.id === mod)) mod = store.get("inspect-mod:" + CFG.key);
    if (!S.mods.some(m => m.id === mod)) mod = (S.mods[0] || {}).id;
    return true;
  }

  // ── 입장 화면 ─────────────────────────────────────
  function gate(msg = "") {
    clearInterval(pollTimer);
    document.body.innerHTML = `
      <div class="gate"><form class="gate-card" id="gateForm">
        <div class="gate-logo">${brandHtml()}</div>
        <h1>모듈별 검수 리스트</h1>
        <p class="gs-sub">비밀번호와 이름을 입력해 주세요.<br>테스트 결과와 의견에 이름이 함께 남습니다.</p>
        <div class="gate-fields">
          <input type="password" id="gatePass" placeholder="비밀번호" autocomplete="off" aria-label="비밀번호" required>
          <input type="text" id="gateName" maxlength="20" placeholder="이름" aria-label="이름" required value="${esc(name)}">
          <button type="submit" id="gateGo">확인</button>
        </div>
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
      <header class="top"><div class="wrap">
        <a class="brand" href="#" id="homeBtn" title="처음 화면으로">${brandHtml()}</a>
        <div class="tools">
          <span class="toast" id="toast" role="alert"></span>
          <button type="button" class="btn" id="pdfBtn">PDF 출력</button>
          <button type="button" class="btn" id="xlsBtn">엑셀 다운로드</button>
        </div>
      </div></header>
      <section class="hero"><div class="wrap"><div class="hero-text">
        <div class="eyebrow">검수용 테스트 시나리오</div>
        <h1>모듈별 검수 리스트</h1>
        <ol class="flow"><li>항목대로 실행하고 테스트 결과를 고릅니다.</li><li>오류는 HCG 프로젝트팀이 확인 후 고친 뒤 메일로 재안내하여 ${esc(CFG.client || "고객사")} 측에서 오류 항목 테스트를 재진행합니다.</li><li>테스트가 정상인 항목은 고객사와 확인 후 검수 체크 합니다.</li><li>모두 체크되면 모듈 검수 완료입니다.</li></ol>
      </div></div></section>
      <div class="wrap"><div class="band" id="mods" role="group" aria-label="모듈별 진행"></div></div>
      <div class="bar"><div class="wrap"><div class="tablist" role="tablist" aria-label="모듈" id="tabs"></div></div></div>
      <main class="wrap">
        <div class="mhead">
          <h2 id="modName"></h2><span class="due" id="modDue" hidden></span><span class="tag" id="draftTag" hidden>시나리오 초안</span>
          <div class="filters" role="group" aria-label="항목 필터">
            <button type="button" class="fbtn" data-f="all">전체</button>
            <button type="button" class="fbtn" data-f="none">미실행</button>
            <button type="button" class="fbtn" data-f="ok">정상</button>
            <button type="button" class="fbtn" data-f="issue">오류</button>
          </div>
        </div>
        <div class="approve" id="approve"></div>
        <div class="prep" id="prep"></div>
        <div class="groups" id="rows"></div>
      </main>`;
    ["#mods", "#tabs"].forEach(q => $(q).addEventListener("click", e => {
      const b = e.target.closest("[data-m]"); if (b) selectMod(b.dataset.m);
    }));
    document.querySelectorAll(".fbtn").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; renderRows(); }));
    $("#rows").addEventListener("click", onRowClick);
    $("#rows").addEventListener("change", onReview);
    $("#rows").addEventListener("input", e => { if (e.target.matches("textarea[data-item]")) drafts[e.target.dataset.item] = e.target.value; });
    $("#xlsBtn").addEventListener("click", exportXlsx);
    $("#pdfBtn").addEventListener("click", exportPdf);
    $("#homeBtn").addEventListener("click", e => { e.preventDefault(); gate(); });
    renderAll();
    pollTimer = setInterval(poll, POLL_MS);
    $("#rows").addEventListener("mouseover", vPrefetch);
    $("#rows").addEventListener("focusin", vPrefetch);
    setTimeout(vWarm, 800);
  }

  function selectMod(id) { mod = id; filter = "all"; store.set("inspect-mod:" + CFG.key, id); renderAll(); setTimeout(vWarm, 300); }

  // ── 계산 ──────────────────────────────────────────
  const modRows = m => S.rows.filter(r => r.m === m);
  const statusOf = r => (S.results[r.id] || {}).status || "";
  const passing = r => PASSING.includes(statusOf(r));
  const reviewed = r => !!S.reviews[r.id];
  const countOf = rows => rows.reduce((c, r) => (c[statusOf(r)] = (c[statusOf(r)] || 0) + 1, c), {});
  const passOf = rows => rows.filter(passing).length;
  const reviewOf = rows => rows.filter(reviewed).length;
  const modDone = m => { const rows = modRows(m); return rows.length && reviewOf(rows) === rows.length; };
  // 진척도: 테스트 정상 = 절반, 검수 체크 = 완료
  const pctOf = rows => rows.length ? Math.round(rows.reduce((s, r) => s + (reviewed(r) ? 1 : passing(r) ? .5 : 0), 0) / rows.length * 100) : 0;
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

  function nameHtml(n) {
    const m = n.match(/^(.+?) (\(.+\))$/);
    return m ? `${esc(m[1])}<span class="name-sub">${esc(m[2])}</span>` : esc(n);
  }

  function rowHtml(r, who) {
    const cls = reviewed(r) ? "st-reviewed" : "st-" + ST[statusOf(r)].cls;
    return `<article class="row ${cls}" data-id="${esc(r.id)}">
      <div class="who-col"><div class="name">${nameHtml(r.n)}</div>${r.risk ? '<span class="risk">운영 영향</span>' : ""}
        <div class="place">${r.menu.map(m => { const p = m.split(" > "); const last = p.pop(); return `<div><span class="crumb">${esc(p.join(" > "))}</span><span class="chip">${esc(last)}</span></div>`; }).join("")}<span class="who">${esc(r.who || who || "")}</span>${r.video ? `<button type="button" class="vbtn" data-video="${esc(r.video.id)}" data-t="${Number(r.video.t) || 0}"><i></i>영상 매뉴얼</button>` : ""}</div></div>
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

  // 오류 필터에는 JaDE 조치 완료(재테스트 대기)도 함께 보인다
  const inFilter = (r, f) => f === "all" || (f === "none" && !statusOf(r)) || (f === "ok" && statusOf(r) === "ok")
    || (f === "issue" && ["issue", "fixed"].includes(statusOf(r)));
  const matches = r => inFilter(r, filter);

  function renderRows() {
    const m = S.mods.find(x => x.id === mod) || {};
    if (m.prepare) { $("#rows").innerHTML = '<div class="empty prepare">준비중입니다.</div>'; return; }
    document.querySelectorAll(".fbtn").forEach(b => { b.innerHTML = `${FL[b.dataset.f]}<b>${modRows(mod).filter(r => inFilter(r, b.dataset.f)).length}</b>`; });
    const focus = document.activeElement && document.activeElement.id;
    const list = modRows(mod).filter(matches);
    const groups = [...new Set(list.map(r => r.g))];
    $("#rows").innerHTML = groups.length ? groups.map(g => {
      return `<section><div class="gh"><h3>${esc(g)}</h3></div>
        <div class="cols"><span>항목</span><span>설명</span><span class="ctr">테스트</span><span class="ctr">검수</span><span>의견</span></div>
        ${list.filter(r => r.g === g).map(r => rowHtml(r, m.who)).join("")}</section>`;
    }).join("") : `<div class="empty">이 조건에 해당하는 항목이 없습니다.</div>`;
    document.querySelectorAll(".fbtn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === filter)));
    if (focus) { const el = document.getElementById(focus); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } }
  }

  function renderApprove() {
    const m = S.mods.find(x => x.id === mod) || {}, done = !m.prepare && modDone(mod), last = lastReview(mod);
    $("#approve").hidden = !done;
    $("#approve").innerHTML = done ? `<div class="approved">모듈 검수 완료${last ? ` (마지막 검수 ${esc(last.name)} <time>${fmt(last.at)}</time>)` : ""}</div>` : "";
  }

  function renderShell() {
    const m = S.mods.find(x => x.id === mod) || {};
    // 모듈 칸은 한 번만 그리고 이후에는 숫자 / 막대만 바꾼다 (매번 다시 그리면 막대가 0부터 다시 차올라 버벅여 보인다)
    const sig = JSON.stringify(S.mods.map(x => [x.id, x.name, !!x.prepare, x.due || ""]));
    if ($("#mods").dataset.sig !== sig) {
      $("#mods").dataset.sig = sig;
      $("#mods").innerHTML = `<div class="sc all"><div class="sc-l">전체 검수</div>${S.mods.some(y => y.due && !y.prepare) ? '<div class="sc-due"></div>' : ""}<div class="sc-v"><span id="pAll">0</span><small>%</small></div><div class="trk"><i id="bAll"></i></div><div class="sc-s" id="sAll"></div></div>`
        + S.mods.map(x => `<button type="button" class="sc" data-m="${esc(x.id)}"><div class="sc-l">${esc(x.name)}${x.prepare ? "" : ` <span class="sc-done" data-done="${esc(x.id)}" hidden>검수 완료</span>`}</div>`
          + (S.mods.some(y => y.due && !y.prepare) ? `<div class="sc-due">${x.due && !x.prepare ? `(${esc(x.due)})` : ""}</div>` : "")
          + (x.prepare ? '<div class="sc-ready">준비중</div>'
            : `<div class="sc-v"><span data-p="${esc(x.id)}">0</span><small>%</small></div><div class="trk"><i data-b="${esc(x.id)}"></i></div><div class="sc-s" data-s="${esc(x.id)}"></div>`) + `</button>`).join("");
      $("#tabs").innerHTML = S.mods.map(x => `<button type="button" class="tab" role="tab" data-m="${esc(x.id)}">${esc(x.name)}${x.prepare ? "<b>준비중</b>" : `<b data-c="${esc(x.id)}"></b>`}</button>`).join("");
    }
    document.querySelectorAll("#mods [data-m]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === mod)));
    document.querySelectorAll("#tabs [data-m]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.m === mod)));
    $("#modName").textContent = m.name || "";
    $("#modDue").textContent = m.due && !m.prepare ? `(${m.due})` : ""; $("#modDue").hidden = !m.due || !!m.prepare;
    $("#draftTag").hidden = !m.draft || !!m.prepare;
    document.querySelector(".filters").hidden = !!m.prepare;
    $("#prep").innerHTML = (m.prep || []).length ? `<b>시작 전 준비</b><ul>${m.prep.map(t => `<li>${prepItem(t)}</li>`).join("")}</ul>` : "";
    $("#prep").hidden = !(m.prep || []).length || !!m.prepare;
    renderApprove();
  }

  function progress() {
    const prep = new Set(S.mods.filter(x => x.prepare).map(x => x.id));
    const live = S.rows.filter(r => !prep.has(r.m));   // 준비중 모듈은 전체 진척도에서 뺀다
    const n = live.length, rv = reviewOf(live), p = pctOf(live), c = countOf(live);
    const put = (el, prop, v) => { if (el && el[prop] !== v) el[prop] = v; };
    put($("#pAll"), "textContent", String(p)); $("#bAll").style.width = p + "%";
    put($("#sAll"), "innerHTML", `<span>테스트 ${passOf(live)}/${n}</span><span>검수 ${rv}/${n}</span>${c.issue ? `<span>오류 ${c.issue}</span>` : ""}`);
    S.mods.filter(x => !x.prepare).forEach(x => {
      const rows = modRows(x.id), r = reviewOf(rows), t = passOf(rows), cc = countOf(rows), pp = pctOf(rows);
      put(document.querySelector(`[data-p="${x.id}"]`), "textContent", String(pp));
      document.querySelector(`[data-b="${x.id}"]`).style.width = pp + "%";
      put(document.querySelector(`[data-s="${x.id}"]`), "innerHTML", `<span>테스트 ${t}/${rows.length}</span><span>검수 ${r}/${rows.length}</span>${cc.issue ? `<span>오류 ${cc.issue}</span>` : ""}`);
      put(document.querySelector(`[data-c="${x.id}"]`), "textContent", `${r}/${rows.length}`);
      document.querySelector(`[data-done="${x.id}"]`).hidden = !modDone(x.id);
    });
    document.querySelectorAll(".fbtn").forEach(b => put(b, "innerHTML", `${FL[b.dataset.f]}<b>${modRows(mod).filter(r => inFilter(r, b.dataset.f)).length}</b>`));
    renderApprove();
  }

  function renderAll() { renderShell(); renderRows(); progress(); }

  // 항목 하나만 다시 그린다 (스크롤 / 입력 중인 의견 유지)
  function refreshRow(id) {
    const r = S.rows.find(x => x.id === id), el = document.querySelector(`.row[data-id="${CSS.escape(id)}"]`);
    if (r && el) {
      if (matches(r)) {
        const m = S.mods.find(x => x.id === mod) || {}, t = document.createElement("div");
        t.innerHTML = rowHtml(r, m.who).trim();
        el.replaceWith(t.firstChild);
      } else el.remove();
    }
    progress();
  }

  // ── 동작 ──────────────────────────────────────────
  function toast(msg) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.textContent = ""; }, 3500);
  }
  // 실패하면 서버 기준으로 다시 불러와 화면을 맞춘다
  const resync = () => { const s0 = seq; load(s0).then(ok => ok && renderAll()).catch(() => {}); };
  const fail = err => {
    if (err.auth) return gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요.");
    toast(err.message);
    resync();
  };

  // 누르는 즉시 화면(버튼 / 진척도)에 반영하고, 저장은 뒤에서 한다. 성공 알림은 띄우지 않는다
  let busy = 0;
  async function setResult(id, status) {
    const text = (drafts[id] || "").trim();
    const sendText = status === "issue" || status === "fixed" ? text : "";
    const prevRes = S.results[id], prevRv = S.reviews[id];
    if ((prevRes ? prevRes.status : "none") === status && !sendText) return;
    if (status === "none") delete S.results[id]; else S.results[id] = { item_id: id, status, name, role, at: new Date().toISOString() };
    if (prevRv) delete S.reviews[id];
    refreshRow(id);
    busy++; seq++;
    try {
      const r = await api("/result", { method: "POST", body: JSON.stringify({ itemId: id, status, name, text: sendText }) });
      const entry = { item_id: id, status, name, role, at: r.at };
      if (status === "none") delete S.results[id]; else S.results[id] = entry;
      (S.history[id] = S.history[id] || []).push(entry);
      if (r.reviewCleared) S.history[id].push({ item_id: id, status: "review_off", name, role, at: r.at });
      else if (prevRv && r.unchanged) S.reviews[id] = prevRv;
      if (sendText) { (S.opinions[id] = S.opinions[id] || []).push({ id: r.opinionId, item_id: id, name, text: sendText, at: r.at, role }); delete drafts[id]; }
      refreshRow(id);
    } catch (err) {
      if (prevRes) S.results[id] = prevRes; else delete S.results[id];
      if (prevRv) S.reviews[id] = prevRv;
      refreshRow(id);
      fail(err);
    } finally { busy--; }
  }

  async function onReview(e) {
    const cb = e.target.closest("[data-review]"); if (!cb) return;
    const id = cb.dataset.review, checked = cb.checked, prev = S.reviews[id];
    if (checked) S.reviews[id] = { item_id: id, name, at: new Date().toISOString() }; else delete S.reviews[id];
    refreshRow(id);
    busy++; seq++;
    try {
      const r = await api("/review", { method: "POST", body: JSON.stringify({ itemId: id, checked, name }) });
      if (checked) S.reviews[id] = { item_id: id, name, at: r.at }; else delete S.reviews[id];
      (S.history[id] = S.history[id] || []).push({ item_id: id, status: checked ? "review" : "review_off", name, role, at: r.at });
      refreshRow(id);
    } catch (err) {
      if (prev) S.reviews[id] = prev; else delete S.reviews[id];
      refreshRow(id);
      fail(err);
    } finally { busy--; }
  }

  async function onRowClick(e) {
    const vb = e.target.closest("[data-video]");
    if (vb) return openVideo(vb.dataset.video, Number(vb.dataset.t) || 0);
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
        seq++; refreshRow(id);
      } catch (err) { add.disabled = false; fail(err); }
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const id = del.dataset.item, oid = Number(del.dataset.del);
      if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "삭제 확인"; return; }
      try {
        await api("/opinion/" + oid, { method: "DELETE", body: JSON.stringify({ name }) });
        seq++; S.opinions[id] = (S.opinions[id] || []).filter(o => o.id !== oid);
        refreshRow(id);
      } catch (err) { fail(err); }
    }
  }

  // 다른 사람이 바꾼 내용만 반영한다. 저장 중이거나 바뀐 게 없으면 다시 그리지 않는다
  const sigOf = () => JSON.stringify([S.rows.map(r => r.id + r.n + r.steps.length), S.results, S.reviews, S.opinions]);
  async function poll() {
    if (document.visibilityState !== "visible" || busy) return;
    const before = sigOf(), s0 = seq;
    try {
      if (!await load(s0)) return;   // 받는 사이 누군가 저장했으면 버린다
      if (!busy && sigOf() !== before) { renderShell(); renderRows(); progress(); }
    } catch (err) { if (err.auth) gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요."); }
  }

  // ── 엑셀 (A4 가로) ────────────────────────────────
  const XLS_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
  const loadXls = () => window.ExcelJS ? Promise.resolve(window.ExcelJS) : new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = XLS_URL;
    s.onload = () => ok(window.ExcelJS);
    s.onerror = () => no(new Error("엑셀 도구를 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요."));
    document.head.appendChild(s);
  });
  const plain = s => String(s || "").replace(/\[\[(.+?)\]\]/g, "$1").replace(/\*\*(.+?)\*\*/g, "$1").replace(/!!(.+?)!!/g, "$1");
  const dw = s => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? 1.8 : 1), 0);   // 한글은 약 두 칸
  const linesIn = (text, width) => String(text || "").split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(dw(l) / (width - 2))), 0);
  const ymd = (d, sep) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join(sep);

  async function exportXlsx() {
    const btn = $("#xlsBtn"); btn.disabled = true;
    try {
      const ExcelJS = await loadXls();
      const wb = new ExcelJS.Workbook();
      const FONT = "맑은 고딕", now = new Date(), SZ = 9;
      const F = (extra = {}) => ({ name: FONT, size: SZ, ...extra });
      const BOLD = F({ bold: true }), GRAY = F({ color: { argb: "FF6B7683" } }), RED = F({ color: { argb: "FFE00000" } });
      const line = { style: "thin", color: { argb: "FFA6A6A6" } };
      const box = { top: line, left: line, bottom: line, right: line };
      const fill = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
      const rt = parts => ({ richText: parts.filter(p => p && p.text).map(p => ({ text: p.text, font: p.font || F() })) });
      const txt = v => v && v.richText ? v.richText.map(x => x.text).join("") : String(v == null ? "" : v);
      const page = ws => {
        ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
          margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.45, header: 0.2, footer: 0.2 } };
        ws.headerFooter = { oddFooter: "&C&P / &N" };
      };
      const client = CFG.client || CFG.key;
      const stamp = `${ymd(now, ".")} ${String(now.getHours()).padStart(2, "0")}시 ${String(now.getMinutes()).padStart(2, "0")}분 출력`;
      const live = S.mods.filter(m => !m.prepare);

      // 검수 시나리오 (한 시트에 모듈별로 이어 붙인다)
      const ws = wb.addWorksheet("검수 시나리오");
      const HEAD = ["프로세스", "항목", "테스트", "검수", "대상자", "메뉴", "설명", "참고", "의견"];
      const W = [13, 16, 10, 10, 9, 27, 58, 30, 26];
      ws.columns = W.map(width => ({ width }));
      const CENTER = [1, 2, 3, 4, 5];
      live.forEach((m, mi) => {
        const rows = modRows(m.id), c = countOf(rows);
        if (mi) { ws.addRow([]); ws.lastRow.height = 12; }
        const tr = ws.addRow([`검수용 테스트 시나리오 - ${m.name}`]);
        tr.height = 28; tr.getCell(1).font = F({ size: 15, bold: true }); tr.getCell(1).alignment = { vertical: "middle" };
        if (mi) ws.getRow(tr.number - 1).addPageBreak();
        const sr = ws.addRow([`${stamp}    진척도 ${pctOf(rows)}%    테스트 정상 ${passOf(rows)}/${rows.length}    검수 ${reviewOf(rows)}/${rows.length}    오류 ${(c.issue || 0) + (c.fixed || 0)}`]);
        sr.height = 16; sr.getCell(1).font = GRAY;
        const hr = ws.addRow(HEAD); hr.height = 22;
        hr.eachCell(cell => Object.assign(cell, { font: BOLD, fill: fill("FFF2F2F2"), border: box, alignment: { vertical: "middle", horizontal: "center" } }));
        [...new Set(rows.map(r => r.g))].forEach(g => {
          const first = ws.rowCount + 1;
          rows.filter(r => r.g === g).forEach(r => {
            const res = S.results[r.id], rv = S.reviews[r.id], st = statusOf(r);
            const steps = r.steps.map((s, i) => { const [h, ...sub] = plain(s).split("\n"); return `${i + 1}. ${h}` + sub.map(x => `\n    - ${x}`).join(""); }).join("\n");
            const desc = rt([{ text: steps }, { text: "\n\n기대 결과", font: BOLD }, { text: "\n" + plain(r.expect) }]);
            const notes = [...(r.risk ? [{ text: "* 운영 영향", font: RED }] : []),
              ...(r.note || []).map(t => t[0] === "!" ? { text: "* " + plain(t.slice(1)), font: RED } : { text: "* " + plain(t) })];
            const note = rt(notes.map((n, i) => ({ ...n, text: (i ? "\n" : "") + n.text })));
            const test = res ? rt([{ text: ST[st].label, font: st === "issue" ? F({ bold: true, color: { argb: "FFE00000" } }) : BOLD },
              { text: `\n${res.name}${res.role === "jade" ? " (JaDE)" : ""}\n${fmt(res.at)}`, font: GRAY }]) : "미실행";
            const review = rv ? rt([{ text: "검수 완료", font: BOLD }, { text: `\n${rv.name}\n${fmt(rv.at)}`, font: GRAY }]) : "";
            const ops = (S.opinions[r.id] || []).map(o => `${o.role === "jade" ? "[JaDE 답변] " : ""}${o.text} - ${o.name} ${fmt(o.at)}`).join("\n");
            const vals = [g, plain(r.n), test, review, r.who || m.who || "", r.menu.map(x => plain(x).replace(/ > /g, ">")).join("\n"), desc, note, ops];
            const row = ws.addRow(vals);
            // 인쇄(A4 맞춤)에서는 엑셀 자동 맞춤도 1 ~ 2줄 모자라서 한 줄 17.5pt로 넉넉히 잡는다
            row.height = Math.min(409, Math.max(2, ...vals.map((v, i) => i ? linesIn(txt(v), W[i]) : 1)) * 17.5 + 8);
            const tbg = st === "issue" ? "FFFFF3F3" : st === "fixed" ? "FFFFFCF2" : PASSING.includes(st) ? "FFF2F8FF" : null;
            row.eachCell({ includeEmpty: true }, (cell, i) => {
              cell.border = box;
              cell.alignment = { vertical: "middle", horizontal: CENTER.includes(i) ? "center" : "left", wrapText: true };
              if (typeof cell.value === "string") cell.font = F();
              if (i === 3 && tbg) cell.fill = fill(tbg);
              if (i === 4 && rv) cell.fill = fill("FFF2F8FF");
            });
          });
          if (ws.rowCount > first) ws.mergeCells(first, 1, ws.rowCount, 1);
        });
      });
      page(ws);

      // 요약
      const sum = wb.addWorksheet("요약");
      sum.columns = [{ width: 18 }, { width: 10 }, { width: 13 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }];
      const t1 = sum.addRow([`${client} 모듈별 검수 현황`]); t1.height = 28; t1.getCell(1).font = F({ size: 15, bold: true });
      sum.addRow([stamp]).getCell(1).font = GRAY;
      const sh = sum.addRow(["모듈", "항목", "테스트 정상", "검수", "오류", "미실행", "진척도"]); sh.height = 22;
      sh.eachCell(cell => Object.assign(cell, { font: BOLD, fill: fill("FFF2F2F2"), border: box, alignment: { vertical: "middle", horizontal: "center" } }));
      const sumRow = (vals, bold) => {
        const r = sum.addRow(vals); r.height = 20;
        r.eachCell({ includeEmpty: true }, (cell, i) => Object.assign(cell, { font: bold ? BOLD : F(), border: box,
          alignment: { vertical: "middle", horizontal: i === 1 ? "left" : "center" }, fill: bold ? fill("FFF2F2F2") : undefined }));
      };
      S.mods.forEach(m => {
        if (m.prepare) return sumRow([m.name, "준비중", "", "", "", "", ""]);
        const rows = modRows(m.id), c = countOf(rows);
        sumRow([m.name, rows.length, passOf(rows), reviewOf(rows), (c.issue || 0) + (c.fixed || 0), c[""] || 0, pctOf(rows) + "%"]);
      });
      const all = S.rows, ca = countOf(all);
      sumRow(["전체", all.length, passOf(all), reviewOf(all), (ca.issue || 0) + (ca.fixed || 0), ca[""] || 0, pctOf(all) + "%"], true);
      page(sum);

      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url; link.download = `${client}_모듈별_검수리스트_${ymd(now, "")}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) { toast(err.message || "엑셀을 만들지 못했습니다."); }
    finally { btn.disabled = false; }
  }

  // ── PDF 출력 (A4 가로): 1장 검수확인서 + 모듈별 시나리오 목록. 인쇄 창에서 "PDF로 저장"을 고른다 ──
  function exportPdf() {
    const btn = $("#pdfBtn"); btn.disabled = true;
    try {
      const now = new Date(), C = S.cert || {}, client = CFG.client || CFG.key;
      const live = S.mods.filter(m => !m.prepare);
      const e = x => esc(String(x == null ? "" : x));
      const nl = x => e(x).replace(/\n/g, "<br>");
      const certRows = live.map(m => {
        const rows = modRows(m.id), c = countOf(rows);
        return `<tr><td class="l b">${e(m.name)}</td><td>${rows.length}</td><td>${passOf(rows)}</td><td>${(c.issue || 0) + (c.fixed || 0)}</td>
          <td>${reviewOf(rows)}</td><td class="sign"></td><td class="sign"></td><td class="sign"></td></tr>`;
      }).join("");
      const cert = `<section class="cert">
        <h1>검 수 확 인 서</h1>
        <table class="info">
          <tr><th>프로젝트명</th><td>${e(C.project || "")}</td><th>고객사</th><td>${e(C.client || client)}</td></tr>
          <tr><th>프로젝트 기간</th><td>${e(C.period || "")}</td><th>수행사</th><td>${e(C.vendor || "")}</td></tr>
          <tr><th>검수 모듈</th><td colspan="3">${live.map(m => e(m.name)).join(", ")}</td></tr>
          <tr><th>검수 내용</th><td colspan="3">위 모듈에 대하여 검수용 테스트 시나리오에 따라 테스트를 진행하였으며, 테스트 결과와 검수 내역을 확인합니다.<br>
            모듈별 상세 내역은 첨부한 검수 시나리오 목록과 같습니다.</td></tr>
        </table>
        <table class="grid">
          <thead><tr><th style="width:15%">모듈</th><th style="width:9%">검수 항목</th><th style="width:9%">테스트 정상</th><th style="width:7%">오류</th>
            <th style="width:9%">검수 완료</th><th style="width:17%">검수확인자 (성명)</th><th style="width:17%">서명</th><th style="width:17%">확인일자</th></tr></thead>
          <tbody>${certRows}</tbody>
        </table>
        <p class="date">${now.getFullYear()}년 &nbsp;&nbsp;&nbsp;&nbsp; 월 &nbsp;&nbsp;&nbsp;&nbsp; 일</p>
      </section>`;
      const lists = live.map(m => {
        const rows = modRows(m.id);
        const body = rows.map((r, i) => {
          const res = S.results[r.id], rv = S.reviews[r.id], st = statusOf(r);
          const steps = r.steps.map((x, k) => `${k + 1}. ${nl(plain(x))}`).join("<br>");
          const ops = (S.opinions[r.id] || []).map(o => `${o.role === "jade" ? "[JaDE] " : ""}${nl(o.text)}<span class="g"> - ${e(o.name)} ${e(fmt(o.at))}</span>`).join("<br>");
          return `<tr><td>${i + 1}</td><td class="l">${e(r.g)}</td><td class="l b">${e(plain(r.n))}</td>
            <td class="l">${r.menu.map(x => e(plain(x))).join("<br>")}</td>
            <td class="l">${steps}<div class="exp"><b>기대 결과</b><br>${nl(plain(r.expect))}</div></td>
            <td class="${st === "issue" ? "red" : ""}"><b>${e(ST[st].label)}</b>${res ? `<br><span class="g">${e(res.name)}<br>${e(fmt(res.at))}</span>` : ""}</td>
            <td>${rv ? `<b>검수 완료</b><br><span class="g">${e(rv.name)}<br>${e(fmt(rv.at))}</span>` : ""}</td>
            <td class="l">${ops}</td></tr>`;
        }).join("");
        return `<section class="list"><h2>검수 시나리오 - ${e(m.name)}</h2>
          <p class="sub">테스트 정상 ${passOf(rows)}/${rows.length} &nbsp;/&nbsp; 검수 ${reviewOf(rows)}/${rows.length}</p>
          <table class="grid list-t"><thead><tr><th style="width:3%">No</th><th style="width:10%">프로세스</th><th style="width:11%">항목</th><th style="width:13%">메뉴</th>
            <th style="width:33%">설명</th><th style="width:8%">테스트</th><th style="width:8%">검수</th><th style="width:14%">의견</th></tr></thead>
          <tbody>${body}</tbody></table></section>`;
      }).join("");
      const css = `@page{size:A4 landscape;margin:10mm 9mm 11mm}
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{margin:0;font-family:'Noto Sans KR','맑은 고딕',sans-serif;color:#222;font-size:8.5pt;line-height:1.45}
        .cert{page-break-after:always;padding:6mm 4mm 0}
        h1{text-align:center;font-size:22pt;letter-spacing:4pt;margin:0 0 9mm}
        h2{font-size:12pt;margin:0 0 1mm}
        .sub{color:#666;margin:0 0 2mm}
        table{width:100%;border-collapse:collapse;table-layout:fixed}
        .info{margin-bottom:7mm;font-size:10pt}
        .info th{width:14%;background:#f2f2f2;text-align:left}
        .info th,.info td{border:1px solid #9a9a9a;padding:2.2mm 3mm;vertical-align:middle}
        .grid th{background:#f2f2f2;font-weight:700}
        .grid th,.grid td{border:1px solid #9a9a9a;padding:1.4mm 1.6mm;text-align:center;vertical-align:middle;word-break:keep-all;overflow-wrap:anywhere}
        .cert .grid{font-size:10pt}.cert .grid td{height:15mm}
        .l{text-align:left!important}.b{font-weight:700}.g{color:#777}.red b{color:#d00}
        .exp{margin-top:1.2mm}
        .date{text-align:right;margin-top:10mm;font-size:11pt}
        .list{page-break-before:auto}.list+.list{page-break-before:always}
        .list-t thead{display:table-header-group}.list-t tr{page-break-inside:avoid}`;
      const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${e(client)}_검수확인서_${ymd(now, "")}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap"><style>${css}</style></head>
        <body>${cert}${lists}</body></html>`;
      const f = document.createElement("iframe");
      f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
      const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 60000); btn.disabled = false; } };
      (f.contentDocument.fonts ? f.contentDocument.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 400));
    } catch (err) { toast(err.message || "PDF를 만들지 못했습니다."); btn.disabled = false; }
  }

  // ── 영상 매뉴얼 (암호화된 영상을 로그인한 비밀번호로 풀어서 재생) ──
  // <키>/inspect/videos/videos.json: 영상 키를 비밀번호별로 잠근 것 + 영상 목록(제목 / 목차). 영상 파일(.bin)은 AES-256-GCM.
  // 만드는 법: python inspect/tools/pack_video.py <키> <영상ID> <mp4> --title ... --chapters "초=제목|..."
  const VDIR = String(CFG.videos || "videos/").replace(/\/?$/, "/");
  const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const vcache = {}, vpend = {};
  let vman = null, vkey = null, vkeyPass = "";
  async function videoKey() {
    if (!vman) { const r = await fetch(VDIR + "videos.json", { cache: "no-store" }); if (!r.ok) throw new Error("영상 목록을 불러오지 못했습니다."); vman = await r.json(); }
    if (vkey && vkeyPass === pass) return vkey;
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    for (const k of vman.keys) {
      try {
        const kek = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: ub64(k.salt), iterations: k.iter }, base,
          { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ub64(k.iv), additionalData: new TextEncoder().encode("jvid-key") }, kek, ub64(k.wk));
        vkey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]); vkeyPass = pass;
        return vkey;
      } catch (e) { /* 다른 비밀번호용 잠금 */ }
    }
    throw new Error("이 비밀번호로는 영상을 열 수 없습니다.");
  }
  // DC형 영상 매뉴얼 팝업(c2608010_rt_pen_manual_p01.jsp, A안 다크)과 같은 모양:
  // 어두운 틀 / 왼쪽 영상(16:9, 약 77%) / 오른쪽 목차(번호 원, 누르면 그 시간으로, 재생 위치에 맞춰 강조) / 아래 편 전환
  function closeVideo() {
    const m = $("#vmodal"); if (!m) return;
    const v = m.querySelector("video"); if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
    m.remove(); document.removeEventListener("keydown", vEsc); document.body.style.overflow = "";
  }
  const vEsc = e => { if (e.key === "Escape") closeVideo(); };
  const vFmt = t => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(Math.floor(t % 60)).padStart(2, "0");
  const vLen = d => `${Math.floor(d / 60)}분 ${Math.round(d % 60)}초`;
  async function openVideo(id, t) {
    closeVideo();
    document.body.insertAdjacentHTML("beforeend", `<div class="vmodal" id="vmodal" role="dialog" aria-modal="true" aria-label="영상 매뉴얼">
      <div class="vpanel"><div class="vbar"><b>영상 매뉴얼</b><button type="button" class="vx" id="vx" aria-label="닫기"></button></div>
      <div class="vmIn"><div class="vmHead"><span class="vmTit" id="vmTitle"></span><small id="vmSub"></small></div>
      <div class="vmBody"><div class="vmVideo"><video id="vplayer" controls playsinline preload="auto"></video><div class="vload" id="vload">영상을 불러오는 중입니다</div></div>
      <div class="vmSide"><div class="vmChap" id="vmChap"><b>목차</b></div><div class="vmEps" id="vmEps"></div></div></div></div></div></div>`);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", vEsc);
    $("#vx").addEventListener("click", closeVideo);
    $("#vmodal").addEventListener("click", e => { if (e.target.id === "vmodal") closeVideo(); });
    $("#vplayer").addEventListener("timeupdate", vMark);
    try {
      await videoKey();
      await vLoad(id, t);
    } catch (err) { const l = $("#vload"); if (l) { l.hidden = false; l.textContent = err.message || "영상을 열지 못했습니다."; } }
  }
  let vCur = null;
  function vChapters(meta) {
    return (meta.chapters || []).map(([s, label]) => { const m = String(label).match(/^(STEP\s*\d+)\s*(.*)$/); return { t: s, step: m ? m[1] : label, name: m ? m[2] : "" }; });
  }
  async function vLoad(id, t) {
    const meta = vman.videos[id];
    if (!meta || !meta.file) throw new Error("영상이 아직 등록되지 않았습니다.");
    vCur = id;
    const v = $("#vplayer"), grp = (vman.groups || {})[meta.group];
    const eps = grp ? grp.eps : [{ id, name: meta.title }];
    const n = eps.findIndex(e => e.id === id) + 1;
    $("#vmTitle").textContent = meta.title;
    $("#vmSub").textContent = (n ? n + "편 / " : "") + (meta.length || "");
    const chs = vChapters(meta);
    $("#vmChap").innerHTML = "<b>목차</b>" + chs.map((c, i) =>
      `<button type="button" data-i="${i}" data-s="${c.t}"><i>${i + 1}</i><div><em>${esc(c.step)}</em><span>${esc(c.name)}${c.name ? " / " : ""}${vFmt(c.t)}</span></div></button>`).join("");
    $("#vmChap").onclick = e => { const b = e.target.closest("[data-s]"); if (b) { v.currentTime = Number(b.dataset.s); v.play().catch(() => {}); vMark(); } };
    $("#vmEps").innerHTML = grp ? eps.map((e, i) => { const ok = vman.videos[e.id] && vman.videos[e.id].file;
      return `<button type="button" data-ep="${esc(e.id)}" class="${e.id === id ? "on" : ""}" ${ok ? "" : "disabled"}>${i + 1}편 ${esc(e.name)}${ok ? "" : " (준비중)"}</button>`; }).join("") : "";
    $("#vmEps").onclick = e => { const b = e.target.closest("[data-ep]"); if (b && !b.disabled && b.dataset.ep !== vCur) vLoad(b.dataset.ep, 0).catch(err => { $("#vload").hidden = false; $("#vload").textContent = err.message; }); };
    $("#vload").hidden = false; $("#vload").textContent = "영상을 불러오는 중입니다";
    v.pause();
    const url = await vFetch(id);
    if (!$("#vmodal") || vCur !== id) return;
    v.src = url;
    v.addEventListener("loadedmetadata", () => {
      if (!meta.length) $("#vmSub").textContent = (n ? n + "편 / " : "") + vLen(v.duration);
      v.currentTime = t || 0; v.play().catch(() => {}); vMark();
    }, { once: true });
    // 재생이 실제로 시작될 때까지 "불러오는 중" 을 유지한다 (검은 화면이 보이지 않게)
    v.addEventListener("playing", () => { const l = $("#vload"); if (l) l.hidden = true; }, { once: true });
    setTimeout(() => { const l = $("#vload"); if (l && vCur === id && v.readyState >= 2) l.hidden = true; }, 2500);
  }
  // 영상 파일 받기 + 풀기. 같은 영상은 한 번만 (미리 받기와 버튼 클릭이 같은 작업을 같이 기다린다)
  // 영상을 다시 올리면 파일이 바뀌므로 주소에 버전(iv)을 붙여 브라우저 캐시의 옛 파일을 쓰지 않는다. 그래도 풀리지 않으면 한 번 새로 받는다
  function vFetch(id) {
    if (vcache[id]) return Promise.resolve(vcache[id]);
    if (vpend[id]) return vpend[id];
    vpend[id] = (async () => {
      await videoKey();
      const meta = vman.videos[id];
      if (!meta || !meta.file) throw new Error("영상이 아직 등록되지 않았습니다.");
      const src = VDIR + meta.file + "?v=" + encodeURIComponent(meta.iv);
      const open = async init => {
        const r = await fetch(src, init); if (!r.ok) throw new Error("영상을 불러오지 못했습니다.");
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: ub64(meta.iv), additionalData: new TextEncoder().encode(id) }, vkey, await r.arrayBuffer());
      };
      let plain;
      try { plain = await open({}); } catch (e) { plain = await open({ cache: "reload" }); }
      vcache[id] = URL.createObjectURL(new Blob([plain], { type: "video/mp4" }));
      return vcache[id];
    })();
    vpend[id].catch(() => { delete vpend[id]; });
    return vpend[id];
  }
  // 로그인 / 모듈 이동 뒤: 열쇠를 미리 계산하고, 지금 모듈의 영상을 하나씩 미리 받아 둔다 (버튼을 누르면 바로 재생)
  async function vWarm() {
    const ids = [...new Set(S.rows.filter(r => r.m === mod && r.video).map(r => r.video.id))];
    if (!ids.length) return;
    try { await videoKey(); for (const id of ids) await vFetch(id); } catch (e) { /* 미리 받기는 실패해도 조용히 넘어간다 */ }
  }
  // 버튼에 마우스를 올리면 미리 받기 시작
  function vPrefetch(e) {
    const b = e.target.closest && e.target.closest("[data-video]");
    if (b) vFetch(b.dataset.video).catch(() => {});
  }
  function vMark() {
    const v = $("#vplayer"), meta = vman && vman.videos[vCur]; if (!v || !meta) return;
    let cur = 0; vChapters(meta).forEach((c, i) => { if ((v.currentTime || 0) >= c.t - 0.2) cur = i; });
    document.querySelectorAll("#vmChap button").forEach(b => b.classList.toggle("on", +b.dataset.i === cur));
  }

  // ── 시작 ──────────────────────────────────────────
  // 새로고침하거나 로고를 누르면 항상 로그인 화면부터 (이름 / 비밀번호는 미리 채워 둔다)
  if (!CFG.key || !CFG.api) { document.body.textContent = "검수 시트 설정(window.INSPECT)이 없습니다."; return; }
  gate();
  window.__INSPECT_VER = VER;
})();
