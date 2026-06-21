# 문의 진입점·카테고리·카카오 채널 + Formsubmit 디버깅 + finish-work 스킬 개선

- 일자: 2026-06-21
- 워크트리 / 브랜치: `write-note-031-contact-entrypoints` / 031-contact-entrypoints → develop(`90d055a`) → main(`7a55e95`, production 배포)
- 관련 커밋: `631ba4e`(헤더·설정 진입점) · `767a4dc`(카테고리) · `e1760f9`(카카오 채널) · `15557ab`(finish-work 스킬) · merge `90d055a`/`7a55e95`
- 관련 이슈: #54 close (contact Formsubmit CORS 검증) · ISSUE-040 신규 (카카오 채널 채팅 비활성)

## 1. 무엇을 했는가 (사실)

- **Formsubmit 전송 실패 디버깅**: 운영 `/contact` 폼 "전송 실패" 원인 분석. 코드(`contact.ts`)로 `ok:false` 3경로 확정 → 읽기성 실측(`curl` CORS preflight·GET)으로 2경로(CORS·서버다운) 배제 → 사용자 Network 탭 실측으로 **근본원인 = Formsubmit 폼 활성화 미완**(HTTP 200 + `success:"false"` "This form needs Activation") 규명. "도메인 변경(harubuild→soseolbi) 탓" 가설은 `git log -S "formsubmit.co"`로 반증(엔드포인트는 015/6-9부터 불변).
- 메모리 `contact-form-formsubmit` 작성 (웹 문의 = Formsubmit 직접 전송, 환경별 1회 활성화 필요).
- 031 워크트리(develop 기준, git worktree fallback) 생성 + TDD 4커밋:
  - `631ba4e` 인증 영역(`(main)`) 헤더 전역 '문의' 링크(데스크탑 로그아웃 옆 + 모바일 햄버거) + 설정 '문의·도움말' 카드.
  - `767a4dc` 문의 폼 '문의 유형' select(5개, 선택) + 선택 시 Formsubmit 메일 제목 `[분류]` prefix.
  - `e1760f9` 카카오 문의 채널 `_mxlxlnX` → 소설비 채널 `_xcuxhxfX` 교체.
  - `15557ab` finish-work 스킬에 main 승격(production 배포) 4단계 추가.
- finish-work 실행: develop merge(`90d055a`) + sync-vault(02-PROGRESS·03-ISSUES ISSUE-040) + #54 close + main 승격(`7a55e95`) production 배포.

## 2. 어떻게 했는가 (접근)

- **디버깅**: 추측 금지 원칙 — 코드로 실패 분기를 먼저 확정하고(3경로), 부작용 없는 읽기 실측(`curl OPTIONS/GET`)으로 후보를 좁힌 뒤, 사용자 Network 탭의 실제 응답으로 근본원인을 확정. 외부 메일 발송 부작용이 있는 POST 진단은 컨펌 영역으로 분리.
- **가설 반증**: "도메인 변경 때문" 가설을 `git log -S`로 엔드포인트 불변을 보여 반증 — 단정 대신 이력 근거.
- **워크트리 베이스**: native `EnterWorktree`가 base ref = default 브랜치(main) 기준임을 인지 → 사용자 요구(develop 기준)와 어긋나 git fallback으로 `origin/develop` 명시 분기. `origin/main`(52c3469)≠`origin/develop`(c84049e) 실측이 이 선택을 정당화.
- **UI 배치**: ASCII 목업이 거부당해 실제 HTML 목업을 브라우저로 제시 → C형(헤더 전역) 선택.
- **TDD**: 5개 기능(헤더·모바일·설정·카테고리·카카오) 모두 red 확인 후 green.

## 3. 잘 된 점

1) **추측 없이 실측/이력으로 확정** — Formsubmit 근본원인(Network 탭), 포트 혼선(`lsof cwd`), 도메인 가설(`git log -S`) 모두 사실 근거로 확정. 디버깅 내내 "아마 ~일 것" 단정 없이 진행.
2) **워크트리 베이스 정확성** — native 도구의 main 기준 한계를 인지하고 fallback으로 develop을 정확히 잡음. `origin/main≠origin/develop` 실측이 근거(native 도구를 썼다면 main 기준으로 잘못 분기될 뻔).
3) **TDD 준수** — 5기능 모두 red→green, 최종 게이트 GREEN(typecheck·lint 0err·test 560·build). flaky 1건(useDocumentSession)도 단독 재현·전체 재실행으로 무관함을 입증 후 진행.

## 4. 어긋난 점

- **dev 서버 포트 혼선 — 사용자 멈춤 2회** ("아무것도 안보이는데"·"유형 없는데?"). 사용자가 본 `localhost:3000`은 **메인repo(030) dev 서버**였고, 워크트리(031) 서버는 포트 충돌로 **3001로 밀려** 있었음. 내 ready 체크 루프가 **3000 고정 curl**로 메인repo 서버에 confirm해 "기동 완료"로 오인 → 사용자에게 잘못된 포트(3000) 안내 → 카테고리가 안 보였음. **회피 가능 시점:** frontend dev 재기동 로그에 `Port 3000 is in use by process ..., using available port 3001 instead`가 찍혔는데, 그 즉시 실제 바인딩 포트를 읽지 않고 3000을 가정함.
- **카카오 채널 채팅 비활성** — 교체한 URL은 정확했으나(`_xcuxhxfX/chat`) 새 채널의 채팅 기능이 OFF라 클릭 시 "채팅이 불가능한 프로필". 외부 설정이라 코드 어긋남은 아니나, 채널 교체 dogfooding에서야 발견(ISSUE-040으로 추적). Formsubmit 활성화와 동종 외부 설정 함정.
- **finish-work 스킬 로드가 메인repo 구버전** — 내가 수정한 새 4단계는 워크트리(031)에 있고, 스킬 로드는 메인repo(030)의 구버전이었음. 새 절차를 수동 적용해 처리(영향 경미). merge 후에야 develop·main에 새 스킬 반영.

사용자 멈춤 신호: 포트 혼선 2회 + ASCII 목업 거부 1회 + "글로벌 스킬 아니냐" 정정 1회. 반복 디버깅(같은 에러 3+ 재시도) 없음. 외부 발송 부작용 작업(POST 진단·main push)은 모두 컨펌 후 진행.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)
- 멀티 dev 서버(워크트리 + 메인repo) 공존 시, dogfooding 안내 **전** 실제 바인딩 포트를 기동 로그/`lsof`로 확정한다. 고정 포트(3000) 가정 금지.
- 외부 채널·서비스(카카오 채널·Formsubmit) 교체 시 "활성화/채팅 ON 상태"는 코드와 독립 — dogfooding으로 실동작까지 확인하고, 미활성이면 외부 설정 액션으로 분리(ISSUE 추적).

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — `.claude/rules/shared/agent-workflow-discipline.md` 신규 항목:**
- (1) 대상: 프로젝트 `.claude/rules/shared/agent-workflow-discipline.md`
- (2) 룰 본문(일반 원칙): *"dogfooding용 dev 서버를 띄운 뒤, 그 surface가 실제로 내 변경을 서빙하는 포트/인스턴스인지 확인하고 안내한다. 동일 포트를 다른 인스턴스(다른 워크트리·메인repo)가 점유하면 새 인스턴스는 다른 포트로 밀리므로 고정 포트 가정 금지 — 기동 로그의 실제 바인딩 포트 또는 `lsof -a -d cwd`(프로세스 cwd)로 확정한 뒤 사용자에게 안내한다."*
- (3) 근거 회귀 사례: 본 회고 §4 포트 혼선(사용자 멈춤 2회, 메인repo 030 서버를 워크트리 031로 오인 안내). §16/§17(dogfooding surface 정합)의 멀티-인스턴스 연장.
