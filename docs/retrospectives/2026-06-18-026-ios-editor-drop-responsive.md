# 026 iOS 자체에디터 입력 미지원 결정 + 모바일 반응형(US3) 완료

- 일자: 2026-06-18
- 워크트리 / 브랜치: 메인 / `026-mobile-editor-support`
- 관련 커밋: `ef00482` (운영 harubuild.xyz `--prod` 배포·검증, develop 미머지)
- 작업 시간 (대략): 한 세션 (spec 정합화 → US2 계측 → 선택 버그 진단 → iOS 편집 폐기 → US3 반응형 → 마무리)

## 1. 무엇을 했는가 (사실)

- **spec 정합화**: 직전 세션 textarea 피벗을 spec/research/tasks/data-model/plan에 반영(Decision 6). §6 grep으로 파일명·시그니처 검증.
- **US2 계측 오버레이**: `poc/mobile-editor`에 document capture-phase 리스너 기반 진단 오버레이(`MobileDebugOverlay`) 추가 — production 무수정으로 input/composition/keydown/selection 덤프.
- **선택 버그 진단**: 사용자 iPhone 스크린샷 2장으로 **iOS 네이티브 선택(더블탭)이 렌더 페이지와 발산**하는 근본 원인 확정(textarea 자체 레이아웃 ≠ 블록폰트·페이지분할 렌더 레이아웃).
- **억제 가설 검증**: textarea에 `user-select:none` 1줄만 바꿔 배포 → iOS가 form 컨트롤에서 무시함을 실측 확정(가설 기각).
- **caret-앵커 tiny textarea(B-lite)** 구현·배포 → 한계 노출.
- **iOS 편집 미지원으로 되돌림**(사용자 결정): 배너 복원 + 집필실 페이지(`/b/works/[id]`) 차단 가드. `textareaAdapter`(+test)·`setCaretRect`·`debugNoZoom`·`poc/mobile-editor`·`ios-textarea-probe` 제거. `InputAdapter` 추상화(editContextAdapter=데스크탑) 유지.
- **US3 반응형**: `b/layout` 헤더 모바일 햄버거 메뉴(가로 overflow 제거) + 에디터 `isMobile` 판정을 화면폭(matchMedia ≤880px) 기준으로 변경(EditContext 무관 reflow). 테스트 setup에 matchMedia stub, BWorkDetailPage 테스트에 EditContext stub 추가.
- **운영 배포·검증**: `vercel deploy --prod` → harubuild.xyz, 로그인 후 서비스 화면 슬라이드 버그 해소 사용자 검증.
- **마무리**: spec/research/tasks/plan/data-model을 Decision 7(미지원)로 최종 정정, 커밋, vault(02-PROGRESS·ISSUE-037) 갱신.

## 2. 어떻게 했는가 (접근)

- **systematic-debugging**: 선택 버그를 추측 수정 없이 스크린샷(증거)으로 근본 원인 확정 후, 억제 가설을 **단일 변수(CSS 1줄)**로 최소 검증. 기각되자 헛수정 반복 대신 옵션 재제시.
- **AskUserQuestion**: 억제 방향·drop vs keep 등 제품/아키텍처 결정은 사용자에게 위임(정보 비대칭 메타 영역).
- **production 무수정 원칙**: 계측·진단을 전부 poc 라우트·capture 리스너로 → 데스크탑 EditContext 경로 무회귀를 구조적으로 보장(vitest 578 일관 GREEN).
- **preview/prod 진단**: 프리뷰 로그인 실패를 `next.config` rewrites + `vercel env ls`로 추적 → `BACKEND_ORIGIN` Production 전용 확정(추측 아님).

## 3. 잘 된 점

1) **선택 버그를 추측 없이 증거로 확정** — 스크린샷에서 "탭 위치 / iOS 네이티브 선택 / 렌더 선택" 세 위치가 따로 노는 것을 보고 레이아웃 불일치를 규명. (systematic-debugging Phase 1 준수)
2) **억제 가설을 1줄만 바꿔 검증** — 기각 시 원인이 명확(번들 변경 아님). 기각 후 헛수정 안 하고 옵션 재제시(§11 준수).
3) **데스크탑 무회귀 일관 유지** — EditContext 경로 로직 무수정, 전 사이클 vitest 578 GREEN.
4) **preview 로그인 실패를 코드 탓으로 단정 안 함** — config·env 스코프로 원인(env Production 전용) 규명.

## 4. 어긋난 점

- **"슬라이드 버그 해결됨"을 잘못된 화면 보고 단정** (가장 큰 어긋남). US3 배포 후 사용자가 프리뷰에서 본 건 **로그인 화면**인데, 슬라이드 버그는 **로그인 후 서비스 화면(`/b/*`)**에만 있었다(로그인 화면은 원래 버그 없음 + 다른 레이아웃). 그런데 나는 "슬라이드 버그 사라졌다"고 단정 보고 → 사용자 정정("니가 보여준건 로그인화면이야"). 실제 영향 화면을 관찰하지 않고 fix를 단정한 것 = verification-before-completion 위반.
  - **회피 가능 시점**: "슬라이드 버그 사라짐" 단정 직전. 버그가 있던 화면(서비스 화면)에 실제로 도달해 관찰했는지 self-check했어야. 프리뷰는 로그인이 막혀 그 화면에 도달 불가였으므로 "검증 불가"가 정답이었다.
- **프리뷰 환경이 인증 화면을 실행 못 함을 미리 점검 안 함**. 사용자에게 프리뷰에서 dogfooding을 요청했으나, 프리뷰는 `BACKEND_ORIGIN`(Production 전용) 부재로 로그인 자체가 안 됨 → 인증 뒤 서비스 화면 검증 불가. 한 사이클 혼선.
  - **회피 가능 시점**: 인증이 필요한 화면을 프리뷰에서 dogfooding 요청하기 전, 프리뷰 env가 백엔드에 연결되는지(`vercel env ls` 스코프) 확인.
- **사용자 피로 신호**: "이거 안되겠다 계속 똑같은거만 하네 딥서치 해도 해결책도 안나오고". iOS 입력이 여러 사이클 벽에 부딪힌 끝에 폐기됨. 직전 세션에서 textarea를 **입력만 검증하고 채택**(선택·편집은 미검증)했기에, 이번 세션에서 선택 갭이 뒤늦게 드러나 추가 사이클을 소모.
  - **회피 가능 시점**: textarea 채택(직전 세션) 시 입력뿐 아니라 **선택·마크 등 편집 전 범위**를 dogfooding했더라면 선택 발산을 더 일찍 발견(§15 검증 미성숙 교체 정합).
- **spec 문서 3회 churn**: 같은 세션에서 spec을 (a) textarea 채택 → (b) iOS 미지원으로 두 번 재작성. 직전 세션 산출(textarea)을 정합화한 직후 폐기됨. 큰 손해는 아니나, 미검증 아키텍처를 spec에 "채택"으로 박기 전 dogfooding 완결을 기다렸으면 churn 감소.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **iOS(WebKit)는 자체 EditContext 에디터 입력을 지원하지 않는다** — contenteditable(IME orphan)·hidden textarea(네이티브 선택 발산, user-select 억제 불가) 모두 실패. 재시도하지 말 것. iOS는 글쓰기 미지원 안내 + 집필실 차단이 확정 정책(ISSUE-037 / research Decision 7).
- **프리뷰(`vercel deploy`)는 로그인 불가** — `BACKEND_ORIGIN`이 Production 전용. 인증 필요한 화면 검증은 운영(harubuild.xyz `--prod`) 또는 프리뷰 env 추가 후. ([[deployment-live]])
- **에디터 모바일 판정은 화면폭(≤880px) 기준** — EditContext 지원 여부가 아니라 viewport. 좁은 창에서 A4 축소 대신 reflow.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — fix "됐다" 단정은 버그가 있던 바로 그 surface에서 관찰 후에만**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` (§11 인접 보강) 또는 글로벌 verification 룰
- (2) 룰 본문(일반 원칙): *수정이 버그를 고쳤다고 보고하기 전, 버그가 실재했던 바로 그 화면·상태에서 직접 관찰한다. 인접/대용 화면(예: 로그인 화면)이나 테스트 환경의 다른 경로에서 본 것은 검증이 아니다. 대상 surface에 도달할 전제조건(로그인 등)이 막혀 있으면 "검증됨"이 아니라 "검증 불가"로 보고한다.*
- (3) 근거: §4 — "슬라이드 버그 해결됨"을 로그인 화면 보고 단정 → 실제 버그는 서비스 화면, 프리뷰 로그인 막혀 도달 불가였음.

**후보 2 — preview/staging dogfooding 요청 전 그 환경이 대상 기능을 실행 가능한지 확인**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` 또는 `CLAUDE.md` 배포/검증 절
- (2) 룰 본문(일반 원칙): *프리뷰·스테이징 배포에 dogfooding을 요청하기 전, 그 환경이 대상 기능을 실제로 실행할 수 있는지(필수 env·백엔드 연결·인증 전제) 먼저 확인한다. 인증 뒤 화면을 봐야 하는데 그 환경에서 로그인이 안 되면 검증 요청 자체가 헛사이클이 된다.*
- (3) 근거: §4 — 프리뷰는 `BACKEND_ORIGIN` 부재로 로그인 불가인데 인증 뒤 서비스 화면 dogfooding을 요청해 한 사이클 혼선.

**사용자 컨펌 전까지 실제 룰 파일 수정하지 않음.**
