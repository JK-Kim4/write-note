# 웹 베타 전 정리 — 분기 베이스 착오로 인한 logout 회귀와 develop 재구성

- 일자: 2026-06-19
- 워크트리 / 브랜치: 메인 repo / `027-beta-prep-cleanup`(폐기) → `028-beta-prep-reconcile` → develop
- 관련 커밋: develop `65f304a`(최종). 배포 `zd5bhdovb` → harubuild.xyz
- 작업 시간(대략): 새벽 자율 실행(027) → 아침 디버깅·재구성(028)

## 1. 무엇을 했는가 (사실)
- 코드베이스를 서브에이전트 3개로 분석해 사용성 개선점 + 명시 3건(A/B 정리·전환·갈색배경) 리스트업.
- brainstorming→설계문서→계획문서 후, `/goal` 자율 야간 실행으로 **027 브랜치(026 기반)** 에서 구현: B형 루트 승격·A형 제거·소설비 리브랜딩·테라코타 톤·패리티 이식(메타편집·보관·토큰)·사용성, 프로덕션 배포 + dogfooding HTML.
- 사용자 "logout 미동작" 보고 → systematic-debugging: 백엔드(curl)·프론트(dev·prod 빌드) **로컬 3중 재현 모두 GREEN**, 프로덕션만 `POST /api/auth/logout` **403** 확인.
- git 이력 추적 → 근본원인 = **027이 develop의 보안 커밋 `e309b08`(CsrfDefenseFilter + 프론트 `X-WriteNote-Client` 헤더)을 누락**. 027이 stale 026에서 분기(20커밋 뒤처짐).
- 프로덕션 Vercel 롤백 → develop 머지 드라이런(의미론적 충돌 다발, 불가) 확인 → **develop 기반 `028`로 재구성**(구조+패리티+톤+사용성) → develop fast-forward 머지 → 재배포(사용자 logout 정상 확인).
- focus 링 19곳 완성·contact 공개화 추가 재배포. 027 브랜치 삭제, vault `02-PROGRESS` 정정, 메모리 2건 작성.

## 2. 어떻게 했는가 (접근)
- 구현: superpowers brainstorming→writing-plans→subagent-driven, 단계마다 build/test GREEN 게이트(advisor 직접 검증). subagent 모델 sonnet/opus(haiku 금지).
- 디버깅: systematic-debugging Iron Law 준수 — 추측 수정 금지. 로컬 스택 기동 + curl 전체 인증 흐름 + Playwright 브라우저 재현 + 빌드 산출물/번들 grep + git ancestry로 근본원인 확정. "코드 정상 → 환경/분기 문제"로 레이어 좁힘.
- 의사결정: AskUserQuestion으로 (a) 즉시 조치=롤백 (b) 027 살릴 항목 선별 (c) 랜딩을 별도 경로(`/welcome`)로 + `/`=B앱 아키텍처 확정 후 028 재구성.

## 3. 잘 된 점
1) **logout 근본원인을 추측 없이 정확히 규명**. 근거: 로컬 3중 재현 GREEN + 프로덕션 403 + `git merge-base --is-ancestor e309b08`(develop-only) + 배포 번들 `X-WriteNote-Client` 검증. 서브에이전트 A의 "invalidateQueries 타이밍" 가설을 코드 정독으로 반증하고 진짜 원인(분기 누락)으로 이동.
2) **§11 준수** — "한 번 고침=됐다" 단정 대신 레이어별 관찰(curl→Playwright→git→번들). 롤백이 logout 못 고침을 번들 검증으로 자가 발견·정정.
3) **§7 준수** — 서브에이전트 자기보고(build GREEN 등)를 매 단계 직접 재검증(tool_uses 1~7 의심 신호 차단).
4) 028 reconcile은 develop 기반이라 깨끗(ff 머지)·게이트 GREEN(lint0·typecheck0·512 tests).

## 4. 어긋난 점
- **[치명] 분기 베이스 착오**: 027을 stale 026에서 분기 → develop의 리브랜딩·공개 랜딩·전환개선·**보안 CSRF 헤더**가 통째로 빠짐. **회피 가능 시점 = 027 작업 시작 전 `git log --oneline HEAD..origin/develop` 1회.** 더 뼈아픈 건 `deployment-live` 메모리에 "CsrfDefenseFilter = 쿠키 변경요청에 X-WriteNote-Client 필수"가 **이미 적혀 있었는데 active recall 실패**.
- **[회귀 배포]** 027을 `vercel --prod` → develop 기반 프로덕션 프론트를 덮어써 **logout 403 + 공개 랜딩·보안헤더 회귀**. 사용자가 직접 발견("로그아웃 클릭해도 안 됨").
- **[dogfooding 불가 영역 자율 배포]** §16/§17대로 인증 화면을 dogfooding 못 한 채 야간 자율 배포 → logout 회귀가 사용자에게 노출. **게이트 GREEN을 authed 동작 정합 증거로 과신**(자동 테스트는 CSRF 계약 불일치를 못 잡음).
- **[롤백 오판]** "o82i3oq88로 롤백하면 logout 복구"라 했으나 그 배포도 헤더 부재(소설비 구버전) → 롤백이 logout 못 고침. 번들 검증 후 정정. 회피 = 롤백 대상이 헤더를 가졌는지 먼저 확인.
- **[도구 갓챠]** `vercel rollback`이 별칭을 고정 → 이후 `--prod`가 별칭 자동갱신 안 함, `vercel promote` 필요. 인지 못 해 "헤더 없음" 오판 한 사이클.
- **[멈춤 신호 다수]** "잠깐만 인터뷰 다시"·"기능 정상동작 안하는데"·"develop 배포 안됐었나보네"·"이거 홈으로 가는기능 달려있는데?" 등 사용자 개입으로 방향 정정.
- AskUserQuestion JSON 직렬화 오류 수 회(escape 깨짐) → 재시도 비용.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (write-note 한정)
- write-note는 **FE/BE 분리 수동 배포 + 통합 브랜치 develop**. 작업/배포 전 develop 베이스 정합 확인 필수. 이미 메모리 [[branch-base-verify-before-work]]·[[deployment-live]]에 박음.
- 프로덕션 백엔드 `CsrfDefenseFilter` → 프론트가 `X-WriteNote-Client` 헤더 동봉 필수. 배포할 프론트가 이 계약을 충족하는지 확인.
- `vercel rollback` 후 새 배포는 `vercel promote` 또는 별칭 재지정 필요. 검증은 `curl https://harubuild.xyz`로 실제 서빙본 확인.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — 작업/배포 전 베이스 브랜치 정합 검증** (일반 원칙)
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` 신규 섹션
- (2) 본문: "기능 브랜치는 통합 브랜치보다 뒤처질 수 있다. 작업 시작·배포 전 `HEAD..<통합브랜치>` 누락 커밋(특히 보안·인증·공개경로 계약)을 확인하고, 뒤처졌으면 통합 브랜치에서 재분기한다. FE/BE 분리 배포면 백엔드가 요구하는 프론트 계약(CSRF 헤더 등)을 배포 프론트가 충족하는지 검증한다."
- (3) 근거: 본 회고 §4 [치명] 분기 베이스 착오 → logout 403 회귀.

**후보 2 — authed 검증 불가 상태의 자율 프로덕션 배포 가드** (기존 §16/§17 강화)
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` §16/§17 보강
- (2) 본문: "인증 뒤 화면을 dogfooding할 수 없는 상태에서 자율 프로덕션 배포를 할 때, 자동 게이트(build/test) GREEN을 authed 동작 정합의 증거로 단정하지 않는다. 인증 뒤 핵심 동작(logout 등)은 배포 후에도 '미검증'으로 명시하고, 가능하면 배포 전 사용자 authed 확인 또는 롤백 가능성을 확보한다."
- (3) 근거: 본 회고 §4 [dogfooding 불가 영역 자율 배포] + [롤백 오판].

**사용자 컨펌 전까지 실제 룰 파일 수정 안 함.**
