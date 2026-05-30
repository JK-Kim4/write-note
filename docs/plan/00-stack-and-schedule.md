# write-note V1 — 기술 스택 + 작업 일정

**날짜:** 2026-05-18
**상태:** 본 세션(plan-eng-review) 결정 기록 — 구현 대기
**전 단계 산출물:** [DESIGN.md](../../DESIGN.md), [designs/wireframe.html](../../designs/wireframe.html)
**다음 단계:** 각 Week를 Phase 단위로 분해 + Phase별 spec 작성 후 구현

---

## 0. 본 문서의 위치 (3계층 컨텍스트 영속 구조)

```
[1] DESIGN.md            ← 본질 + UI/UX 결정 (변경 빈도 낮음)
[2] 본 문서 (이 파일)     ← 기술 스택 + 일정 + 보류 결정 (Week 진행 중 갱신)
[3] week-N/phase-M.md    ← 각 Phase 상세 spec (Phase 진입 시 작성)
```

write-note 자체가 "컨텍스트가 안 죽는 작가의 작업공간"이므로, 본 도구를 *만드는 과정*에도 같은 원칙을 적용한다. 세션 단절 시 본 문서 + 직전 Phase spec만 다시 읽으면 재진입 가능하게 유지.

---

## 1. 본질 정의 (DESIGN.md 인용)

| 항목 | 내용 (출처) |
|---|---|
| 목표 | "세션이 끊겨도 컨텍스트가 살아있는 작가의 외장 기억장치" (DESIGN.md 26줄) |
| 1차 사용자 | 본인. 한국어 작가 (DESIGN.md 38줄) |
| 작업 환경 | 본업 따로 + 주말/저녁 30~90분 세션 (DESIGN.md 38줄) |
| 메인 사용 환경 | PC + 패드(아이패드 포함) > 휴대폰 (본 세션 결정) |
| 비용 제약 | V1: $0/월. V2 진입 시 +$124 첫 해(앱스토어 등록) (DESIGN.md 163줄 + 본 세션 결정) |
| 일정 제약 | 6~8주 (DESIGN.md 167-170줄 + 백엔드 변경 +1~2주) |
| dogfooding 기준 | 본인이 주 1회 이상 글쓰기 세션 시작 시 이 도구를 연다 (DESIGN.md 176줄) |
| 실패 신호 | V1 출시 4주 후에도 본인이 안 쓰고 있음 → V2 가지 말고 MVP 재설계 (DESIGN.md 178줄) |

---

## 2. 기술 스택 (최종 결정)

### 2-1. 결정 사항 매트릭스

| 레이어 | 선택 | DESIGN.md 원안 대비 | 결정 출처 |
|---|---|---|---|
| 프론트 | Next.js 16.2.6 (App Router) + TypeScript 5.9 + React 19.2 + Tailwind 4.3 + ESLint 9 | 15 → 16 (시스템 환경 정합, App Router 그대로) | DESIGN.md 155줄 + 본 세션 결정 (2026-05-19 갱신) |
| 에디터 | **TipTap** (ProseMirror 기반) | 동일 | 본 세션 결정 1 |
| 상태 관리 | React Query (서버 데이터) + Zustand (로컬 UI 상태) | "or" → 둘 다 역할 분리 | 본 세션 |
| 백엔드 언어 | **Kotlin** | Supabase → 변경 | 본 세션 결정 |
| 백엔드 프레임워크 | **Spring Boot 4.0.6** (Web + Security + Data JPA + Validation) | 신설 | 본 세션 결정 (2026-05-19 갱신 — start.spring.io current GA) |
| 백엔드 런타임 Java | **Java 24 (Gradle toolchain)** — 시스템 Corretto 25 는 호스트 그대로 | 신설 | PoC 0-2 결과 — Kotlin 2.2.21 의 JVM target 25 미지원 → Initializr default 24 회귀 (2026-05-19) |
| API 문서 | springdoc-openapi | 신설 | 글로벌 룰 `api-contract.md` |
| 빌드 | Gradle (Kotlin DSL) | 신설 | 글로벌 룰 표준 |
| DB | **PostgreSQL** (Supabase Postgres를 DB로만 사용) | Supabase의 DB 부분만 유지 | 본 세션 결정 (무료 500MB + pgvector 확장 V2 대비) |
| 인증 | Spring Security + JWT + Kakao OAuth2 | Supabase Auth → 직접 구현 | 본 세션 결정 |
| 실시간 동기화 (V1) | polling + 포커스 시 refetch | Supabase Realtime → 단순화 | 본 세션 (Phase 1 본인 1명이라 동시 편집 거의 없음) |
| 실시간 동기화 (V2) | WebSocket (Spring WebSocket/STOMP) 검토 | 신설 | V2 후보 |
| 모바일 캡처 | iOS Shortcut → `POST /api/capture` + 사용자별 long-lived API token | Edge Function → Spring Controller | 본 세션 결정 2 |
| 제공 경로 (V1) | **웹 (Vercel) + PWA** (홈화면 추가 시 풀스크린) | PWA 신설 | 본 세션 결정 3 |
| 제공 경로 (V2) | Capacitor → Apple App Store + Google Play | 신설 (V2 후보) | 본 세션 결정 3 |
| 프론트 호스팅 | Vercel (무료) | 동일 | DESIGN.md 160줄 |
| 백엔드 호스팅 | **Render 무료 web service** 추천 (cold start 30초+ 감내) | 신설 | 본 세션 |
| 테스트 | JUnit 5 + AssertJ + MockK (Kotlin), Spring Boot Test + Testcontainers (통합), Playwright (E2E 골든패스 1건), Vitest (프론트) | 강화 | 글로벌 룰 + 본 세션 |
| 코드 품질 | ktlint + Checkstyle | 신설 | 글로벌 룰 `code-quality.md` |

### 2-2. 비용 구조

| 단계 | 인프라 | 등록 비용 |
|---|---|---|
| V1 (웹 + PWA) | Vercel 무료 + Render 무료 + Supabase Postgres 무료 (500MB) | $0 |
| V2 (앱스토어 진입) | 동일 | + Apple Developer 연 $99 + Google Play 1회 $25 = 첫 해 $124, 이후 $99/년 |

### 2-3. 호스팅 운영 주의 (Render 무료 web service)

- cold start 30초+ — 본인용 dogfooding이라 감내. Phase 2(친구 1-2명) 진입 전에 유료 plan 검토 또는 keepalive ping 설정 결정
- 메모리 512MB — Spring Boot 충분
- GitHub 자동 배포 — push 시 자동 빌드/배포

---

## 3. Spring Boot 모듈 구성 (글로벌 룰 적용)

```
src/main/kotlin/com/writenote/
├── controller/        @RestController — DTO 받고 Service 호출
├── service/           트랜잭션 경계, 비즈니스 흐름
├── components/        ~~~Manager / ~~~Checker / ~~~Validator / ~~~Converter
├── repository/        Spring Data JPA
├── entity/            JPA Entity (모든 연관관계 LAZY)
├── model/
│   ├── request/       CreateProjectRequest, UpdateMemoRequest, ...
│   └── response/      ProjectResponse, MemoResponse, ...
├── enums/
├── error/             전역 예외 처리 + 커스텀 에러 코드
├── config/            SecurityConfig, OpenApiConfig, CorsConfig, ...
├── auth/              KakaoOAuth2UserService, JwtTokenProvider, ApiTokenFilter
└── mapper/            Entity ↔ DTO
```

적용 글로벌 룰:
- `architecture.md` — 계층형 아키텍처 + Component 활용
- `spring-patterns.md` — `@Transactional` 정책, Service 비대화 방지
- `api-contract.md` — Result<T> 응답 형식, DTO 네이밍 (CreateXxxRequest / XxxResponse)
- `jpa-mongodb.md` — N+1 방지 (`@EntityGraph`/JOIN FETCH), 모든 연관관계 LAZY
- `domain-patterns.md` — Repository는 Pageable 필수, `findAll()` 무제한 금지

---

## 4. 데이터 모델 (DESIGN.md 인용 + 본 세션 보완)

### 4-1. 엔티티 (DESIGN.md 124-147줄 + 298-304줄)

```
Users
  id, email, kakao_id (nullable), created_at, password_hash (nullable, 이메일 로그인용)

Project
  id, user_id, title, genre, target_length, tone_notes,
  synopsis, world_notes, created_at, updated_at, archived

Character
  id, project_id, name, short_description, notes

Document
  id, project_id, title, body (text), word_count, updated_at
  # MVP는 프로젝트당 1개. 여러 문서는 V1.5

Memo
  id, user_id, body, source (mobile/desktop), captured_at,
  active_project_at_capture (nullable),    # 캡처 시점 자동 기록
  reason_note (nullable),                    # 큐레이션 시점 "왜 적었나"
  tags (text[]),
  pinned_document_id (nullable),
  pinned_position (nullable)

MemoProject (M:N 조인 — DESIGN.md 254-258줄)
  memo_id, project_id, character_id (nullable)

SessionNote
  id, project_id, body, created_at, ended_at, word_count_at_end

ApiToken (모바일 캡처용 — 본 세션 신설)
  id, user_id, token_hash, label, created_at, revoked_at (nullable)
```

### 4-2. 인덱스 (성능 회귀 방지)

- `Memo(user_id, captured_at DESC)` — inbox 정렬
- `MemoProject(project_id)` — 프로젝트별 메모 조회
- `MemoProject(memo_id)` — 메모의 연결 프로젝트 조회
- `Document(project_id)` — 프로젝트별 본문
- `Project(user_id, updated_at DESC)` — 홈 최근 프로젝트
- `ApiToken(token_hash)` — 캡처 인증 lookup

### 4-3. 권한 정책 (Supabase RLS 대체 — Service 레이어)

모든 Service 메서드:
- 입력에 `userId` 받음 (Spring Security `@AuthenticationPrincipal`에서 추출)
- Repository 호출 시 `userId` 필터 강제
- 다른 user의 리소스 접근 시 `EntityNotFoundException` 반환 (정보 노출 회피)

---

## 5. 작업 일정 (대략 추정)

**총 6~8주.** 사용자 친숙도(Spring) 보상으로 6주에 들어올 가능성 있음. 단 한국어 IME 회귀 / Kakao OAuth Redirect 디버깅 등 예상 못한 함정으로 8주 넘길 가능성도 있음.

### 5-1. 일정표

| 시점 | 작업 | dogfooding 가능 |
|---|---|---|
| Week 0 (1~2일) | PoC 3종 (아래 5-2 참고) | — |
| Week 1A | Spring Boot 스캐폴드, JPA Entity + Schema, 기본 Entity 1개 CRUD 동작 확인 | — |
| Week 1B | Spring Security + JWT + Kakao OAuth2 + 이메일/비번 로그인 동작 | 로그인까지 |
| Week 2 | Project / Character CRUD + 메타 카드 UI | 프로젝트 생성/조회 |
| Week 3 | TipTap 에디터 본 구현 (분량 카운터, 사이드 패널 골격) + 원고지 모드 | **본문 한 줄 입력 가능** |
| Week 4 | 메모 캡처 (⌘+N 모달 + inbox + 큐레이션 UI), iOS Shortcut + `/api/capture` | 메모 캡처 |
| Week 5 | 세션 노트 흐름, 메모-본문 핀, 검색/필터 | 세션 종료 한 줄 |
| Week 6 | 미리보기, 다크 모드, 설정 페이지, PWA 마무리 | 다크/PWA |
| Week 7 | 통합 다듬기, **본인 첫 단막극 실제로 써보기**, 발견된 마찰 수정 | **본질 검증** |

**매 Week 끝에 본인이 한 세션이라도 실제로 글을 써본다** (DESIGN.md 197줄). 못 쓸 상태면 그 주가 잘못된 것 — 다음 Week 진입 전 본질 회복.

### 5-2. Week 0 PoC 3종

| Phase | 검증 대상 | 통과 기준 |
|---|---|---|
| 0-1. TipTap 한국어 입력 | DESIGN.md §미해결 #2 (183줄) | 4가지 회귀 케이스 (빠른 타자/조합 중 마크 적용/한자 변환/Backspace 분해) 모두 정상 |
| 0-2. Spring Boot + Postgres 연결 | 백엔드 변경 검증 | `application.yml`에 Supabase Postgres connection string, 단순 Entity 1개 + Repository로 INSERT/SELECT GREEN |
| 0-3. PWA manifest + service worker 골격 | DESIGN.md §미해결 #1 (182줄) | iOS Safari + Android Chrome에서 "홈화면 추가" 메뉴 노출 |

3개 다 통과 → Week 1A 진입. Phase 0-1 실패 → Lexical fallback 재검토 결정 인터뷰. Phase 0-2 실패 → DB 호스팅 재검토. Phase 0-3 실패 → PWA 후순위로 미루고 웹만 진행 결정.

---

## 6. NOT in scope (V1)

다음은 본 세션에서 *명시적으로 V1 범위 외* 결정된 항목:

- 모든 LLM/AI 기능 (DESIGN.md 105-110줄과 일치)
- Capacitor / 앱스토어 출시 (V2 후보)
- 모바일 에디터, 협업/다중 사용자, Export(PDF/EPUB), 알림/뉴스레터
- 버전 관리/히스토리 (Supabase Postgres 백업으로 충분)
- 새 프로젝트 생성 흐름 / 세션 종료 모달 / ⌘+N 모달 UI (DESIGN.md 378-385줄에 따라 Week별 lazy 마무리)
- WebSocket 실시간 동기화 (V1은 polling + refetch on focus로 단순화)

---

## 7. 보류된 결정 (Week 진행 중 마주칠 때 결정)

| 항목 | 마주칠 시점 | 비고 |
|---|---|---|
| 다중 디바이스 동시 편집 충돌 정책 | Week 3 (에디터 자동 저장 시점) | ✅ 해소: optimistic lock(Document.version) + 409 Conflict + 다시 로드/덮어쓰기 **사용자 선택 UI** (03-backend §6 ②-8 C / spec 006 정합). ~~기본 가정 last-write-wins~~ 폐기 |
| 메모 핀 위치 추적 구체 구현 | Week 5 (메모-본문 핀) | TipTap custom mark + ProseMirror step.mapping. 핀이 가리키는 텍스트 삭제 시 핀도 사라지는 동작이 자연스러움 |
| 5회 로그인 실패 → 30분 제한 구현 방식 | Week 1B (인증 마무리) | Postgres 함수 vs Spring Filter 둘 다 가능. DESIGN.md 361줄에 UI는 명시됨 |
| 모바일 화면 우선순위 | Week 4 (모바일 캡처) | 휴대폰에서 어디까지 사용 가능하게 할지 (캡처만? 메모 조회까지?) |
| 모바일 캡처 PWA 단독 vs Shortcut+PWA 병행 | Week 4 | iOS Shortcut은 위젯/Siri로 즉시 메모 가능 — 마찰 0 |

---

## 8. 작업 방식 (Phase 사이클)

각 Week를 Phase 단위로 분해 후 다음 사이클 반복:

```
Phase 진입
  │
  ├─ 1. 본질 active recall (DESIGN.md + 직전 Phase 결과 Read)
  ├─ 2. spec.md 작성 (작은 Phase는 1페이지, 큰 Phase는 detailed)
  ├─ 3. (필요 시) advisor 호출로 결정 박기 — 다중 분기/cross-cutting 영역
  ├─ 4. 구현 (직접 OR AI agent dispatch)
  │     - 직접: 단일 파일 ~50줄, 명확한 시그니처 변경
  │     - AI agent 위임: 다중 파일 + 라운드 의존, TDD HARD-GATE 영역
  ├─ 5. 검증 게이트 — ktlint + 테스트 + 빌드 GREEN
  ├─ 6. commit (Phase 단위, 원자적)
  └─ 7. Phase 회고 1줄 (의외 결정 / 다음 Phase 영향)
```

### 8-1. Phase 사이즈 가이드

- 1 Phase = **1.5~3시간 안에 완결 가능한 단위**
- 그래야 30~90분짜리 짬 1~2번에 1 Phase 끝남
- Phase 중간에 세션 끊김 = 컨텍스트 비용 회귀

### 8-2. AI agent 위임 기준 (글로벌 룰 `subagent-delegation-cost.md`)

| 케이스 | 위임 여부 |
|---|---|
| 단일 파일 ~50줄 변경 | 직접 |
| 명확한 시그니처 변경 | 직접 |
| 30분 내 작업 | 직접 |
| 다중 파일 + 라운드 의존 | 위임 |
| TDD HARD-GATE 영역 (도메인 로직·매핑·상태 전이) | 위임 |
| 다중 분기 (8+ fail-closed 분기 등) | 위임 |
| 병렬 가능한 독립 작업 | 위임 |

위임 1회 ≈ 25,000+ 토큰 비용. *룰 적용을 위해* 위임하는 안티패턴 회피.

---

## 9. 본질 제약 정합성 점검

| 본질 제약 | 현 결정 | 정합성 |
|---|---|---|
| $0/월 (DESIGN.md 163줄) | Vercel + Render + Supabase Postgres 무료 | ✅ |
| 6주 MVP (DESIGN.md 167-170줄) | 6~8주 추정 | ⚠️ +1~2주 가능성 (백엔드 변경) |
| 본인 dogfooding (DESIGN.md 176줄) | 매 Week 끝 dogfooding 의무화 | ✅ |
| 한국어 우선 (DESIGN.md 전제 #5) | TipTap PoC + Kakao OAuth | ✅ |
| AI 없는 MVP (DESIGN.md 전제 #6) | LLM/AI 기능 NOT in scope | ✅ |
| 모바일 캡처 핵심 (DESIGN.md 36줄) | iOS Shortcut + `/api/capture` 유지 | ✅ |

**경계해야 할 회귀 신호:**
- spec 작성 시간 > 구현 시간 → spec 무게 조절
- AI agent 자동 위임 늘어남 → 직접/위임 기준 재점검
- 매 Week 끝 dogfooding 안 함 → 본질 회피, 즉시 stop

---

## 10. 변경 이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-05-18 | 본 문서 초안 작성. 백엔드 Supabase → Kotlin+Spring Boot 변경. PWA 추가. V2에 Capacitor+앱스토어. | plan-eng-review 세션 결정 |
| 2026-05-19 | Spring Boot 3.x → 4.0.6 + Java 25 (Corretto LTS) 명시. | 시스템 환경 정합 (`java -version` = Corretto 25) + start.spring.io 메타데이터 (`bootVersion default = 4.0.6.RELEASE`, `javaVersion values = [26,25,21,17]`) |
| 2026-05-19 | Next.js 15 → 16.2.6 명시 (App Router 그대로). | `pnpm dlx create-next-app@latest` 결과. React 19.2 / Tailwind 4.3 / ESLint 9 / TypeScript 5.9 동반 |
| 2026-05-19 | Java 25 → Java 24 (Gradle toolchain) 회귀. | PoC 0-2 빌드 결과 — Kotlin 2.2.21 의 `kotlinc` 가 JVM target 25 미지원 (`falling back to Kotlin JVM_24 JVM target` + `Inconsistent JVM-target compatibility`). Spring Initializr default 24 가 검증된 호환 조합. Kotlin 의 Java 25 target 지원 시 (2.3.x 후속 검증) 재상승 후보 |
