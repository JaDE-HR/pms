-- 003: 항목별 검수 체크 추가. 모듈 검수(approvals)는 항목 검수가 모두 끝나면 자동 완료로 바뀌어 더 쓰지 않는다.
CREATE TABLE IF NOT EXISTS reviews (
  key     TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  at      TEXT NOT NULL,
  PRIMARY KEY (key, item_id)
);
