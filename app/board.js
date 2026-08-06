/* ══════════════════════════════════════════════════════════════
   JaDE 프로젝트 현황판 — 표준 앱
   이 파일은 전 프로젝트가 공유합니다. 프로젝트별로 고치지 마세요.

   데이터는 프로젝트 폴더의 파일 하나에서 읽습니다.

       isens/index.html   화면 (셸)
       isens/data.enc     데이터 (암호문) ← 이것만 커밋합니다
       isens/data.xlsx    PM 이 고치는 원본 ← .gitignore. 절대 커밋하지 않습니다

   🔴 비밀번호 = 복호화 키입니다. 해시를 심지 않습니다.
      복호화에 성공하면 통과, 실패하면 비밀번호 오류입니다.
      ⇒ 저장소가 Public 이어도 비밀번호 없이는 데이터를 읽을 수 없습니다.

   설정이 필요 없으면 window.BOARD 를 아예 안 써도 됩니다.

     window.BOARD = {
       data  : './data.enc',      // 기본값
       plain : false              // true 면 암호화 없이 ./data.xlsx 를 그대로 읽습니다
     }                            // (공개해도 되는 현황판·로컬 미리보기용)

   이 파일에 예시 데이터는 없습니다. 못 읽으면 안내 화면을 띄웁니다.
   ══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var VER = '1.8.0';
var CFG = window.BOARD || {};
var DAY = 86400000;
var UNLOCKED = false;   /* 잠금을 통과했는가 (셸을 다시 그린 뒤 상태 복원용) */

/* 시트 탭 이름 = 표준 계약. 바꾸면 전 프로젝트가 깨집니다. */
var SRC = ['설정','WBS','패키지진척','마일스톤','일정','주간업무','녹화본','산출물','이슈','요건'];

var PLAIN    = CFG.plain === true;
var DATA_URL = CFG.data || (PLAIN ? './data.xlsx' : './data.enc');

var HCG_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAAAhCAYAAABQphx6AAAEWElEQVR42u2aaWhVRxTHf0oU6xI/JEYS90ZMXXCrikurgrVVRFRsxbgitCIK1roEpfWD2oIo4oZSW7Gi4IaIaKRFBbV1xTUuaRWDoOBWFzTuVl8/zHkgjzfLve/e5Cbm/+U97sycOfOf5SwzUIUqvE+o9s7/XoZ6RcATB3l1gQ6asrfAMR86ZgH9RG5rIBtoANQD7gEPgfvAeeCI9PEgYJ4ygIGix4eiU4Mk9W4Dl4CzwHbgqgvx9wwd9xdhNnQE9hvKMz0MtikwC8j3QdRhYAOwI0XCuwPfAEN8tj8JrAIKEwuq+9gZfuu98qDw17J6830O+BPgF+Ac0NlH+4bAZiFsSAoT1xVYLwuguR/iXREzlNV0lDEfWAh8EIA+jYG9wAgPbboAx2WXB4XewB6ZUE/Ex8rI5owHJjvUOwacAu44yl0N5DnUawtsE/thw33gDHAFeOq4i74La8WngkbAT5Y664ScwcAA+Z8L/CBG1gSb7FpiF9ItZM8G2slEfg70BJoBw8S2mDAqisTPk8HrsAAoSLLKHwE/A0OBUkP7vjJJOswRAnUoFtuxVryXRPwlOmw0yKgNfBwl4jNEaR1OAMstMi4Bv1rq9NF8rw9MNLR7CUwA/nUYy1zgtaE8FyAtIl6NzXNY6tj/PmC6oTxH8/0roIah3UqgxFGHJ8AMMezJUOKF+FgA9UxezWeGskeW2CDRb870seO+tBC5wqO8TbYKUfHj8yxkhokaFl9/F/As6E6jcMbXdDBqYaK9hYeDYXTqetSMtRwHcWRbCC5I8j3dIvNmgOPtAXya8O0jS5tiS4A2yqMOxUChF+KDQIGPNi8CJL6nDx1KLcR7lbcdKIySH6/D83Lu/3UYQisC8Wnl3H+d95X4uuXcf/3yXE2/OUZt2RZ7sEhjdKeVEfFHk+jQQgIoHVqg0svJ8FhkJiILaOnqd5suQno7unUdDcHOK0PkWGJYWVuBKSGu6KaoLKMOa4DvPcrMl2hXZ1wnlWVa2BS5nrP42WHiOsmTXnEM8hBAVhjDFUcR+gRWa1mV1x3kpAOTLFHwgSTf9wNjDC7jAOD3ykj8bmCqoXykxj4k4guLXz1fQ/xGA/GgknQnLcdxhfRqzgJ/G8qnAk0c5Ey0lOuOtNOWcz4TlbPJqIzu5BJDWS1gi3gLplXZyVD+APgzhai6Fer+dnhlOmoAdqIuG3Tve/JkZ/whLtw11HVhrhxFtnTwYofdsBrznW8z8XIWonL/F4AbqGvHdNSrghjqGpCK4E7GkSPtswKe1OOoe9qYAx/LgNEhLrBIuZNx3BQfuDTAge4RmTHHcX4L/Bj29o5iyqAIlUU8nKKcu8BM1JMRrxO5TM7yu2ENMo1o4hbq8rsb6jHSYEeP4jnwj7iHG1LU4RDQBpVvH4d66OQVl8UuXUNdxpcCFwkjIgsROWLc4rv0rRD9Qn4fSu4kTDQUI1oH9VSjGvBG7GP8avMN6gnKf1QhevgfzpXYgLy885YAAAAASUVORK5CYII=';

/* ── 유틸 ─────────────────────────────────────── */
function $(id){ return document.getElementById(id); }
function pad(n){ return String(n).length<2 ? '0'+n : ''+n; }

/* 전부 이스케이프한다. 시트 편집자가 스크립트를 심을 수 없게. */
var ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return ESC[c]; }); }

/* 서식용 최소 태그만 되살린다. 속성은 어떤 것도 통과하지 못한다. */
function rich(s){
  return esc(s)
    .replace(/&lt;(\/?)(b|strong|i|em|u|br)\s*\/?&gt;/gi,
      function(m,sl,tag){ return '<'+sl+tag.toLowerCase()+'>'; })
    /* 데이터 안 색 강조: <red>…</red> 빨강(기한 등), <blue>…</blue> 파랑(고객사 회신 등)
       → 고정 클래스 span (속성 자유입력이 없으므로 안전) */
    .replace(/&lt;red&gt;/gi, '<span class="rt">')
    .replace(/&lt;\/red&gt;/gi, '</span>')
    .replace(/&lt;blue&gt;/gi, '<span class="bt">')
    .replace(/&lt;\/blue&gt;/gi, '</span>');
}

/* href 로 나갈 값. javascript: 등은 버린다. */
function safeUrl(u){
  var s=String(u==null?'':u).trim();
  return /^(https?:\/\/|\.\/|\.\.\/|\/|#|mailto:)/i.test(s) ? esc(s) : '';
}

function parseYmd(s){
  var a=String(s).split('-').map(Number);
  return new Date(a[0], a[1]-1, a[2]);
}

/* 고객 로고 크기/위치 미세조정 — window.BOARD 의 logoH(높이 px), logoDy(위로 올리려면 음수) */
function logoStyleAttr(gate){
  var s='';
  var h = CFG.logoH ? (gate ? Math.round(CFG.logoH*1.15) : CFG.logoH) : 0;
  if(h) s += 'height:'+h+'px;';
  if(CFG.logoDy) s += 'transform:translateY('+(gate ? Math.round(CFG.logoDy*1.15) : CFG.logoDy)+'px);';
  return s ? ' style="'+s+'"' : '';
}

/* ── 셸 ───────────────────────────────────────── */
/* 프로젝트 index.html 은 6줄뿐이고, 화면 뼈대는 전부 여기서 만듭니다. */
var PANELS = {
  'p-wbs': '<section class="panel" id="p-wbs" role="tabpanel">'
    +'<div class="ph"><h1>WBS 일정</h1></div>'
    +'<div class="card"><div class="ch"><h3>전체 공정</h3><span class="m" id="g-m"></span>'
    +'<button class="jump" id="jump" type="button">오늘 위치로</button></div>'
    +'<div class="cb"><div class="glg" id="g-lg"></div>'
    +'<div class="gs" id="gs"><div class="gantt" id="gantt"></div></div></div></div></section>',

  'p-pkg': '<section class="panel" id="p-pkg" role="tabpanel" hidden>'
    +'<div class="ph" style="max-width:none"><h1>패키지 진척</h1>'
    +'<p class="sub">모듈마다 업무분석·기초셋업·교육·최종셋업·테스트·검수 여섯 단계를 거칩니다. '
    +'완료된 단계만 진척으로 계산하며, 해당없음은 그 모듈의 단계 수에서 제외됩니다.</p></div>'
    +'<div class="card"><div class="ch"><h3>모듈별 단계 현황</h3><span class="m" id="pkg-m"></span></div>'
    +'<div class="cb"><div class="glg" style="gap:22px">'
    +'<span><i class="stp done">완료</i></span><span><i class="stp doing">진행</i></span>'
    +'<span><i class="stp todo">미착수</i></span><span><i class="stp na">해당없음</i></span></div>'
    +'<div class="ts"><table class="t" id="pkgtbl"></table></div></div></div></section>',

  'p-sch': '<section class="panel" id="p-sch" role="tabpanel" hidden>'
    +'<div class="ph"><h1>방문 및 회의 일정</h1>'
    +'<p class="sub">확정된 방문·회의·교육 일정입니다. 변경이 생기면 담당 PM이 사전에 안내드립니다.</p></div>'
    +'<div class="card"><div class="ch"><h3>일정표</h3><span class="m" id="sch-m"></span></div>'
    +'<div class="cb"><div class="ts"><table class="t" id="schtbl"></table></div></div></div></section>',

  'p-week': '<section class="panel" id="p-week" role="tabpanel" hidden>'
    +'<div class="ph"><h1>주간 업무</h1>'
    +'<p class="sub">매주 금요일 기준 금주 실적, 차주 계획, 요청사항입니다.</p></div>'
    +'<div class="card"><div class="ch"><h3>주간 업무보고</h3><span class="m" id="wk-m"></span>'
    +'<select class="wsel" id="wk-sel" aria-label="주차 선택"></select></div>'
    +'<div class="cb"><div id="weeklog"></div></div></div></section>',

  'p-dev': '<section class="panel" id="p-dev" role="tabpanel" hidden>'
    +'<div class="ph"><h1>추가개발</h1><p class="sub" id="dev-sub"></p></div>'
    +'<div class="card" id="dev-phase-card"><div class="ch"><h3>단계별 진척</h3><span class="m" id="dev-m"></span></div>'
    +'<div class="cb"><div class="ts"><table class="t" id="dev-phase"></table></div></div></div>'
    +'<div class="card" id="dev-items-card"><div class="ch"><h3>요건 대장</h3>'
    +'<span class="m" id="dev-im"></span>'
    +'<a class="docbtn" id="dev-doc" target="_blank" rel="noopener" hidden></a></div>'
    +'<div class="cb"><div class="ts"><table class="t" id="dev-items"></table></div></div></div></section>',

  'p-rec': '<section class="panel" id="p-rec" role="tabpanel" hidden>'
    +'<div class="ph"><h1>교육 녹화본</h1>'
    +'<p class="sub">모듈별 사용자 교육 녹화본입니다. 링크가 없는 회차는 아직 진행 전입니다.</p></div>'
    +'<div class="card"><div class="ch"><h3>녹화본 리스트</h3><span class="m" id="rec-m"></span></div>'
    +'<div class="cb"><div class="ts"><table class="t" id="recs"></table></div></div></div></section>',

  'p-doc': '<section class="panel" id="p-doc" role="tabpanel" hidden>'
    +'<div class="ph"><h1>산출물 및 매뉴얼</h1>'
    +'<p class="sub">확정 문서는 눌러서 바로 열 수 있습니다. 링크가 없는 항목은 배포 전입니다.</p></div>'
    +'<div class="card"><div class="cb"><div class="ts"><table class="t" id="docs"></table></div></div></div></section>',

  'p-iss': '<section class="panel" id="p-iss" role="tabpanel" hidden>'
    +'<div class="ph"><h1>이슈 및 리스크</h1>'
    +'<p class="sub">일정과 품질에 영향을 주는 사항과 대응 방안입니다.</p></div>'
    +'<div class="casesum" id="iss-sum" style="margin-bottom:20px"></div>'
    +'<div class="card"><div class="cb"><div class="ts"><table class="t" id="issues"></table></div></div></div></section>'
};

function buildShell(tabs){
  var tabHtml = tabs.map(function(t,i){
    return '<button class="tab" role="tab" data-p="'+t.id+'" aria-selected="'+(i===0?'true':'false')+'">'
      + esc(t.label) + (t.badge ? '<b id="n-'+t.id.slice(2)+'"></b>' : '') + '</button>';
  }).join('');
  var panelHtml = tabs.map(function(t,i){
    var h = PANELS[t.id];
    return i===0 ? h.replace(' hidden>','>') : (h.indexOf(' hidden>')<0 ? h.replace('role="tabpanel">','role="tabpanel" hidden>') : h);
  }).join('');

  /* 로그인 화면 로고 = 프로젝트 index.html 의 window.BOARD 에서 온다 (데이터 로드 전이므로).
     예) window.BOARD = { client:'BYN', logo:'./ci.svg' } */
  var clogo = safeUrl(CFG.logo);
  var gateBrand = clogo ? '<img class="cl" src="'+clogo+'"'+logoStyleAttr(true)+' alt="'+esc(CFG.client||'')+'">'
                : (CFG.client ? '<b>'+esc(CFG.client)+'</b>' : '');

  return ''
  + '<div id="gate"><div class="gate-card" id="gate-card">'
  +   '<div class="gate-logo">'+(gateBrand?gateBrand+'<i></i>':'')+'<img src="'+HCG_LOGO+'" alt="HCG"></div>'
  +   '<h1 id="gate-name">프로젝트 현황</h1>'
  +   '<p class="gs-sub" id="gate-sub">열람 비밀번호를 입력해 주세요</p>'
  +   '<div class="gate-form" id="gate-form">'
  +     '<input type="password" id="gate-pw" placeholder="비밀번호" autocomplete="off" aria-label="열람 비밀번호">'
  +     '<button id="gate-go" type="button">확인</button></div>'
  +   '<p id="gate-msg" role="status"></p>'
  + '</div></div>'
  + '<div id="pvw"></div>'
  + '<header class="top"><div class="wrap">'
  +   '<span class="brand" id="brand"></span><span class="sp"></span>'
  +   '<span class="stamp" id="stamp"></span>'
  +   '<span class="tag next-sch" id="nextsch" hidden></span><span class="tag" id="dday"></span>'
  + '</div></header>'
  + '<section class="title"><div class="wrap"><div class="title-main">'
  +   '<p class="eyebrow">프로젝트 현황</p><h1 id="proj-name"></h1><p class="sub" id="sub"></p>'
  +   '</div><dl class="specs" id="specs"></dl></div></section>'
  + '<section class="wrap" id="upnext-sec" hidden><div class="upnext" id="upnext"></div></section>'
  + '<section class="wrap"><div class="card"><div class="ch"><h3>월별 진행 맵</h3></div>'
  +   '<div class="cb"><div class="mmap" id="mmap"></div></div>'
  + '</div></section>'
  + '<section class="wrap" style="margin-top:24px"><div class="band"><div class="band-in" id="scores"></div></div></section>'
  + '<nav class="tabs"><div class="wrap" role="tablist" aria-label="현황 보기">'+tabHtml+'</div></nav>'
  + '<main class="wrap">'+panelHtml+'</main>'
  + '<footer class="foot"><div class="wrap"><span id="foot-l"></span>'
  +   '<span class="ver">board v'+VER+'</span></div></footer>';
}

/* 셸을 그린다. 잠금을 이미 통과한 뒤라면 「불러오는 중」 상태를 복원한다. */
function mount(tabs){
  document.body.innerHTML = buildShell(tabs);
  if(UNLOCKED) loadingState();
}

function loadingState(){
  var f=$('gate-form'), m=$('gate-msg'), s=$('gate-sub');
  if(f) f.style.display='none';
  if(s) s.textContent='';
  if(m){ m.style.color='var(--muted48)'; m.textContent='불러오는 중입니다'; }
}

function fail(title, detail){
  var g=$('gate');
  if(!g){ document.body.innerHTML='<div style="padding:60px;font-family:sans-serif">'+esc(title)+'</div>'; return; }
  g.className='';
  var c=$('gate-card');
  if(c) c.innerHTML='<div class="errbox"><h2>'+esc(title)+'</h2><p>'+detail+'</p></div>';
  if(window.console && console.error) console.error('[현황판] '+title);
}

/* ══════════════════════════════════════════════════════════════
   엑셀 로더 — 프로젝트 폴더의 data.xlsx 한 개를 읽습니다
   ══════════════════════════════════════════════════════════════ */

/* 셀 하나를 문자열로.
   날짜 셀은 cellDates 로 Date 객체를 받아 「그 지역 날짜」 그대로 적습니다.
   일련번호로 받으면 시간대 보정분 때문에 소수가 붙고 연말·연초에 하루씩 밀립니다
   (실측: 2026-12-31 이 46387.0006 으로 나옴). */
function cellText(v){
  if(v===null || v===undefined) return '';
  if(typeof v==='object' && typeof v.getMonth==='function')
    return v.getFullYear()+'-'+pad(v.getMonth()+1)+'-'+pad(v.getDate());
  return String(v);
}

function sheetRows(ws){
  var raw = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:'' });
  return objectify(raw.map(function(r){ return r.map(cellText); }));
}

/* ── 복호화 ────────────────────────────────────────────────
   파일 형식 (_tools/pack.py 와 맺은 계약):
     "JPMS1"(5) | iterations(4, big-endian) | salt(16) | iv(12) | ciphertext+tag
   키유도 = PBKDF2-HMAC-SHA256 → AES-256-GCM
   ──────────────────────────────────────────────────────── */
var BAD_PW = 'BAD_PW';

function decrypt(buf, password){
  var u = new Uint8Array(buf);
  var magic = String.fromCharCode(u[0],u[1],u[2],u[3],u[4]);
  if(magic !== 'JPMS1') return Promise.reject(new Error('형식이 아닙니다'));

  var iter = (u[5]<<24 | u[6]<<16 | u[7]<<8 | u[8]) >>> 0;
  var salt = u.subarray(9, 25);
  var iv   = u.subarray(25, 37);
  var body = u.subarray(37);

  if(!(window.crypto && crypto.subtle && window.TextEncoder))
    return Promise.reject(new Error('NO_CRYPTO'));

  var enc = new TextEncoder().encode(password);
  return crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey'])
    .then(function(base){
      return crypto.subtle.deriveKey(
        { name:'PBKDF2', salt:salt, iterations:iter, hash:'SHA-256' },
        base, { name:'AES-GCM', length:256 }, false, ['decrypt']);
    })
    .then(function(key){
      return crypto.subtle.decrypt({ name:'AES-GCM', iv:iv }, key, body);
    })
    .catch(function(e){
      /* 복호화 실패 = 비밀번호가 틀렸다는 뜻 (인증이 곧 복호화다) */
      if(e && e.message==='NO_CRYPTO') throw e;
      throw new Error(BAD_PW);
    });
}

function loadWorkbook(password){
  return fetch(DATA_URL, { cache:'no-cache' }).then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.arrayBuffer();
  }).then(function(buf){
    return PLAIN ? buf : decrypt(buf, password);
  }).then(function(buf){
    var wb = XLSX.read(new Uint8Array(buf), { type:'array', cellDates:true });
    var t={};
    SRC.forEach(function(name){
      var ws = wb.Sheets[name];
      t[name] = ws ? sheetRows(ws) : null;   /* 시트가 없으면 null → 그 탭이 화면에서 사라짐 */
    });
    return t;
  });
}

function objectify(rows){
  if(!rows.length) return [];
  var head=rows[0].map(function(x){
    return String(x==null?'':x).replace(/^﻿/,'').replace(/​/g,'').trim();
  });
  return rows.slice(1).filter(function(r){
    return r.some(function(c){ return String(c).trim()!==''; });
  }).map(function(r){
    var o={}; head.forEach(function(k,i){ o[k]=(r[i]===undefined?'':String(r[i]).trim()); }); return o;
  });
}

/* 상태값 · 날짜 · 숫자 정규화 */
var ST={ '완료':'done','진행중':'doing','진행':'doing','예정':'todo','대기':'todo',
         '배포':'done','작성중':'doing' };
function st(v){ return ST[String(v).trim()] || 'todo'; }

function nd(v){
  var s=String(v==null?'':v).trim();
  if(!s) return '';
  var p2=function(x){ return ('0'+x).slice(-2); };
  var g=s.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})/);          /* Date(y,m,d) 문자열: 월이 0부터 */
  if(g) return g[1]+'-'+p2(+g[2]+1)+'-'+p2(g[3]);
  /* 엑셀 일련번호. 소수부는 시각이므로 버린다 (46237.0006 = 2026-08-03 00:00:52) */
  if(/^\d{4,6}(\.\d+)?$/.test(s)){
    var sn=parseFloat(s);
    if(sn>20000 && sn<80000){
      var ds=new Date(Date.UTC(1899,11,30)+Math.floor(sn)*DAY);
      return ds.getUTCFullYear()+'-'+p2(ds.getUTCMonth()+1)+'-'+p2(ds.getUTCDate());
    }
  }
  var t=s.replace(/\s+/g,'').replace(/[.\/]/g,'-').replace(/-+$/,'');
  var m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                      /* 2026-08-17 / 2026.8.17 */
  if(m) return m[1]+'-'+p2(m[2])+'-'+p2(m[3]);
  m=t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);                          /* 8-17-2026 */
  if(m) return m[3]+'-'+p2(m[1])+'-'+p2(m[2]);
  m=t.match(/^(\d{4})(\d{2})(\d{2})$/);                               /* 20260817 */
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  return '';
}
function num(v,d){ var x=parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(x)?d:x; }

/* 화면에 그대로 찍는 날짜. 엑셀 날짜셀이면 2026.08.03 으로, 자유 문구면 그대로. */
function fmtDate(v){
  var s=nd(v);
  if(!s) return String(v==null?'':v).trim();
  var a=s.split('-'); return a[0]+'.'+a[1]+'.'+a[2];
}
function pct(v){
  var x=String(v==null?'':v).replace('%','').trim();
  if(x==='') return null;
  var f=parseFloat(x); if(isNaN(f)) return null;
  return Math.max(0, Math.min(1, f>1 ? f/100 : f));
}

/* ══════════════════════════════════════════════════════════════
   시트 → 모델
   ══════════════════════════════════════════════════════════════ */
function build(t){
  var warn=[];
  var D={
    project:{ name:'프로젝트', client:(CFG.client||''), logo:(CFG.logo||''), vendor:'휴먼컨설팅그룹',
              solution:'JaDE HR Package', start:'', end:'', openDate:'', devMD:0, devCount:0 },
    weights:{ pkg:0.5, dev:0.5 },
    previewDate:null, hide:[],
    pkg:[], pkgSteps:[], dev:[], devSpan:null, devPct:null, pctPkg:null, pctAll:null,
    milestones:[], schedule:[], weekly:[], recordings:[], docs:[], issues:[], devItems:[],
    issueSummary:'', devDocUrl:'', devDocText:''
  };

  /* ── 설정 ── */
  var cfgRows = t['설정'];
  if(!cfgRows || !cfgRows.length) return { err:'설정 탭을 읽지 못했습니다.' };
  var K=function(s){ return String(s==null?'':s).replace(/[\s_]/g,''); };
  var cfg={};
  cfgRows.forEach(function(r){
    var keys=Object.keys(r);
    var key=K(r['항목']!==undefined ? r['항목'] : r[keys[0]]);
    if(key) cfg[key]=(r['값']!==undefined ? r['값'] : r[keys[1]]);
  });
  var C=function(n){ return cfg[K(n)]; };
  if(!Object.keys(cfg).length) return { err:'설정 탭의 1행 머리글이 「항목 / 값」 인지 확인해 주세요.' };

  var P=D.project;
  if(C('프로젝트명')) P.name=C('프로젝트명');
  if(C('고객사명'))   P.client=C('고객사명');
  if(C('로고URL'))    P.logo=C('로고URL');
  if(C('수행사'))     P.vendor=C('수행사');
  if(C('솔루션'))     P.solution=C('솔루션');
  P.start   = nd(C('시작일'));
  P.end     = nd(C('종료일'));
  P.openDate= nd(C('오픈일'));
  if(!P.start || !P.end) return { err:'설정 탭의 시작일 / 종료일이 비어 있거나 형식이 맞지 않습니다.' };
  if(!P.openDate) P.openDate=P.end;
  if(C('추가개발MD'))    P.devMD=num(C('추가개발MD'),0);
  if(C('추가개발건수'))  P.devCount=num(C('추가개발건수'),0);
  if(C('가중치_패키지'))   D.weights.pkg=num(C('가중치_패키지'),D.weights.pkg);
  if(C('가중치_추가개발')) D.weights.dev=num(C('가중치_추가개발'),D.weights.dev);
  D.previewDate = nd(C('미리보기기준일')) || null;
  if(C('이슈요약')) D.issueSummary=C('이슈요약');
  /* 요건 대장에서 바로 여는 문서·사이트 (요구사항 검토서 등). 비우면 버튼이 안 나온다. */
  if(C('요건검토서URL'))  D.devDocUrl  = C('요건검토서URL');
  if(C('요건검토서문구')) D.devDocText = C('요건검토서문구');
  if(C('숨김탭')) D.hide=String(C('숨김탭')).split(/[,;]/).map(function(x){ return x.trim(); }).filter(Boolean);
  D.pctAll=pct(C('진척률_전체')); D.pctPkg=pct(C('진척률_패키지'));
  var dp=pct(C('진척률_추가개발')); if(dp!==null) D.devPct=dp;
  /* 단계별 진척(모듈 밴드) 표 = '숨김' 이면 카드째 뺀다.
     요건 대장이 요건 단위로 같은 것을 이미 보여주는 프로젝트에서, 모듈 밴드는
     요건 상태의 롤업일 뿐 독립 정보가 없어 「사람이 손으로 바꿔야 하는데 바뀌지 않는 칸」이 된다. */
  D.hidePhase = String(C('단계별진척')||'').trim()==='숨김';

  /* ── WBS ── */
  if(!t['WBS'] || !t['WBS'].length) return { err:'WBS 탭을 읽지 못했습니다.' };
  var pkg=[], dev=[], idx={}, gspan={}, gpct={};
  t['WBS'].forEach(function(r){
    /* 머리글이 숫자로 시작하는 칸(1주~24주)에 값이 있으면 그 구간 */
    var ws=0, we=0;
    for(var k in r){
      var mw=/^\s*(\d+)/.exec(k);
      if(mw && String(r[k]).trim()!==''){
        var wn=+mw[1];
        if(!ws || wn<ws) ws=wn;
        if(wn>we) we=wn;
      }
    }
    if(!ws){ ws=num(r['시작주'],0); we=num(r['종료주'],ws); }
    var isDev=String(r['구분']).indexOf('추가개발')>=0;
    var nm=String(r['작업']||'').trim();
    var gname=String(r['모듈']||'').trim() || (isDev?'추가개발':'기타');

    if(!nm){                                   /* 작업이 빈 행 = 모듈 전체 구간 막대 */
      if(!ws) return;
      if(isDev){ D.devSpan={s:ws,e:Math.max(ws,we)}; var v=pct(r['진척률']); if(v!==null) D.devPct=v; }
      else{
        gspan[gname]={s:ws,e:Math.max(ws,we)};
        gpct[gname]=pct(r['진척률']);
        if(idx[gname]===undefined){ idx[gname]=pkg.length; pkg.push({group:gname,items:[]}); }
      }
      return;
    }
    if(!ws){ warn.push('주차가 비어 있는 행: '+nm); return; }
    var item={ n:nm, s:ws, e:Math.max(ws,we), st:st(r['상태']), pct:pct(r['진척률']) };
    if(isDev){ item.memo=r['비고']||''; dev.push(item); }
    else{
      if(idx[gname]===undefined){ idx[gname]=pkg.length; pkg.push({group:gname,items:[]}); }
      pkg[idx[gname]].items.push(item);
    }
  });
  pkg=pkg.filter(function(g){ return g.items.length; });
  pkg.forEach(function(g){
    if(gspan[g.group]) g.span=gspan[g.group];
    if(gpct[g.group]!==null && gpct[g.group]!==undefined) g.pct=gpct[g.group];
  });
  if(!pkg.length && !dev.length) return { err:'WBS 탭에서 읽을 수 있는 행이 없습니다. 주차 칸이 칠해져 있는지 확인해 주세요.' };
  D.pkg=pkg; D.dev=dev;

  /* ── 패키지진척 : 모듈별 6단계 (업무분석·기초셋업·교육·최종셋업·테스트·검수) ── */
  if(t['패키지진척']){
    var PSTEP=['업무분석','기초셋업','교육','최종셋업','테스트','검수'];
    D.pkgSteps = t['패키지진척'].map(function(r){
      var mod=String(r['모듈']||'').trim(); if(!mod) return null;
      var sv={}; PSTEP.forEach(function(k){ sv[k]=String(r[k]||'').trim(); });
      return { mod:mod, w:num(r['가중치'],1), steps:sv };
    }).filter(Boolean);
  }

  /* ── 나머지 탭 : 없으면 없는 대로 (탭 자체가 화면에서 사라집니다) ── */
  if(t['마일스톤']) D.milestones = t['마일스톤']
    .map(function(r){ return { n:r['이름'], d:nd(r['일자']) }; })
    .filter(function(x){ return x.n && x.d; });

  /* ── 일정 : 방문·회의·교육. 일자와 제목만 있으면 되고 나머지 칸은 비워도 된다.
     일자 칸에 「미정」(또는 추후·TBD)을 적으면 날짜 없이 미정으로 표시되고 항상 맨 뒤로 간다. ── */
  if(t['일정']) D.schedule = t['일정'].map(function(r){
    var raw=String(r['일자']==null?'':r['일자']).trim();
    var d=nd(r['일자']);
    return { d:d, tbd:(!d && /^(미정|추후|미확정|TBD)/i.test(raw)),
             time:String(r['시각']||'').trim(),
             kind:String(r['구분']||'').trim(), n:String(r['제목']||'').trim(),
             place:String(r['장소']||'').trim(), who:String(r['참석자']||'').trim(),
             memo:r['비고']||'' };
  }).filter(function(x){ return (x.d || x.tbd) && x.n; })
    .sort(function(a,b){
      if(a.tbd !== b.tbd) return a.tbd ? 1 : -1;         /* 미정은 항상 뒤 */
      if(a.tbd) return 0;
      return a.d===b.d ? (a.time<b.time?-1:1) : (a.d<b.d?-1:1);
    });

  if(t['주간업무']){
    var wk={}, ord=[];
    t['주간업무'].forEach(function(r){
      var k=String(r['주차']||'').trim();
      if(!k) return;
      if(!wk[k]){ wk[k]={ week:num(r['주차'],0), period:r['기간']||'', title:r['제목']||'',
                          done:[], next:[], req:[] }; ord.push(k); }
      if(r['기간'] && !wk[k].period) wk[k].period=r['기간'];
      if(r['제목'] && !wk[k].title)  wk[k].title=r['제목'];
      var c=String(r['구분']||'').trim(), v=r['내용']||'';
      if(!v) return;
      if(c.indexOf('실적')>=0)      wk[k].done.push(v);
      else if(c.indexOf('계획')>=0) wk[k].next.push(v);
      else{
        if(c.indexOf('요청')<0) warn.push(k+'주차 「'+c+'」 구분을 요청사항으로 처리했습니다');
        wk[k].req.push(v);
      }
    });
    D.weekly = ord.map(function(k){ return wk[k]; })
      .filter(function(w){ return w.done.length||w.next.length||w.req.length; })
      .sort(function(a,b){ return b.week-a.week; });
  }

  if(t['녹화본']) D.recordings = t['녹화본'].map(function(r){
    return { mod:String(r['모듈']||'').trim()||'기타',
             date:nd(r['일자']),
             topic:String(r['내용']||'').trim()||'사용자 교육',
             who:String(r['참여자']||'').split(/[,;\n]/).map(function(x){ return x.trim(); }).filter(Boolean),
             title:String(r['제목']||'').trim(),
             url:String(r['링크']||'').trim() };
  }).filter(function(x){ return x.title || x.url || x.date; });

  if(t['산출물']) D.docs = t['산출물'].map(function(r){
    return { cat:r['구분']||'', name:r['문서명']||'', date:fmtDate(r['배포일']),
             owner:r['담당']||'', st:st(r['상태']), url:r['링크']||'' };
  }).filter(function(x){ return x.name; });

  if(t['이슈']) D.issues = t['이슈'].map(function(r){
    return { lv:r['영향도']||'중간', cause:r['원인']||'일정/선행조건', title:r['항목']||'',
             detail:r['상세']||'', action:r['대응방안']||'', owner:r['담당']||'', due:fmtDate(r['기한']) };
  }).filter(function(x){ return x.title; });

  /* 계획시작/계획종료는 선택 열이다 — 없는 프로젝트는 표에 「계획」 칸 자체가 나오지 않는다 */
  if(t['요건']) D.devItems = t['요건'].map(function(r){
    return { no:r['No']||r['no']||'', cat:r['구분']||'', name:r['요건명']||'',
             md:num(r['M/D']||r['MD'],0), owner:r['담당']||'', st:st(r['상태']),
             ps:fmtDate(r['계획시작']||''), pe:fmtDate(r['계획종료']||'') };
  }).filter(function(x){ return x.name; });

  return { data:D, warn:warn };
}

/* ══════════════════════════════════════════════════════════════
   렌더
   ══════════════════════════════════════════════════════════════ */
function render(DATA, warn){
  var P=DATA.project;
  var CL={pkg:'#0066cc',dev:'#ff453a',sky:'#2997ff',white:'#ffffff'};
  var START=parseYmd(P.start), END=parseYmd(P.end), OPEN=parseYmd(P.openDate);
  var today = DATA.previewDate ? parseYmd(DATA.previewDate) : new Date();
  today.setHours(0,0,0,0);

  var weeks=[];
  for(var d=new Date(START); d<=END; d=new Date(+d+7*DAY))
    weeks.push({s:new Date(d), e:new Date(Math.min(+d+6*DAY,+END))});
  var NW=weeks.length;
  if(!NW){ fail('기간 설정이 잘못되었습니다.','설정 탭의 <code>시작일</code>이 <code>종료일</code>보다 뒤입니다.'); return; }

  /* 🔴 기간 밖 주차를 잘라낸다. 안 자르면 weeks[…] 가 undefined 가 되어 화면 전체가 죽는다. */
  var clipped=0;
  function clip(it){
    if(it.s>NW || it.e>NW || it.s<1) clipped++;
    it.s=Math.max(1, Math.min(NW, it.s));
    it.e=Math.max(it.s, Math.min(NW, it.e));
    return it;
  }
  DATA.pkg.forEach(function(g){ g.items.forEach(clip); if(g.span) clip(g.span); });
  DATA.dev.forEach(clip);
  if(DATA.devSpan) clip(DATA.devSpan);

  var md =function(x){ return pad(x.getMonth()+1)+'.'+pad(x.getDate()); };
  var ymd=function(x){ return x.getFullYear()+'.'+pad(x.getMonth()+1)+'.'+pad(x.getDate()); };
  var curWeek = today<START ? 0 : Math.min(NW, Math.floor((today-START)/(7*DAY))+1);
  var gotoWeek=null;
  var hasDev = DATA.dev.length>0;

  /* 진척률 : 상태값 기간가중, 진척률 칸이 있으면 그 값 우선 */
  var WT={done:1,doing:.5,todo:0};
  var span=function(i){ return i.e-i.s+1; };
  function prog(a){
    var n=0,t=0;
    a.forEach(function(i){
      var w=span(i); t+=w;
      n += w * (typeof i.pct==='number' && i.pct!==null ? i.pct : WT[i.st]);
    });
    return t?n/t:0;
  }
  function progGroups(gs){
    var n=0,t=0;
    gs.forEach(function(g){
      var w=g.items.reduce(function(p,i){ return p+span(i); },0); t+=w;
      n += w * (typeof g.pct==='number' && g.pct!==null ? g.pct : prog(g.items));
    });
    return t?n/t:0;
  }
  var pkgItems=[]; DATA.pkg.forEach(function(g){ pkgItems=pkgItems.concat(g.items); });
  /* 패키지진척 시트가 있으면 모듈별 6단계 완료율로 패키지 진척을 계산한다.
     완료만 진척으로 세고, 해당없음은 분모에서 뺀다. */
  var PSTEPS=['업무분석','기초셋업','교육','최종셋업','테스트','검수'];
  function stepPct(p){
    var den=0, n=0;
    for(var i=0;i<PSTEPS.length;i++){
      var v=p.steps[PSTEPS[i]];
      if(v==='해당없음'||v==='없음'||v==='-') continue;
      den++; if(v==='완료') n+=1;
    }
    return den ? n/den : 1;
  }
  var stepsPct=null;
  if(DATA.pkgSteps && DATA.pkgSteps.length){
    var sw=0, sa=0;
    DATA.pkgSteps.forEach(function(p){ var w=(p.w>0?p.w:1); sw+=w; sa+=w*stepPct(p); });
    if(sw) stepsPct=sa/sw;
  }
  var pPkg = DATA.pctPkg!==null ? DATA.pctPkg : (stepsPct!==null ? stepsPct : progGroups(DATA.pkg));

  /* 추가개발 진척 = 요건 대장이 있으면 **요건 단위**로 센다 (M/D 가중 · 완료 1 · 진행중 0.5).
     WBS 의 모듈 밴드보다 입자가 곱고, 상태를 한 곳(요건 대장)에서만 관리하게 된다.
     요건 시트가 없는 프로젝트는 종전대로 WBS 추가개발 행의 기간가중. */
  function progItems(a){
    var n=0,t=0;
    a.forEach(function(i){ var w=(i.md>0?i.md:1); t+=w; n+=w*WT[i.st]; });
    return t?n/t:0;
  }
  var devItemsAll = DATA.devItems||[];
  var pDev = DATA.devPct!==null && DATA.devPct!==undefined ? DATA.devPct
           : (devItemsAll.length ? progItems(devItemsAll) : prog(DATA.dev));
  var wSum = DATA.weights.pkg + DATA.weights.dev || 1;
  var pAll = DATA.pctAll!==null ? DATA.pctAll
           : (hasDev ? (pPkg*DATA.weights.pkg + pDev*DATA.weights.dev)/wSum : pPkg);
  var pc=function(v){ return Math.round(v*100); };

  /* ── 헤더 ── */
  if(DATA.previewDate){
    $('pvw').className='pvw';
    $('pvw').textContent='미리보기 기준일 '+ymd(today)+' 적용 중 — 설정 탭의 「미리보기기준일」을 비우면 오늘 날짜로 돌아갑니다';
  }
  var logo = safeUrl(P.logo);
  $('brand').innerHTML =
    (logo ? '<img class="cl" src="'+logo+'"'+logoStyleAttr(false)+' alt="'+esc(P.client||P.name)+'">'
          : (P.client ? '<b>'+esc(P.client)+'</b>' : ''))
    + '<em></em><img class="hcg" src="'+HCG_LOGO+'" alt="'+esc(P.vendor)+'">';

  $('stamp').textContent='기준일 '+ymd(today)+(curWeek?' / '+curWeek+'주차':' / 착수 전');
  var dd=$('dday');
  if(today<START){ dd.className='tag blue'; dd.textContent='착수 D-'+Math.ceil((START-today)/DAY); }
  else if(OPEN>today){ dd.className='tag blue'; dd.textContent='오픈 D-'+Math.ceil((OPEN-today)/DAY); }
  else { dd.className='tag grey'; dd.textContent='오픈 완료'; }

  /* 다음 방문·회의 — 상단 칩. 일정 시트가 없는 프로젝트에서는 칩 자체가 나오지 않는다. */
  var DOW=['일','월','화','수','목','금','토'];
  var nextSch=(DATA.schedule||[]).filter(function(x){ return !x.tbd && parseYmd(x.d)>=today; })[0] || null;
  if(nextSch){
    var nsd=parseYmd(nextSch.d), gap=Math.round((nsd-today)/DAY);
    var ns=$('nextsch');
    ns.hidden=false;
    ns.textContent='다음 일정 '+md(nsd)+'('+DOW[nsd.getDay()]+')'
      +(nextSch.time?' '+nextSch.time:'')+' · '+(gap===0?'오늘':'D-'+gap);
    ns.title=nextSch.n;
  }

  /* ── 다가오는 일정 — 메인 상단 블록. 가까운 순으로 최대 3건, 맨 앞을 크게 ── */
  (function(){
    var up=(DATA.schedule||[]).filter(function(x){ return x.tbd || parseYmd(x.d)>=today; });
    if(!up.length) return;                       /* 예정이 없으면 블록째 나오지 않는다 */
    var sec=$('upnext-sec'); if(!sec) return;
    sec.hidden=false;
    var cards=up.slice(0,3).map(function(x,i){
      var meta=[x.time, x.kind, x.place].filter(Boolean).join(' · ');
      var body='<div class="un-b"><div class="un-t">'+esc(x.n)+'</div>'
        +(meta?'<div class="un-m">'+esc(meta)+'</div>':'')
        +(x.who?'<div class="un-m">'+esc(x.who)+'</div>':'')+'</div>';
      if(x.tbd){                                 /* 일자 미정 — 날짜 자리에 「미정」 */
        return '<div class="un tbd'+(i===0?' first':'')+'">'
          +'<div class="un-d"><b class="tbd">미정</b></div>'+body
          +'<span class="tag grey">미정</span></div>';
      }
      var dt=parseYmd(x.d), g=Math.round((dt-today)/DAY);
      return '<div class="un conf'+(i===0?' first':'')+'">'
        +'<div class="un-d"><b>'+md(dt)+'</b><em>'+DOW[dt.getDay()]+'</em></div>'+body
        /* 남은 날짜는 빨간 박스로 강조 — 당일은 꽉 찬 빨강, 그 외는 옅은 빨강 */
        +'<span class="tag '+(g===0?'today':'red')+'">'+(g===0?'오늘':'D-'+g)+'</span></div>';
    }).join('');
    $('upnext').innerHTML='<div class="un-h"><b>다가오는 일정</b>'
      +'<span>예정 '+up.length+'건</span></div><div class="un-list">'+cards+'</div>';
  })();

  $('proj-name').textContent=P.name;
  $('foot-l').textContent=P.vendor+' / '+P.name;
  try{ document.title=P.name+' / 프로젝트 현황'; }catch(e){}
  $('sub').textContent=P.vendor+' / '+P.solution+' / 전체 '+NW+'주';

  /* 세 번째 값 = 컬럼 폭 가중치. 균등분할하면 「수행 기간」이 잘린다(날짜 두 개라 가장 길다). */
  var specs=[
    ['수행 기간', ymd(START)+' - '+ymd(END),                     '1.9fr'],
    ['현재 주차', curWeek?curWeek+' / '+NW+'주':'착수 전',        '1fr'],
    ['오픈 예정', ymd(OPEN),                                     '1.1fr']
  ];
  if(P.devMD) specs.push(['추가개발',
    P.devMD+' M/D'+(P.devCount?' ('+P.devCount+'건)':''), '1.25fr']);
  $('specs').style.setProperty('--spgrid',
    specs.map(function(r){ return r[2]; }).join(' '));
  $('specs').innerHTML=specs.map(function(r){
    return '<div class="spec"><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>'; }).join('');

  /* ── 월별 진행 맵 ── */
  var months=(function(){
    var runs=[],run=1;
    weeks.forEach(function(w,i){ if(i>0&&w.s.getMonth()===weeks[i-1].s.getMonth())run++;
      else{ if(i>0)runs.push(run); run=1; } });
    runs.push(run);
    var out=[], idx=0;
    runs.forEach(function(r){ out.push({ ws:idx+1, we:idx+r, n:r, label:(weeks[idx].s.getMonth()+1) }); idx+=r; });
    return out;
  })();

  (function(){
    function hit(it,m){ return it.s<=m.we && it.e>=m.ws; }

    /* 마일스톤을 월별로 담아둔다 — 카드와 같은 셀에 넣어야 줄바꿈해도 안 어긋난다 */
    var msl=(DATA.milestones||[]).map(function(x){ return {n:x.n,d:parseYmd(x.d)}; })
      .sort(function(a,b){ return a.d-b.d; });
    var nextIdx=-1;
    msl.forEach(function(x,i){ if(nextIdx<0 && x.d>=today) nextIdx=i; });
    function colOf(dt){
      var wi=Math.floor((dt-START)/DAY/7);
      if(wi<0) wi=0; if(wi>NW-1) wi=NW-1;
      for(var k=0;k<months.length;k++){ if(wi+1>=months[k].ws && wi+1<=months[k].we) return k; }
      return months.length-1;
    }
    var buckets=months.map(function(){ return []; });
    msl.forEach(function(x,i){
      var cls = x.d<today ? ' done' : (i===nextIdx ? ' next' : '');
      buckets[colOf(x.d)].push('<span class="ms-c'+cls+'" data-tip="'+esc(x.n)+' · '+ymd(x.d)+'"><em>'+ymd(x.d).slice(2)+'</em><b>'+esc(x.n)+'</b></span>');
    });

    var html=months.map(function(m, mi){
      var gs=DATA.pkg.filter(function(g){ return g.items.some(function(it){ return hit(it,m); }); })
                     .map(function(g){ return g.group; });
      var ds=DATA.dev.filter(function(it){ return hit(it,m); }).map(function(it){ return it.n; });
      /* 주차가 아니라 달력 월로 판정 (9/3 은 5주차지만 그 주는 8/31 시작) */
      var cKey = weeks[m.ws-1].s.getFullYear()*12 + weeks[m.ws-1].s.getMonth();
      var tKey = today.getFullYear()*12 + today.getMonth();
      var isNow=(cKey===tKey), isPast=(cKey<tKey);
      var tag = isNow?'<span class="tag blue">이번 달</span>'
              : (isPast?'<span class="tag line">완료 구간</span>':'');
      var li=function(a,c){ return a.length
        ? a.map(function(t){ return '<li'+(c?' class="dv-i"':'')+'>'+esc(t)+'</li>'; }).join('')
        : '<li class="none">없음</li>'; };
      var chips=buckets[mi];
      return '<div class="mm-cell">'
        +'<div class="mm'+(hasDev?'':' solo')+(isNow?' now':'')+(isPast?' past':'')+'">'
        +'<div class="mm-h"><b>'+m.label+'월</b><span>'+m.n+'주</span>'+tag+'</div>'
        +'<div class="mm-sec"><div class="mm-s">'+(hasDev?'패키지 셋업':'진행 항목')+'</div><ul>'+li(gs,false)+'</ul></div>'
        +(hasDev?'<div class="mm-sec dv-sec"><div class="mm-s">추가개발</div><ul>'+li(ds,true)+'</ul></div>':'')
        +'</div>'
        +(msl.length ? '<div class="ms-col">'
            +(chips.length?chips.join(''):'<span class="ms-none">&mdash;</span>')+'</div>' : '')
        +'</div>';
    }).join('');
    var mm=$('mmap');
    /* 가능하면 한 줄에 다 넣는다. 칸이 많아지면 여백·글자를 줄여 버틴다.
       좁은 화면에서는 CSS 미디어쿼리가 접는데, 칩이 카드와 같은 셀이라 접혀도 안 어긋난다. */
    var n=months.length;
    mm.style.setProperty('--cols', n);
    mm.className = 'mmap' + (n>=7 ? ' tight' : '');
    mm.innerHTML=html;

    /* 두 트랙의 높이 배분 — 항목 수만으로는 정할 수 없다. 이름이 길면 두 줄로 감기고,
       그건 카드 폭(=칸 수·화면 폭)에 따라 달라진다. 그래서 세지 않고 잰다.
       자연 높이로 한 번 풀어 재고 가장 큰 값을 전 카드에 공통으로 준다.
       ⇒ 프로젝트마다 필요한 만큼만 갖고(패키지가 많으면 패키지가 커진다), 구분선은 가로로 맞는다. */
    function fitTracks(){
      mm.classList.add('measuring');
      var secs=mm.querySelectorAll('.mm-sec'), p=0, d=0, i, s, cs, h;
      for(i=0;i<secs.length;i++){
        s=secs[i]; cs=getComputedStyle(s);
        /* 트랙이 품어야 할 높이 = 테두리까지 포함한 박스 + 위아래 마진.
           scrollHeight 만 쓰면 추가개발 쪽 구분선(border 1 + margin 2)만큼 모자란다. */
        h=Math.ceil(s.getBoundingClientRect().height
          + (parseFloat(cs.marginTop)||0) + (parseFloat(cs.marginBottom)||0));
        if(s.className.indexOf('dv-sec')>=0){ if(h>d) d=h; }
        else if(h>p) p=h;
      }
      mm.classList.remove('measuring');
      /* 상한 — 유난히 몰린 달이 있어도 카드가 화면을 넘기지 않게. 넘치면 영역 안에서 스크롤된다. */
      mm.style.setProperty('--pkgh', Math.min(p,300)+'px');
      mm.style.setProperty('--devh', Math.min(d,300)+'px');
    }
    fitTracks();
    var fitT=null;                              /* 폭이 바뀌면 줄바꿈이 달라지므로 다시 잰다 */
    window.addEventListener('resize', function(){
      clearTimeout(fitT); fitT=setTimeout(fitTracks,150);
    });

    var cards=mm.querySelectorAll('.mm');
    for(var ci=0; ci<cards.length; ci++){
      (function(el,ws){
        el.setAttribute('role','button'); el.setAttribute('tabindex','0');
        el.addEventListener('click', function(){ if(gotoWeek) gotoWeek(ws); });
        el.addEventListener('keydown', function(ev){
          if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); if(gotoWeek) gotoWeek(ws); }
        });
      })(cards[ci], months[ci].ws);
    }

  })();

  /* ── 스코어 패널 ── */
  (function(){
    function tile(label,v,sub,hl,color){
      return '<div class="sc"><div class="sc-l">'+esc(label)+'</div>'
        +'<div class="sc-v'+(hl?' hl':'')+'">'+pc(v)+'<small>%</small></div>'
        +'<div class="trk"><i style="width:'+pc(v)+'%;background:'+color+'"></i></div>'
        +'<div class="sc-s">'+esc(sub)+'</div></div>';
    }
    var tiles;
    if(hasDev){
      tiles=[ tile('종합 진척률',pAll,'패키지 '+pc(DATA.weights.pkg/wSum)+'% + 추가개발 '+pc(DATA.weights.dev/wSum)+'% 가중',true,CL.sky),
              tile('패키지 셋업',pPkg,pkgItems.length+'개 작업',false,CL.white),
              tile('추가개발',pDev,(P.devMD?P.devMD+' M/D':'')+(P.devCount?' ('+P.devCount+'건)':''),false,CL.dev) ];
    } else {
      tiles=[ tile('전체 진척률',pAll,pkgItems.length+'개 작업',true,CL.sky),
              tile('현재 주차',curWeek/NW,curWeek+' / '+NW+'주 경과',false,CL.white) ];
    }
    $('scores').style.setProperty('--sccols', tiles.length);
    $('scores').innerHTML=tiles.join('');
  })();

  /* ── 간트 ── */
  (function(){
    var cols='repeat('+NW+',minmax(33px,1fr))';
    var msMark={}, lm=null;
    weeks.forEach(function(w,i){ if(w.s.getMonth()!==lm){ msMark[i]=1; lm=w.s.getMonth(); } });
    var runs=[],run=1;
    weeks.forEach(function(w,i){ if(i>0&&w.s.getMonth()===weeks[i-1].s.getMonth())run++;
      else{ if(i>0)runs.push(run); run=1; } });
    runs.push(run);

    var h='<div class="gh"><div class="gh-l">단계 및 작업</div><div class="gh-r">';
    h+='<div style="display:grid;grid-template-columns:'+runs.map(function(r){return r+'fr';}).join(' ')+'">';
    var idx=0; runs.forEach(function(r){ h+='<div class="gm">'+(weeks[idx].s.getMonth()+1)+'월</div>'; idx+=r; });
    h+='</div><div style="display:grid;grid-template-columns:'+cols+'">';
    weeks.forEach(function(w,i){
      h+='<div class="gw'+((i+1)===curWeek?' now':'')+'" title="'+(i+1)+'주차 '+md(w.s)+'~'+md(w.e)+'">'
        +'<b>'+(i+1)+'</b><i>'+md(w.s)+'</i></div>'; });
    h+='</div></div></div>';

    function cells(){ var c=''; for(var i=0;i<NW;i++) c+='<u'+(msMark[i]?' class="ms"':'')+'></u>'; return c; }
    function live(s,e){ return curWeek>0 && s<=curWeek && e>=curWeek; }
    function bar(it,k){
      return '<div class="gb '+k+(it.st==='todo'?' todo':'')+'" style="left:'+((it.s-1)/NW*100)
        +'%;width:'+(span(it)/NW*100)+'%" title="'+esc(it.n)+' / '+md(weeks[it.s-1].s)+'~'+md(weeks[it.e-1].e)+'"></div>';
    }
    var rows='';
    function grp(label,items,sp){
      var s=(sp&&sp.s) || Math.min.apply(null,items.map(function(i){return i.s;}));
      var e=(sp&&sp.e) || Math.max.apply(null,items.map(function(i){return i.e;}));
      rows+='<div class="gr grp'+(live(s,e)?' live':'')+'" data-s="'+s+'" data-e="'+e+'">'
        +'<div class="gn"><span class="nm">'+esc(label)+'</span></div>'
        +'<div class="gc" style="grid-template-columns:'+cols+'">'+cells()
        +'<div class="gb g" style="left:'+((s-1)/NW*100)+'%;width:'+((e-s+1)/NW*100)+'%"></div></div></div>';
    }
    function row(it,k){
      rows+='<div class="gr'+(live(it.s,it.e)?' live':'')+'" data-s="'+it.s+'" data-e="'+it.e+'">'
        +'<div class="gn"><span class="nm">'+esc(it.n)+'</span></div>'
        +'<div class="gc" style="grid-template-columns:'+cols+'">'+cells()+bar(it,k)+'</div></div>';
    }
    DATA.pkg.forEach(function(g){ grp(g.group,g.items,g.span); g.items.forEach(function(i){ row(i,'p'); }); });
    if(hasDev){ grp('추가개발',DATA.dev,DATA.devSpan); DATA.dev.forEach(function(i){ row(i,'d'); }); }

    var nl=null;
    if(today>=START && today<=new Date(+START+NW*7*DAY-1))
      nl=Math.min(1, Math.max(0, (today-START)/DAY/(NW*7)));
    var lpos = nl!==null ? 'left:calc(200px + (100% - 200px) * '+nl+')' : '';

    $('g-lg').innerHTML='<span><i class="sw g"></i>모듈 전체 구간</span>'
      + (hasDev ? '<span><span class="pair"><i class="sw p"></i><i class="sw d"></i></span>진행 구간 (패키지 / 추가개발)</span>'
                : '<span><i class="sw p"></i>진행 구간</span>');
    $('gantt').innerHTML='<div class="gwrap"><div class="ghead">'
      +(nl!==null ? '<span class="nowtag" style="'+lpos+'">오늘 '+md(today)+'</span>' : '')+h+'</div>'
      +rows+(nl!==null ? '<div class="nowl" style="'+lpos+'"></div>' : '')+'</div>';
    $('g-m').textContent=ymd(START)+' ~ '+ymd(END)+', 총 '+NW+'주'
      +(clipped?' · 기간을 벗어난 행 '+clipped+'건을 마지막 주로 맞췄습니다':'');

    function headOff(gs){
      var hd=gs.querySelector('.ghead');
      var hh=(hd&&hd.getBoundingClientRect)?hd.getBoundingClientRect().height:0;
      return (hh>0?hh:76)+10;
    }
    function toToday(){
      var gs=$('gs'); if(!gs) return;
      if(nl!==null) gs.scrollLeft=Math.max(0, 200+(gs.scrollWidth-200)*nl-gs.clientWidth*0.33);
      var lv=gs.querySelector('.gr.live');
      if(lv){
        var a=gs.getBoundingClientRect(), b=lv.getBoundingClientRect();
        gs.scrollTop += (b.top-a.top) - headOff(gs);
      }
    }
    gotoWeek=function(w){
      show('p-wbs');
      var run=function(){
        var gs=$('gs'); if(!gs) return;
        gs.scrollLeft=Math.max(0, 200+(gs.scrollWidth-200)*((w-1)/NW)-gs.clientWidth*0.14);
        var rs=gs.querySelectorAll('.gr[data-s]');
        for(var i=0;i<rs.length;i++){
          if(+rs[i].getAttribute('data-s')<=w && +rs[i].getAttribute('data-e')>=w){
            var a=gs.getBoundingClientRect(), b=rs[i].getBoundingClientRect();
            gs.scrollTop += (b.top-a.top) - headOff(gs);
            break;
          }
        }
        var host=(gs.closest && gs.closest('.card')) || gs;
        var top=host.getBoundingClientRect().top
          + (window.pageYOffset || document.documentElement.scrollTop || 0) - 68;
        try{ window.scrollTo({top:top, behavior:'smooth'}); }catch(e){ window.scrollTo(0, top); }
      };
      if(window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run,0);
    };
    var jb=$('jump');
    if(curWeek>0){
      if(jb) jb.addEventListener('click',toToday);
      if(window.requestAnimationFrame) requestAnimationFrame(toToday); else setTimeout(toToday,0);
    } else if(jb) jb.style.display='none';
  })();

  /* ── 패키지 진척 (모듈별 6단계) ── */
  if($('p-pkg')) (function(){
    var el=$('pkgtbl'); if(!el) return;
    var L=DATA.pkgSteps||[];
    var cell=function(v){
      if(v==='완료') return '<span class="stp done">완료</span>';
      if(v==='진행중'||v==='진행') return '<span class="stp doing">진행</span>';
      if(v==='해당없음'||v==='없음'||v==='-') return '<span class="stp na">해당없음</span>';
      return '<span class="stp todo">미착수</span>';
    };
    var doneMods=0;
    var body=L.map(function(p){
      var v=stepPct(p); if(v>=1) doneMods++;
      return '<tr><td><b>'+esc(p.mod)+'</b></td>'
        +PSTEPS.map(function(k){ return '<td class="ctr">'+cell(p.steps[k])+'</td>'; }).join('')
        +'<td style="width:22%"><div class="mbar"><i style="width:'+pc(v)+'%"></i></div></td>'
        +'<td class="r"><span class="mpct'+(v>0?' on':'')+'">'+pc(v)+'%</span></td></tr>';
    }).join('');
    el.innerHTML='<thead><tr><th>모듈</th>'
      +PSTEPS.map(function(k){ return '<th class="ctr">'+esc(k)+'</th>'; }).join('')
      +'<th>진척</th><th class="r">달성률</th></tr></thead><tbody>'+body+'</tbody>';
    $('pkg-m').textContent=doneMods+' / '+L.length+'개 모듈 완료';
  })();

  /* ── 방문 및 회의 일정 ── */
  if($('p-sch')) (function(){
    var L=DATA.schedule||[];
    var KIND={'방문':'blue','회의':'blue','교육':'grey','온라인':'line'};
    var rows=L.map(function(x){
      var dt=x.tbd?null:parseYmd(x.d), past=!x.tbd && dt<today, isNext=(x===nextSch);
      return '<tr class="'+(past?'sch-past':(isNext?'sch-next':''))+'">'
        +'<td class="mn">'+(x.tbd ? '<b style="color:var(--muted48)">미정</b>'
            : '<b style="color:var(--ink)">'+ymd(dt)+'</b>('+DOW[dt.getDay()]+')')+'</td>'
        +'<td class="mn">'+esc(x.time||'—')+'</td>'
        +'<td>'+(x.kind?'<span class="tag '+(KIND[x.kind]||'line')+'">'+esc(x.kind)+'</span>':'')+'</td>'
        +'<td><b>'+esc(x.n)+'</b>'
        +(x.memo?'<div class="dt" style="margin-top:5px">'+rich(x.memo)+'</div>':'')+'</td>'
        +'<td class="mn">'+esc(x.place||'—')+'</td>'
        +'<td class="mn">'+esc(x.who||'—')+'</td>'
        +'<td>'+(x.tbd?'<span class="tag grey">미정</span>'
                     :(past?'<span class="tag line">완료</span>'
                     :(isNext?'<span class="tag blue">다음</span>':'<span class="tag line">예정</span>')))+'</td>'
        +'</tr>';
    }).join('');
    $('schtbl').innerHTML='<thead><tr><th>일자</th><th>시각</th><th>구분</th><th>내용</th>'
      +'<th>장소</th><th>참석자</th><th>상태</th></tr></thead><tbody>'+rows+'</tbody>';
    var done=L.filter(function(x){ return !x.tbd && parseYmd(x.d)<today; }).length;
    $('sch-m').textContent='전체 '+L.length+'건 · 지난 일정 '+done+'건 · 예정 '+(L.length-done)+'건';
  })();

  /* ── 주간 업무 ── */
  if($('p-week')) (function(){
    var byWk={}; (DATA.weekly||[]).forEach(function(w){ byWk[w.week]=w; });
    var full=[];
    for(var i=1;i<=NW;i++){
      full.push(byWk[i] || { week:i, title:'',
        period: ymd(weeks[i-1].s)+' ~ '+md(weeks[i-1].e), done:[], next:[], req:[] });
    }
    var has=function(w){ return (w.done&&w.done.length)||(w.next&&w.next.length)||(w.req&&w.req.length); };
    var written=full.filter(has);
    var yr=new RegExp('(?:'+START.getFullYear()+'|'+END.getFullYear()+')\\.','g');
    var lab=function(w){
      return (w.week?w.week+'주차':'착수 전')
        +(w.period?' ('+String(w.period).replace(yr,'')+')':'')
        +(has(w)?'':' — 미작성');
    };
    var def = curWeek>0 ? Math.min(curWeek,NW) : 1;
    var sel=$('wk-sel'), box=$('weeklog');
    sel.innerHTML='<option value="all">전체 보기 (작성된 주차)</option>'
      +full.map(function(w){
        return '<option value="'+w.week+'"'+(w.week===def?' selected':'')+'>'+esc(lab(w))+'</option>';
      }).join('');
    $('wk-m').textContent='작성 '+written.length+'주차 / 전체 '+full.length+'주차';

    var ordered=written.filter(function(w){ return w.week===curWeek; })
      .concat(written.filter(function(w){ return w.week!==curWeek; })
                     .sort(function(a,b){ return b.week-a.week; }));

    function block(w){
      var li=function(a){ return (a||[]).map(function(t){ return '<li>'+rich(t)+'</li>'; }).join(''); };
      var badge = w.week===curWeek ? '<span class="tag blue">이번 주</span>'
                : (w.week>curWeek ? '<span class="tag line">예정</span>'
                                  : '<span class="tag line">지난 주차</span>');
      var body = has(w)
        ? (w.done&&w.done.length?'<h4>금주 실적</h4><ul>'+li(w.done)+'</ul>':'')
          +(w.next&&w.next.length?'<h4>차주 계획</h4><ul>'+li(w.next)+'</ul>':'')
          +(w.req&&w.req.length?'<h4 class="req">고객사 요청사항</h4><ul class="req">'+li(w.req)+'</ul>':'')
        : '<div class="empty" style="padding:22px 0">아직 등록된 내용이 없습니다.</div>';
      return '<div class="wk"><div class="wk-l"><b>'+(w.week?w.week+'주차':'착수 전')+'</b>'
        +'<div class="pd">'+esc(w.period||'')+'</div>'
        +(w.title?'<div class="tt">'+esc(w.title)+'</div>':'')
        +badge+'</div><div class="wk-r">'+body+'</div></div>';
    }
    function paint(v){
      var list = v==='all' ? ordered : full.filter(function(w){ return String(w.week)===v; });
      box.innerHTML = list.map(block).join('') || '<div class="empty">작성된 주간업무가 아직 없습니다.</div>';
    }
    sel.addEventListener('change', function(){ paint(sel.value); });
    paint(String(def));
  })();

  /* ── 추가개발 ── */
  if($('p-dev')) (function(){
    $('dev-sub').textContent = P.devMD
      ? '총 '+P.devMD+' M/D'+(P.devCount?', 공수가 책정된 요건 '+P.devCount+'건':'')+'입니다.'
      : '추가개발 단계별 진척입니다.';
    if(DATA.hidePhase && $('dev-phase-card')) $('dev-phase-card').hidden=true;
    $('dev-m').textContent='진척률 '+pc(pDev)+'%';
    $('dev-phase').innerHTML='<thead><tr><th>단계</th><th>기간</th><th>주차</th><th>상태</th><th>비고</th></tr></thead><tbody>'
      +DATA.dev.map(function(it){
        var cls={done:'blue',doing:'red',todo:'line'}[it.st];
        return '<tr><td><b>'+esc(it.n)+'</b></td>'
          +'<td class="mn">'+md(weeks[it.s-1].s)+' ~ '+md(weeks[it.e-1].e)+'</td>'
          +'<td class="mn">'+it.s+'~'+it.e+'주차</td>'
          +'<td><span class="tag '+cls+'">'+({done:'완료',doing:'진행중',todo:'예정'}[it.st])+'</span></td>'
          +'<td class="dt">'+rich(it.memo||'')+'</td></tr>'; }).join('')+'</tbody>';

    var di=DATA.devItems||[];
    if(!di.length){ $('dev-items-card').hidden=true; return; }   /* 요건 탭 없으면 카드 자체를 뺀다 */

    /* 요구사항 검토서처럼 요건 전체를 다루는 문서·사이트를 여기서 바로 연다.
       설정 시트에 URL 이 없으면 버튼 자체가 나오지 않는다. */
    var ddu=safeUrl(DATA.devDocUrl), dd=$('dev-doc');
    if(ddu && dd){
      dd.href=ddu;
      dd.textContent=(DATA.devDocText||'요구사항 검토서 열기');
      dd.hidden=false;
    }
    var dn=di.filter(function(x){ return x.st==='done'; });
    var sum=function(a){ return a.reduce(function(p,c){ return p+c.md; },0); };
    /* 계획일은 넣은 프로젝트에서만 칸이 생긴다. 한 건도 없으면 열 자체를 만들지 않는다. */
    var hasPlan=di.some(function(x){ return x.ps || x.pe; });
    var planTxt=function(x){
      if(!x.ps && !x.pe) return '—';
      var e=x.pe;
      if(x.ps && e && x.ps.slice(0,5)===e.slice(0,5)) e=e.slice(5);   /* 같은 해면 끝 날짜의 연도 생략 */
      return esc(x.ps) + (e ? ' ~ '+esc(e) : '');
    };
    $('dev-items').innerHTML='<thead><tr><th class="r">No</th><th>구분</th><th>요건명</th>'
      +'<th class="r">M/D</th>'+(hasPlan?'<th>계획</th>':'')+'<th>담당</th><th>상태</th></tr></thead><tbody>'
      +di.map(function(x){
        var cls={done:'blue',doing:'red',todo:'line'}[x.st];
        return '<tr><td class="r mn">'+esc(x.no)+'</td><td class="mn">'+esc(x.cat)+'</td><td>'+esc(x.name)+'</td>'
          +'<td class="r">'+(x.md||'')+'</td>'
          +(hasPlan?'<td class="mn">'+planTxt(x)+'</td>':'')
          +'<td class="mn">'+esc(x.owner||'')+'</td>'
          +'<td><span class="tag '+cls+'">'+({done:'완료',doing:'진행중',todo:'대기'}[x.st])+'</span></td></tr>'; }).join('')
      +'</tbody>';
    /* 단계 표를 감췄으면 진척률 뱃지가 그 카드와 함께 사라지므로 여기로 옮겨 붙인다 */
    $('dev-im').textContent=(DATA.hidePhase?'진척률 '+pc(pDev)+'% · ':'')
      +dn.length+' / '+di.length+'건 완료, '+sum(dn)+' / '+sum(di)+' M/D';
  })();

  /* ── 교육 녹화본 ── */
  if($('p-rec')) (function(){
    var MC={'조직/인사':'m-org','평가':'m-eval','근태':'m-att','급여/세무':'m-pay',
            '교육':'m-edu','신청서':'m-req','모바일':'m-sys','시스템':'m-sys'};
    var DOW=['일','월','화','수','목','금','토'];
    var R=DATA.recordings||[];
    var order=[], byMod={};
    R.forEach(function(r){ if(!byMod[r.mod]){ byMod[r.mod]=[]; order.push(r.mod); } byMod[r.mod].push(r); });
    var rows='';
    order.forEach(function(mod){
      byMod[mod].forEach(function(r,k){
        var dt=r.date?parseYmd(r.date):null;
        var dtxt = dt ? '<b style="color:var(--ink)">'+ymd(dt)+'</b>('+DOW[dt.getDay()]+')' : '—';
        var nm=esc(r.title || '(제목 없음)');
        var u=safeUrl(r.url);
        var link = u ? '<a href="'+u+'" target="_blank" rel="noopener">'+nm+'</a>' : '<span class="mn">'+nm+'</span>';
        rows+='<tr>'
          +(k===0?'<td class="grp" rowspan="'+byMod[mod].length+'"><span class="rmod '
                  +(MC[mod]||'m-sys')+'">'+esc(mod)+'</span></td>':'')
          +'<td class="mn">'+dtxt+'</td><td class="mn">'+esc(r.topic)+'</td>'
          +'<td class="mn">'+((r.who&&r.who.length)?r.who.map(esc).join('<br>'):'—')+'</td>'
          +'<td>'+link+'</td>'
          +'<td>'+(u?'<span class="tag blue">등록</span>':'<span class="tag line">예정</span>')+'</td></tr>';
      });
    });
    $('recs').innerHTML='<thead><tr><th>모듈</th><th>일자</th><th>내용</th><th>참여자</th><th>링크</th><th>상태</th></tr></thead><tbody>'+rows+'</tbody>';
    var done=R.filter(function(r){ return !!r.url; }).length;
    $('rec-m').textContent=done+' / '+R.length+'회차 등록, '+order.length+'개 모듈';
    if($('n-rec')) $('n-rec').textContent=done+'/'+R.length;
  })();

  /* ── 산출물 ── */
  if($('p-doc')){
    $('docs').innerHTML='<thead><tr><th>구분</th><th>문서명</th><th>배포일</th><th>담당</th><th>상태</th></tr></thead><tbody>'
      +DATA.docs.map(function(d){
        var u=safeUrl(d.url), ext=/^https?:/i.test(u);
        var nm = u ? '<a class="dl" href="'+u+'"'+(ext?' target="_blank" rel="noopener"':' download')+'>'
                     +esc(d.name)+'<u>'+(ext?'열기':'다운로드')+'</u></a>' : esc(d.name);
        var cls={done:'blue',doing:'red',todo:'line'}[d.st];
        return '<tr><td class="mn">'+esc(d.cat)+'</td><td>'+nm+'</td>'
          +'<td class="mn">'+esc(d.date||'—')+'</td><td class="mn">'+esc(d.owner||'')+'</td>'
          +'<td><span class="tag '+cls+'">'+({done:'배포',doing:'작성중',todo:'예정'}[d.st])+'</span></td></tr>'; }).join('')
      +'</tbody>';
    if($('n-doc')) $('n-doc').textContent=DATA.docs.filter(function(d){ return d.st==='done'; }).length+'/'+DATA.docs.length;
  }

  /* ── 이슈 ── */
  if($('p-iss')){
    var sm=$('iss-sum');
    if(DATA.issueSummary) sm.innerHTML='<span class="lb">공통 사유</span><span class="ct">'+rich(DATA.issueSummary)+'</span>';
    else sm.style.display='none';
    $('issues').innerHTML='<thead><tr><th>영향도</th><th>항목</th><th>원인</th><th>대응 방안</th><th>담당</th><th>기한</th></tr></thead><tbody>'
      +DATA.issues.map(function(x){
        var lvc = x.lv==='높음'?'red':'grey';
        var cc  = String(x.cause).indexOf('자원')>=0?'red':'grey';
        return '<tr><td><span class="tag '+lvc+'">'+esc(x.lv)+'</span></td>'
          +'<td><b>'+esc(x.title)+'</b><div class="dt" style="margin-top:5px">'+rich(x.detail)+'</div></td>'
          +'<td><span class="tag '+cc+'">'+esc(x.cause)+'</span></td>'
          +'<td class="dt">'+rich(x.action)+'</td><td class="mn">'+esc(x.owner)+'</td>'
          +'<td class="mn">'+esc(x.due)+'</td></tr>'; }).join('')
      +'</tbody>';
    if($('n-iss')) $('n-iss').textContent=DATA.issues.filter(function(i){ return i.lv==='높음'; }).length+'/'+DATA.issues.length;
  }

  /* ── 탭 ── */
  var tabs=Array.prototype.slice.call(document.querySelectorAll('.tab'));
  function show(id){
    tabs.forEach(function(t){
      var on=t.getAttribute('data-p')===id;
      t.setAttribute('aria-selected',on?'true':'false');
      var el=$(t.getAttribute('data-p')); if(el) el.hidden=!on;
    });
  }
  tabs.forEach(function(t){ t.addEventListener('click',function(){ show(t.getAttribute('data-p')); }); });
  /* 새로고침·재방문 시 항상 첫 탭(WBS 일정)에서 시작한다. 마지막 탭을 주소에 기억하지 않는다. */

  if(window.console && console.info){
    console.info('[현황판 v'+VER+'] 데이터 로드 완료 ('+(PLAIN?'평문':'암호문')+')');
    (warn||[]).forEach(function(w){ console.warn('[현황판] '+w); });
  }
}

/* ══════════════════════════════════════════════════════════════
   부팅
   ══════════════════════════════════════════════════════════════ */
function boot(password, onBadPw){
  loadWorkbook(password).then(function(t){
    UNLOCKED = true;
    if(!SRC.some(function(k){ return t[k] && t[k].length; })){
      fail('데이터 파일에서 읽을 내용이 없습니다.',
        '데이터 엑셀 안에 <code>설정</code> · <code>WBS</code> 시트가 있는지 확인해 주세요. '
        +'담당 PM에게 알려 주시면 바로 조치하겠습니다.');
      return;
    }

    var b=build(t);
    if(b.err){ fail('시트를 읽는 중 문제가 있습니다.', esc(b.err)); return; }

    /* 🔴 탭 노출 = 시트에 그 탭이 있고 내용이 있는가. 스위치를 따로 두지 않는다. */
    var D=b.data;
    var hidden={}; (D.hide||[]).forEach(function(x){ hidden[x]=1; });
    var TABDEF=[
      {id:'p-wbs',  label:'WBS 일정', src:'WBS',    on:true},
      {id:'p-sch',  label:'방문·회의', src:'일정',   on:D.schedule.length>0},
      {id:'p-pkg',  label:'패키지 진척', src:'패키지진척', on:(D.pkgSteps||[]).length>0},
      {id:'p-week', label:'주간 업무', src:'주간업무', on:D.weekly.length>0},
      {id:'p-dev',  label:'추가개발',  src:'WBS',    on:D.dev.length>0},
      {id:'p-rec',  label:'녹화본',    src:'녹화본',  on:D.recordings.length>0},
      {id:'p-doc',  label:'산출물',    src:'산출물',  on:D.docs.length>0},
      {id:'p-iss',  label:'이슈',      src:'이슈',    on:D.issues.length>0}
    ];
    var tabs=TABDEF.filter(function(x){ return x.on && !hidden[x.src] && !hidden[x.label]; });

    mount(tabs);
    try{
      render(D, b.warn);
    }catch(e){
      fail('화면을 그리는 중 오류가 발생했습니다.',
        '시트 값 중 형식이 맞지 않는 항목이 있을 수 있습니다. 담당 PM에게 알려 주세요.'
        +'<br><br><code>'+esc(e && e.message ? e.message : e)+'</code>');
      return;
    }
    /* 🔴 잠금 해제는 성공했을 때만. 실패하면 위 fail() 이 안내 화면을 남긴다. */
    if($('gate')) $('gate').className='off';
  }).catch(function(e){
    var m = e && e.message ? e.message : String(e);
    /* 복호화 실패 = 비밀번호 오류. 안내 화면이 아니라 잠금 화면에서 다시 묻는다. */
    if(m===BAD_PW && onBadPw){ onBadPw(); return; }
    if(m==='NO_CRYPTO'){
      fail('이 브라우저에서는 열 수 없습니다.',
        '암호를 푸는 기능(WebCrypto)을 쓸 수 없습니다. '
        +'<b>https</b> 주소로 접속했는지, 최신 브라우저인지 확인해 주세요.');
      return;
    }
    fail('데이터 파일을 불러오지 못했습니다.',
      '<code>'+esc(DATA_URL)+'</code> 를 찾을 수 없거나 형식이 올바르지 않습니다.'
      +'<br><br><code>'+esc(m)+'</code>');
  });
}

/* ── 열람 잠금 ───────────────────────────────────
   비밀번호 대조를 따로 하지 않습니다. 비밀번호가 곧 복호화 키이고,
   복호화에 성공하는 것이 인증입니다. (해시를 심을 필요가 없습니다)
   ──────────────────────────────────────────────── */
function gate(){
  var pw=$('gate-pw'), go=$('gate-go'), msg=$('gate-msg'), card=$('gate-card');
  var busy=false;

  /* 이전 버전에서 저장된 통과 기록 제거 */
  try{
    if(window.localStorage){
      var i, dead=[];
      for(i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k && k.indexOf('byn-board-')===0) dead.push(k);
      }
      for(i=0;i<dead.length;i++) localStorage.removeItem(dead[i]);
    }
  }catch(e){}

  function reject(){
    busy=false;
    if(go) go.disabled=false;
    if(pw){ pw.disabled=false; pw.value=''; pw.focus(); }
    if(msg){ msg.style.color='var(--over)'; msg.textContent='비밀번호가 맞지 않습니다.'; }
    if(card){ card.className='gate-card'; void card.offsetWidth; card.className='gate-card bad'; }
  }

  function submit(){
    if(busy) return;
    var v=(pw && pw.value || '');
    if(!v){ if(pw) pw.focus(); return; }
    busy=true;
    if(go) go.disabled=true;
    if(pw) pw.disabled=true;
    if(msg){ msg.style.color='var(--muted48)'; msg.textContent='확인 중입니다'; }
    boot(v, reject);
  }

  if(go) go.addEventListener('click', submit);
  if(pw){
    pw.addEventListener('keydown', function(e){ if(e.key==='Enter') submit(); });
    pw.addEventListener('input', function(){ if(msg && !busy) msg.textContent=''; });
    setTimeout(function(){ try{ pw.focus(); }catch(e){} }, 60);
  }
}

function start(){
  /* 새로고침 시 브라우저가 이전 스크롤 위치를 복원하지 않게 한다 (항상 메인 상단에서 시작) */
  if('scrollRestoration' in history){ try{ history.scrollRestoration='manual'; }catch(e){} }
  mount([{id:'p-wbs',label:'WBS 일정'}]);        /* 잠금 화면용 최소 셸 */
  if(typeof XLSX==='undefined'){
    fail('엑셀 리더가 로드되지 않았습니다.',
      '<code>index.html</code> 에 <code>&lt;script src="../app/xlsx.mini.js"&gt;&lt;/script&gt;</code> 가 '
      +'<code>board.js</code> 보다 <b>앞에</b> 있어야 합니다.');
    return;
  }
  if(PLAIN){ $('gate').className='off'; boot(null, null); }
  else gate();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();

})();
