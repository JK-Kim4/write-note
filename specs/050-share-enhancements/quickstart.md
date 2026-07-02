# Quickstart & 검증: 공유 페이지 고도화

## 로컬 풀스택 기동 (authed dogfooding 필수 — 메모리 local-dogfooding-needs-backend)
```bash
docker compose up -d --wait postgres
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'   # 8080
cd frontend && pnpm dev                                                    # 3000
```
> 로컬 DB 마이그레이션 적용(V31·V32)은 사용자 컨펌 후(external-infra-safety). BE IT는 Testcontainers.

## 게이트
- **BE**: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- **FE**: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

## 라운드별 완료 기준

### R1 BE (선행)
- V31 `share_reaction` + V32 앵커 nullable 마이그레이션(Testcontainers 적용).
- 반응 토글 IT: 추가→집계 count 1 / 중복 추가 멱등(count 유지) / 제거→0 / 다른 회원 별개 / emoji 화이트리스트 밖 400 / 앵커 무효 400.
- 전체 의견 IT: 앵커 셋 다 null 저장 성공(작가 전용 노출) / 부분 null 400 / 기존 구간 댓글 회귀 없음.
- 작가 피드백 조회 IT: 소유자 200(전체 댓글+집계, 비활성 링크도) / 비소유 403 / 없음 404.
- 스냅샷 읽음 IT: 그 스냅샷만 read_at 채움(다른 링크 unread 유지).
- 공개 열람 응답 reactions embed IT: 비로그인 mine=false / 회원 mine 반영.

### R2 FE — 종이(US4) + 비로그인 로그인(US2) — 조기 dogfooding
- **순수 TDD**: `returnTo.ts`(저장·소비·`/shared/` prefix 검증·비-shared 거부) / (선택)`reactionAggregate.ts`.
- **dogfooding**: 공유 열람 종이(라이트/다크·한글) · 작가 뷰 종이 · 비로그인 헤더/CTA/드래그 로그인→이메일·카카오 각각 **그 공유 페이지로 복귀** · 조작된 returnTo 안전 처리.

### R3 FE — 작가 맥락 뷰(US1)
- `AuthorFeedbackView` 우측 패널 + `ShareLinkManager` "받은 피드백"→링크 단위 진입.
- **dogfooding**: 전문 위 하이라이트 · 패널 클릭→구간 스크롤+반짝 · 스냅샷 단위(1:N 분리) · 진입 시 그 링크만 읽음 · 비소유 접근 차단 · 종이 스타일.

### R4 FE — 반응·전체 의견(US3)
- 구간 선택 이모지 툴바(토글) · 반응 개수 모든 열람자 표시(비로그인 포함) · 하단 "작품 전체에 한마디"(앵커 null).
- **dogfooding**: 이모지 추가/취소 개수 반영 · 다른 계정으로 열람 시 집계 공개 · 전체 의견 작가 전용 노출 · 글 댓글 회귀 없음 · 반응/댓글 겹침 표기.

## 회귀 가드(FR-020) — 046/047 무손상
- 공유 링크 생성·on/off·삭제·작품당 5개 제한 · 공개 열람(비로그인 200) · 작가 전용 텍스트 댓글 · 받은 피드백 읽음 · 모달 stacking(portal) 정상.
- grep: 기존 `SharedWorkResponse` 소비처가 신규 `reactions` optional 미사용에도 무손상 / `CreateCommentRequest` 구 호출(앵커 3값) 정상.

## §19 한계
- prod 로그인 불가 → 인증 뒤 동작(반응·댓글·작가 뷰·로그인 복귀)은 **로컬 풀스택 dogfooding**이 게이트. build/test GREEN을 authed 정합 증거로 단정 금지.
