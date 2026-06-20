# 회원가입 약관 동의 모달 — 회고

- 일자: 2026-06-21
- 워크트리 / 브랜치: 메인 repo / develop → main merge
- 관련 커밋: `b3829f3`(privacy 추출)·`5a6cc51`(이용약관 초안)·`380f1df`(TermsModal)·`7a058a4`(SignupEmailForm 결선)·`2a98cc8`(merge), 설계 `9924267`·계획 `4f8fb68`
- 작업 시간 (대략): brainstorm → 배포까지 한 세션

## 1. 무엇을 했는가 (사실)

- 이메일 회원가입(`/auth/signup-email`)의 통합 동의 체크박스 1개를 **이용약관/개인정보처리방침 개별 2개**(둘 다 필수)로 분리하고, 각 옆에 **"보기" 버튼 → 약관 모달** 결선.
- `TermsModal` 컴포넌트 신규 작성(✕/Escape/백드롭 닫기, 본문 세로 스크롤; `QuickCaptureModal` 패턴 차용).
- 약관 본문을 `frontend/src/content/legal/` 공유 모듈로 추출 — `legalPrimitives`(Section/SubTitle/Table)·`PrivacyContent`(기존 `/privacy` 본문 이동)·`TermsContent`(이용약관 초안 신규 10개 조항, 제7조 콘텐츠 저작권=작가 귀속). `/privacy` 페이지가 `PrivacyContent` 재사용하도록 리팩토링.
- 설계 문서(`docs/superpowers/specs/2026-06-21-signup-terms-modal-design.md`)·구현 계획(`docs/superpowers/plans/2026-06-21-signup-terms-modal.md`) 작성·커밋.
- TDD 5 tasks 실행, 게이트 GREEN(vitest 551·`pnpm build`·`pnpm lint` 0 errors). 기존 `SignupEmailForm.test.tsx` 선행 실패(verify-pending 쿼리파라미터 불일치, 본 작업 무관)도 정정.
- develop push → main merge(`--no-ff`) → 라이브 배포. soseolbi.com 운영 HTML에 새 문구 반영 확인.

## 2. 어떻게 했는가 (접근)

- **brainstorming → writing-plans → executing-plans** 정석 흐름. 사용자 인터뷰로 3개 핵심 결정(본문 신규 작성 / 보기 링크 방식 / 개별 2개 동의) + 추가 1건(이용약관 연락처 섹션 제외)을 AskUserQuestion으로 확정한 뒤에야 코드 진입.
- 추측 차단을 위해 코드 진입 전 Explore 에이전트 + 직접 Read(`SignupEmailForm`·`QuickCaptureModal`·`privacy/page`·기존 테스트)로 실제 구조 확인. 약관 본문 부재(이용약관)·범용 모달 부재·기존 테스트의 단수 체크박스 헬퍼 등 본질 결정 요소를 먼저 파악.
- 본문 공유 모듈 추출로 `/privacy`와 모달의 단일 소스 보장(중복·불일치 방지).
- 배포는 외부 반영이라 push/merge 전 `git fetch` + develop/main 정합(main이 develop 부분집합) 확인 후 진행.

## 3. 잘 된 점

1) **추측 0으로 진입** — 약관 본문 부재라는 블로커를 첫 질문에서 짚어, 빈 모달을 만드는 헛작업을 차단. 코드 진입 전 4개 파일 직접 Read로 본질 요소 확정.
2) **선행 회귀 정직 처리** — `SignupEmailForm.test.tsx` 첫 테스트가 baseline에서 이미 실패(내 작업 무관)함을 실행으로 확인하고, 테스트 파일 수정하는 김에 최소 정정 + 사용자에게 명시 보고.
3) **TDD 규율 + 테스트 다중매칭 즉시 교정** — 각 task RED→GREEN. PrivacyContent/SignupEmailForm 테스트의 텍스트 다중매칭 실패를 구현이 아닌 테스트 쿼리(heading role / 고유 문구)로 정확히 교정.
4) **배포 전 베이스 정합 확인** — `git fetch` 후 main이 develop의 부분집합임을 확인하고 merge(메모리 [[branch-base-verify-before-work]] 준수).

## 4. 어긋난 점

- **메모리 active recall 실패 → 수동 배포 헛시도 (핵심 어긋남)**: 메모리 [[deployment-live]]에 "FE=main push 자동배포"가 **이미 정확히 적혀 있었으나** 이를 먼저 떠올리지 못하고 수동 `vercel --prod`부터 시도. (a) frontend에서 실행 → Root Directory=frontend 설정과 경로 중복으로 `frontend/frontend does not exist` 오류, (b) repo 루트에서 실행 → backend·desktop·빌드산출물까지 ~1GB 업로드 → 100MB 초과 `deploy_failed`. 둘 다 실패했으나 **업로드 단계 실패라 무해**, main push 자동배포가 이미 production 반영. 2026-06-19 §18 사건(메모리 active recall 실패로 stale 분기)과 **동종 패턴** — 메모리에 답이 있는데 안 봄.
  - **회피 가능 시점**: 사용자가 "배포" 지시한 직후, 수동 명령을 치기 전에 [[deployment-live]] 메모리를 active recall 했어야. (메모리는 system-reminder로 이미 컨텍스트에 있었음)
- **cwd 혼선 1회**: Task 1 커밋 때 `cd` repo 루트로 이동 후, 이어진 vitest를 루트에서 실행해 jsdom 미적용(`document is not defined`)으로 2회 실패. frontend cwd로 복귀해 해소. 빌드/테스트 명령의 cwd 고정에 부주의.
- **CLAUDE.md 오정보 노출**: CLAUDE.md "배포 방식" 절에 "FE 재배포 = 수동 vercel --prod CLI (브랜치 push 자동배포 아님)"이라는 **현재와 모순되는 정보**가 남아 있어 혼선 가중. (별도 트랙으로 정정 예정 — 사용자 요청)
- 사용자 멈춤 신호: 0건(반려·"왜 그랬어" 없음). 다만 위 자율 배포 헛시도는 사용자 비가시 영역에서 토큰·시간 소모.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **배포 지시를 받으면 명령을 치기 전에 [[deployment-live]] 메모리를 먼저 읽는다.** 이 프로젝트의 정상 배포 경로 = **main/develop push 자동배포**(수동 CLI 아님). 수동 `vercel --prod`는 Root Directory=frontend 설정 때문에 루트 실행 시 repo 전체(1GB) 초과·frontend 실행 시 경로 중복으로 실패한다.
- frontend 빌드/테스트/lint 명령은 반드시 `frontend/` cwd에서 실행(루트 실행 시 vitest jsdom 미적용). 커밋용 `cd` 후 후속 명령 cwd 재확인.
- 약관/법적 텍스트는 `frontend/src/content/legal/` 공유 모듈이 단일 소스 — `/privacy` 페이지와 모달이 공유한다.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — CLAUDE.md "배포 방식 / 현재 상태" 절 정정 (사용자 요청과 직접 일치)**
- (1) 대상: 프로젝트 `CLAUDE.md` "배포 환경" 절
- (2) 본문: "FE 재배포 = 수동 vercel --prod CLI (브랜치 push 자동배포 아님)"을 **"FE 재배포 = main/develop push Vercel git 자동배포(정상 경로); 수동 vercel --prod는 Root Directory=frontend 설정상 실패하므로 비권장"**으로 정정. 인프라 구성·테스트 실행 방법도 함께 명시(사용자 요청).
- (3) 근거: 본 회고 §4 "메모리 active recall 실패 → 수동 배포 헛시도" + CLAUDE.md 오정보 노출.

> §5-2 추가 룰(agent-workflow-discipline 신규 섹션)은 보류 — "메모리 active recall 실패"는 이미 §18 회귀 사례로 기록돼 있어 동종 중복. 본 건은 CLAUDE.md 오정보 정정으로 충분(일반 원칙 신설 불요).
