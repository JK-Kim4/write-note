# 야간 자동 진행 프롬프트 — 보드 로드맵 남은 작업 (C-2 중심)

> 다음 세션 첫 메시지로 붙여넣어 사용. `/goal`로 감싸 쓰거나(있으면), 그냥 이 내용을 붙여넣어도 자족적으로 자동 진행하도록 작성됨.

---

너는 사용자가 자는 동안 소설비(write-note) 보드 로드맵의 남은 작업을 자동으로 진행한다. 사용자는 내일 일어나서 결과 확인 + dogfooding을 한다. **질문할 사람이 없으니 결정이 필요한 지점은 아래 정책으로 스스로 확정하고 결정 로그에 상세히 남긴다. AskUserQuestion·ExitPlanMode 등 사용자 응답 대기 도구를 호출하지 마라.**

## 1. 시작 (복원)

1. `docs/board/board-roadmap.md` §0(현재 진입점)·§1(대시보드)·§5(C-2·E 트랙)·§7(후속) 정독
2. `docs/board/board-prd.md` — 특히 §5.4(진입점 3곳)·§9(집필 중 보드 참조)·§10(API 설계)·§11(미결정)
3. `docs/board/board-ux-worksheet.md` — TASK-5(집필 중 보드 참조)·§5 COPY 상수
4. CLAUDE.md 의무: vault `~/obsidian/write-note/02-PROGRESS.md`·`03-ISSUES.md`(ISSUE-050) 읽기
5. 직전 회고 `~/obsidian/write-note/retrospectives/2026-06-26-board-track-d-card-types.md`
6. 트랙 D 산출물 — 코드/DB/API는 owner 다형 모델 + `Card/Link/cards/links` 유비쿼터스 언어 + 카드 종류 4종(character/place/event/theme)+무지정(nullable). 옛 식별자(node/edge/plot 종류/5종/project_id·category_id) 재도입 금지.

## 2. 남은 작업 범위

- **C-2 (내부 탭 + 집필 참조)** — 주 자동 진행 대상. PRD §5.4 ②③, ISSUE-050.
  - 내부 탭: 작품/시리즈 상세에 그 주체에 매달린 보드만 보이는 탭 (생성 시 owner 자동)
  - 집필 참조: `GET /works/:id/reference-boards`(그 작품 + 상위 시리즈 보드) + 마지막 본 보드 기억 + 에디터 분할 뷰
- **E (메모·인물 통합)** — ⚠️ 자동 진행 제한 (§5 가드 4 참조). 비파괴 설계/spec 초안까지만.

## 3. 작업 방식 (speckit 사이클로 작업 단위 분할)

- 작업 단위를 speckit 사이클로 쪼갠다: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- 트랙 단위 increment: 한 작업 단위 = spec→plan→tasks→구현→게이트 GREEN→커밋. BE 변경 동반 시 BE 선행→FE 후행.
- 새 spec 디렉토리 = `specs/042-...`, `specs/043-...` (현재 최대 041, +1씩).
- 작업 단위가 크면 더 쪼갠다(내부 탭 / 집필 참조를 별도 spec으로). 한 번에 다 하지 말 것.

## 4. 결정/clarify 정책 (사용자 부재 — 자동 확정)

결정이나 clarify가 필요한 지점은 다음 우선순위로 **스스로 확정**한다 (추측 금지 — 사실로 확정한 뒤 진행):

1. **코드베이스 우선 확인** — 실제 구현·기존 패턴·데이터 모델을 grep/Read로 직접 확인해 사실 기반으로 결정.
2. **PRD 정책 우선 채택** — 코드로 안 풀리는 설계 선택은 `board-prd.md`/`board-ux-worksheet.md`의 명시 정책을 채택.
3. **그래도 모호하면 보수적 기본값** — 비파괴·되돌리기 쉬운 쪽을 택하고 **결정 로그에 상세 기록**.

### C-2 알려진 결정 지점 (위 정책으로 처리)
- **내부 탭 호스트 UI**: 작품 상세=현 집필 화면, 시리즈 상세=/library 드릴인(별도 상세 페이지 부재로 추정). 코드베이스에서 현 작품/시리즈 화면 구조를 직접 확인한 뒤, PRD §5.4 "내부 탭" 의도(그 주체 보드만·생성 시 owner 자동)에 맞게 결정.
- **마지막 본 보드 저장소**: localStorage vs 신규 서버 키. `SettingsService.ALLOWED`는 값 화이트리스트라 임의 boardId 불가 — 코드 확인 후 서버 키가 안 되면 localStorage(비파괴) 채택.
- **`GET /boards` 필터**는 트랙 C에서 owner 계약 준비됨(`?ownerType=&ownerId=`) — 재사용. `GET /works/:id/reference-boards`는 신규(작품 owner + 상위 시리즈 owner; 상위 시리즈 = project.categoryId).
- **에디터 분할 뷰**: 보드는 React Flow 기반 별도 컴포넌트 → dynamic import(ssr:false)로 집필 번들 격리(PRD §9).

## 5. 안전 가드 (HARD — 자동 진행이라 더 엄격)

1. **운영(OCI) DB·인프라 절대 금지.** 모든 DB 작업은 로컬 dev(`write-note-postgres`, db `writenote`, user `writenote`/pw `writenote-local-dev`) 한정.
2. **로컬 dev DB의 board 도메인(boards/cards/links) 마이그레이션 적용·리셋은 본 프롬프트로 사전 승인**(자동 진행 위해). 단 board 외 테이블(users·projects·categories·memos·characters·documents 등)·운영 DB는 절대 변경 금지. 마이그레이션 in-place 편집 시 board 테이블 drop + flyway history 삭제 + 재마이그레이션(트랙 B/C/D 패턴).
3. **E(메모·인물 통합) 파괴적 작업 금지.** 메모·인물의 데이터 삭제·스키마 변경·iOS 캡처 경로 제거·메뉴 라우트 제거는 자동 금지. E는 **설계 문서/spec 초안 + 데이터 모델 결정 지점 정리까지만**(비파괴), 실제 구현·폐기는 사용자가 깨어난 후 결정 (roadmap §4-2: "충돌 추정만으로 데이터·캡처 경로 제거 금지").
4. **develop·main merge 금지** — 보류 유지. 038 브랜치에 작업 단위별 커밋만.
5. **각 작업 단위 게이트 GREEN 필수.** BE(ktlint·checkstyle·test·build) / FE(typecheck·lint·test·build) + 회귀 grep. **RED면 그 단위에서 멈추고 결정 로그·보고서에 기록, 다음 단위로 넘어가 회귀를 누적하지 말 것.**
6. **빌드/테스트는 포어그라운드 실행** (CLAUDE.md 의무), 결과 직접 확인 후 다음 진입.
7. **authed dogfooding 불가** (로그인 못 함). 로컬 풀스택 띄워 비인증 화면·게이트·회귀 grep까지만 검증. authed 화면 검증은 보고서의 dogfooding 체크리스트로 넘긴다.
8. **AskUserQuestion 등 raw JSON 수동 직렬화 금지** (애초에 호출 안 하지만, 어떤 구조화 도구든 structured 파라미터로 — 룰 §24).

## 6. 마무리 산출물 (사용자가 일어나서 볼 것)

1. **HTML 시각화 보고서** — `docs/research/<작업일>-overnight-autorun-report.html`:
   - **작업 요약** — 완료한 작업 단위·커밋 해시·게이트 결과(BE/FE GREEN 여부)
   - **결정 로그 (상세, 핵심)** — 자동 확정한 각 결정을 카드/표로 시각화: (a) 무엇을 정해야 했나 (b) 코드베이스 근거 (c) PRD 근거 (d) 채택한 값 (e) 고려한 대안 (f) 되돌리는 법
   - **dogfooding 체크리스트** — 사용자가 깨어나서 확인할 항목 (화면·동작별, authed 포함, 풀스택 재기동 방법 동봉)
   - **미해결/막힌 지점** — 게이트 RED·결정 보류·E 정리 결과
   - **다음 진입점**
2. roadmap §0/§1/§5 + vault 02-PROGRESS·03-ISSUES(ISSUE-050) 갱신 (트랙별)
3. 큰 작업 단위 종료 시 회고(`~/obsidian/write-note/retrospectives/`) — 선택

## 7. 진행 순서 (제안)

1. C-2 내부 탭 → speckit 사이클 → 구현 → 게이트 GREEN → 038 커밋
2. C-2 집필 참조(reference-boards·마지막 본 보드·분할 뷰) → speckit 사이클 → 구현 → 게이트 → 커밋
3. E → 비파괴 설계/spec 초안 + 데이터 모델 결정 지점 정리 (구현·폐기 금지)
4. HTML 보고서 작성 + roadmap/vault 갱신

질문 없이 위 정책으로 끝까지 진행. 모든 자동 결정은 결정 로그에. 막히면 그 지점만 보고서에 남기고 다음으로. 안전 가드 위반 위험이 있으면 그 작업만 건너뛰고 보고서에 사유 기록.
