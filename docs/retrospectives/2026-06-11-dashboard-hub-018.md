# 018 대시보드 허브 — 설계 4판 진화 + dogfooding 버그 3건

- 일자: 2026-06-11
- 워크트리 / 브랜치: write-note / `feat/studio-three-panel`
- 관련 커밋: `ada67d9`(US1) → `c64a745`(work-session 멱등화), 18개 커밋. origin push 완료
- 작업 시간 (대략): 1 세션 (브레인스토밍 → speckit 풀파이프 → 그래프 재설계 → dogfooding fix)

## 1. 무엇을 했는가 (사실)

- **대시보드 허브 설계 4판 진화**: v1(백엔드0 재진입 허브) → v2(작업시간 문자열 추가) → v3(백엔드 확장: 카드 집계+기간 합계) → **v4(집필 리듬 그래프·2단 배치)**. 각 판마다 사용자 결정으로 분기.
- **speckit 풀파이프 2회전**: v3에서 specify→plan→tasks→analyze→implement 완주(Phase 1~9, T001~T042), v4에서 spec/tasks 증분(Phase 10, T043~T051).
- **백엔드 확장 2종**(읽기, 스키마 변경 0): `GET /api/projects/cards`(활성 작품+글자수·문서저장시각·누적시간 3쿼리 일괄) + `GET /api/work-sessions/total?from=&to=`(작품 횡단 기간 합계, projects join). TDD 단위+IT.
- **프론트**: 대시보드 page(2단), `dashboardView`(selectDashboard·formatRelativeTime·startOfWeekMonday·weekDayRanges·barScale), `RhythmCard`·`ResumeCard`·`WorkMiniCard`, `useWeeklyByDay`, `listCards` 재편(카드 endpoint+문서 N병렬), Rail "홈" 신설, 벽 → `/library` 이동.
- **PRODUCT.md 원칙 4 완화**: 작업 리듬 인디케이터 허용(게이미피케이션은 배제 유지).
- **dogfooding 버그 3건 fix**: ① 그리드 blowout(무공백 장문 토큰) ② 마지막 문장 문단경계 손실(`extractPlainText` join('')→블록 \n 보존)+`…` 인디케이터 ③ work-session 409 멱등화(ISSUE-028 해결).
- **목업 4종**(`dashboard-reentry-hub`·`time-graph`(A)·`time-graph-b`(B)·HTML 시각화) + 설계 HTML 리포트.
- vault 동기(017·018·ISSUE-028·029), origin push.

## 2. 어떻게 했는가 (접근)

- **브레인스토밍 잔여 결정만** 이어받아 design doc → speckit. 핸드오프가 "내용 A 확정"을 박아둬서 내용 재질문 없이 데이터 매핑·라우팅 영향만 확정.
- **코드 사실 우선**: 매 결정 전 grep/Read로 검증 — `listCards` placeholder, `AuthMeResponse`에 이름 없음, `WorkSession`에 userId 없음(작품 경유), `useSearchParams` Suspense 전례 등. 추측 표 송출 전 확인.
- **TDD 일관**: 순수함수 → shim → 컴포넌트 → page 순. 백엔드는 서비스 단위 → 컨트롤러 IT. 모든 RED를 먼저 확인 후 GREEN.
- **시각 검증**: 실제 `desktop-app.css` 링크한 정적 HTML을 headless Chrome로 라이트/다크 스크린샷 → 직접 확인.
- **버그는 systematic-debugging**: 멱등화 건은 코드 Read + DB SELECT(읽기)로 "race 확정·DB 안 깨짐"을 관찰로 확정한 뒤 수정.

## 3. 잘 된 점

1) **설계 4판 분기를 매번 사용자 결정으로 닫음** — 근거: v1→v2(시간 인디케이터)·v3(백엔드 범위)·v4(그래프 형태) 전부 AskUserQuestion으로 본질 결정을 받고 진행. 추측으로 범위를 키우지 않음.
2) **백엔드 확장이 스키마 변경 0** — 근거: 기존 projects·documents·work_sessions의 읽기 집계만. `WorkSession`에 userId 없음을 Read로 확인하고 projects join으로 해결, 기존 endpoint 불변(IT 회귀 단언).
3) **버그 3건 모두 근본 원인을 관찰로 확정 후 수정** — 근거: blowout(grid min-content)·문단경계(`collectText` join)·race(DB SELECT로 rollback 확인). 추측 수정 반복 없음.
4) **회귀 안전성을 사용처 grep으로 사전 검증** — 근거: `extractPlainText`에 \n 추가 전, 자수 계산(`manuscript`는 공백 제거)·wordCount(별도 경로) 사용처를 grep해 영향 0 확인 후 수정.
5) **게이트 일관 GREEN** — 프론트 vitest 103→156, 백엔드 전체 게이트, 매 Phase Checkpoint에서 확인.

## 4. 어긋난 점

- **사용자 멈춤·재방향 신호 다수**(설계가 4판으로 늘어난 직접 원인):
  - "총 작업 시간 인디케이터는 왜 없어?" → 내가 v1에서 효율 지표를 통째로 제외하며 **누적 총시간(데이터 있음·백엔드0 가능)까지 같이 잘랐음**. streak·게이지(백엔드 필요)와 총시간(기존 endpoint로 가능)을 구분하지 않은 과잉 제외. → v2 분기.
  - "백엔드 작업 범위 포함해서 재작성, 이전 파일 폐기" → 내가 "백엔드 변경 0"을 제약으로 고수해 **기간 지표를 누적 총시간으로 격하**했는데, 사용자 의도("연속 작업 유도")엔 기간 지표가 더 맞았음. → v3 전면 재생성(spec/plan 폐기).
  - "그래프 형태로", "이런 형태로 배치"(목업 2장) → 문자열 표시를 그래프로, 1단을 2단으로. → v4.
  - "목업 보여줘야지 뭐해" → 스크린샷만 Read하고 **브라우저로 안 열어줬음**. 사용자가 직접 보려는데 파일 경로만 인지하고 `open`을 빠뜨림.
- **dogfooding에서야 표면화된 버그 3건** — 자동화 게이트(vitest·build)로 안 잡힘. 특히:
  - 그리드 blowout: v4 시각 검증을 "공백 있는 정상 문장" 목업으로만 해서 무공백 장문 토큰 경로가 발화 안 함. → 사용자 실데이터에서 터짐.
  - 마지막 문장 문단경계: `extractPlainText`를 018에서 "마지막 문장 파생용"으로 재사용하면서 006의 잠재 버그(join(''))를 물려받음. 설계 단계에서 "lastSentence가 문단 경계에 의존"을 인지 못 함.
- **회피 가능했던 시점**:
  - 총시간 제외: v1 설계 시 "효율 지표"를 한 덩어리로 자르지 말고 **데이터 출처별(백엔드 필요 vs 기존 endpoint)로 분류**했어야. 사용자가 묻기 전에 "누적 총시간은 백엔드0으로 가능"을 옵션으로 제시했어야.
  - 목업 안 열어줌: "목업 보여줘" 요청 = 시각 산출물은 **브라우저로 열어 보여주는 것**이 기본. 스크린샷 Read는 내 확인용이지 사용자에게 보여주는 게 아님.
  - blowout: 시각 검증 매트릭스에 "병적 입력(무공백 장문)"을 dogfooding 전 1회 포함했어야(한국어 keep-all 전역 환경에서 특히).

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1) **효율/지표성 요소를 제외할 때 "데이터 출처별"로 분류**: 백엔드 신규 필요(streak·목표·기간집계) vs 기존 endpoint로 가능(누적 총시간)을 구분해, 후자는 제외 결정 전 옵션으로 surfacing. 한 덩어리 "효율 지표 제외"는 사용자 의도와 어긋날 수 있음.
2) **`extractPlainText` 같은 다용도 파생 유틸을 새 용도로 재사용할 때, 그 용도의 전제(문단 경계·공백 등)를 설계 단계에서 명시 검증**. 006 자수용은 join('')이 OK였지만 018 마지막문장용은 \n 필요.
3) **시각 검증 매트릭스에 "병적 입력" 1열 포함**: 무공백 장문 토큰·초장문·빈 값. 한국어 `word-break: keep-all` 전역에서 grid blowout이 정상 데이터로는 안 잡힘.
4) **"목업/시각 보여줘" 요청은 브라우저 `open`이 기본 응답**. 스크린샷 Read는 내 확인용. 사용자가 보려는 건 실제 렌더.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 A — 시각 산출물 제시 = 브라우저 open**
- (1) 대상: `.claude/rules/typescript/code-quality.md` §"한국어 영역 검증 cadence" 인접 또는 신규 §"시각 산출물 제시"
- (2) 본문: "사용자가 '목업/시안/화면 보여줘'를 요청하면 스크린샷 Read(내 확인용)에 그치지 말고 `open <파일>`로 브라우저에 띄운다. 시각 산출물의 SoT는 실제 렌더."
- (3) 근거: §4 "목업 보여줘야지 뭐해" — 스크린샷만 Read하고 open 누락.

**후보 B — 다용도 파생 유틸 재사용 시 전제 검증**
- (1) 대상: `.claude/rules/typescript/code-quality.md` §"공용 fetch 래퍼 status 분기" 인접(다용도 재사용 함정)
- (2) 본문: "기존 파생 유틸(`extractPlainText` 등)을 새 용도로 재사용할 때, 그 용도가 의존하는 전제(문단 경계·공백·정렬 등)를 사용처 grep으로 검증한다. 자수용 join('')이 마지막문장용 \n 부재로 표면화된 사례."
- (3) 근거: §4 마지막 문장 문단경계 손실(006 잠재 버그를 018에서 물려받음).

**후보 C — 시각 검증 매트릭스에 병적 입력 포함**
- (1) 대상: `.claude/rules/typescript/code-quality.md` §"한국어 영역 검증 cadence"
- (2) 본문: "UI 시각 검증 시 정상 데이터뿐 아니라 병적 입력(무공백 장문 토큰·초장문·빈 값) 1열을 포함한다. `word-break: keep-all` 전역에서 grid `1fr` blowout은 정상 데이터로 안 잡힌다(minmax(0,1fr)+min-width:0+overflow-wrap:anywhere)."
- (3) 근거: §4 그리드 blowout — 정상 문장 목업으로만 검증해 무공백 토큰 경로 미발화.

**후보 D — 효율/지표 제외 시 데이터 출처별 분류**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` §9(화면 표시값 출처) 인접 또는 신규 항목
- (2) 본문: "제품 원칙으로 지표성 요소를 제외할 때, '백엔드 신규 필요' vs '기존 데이터로 가능'을 구분해 후자는 제외 결정 전 옵션으로 surfacing한다. 한 덩어리 제외는 사용자 의도와 어긋날 수 있다."
- (3) 근거: §4 누적 총시간 제외(v1) → 사용자 "왜 없어?" → v2 분기.

**사용자 컨펌 전까지 실제 룰 파일 수정하지 않음.**
