# 자체 에디터 한글 IME 유실 fix + 홈 집필 리듬 막대 렌더 fix·호버 개선

- 일자: 2026-06-20
- 워크트리 / 브랜치: write-note (메인) / develop
- 관련 커밋: `3889d3f`(IME fix), `26191b7`(막대 렌더 fix), `f4211b3`(호버 툴팁)
- 작업 시간 (대략): 오후 (3개 트랙 연속)

## 1. 무엇을 했는가 (사실)

1) **자체 에디터 빠른 한글 조합 시 캐럿 뒤 글자 유실 버그 fix** (`3889d3f`)
   - 증상: 기존 내용 앞에 캐럿을 두고 한글을 빠르게 치면 조합 위치 뒤 글자가 사라짐.
   - 근본원인: `CustomEditor.tsx` `onTextUpdate` 가 `pre = modelRef.current` 로 버퍼를 읽는데, `modelRef.current` 는 렌더 시점에만 갱신(`:437`). 빠른 조합은 리렌더 커밋 전 `textupdate` 연속 발화 → 2번째 이벤트가 stale 버퍼에 EditContext 의 최신 `rangeEnd` 적용 → `insertText` 의 `slice(hi)` 가 조합 위치 뒤 실제 글자를 절단.
   - 수정: `onTextUpdate` 에서 `next` 를 `modelRef.current` 에 동기 반영(1줄) → 같은 프레임 다음 이벤트가 fresh 버퍼를 읽음.
   - 검증: 두 `textupdate` 를 한 `act()` 안에서 연속 발화하는 회귀 테스트 추가(RED `하존내용` → GREEN `하기존내용`). 로컬 풀스택 띄워 사용자 직접 입력 dogfooding 확인.

2) **홈 "집필 리듬(이번 주)" 막대 안 보임 버그 fix** (`26191b7`)
   - 증상: 오늘 게이지(3h44m)는 정상인데 주간 차트 막대가 전혀 안 보이고 요일 라벨만 보임.
   - 근본원인: 막대 `height:%` 가 직접 부모 `flex flex-col` 칼럼에 해석되는데, 바깥 컨테이너 `items-end` 탓에 칼럼이 `h-24`(96px)로 stretch 안 됨 → auto 높이 → 퍼센트 높이가 definite 부모를 못 찾아 0 으로 붕괴.
   - 수정: 게이지(`BTodayGauge`)와 동일한 검증된 패턴으로 — `relative h-24`(definite) 트랙 + `absolute inset-x-0 bottom-0` 막대.

3) **막대 호버 시 그날 작업시간 표시 개선** (`f4211b3`)
   - `group-hover` 다크 툴팁 + `title` 폴백. 포맷은 기존 `formatDuration`(progress.ts) 재사용("N시간 M분" / 0이면 "기록 없음").

- 각 트랙 모두 develop 직접 커밋·push 후 `vercel --prod` 프론트 재배포(백엔드 변경 0). 작업 종료 시 로컬 풀스택(docker Postgres + 백엔드 + 프론트) 정리.

## 2. 어떻게 했는가 (접근)

- 두 버그 모두 **systematic-debugging** 적용 — 수정 전 근본원인 조사 우선.
- IME 버그: 데이터 흐름(EditContext 버퍼 ↔ model 버퍼) 추적 → stale ref 지점 코드로 확정 → jsdom 에서 `FakeEditContext` stub + 한 `act()` 안 연속 발화로 경합 결정론적 재현.
- 막대 버그: "게이지(정상) vs 막대(버그)가 **같은 `dayMs[todayIndex]` 를 쓰는데 한쪽만 깨짐**" 모순을 잡고, 데이터 레이어(barScale NaN 가설)를 백엔드 코드(`rangeTotalDurationMs: Long`, 빈 구간 `0L`)로 반증 → 렌더 레이어로 이동 → 게이지의 작동 패턴(relative+absolute)과 막대 패턴(in-flow+auto 부모)을 비교해 CSS 퍼센트 높이 붕괴로 확정.
- 배포: FE-only 변경임을 매번 확인하고 백엔드 재배포 생략(불필요·OCI 수동). 베이스 정합(`git log HEAD..origin/develop`)을 작업·배포 전 점검(§18).

## 3. 잘 된 점

1) **근본원인 → 수정 순서 준수** — 두 버그 모두 추측 수정 0회, 근본원인 확정 후 1회 수정으로 GREEN. (IME: 회귀 테스트 RED→GREEN, 막대: 게이지 비교로 메커니즘 증명)
2) **반증된 가설을 버림(§11 준수)** — 막대 버그에서 NaN 가설을 백엔드 코드로 반증하자 그 레이어를 폐기하고 렌더로 이동. 같은 증상을 다른 데이터 가설로 반복 수정하지 않음.
3) **검증 한계 정직 표기** — CSS 픽셀은 jsdom·Playwright 부재로 제가 직접 관찰 못 함을 매번 명시하고 dogfooding 게이트로 위임. 사용자가 "잘 보인다"/"호버 잘 나온다"로 실재 surface 확인(§16 충족).
4) **기존 자산 재사용** — `formatDuration`(progress.ts) 툴팁에 재사용, 막대 수정도 코드베이스에 이미 있는 게이지 패턴 차용(신규 추상화 0).

## 4. 어긋난 점

- 사용자 멈춤 신호("잠깐만"/"왜 ~?") **0회**. 3트랙 모두 사용자가 결과를 직접 확인하고 진행.
- **막대 버그에서 NaN 가설을 2~3라운드 끌었다** — `barScale` 의 `Math.max(0, undefined)=NaN` 경로를 두고 "어떤 칸이 undefined 일 수 있나"를 useSessions → electron-api → apiFetch 순으로 여러 번 추론한 뒤에야 백엔드를 읽어 반증. **회피 가능했던 시점**: 첫 스크린샷 판독 시점에 이미 "게이지가 같은 데이터로 정상 표시" 신호가 있었음 → 정상 형제 뷰(게이지)와 버그 뷰(막대)의 렌더 방식을 **먼저 비교**했다면 데이터 가설 라운드를 건너뛰고 CSS 레이어로 직행 가능했다.
- **CSS 시각은 자기검증 불가** — Playwright 미설치로 막대 높이/호버 툴팁을 제가 관찰 못 하고 매번 사용자 dogfooding 에 의존. 낭비는 아니었으나(사용자가 즉시 확인 가능한 surface) 자율 검증 능력의 공백.
- 반복 디버깅(같은 에러 3+ 재시도) 없음. 토큰 낭비성 subagent 위임 없음(전 작업 직접 수행).

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1) **CSS 퍼센트 높이는 definite-높이 부모를 요구** — 막대·게이지 류 height-% 채움은 `relative` + definite 높이(`h-24` 등) 부모 + `absolute bottom-0` 패턴(=`BTodayGauge`)을 표준으로 쓴다. `flex items-end` 안의 in-flow 자식에 height-% 를 주면 부모가 auto 높이라 0 으로 붕괴한다.
2) **`formatDuration`(progress.ts)** = ms→한국어("기록 없음"/"N시간 M분") 표준 포맷터. 작업시간 표시는 이걸 재사용(게이지의 초 단위 `formatTodayDuration` 과 구분).
3) **자체 에디터 `onTextUpdate` 는 한 프레임에 연속 발화 가능** — model 갱신을 렌더(`modelRef.current=model`)에만 의존하면 빠른 IME 조합에서 stale. 동기 ref 반영 필요. (회귀 테스트: 한 `act()` 안 연속 `textupdate`.)

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — 공유 데이터 이중 표시에서 정상 형제 뷰를 reference 로 레이어 좁히기**

- (1) 갱신 대상: 프로젝트 `.claude/rules/shared/agent-workflow-discipline.md` (§11 "관찰로 레이어 확정"의 보강) — 또는 §11 본문에 1줄 추가.
- (2) 룰 본문(일반 원칙):
  > 두 화면 요소가 **같은 데이터 소스**를 공유하는데 하나만 정상이면, 결함은 공유 데이터가 아니라 **분기 이후(렌더/스타일/포맷) 레이어**다. 데이터 가설을 추론으로 여러 라운드 파기 전에, **정상 형제 뷰의 작동 방식과 버그 뷰의 방식을 직접 비교**해 레이어를 먼저 좁힌다.
- (3) 근거 회귀 사례: 본 회고 §4 — 막대 버그에서 게이지가 같은 `dayMs[todayIndex]` 로 정상 표시되는 신호가 처음부터 있었으나, NaN(데이터) 가설을 백엔드 반증까지 2~3라운드 끈 뒤에야 CSS 로 이동. 게이지 vs 막대 렌더 비교를 먼저 했다면 직행 가능.
- self-check(이식성): 공유-데이터 이중표시는 특정 앱 무관 일반 구조(대시보드/리스트/요약 등) → 포괄 원칙으로 적합. ✅

> 후보는 §11(관찰로 레이어 확정)의 정신과 정합하며, "정상 형제를 reference 로 쓴다"는 실행 단계를 추가하는 보강. 사용자 컨펌 시 §11 에 1줄 추가 형태로 반영 제안.
