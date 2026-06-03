# 에이전트 작업 규율 (Agent Workflow Discipline) — HARD-GATE

본 프로젝트(write-note)에서 Claude 작업 시 의사결정·인터뷰·subagent 위임 품질을 보장하기 위한 규율.
글로벌 룰의 본 프로젝트 한정 보강이며, **회고 (`docs/retrospectives/...`) 에서 도출된 회귀 사례에 근거**한다.

## 1. 추측 영역 발견 시 — 옵션 비교 표 작성 이전 검증 위임 (HARD-GATE)

도구 syntax / 프레임워크 동작 / 외부 API 스펙 등 **추측 영역**임을 인지한 시점에 옵션 비교 표를 사용자에게 송출하기 **이전** 검증 위임 (`claude-code-guide` / `WebFetch` / 공식 문서 Read) 의무.

옵션 표를 먼저 작성하면 (a) 검증 안 된 옵션이 표에 들어가고 (b) 사용자가 그 옵션을 선택할 위험. 비교 표는 **검증된 정보로만** 구성한다.

### 회피 절차

1. 추측 영역 인지 — "정확한 syntax 를 모른다 / 공식 문서 확인 못 했다" 시그널
2. 옵션 표 작성 **이전** 검증 도구 호출 (read-only subagent 또는 WebFetch)
3. 검증 결과 반영하여 옵션 표 구성
4. 그 다음에 사용자 인터뷰

### 회귀 사례 — 2026-05-19 settings.json deny 패턴

- `.claude/settings.json` Bash deny 패턴 작성 중 "정밀 deny (인자 SQL 키워드 매칭)" 옵션을 "(권장)" 마크와 함께 비교 표에 포함
- 사용자 선택 후 `claude-code-guide` 위임 시 발견 — 공식 문서 (`code.claude.com/docs/en/permissions.md`) 상 Bash deny 는 prefix 매칭만 가능, 인자 부분 매칭은 PreToolUse 훅 영역
- 결과: 정정 보고 + 사용자 재결정 한 사이클 추가
- 회피 가능했던 시점: 첫 옵션 비교 표 작성 **이전** `claude-code-guide` 호출

## 2. "권장" 마크 부착 직전 검증 (HARD-GATE)

선택지에 "(권장)" 마크 부착 직전 self-check:

- 그 옵션이 실제 **가능**한가 (도구·프레임워크·인프라 측 지원 확인 완료?)
- 그 옵션의 동작이 **검증된 정보**인가 (공식 문서 / 코드베이스 / 실측 결과 인용 가능?)

사용자가 적극 검증하기 어려운 메타 정보 영역 (도구 syntax / 프레임워크 내부 동작 / 외부 라이브러리 한계) 에서 권장 마크는 더 신중해야 한다. 정보 비대칭 상태의 사용자가 권장만 보고 동의할 위험.

§1 과 연동. **권장 마크 부착 = 검증 완료 신호**로만 사용. 검증 안 된 옵션에는 "(검증 필요)" 또는 마크 생략.

### 회귀 사례 — 2026-05-19 동일 사례

- "정밀 deny (권장)" 마크 부착. 실제로는 settings.json 만으로 불가능
- 사용자는 권장 마크 보고 선택. 정보 비대칭으로 검증 어려움

## 3. 작업 트랙 누적 시 명시 트랜잭션 분기 보고 (HARD-GATE)

진행 중인 작업 트랙 N 도중 사용자가 신규 주제 M 을 분기하면 즉시 한 줄 보고:

> "기존 작업 N 보류 / 신규 주제 M 진행" — 또는 — "기존 작업 N 의 다음 단계 X 보류"

두 트랙이 결과적으로 합쳐지더라도 명시 보고는 별개. 사용자가 현재 트랙 상태를 추적할 수 있어야 한다.

### 적용 시그널

- 진행 중 작업이 명확한 다음 단계 (dry-run / commit / 검증 등) 를 가지고 있는데 사용자가 신규 주제 발언
- "이거 ~ 도 해야 하는데" / "그런데 ~" / "참고로 ~ 도 추가하고 싶어" 등 신규 주제 doors 발언

### 회귀 사례 — 2026-05-19 회고 스킬 ↔ 외부 인프라 룰

- 회고 스킬 draft 작성 후 dry-run 진입 직전 사용자가 "외부 인프라 금지 규칙" 신규 주제 분기
- 두 트랙 누적되었으나 보류 명시 없이 자연스럽게 새 주제 진입
- 결과: dry-run 은 외부 인프라 룰 종료 후 합쳐서 진행됨. 결과는 적절했으나 사용자에게 트랙 누적 상태 보고 부재

## 4. Subagent Dispatch 시 체크리스트 자동 적용 의무 (HARD-GATE)

`Agent` 도구로 subagent 위임 시 글로벌 `~/.claude/rules/shared/subagent-delegation-cost.md` §"Dispatch Prompt 체크리스트" 의 항목을 **자동 적용** 의무:

- **검증 명령 cap** — 라운드별 2개 이하, 전체 검증 마지막 1회
- **사전 경고 의무** — 시그니처 변경 / 신규 BC 의존 / cross-BC port 등
- **출력 verbose 통제** — "최종 보고 5~10줄 이하" 명시
- **안전 장치** — 같은 에러 3회 재시도 금지 / tool_uses 50 초과 시 중단
- **lint 정합** — backend Kotlin 위임 시 `ktlintFormat`(main+test **양쪽**) 명시 / frontend 위임 시 작성 직후 `pnpm build`(RSC 경계 검출) 명시

체크리스트 항목 일부 누락 시 호출 비용 · verbose · 재시도 증가. **누락은 회고 §"어긋난 점" 으로 surfacing 의무** — 다음 회귀 예방의 영구 신호.

### 회귀 사례 — 2026-05-19 claude-code-guide 호출

- dispatch prompt 에 "200~400 라인 이하 / 추측 금지 / 출처 URL 명시" 만 포함. verbose 통제 / tool_uses cap / 안전 장치 일부 누락
- 결과: tool_uses 4 / ~59K 토큰 / 100초 — 적정 범위 내
- 명시 적용 시 더 짧은 보고 가능했음. 본 사례는 작업 규모가 작아 비용 차이 미미했으나, 큰 작업에서 동일 누락 시 비용 폭증 위험

### 회귀 사례 — 2026-05-31 006 ktlint test 소스셋 누락

- US3/US4 backend subagent 가 `ktlintFormat` 을 main 소스셋만 적용, test 소스셋 누락 → 전체 게이트(`ktlintTestSourceSetCheck`)에서 chain-method-continuation 위반 → advisor 후처리(`ktlintFormat`) 2회
- 회피 가능했던 시점: dispatch prompt 의 "lint 정합" 항목에 "ktlintFormat main+test 양쪽" 명시

## 5. 프로젝트 본질 정의 문서의 실제 정합성 검증 (HARD-GATE)

spec / implement 진입 시 본질 정의 문서 (`AGENTS.md`, `CLAUDE.md`, framework-specific 경고, package metadata 인용 등) 가 **실제 코드베이스 / 패키지 구조와 정합한지 검증 후 진행 의무**.

문서 정독 자체가 추측을 박지는 못한다 — 문서가 작성 시점 환경 기준으로 박혔는데 본 시점 환경이 다르면 그 문서를 따른 결정도 추측이 된다.

### 검증 가능 영역

- 문서에 명시된 **파일 경로 / 디렉토리** 실제 존재 여부 (`ls` 또는 `find`)
- 문서가 인용한 **메서드·함수·옵션** 의 실제 패키지 export 여부 (`grep`)
- 문서가 인용한 **패키지 docs 경로** 실제 존재 여부 (`node_modules/<pkg>/docs/` 등)
- 문서가 명시한 **버전·환경 가정** 의 현재 상태 일치 여부 (`package.json`, `tsconfig.json`, `next.config.*` 등)

### 절차

1. 본질 정의 문서 정독 시 인용된 경로 / 메서드 / 파일 list 작성
2. 각 항목에 대해 실제 존재 검증 (`Bash` 또는 `Read`)
3. 불일치 발견 시:
   - 즉시 진행 멈춤 X (작업 자체 차단은 과한 신중함)
   - **별도 트랙으로 surfacing** 의무 — 회고 §"어긋난 점" + 02-progress 의 "별도 정리 트랙" 박음
   - 본 spec 영역에서 정정 가능하면 본 spec 산출물에 포함, 아니면 후속 작업 단위로 분리
4. 정합 확인 후에만 본질 정의 문서를 결정 근거로 사용

### 회귀 사례 — 2026-05-21 002 frontend route scaffold

- `frontend/AGENTS.md` 가 "Read the relevant guide in `node_modules/next/dist/docs/` before writing any code" 명시 — Next.js 16 breaking change 정독 의무
- 본 spec implement 진입 시 `pnpm install` 후 확인 결과 해당 디렉토리 **부재** (PoC 0-3 시점에는 존재했던 듯, sw-register.tsx 주석에서 인용)
- 본 spec implement 는 docs 정독 없이 진행 가능 영역만 직접 (Phase 1~5 의 라우트 골격 + 정적 외관) + 추측 위험 영역 (server-client 경계 / 폰트 메타데이터) 은 즉시 발견 → fix
- 회피 가능했던 시점: speckit-specify 또는 plan 단계의 research 에 `frontend/AGENTS.md` 의 인용 경로 실제 존재 검증 task 박았더라면

## 6. tasks.md 명시 영역 (파일명 / endpoint 수 / 메서드 시그니처) — implement 진입 직전 실제 코드 grep 의무 (HARD-GATE)

`tasks.md` 의 파일명 / endpoint 수 / 메서드 시그니처 명시는 **spec/plan 산출 시점 추측**이다. 산출 시점과 implement 시점 사이에 코드 변경 박힐 수 있고, spec 작성 시점에 정확 카운트 안 박힌 채 추정 박을 수 있다. implement 시점에 본 추측이 본질 결정 영역에 영향 미치면 회귀.

### 회피 절차 (implement 진입 직전)

1. `tasks.md` 에 명시된 모든 파일 이름 / endpoint 카운트 / 클래스 명을 발췌
2. 다음 검증 명령 실행:
   - `grep -l <ClassName> backend/src/main/kotlin backend/src/test/kotlin` — 실제 파일 존재 + 정확한 경로
   - `grep -c "@\(Get\|Post\|Put\|Patch\|Delete\)Mapping" <ControllerFile>` — endpoint 수
   - 신규 작성 영역: `find backend/src/main/kotlin -name "*<Suffix>*.kt"` — 동일 suffix 패턴 일관성
3. 불일치 발견 시:
   - 단순 파일명 오타 (`ProjectControllerWebTest` vs `ProjectControllerIT`) → 실제 코드 정합으로 진행 + tasks.md 갱신 (또는 회고 §4 어긋남 박음)
   - endpoint 카운트 차이 ("6 endpoint" vs 실제 5) → 본 spec 의 본질 결정 영역 확인 (contracts 정독) + 실제 코드 정합으로 진행
   - 시그니처 차이 (파라미터 수 / 타입) → spec 의 contracts 정독 + 본질 결정 영역 확인 + 사용자 컨펌

### 적용 시점

- `/speckit-implement` 또는 implement 진입 직전 첫 task 작업 전
- 신규 라운드 진입 시 — 라운드의 의존 빈 / 산출물 명시 확인

### 회귀 사례 — 2026-05-24 003 Phase 8

- `tasks.md` T066 명시 "6 endpoint 모두" — 실제 `ProjectController` 5 endpoint (createProject / listProjects / getProject / updateProject / archiveProject)
- `tasks.md` T067 명시 `ProjectControllerWebTest.kt` — 실제 파일명 `ProjectControllerIT.kt`
- implement 진입 시점에 실제 코드 정합으로 진행 + 회고 §4 어긋남 박음. 큰 영향 없었으나 spec 추측 vs 실제 코드 격차가 본질 결정 영역에 잠재 영향
- 회피 가능했던 시점: tasks.md 작성 시점 (speckit-tasks) 에 `grep -l ProjectController` + endpoint 카운트 1회

## 7. Subagent 자기진단 ("기존 회귀 / 내 변경 아님") 무검증 수용 금지 (HARD-GATE)

subagent 가 테스트 실패 / 회귀를 "기존부터 존재 / 내 변경과 무관" 으로 보고하면, advisor 는 수용 **이전** 직접 검증 의무:

1. 해당 실패 테스트를 직접 재현 (`pnpm test <파일>` / `./gradlew test --tests "*X*"`)
2. subagent 변경 파일과 실패의 인과 확인 — 공용 레이어 변경이면 도메인 횡단 회귀 의심
3. 특히 **공용 레이어**(`client.ts` / `SecurityConfig` / 전역 필터 / 공유 컴포넌트 / envelope·인터셉터) 변경 라운드에서 의무

subagent 의 자기진단은 본인 변경의 영향을 과소평가하는 경향이 있다 — "기존 회귀" 주장은 **검증 신호**이지 수용 근거가 아니다.

### 회귀 사례 — 2026-05-31 006 US1 client.ts 409 오분류

- frontend subagent 가 `SignupEmailForm` 테스트 실패를 "이 작업 이전부터 존재하는 기존 회귀" 로 단정 보고
- 실제: subagent 가 추가한 `client.ts` 409 분기가 **모든 409 를 `DOCUMENT_VERSION_CONFLICT` 로 오분류** → `EMAIL_ALREADY_REGISTERED`(409) 회원가입을 깨뜨린 신규 회귀
- advisor 가 직접 재현 → 신규 회귀 규명 → `error.code` 기준 분기 수정 → GREEN. 무검증 수용 시 회귀 merge 위험
- 회피 가능했던 시점: subagent "기존 회귀" 보고 직후 직접 재현 (본 사례는 실제로 차단함 — 룰로 영구화)

## 8. Electron · 네이티브 모듈 · 패키징 환경 선확인 (HARD-GATE)

Electron / 네이티브 모듈(better-sqlite3 등) / 패키징(electron-builder) 을 **도입·버전 변경할 때, 설치·빌드 명령 실행 전** 아래 4 항목 self-check 의무. 환경 가정(Node 버전 / PATH / 서명)이 어긋나면 설치·빌드가 실패하거나 산출물이 실행 불가가 된다.

1. **Node 버전 정합** — 시스템 Node 가 대상 기능을 지원하는가: `require(ESM)`(20.19+), 내장 모듈(`node:sqlite` 22.13+/24), 도구의 `engines.node`(예: `@electron/rebuild@4.x` = Node 22.12+). 미정합이면 `.nvmrc` 상향 또는 도구 버전 하향.
2. **pnpm build script 승인** — 네이티브 의존성은 `package.json` `pnpm.onlyBuiltDependencies` 에 등록(pnpm 8 은 postinstall 기본 차단 → 바이너리 미설치).
3. **nvm 전환 시 pnpm PATH** — `nvm use` 후 pnpm 이 PATH 에서 빠진다. build/package 류 도구는 **child shell 이 PATH 의 pnpm 을 호출**하므로 `corepack enable` 또는 pnpm 경로 PATH 노출을 선행한다.
4. **arm64 패키징 서명** — Apple Silicon 은 **ad-hoc 서명조차 없으면 실행 거부**(`codesign --verify` 실패). 미서명 빌드 후 `codesign --force --deep --sign - <app>` 재서명 + dmg 재생성.
5. **preload 결선 ↔ sandbox 정합 + smoke test** — renderer 가 preload 노출 API(`window.electronAPI` 등)를 **처음 사용하기 전**, renderer 에서 그 API 존재를 1회 smoke test(예: `window.electronAPI` undefined 여부) 한다. preload 빌드 포맷(CJS/ESM)과 `sandbox`/`contextIsolation` 정합은 `typecheck`/`build` 로 **안 드러나고** renderer 첫 호출에서 터진다. vite-plugin-electron 은 ESM 프로젝트(`type:module`)에서 preload 를 **CJS(.mjs)** 로 빌드 → `sandbox:true` 필요(sandboxed preload 는 확장자 무관 CommonJS 로 로드, contextBridge/ipcRenderer 가용). `sandbox:false` 면 `.mjs` 를 ESM 으로 로드해 `require is not defined` 로 preload 가 통째로 실패한다.

### 회귀 사례 — 동종 환경 함정 3 세션 연속 재발

- **2026-06-03 Phase 1:** Node 20.10.0 에서 electron 42 `install.js` 가 `@electron/get`(ESM)을 `require` → `ERR_REQUIRE_ESM`, 바이너리 설치 실패. plan 단계 미발견, `pnpm dev` 실행에서야 발견 → Node 20.20.1 상향으로 해소.
- **2026-06-03 Phase 2 패키징:** electron-builder 의 node module collector 가 `pnpm: command not found`(code 127, nvm 전환 PATH) + arm64 미서명 실행 거부 → PATH 노출 + ad-hoc 재서명 + dmg 재생성으로 해소.
- **2026-06-04 Phase 3 preload 결선:** Phase 1 에서 `sandbox:false`(ESM preload 의도)로 설정했으나 vite-plugin-electron 은 preload 를 CJS(.mjs)로 빌드 → Electron 이 `.mjs` 를 ESM 으로 로드 → `require is not defined in ES module scope` 로 preload 로드 실패 → `window.electronAPI` 미노출. **renderer 가 IPC 를 처음 호출하는 Phase 3 dogfooding 에서야 표면화**(Phase 1·2 는 renderer 가 electronAPI 미사용이라 콘솔 에러만 나고 화면 영향 0). 공식 문서 검증 후 `sandbox:true` 복원으로 해소(커밋 `6b9d6e4`). 회피 가능 시점: Phase 1 scaffold 때 renderer 에서 `window.electronAPI` 존재 1회 smoke test.
- 회피 가능했던 시점: 설치·빌드 명령 실행 **전** 위 5 항목 self-check. (Phase 1 회고에서 "보류 후보" → Phase 2·3 연속 재발 — 룰로 영구화)

## 메타 — 본 룰의 누적 정책

본 룰은 **회고 회귀 사례에서 도출** 된 항목을 누적한다. 새 항목 추가 절차:

1. `.claude/skills/retrospective/SKILL.md` 흐름대로 회고 작성
2. 회고 §5-2 "룰 갱신 후보" 에 본 룰 (`agent-workflow-discipline.md`) 갱신 후보 명시
3. 사용자 컨펌 후 본 룰에 섹션 추가 — 항목명 + 회피 절차 + 회귀 사례 (일자·작업명·회피 가능했던 시점)

각 섹션은 **회귀 사례 부재 시 추가 금지**. 추측만으로 룰 추가 시 §1 위반.

## 출처 / 인접 룰

- 본 프로젝트 회고: `docs/retrospectives/...` (저장 보류 분기 가능)
- 본 프로젝트: [`.claude/skills/retrospective/SKILL.md`](../../skills/retrospective/SKILL.md)
- 글로벌: `~/.claude/rules/shared/subagent-delegation-cost.md`
- 글로벌: `~/.claude/rules/shared/user-interview-quality.md`
- 글로벌: `~/.claude/rules/shared/coding-principles.md` §"추측 금지 (HARD-GATE)"
