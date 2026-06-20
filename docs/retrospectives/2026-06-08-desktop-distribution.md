# Desktop 앱 공개 배포 (013) — Windows + macOS 무서명 배포 파이프라인

- 일자: 2026-06-08
- 워크트리 / 브랜치: write-note / `013-desktop-distribution` → `develop` merge `687e4ca` → `main` 승격 `c9545d4`
- 관련 커밋: 설계 `9a63a74` / spec `76d37f2` / plan `80049c8` / tasks `ae1047f` / 구현 `fb37a39` / T005 `7949f03` / 안내문 `1022577` / main merge `c9545d4`
- 작업 시간 (대략): 브레인스토밍 ~ public 전환·main 승격까지 1 세션

## 1. 무엇을 했는가 (사실)

- **브레인스토밍 → 설계 문서** — Windows+macOS 공개 배포 방식을 검증(WebSearch) 후 확정: GitHub Actions 매트릭스 빌드 → GitHub Releases, 무서명+설치 안내문, Vercel `/download` 페이지. `docs/superpowers/specs/2026-06-08-desktop-distribution-design.md`.
- **speckit 풀파이프** — specify(spec.md)/plan(research·data-model·contracts·quickstart)/tasks(17개)/implement.
- **구현** — `desktop/electron-builder.yml` 확장(mac universal+`identity:"-"` ad-hoc+`hardenedRuntime:false`, win NSIS `oneClick`/`perMachine:false`, 고정 artifactName, github publish) + `.github/workflows/release.yml`(`v*` 태그 매트릭스) + frontend `/download`(`useSyncExternalStore` OS감지+버튼2+한국어 안내문, vitest 3건) + `desktop/README` 릴리스 절차.
- **로컬 mac 빌드 검증** — `mac.arch` 무효 속성 오류를 빌드로 발견·수정 → `Soseolbi-Note.dmg`(192M) universal + `Signature=adhoc` 확인.
- **CI 검증** — `v0.1.0` 태그 push → 양 OS job GREEN(win 2m39s) → draft Release에 자산 2종 자동 업로드.
- **다운로드 블로커 발견·해소** — 게시 후 공개 URL 404 → 원인=저장소 private → **시크릿 스캔(이력 포함) 통과 후 public 전환** → `releases/latest/download` 익명 HTTP 200 검증.
- **무서명 마찰 2건 규명** — Gatekeeper(rejected, 시스템 설정 경로) + 키체인 암호 프롬프트(Chromium Safe Storage). `--password-store=basic` 우회 시도 → macOS 무효 검증 → 되돌림 → 안내문 보강.
- **main 프로덕션 승격** — develop→main 머지(전체 프로젝트 첫 main 승격) + push. vault 02-PROGRESS/03-ISSUES 갱신.

## 2. 어떻게 했는가 (접근)

- **추측 금지 — 검증 우선**: Azure Artifact Signing 대상국 / Windows 서명 2026 변경 / 크로스빌드 불가 / 무서명 macOS 자동업데이트 불가 / Sequoia Gatekeeper 변경 / `password-store` 동작을 전부 WebSearch로 확정 후 옵션 제시·구현.
- **로컬 선검증으로 CI 비용 절감**: electron-builder 설정을 태그 push 전 로컬 mac 빌드로 돌려 `mac.arch` 오류를 차단(룰 #8 환경 선확인).
- **사용자 의사결정 분기**: 배포 대상 규모 / 서명 예산 / 빌드 방식 / 다운로드 창구 / public 전환 / 이메일 노출을 각 시점에 AskUserQuestion으로 확정.
- **public 전환은 안전 절차 선행**: 되돌리기 어려운 동작이라 시크릿 스캔(추적 파일+이력+yml 주입방식) 후 진행.
- **우회책은 단정 않고 실측**: `password-store=basic`을 "검증 필요"로 제시 → 적용·재빌드·키체인 항목 재생성 확인 → 무효 결론 → git restore.

## 3. 잘 된 점

1) **`mac.arch` 설정 오류를 태그 push 전 로컬 빌드로 차단.** 근거: 1차 `pnpm exec electron-builder --mac`가 schema validation 에러 → `target:[{target:dmg,arch:universal}]`로 수정 후 성공. 룰 #8(패키징 환경 선확인)이 실제로 작동.
2) **검증 우선 의사결정.** 근거: 모든 배포 옵션을 WebSearch 출처로 확정 후 제시 — 추측 옵션을 표에 넣지 않음(agent-workflow §1).
3) **CI 한 번에 통과.** 근거: `v0.1.0` 양 OS job GREEN, 재시도 0. 로컬 선검증 + .nvmrc/.npmrc/onlyBuiltDependencies 정합 반영 덕.
4) **public 전환 전 시크릿 스캔으로 안전 확인.** 근거: 이력 전체 고신뢰 패턴 0, 프로덕션 시크릿 0(env 주입), local/test 더미만 — 개인 이메일 노출만 surfacing 후 사용자 동의.
5) **우회책 실패를 정직하게 규명·되돌림.** 근거: `password-store=basic` 적용 후 키체인 항목 재생성 관찰 → 무효 결론 명시 → 미커밋 restore.

## 4. 어긋난 점

- **🔴 저장소 visibility 미검증 (가장 큰 누락).** plan/research에서 "GitHub Releases면 공개 다운로드 가능"으로 **단정**, repo가 private인지 확인 안 함. 게시 후 공개 URL 404로 발견. **회피 가능 시점:** plan의 R5(자산 게시) 또는 quickstart 검증에 "저장소 public 여부 + 익명 다운로드 1회 확인" task를 박았어야. FR-002("인증 없이 접근")를 명시해놓고 그 전제(repo 공개)를 검증 안 한 모순.
- **무서명 macOS 마찰 전수조사 누락 — 키체인 프롬프트.** 무서명 마찰을 Gatekeeper만 조사하고 Chromium Safe Storage(키체인) 프롬프트는 plan에서 누락. 사용자 dogfooding 스크린샷("로그인 키체인 암호를 요구하는데?")에서야 발견. **회피 가능 시점:** research §R3에서 "무서명 Electron macOS 마찰"을 Gatekeeper+키체인+자동업데이트로 전수조사.
- **scope 혼선 — backend 언급.** 데스크탑 배포 논의에 frontend `/download`(다운로드 페이지)는 정당하나 backend(로그인/api)까지 끌어들여 사용자 멈춤 신호("frontend/backend 왜 얘기해?"). **회피 가능 시점:** "데스크탑 배포 = GitHub Releases가 본체, /download는 얇은 안내 웹페이지, backend 무관"을 처음부터 경계지었어야.
- **멈춤 신호 2회:** ① 키체인 프롬프트 ② backend scope 질문. 둘 다 예측 가능했던 영역.
- 반복 디버깅/30분+ 루프 없음. 다운로드 404는 1사이클 진단(전파지연 의심→직접URL 404→API 동작→private 확인)으로 규명.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **"공개 배포/호스팅" 가정은 실제 익명 접근성을 검증한 뒤 완료 선언.** GitHub Releases·CDN·스토리지 등 "공개"를 전제하면 저장소 visibility / 익명 다운로드를 1회 실측.
- **무서명 데스크탑 배포 마찰은 전수조사**: Gatekeeper(실행 차단) + 키체인(Chromium Safe Storage 프롬프트) + 자동업데이트(불가). macOS는 마찰이 다겹이라 서명 효용 큼.
- **데스크탑 배포 범위 경계**: 본체=GitHub Releases, `/download`=선택적 안내 웹페이지, backend=무관. 범위 밖 컴포넌트 언급 자제.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — `agent-workflow-discipline.md` §11 신설: 공개 배포/호스팅 가정의 익명 접근성 검증 (심각도: 높음)**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` 신규 §11
- (2) 본문: "산출물을 '공개 접근 가능'으로 전제하는 작업(릴리스 호스팅·CDN·다운로드 링크·공개 API)은 plan/구현 단계에서 **익명(비인증) 접근을 1회 실측**한다. 특히 GitHub Releases는 **저장소 visibility(private→자산 공개 URL 404)**를 먼저 확인. '공개 가능'을 단정하지 말 것."
- (3) 근거: 본 회고 §4 — repo private 미검증으로 게시 후 다운로드 404, FR-002 전제 모순.

**후보 2 — `agent-workflow-discipline.md` 또는 desktop 룰: 무서명 데스크탑 배포 마찰 전수조사 (심각도: 중)**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` §8(Electron 환경 선확인) 보강 또는 신규 항목
- (2) 본문: "무서명/ad-hoc 데스크탑 앱 배포 시 사용자 첫 실행 마찰을 전수조사: macOS=Gatekeeper(시스템 설정 '확인 없이 열기') + Chromium Safe Storage 키체인 암호 프롬프트(`--password-store=basic`은 macOS 무효) + 자동업데이트 불가(Squirrel.Mac 서명 요구) / Windows=SmartScreen. 안내문에 각 단계 반영."
- (3) 근거: 본 회고 §4 — 키체인 프롬프트 plan 누락, dogfooding에서 발견.

**사용자 컨펌 전까지 실제 룰 파일 수정 안 함.**
