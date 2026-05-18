# Week 별 Phase 분해 (V1, 필수 구현 위주)

**날짜:** 2026-05-18
**상태:** 초안 — Week 진행하면서 Phase 단위 조정
**연관 문서:** [00-stack-and-schedule.md](./00-stack-and-schedule.md), [../../DESIGN.md](../../DESIGN.md), [../../designs/wireframe.html](../../designs/wireframe.html)

---

## 0. 본 문서의 위치

```
[1] DESIGN.md                    ← 본질 + UI/UX 결정
[2] 00-stack-and-schedule.md     ← 기술 스택 + Week 일정
[3] 본 문서 (01-phase-breakdown) ← Week → Phase 단위 분해
[4] week-N/phase-M.md            ← 각 Phase 진입 시 상세 spec
```

본 문서는 *어떤 Phase가 어떤 Week에 들어가는지* + *각 Phase의 한 줄 산출물*만 정의. Phase별 상세 spec(입출력, 테스트 케이스, 검증 명령 등)은 Phase 진입 시점에 `week-N/phase-M.md`로 별도 작성.

---

## 1. 분해 기준 (제약)

- **필수 구현 위주** — DESIGN.md 60-110줄 V1 범위 + wireframe.html 9 main view + 13 인증 패널
- **1 Phase = 1.5~3시간 단위** (00-stack-and-schedule.md §8-1)
- **출처 명시 의무** — DESIGN.md 줄 번호 또는 본 세션 결정 인용
- **미디자인 화면 우선순위** (DESIGN.md 378-385줄):
  - 🔴 본 Week에서 마주침 — 그 시점에 디자인+구현
  - 🟡 Tier 2 후순위
  - 🟢 V2 후보
- 추측 임의 추가 금지

---

## 2. Week 0 (1~2일 PoC)

| Phase | 작업 | 산출물 |
|---|---|---|
| 0-1 | TipTap 한국어 입력 회귀 4 케이스 검증 (빠른 타자 / 조합 중 mark / 한자 변환 / Backspace 분해) | PoC 코드 + 통과 보고 |
| 0-2 | Spring Boot Gradle 프로젝트 + Supabase Postgres connection + 단순 Entity 1개 INSERT/SELECT | 연결 확인 |
| 0-3 | PWA manifest.json + service worker 골격 + iOS Safari/Android Chrome "홈화면 추가" 노출 | manifest + sw.js |

**병렬 가능:** 0-1(프론트) ⇆ 0-2(백엔드). 0-3은 0-1 이후.
**실패 시 결정:** 0-1 실패 → Lexical fallback 재검토. 0-2 실패 → DB 호스팅 재검토. 0-3 실패 → PWA 후순위로 미루고 웹만 진행.

---

## 3. Week 1A — Spring Boot 스캐폴드

| Phase | 작업 | 출처 |
|---|---|---|
| 1A-1 | Gradle Kotlin DSL + 의존성 (Spring Web/Security/Data JPA/Validation, springdoc, ktlint) | 글로벌 룰 |
| 1A-2 | `application.yml` + 프로파일(local/prod) + DataSource (Supabase Postgres) | 글로벌 룰 |
| 1A-3 | Flyway 마이그레이션 셋업 + Users Entity 첫 스키마 | 00-stack §4-1 |
| 1A-4 | 글로벌 예외 처리 + `Result<T>` 응답 형식 + CORS 설정 | 글로벌 룰 `api-contract.md` |
| 1A-5 | Project Entity 단순 버전 CRUD end-to-end (Controller + Service + Repository) — 패턴 검증용 | 글로벌 룰 |

---

## 4. Week 1B — 인증

| Phase | 작업 | 출처 |
|---|---|---|
| 1B-1 | Spring Security 기본 (SecurityFilterChain, BCryptPasswordEncoder, JWT util) | 글로벌 룰 |
| 1B-2 | 이메일/비번 로그인 API + JWT 발급/검증 + 리프레시 토큰 | DESIGN.md 339줄 |
| 1B-3 | 회원가입 API (이메일/비번) + 이메일 인증 (verify-pending → verify-done) | DESIGN.md 343-345, 359줄 |
| 1B-4 | Kakao OAuth2 provider 등록 + 콜백 처리 + Users.kakao_id 연결 | DESIGN.md 339, 356줄 |
| 1B-5 | 5회 실패 + 30분 제한 정책 (00-stack §7 보류 결정 본 시점 처리) | DESIGN.md 361줄 |
| 1B-6 | 비밀번호 재설정 4단계 (request → sent → new → done) | DESIGN.md 342줄 |
| 1B-7 | 프론트 인증 패널 라우트 매핑 (login, signup, signup-email, login-error, login-loading) — 우선 | wireframe.html |
| 1B-8 | 프론트 인증 보조 패널 (reset 4단계, verify 2단계, signup-error) | wireframe.html |

---

## 5. Week 2 — Project + Character CRUD

| Phase | 작업 | 출처 |
|---|---|---|
| 2-1 | Project Entity 완성 필드 (genre/target_length/tone_notes/synopsis/world_notes/archived) + Repository + 인덱스 | DESIGN.md 128-131줄 |
| 2-2 | Project CRUD API (List Pageable + 단건 + 생성/수정/보관) | 글로벌 룰 |
| 2-3 | Character Entity + CRUD API | DESIGN.md 132-134줄 |
| 2-4 | 프론트 홈 view (프로젝트 카드 + 빈 상태 H0) | wireframe.html 홈 / 홈(빈) |
| 2-5 | 🔴 새 프로젝트 만들기 흐름 (미디자인, Week 2 마주침) | DESIGN.md 379줄 |
| 2-6 | 프로젝트 메타 카드 UI (사이드 패널 자리, 편집은 전용 페이지) | DESIGN.md 75-84줄 |
| 2-7 | 등장인물 관리 페이지 (목록 + 단건 편집) | DESIGN.md 384줄 |

---

## 6. Week 3 — 에디터 + 원고지

| Phase | 작업 | 출처 |
|---|---|---|
| 3-1 | Document Entity + Repository + 자동 저장 API (`PUT /api/documents/{id}`) | DESIGN.md 135-137줄 |
| 3-2 | TipTap 기본 셋업 + 한국어 IME 통과 extensions만 (bold/italic/heading/list/blockquote) | DESIGN.md 87줄 + Week 0 결과 |
| 3-3 | 분량 카운터 (자수/단어수, 진행률 ring) | DESIGN.md 92줄 |
| 3-4 | 원고지 모드 격자 오버레이 (200/400/1000자, 컬럼 마커, 행 번호) | DESIGN.md 250-253, 232-236줄 |
| 3-5 | 원고지 매수 카운팅 (200 ↔ 400 ↔ 1000 자동 변환) | DESIGN.md 252줄 |
| 3-6 | 작성 모드 분기 (설정 기반 — 에디터 vs 원고지) | DESIGN.md 243-247줄 |
| 3-7 | 에디터 사이드 패널 골격 (프로젝트 메타 + 등장인물 카드, 메모는 Week 4) | DESIGN.md 87-90줄 |
| 3-8 | 자동 저장 debounce 800ms 클라이언트 hook + 충돌 정책 last-write-wins (00-stack §7 보류 결정) | 00-stack §7 |

---

## 7. Week 4 — 메모 캡처

| Phase | 작업 | 출처 |
|---|---|---|
| 4-1 | Memo Entity + MemoProject 조인 (M:N) + ApiToken Entity + 인덱스 | DESIGN.md 139-144, 254-258줄 + 00-stack §4-1 |
| 4-2 | 메모 생성/조회/큐레이션 API (`POST /api/memos`, `PATCH /api/memos/{id}`) | DESIGN.md 60-72줄 |
| 4-3 | 메모 캡처 endpoint (`POST /api/capture` + ApiToken filter) | 본 세션 결정 2 |
| 4-4 | ApiToken 발급/조회/폐기 API + 설정 페이지 토큰 관리 UI | 본 세션 결정 2 |
| 4-5 | 🔴 데스크탑 ⌘+N 빠른 입력 모달 (미디자인, Week 4 마주침) | DESIGN.md 381줄 |
| 4-6 | 메모 inbox view (필터 칩 + overlap 카운트) | DESIGN.md 67, 257줄 |
| 4-7 | 메모 큐레이션 카드 (프로젝트 다중 / 등장인물 / 태그 / 이유 노트) + 분류 저장 800ms 애니메이션 | DESIGN.md 67-71, 265-268줄 |
| 4-8 | iOS Shortcut 셋업 가이드 + 본인 1대 셋업 + 동작 확인 | DESIGN.md 159줄 |

---

## 8. Week 5 — 세션 노트 + 메모 핀 + 검색

| Phase | 작업 | 출처 |
|---|---|---|
| 5-1 | SessionNote Entity + Repository + API | DESIGN.md 146-147줄 |
| 5-2 | 🔴 세션 종료 모달 "다음 세션을 위한 한 줄" (미디자인, Week 5 마주침) | DESIGN.md 96-98, 380줄 |
| 5-3 | 작성 화면 last-session-bar (본문 위 파란 인용 띠) | DESIGN.md 292줄 |
| 5-4 | 홈 프로젝트 카드 "지난 세션" hero 인용 + 분량 ring + 최근 작업 시각 | DESIGN.md 291줄 |
| 5-5 | TipTap custom mark `memo-pin` + ProseMirror step.mapping (00-stack §7 보류 결정) | DESIGN.md 91, 185줄 |
| 5-6 | 메모 본문 핀 클릭 흐름 (mark → 메모 카드 popover) | DESIGN.md 91줄 |
| 5-7 | 메모 검색/필터 (텍스트 + 태그 + 프로젝트 + 미분류 토글 + 등장인물) | DESIGN.md 101줄 |

---

## 9. Week 6 — 미리보기 + 다크 + 설정 + PWA 마무리

| Phase | 작업 | 출처 |
|---|---|---|
| 6-1 | 미리보기 view (본문 페이지 break + sticky footer: 진행률/페이지/목차/prev-next) | DESIGN.md 236, 246줄 |
| 6-2 | 다크 모드 토큰/색상 전 화면 적용 + 원고지 paper warm cream-dark 변환 | DESIGN.md 269-273줄 |
| 6-3 | 설정 페이지 3그룹 (작성 / 일반 / 계정) + 작성 모드 카드 선택 + 원고지 크기 + 테마 | DESIGN.md 232-240, 274-279줄 |
| 6-4 | PWA manifest 마무리 + service worker 캐시 전략 (오프라인은 V2) | 본 세션 결정 3 |
| 6-5 | 활동 피드 홈 (최근 작성 세션 시간/분량 + 최근 캡처 메모 인용) | DESIGN.md 294줄 |

---

## 10. Week 7 — 통합 + dogfooding + 출시

| Phase | 작업 | 출처 |
|---|---|---|
| 7-1 | E2E 골든패스 1건 (로그인 → 프로젝트 생성 → 에디터 → 저장 → 메모 캡처 → 큐레이션) | 00-stack §3-1 |
| 7-2 | 회귀 테스트 (TipTap 한국어 IME / 원고지 매수 카운팅 / 권한 격리) | 00-stack §3-1 |
| 7-3 | **본인 첫 단막극 한 세션 실제로 써보기 (드라이런 아님)** | DESIGN.md 197줄 |
| 7-4 | 발견된 마찰 fix (예상 2~5건) | DESIGN.md 197줄 |
| 7-5 | Vercel 프로덕션 + Render 백엔드 + Supabase Postgres 프로덕션 분리 (Phase 1 출시) | DESIGN.md 168줄 |

---

## 11. 후순위 항목 (V1 범위 외 명시)

| 항목 | 분류 | Week 마주칠 가능성 |
|---|---|---|
| 빈 inbox empty state | 🟡 | Week 4 (스킵 가능, V1.5 후보) |
| 모바일 캡처 UI (PWA 입력 화면) | 🟡 | Week 4 (Tier 2, PWA 결정 후) |
| 본문 내 텍스트 검색 | 🟢 | Week 5 (Tier 2, 후순위) |
| 단축키 커스터마이징 UI | V2 | DESIGN.md 311줄 |
| 메모 대량 분류 UX | V2 | DESIGN.md 308줄 |
| 등장인물 관계도 시각화 | V2 | DESIGN.md 310줄 |

---

## 12. Phase 분해 총량 (대략)

| Week | Phase 수 | 누적 |
|---|---|---|
| Week 0 | 3 | 3 |
| Week 1A | 5 | 8 |
| Week 1B | 8 | 16 |
| Week 2 | 7 | 23 |
| Week 3 | 8 | 31 |
| Week 4 | 8 | 39 |
| Week 5 | 7 | 46 |
| Week 6 | 5 | 51 |
| Week 7 | 5 | 56 |

총 56 Phase. 평균 Week당 7~8 Phase. 1 Phase = 1.5~3시간이면 한 Week에 *14~24시간* 작업 — 본업 후 평일 저녁 + 주말 반나절 합산 가능 범위. 무리는 아니나 *짬짬이 작업이면 빠듯*. 실제 진행 보면서 Phase 단위 조정 필요.

---

## 13. Phase 진입 시 의무 절차

00-stack-and-schedule.md §8 사이클 그대로:

1. 본질 active recall (DESIGN.md + 직전 Phase 결과 Read)
2. `week-N/phase-M.md` 상세 spec 작성 (작은 Phase 1페이지, 큰 Phase detailed)
3. (필요 시) advisor 호출로 결정 박기
4. 구현 (직접 OR AI agent dispatch — 위임 기준 00-stack §8-2)
5. 검증 게이트 (ktlint + 테스트 + 빌드 GREEN)
6. commit (Phase 단위, 원자적)
7. Phase 회고 1줄 (의외 결정 / 다음 Phase 영향)

---

## 14. 변경 이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-05-18 | 본 문서 초안. Week 0~7 총 56 Phase 분해. | plan-eng-review 세션 |
