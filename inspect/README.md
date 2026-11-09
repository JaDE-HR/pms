# 검수 시트

고객사 담당자가 시나리오대로 테스트하고, **확인 체크와 의견을 함께 저장 / 공유**하는 화면입니다.
들어올 때 비밀번호와 이름을 입력하고, 체크와 의견에 그 이름이 남습니다.

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
| 시나리오 고친 뒤 반영 | `node inspect/tools/push.mjs <키>` (체크 / 의견은 그대로 유지) |
| 새 고객사 / 비밀번호 변경 | `node inspect/tools/push.mjs <키> --pass-file <비밀번호 파일 경로>` |
| 화면 고친 뒤 반영 | `inspect/app/` 수정 → 셸의 `?v=` 올림 → commit · push |
| API 고친 뒤 반영 | `cd inspect/worker && npx wrangler@4.20.0 deploy` |

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
