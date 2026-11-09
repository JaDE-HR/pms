-- 002: 테스트 결과 / 이력 / 모듈 검수 / JaDE 역할 추가 (기존 데이터는 그대로 둔다)
ALTER TABLE projects ADD COLUMN admin_salt TEXT;
ALTER TABLE projects ADD COLUMN admin_hash TEXT;
ALTER TABLE opinions ADD COLUMN role TEXT NOT NULL DEFAULT 'client';

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

-- 모듈별 검수 완료
CREATE TABLE IF NOT EXISTS approvals (
  key    TEXT NOT NULL,
  mod_id TEXT NOT NULL,
  name   TEXT NOT NULL,
  at     TEXT NOT NULL,
  PRIMARY KEY (key, mod_id)
);
