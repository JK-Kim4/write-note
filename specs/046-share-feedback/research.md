# Research — 공유하기 (046)

핵심 설계 결정. 모두 실제 코드 실측 기반(추측 0).

## R-1. Optional auth (비로그인 열람 + 회원만 댓글)

- **Decision**: 신규 필터 없이 `/api/shared/**` 를 `SecurityConfig` permitAll + 컨트롤러에서 nullable `@AuthenticationPrincipal AuthenticatedPrincipal?` 로 회원/익명 분기. 댓글 POST 는 principal == null 이면 401(UNAUTHENTICATED) 던짐.
- **Rationale**: 실측 — `JwtAuthenticationFilter.doFilterInternal` 은 토큰 없으면 `filterChain.doFilter`(pass-through), 유효 토큰이면 `SecurityContext` 에 `AuthenticatedPrincipal` 세팅, 무효 토큰이면 401. permitAll 경로에서 이 거동이 그대로 동작 → 토큰 없는 열람=익명, 회원=principal. 별도 optional-auth 필터 불필요.
- **Alternatives**: (a) 신규 OptionalAuthFilter — 불필요(기존 필터가 이미 pass-through). (b) `/api/shared/**` authenticated — 비로그인 열람 불가라 기각.
- **엣지(기록)**: 무효·만료 토큰을 가진 요청은 공개 경로라도 `JwtAuthenticationFilter` 가 401. 회원이 만료 토큰으로 공개 페이지 접근 시 401. FE 완화 = 공개 페이지에선 만료 토큰 미전송 또는 사전 refresh. Phase 1 허용 엣지.

## R-2. 스냅샷 본문 저장 = owner 키 암호화(ciphertext 복사)

- **Decision**: `share_snapshot.body_snapshot` = 공유 시점 `documents.body`(이미 owner 키 암호문)의 **복사본**. 공개 read 시 `BodyCipherService.decryptToPlain(ownerId, body_snapshot)` 로 평문 PM JSON 반환.
- **Rationale**: 본문은 owner DEK 로 암호화 저장(`DocumentService` 실측). 스냅샷은 같은 owner·같은 DEK 이므로 암호문을 그대로 복사하면 재암호화 불필요 + 평문이 스냅샷 동결 과정에 노출 안 됨. `decryptToPlain` 은 034 에서 readOnly-safe(DEK 미생성, 기존 DEK 만 조회)로 수정됨 → 공개 read(readOnly) 안전.
- **Alternatives**: (a) 평문 스냅샷 저장 — 사용자 결정으로 기각(at-rest 평문 0). (b) decrypt→reencrypt — 불필요(동일 키).
- **주의**: 대상 작품 삭제 후에도 스냅샷 보존(FR-025) → owner(user) 는 존재하므로 DEK 유효, 작가 인박스 복호 가능. 링크 비활성이라 공개 read 는 차단.

## R-3. 댓글 가시성 = 작가 전용(비공개 피드백)

- **Decision**: 댓글은 글의 작가에게만 공개. 공개 GET shared work 응답의 댓글 목록 = **요청자 본인 댓글만**(회원이면). 작가 인박스(`GET /api/projects/{id}/comments`, authenticated + 소유검증)만 전체 반환.
- **Rationale**: clarify 결정(2026-06-28). 공개 주석이 아니라 작가에게 가는 비공개 피드백. 타인 댓글 누설 0(SC-009) = IT 로 검증.
- **댓글 content 암호화 여부**: **평문 저장**. 본문(작가 manuscript)과 달리 댓글은 열람자(타인)의 피드백 텍스트라 owner 키 대상이 모호. Phase 1 평문(낮은 민감도, 작가에게만 노출). 후속 재검토 여지.

## R-4. 앵커 모델 = 불변 스냅샷의 (블록 인덱스 + 블록 내 시작·길이)

- **Decision**: `share_comment` 에 `anchor_block_index` + `anchor_start`(블록 내 문자 오프셋) + `anchor_length`(문자 길이). 스냅샷이 불변이라 세 값 영구 안정.
- **블록 모델 정의(H1 화해, 2026-06-28)**: 블록 = **프론트 `pmConvert.ts` `pmJsonToModel` 평탄화 결과**(= `printLayout.relayout` 가 렌더하고 사용자가 선택하는 단위). 즉 **목록=항목별, 다단락 인용=단락별, hardBreak=U+2028 1글자**. 종전 본 문서가 "top-level 블록"이라 적은 것은 오류였고, BE `AnchorValidator` 가 그걸 따라 PM top-level 노드를 셌다가 목록/인용/소프트줄바꿈에서 FE 와 어긋나 정상 댓글을 거짓 400 거부함(리뷰 H1). 화해 = **BE `AnchorValidator` 가 `flattenNode`/`chunksOf` 를 그대로 미러링**(렌더가 SoT). FE 무변경. `AnchorValidatorTest` 에 목록·인용·hardBreak 케이스로 잠금.
- **Rationale**: clarify(텍스트 구간). 공유본=스냅샷이라 살아있는 에디터 블록 ID 주입(POC 옵션 A) 불필요 — 위치 인덱스로 충분.
- **검증**: 앵커 범위가 스냅샷 블록 길이 내인지 서버 검증(COMMENT_ANCHOR_INVALID 400). 범위 초과·음수·존재하지 않는 블록 거부.
- **Alternatives**: 블록 ID 주입(POC A) — 스냅샷 결정으로 Phase 1 불필요. 글자 오프셋(문서 전역) — 블록 경계 취약, 기각.

## R-5. 대상 삭제 수명주기(FR-025)

- **Decision**: 작품/시리즈 삭제 시 관련 `share_link.is_active=false` + 스냅샷·댓글 보존. `ProjectService.deleteProject`·`CategoryService.delete`(hard-delete 경로)에 훅 추가(보드 `BoardRepository.clearOwner` 선례).
- **Rationale**: clarify(보존). 피드백 이력 유지 + 공개 read 는 비활성으로 차단. 진짜 FK CASCADE 대신 명시 훅(보드 트랙 C 선례와 동형).
- **검증**: 대상 삭제 → 링크 비활성 + 스냅샷·댓글 row 잔존 단위/IT.

## R-6. 토큰 생성 = ApiTokenHasher 패턴

- **Decision**: 공유 토큰 = `SecureRandom` base62 32자(추측 불가). `ApiTokenHasher` 의 토큰 생성부 재사용/동형. 단 공유 토큰은 URL 노출 값이므로 **원문 그대로 저장**(API 토큰처럼 SHA-256 해시 저장 아님 — 조회 키여야 함). unique 인덱스.
- **Rationale**: 추측불가 + 열거 방지(FR-002). 해시 저장은 토큰으로 역조회 불가라 부적합(공개 read 가 토큰으로 링크 조회). 토큰 자체가 비밀(capability URL).
- **Alternatives**: 순번 ID — 열거 취약, 기각. UUID — 가능하나 base62 가 짧고 기존 패턴 정합.

## R-7. 마이그레이션 분할 V27/V28 + 테스트 DB 경로 정정

- **Decision**: V27 = share_link + share_snapshot(R1), V28 = share_comment(R2). 기존 테이블 변경 0.
- **Rationale**: 라운드별 증분 검증. 운영은 BE 배포 시 Flyway 자동.
- **정정(2026-06-28)**: 본 repo 는 **Testcontainers 부재** — `test` 프로파일이 **로컬 dev DB(localhost:5432/writenote)를 직접 사용**(실측, V24~26 동일 경로). 따라서 `./gradlew test` 가 마이그레이션을 로컬 dev DB 에 적용한다. 이는 프로젝트 표준 테스트 경로이며 **사용자 명시 허용**(2026-06-28). plan 의 "Testcontainers·로컬 미적용" 기술은 본 정정으로 대체.
