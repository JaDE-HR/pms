# 검수 시트

고객사가 운영 서버에서 시나리오대로 테스트하고, JaDE 가 조치하고, 고객사가 모듈별로 검수하는 화면입니다.
들어올 때 비밀번호와 이름을 입력하고, 결과 / 의견 / 검수에 그 이름이 남습니다.

## 흐름

항목마다 **테스트** 칸과 **검수** 칸이 있습니다.

1. 테스트: 고객사 실무자가 `미실행` / `정상` / `오류` 를 고릅니다. 언제든 바꿀 수 있고, 항목 박스가 정상이면 연한 파랑, 오류면 연한 빨강이 됩니다. 버튼 아래에는 마지막으로 누른 사람과 시각만 보입니다.
2. 조치: JaDE 가 고친 뒤 답변을 남기고 `조치 완료` 를 누릅니다.
3. 재테스트: 고객사가 다시 실행해 `정상` 으로 바꿉니다.
4. 검수: 테스트가 정상인 항목에 고객사 책임자가 검수 체크를 합니다.
5. 모듈의 모든 항목이 검수되면 그 모듈은 자동으로 `모듈 검수 완료` 가 됩니다.

- 테스트 결과를 바꾸면 그 항목의 검수 체크는 자동으로 풀립니다 (재검수 필요).
- 테스트 / 조치 / 검수 / 검수 해제가 모두 항목별 이력에 남습니다.

| 비밀번호 | 할 수 있는 일 |
|---|---|
| 고객사 비밀번호 | 테스트 결과, 검수 체크, 의견 |
| JaDE 비밀번호 | 조치 완료, 답변 |

JaDE 비밀번호는 `<키>/inspect/jade-admin.local.md` 에만 있습니다 (커밋되지 않음).
시나리오 항목에 `"risk": true` 를 넣으면 `운영 영향` 표시와 "JaDE 담당자와 함께 진행" 주의가 붙습니다.

모듈에 `"prepare": true` 를 넣으면 탭과 상단 패널에 `준비중` 으로만 보이고, 그 모듈 항목은 진행률에서 빠집니다.

```
inspect/app/          표준 화면 (전 고객사 공유) — 고객사 정보 없음
inspect/worker/       저장 API (Cloudflare Worker + D1)
inspect/tools/push.mjs  시나리오 / 비밀번호 올리기
<프로젝트키>/inspect/index.html           셸. 고칠 것은 <title> 과 key
<프로젝트키>/inspect/scenario.local.json  시나리오 원본. 🔴 커밋되지 않음
```

- 고객 주소: `https://jade-hr.github.io/pms/<프로젝트키>/inspect/`
- 저장 API: `https://jade-inspect.jade0001.workers.dev` (Cloudflare 계정 junikim0612@gmail.com)
- 데이터베이스: Cloudflare D1 `jade-inspect`

## 🔴 왜 공개 저장소에 올려도 되는가

시나리오(고객사 조직명 등)와 체크 / 의견은 **저장소가 아니라 D1 에만** 있습니다.
저장 API 는 비밀번호가 맞을 때만 내려주고, D1 에는 비밀번호의 해시만 저장합니다.
`scenario.local.json` 은 `.gitignore` 의 `*.local.json` 규칙으로 커밋되지 않습니다.

## 자주 하는 일

| 일 | 명령 |
|---|---|
| 시나리오 고친 뒤 반영 | `node inspect/tools/push.mjs <키>` (결과 / 의견은 그대로 유지) |
| 새 고객사 / 고객사 비밀번호 변경 | `node inspect/tools/push.mjs <키> --pass-file <비밀번호 파일 경로>` |
| JaDE 비밀번호 설정 / 변경 | `node inspect/tools/push.mjs <키> --admin-pass-file <비밀번호 파일 경로>` |
| 화면 고친 뒤 반영 | `inspect/app/` 수정 → 셸의 `?v=` 올림 → commit · push |
| API 고친 뒤 반영 | `cd inspect/worker && npx wrangler@4.20.0 deploy` |
| DB 구조 변경 | `inspect/worker/migrate-00N.sql` 을 만들어 `wrangler d1 execute jade-inspect --remote --file=...` |

- 비밀번호 파일은 한 줄짜리 텍스트입니다. 올린 뒤 바로 지우세요. 대화창 / 커밋에 비밀번호를 적지 않습니다.
- 비밀번호를 바꾸면 기존 비밀번호는 바로 막힙니다. 고객에게 새 비밀번호를 안내하세요.
- 시나리오 항목의 `id` 를 바꾸면 그 항목에 쌓인 체크 / 의견과 연결이 끊깁니다.

## 시나리오 문법

`scenario.local.json` 의 `steps` / `expect` / `note` / `prep` 문자열 안에서:

| 쓰는 법 | 화면 |
|---|---|
| `[[2026.11.11]]` | 노란 예시 값 |
| `**조회**` | 버튼 모양 |
| `!!위치 확인 필요!!` | 빨간 점선 확인 필요 표시 |
| 줄바꿈 (`\n`) | 단계 아래 한 줄씩 목록 |
| `note` 의 `!` 로 시작 | 빨간 주의 |
