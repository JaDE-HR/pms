-- 검수 시트 저장소. 고객사(프로젝트키)별로 시나리오와 기록을 나눠 둔다.

-- 고객사별 시나리오와 열람 비밀번호 (비밀번호는 PBKDF2 해시만 저장)
CREATE TABLE IF NOT EXISTS projects (
  key        TEXT PRIMARY KEY,
  salt       TEXT NOT NULL,
  pass_hash  TEXT NOT NULL,
  scenario   TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 항목별 확인 체크. 마지막으로 바꾼 사람과 시각이 남는다.
CREATE TABLE IF NOT EXISTS checks (
  key     TEXT NOT NULL,
  item_id TEXT NOT NULL,
  checked INTEGER NOT NULL,
  name    TEXT NOT NULL,
  at      TEXT NOT NULL,
  PRIMARY KEY (key, item_id)
);

-- 항목별 의견. 한 항목에 여러 사람이 차례로 남긴다.
CREATE TABLE IF NOT EXISTS opinions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  key     TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  text    TEXT NOT NULL,
  at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS opinions_key ON opinions (key, item_id);
