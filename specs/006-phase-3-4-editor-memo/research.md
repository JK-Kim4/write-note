# Research: 에디터·원고지 + 메모 캡처 (Week 3+4 통합)

**Branch**: `006-phase-3-4-editor-memo` | **Date**: 2026-05-30
**SoT 근거**: `docs/plan/03-backend-requirements.md` §2-2/§3-4/§3-5/§3-6/§4-4, `DESIGN.md` 60-110·230-285, `01-phase-breakdown.md` §6·§7, PoC `docs/poc/0-1-tiptap-korean.md`

본 문서는 spec 의 미결정·신규성 영역을 결정/근거/대안으로 박는다. 대부분은 이미 03-backend SoT 또는 기존 코드에 답이 있어 **인용·정합**이고, 신규성 높은 영역(원고지 격자, 활성 프로젝트 컨텍스트)만 새 결정이다.

---

## R-1. TipTap extensions 셋업 (Week 3-2)

- **Decision**: `StarterKit` 기반 + 한국어 IME 통과 extensions만 사용 — bold / italic / heading / bulletList / orderedList / blockquote (모두 StarterKit 포함). `useEditor({ extensions: [StarterKit], immediatelyRender: false })`. body 는 ProseMirror JSON 으로 직렬화하여 Document.body(JSONB)에 저장.
- **Rationale**: PoC 0-1 에서 `@tiptap/{react,starter-kit,pm}@3.23.5` + `immediatelyRender:false` 가 한국어 IME 4 케이스(빠른 타자/조합 중 mark/한자 변환/Backspace 분해) 모두 통과. 검증된 기준선 그대로 재사용. `immediatelyRender:false` 는 Next.js SSR hydration mismatch 회피 공식 권장(PoC §5).
- **Alternatives**: Lexical(PoC 실패 시 fallback 후보였으나 TipTap 통과로 불요) / 개별 extension 수동 조합(StarterKit 가 이미 6종 포함하므로 불요).
- **회귀 의무**: extension 추가/변경 시 PoC 0-1 의 4 케이스 재검증 (`.claude/rules/typescript/code-quality.md` §TipTap 한국어 IME 회귀).

## R-2. 원고지 격자 오버레이 구현 (Week 3-4) — 신규성 최고

- **Decision**: 원고지 모드는 **TipTap 에디터를 격자 배경 위에 올리는 CSS 레이어 방식**으로 접근. (a) 격자(행·열 칸, 컬럼 마커 5/10/15/20, 행 번호)는 CSS(grid/background + 의사요소)로 그린 **표시 전용 오버레이**, (b) 본문은 동일한 ProseMirror 문서를 monospace 한국어 폰트 + 고정 글자폭(`ch`/`em` 기반)으로 렌더해 칸에 정렬. 본문 데이터는 에디터 모드와 **동일한 Document.body** (R-7 참조).
- **Rationale**: 에디터/원고지는 "표시 방식"이지 별도 데이터가 아니다(DESIGN.md 243-247 "작성 모드는 설정에서 한 번 결정", entity 가 Project↔Document 1:1). 격자를 데이터에 박지 않고 표시 레이어로 두면 모드 전환·크기 변경 시 본문 유실 위험 0(SC-006).
- **Alternatives**: (i) ProseMirror `Decoration` 으로 칸을 노드에 주입 — IME 조합 중 decoration 재계산이 한국어 입력 안정성(R-1)을 위협할 수 있어 회피. (ii) canvas 별도 렌더 — 텍스트 선택/편집과 격자 동기화 복잡. (iii) 원고지 전용 별도 텍스트 모델 — 1:1 entity·SC-006 위반.
- **⚠️ 미검증 리스크**: 한 칸=한 글자 정렬은 한글 고정폭 + 자간 제어에 민감. **구현 라운드에서 한국어 1문단 격자 정렬 dogfooding 의무**(라이트/다크 + 200/400/1000 각각). 정렬이 어긋나면 "격자는 배경 가이드, 글자는 흐름" 의 완화 모드로 fallback (DESIGN.md 의 "격자 오버레이" 문구는 시각 가이드 우선 해석 가능).

## R-3. 원고지 매수 카운팅 + 크기 자동 변환 (Week 3-5)

- **Decision**: 매수 = `ceil(공백제외_자수 / 칸수)`. 200자(10×20)/400자(20×20)/1000자(25×40)는 칸수 상수. 크기 변경 = 같은 자수에 다른 칸수 적용한 재계산(본문 불변).
- **Rationale**: 매수는 파생 표시값. 저장 대상 아님(Document 에 매수 컬럼 없음). `manuscriptSize` store(이미 존재, default 400)로 칸수 결정.
- **Alternatives**: 매수를 서버 저장 — 파생값이라 불요(YAGNI).

## R-4. 자수 카운팅 (Week 3-3)

- **Decision**: **서버가 권위**(Document.word_count, 공백 제외, PUT 시 서버 계산 — 03-backend §2-2). 클라이언트는 표시용으로 즉시 계산(저장 응답의 word_count 로 동기화). 진행률 = `word_count / 목표분량(target_length)`.
- **Rationale**: SoT(§2-2)가 "공백 제외, 서버 자동 계산" 명시. 진행률 ring 은 `ProgressRing` 컴포넌트 재사용(write/layout.tsx 에 이미 존재).
- **Alternatives**: 클라이언트 권위 — 다중 기기 시 불일치, 회피.

## R-5. 자동 저장 debounce 800ms + 충돌 처리 (Week 3-8, clarify 해소)

- **Decision**: 클라이언트 800ms debounce hook → `PUT /api/documents/{id}` `{ body, version }`. 서버는 JPA `@Version` optimistic lock. 충돌 시 **409 `DOCUMENT_VERSION_CONFLICT` + `currentVersion` + `currentBody`** 반환 → 클라이언트는 자동 덮어쓰지 않고 **"다시 불러오기 / 내 것으로 덮어쓰기" 선택 UI** 제시(FR-006, clarify Session 2026-05-30).
- **Rationale**: 03-backend §3-4/§6 ②-8 C 공식 결정. specify/clarify 에서 last-write-wins(폐기) → 사용자 선택 UI 로 확정. 00-stack §7 / 01-phase 3-8 정정 완료(커밋 `364485e`).
- **Alternatives**: last-write-wins(폐기 — 데이터 유실), 실시간 CRDT/WebSocket(00-stack §6 = V1 polling 으로 단순화, V2).

## R-6. 본문 조회 경로 (clarify Q1 해소)

- **Decision**: nested 엔드포인트 **`GET /api/projects/{projectId}/document`** 신설. 응답 = `{ id, title, body, wordCount, version, updatedAt }`. 이후 자동저장은 본문 자체 id 로 `PUT /api/documents/{id}`.
- **Rationale**: clarify Session 2026-05-30. 등장인물(`/api/projects/{projectId}/characters`) nested 패턴 정합 + projectId 1회 조회. 03-backend §3-4 에 endpoint 1개 추가(§6 변경이력에 기록 의무).
- **Alternatives**: ProjectResponse 에 documentId 추가(round-trip 2회) / `?projectId=` 쿼리(목록형 endpoint 의미 어긋남) — clarify 에서 기각.

## R-7. 활성 프로젝트 컨텍스트 (작성 화면이 어느 본문을 여는가)

- **Decision**: `/write` 단일 URL(005 Clarification Q3)은 **현재 활성 프로젝트**의 본문을 연다. 활성 프로젝트 식별자는 홈/프로젝트 카드에서 작성 진입 시 결정되어 클라이언트 상태(Zustand UI store 또는 URL search param)로 전달. write 진입 시 그 projectId 로 R-6 호출.
- **Rationale**: DESIGN.md 의 작성 화면은 "한 프로젝트의 본문". 005 가 `/write` 를 단일 URL 로 박았으므로 projectId 를 라우트 path 가 아닌 활성 컨텍스트로 보유. `useUi` store(이미 존재) 확장 또는 `?projectId=` search param.
- **⚠️ clarify-후보(plan 내 결정)**: search param(`/write?projectId=`) vs store. **search param 채택** — 새로고침/북마크/딥링크에 강하고 가드(requireAuth)와 무관하게 복원 가능. store 단독은 새로고침 시 활성 프로젝트 유실.
- **Alternatives**: `/projects/[id]/write` 로 라우트 변경 — 005 의 `/write` 단일 URL 결정 번복이라 회피.

## R-8. 신규 entity + V6 마이그레이션 (Week 4-1)

- **Decision**: `memos` / `memo_projects` / `memo_project_characters` / `api_tokens` 4 테이블 + entity 신설. 단일 마이그레이션 `V6__create_memos_and_api_tokens.sql`. 스키마는 03-backend §2-2 정합(data-model.md 에 SQL 스케치). **핀 관련 컬럼(`pinned_document_id`)은 본 spec 제외(Week 5)** — memos 테이블에서 생략하고 Week 5 마이그레이션에서 ADD COLUMN.
- **Rationale**: SoT §2-2 가 11/4/4/7 필드 상세 정의. FK `ON DELETE CASCADE`(memo_projects→memo, memo_project_characters→memo_project). 자수/태그는 `TEXT[]` + GIN 인덱스.
- **Alternatives**: pinned 컬럼 포함 — Week 5 핀 기능 의존이라 본 spec 에선 미사용 컬럼이 됨, YAGNI 로 Week 5 이연.
- **External infra safety (HARD-GATE)**: V6 작성·리뷰 OK, **적용(flywayMigrate/boot 자동) 은 사용자 명시 컨펌** 후만(`.claude/rules/infra/external-infra-safety.md`).

## R-9. 모바일 캡처 멱등성 (Week 4-3)

- **Decision**: `POST /api/capture` 는 `Idempotency-Key` 헤더 수용. **5분 메모리 TTL 캐시**(단일 Render 인스턴스 — 동시성 단순). 같은 키 재요청 시 이전 응답 그대로 반환(FR-014, SC-007).
- **Rationale**: 03-backend §3-1 멱등성 규약. 단일 인스턴스라 분산 캐시(redis) 불요(YAGNI, V1).
- **Alternatives**: DB unique 제약으로 멱등 — 캡처 본문이 동일해도 의도적 중복일 수 있어 키 기반이 정확. redis — 인프라 미도입(V1).

## R-10. ApiToken 생성·해시 (Week 4-3/4-4)

- **Decision**: 토큰 = `wnt_` + base62 무작위 32자(총 36자). 저장 = SHA-256 `token_hash`(UNIQUE) + 평문 `token_prefix`(8자, UI 식별). **발급 시 원본 1회만 응답**, 이후 미저장(FR-021). 검증 = 요청 토큰 SHA-256 → hash 조회 + `revoked_at IS NULL`.
- **Rationale**: 03-backend §2-2 ApiToken 정의. 해시 저장은 유출 시 평문 노출 방지(security 표준).
- **Alternatives**: JWT 형식 — 장기 유효 + 해지 추적엔 DB 조회형 토큰이 적합(refresh token DB 패턴과 정합, 003).

## R-11. ApiTokenAuthenticationFilter 결선 (Week 4-3)

- **Decision**: 기존 stub(`/api/capture` 한정, 현재 항상 401)을 **실제 결선** — `ApiTokenRepository` 주입 + R-10 검증 + 성공 시 SecurityContext 에 인증 박음 + `last_used_at` 갱신. SecurityConfig 의 filter 등록·`/api/capture` permitAll 은 이미 존재(변경 최소).
- **Rationale**: 코드에 TODO(#week4-api-token) 명시 + SecurityConfig 결선 확인 완료. 헤더 분기(`Bearer wnt_`)도 이미 박힘.
- **Alternatives**: 새 filter 작성 — 기존 stub 재사용이 surgical(불요).

## R-12. 메모 큐레이션 단일 트랜잭션 (Week 4-7)

- **Decision**: `PUT /api/memos/{id}/curation` 페이로드 = `{ projectConnections: [{ projectId, characterIds }], tags, reasonNote }`. 서버가 **현재 연결과 차이 계산** 후 MemoProject/MemoProjectCharacter add·remove + tags/reasonNote 갱신을 **단일 트랜잭션**으로. 인물은 연결 프로젝트 소속 검증(FR-017).
- **Rationale**: 03-backend §3-5 #35. 큐레이션 1회 = 1 API(부분 갱신 누적 아닌 선언적 전체 상태).
- **Alternatives**: 연결별 개별 endpoint — round-trip 多 + 트랜잭션 경계 모호, 회피.

## R-13. N+1 회피 (Week 4-2)

- **Decision**: `GET /api/memos` 목록은 메모별 연결 프로젝트/인물/태그/핀상태 포함 → `@EntityGraph` 또는 `JOIN FETCH` 로 N+1 0회(03-backend §3-5 #29 명시). 검증 = IT 의 Hibernate Statistics 쿼리 카운트(004 Phase 8 패턴 재사용).
- **Rationale**: SoT 명시 + `.claude/rules/java/spring/jpa-mongodb.md`.
- **Alternatives**: lazy 개별 로드 — N+1, 회피.

## R-14. frontend 본질 문서 정합성 (agent-workflow-discipline §5)

- **Decision**: `frontend/AGENTS.md` 의 "Next.js 16 breaking changes — `node_modules/next/dist/docs/` 정독 의무" 경고의 docs 디렉토리 **존재 재확인 완료**(2026-05-30). 작성 라운드에서 에디터/모달 등 신규 client 컴포넌트 작성 전 관련 가이드 정독.
- **Rationale**: ISSUE-003(005 R-10 에서 존재 확인)이 본 시점에도 유효. RSC 경계(`'use client'`) HARD-GATE 정합(`.claude/rules/typescript/code-quality.md`) — 에디터/모달/폼은 모두 client 의무.
- **Alternatives**: 없음(검증 의무 영역).

## R-15. 데스크탑 ⌘+N 빠른 입력 모달 (Week 4-5, 🔴 미디자인)

- **Decision**: 최소 형태 모달 — 본문 textarea + 저장 단축키. 전역 단축키(⌘+N)는 작성/홈 등 인증 화면에서 동작. 저장 = `POST /api/memos`(JWT, source=DESKTOP, active_project_at_capture 자동).
- **Rationale**: DESIGN.md 381 미디자인 영역, "캡처는 마찰 0". 최소 외관 후 dogfooding 으로 정련.
- **Alternatives**: 정교한 디자인 선행 — 미디자인 화면은 마주친 시점 lazy(01-phase §1), 과설계 회피.

## R-16. MVP 라운드 분해 (진행 방식 — 005 패턴 정합)

- **Decision**: 본 spec(16 phase)을 **MVP 우선 라운드**로 분해:
  - **R1 (MVP, US1 P1)**: Document nested 조회 + 자동저장 PUT(409) + title PATCH + 에디터 모드 본문 작성 + 자수/진행률 + 사이드 패널 실데이터 → **사용자 검증**
  - **R2 (US2 P2)**: 원고지 격자 + 매수 + 모드 분기
  - **R3 (US3 P2)**: V6 마이그레이션 + Memo entity + 데스크탑/모바일 캡처 + ApiTokenFilter 결선 + inbox 도착
  - **R4 (US4 P3)**: 큐레이션(차이 계산) + 필터 + 미분류
  - **R5 (US5 P3)**: ApiToken 발급/관리 + 설정 UI + iOS Shortcut 가이드
- **Rationale**: 005 의 "MVP(R1+US1) → 검증 → 확장" 이 효과적. 각 US 독립 테스트 가능(spec Independent Test).
- **Alternatives**: 일괄 구현 — 검증 지점 부재 + 회귀 silent 누적 위험.

---

## 미해결(plan 후 tasks/구현에서 처리)

- 원고지 한글 칸 정렬 실측(R-2 ⚠️) — 구현 라운드 dogfooding.
- 단어수("단어" 정의 — 공백 분리 토큰) 표시 세부 — 자수가 주 지표, 단어수는 보조(plan 영역).
- inbox overlap 카운트 계산식(필터 칩 숫자) — 큐레이션 구현 시 확정.
- ⌘+N 전역 단축키 등록 범위(어느 라우트) — R3 구현 시.
