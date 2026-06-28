# Quickstart / Dogfooding: 공유 사용성 개선 (Share UX)

라운드별 검증 게이트. 자동 게이트(build/test) GREEN + 서브에이전트 리뷰 후, authed dogfooding(로그인 뒤·시각)은 별도 수동 게이트(§19). 로컬 dogfooding 은 DB(docker)→BE(bootRun)→FE(pnpm dev) 3개 기동 필요([[local-dogfooding-needs-backend]]).

## 자동 게이트

- **BE**: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- **FE**: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

## R1 (BE) — read_at + 집계 + 읽음 endpoint

자동:
- [ ] V29 Testcontainers IT 적용(로컬 dev DB 미적용 — external-infra-safety).
- [ ] `markReadByProjectId` bulk update: 안 읽은 댓글만 read_at 채움, 이미 읽은 건 무변경(반환 수 정확).
- [ ] `countUnreadByProjectIds` group-by: 여러 작품 섞여도 작품별 정확. read_at 채운 뒤 0.
- [ ] `markReadForProject` 소유 검증: 타 작품 → `COMMENT_FORBIDDEN`(403/대상 비노출).
- [ ] `listMine` unread 집계: 같은 작품 여러 링크면 각 SharedWorkMeta 동일 값. 댓글 0이면 0.
- [ ] `AuthorCommentResponse.readAt` 동봉. 기존 046 공유/댓글 IT 무회귀.

## R2 (FE 진입점·관리)

자동:
- [ ] `shareGrouping` 순수 헬퍼: 대상별 링크 필터·작품 단위 unread dedup 합산 단위 테스트.

dogfooding(authed):
- [ ] 헤더에 "공유" 칩이 6번째로 보이고, 클릭 시 `/shares` 이동.
- [ ] `/shares` 화면: 받은 피드백이 맨 위, 그 아래 작품/시리즈별 그룹(1:N 링크). 생성 폼 없음.
- [ ] 기존 `/mypage/shares` 접근 → `/shares` redirect, 기존 링크 그대로 보임.
- [ ] 마이페이지 사이드바에 "공유 관리" 항목 사라짐.
- [ ] 라이트/다크 + 한국어 표시 정상.

## R3 (FE 작품/시리즈 진입점)

dogfooding(authed):
- [ ] 작품 카드에 "공유" 버튼이 편집·보관·삭제와 나란히 노출.
- [ ] 공유 링크 없는 작품: "공유 링크 만들기" → 생성 후 주소·복사·끄기.
- [ ] 공유 링크 여러 개 작품: 링크 목록(시점별 "2026.06.25 공유") + "새 공유 링크 만들기" → 누르면 링크 하나 더.
- [ ] 활성 링크 1개+ 작품/시리즈: 카드/타일에 "● 공유 중 · N"(활성 수). 꺼진 링크만 있으면 미표시.
- [ ] 시리즈 타일 ⋯ 메뉴 "공유" → 공유 링크 목록 + 공개 작품 선택.
- [ ] 바깥 클릭/ESC 로 팝오버 닫힘. 카드 진입(작품 열기)·드래그 분류 무회귀.

## R4 (FE 읽음)

dogfooding(authed):
- [ ] 안 읽은 피드백 N건 작품의 "피드백 보기" 열기 → 인박스에 안 읽은 항목 강조.
- [ ] 인박스 연 뒤: "받은 피드백" 집계에서 그 작품 수가 빠짐(관리 화면·팝오버 갱신).
- [ ] 모두 읽으면 받은 피드백에 "확인할 새 피드백 없음" 안내.
- [ ] 이미 읽은 피드백도 링크 피드백 목록에서 다시 열람 가능(삭제 아님).
- [ ] 그 작품에 새 댓글 도착(다른 회원으로 작성) → 다시 안 읽은 수에 잡힘.

## 통합 회귀

- [ ] 046 공개 열람(비로그인): 공유본 읽기·회원 댓글 작성 무회귀(read_at 미노출 확인).
- [ ] 대상(작품/시리즈) 삭제 시 링크 비활성·스냅샷/피드백 보존(046 동작) 무변경.
- [ ] 기존에 만든 공유 링크·받은 피드백 손실 없이 표시(기존 댓글은 안 읽음으로 시작).

## 배포

BE 선행(R1, OCI blue-green) → FE 후행(R2~R4, Vercel). additive 라 구 FE 무손상이나, FE 가 unread/read_at 을 쓰므로 BE 먼저. V29 운영 적용은 BE 배포 시 Flyway 자동.
