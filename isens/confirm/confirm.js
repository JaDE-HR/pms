// 추가개발 검수 확인 — 요건별 담당자가 「확인」을 누르고, 그 기록으로 검수확인서를 출력한다.
//   window.CONFIRM = { key, api, client, logo }
// 목록과 확인 기록은 저장 API 에서 비밀번호가 맞을 때만 받아온다. 이 파일에는 고객사 자료가 없다.
(() => {
  const CFG = window.CONFIRM || {};
  const API = String(CFG.api || "").replace(/\/$/, "") + "/api/" + CFG.key;
  const PASS_KEY = "confirm-pass:" + CFG.key, NAME_KEY = "confirm-name";
  const POLL_MS = 30000;
  const HCG = "hcg.png";

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get: (k, s = localStorage) => { try { return s.getItem(k) || ""; } catch (e) { return ""; } },
    set: (k, v, s = localStorage) => { try { s.setItem(k, v); } catch (e) {} },
  };
  const brand = () => (CFG.logo ? `<img class="cl" src="${esc(CFG.logo)}" alt="${esc(CFG.client || "")}">` : `<b>${esc(CFG.client || "")}</b>`)
    + `<i></i><img class="hcg" src="${HCG}" alt="HCG">`;
  const p2 = n => String(n).padStart(2, "0");
  const fmt = iso => { const d = new Date(iso); return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };

  let pass = store.get(PASS_KEY, sessionStorage), name = store.get(NAME_KEY);
  let S = { sheet: { items: [], cert: {} }, confirms: {} };
  let filter = "", pollTimer = 0, seq = 0, busy = false;

  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(API + path, { ...opts, headers: { "Content-Type": "application/json", "X-Confirm-Pass": pass } });
    } catch (err) {
      const e = new Error("연결이 잠시 끊겼습니다. 다시 눌러 주세요."); e.net = true; throw e;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { const e = new Error(data.message || "비밀번호가 맞지 않습니다."); e.auth = true; throw e; }
    if (!res.ok) throw new Error(data.message || "저장하지 못했습니다. 화면을 새로 불러온 뒤 다시 눌러 주세요.");
    return data;
  }

  async function load(onlyIfSeq) {
    const d = await api("/sheet");
    if (onlyIfSeq !== undefined && onlyIfSeq !== seq) return false;
    S.sheet = d.sheet || { items: [] };
    S.confirms = Object.fromEntries((d.confirms || []).map(c => [c.item_id, c]));
    return true;
  }

  // ── 담당 ─────────────────────────────────────────
  const ownerNames = it => String(it.owner || "").split("·").map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
  const isMine = it => {
    const me = String(name || "").replace(/\s+/g, "");
    return me.length >= 2 && ownerNames(it).some(b => me.includes(b) || b.includes(me));
  };

  // ── 입장 ─────────────────────────────────────────
  function gate(msg = "") {
    clearInterval(pollTimer);
    document.body.innerHTML = `
      <div class="gate"><form class="gate-card" id="gf">
        <div class="brand">${brand()}</div>
        <h1>추가개발 검수 확인</h1>
        <p>비밀번호와 이름을 입력해 주세요.<br>확인 기록에 이름이 남습니다.</p>
        <input type="password" id="gp" placeholder="비밀번호" autocomplete="off" aria-label="비밀번호" required>
        <input type="text" id="gn" maxlength="20" placeholder="이름" aria-label="이름" required value="${esc(name)}">
        <button type="submit" id="gb">확인</button>
        <div class="gate-msg" id="gm" role="alert">${esc(msg)}</div>
      </form></div>`;
    if (pass) $("#gp").value = pass;
    $(pass ? "#gn" : "#gp").focus();
    $("#gf").addEventListener("submit", async e => {
      e.preventDefault();
      pass = $("#gp").value; name = $("#gn").value.trim();
      if (!name) return;
      $("#gb").disabled = true; $("#gm").textContent = "";
      try {
        await load();
        store.set(PASS_KEY, pass, sessionStorage); store.set(NAME_KEY, name);
        filter = S.sheet.items.some(isMine) ? "mine" : "all";
        start();
      } catch (err) {
        $("#gb").disabled = false;
        $("#gm").textContent = err.auth ? "비밀번호가 맞지 않습니다."
          : location.protocol === "file:" ? "파일로 열면 서버에 연결되지 않습니다. 인터넷 주소(https://…)로 열어 주세요."
          : "연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
      }
    });
  }

  // ── 화면 ─────────────────────────────────────────
  function start() {
    document.body.innerHTML = `
      <header class="top"><div class="wrap">
        <div class="brand">${brand()}</div>
        <div class="tools"><span class="toast" id="toast" role="status"></span>
          <span class="me">${esc(name)} 님</span>
          <button type="button" class="btn" id="out">나가기</button>
          <button type="button" class="btn primary" id="pdf">검수확인서 출력</button></div>
      </div></header>
      <main class="wrap">
        <section class="hero">
          <h1>추가개발 검수 확인</h1>
          <p>담당하신 요건의 개발 결과를 확인하셨으면 <b>확인</b>을 눌러 주세요. 개발완료보고서는 각 요건의 <b>보기</b>에서 열립니다.</p>
          <div class="sum">
            <div><div class="lab">확인</div><div class="big" id="cnt"></div></div>
            <div class="bar-w"><div class="lab" id="cntSub"></div><div class="trk"><i id="trk"></i></div></div>
          </div>
        </section>
        <div class="filters" role="group" aria-label="보기" id="flt"></div>
        <div id="rows"></div>
        <p class="foot" id="foot"></p>
      </main>`;
    $("#out").addEventListener("click", () => { pass = ""; store.set(PASS_KEY, "", sessionStorage); gate(); });
    $("#pdf").addEventListener("click", printCert);
    $("#flt").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (b) { filter = b.dataset.f; render(); } });
    $("#rows").addEventListener("click", onClick);
    render();
    pollTimer = setInterval(poll, POLL_MS);
  }

  const items = () => S.sheet.items || [];
  const done = it => !!S.confirms[it.id];
  const FL = [["mine", "내 담당", isMine], ["all", "전체", () => true], ["todo", "미확인", it => it.ready && !done(it)], ["done", "확인", done]];

  function render() {
    const all = items(), n = all.length, c = all.filter(done).length;
    $("#cnt").innerHTML = `${c}<small>/ ${n}건</small>`;
    $("#cntSub").textContent = `확인할 수 있는 요건 ${all.filter(x => x.ready).length}건 · 개발 진행 중 ${all.filter(x => !x.ready).length}건`;
    $("#trk").style.width = (n ? Math.round(c / n * 100) : 0) + "%";
    const fl = FL.filter(([k, , f]) => k !== "mine" || all.some(f));
    if (!fl.some(([k]) => k === filter)) filter = "all";
    $("#flt").innerHTML = fl.map(([k, label, f]) => `<button type="button" class="fbtn" data-f="${k}" aria-pressed="${k === filter}">${label}<b>${all.filter(f).length}</b></button>`).join("");
    const pick = (FL.find(([k]) => k === filter) || FL[1])[2];
    const list = all.filter(pick);
    const groups = [...new Set(list.map(x => x.g))];
    $("#rows").innerHTML = groups.length ? groups.map(g => `<section class="grp"><h2>${esc(g)}</h2>
      <table class="list"><thead><tr><th class="c-no">No.</th><th>요건</th><th class="c-own">담당</th><th class="c-rep">개발완료보고서</th><th class="c-ok">검수 확인</th></tr></thead>
      <tbody>${list.filter(x => x.g === g).map(rowHtml).join("")}</tbody></table></section>`).join("")
      : `<div class="empty">해당하는 요건이 없습니다.</div>`;
    $("#foot").textContent = `${S.sheet.source || ""} · 화면은 ${POLL_MS / 1000}초마다 새로 고칩니다.`;
  }

  function rowHtml(it) {
    const c = S.confirms[it.id];
    const ok = !it.ready ? `<span class="wait">개발 진행 중</span>`
      : `<button type="button" class="ck ${c ? "on" : ""}" data-id="${esc(it.id)}">${c ? "✓ 확인됨" : "확인"}</button>`
        + (c ? `<div class="by">${esc(c.name)}<br>${esc(fmt(c.at))}</div>` : "");
    return `<tr class="${c ? "done" : ""} ${isMine(it) ? "mine" : ""}">
      <td class="c-no">${esc(it.no)}</td>
      <td><div class="nm">${esc(it.name)}</div>${it.desc ? `<div class="ds">${esc(it.desc)}</div>` : ""}</td>
      <td class="c-own">${esc(it.owner || "—")}</td>
      <td class="c-rep">${it.report ? `<a href="${esc(it.report)}" target="_blank" rel="noopener">보기</a>` : "—"}</td>
      <td class="c-ok">${ok}</td></tr>`;
  }

  async function onClick(e) {
    const b = e.target.closest(".ck"); if (!b || busy) return;
    const it = items().find(x => x.id === b.dataset.id); if (!it) return;
    const on = !done(it);
    if (!on && !confirm(`「${it.name}」 확인을 취소할까요?`)) return;
    if (on && it.owner && !isMine(it) && !confirm(`담당이 ${it.owner} 님인 요건입니다.\n${name} 님 이름으로 확인할까요?`)) return;
    busy = true; b.disabled = true; seq++;
    try {
      const r = await api("/confirm", { method: "POST", body: JSON.stringify({ itemId: it.id, checked: on, name }) });
      if (on) S.confirms[it.id] = { item_id: it.id, name, at: r.at }; else delete S.confirms[it.id];
      toast(on ? "확인했습니다." : "확인을 취소했습니다.");
      render();
    } catch (err) {
      if (err.auth) return gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요.");
      toast(err.message);
      try { await load(); } catch (_) {}
      render();
    } finally { busy = false; }
  }

  async function poll() {
    if (document.hidden || busy) return;
    try { if (await load(seq)) render(); } catch (err) { if (err.auth) gate("비밀번호가 바뀌었습니다. 다시 입력해 주세요."); }
  }

  let toastT = 0;
  function toast(t) { const el = $("#toast"); if (!el) return; el.textContent = t; clearTimeout(toastT); toastT = setTimeout(() => { el.textContent = ""; }, 3000); }

  // ── 검수확인서 (A4 세로) : 1장 검수확인서 + 붙임 요건별 검수 확인 내역. 인쇄 창에서 「PDF로 저장」 ──
  function printCert() {
    const C = S.sheet.cert || {}, all = items(), n = all.length, c = all.filter(done).length, now = new Date();
    const head = `<div class="hd">${esc(C.project || "")} 검수확인서</div>`;
    const rows = all.map(it => {
      const k = S.confirms[it.id];
      return `<tr><td>${esc(it.no)}</td><td>${esc(it.g)}</td><td class="l">${esc(it.name)}</td><td>${esc(it.owner || "").replace(/ · /g, "<br>")}</td>
        <td>${k ? esc(k.name) : '<span class="g">미확인</span>'}</td><td>${k ? esc(fmt(k.at).slice(0, 10)) : ""}</td></tr>`;
    }).join("");
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(CFG.client || "")}_추가개발_검수확인서_${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap"><style>
      @page{size:A4 portrait;margin:12mm 15mm}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{margin:0;font-family:'Noto Sans KR','맑은 고딕',sans-serif;color:#111;font-size:10.5pt;line-height:1.6}
      .hd{font-size:9.5pt;text-decoration:underline;margin-bottom:7mm}
      .cert{page-break-after:always}
      .box{border:1.6pt solid #111}
      h1{text-align:center;font-size:21pt;letter-spacing:6pt;margin:0;padding:7mm 0;border-bottom:1pt solid #111}
      .info{padding:5mm 9mm}.info p{margin:2.2mm 0}
      .band{background:#fafae6;text-align:center;font-weight:700;padding:2mm;border-top:1pt solid #111;border-bottom:1pt solid #111}
      .body{padding:5mm 9mm 9mm;min-height:62mm}.body p{margin:2.2mm 0}
      .ap{padding:6mm 9mm 9mm;text-align:center}
      .date{text-align:right;margin:10mm 4mm 5mm;font-size:11pt}
      table{width:100%;border-collapse:collapse}
      .sign th,.sign td{border:1px solid #777;padding:2mm;text-align:center}
      .sign th{background:#f2f2f2;font-weight:700}.sign td{height:15mm}
      h2{font-size:13pt;margin:0 0 3mm}
      .att .hd{margin-bottom:5mm}
      .grid{table-layout:fixed;font-size:8.8pt;line-height:1.38}
      .grid th,.grid td{border:1px solid #888;padding:.8mm 1.3mm;text-align:center;vertical-align:middle;word-break:keep-all;overflow-wrap:anywhere}
      .grid th{background:#f2f2f2}.grid thead{display:table-header-group}.grid tr{page-break-inside:avoid}
      .l{text-align:left!important}.g{color:#999}
      .note{margin-top:3mm;font-size:9pt;color:#555;text-align:right}
      </style></head><body>
      <section class="cert">${head}<div class="box">
        <h1>검수 확인서</h1>
        <div class="info">
          <p>■ 고객명 : ${esc(C.client || "")}</p>
          <p>■ 프로젝트명 : ${esc(C.project || "")}</p>
          <p>■ 프로젝트 기간 : ${esc(C.period || "")}</p>
          <p>■ 수행사 : ${esc(C.vendor || "")}</p>
        </div>
        <div class="band">검수 내용</div>
        <div class="body">
          <p>■ 검수 범위 : ${esc(C.scope || "추가개발")} 요건 ${n}건</p>
          <p>■ 검수 방법 : 요건별 담당자가 개발 결과를 확인하여 검수 확인 처리</p>
          <p>■ 확인 현황 : ${n}건 중 ${c}건 확인</p>
          <p style="margin-top:8mm">붙임 : 요건별 검수 확인 내역. 끝.</p>
        </div>
        <div class="band">승인</div>
        <div class="ap">
          <p>상기 프로젝트의 ${esc(C.scope || "추가개발")} 요건이 붙임의 내용과 같이 검수 완료되었음을 확인합니다.</p>
          <p class="date">${now.getFullYear()}년 &nbsp;&nbsp;&nbsp;&nbsp; 월 &nbsp;&nbsp;&nbsp;&nbsp; 일</p>
          <table class="sign"><tr><th>소속</th><th>직위</th><th>성명</th><th>서명</th></tr><tr><td></td><td></td><td></td><td></td></tr></table>
        </div>
      </div></section>
      <section class="att">${head}
        <h2>▣ 붙임. 요건별 검수 확인 내역</h2>
        <table class="grid"><thead><tr><th style="width:6%">No.</th><th style="width:11%">구분</th><th style="width:42%">요건명</th>
          <th style="width:15%">담당</th><th style="width:12%">확인자</th><th style="width:14%">확인일</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="note">확인 ${c} / ${n}건 · 출력 ${esc(fmt(now.toISOString()))}</p>
      </section></body></html>`;
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 60000); } };
    (f.contentDocument.fonts ? f.contentDocument.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 400));
  }

  pass ? load().then(() => { filter = items().some(isMine) ? "mine" : "all"; start(); }).catch(() => gate()) : gate();
})();
