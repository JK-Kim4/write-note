# 에이전트 작업 규율 (Agent Workflow Discipline) — HARD-GATE

본 프로젝트(write-note)에서 Claude 작업 시 의사결정·인터뷰·subagent 위임 품질을 보장하기 위한 규율.
글로벌 룰의 본 프로젝트 한정 보강이며, **회고 (`~/obsidian/write-note/retrospectives/...`) 에서 도출된 회귀 사례에 근거**한다.

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

## 9. 화면 표시값의 출처(저장 입력 vs 파생 표시 / 어떤 IPC·필드) — spec/plan 단계 명시 (HARD-GATE)

화면에 보이는 값마다 그 값이 **"저장된 입력값"인지 "본문 등에서 파생한 표시값"인지**, 그리고 **어떤 IPC·DB 필드·파생 경로에서 오는지**를 spec/plan(특히 data-model 또는 research) 단계에서 명시한다. 이를 plan default 로 추측하면 (a) 표시값/입력값을 잘못 가정해 사용자 의도와 어긋나거나, (b) 표시에 필요한 데이터 경로가 기존 조회에 없어 **구현 중 backend 확장·설계 결정**이 발생한다.

### 회피 절차

1. spec/디자인 단계: 각 화면 표시 요소를 list 화 → 요소마다 "저장 입력 / 파생 표시 / 외부 조회" 분류. **모호하면 plan default 로 넘기지 말고 목업·질문으로 먼저 확정**한다(특히 작가가 직접 적는지 vs 자동 파생인지).
2. plan(data-model/research): 각 표시값이 **어떤 IPC·필드·파생**에서 오는지 박는다. 기존 조회(예: `projects.list`)가 그 값을 안 주면 신규 조회 경로(예: `listProjectCards`)가 필요함을 plan 에서 드러낸다.
3. implement: 표시값 출처가 plan 에 박혀 있으면 구현 중 데이터 경로 신설 결정이 안 생긴다.

### 회귀 사례 — 2026-06-06 009 작업실 재디자인

- **"다음 장면" 표시값/입력값 미확정 → R1 default 뒤집기**: plan R1 이 "다음 장면 = 곁쪽지로 대체(전용 필드 없음)"로 default 결정했으나, 사용자가 목업(`next-scene-options.html`)을 보고 **"작가가 직접 적는 한 줄(B)"**로 뒤집음 → `projects.next_scene` 신설로 spec/plan/data-model/contracts 전부 재갱신. 회피 가능 시점: spec 단계에서 "다음 장면"이 표시값인지 입력값인지 목업으로 먼저 확정.
- **"마지막 문장" 데이터 경로 미박음 → 구현 중 backend 확장**: 작품 벽 카드가 "마지막 문장"을 표시하는데 `projects.list` 가 본문(document)을 안 줘서 구현 시점에야 데이터 경로 부재를 발견 → `store.listProjectCards` 로 backend 확장. 회피 가능 시점: plan data-model 에 "화면별로 어떤 IPC·필드에서 표시값이 오는가"를 명시.

## 10. 양보 불가 핵심 기능은 첫 dogfoodable 산출물에서 증명 — 목표 상실 방지 (HARD-GATE)

사용자가 **"양보 불가 / 필수 / 핵심"** 으로 못박은 기능이 있으면, **첫 번째 dogfooding 가능한 산출물이 바로 그 기능을 실행**해야 한다. 주변 인프라(범용 편집·배선·서식·저장·스캐폴딩)를 먼저 쌓고 핵심 기능을 마지막 단계로 미루는 분해는 금지한다. 핵심을 마지막에 두면, 주변에서 시간을 다 쓰고 핵심은 시작도 못 한 채 "이도저도 아닌" 산출물이 된다.

### 회피 절차

1. **핵심 한 줄 고정** — 작업 진입 시 "이 작업의 양보 불가 핵심이 무엇인가"를 한 줄로 박고 시작.
2. **분해 self-check** — 빌드 분해(step 1/2/3…)를 작성하는 순간 **"step 1 의 dogfooding 게이트가 핵심 기능을 직접 건드리는가"** 점검. 안 건드리면(=핵심이 step 2+ 로 밀리면) 분해를 재설계해 핵심을 step 1 로 끌어온다.
3. **process weight = 핵심 미검증까지의 거리에 반비례** — 핵심 기능이 **한 번도 dogfooding 안 된 상태**에서 멀티에이전트 파이프라인 / 풀 SDD / 다수 커밋 누적 금지. 작은 PoC → 조기 (브라우저/실환경) dogfooding 을 먼저 통과시킨다.
4. **버그 보고 = 실재 확인부터** — 버그 보고·스크린샷·로그 단편을 받으면 **"이 버그가 실재하는가"를 재현/사용자 확인으로 먼저 확정**한 뒤 근본원인을 단정한다(systematic-debugging Phase 1 정합). 단편만으로 "CRITICAL 버그" 단정 + 수정안 제시 금지.

### 회귀 사례 — 2026-06-07 자체 EditContext 에디터

- **목표 상실**: 목표 = "실시간 진짜 페이지 분할"(사용자 양보 불가). 그러나 범용 편집 엔진(IME·커서·Enter·Backspace·화살표·클릭·서식)을 **"1단계 = 엔진 코어"** 로 통째로 짓고 **분할을 "2단계"로 미룸** → 세션 전체를 엔진 코어 + 잔버그(Enter 다중·드래그 Backspace)에 소모, **분할은 단 한 줄도 시작 못 함**. 사용자 "이도저도 아닌작업중" → 전량 폐기.
- **과잉 process**: "PoC 작게 + 조기 dogfooding" 가드레일을 두고도 brainstorm→design→plan→subagent 6 dispatch × (spec+품질 리뷰) ≈ **20 커밋을 첫 브라우저 dogfooding 전에** 쌓음. 유일하게 중요한 게이트(브라우저 한글)가 맨 마지막에 왔다.
- **false-alarm 디버깅**: dogfooding 스크린샷의 자모를 "CRITICAL IME 분해 버그"로 단정 + 가설·수정안 제시 → 실제론 사용자가 의도적으로 친 입력("내가 일부러 저렇게 친거야"). 버그 실재 확인 전 근본원인 단정.
- **회피 가능 시점**: 설계 결정 직후 4단계 분해를 작성하는 순간 §10-2 self-check. "1단계 = 분할되는 종이를 한글과 함께 띄우는 최소 PoC"로 잡았어야.
- 회고: `~/obsidian/write-note/retrospectives/2026-06-07-custom-editcontext-editor-objective-drift.md`

## 11. 수정이 버그를 못 고치면 — 다시 고치기 전에 레이어를 관찰로 확정 (HARD-GATE)

보고된 버그를 한 번 고쳤는데 **재현이 그대로면, 같은 증상을 다른 가설로 또 고치지 않는다.** 추측 수정의 반복은 엉뚱한 레이어를 계속 건드리는 신호다.

### 회피 절차

1. **증거가 기존 가설을 반증하는지 먼저 본다** — 예: "저장이 안 된다" 가설인데 서버/DB에 값이 있으면 저장 가설은 이미 틀린 것. 모순을 발견하면 그 가설을 버린다(말로만 "다른 레이어일 수도"라고 넘기지 말 것).
2. **데이터가 흐르는 레이어를 나열하고 어디서 끊기는지 직접 관찰** — 입력 → 저장(localStorage 등) → 전송(서버) → 표시(에디터/렌더). 유실 순간에 **그 3~4곳을 동시 확인**(화면 / 로컬 저장소 / 서버 DB)해 끊긴 지점을 좁힌 뒤 고친다.
3. **2회 연속 헛수정 = 정지 신호** — 즉시 멈추고 §1·관찰로 복귀. 사용자에게 "어느 레이어인지 아직 미확정"을 정직히 보고하고, 추측 수정 대신 관찰 1회를 먼저 한다.

systematic-debugging Phase 1(버그 실재·재현 확정)·§10-4(버그 보고=실재 확인부터)의 연장 — "한 번 고침"이 실재 확인을 대체하지 못한다.

### 회귀 사례 — 2026-06-09 016 자동저장 유실 3회 오진

- 집필실에서 작성 후 메뉴 이동 시 작성분 유실. **같은 증상을 3회 다른 가설로 헛고침**: (1) US2 복구 배너("동기화 전 유실") (2) localStorage-first 자동복원+no-clobber("복원 안 됨/동기화가 draft 덮음") (3) **실제** = `PaperEditor`의 `if (e.view.composing) return`이 한국어 IME 조합 중 onChange를 차단 → 작성분이 어디에도 안 들어감.
- 클린 트레이스가 `serverBodyLen=425`(저장 정상)를 보여 자동저장 가설을 이미 반증했는데도, 그 모순을 "표시 레이어일 수도"라고만 말하고 또 자동저장을 고쳤다.
- 회피 가능 시점: 1차 수정 실패 직후. "저장/표시/입력 중 어느 레이어인지" 화면·localStorage·서버 3중 관찰로 먼저 확정했어야. 결국 사용자의 정밀 재현("Enter 누르면 살고 안 누르면 죽는다")이 입력(조합) 레이어를 가리켜 해결.
- 회고: `~/obsidian/write-note/retrospectives/2026-06-09-autosave-redesign-ime-loss-misdiagnosis.md`

## 12. 기존 1:1 인프라를 1:N 으로 재사용 시 — 차원 변경 추종 검증 (HARD-GATE)

자동저장 세션·캐시·단일 인스턴스 상태 등 기존 인프라를 **새 차원(1:1→1:N, 단일→다중)에 재사용**할 때, 그 인프라가 **새 차원의 키 변경(예: documentId 전환)을 따라가는지**(리마운트/재초기화) 검증한다. "단일 인스턴스 + 1회 초기화" 가정을 점검하지 않으면 stale 상태가 새 차원에서 회귀한다.

### 회피 절차

1. 기존 인프라를 새 차원에 재사용하기로 결정한 시점에 그 인프라의 **초기화·생명주기 가정**을 명시한다(예: "page 진입 1회 초기화", "documentId 단위 세션").
2. 새 차원에서 그 키가 바뀌는 경로(챕터 전환·탭 전환 등)를 나열하고, 각 경로에서 인프라가 **재초기화/리마운트되는지** 확인한다. 안 되면 키 단위 리마운트(`key={newKey}`) 또는 내부 재초기화를 추가한다.
3. 자동화 테스트가 새 차원의 stale 경로(예: 토큰 stale → 충돌)를 **실제로 검증**하는지 점검한다 — 표면 격리(localStorage 키 등)만 보면 stale 가 dogfooding 까지 샌다.

### 회귀 사례 — 2026-06-14 022 챕터 거짓 409

- 016 `useDocumentSession`(page 단일 인스턴스 + `initRef` 1회 가드 = **1:1 전제**)을 챕터(1:N) 전환에 재사용. 챕터 전환 시 `documentId` 가 바뀌어도 세션이 재초기화 안 돼 `versionRef` 가 옛 챕터 토큰으로 stale → 새 챕터에 옛 토큰 PUT → **거짓 409 저장 충돌 회귀**(016 이 근본 해결했던 바로 그 증상).
- `editorKey` 는 `PaperEditor` 만 리마운트하고 세션은 page 레벨이라 영속. 자동화 테스트(draft 키 격리)는 version 토큰 stale 경로를 안 봐 게이트 GREEN 인 채 dogfooding 까지 통과.
- 해결: 에디터+세션을 `ChapterEditor`/`BChapterEditor` 로 분리해 `key={documentId}` 리마운트 → 챕터별 독립 세션. 회피 가능 시점: US1 챕터 전환 설계 시 "세션이 documentId 를 따라가는가" 점검.

## 13. Subagent 인프라 쓰기 금지 지시 — 완료 후 실제 상태 확인 (HARD-GATE)

subagent 에 인프라 쓰기 금지(로컬 DB migrate/적용 금지, 외부 호출 금지 등)를 지시했으면, 완료 후 **실제 상태를 직접 확인**한다(§7 "자기진단 무검증 수용 금지"의 인프라 확장). 지시만으로 subagent 가 따랐다고 단정하지 않는다. 가능하면 `settings.json` deny 로 보강한다.

### 회귀 사례 — 2026-06-14 022 챕터 V14 로컬 DB 적용

- 모든 BE dispatch 에 "로컬 dev DB 적용 금지(IT/Testcontainers 만)"를 명시했으나, dogfooding 준비 시 V14 마이그레이션이 **이미 로컬 dev DB 에 적용**돼 있었음(구현 중 어떤 subagent 가 `bootRun`/`flywayMigrate` 실행 추정). 결과는 무손실 정상이었으나 지시 위반 — 명시 지시가 실제 준수를 보장하지 못했다.
- 회피 가능 시점: dispatch 완료 후 `flyway_schema_history` 등 실제 DB 상태 확인, 또는 `settings.json` 으로 `flywayMigrate`/`bootRun` deny.

## 14. 생성물 단위테스트의 검증 한계 — 렌더·스타일·외부 뷰어 정합은 dogfooding 게이트 (HARD-GATE)

파일·문서 등 **생성물의 단위테스트가 "생성 성공 / 요소 존재"만 검증하면, 실제 렌더·스타일·외부 뷰어 정합 갭을 못 잡는다.** 시각/외부 렌더 결과(인쇄·워드프로세서·브라우저 표시)는 dogfooding 게이트로 검증하고, plan 에 **"단위테스트로 못 잡는 가정"**(예: 스타일 정의가 빈 문서에 존재하는가)을 명시한다. 단위테스트 GREEN 을 시각/렌더 정합의 증거로 단정하지 않는다.

### 회피 절차

1. 생성물(파일·출력) 테스트 작성 시 "이 테스트가 무엇을 보장하고 무엇을 못 보장하는가" 1줄 명시 — 보통 구조·존재는 보장, 렌더·스타일은 미보장.
2. 렌더·스타일·외부 뷰어 정합은 dogfooding 게이트로 위임 + plan 에 그 가정(예: styleId 가 뷰어에 정의되는가)을 박는다.
3. 가정이 깨지기 쉬운 영역(외부 라이브러리 기본 산출물에 스타일·폰트 정의 부재 등)은 직접 서식 등 뷰어 무관 방식을 우선 검토.

### 회귀 사례 — 2026-06-16 023 R7 export DOCX 제목

- DocxExportService 가 `p.style = "Heading1"` 으로 styleId 만 박았는데 POI `new XWPFDocument()`(빈 문서)에는 Heading 스타일 **정의가 없어** Word 가 일반 폰트로 렌더. 단위테스트는 "제목 텍스트 포함"만 검증해 통과 → dogfooding 에서 일반 폰트 발견 → run 직접 서식(bold+크기)으로 수정.
- 회피 가능 시점: plan 에서 "styleId 가 빈 문서에 정의되는가" 검증, 또는 테스트에 서식(isBold/fontSize) assert.

## 15. 검증 미성숙한 전면 교체 위에 신기능을 얹을 때 — 갭 노출 트랙 분리 (HARD-GATE)

dogfooding 검증이 미성숙한 **전면 교체(자체 엔진·인프라 교체)** 위에 신기능 라운드를 얹으면, **신기능 dogfooding 이 교체분의 갭을 다수 노출**해 트랙이 뒤엉킨다. (a) 교체 라운드는 자체 dogfooding 을 충분히 통과시킨 뒤 신기능 라운드에 진입하거나, (b) 신기능 dogfooding 에서 나온 교체분 갭은 즉시 별도 트랙으로 분리해 신기능 트랙과 섞지 않는다. 특히 두 트랙이 같은 브랜치면 merge 시 미해결 교체분 갭이 함께 넘어가므로 merge 전 그 중대성을 surfacing 한다.

### 회피 절차

1. 신기능이 전면 교체분 위에 얹힌 구조면, 진입 시 "교체분이 dogfooding 을 충분히 통과했나" 점검.
2. 신기능 dogfooding 중 교체분 갭 발견 시 즉시 별도 트랙으로 분리 보고(§3 트랜잭션 분기) — 신기능 트랙과 섞어 수정하지 않는다.
3. 같은 브랜치면 merge 결정 전 미해결 교체분 갭(특히 데이터 유실급)을 명시 surfacing 후 사용자 결정.

### 회귀 사례 — 2026-06-16 023 R7 export ↔ R3~R6 자체 엔진

- R7 export(신기능) dogfooding 중 R3~R6 전면 교체(TipTap→자체 엔진) 갭 5건 노출 — 빈블록 Backspace·Cmd+A·IME 조합 중 명령·**거짓 409 저장충돌(중대)**·목차 선택. R7 과 무관하나 같은 `023-export` 브랜치라 merge 영향. 사용자 결정으로 에디터 갭을 별도 집중 라운드(systematic-debugging)로 분리.
- 회피 가능 시점: R7 진입 전 자체 엔진 dogfooding 충분성 점검, 또는 갭 노출 즉시 별도 트랙 분리(이번엔 분리함 — 룰로 영구화).

## 16. fix "됐다" 단정은 버그가 실재했던 바로 그 surface 에서 관찰 후에만 (HARD-GATE)

수정이 버그를 고쳤다고 보고하기 **전**, 버그가 실재했던 **바로 그 화면·상태**에서 직접 관찰한다. 인접·대용 화면(예: 로그인 화면)이나 테스트 환경의 다른 경로에서 본 것은 검증이 아니다. 대상 surface 에 도달할 **전제조건(로그인·특정 데이터·특정 라우트 등)이 막혀 있으면 "검증됨"이 아니라 "검증 불가"로 보고**한다. systematic-debugging·verification-before-completion 의 연장 — "고친 곳"과 "관찰한 곳"이 다르면 그 보고는 무효다.

### 회피 절차

1. fix 완료 보고 직전 self-check: "버그가 실재했던 그 화면·상태를 지금 직접 봤는가?"
2. 그 surface 에 도달하는 전제조건(로그인 등)이 현재 환경에서 충족되는지 확인. 안 되면 "검증 불가" 보고 + 검증 가능한 환경 제시.
3. 인접 화면이 멀쩡한 것을 fix 근거로 쓰지 않는다(특히 레이아웃·라우트가 다른 화면).

### 회귀 사례 — 2026-06-18 026 모바일 반응형 슬라이드 버그

- US3(헤더 가로 overflow) 수정 배포 후 "슬라이드 버그 사라졌다"고 단정 보고. 그러나 버그는 **로그인 후 서비스 화면(`/b/*`)**에만 있었고(로그인 화면은 원래 버그 없음 + 다른 레이아웃), 프리뷰는 로그인이 막혀 그 화면에 **도달조차 못 한 상태**였다 → 사용자 정정("니가 보여준건 로그인화면이야").
- 회피 가능 시점: "사라졌다" 단정 직전. 버그 있던 서비스 화면에 실제 도달·관찰했는지 self-check. 프리뷰 로그인이 막혀 도달 불가였으므로 "검증 불가"가 정답이었다.

## 17. preview/staging dogfooding 요청 전 — 그 환경이 대상 기능을 실행 가능한지 확인 (HARD-GATE)

프리뷰·스테이징 배포에 dogfooding 을 요청하기 **전**, 그 환경이 대상 기능을 **실제로 실행할 수 있는지**(필수 env·백엔드 연결·인증 전제) 먼저 확인한다. 인증 뒤 화면을 봐야 하는데 그 환경에서 로그인이 안 되면 dogfooding 요청 자체가 헛사이클이 된다. 프리뷰 배포는 운영과 env scope 가 다를 수 있다(예: 백엔드 URL·시크릿이 Production 전용).

### 회피 절차

1. 인증·외부의존이 필요한 화면을 프리뷰에서 dogfooding 요청하기 전, 그 환경의 env scope 확인(예: `vercel env ls` 로 Production 전용 여부).
2. 프리뷰가 대상 기능을 못 돌리면(로그인 불가 등) → 운영 검증 또는 프리뷰 env 보강을 먼저 제시.

### 회귀 사례 — 2026-06-18 026 프리뷰 로그인 불가

- 모바일 반응형 검증을 프리뷰에서 dogfooding 요청했으나, 프리뷰는 `BACKEND_ORIGIN`(Production 전용 env) 부재로 `/api/*`가 `localhost`로 폴백 → **로그인 자체가 안 됨** → 인증 뒤 서비스 화면 검증 불가, 한 사이클 혼선.
- 회피 가능 시점: 인증 필요 화면을 프리뷰에서 검증 요청하기 전 `vercel env ls` 로 백엔드 연결 env 가 프리뷰에 있는지 확인.

## 18. 작업·배포 전 베이스 브랜치 정합 검증 (HARD-GATE)

기능 브랜치는 통합 브랜치(`develop`)보다 뒤처질 수 있다. **작업을 시작하거나 프로덕션 배포하기 전**, 베이스가 통합 브랜치와 정합한지 확인한다 — `git fetch origin develop && git log --oneline HEAD..origin/develop` 로 누락 커밋(특히 **보안·인증·공개경로 계약**)을 점검하고, 뒤처졌으면 통합 브랜치에서 **재분기**한다. FE/BE 분리 수동 배포 구조면 **백엔드가 요구하는 프론트 계약(CSRF 헤더 등)을 배포할 프론트가 충족하는지** 검증한다. 베이스 미검증은 stale 한 전제 위에 작업·배포를 쌓아 회귀를 만든다(§15 연장).

### 회피 절차

1. 새 브랜치 생성·작업 진입 시: `git log --oneline HEAD..origin/develop` 으로 격차 확인. 보안/인증/리브랜딩/공개경로 커밋이 빠졌으면 develop 에서 재분기.
2. 배포 직전: 배포할 브랜치가 통합 브랜치의 핵심 자산(보안 필터 계약·공개 라우트·env 의존)을 포함하는지 확인.
3. 배포 후 인증 화면을 직접 못 보면, 배포 번들에 그 계약(예: `grep X-WriteNote-Client` 빌드 산출물)이 들어갔는지라도 확인.

### 회귀 사례 — 2026-06-19 027 베타정리 logout 403

- "웹 베타 전 정리"를 stale 한 `026` 에서 분기(`027`) → develop 의 보안 커밋(`e309b08`: CsrfDefenseFilter + 프론트 `X-WriteNote-Client` 헤더)·공개 랜딩·전환개선이 통째로 누락. `027` 을 `vercel --prod` 배포하니 develop 기반 프로덕션 프론트를 덮어써 **logout 403 회귀**(헤더 없는 프론트를 백엔드 필터가 거부) + 랜딩·보안헤더 회귀. `027` 전체가 develop 과 중복/충돌(머지 불가)이라 폐기하고 develop 기반 `028` 로 재구성·재배포. **회피 가능 시점: 027 작업 시작 전 `git log HEAD..origin/develop` 1회** (게다가 `deployment-live` 메모리에 X-WriteNote-Client 의존이 이미 적혀 있었으나 active recall 실패). 회고: `~/obsidian/write-note/retrospectives/2026-06-19-beta-prep-branch-base-incident.md`.

## 19. authed 검증 불가 상태의 자율 프로덕션 배포 가드 (HARD-GATE, §16·§17 연장)

인증 뒤 화면을 dogfooding 할 수 없는 상태에서 자율 프로덕션 배포를 할 때, **자동 게이트(build/test) GREEN 을 authed 동작 정합의 증거로 단정하지 않는다**. 자동 테스트는 환경·계약 불일치(CSRF 헤더 누락 등)를 못 잡는다. 인증 뒤 핵심 동작(logout 등)은 배포 후에도 **"미검증"으로 명시**하고, 가능하면 배포 전 사용자 authed 확인을 받거나 **즉시 롤백 가능성**을 확보한다. 롤백 시엔 **롤백 대상이 그 동작을 실제로 만족하는 배포인지** 먼저 확인한다(과거 배포도 같은 결함일 수 있음).

### 회귀 사례 — 2026-06-19 (위 §18 동일 사건)

- 인증 화면 dogfooding 불가(§16/§17) 상태에서 야간 자율 배포 → logout 회귀가 사용자에게 노출. 게이트 GREEN(512 tests)을 authed 정합 증거로 과신. 롤백 시도(`o82i3oq88`)도 **그 배포 역시 헤더 부재**라 logout 못 고침 → 번들 검증 후 정정. 또 `vercel rollback` 이 별칭을 고정해 이후 `--prod` 가 별칭 자동갱신 안 함(`vercel promote` 필요) — 한 사이클 혼선. 회피: 배포 전 "authed 동작은 미검증" 명시 + 롤백 대상의 결함 보유 여부 선확인.

## 20. dogfooding 안내 전 — 그 surface 를 서빙하는 실제 포트·인스턴스 확정 (HARD-GATE, §16·§17 연장)

dogfooding 용 dev 서버를 띄운 뒤, 그 surface 가 **실제로 내 변경을 서빙하는 포트·인스턴스인지 확인하고** 사용자에게 안내한다. 동일 포트를 다른 인스턴스(다른 워크트리·메인 repo·이전 세션)가 점유하면 새 인스턴스는 **다른 포트로 밀린다** — 고정 포트(예: 3000) 가정 금지. 기동 로그의 실제 바인딩 포트(`Port X is in use, using available port Y`) 또는 `lsof -a -d cwd -p <pid>`(프로세스 cwd)로 확정한 뒤 안내한다. ready 체크를 고정 포트에 거는 것 자체가 오인의 원인이 된다(다른 인스턴스에 confirm).

### 회피 절차

1. dev 서버 기동 후, ready 판정·dogfooding 안내 **전** 기동 로그에서 실제 바인딩 포트를 읽는다(`using available port Y` 시그널).
2. 의심되면 `lsof -nP -iTCP:<port> -sTCP:LISTEN` + `lsof -a -d cwd -p <pid>` 로 그 포트를 점유한 프로세스의 cwd 가 **내 워크트리인지** 확인한다.
3. 안내하는 URL 의 포트가 내 변경을 서빙하는 인스턴스인지 확정한 뒤에만 "여기서 확인하세요" 송출.

### 회귀 사례 — 2026-06-21 031 문의 진입점 dev 서버 포트 혼선

- 워크트리(031)에서 dev 서버를 띄웠으나 포트 3000 을 **메인 repo(030) 서버가 이미 점유** → 031 서버가 `using available port 3001` 로 밀림. 그러나 ready 체크 루프가 **3000 고정 curl** 로 메인 repo 서버에 confirm해 "기동 완료"로 오인 → 사용자에게 `localhost:3000`(=030 코드, 카테고리 없음) 안내 → 사용자 멈춤 2회("아무것도 안보이는데"·"유형 없는데?"). `lsof -a -d cwd` 로 3000 의 cwd 가 메인 repo 임을 확인하고서야 규명. 회피 가능 시점: 재기동 로그의 `using available port 3001` 을 즉시 읽었어야.

## 21. 멀티 워크트리에서 공유 브랜치 merge/checkout 전 점유 선확인 (HARD-GATE)

여러 git worktree 가 있는 repo 에서 `develop`·`main` 등 **공유 브랜치로 merge 하거나 checkout 하기 전 `git worktree list` 로 그 브랜치가 다른 워크트리에 이미 체크아웃됐는지 확인**한다. git 은 한 브랜치를 두 워크트리에 동시 checkout 하지 못하게 막으므로, 점유 중이면 `git checkout <branch>` 가 실패한다. 또한 **checkout/merge 명령의 출력·종료코드를 실제로 확인**한다 — 실패(`is already used by worktree` / `Aborting` / `non-fast-forward`)를 무시하고 후속 명령(merge·commit·push)을 이어가면 현재 브랜치에서 무효·오배치 실행되어 "처리됐겠지"로 오인한다.

### 회피 절차

1. 공유 브랜치 merge/checkout 직전 `git worktree list` 로 점유 워크트리 확인.
2. 점유 중이면 그 워크트리에서 직접(`git -C <path> merge ...`), 아니면 현재 워크트리에서 진행.
3. **각 git 명령의 출력을 읽고 다음 단계 진입** — `Already up to date`(자기 자신 merge)·`Aborting`·`Everything up-to-date`(behind 라 push 없음) 같은 신호를 성공으로 단정하지 않는다.

### 회귀 사례 — 2026-06-21 030 운영 툴 finish-work·회고 커밋

- finish-work 1단계 `git checkout develop` 이 `develop is already used by worktree at .../031-contact-entrypoints` 로 막혔으나 출력 미확인 → 030 브랜치에 머문 채 `merge`(Already up to date)·`push`(Everything up-to-date) 무효 → develop 에 030 미반영. develop 점유 워크트리에서 `git -C <wt> merge` 로 정상화.
- 회고 커밋 시 `git checkout develop` 이 룰 파일 로컬 변경 충돌로 `Aborting` 됐으나 미확인 → 회고·룰 커밋이 **main 에 오배치**(push 는 무효). main 을 `reset --soft` 로 원복 후 develop 최신본(031 §20 선점) 위에 §21 로 renumber 재적용. 회피 가능 시점: checkout 출력 1줄 확인.

## 메타 — 본 룰의 누적 정책

본 룰은 **회고 회귀 사례에서 도출** 된 항목을 누적한다. 새 항목 추가 절차:

1. `.claude/skills/retrospective/SKILL.md` 흐름대로 회고 작성
2. 회고 §5-2 "룰 갱신 후보" 에 본 룰 (`agent-workflow-discipline.md`) 갱신 후보 명시
3. 사용자 컨펌 후 본 룰에 섹션 추가 — 항목명 + 회피 절차 + 회귀 사례 (일자·작업명·회피 가능했던 시점)

각 섹션은 **회귀 사례 부재 시 추가 금지**. 추측만으로 룰 추가 시 §1 위반.

## 출처 / 인접 룰

- 본 프로젝트 회고: `~/obsidian/write-note/retrospectives/...` (저장 보류 분기 가능)
- 본 프로젝트: [`.claude/skills/retrospective/SKILL.md`](../../skills/retrospective/SKILL.md)
- 글로벌: `~/.claude/rules/shared/subagent-delegation-cost.md`
- 글로벌: `~/.claude/rules/shared/user-interview-quality.md`
- 글로벌: `~/.claude/rules/shared/coding-principles.md` §"추측 금지 (HARD-GATE)"
