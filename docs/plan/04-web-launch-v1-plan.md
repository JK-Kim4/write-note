# Web 런칭(V1 공개) 계획

**상태: 🟡 At Risk** · _최종 갱신: 2026-06-11_ · _대상: web 앱(Next.js→Vercel / Spring Boot→Render)_

## 요약

검증된 Desktop(Electron) 제품의 web 포팅본(015~018, `develop` merge 완료)을 V1으로 공개 런칭하기 위한 계획. 코드베이스 실측 결과 **FE↔BE 배선은 대부분 완료**(12 컨트롤러·53 엔드포인트)이며, 진짜 격차는 ① 빌드 게이트 RED ② web 백엔드 운영 인프라 전무 ③ 일부 기능 FE 미노출/깨짐 ④ 신규 요청 기능 4종이다. **현재 At Risk 사유 = frontend `typecheck`·`lint`가 RED라 Vercel 배포 게이트부터 막힘**(Round 0에서 해소).

**전략 결정(사용자 확정 2026-06-11):**
- 순서 = **코드 우선 → 인프라 후**. 모든 기능을 로컬에서 완성한 뒤 운영 인프라를 일괄 구성하고 **운영 마이그레이션은 한 번에** 적용한다.
- export 목표 포맷 = **개방표준 `.hwpx`**(구 `.hwp` 바이너리 제외).
- 데드라인 = **품질 우선, 날짜 무관**. dogfooding·검증을 범위에 포함.
- 인프라 = Claude가 코드·설정·SQL 작성 → 사용자가 적용 명령 실행(외부 인프라 쓰기는 사용자 컨펌 영역).
- **챕터 기능 추가(2026-06-11):** 작품 1:N 챕터(순서 조절 + export 시 골라 묶기, 작품 횡단 없음) — **Round 2.5 신규 삽입**(export 가 챕터 합본에 의존하므로 Round 3 선행 필수). 설계 = `docs/superpowers/specs/2026-06-11-chapters-design.ko.md`.
- **Round 2 B 기준 재구성(2026-06-12):** B타입 디자인 기본값화에 따라 Round 2 를 B 디자인 기준으로 재정의. **A 디자인 동결**(신규 기능 미적용, 선택 옵션으로 잔존). 용지 크기 = B 에디터에 페이지 분할 이식 후 도입. Round 2.5 챕터 FE(집필실 좌패널)도 B `app/b/works/[id]` 좌패널(목차) 기준으로 적용.

## 검증으로 드러난 정정 사항

요청 기능 중 **"이미 구현됨"** 으로 확인되어 신규 개발이 불필요하거나 축소된 항목:

| 요청 | 사용자 인식 | 실제 코드 상태 | 일정 영향 |
|------|------------|---------------|-----------|
| 집필실 좌측 인덱스 빠른 이동 | 미도입 | ✅ **완전 구현됨**(017) — H1/H2 TOC·클릭 점프·현재 섹션 하이라이트, 좌측 패널 기본 열림 | 신규 개발 제외, 검증만 |
| 작품↔등장인물 매핑 | 필요 | ✅ 이미 1:N(`characters.project_id` FK, `ON DELETE CASCADE`) | 제외 |
| 제목/부제목 | 못 넣음 | H2(부제목) 토글 ✅ 있음. H1(제목) 버튼만 부재. 엔진(StarterKit)은 H1 지원 | H1 버튼만 신규(소규모) |
| 등장인물 필드 | 이름·나이·성별·특징·소개 | 엔티티는 `name`·`shortDescription`·`notes`만 | 나이·성별·특징 신규 필요 |
| 용지 크기 | 한 종류 | ✅ 맞음. A4 210mm 하드코딩(`desktop-app.css:393`), 설정 불가 | 신규 |
| export | 필요 | ✅ 전무(코드·UI·라이브러리 0) | 신규(`.hwpx`로 한정) |

## 라운드별 작업 분해 (의존 순서)

> 단위 = dev-day(1인 개발, TDD 포함, dogfooding 별도). 인프라가 **맨 뒤**로 재배치됨(코드-우선 전략).

### Round 0 — 게이트 복구 🔴 최우선 (전제)

- [ ] **C1** (#49) `pnpm typecheck` 수정 — `src/lib/electron-api/documents.test.ts:43` version number↔string 타입 불일치
- [ ] **C2** (#34) `pnpm lint` 수정 — `useDocumentSession.ts:126` `react-hooks/refs`, `:121` `set-state-in-effect`, `write/page.tsx:100`, `:202` unused disable
- [ ] **D6/ISSUE-029** (#35) `GlobalExceptionHandler.handleConflict` DB 원문 SQL·제약명 마스킹(보안)

**산출 게이트:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` GREEN + 백엔드 게이트 GREEN · **추정 1~1.5d**

### Round 1 — 스키마 확장 기능 (마이그레이션 동반)

> 마이그레이션 신규본은 로컬 dev DB에만 적용, **운영 적용은 Round 4에서 일괄**.

- [ ] **A1** (#36) 곁쪽지 삭제/되돌리기 — BE `memos.deleted_at`(soft-delete)+`POST /api/memos/{id}/restore`+`listMemos` `deletedAt IS NULL` 필터 / FE 책상 삭제 버튼·되돌리기 Toast 이식 (ISSUE-026)
- [ ] **A3** (#37) 설정 서버 영속 — BE 설정 저장(테마·자동저장) endpoint+스키마 / FE `settings` 배선 localStorage→서버
- [ ] **F1** (#38) 등장인물 관리 확장 — BE 엔티티 4필드(나이·성별·특징·소개) 추가+마이그레이션+DTO/Service / FE 관리폼 입력 확장 + 전역 진입 메뉴(B2와 연동)

**추정 5~7.5d**

### Round 2 — 집필실 기능 **(2026-06-12 B 디자인 기준 재구성)**

> **재구성 사유**: 원정의(2026-06-11)는 A 디자인(Rail 셸+PaperEditor) 기준인데, B타입 디자인 기본값화(`52edefe`) 이후 실측 결과 — F3(H1 버튼)·B2(네비 영속+인물 메뉴)는 B 에서 **이미 충족**(BEditor 툴바 H1~H3 / `app/b/layout.tsx` 헤더 네비), F2(용지)는 분할 없는 B 흐름형 에디터에 **적용 불가 정의**. 사용자 결정(2026-06-12): **Round 2 = B 기준 재구성 + A 동결(신규 기능 미적용)** / **F2 = B 에 페이지 분할+용지 도입**.

- [x] **R2-1** (#40 재정의) B 에디터 페이지 분할 이식 + 용지 크기 4종(A4/A3/A2/B4) — ✅ 구현완료(Phase 1~3, `8386c8b`·`72bd755`·`175b3bd`). PaperEditor CSS `column-height`/`column-wrap` 분할을 B 스킨으로 BEditor 이식, `pageLayout.ts` PaperGeometry 파라미터화(B4=JIS 257×364mm, A4 회귀 0), 설정 영속(store `paperSize`+PreferencesSync+BE ALLOWED 1줄+`/b/settings`), `CSS.supports` 폴백. **잔여=GATE-1 브라우저 dogfooding(IME 4케이스·장 분할)**
- [x] **R2-2** (#41 재정의) B 집필실 좁은 폭 대응 — ✅ 구현완료(Phase 4, `5b3b7ce`). 좌 목차·우 BWorkSidePanel 880px 미만 토글 drawer(백드롭·ESC), 넓은 폭 3패널 불변. **잔여=GATE-2 시각 dogfooding**
- [x] **R2-3** (#39·#50 잔여) 검증·소규모 격차 — ✅ 완료(Phase 5, `bd591f3`). 목차 H3 포함(TDD), H1~H3 툴바·헤더 네비 영속은 B 기충족(검증). A 디자인 동결 기록(아래)

**구현완료(자동 게이트 GREEN, 2026-06-12) + dogfooding 후속 완료(2026-06-13)** — Opus advisor + Sonnet implementer. spec=`specs/020-round2-b-studio/`. 원추정 5.5~7.5d 대비 자동 구현 1세션.

**dogfooding 후속 트랙(2026-06-13, develop merge에 포함):**
- **QA sweep**: 멀티에이전트 5라운드 62건 하드닝(에러 상태·모달 접근성·낙관 업데이트·반응형) + 인물 삭제 확인 모달
- **트랙1**: 빈작품 안내창 → 새 작품 생성 직행 / **집필 메뉴** 작품 존재 시 모달 대신 진입
- **트랙2(작업 기록 분리)**: `work_sessions`·`project_logs` user_id + project_id nullable + FK **SET NULL**(V13) → 작품 삭제해도 전체 작업시간 보존, 기록 화면 "총 작업시간"=user 전체 합계
- **트랙3(작품별 용지)**: `projects.paper_size`(V12) → 전역 설정에서 작품 속성으로. 새 작품 모달 + 집필실 "용지" 셀렉트. **용지 시각 인지**: b.css 하드코딩 제거(폭·줄수 geometry 구동) + 용지 배지 + **A4 fit-zoom**(A4 항상 한 화면, 큰 용지 비례 확대 가로 스크롤)
- **인증**: 비밀번호 정책 12→8자 완화 + 메시지 정합 / **로그인 후 B 사용자 A화면 깜빡임 제거**(A 홈 디자인 가드)
- **신규 마이그레이션 V12·V13**(로컬 dev 적용·운영 Round 4 D1 일괄)

**A 디자인 동결(2026-06-12 확정):** Round 2 신규 기능(페이지 분할·용지·반응형 패널)은 **B 디자인에만** 적용. A 디자인(`/`·`/projects`·PaperEditor)은 선택 옵션으로 잔존하되 신규 미적용 — A/B 비대칭(A 사용자는 Round 2 기능 미수령)은 런칭 후 정리 후보. **동결 예외 1건**: 공용 outline 파생(`outlineFromDoc`)의 H3 포함이 A 집필실 목차에도 자연 반영(무해, 신규 기능 아님).

### Round 2.5 — 챕터 (작품 1:N 본문 구조) **(2026-06-11 추가)**

> 설계 SoT = `docs/superpowers/specs/2026-06-11-chapters-design.ko.md`. `documents` 테이블 1:N 확장(안 A) — 기존 본문 = 1번 챕터 무손실 이관. 신규 V14 마이그레이션은 로컬 dev DB만, **운영 적용은 Round 4 D1 일괄**.

- [ ] **BE-1** (#58) V14 마이그레이션·엔티티 — `project_id` UNIQUE 해제 + `sort_order` + `deleted_at`(soft-delete) + 기존 데이터 보존 검증
- [ ] **BE-2** (#59) 챕터 endpoint — 목록(본문 제외 메타)/생성(맨 뒤)/순서 일괄 변경(004 reorder 패턴)/soft-delete(마지막 활성 챕터 409 `LAST_CHAPTER_UNDELETABLE`)/복구 + 단수 조회 제거
- [ ] **BE-3** (#60) 대시보드 카드 집계 재설계 — 글자수 합산·최신 저장시각·마지막 문장 원천=최근 챕터, 응답 스키마 불변
- [ ] **FE-1** (#61) 집필실 좌패널 2단(챕터 목록 + 기존 아웃라인) + `?chapter=` 전환 + 016 초안 키 격리 재사용
- [ ] **FE-2** (#62) 삭제·되돌리기 토스트 + 마지막 챕터 가드(`error.code` 분기)

**추정 5~7.5d**

### Round 3 — Export `.hwpx`/PDF/DOCX

> **챕터 의존(Round 2.5):** export 단위 = "선택한 활성 챕터들의 순서 합본"(기본 전체). 챕터 선택·순서 묶기 UI 는 본 라운드 설계 범위.

- [ ] **스파이크** (#42) `.hwpx` 생성 실현가능성 — JVM `hwpxlib`(개방표준 OWPML) 검증. TipTap JSON→OWPML 매핑 범위 확인. **이 결과로 hwpx 추정 확정**
- [ ] **PDF** (#51) — 인쇄 스타일시트(@page, 기존 페이지분할 CSS 재사용) 또는 라이브러리
- [ ] **DOCX** (#43) — TipTap JSON→docx(FE `docx` lib 또는 BE Apache POI)
- [ ] **HWPX** (#44) — 백엔드 JVM 경로 유력(스파이크 결과 의존)

**추정 6~10d** (hwpx는 스파이크 후 확정 — 불확실 폭 최대)

### Round 4 — 운영 인프라 구성 (코드 완성 후)

> Claude = 코드·설정·SQL·절차 작성 / 사용자 = 적용 실행(컨펌).

- [ ] **D2** (#52) Render 백엔드 — Dockerfile·render 설정·환경변수 (web 백엔드 최초 배포)
- [ ] **D1** (#45) Supabase 마이그레이션 **일괄 적용** — V7·V8 + Round 1/2의 신규 마이그레이션(019 V9~V11 + 020 **V12 작품 용지·V13 작업기록 분리**) 한 번에 (적용 SQL·롤백안). ⚠️ V13은 기존 행 backfill(user_id) + FK CASCADE→SET NULL 교체 — 운영 데이터 ALTER 주의
- [ ] **D3** (#53) Vercel 프로덕션 브랜치 설정
- [ ] **D4** (#46) CORS·httpOnly 쿠키 운영 도메인 정합 + 실브라우저 검증
- [ ] **D5** (#47) 카카오 OAuth redirect URI 운영 콜백 등록(`/api/auth/oauth/kakao/callback`)
- [ ] **D7/ISSUE-027** (#54) contact(Formsubmit) 브라우저 CORS 실전송 검증 → 차단 시 백엔드 프록시 endpoint

**추정 2~4d**

### Round 5 — 통합 dogfooding / 검증

- [ ] (#55) 한글 IME 조합 직후 이동 무유실 수동 QA
- [ ] (#56) 작품 벽·집필실 실브라우저 시각 QA(한글 폰트·페이지 분할·용지 크기)
- [ ] (#57) 018 대시보드 집필 리듬 그래프 데이터 정합(요일 막대·작품별 누적)
- [ ] (#48) 전 라우트 회귀 + export 산출물 검증
- [ ] (#63) 챕터 dogfooding — IME 4케이스+조합 중 챕터 전환 무유실·순서 변경·삭제/되돌리기

**추정 2~3d**

## 합계 추정

| 구간 | dev-day |
|------|---------|
| Round 0 게이트 | 1~1.5 |
| Round 1 스키마 기능 | 5~7.5 |
| Round 2 집필실 (B 재구성) | 5.5~7.5 |
| Round 2.5 챕터 | 5~7.5 |
| Round 3 export | 6~10 |
| Round 4 인프라 | 2~4 |
| Round 5 검증 | 2~3 |
| **합계** | **약 27~41d** |

> hwpx 스파이크 결과에 따라 Round 3 상단/하단이 갈린다.

## 🚧 Blocker / 리스크

- **게이트 RED(현재 At Risk 사유)** — frontend `typecheck`·`lint` 실패 → Vercel 배포 게이트 차단. 액션: Round 0 즉시 착수(담당: Claude).
- **web 백엔드 운영 미배포** — Render에 web 백엔드가 한 번도 배포된 적 없음. 인프라 작업량의 핵심. 액션: Round 4(코드 완성 후), 외부 적용은 사용자 컨펌.
- **운영 마이그레이션 미적용** — Supabase가 V6에 멈춤(next_scene·logs·sessions·document version→timestamp 부재). 코드-우선 전략상 Round 4에서 일괄 적용. 액션: 적용 SQL·롤백안 사전 작성(담당: Claude) → 적용(담당: 사용자).
- **hwpx 실현가능성 미확정** — `.hwpx` 생성 라이브러리/매핑 범위가 스파이크 전엔 미확정. 액션: Round 3 첫 작업으로 스파이크, 결과로 추정 갱신.
- **무서명 외부 동작 미검증(ISSUE-027)** — contact CORS는 실브라우저 검증 전 단정 불가. 액션: Round 4 실전송 1건.

## 범위 제외(이번 V1 미포함)

- A2 모바일 캡처(iOS 단축어) 온보딩 — 백엔드 CaptureController·ApiToken은 완비, 사용자 진입 가이드는 출시 후
- 구 `.hwp` 바이너리 export(개방표준 `.hwpx`로 대체)
- B3 dev 모드 Quick Capture 오버레이 충돌(운영 빌드 무관)

## 참조

- **GitHub 트래킹:** 마일스톤 `Round 0~5`(+`Round 2.5: 챕터`) + 라벨 `launch-v1` (이슈 #34~63). 이 문서의 각 체크리스트 항목에 이슈 번호 연결됨. 진행은 이슈에서 관리, 이 문서는 전체 그림.
- 진척 SoT: vault `~/obsidian/write-note/02-PROGRESS.md` · 이슈 SoT: vault `03-ISSUES.md`
- 직전 QA: `docs/qa/2026-06-09-frontend-full-qa.md`
- 관련 이슈: ISSUE-026(곁쪽지 삭제) · ISSUE-027(contact CORS) · ISSUE-029(DB 원문 노출)
- 기능 spec(완료): `specs/015~018/`
