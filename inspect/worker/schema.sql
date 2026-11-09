-- 검수 시트 저장소 (새로 만들 때 쓰는 전체 구조). 기존 DB 는 migrate-*.sql 을 차례로 적용한다.

-- 고객사별 시나리오와 비밀번호 (PBKDF2 해시만 저장)
--   salt / pass_hash        고객사 비밀번호
--   admin_salt / admin_hash JaDE 담당자 비밀번호 (조치 완료 / 답변 / 검수 취소)
CREATE TABLE IF NOT EXISTS projects (
  key        TEXT PRIMARY KEY,
  salt       TEXT NOT NULL,
  pass_hash  TEXT NOT NULL,
  scenario   TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  admin_salt TEXT,
  admin_hash TEXT
);

-- 1차판의 확인 체크. 지금 화면은 쓰지 않는다 (results 로 대체)
CREATE TABLE IF NOT EXISTS checks (
  key     TEXT NOT NULL,
  item_id TEXT NOT NULL,
  checked INTEGER NOT NULL,
  name    TEXT NOT NULL,
  at      TEXT NOT NULL,
  PRIMARY KEY (key, item_id)
);

-- 항목별 현재 결과: ok 정상 / issue 문제 있음 / fixed 조치 완료 / na 해당 없음
CREATE TABLE IF NOT EXISTS results (
  key     TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status  TEXT NOT NULL,
  name    TEXT NOT NULL,
  role    TEXT NOT NULL,
  at      TEXT NOT NULL,
  PRIMARY KEY (key, item_id)
);

-- 결과가 바뀔 때마다 한 줄씩 쌓는 이력
CREATE TABLE IF NOT EXISTS history (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  key     TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status  TEXT NOT NULL,
  name    TEXT NOT NULL,
  role    TEXT NOT NULL,
  at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS history_key ON history (key, item_id);

-- 항목별 의견. role 이 jade 면 JaDE 답변
CREATE TABLE IF NOT EXISTS opinions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  key     TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  text    TEXT NOT NULL,
  at      TEXT NOT NULL,
  role    TEXT NOT NULL DEFAULT 'client'
);
CREATE INDEX IF NOT EXISTS opinions_key ON opinions (key, item_id);

-- 모듈별 검수 완료 (v2. 지금은 쓰지 않음: 항목 검수가 모두 끝나면 자동 완료)
CREATE TABLE IF NOT EXISTS approvals (
  key    TEXT NOT NULL,
  mod_id TEXT NOT NULL,
  name   TEXT NOT NULL,
  at     TEXT NOT NULL,
  PRIMARY KEY (key, mod_id)
);

-- 항목별 검수 체크. 테스트 결과가 정상 / 해당 없음일 때만 체크되고, 테스트 결과가 바뀌면 지워진다
CREATE TABLE IF NOT EXISTS reviews (
  key     TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  at      TEXT NOT NULL,
  PRIMARY KEY (key, item_id)
);
