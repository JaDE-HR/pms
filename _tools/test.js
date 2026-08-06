/* ══════════════════════════════════════════════════════════════
   표준 앱 회귀 테스트

     cd _tools && npm install && node test.js

   app/board.js 를 고친 뒤 반드시 돌리세요. 전 항목이 통과해야 합니다.
   data.xlsx 를 메모리에서 만들어 fetch 를 가로채, 전체 파이프라인
   (엑셀 파싱 → 모델 → 렌더)을 실제 DOM 위에서 검사합니다.

   특히 D(기간 밖 주차)와 E(XSS)는 원본 템플릿에서 실제로
   화면이 죽거나 뚫렸던 지점입니다.
   ══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const X = require('xlsx');

const APP = 'D:/HCG/JaDE-PMS/app/';
const BOARD = fs.readFileSync(APP + 'board.js', 'utf8');
const XLSXLIB = fs.readFileSync(APP + 'xlsx.mini.js', 'utf8');

/* ── 엑셀 픽스처 ─────────────────────────────────────────── */
const WEEKS = Array.from({ length: 24 }, (_, i) => `${i + 1}주`);
const wbsHead = ['구분', '모듈', '작업', '상태', '진척률', '비고', ...WEEKS];
function wrow(g, m, t, s, a, b, memo = '', pct = '') {
  const r = [g, m, t, s, pct, memo, ...Array(24).fill('')];
  for (let w = a; w <= b; w++) r[5 + w] = '■';
  return r;
}
function book(sheets) {
  const wb = X.utils.book_new();
  for (const name of Object.keys(sheets)) {
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(sheets[name]), name);
  }
  const buf = X.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const FIX = {
  '안내': [['이 시트는 화면에 나오지 않습니다']],
  '설정': [['항목', '값'],
    ['프로젝트명', '아이센스 인사시스템 재구축'],
    ['고객사명', '아이센스'], ['수행사', '휴먼컨설팅그룹'],
    ['시작일', new Date(2026, 7, 3)],          /* 엑셀 날짜셀 */
    ['종료일', '2027-01-12'],                  /* 글자 날짜 */
    ['오픈일', '2027-01-04'],
    ['추가개발MD', 355], ['추가개발건수', 23],
    ['가중치_패키지', 0.45], ['가중치_추가개발', 0.55],
    ['이슈요약', '선행조건 <b>회신 시점</b>이 핵심 변수입니다.'],
  ],
  'WBS': [wbsHead,
    wrow('패키지', '프로젝트 준비', '', '', 1, 3, '전체구간'),
    wrow('패키지', '프로젝트 준비', '개발서버 설정', '완료', 1, 1),
    wrow('패키지', '프로젝트 준비', '공통코드 등록', '진행중', 1, 2),
    wrow('패키지', '조직/인사', '업무요건 상세', '예정', 2, 4, '', 0.3),
    wrow('추가개발', '추가개발', '', '', 3, 23, '전체구간'),
    wrow('추가개발', '추가개발', '업무분석', '완료', 3, 4, '요건정의서 확정'),
    wrow('추가개발', '추가개발', '개발', '예정', 8, 20),
  ],
  '마일스톤': [['이름', '일자'],
    ['킥오프 미팅', new Date(2026, 7, 3)],
    ['시스템 오픈', new Date(2026, 11, 4)]],
  '주간업무': [['주차', '기간', '제목', '구분', '내용'],
    [1, '2026.08.03 ~ 08.09', '킥오프', '실적', '킥오프 미팅 진행'],
    [1, '', '', '계획', '공통코드 등록'],
    [1, '', '', '요청', '기초데이터 <b>08.10 마감</b>'],
  ],
  '요건': [['No', '구분', '요건명', 'M/D', '담당', '상태', '계획시작', '계획종료'],
    [1, '인사', '발령일괄등록', 20, '개발팀', '완료', new Date(2026, 7, 24), '2026-08-28'],
    [2, '교육', '교육관리 컨버전', 40, '개발팀', '대기', '', ''],
  ],
  '녹화본': [['모듈', '회차', '일자', '내용', '참여자', '제목', '링크'],
    ['조직/인사', 1, new Date(2026, 7, 17), '사용자 교육', '홍길동', '조직/인사 교육', 'https://ex.com/a'],
    ['근태', 1, '2026-09-07', '사용자 교육', '', '근태 교육', ''],
  ],
  '산출물': [['구분', '문서명', '배포일', '담당', '상태', '링크'],
    ['착수', '구축 WBS', new Date(2026, 7, 3), 'JaDE PM', '배포', 'https://drive.google.com/x'],
    ['설계', '요건정의서', '', '개발 PM', '예정', ''],
  ],
  '이슈': [['영향도', '원인', '항목', '상세', '대응방안', '담당', '기한'],
    ['높음', '일정/선행조건', '회신 지연', '요건 확정이 <b>회신일에 연동</b>됩니다.',
      '우선 회신 요청', 'JaDE PM', new Date(2026, 7, 10)],
  ],
};

/* ── 실행기 ─────────────────────────────────────────────── */
async function run(sheets, boardCfg = {}, opts = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>',
    { runScripts: 'outside-only', url: 'https://example.org/isens/', pretendToBeVisual: true });
  const w = dom.window;
  const errs = [];
  w.onerror = e => errs.push(String(e));
  w.BOARD = Object.assign({ plain: true }, boardCfg);

  /* jsdom 에는 WebCrypto 가 없다. Node 의 것을 끼워 넣어 복호화 경로를 실제로 태운다. */
  Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto, configurable: true });
  if (!w.TextEncoder) w.TextEncoder = TextEncoder;

  const buf = opts.buffer || (sheets ? book(sheets) : null);
  w.fetch = () => (opts.http404 || !buf)
    ? Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.reject(new Error('404')) })
    : Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(buf) });
  const logs = { warn: [], error: [], info: [] };
  w.console = { warn: m => logs.warn.push(m), error: m => logs.error.push(m), info: m => logs.info.push(m), log: () => {} };

  if (!opts.noLib) w.eval(XLSXLIB);
  w.eval(BOARD);
  for (let i = 0; i < 60; i++) await new Promise(r => setTimeout(r, 5));

  const d = w.document;
  return {
    dom, w, d, errs, logs,
    gateOff: d.getElementById('gate') && d.getElementById('gate').className === 'off',
    err: d.querySelector('.errbox') ? d.querySelector('.errbox').textContent.trim() : null,
    tabs: [...d.querySelectorAll('.tab')].map(t => t.textContent.replace(/\d+\/\d+$/, '').trim()),
    rows: d.querySelectorAll('.gr').length,
    bars: d.querySelectorAll('.gb').length,
    gm: (d.getElementById('g-m') || {}).textContent || '',
    stamp: (d.getElementById('stamp') || {}).textContent || '',
    scores: [...d.querySelectorAll('.sc-v')].map(e => e.textContent.trim()),
    pvw: (d.getElementById('pvw') || {}).textContent || '',
    html: d.body.innerHTML,
  };
}

let pass = 0, fail = 0;
const ok = (cond, label, extra) => cond
  ? (pass++, console.log('  [OK] ' + label))
  : (fail++, console.log('  [FAIL] ' + label + (extra ? '  -> ' + extra : '')));

(async () => {
  console.log('\n== A. 전체 시트 정상 ==');
  {
    const r = await run(FIX);
    ok(!r.err, '오류화면 없음', r.err);
    ok(r.gateOff, '화면 열림');
    ok(r.errs.length === 0, 'JS 예외 없음', r.errs.join('|'));
    ok(r.tabs.join(',') === 'WBS 일정,주간 업무,추가개발,녹화본,산출물,이슈', '탭 6개/순서', r.tabs.join(','));
    ok(r.rows === 8 && r.bars === 8, '간트 행 8 · 막대 8', `rows=${r.rows} bars=${r.bars}`);
    ok(r.scores.length === 3, '스코어 타일 3개', r.scores.join('/'));
    ok(/총 24주/.test(r.gm), '기간에서 24주 산출', r.gm);
    ok(!/기간을 벗어난/.test(r.gm), '클리핑 경고 없음', r.gm);
    ok(/2026\.08\.03 ~ 2027\.01\.12/.test(r.gm), '엑셀 날짜셀+글자 날짜 혼용 파싱', r.gm);
    ok(/발령일괄등록/.test(r.html), '요건 대장 렌더');
    ok(/60 M\/D/.test(r.html), '요건 M/D 집계', (r.html.match(/\d+ \/ \d+건 완료, \d+ \/ \d+ M\/D/) || [])[0]);
    ok(/2026\.08\.24 ~ 08\.28/.test(r.html), '요건 계획일 렌더 (같은 해면 끝 연도 생략)');
    ok(/26\.12\.04/.test(r.html), '마일스톤 날짜셀 파싱 (칩은 연도 2자리)');
    ok(/2026\.08\.17/.test(r.html), '녹화본 날짜셀 파싱');
    ok(/2026\.08\.03/.test(r.html), '산출물 배포일 날짜셀 → 표기 정규화');
    ok(/2026\.08\.10/.test(r.html), '이슈 기한 날짜셀 → 표기 정규화');
  }

  console.log('\n== B. 녹화본/이슈 시트 없음 -> 탭도 사라짐 ==');
  {
    const f = { ...FIX }; delete f['녹화본']; delete f['이슈'];
    const r = await run(f);
    ok(!r.err, '오류화면 없음', r.err);
    ok(r.tabs.length === 4, '탭 4개로 줄어듦', r.tabs.join(','));
    ok(!r.tabs.includes('녹화본') && !r.tabs.includes('이슈'), '녹화본/이슈 제거', r.tabs.join(','));
  }

  console.log('\n== B-2. 요건 계획일 열 없음 -> 「계획」 칸도 안 생김 ==');
  {
    const f = { ...FIX };
    f['요건'] = [['No', '구분', '요건명', 'M/D', '담당', '상태'],
      [1, '인사', '발령일괄등록', 20, '개발팀', '완료']];
    const r = await run(f);
    ok(!r.err, '오류화면 없음', r.err);
    ok(/발령일괄등록/.test(r.html), '요건 대장은 그대로 렌더');
    ok(!/<th>계획<\/th>/.test(r.html), '계획 열 미생성 (계획일 없는 프로젝트 호환)');
  }

  console.log('\n== C. 추가개발 없음 -> 단일 트랙 ==');
  {
    const f = { ...FIX };
    f['WBS'] = [wbsHead, wrow('패키지', '준비', '', '', 1, 3), wrow('패키지', '준비', '개발서버 설정', '완료', 1, 1)];
    const r = await run(f);
    ok(!r.err, '오류화면 없음', r.err);
    ok(!r.tabs.includes('추가개발'), '추가개발 탭 사라짐', r.tabs.join(','));
    ok(r.scores.length === 2, '스코어 타일 2개로 축소', r.scores.join('/'));
    ok(/solo/.test(r.html), '월별카드 단일 트랙 레이아웃');
  }

  console.log('\n== D. [원본 치명결함] 기간 밖 주차 ==');
  {
    const f = { ...FIX };
    f['WBS'] = [[...wbsHead, '30주', '31주'],
      [...wrow('패키지', '준비', '개발서버 설정', '완료', 1, 1), '', ''],
      ['패키지', '준비', '범위밖 작업', '예정', '', '', ...Array(24).fill(''), '■', '■']];
    const r = await run(f);
    ok(!r.err, '죽지 않고 렌더됨', r.err);
    ok(r.gateOff, '화면이 열림 (백지 아님)');
    ok(/기간을 벗어난 행 1건/.test(r.gm), '클리핑 사실을 화면에 알림', r.gm);
  }

  console.log('\n== E. [원본 치명결함] XSS ==');
  {
    const f = { ...FIX };
    f['이슈'] = [['영향도', '원인', '항목', '상세', '대응방안', '담당', '기한'],
      ['높음', '자원/공수', '<script>alert(1)</script>',
        '<img src=x onerror="alert(1)"> 그리고 <b>진짜 굵게</b>',
        '<b onclick="alert(1)">속성 달린 b</b>', 'PM', '상시']];
    f['산출물'] = [['구분', '문서명', '배포일', '담당', '상태', '링크'],
      ['착수', '악성링크', '', 'PM', '배포', 'javascript:alert(1)']];
    const r = await run(f);
    ok(r.d.querySelectorAll('script').length === 0, 'script 노드 0개');
    ok(r.d.querySelectorAll('[onerror]').length === 0, 'onerror 속성 노드 0개');
    ok(r.d.querySelectorAll('[onclick]').length === 0, 'onclick 속성 노드 0개');
    ok([...r.d.querySelectorAll('img')].every(i => i.src.startsWith('data:')), '주입된 img 없음 (로고만)');
    ok(/&lt;script&gt;/.test(r.html), '<script> 는 글자로 표시됨');
    ok(/<b>진짜 굵게<\/b>/.test(r.html), '허용 서식 <b> 는 살아 있음');
    ok([...r.d.querySelectorAll('#issues b')].every(b => b.attributes.length === 0), '살아남은 <b> 에 속성 0개');
    ok([...r.d.querySelectorAll('a')].every(a => !/^javascript:/i.test(a.getAttribute('href') || '')),
      'a[href] 에 javascript: 없음');
  }

  console.log('\n== F. 설정 오류 -> 안내 화면 ==');
  {
    const f = { ...FIX };
    f['설정'] = [['항목', '값'], ['프로젝트명', '테스트']];
    const r = await run(f);
    ok(!!r.err, '안내 화면 표시됨');
    ok(/시작일/.test(r.err || ''), '원인을 알려줌', r.err);
  }

  console.log('\n== G. data.xlsx 없음(404) -> 예시 데이터 대신 안내 ==');
  {
    const r = await run(FIX, {}, { http404: true });
    ok(!!r.err, '안내 화면 표시됨');
    ok(/data\.xlsx|불러오지/.test(r.err || ''), '원인·경로 안내', r.err);
    ok(!/킥오프|프로젝트 준비/.test(r.html), '가짜 예시 데이터가 안 나옴');
  }

  console.log('\n== H. 필수 시트 없는 엑셀 -> 안내 화면 ==');
  {
    const r = await run({ '안내': [['설명만 있는 파일']] });
    ok(!!r.err, '안내 화면 표시됨');
    ok(/설정|WBS/.test(r.err || ''), '필요한 시트를 알려줌', r.err);
  }

  console.log('\n== I. 엑셀 리더 미로드 -> 안내 화면 ==');
  {
    const r = await run(FIX, {}, { noLib: true });
    ok(!!r.err, '안내 화면 표시됨');
    ok(/xlsx\.mini/.test(r.err || ''), '스크립트 순서를 알려줌', r.err);
  }

  console.log('\n== J. 미리보기기준일 경고 띠 ==');
  {
    const f = { ...FIX };
    f['설정'] = [...FIX['설정'], ['미리보기기준일', new Date(2026, 9, 15)]];
    const r = await run(f);
    ok(/미리보기 기준일 2026\.10\.15/.test(r.pvw), '경고 띠 노출', r.pvw.slice(0, 60));
    ok(/2026\.10\.15/.test(r.stamp) && /주차/.test(r.stamp), '기준일이 주차에 반영', r.stamp);
  }

  console.log('\n== K. 숨김탭 override ==');
  {
    const f = { ...FIX };
    f['설정'] = [...FIX['설정'], ['숨김탭', '녹화본, 이슈']];
    const r = await run(f);
    ok(!r.tabs.includes('녹화본') && !r.tabs.includes('이슈'), '숨김탭 적용', r.tabs.join(','));
    ok(r.tabs.includes('산출물'), '나머지는 유지', r.tabs.join(','));
  }

  console.log('\n== L. 실제 배포 파일 isens/data.xlsx 로 렌더 ==');
  {
    const real = fs.readFileSync('D:/HCG/JaDE-PMS/isens/data.xlsx');
    const ab = real.buffer.slice(real.byteOffset, real.byteOffset + real.byteLength);
    const r = await run(null, { plain: true }, { buffer: ab });
    ok(!r.err, '오류 없이 렌더됨', r.err);
    ok(r.errs.length === 0, 'JS 예외 없음', r.errs.join('|'));
    ok(r.rows > 0, '간트 행 생성', String(r.rows));
    ok(r.gateOff, '화면 열림');
  }

  /* ── 암호문 경로 : 파이썬(pack.py)이 만든 파일을 브라우저 코드가 실제로 푸는가 ── */
  async function runGate(encBuffer, password) {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>',
      { runScripts: 'outside-only', url: 'https://example.org/isens/', pretendToBeVisual: true });
    const w = dom.window;
    const errs = [];
    w.onerror = e => errs.push(String(e));
    w.BOARD = {};                                     /* plain 아님 → 잠금 + 복호화 */
    Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    w.fetch = () => Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(encBuffer) });
    w.console = { warn() {}, error() {}, info() {}, log() {} };
    w.eval(XLSXLIB); w.eval(BOARD);
    await new Promise(r => setTimeout(r, 30));

    const d = w.document;
    const before = { gateVisible: d.getElementById('gate').className !== 'off' };
    d.getElementById('gate-pw').value = password;
    d.getElementById('gate-go').dispatchEvent(new w.Event('click'));
    /* PBKDF2 20만회는 시간이 걸린다 */
    for (let i = 0; i < 200; i++) await new Promise(r => setTimeout(r, 10));

    return {
      before, errs, d,
      gateOff: d.getElementById('gate').className === 'off',
      msg: (d.getElementById('gate-msg') || {}).textContent || '',
      err: d.querySelector('.errbox') ? d.querySelector('.errbox').textContent.trim() : null,
      rows: d.querySelectorAll('.gr').length,
      html: d.body.innerHTML,
    };
  }

  /* 비밀번호는 테스트에 하드코딩하지 않는다 (커밋되는 파일이므로).
     로컬 기록(_passwords.local.md · gitignore)에서 읽고, 없으면 이 두 항목을 건너뛴다. */
  const RECORD = 'D:/HCG/JaDE-PMS/_passwords.local.md';
  const realPw = fs.existsSync(RECORD)
    ? ((fs.readFileSync(RECORD, 'utf8').match(/^\|\s*isens\s*\|\s*(.+?)\s*\|/m) || [])[1] || null)
    : null;

  if (!realPw) {
    console.log('\n== M·N. 암호문 교차검증 — 건너뜀 ==');
    console.log('  (_passwords.local.md 가 없습니다. pack.py 를 한 번 돌리면 이 검사가 켜집니다)');
  } else {
    const encFile = fs.readFileSync('D:/HCG/JaDE-PMS/isens/data.enc');
    const encAb = encFile.buffer.slice(encFile.byteOffset, encFile.byteOffset + encFile.byteLength);

    console.log('\n== M. [교차검증] pack.py 암호문 + 올바른 비밀번호 ==');
    {
      const r = await runGate(encAb, realPw);
      ok(r.before.gateVisible, '처음엔 잠금 화면이 떠 있음');
      ok(!r.err, '오류 없이 복호화됨', r.err);
      ok(r.errs.length === 0, 'JS 예외 없음', r.errs.join('|'));
      ok(r.gateOff, '잠금 해제됨');
      ok(r.rows > 0, '간트 렌더됨', String(r.rows));
    }

    console.log('\n== N. [핵심] 틀린 비밀번호 -> 데이터가 새지 않음 ==');
    {
      const r = await runGate(encAb, realPw + '-wrong');
      ok(!r.gateOff, '잠금 화면이 그대로 유지됨');
      ok(/맞지 않습니다/.test(r.msg), '비밀번호 오류 안내', r.msg);
      ok(!r.err, '안내(오류) 화면으로 빠지지 않음 — 다시 입력받음', r.err);
      ok(r.rows === 0, '간트가 그려지지 않음', String(r.rows));
      ok(!/프로젝트 준비|아이센스|킥오프/.test(r.html), '데이터가 DOM 어디에도 없음');
    }
  }

  /* ── 일정(방문·회의) ────────────────────────────────────────
     기준일을 고정해야 D-N 이 매일 바뀌지 않는다. */
  console.log('\n== O. 일정 탭 · 다가오는 일정 ==');
  {
    const cfg = [...FIX['설정'], ['미리보기기준일', '2026-08-03']];
    const r = await run({ ...FIX, '설정': cfg,
      '일정': [['일자', '시각', '구분', '제목', '장소', '참석자', '비고'],
        ['2026-07-30', '10:00', '방문', '사전 미팅', '고객사', '홍길동', ''],
        ['2026-08-07', '14:00', '회의', '인사/조직 모듈 교육', '본사 3층', 'PM 외 4명', '<b>자료 사전배포</b>'],
        ['2026-08-20', '', '교육', '근태 사용자 교육', '', '', ''],
      ] });
    const chip = r.d.getElementById('nextsch');
    const sec = r.d.getElementById('upnext-sec');
    ok(!r.err, '오류화면 없음', r.err);
    ok(r.errs.length === 0, 'JS 예외 없음', r.errs.join('|'));
    ok(r.tabs.includes('방문·회의'), '방문·회의 탭 생김', r.tabs.join(','));
    ok(r.tabs[1] === '방문·회의', 'WBS 바로 다음 자리', r.tabs.join(','));
    ok(chip && !chip.hidden && /08\.07/.test(chip.textContent), '상단 칩에 다음 일정', chip && chip.textContent);
    ok(/D-4/.test(chip.textContent), '기준일 대비 D-4 계산', chip.textContent);
    ok(sec && !sec.hidden, '다가오는 일정 블록 표시');
    ok(r.d.querySelectorAll('.un').length === 2, '지난 건은 빼고 예정 2건만', String(r.d.querySelectorAll('.un').length));
    ok(!!r.d.querySelector('.un.first'), '가장 가까운 건만 강조');
    ok(r.d.querySelectorAll('#schtbl tbody tr').length === 3, '일정표는 지난 건 포함 3행');
    ok(!!r.d.querySelector('#schtbl tr.sch-past'), '지난 일정 흐리게 표시');
    ok(!!r.d.querySelector('#schtbl tr.sch-next'), '다음 일정 줄 강조');
    ok(/<b>자료 사전배포<\/b>/.test(r.html), '비고에 허용 서식 적용');
  }

  console.log('\n== P. 일정 시트가 없으면 흔적도 없다 ==');
  {
    const r = await run(FIX);                      /* FIX 에는 일정 시트가 없다 */
    ok(!r.tabs.includes('방문·회의'), '탭 없음', r.tabs.join(','));
    const sec = r.d.getElementById('upnext-sec');
    ok(sec && sec.hidden, '다가오는 일정 블록 숨김');
    const chip = r.d.getElementById('nextsch');
    ok(chip && chip.hidden, '상단 칩 숨김');
    ok(!r.d.getElementById('schtbl'), '일정표 패널 자체가 없음');
  }

  console.log('\n== Q. 일정 시트 XSS ==');
  {
    const r = await run({ ...FIX,
      '일정': [['일자', '시각', '구분', '제목', '장소', '참석자', '비고'],
        ['2030-01-01', '<img src=x onerror=alert(1)>', '회의',
          '<script>alert(1)</script>', 'javascript:alert(1)', '<svg onload=alert(1)>', ''],
      ] });
    ok(r.d.querySelectorAll('script').length === 0, 'script 노드 0개');
    ok(r.d.querySelectorAll('[onerror],[onload]').length === 0, '이벤트 핸들러 속성 0개');
    ok(/&lt;script&gt;/.test(r.html), '<script> 는 글자로 표시됨');
  }

  console.log('\n== R. 요건 대장 검토서 링크 ==');
  {
    const cfg = [...FIX['설정'],
      ['요건검토서URL', 'https://ex.com/review'],
      ['요건검토서문구', '요구사항 검토서 (20건) 열기']];
    const r = await run({ ...FIX, '설정': cfg });
    const a = r.d.getElementById('dev-doc');
    ok(a && !a.hidden, '버튼 노출됨');
    ok(a.getAttribute('href') === 'https://ex.com/review', 'URL 연결', a && a.getAttribute('href'));
    ok(/요구사항 검토서 \(20건\) 열기/.test(a.textContent), '문구 반영', a && a.textContent);
    ok(a.getAttribute('target') === '_blank' && /noopener/.test(a.getAttribute('rel')), '새 탭 · noopener');
  }
  {
    const r = await run(FIX);                      /* URL 없음 */
    const a = r.d.getElementById('dev-doc');
    ok(a && a.hidden, 'URL 없으면 버튼 숨김');
  }
  {
    const cfg = [...FIX['설정'], ['요건검토서URL', 'javascript:alert(1)']];
    const r = await run({ ...FIX, '설정': cfg });
    const a = r.d.getElementById('dev-doc');
    ok(a && a.hidden, 'javascript: 스킴은 버튼째 차단');
  }

  console.log('\n== S. 산출물 시트를 빼면 탭이 사라진다 ==');
  {
    const rest = { ...FIX };
    delete rest['산출물'];
    const r = await run(rest);
    ok(!r.err, '오류화면 없음', r.err);
    ok(!r.tabs.includes('산출물'), '산출물 탭 없음', r.tabs.join(','));
    ok(!r.d.getElementById('docs'), '산출물 표 자체가 없음');
    ok(r.tabs.includes('추가개발'), '나머지 탭은 그대로', r.tabs.join(','));
  }

  console.log(`\n=========== 통과 ${pass} / 실패 ${fail} ===========\n`);
  process.exit(fail ? 1 : 0);
})();
