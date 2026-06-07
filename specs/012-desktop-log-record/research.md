# Phase 0 Research: Desktop 기록(Log)

본 작업은 **기존 코드베이스 패턴 재사용**이 대부분이라 신규 기술 조사보다 **brief §9 열린 결정** 해소가 핵심이다. 각 결정은 실제 코드(읽기 검증 완료)를 근거로 한다.

## R1. 누적 로그 적재 방식 — 일괄 vs lazy

**Decision**: `listLogCards()` 가 작품별 **최신 기록 메모 1개만**(`latestLog`) 싣고, 아코디언 펼침 시 `logs.listByProject(projectId)` 로 **lazy 조회**한다.

**Rationale**: 카드 리스트 초기 렌더는 최신 1줄만 필요. 누적 전체를 모든 작품에 대해 일괄 적재하면 펼치지 않을 로그까지 직렬화. 작품 수십 개 × 로그 수십 개면 불필요한 payload. lazy 가 기존 `memos.listByProject` 패턴과도 정합.

**Alternatives**: 일괄 적재(`logs: ProjectLog[]` 전부) — 구현은 단순하나 MVP 규모에서도 펼침률 낮은 데이터를 매번 실음. 기각.

## R2. 진척률 100% 초과 표시

**Decision**: 캡 없이 **실제 수치** 표시(예: 112%). 진척 바는 100%에서 시각적으로 채우되 숫자는 실값.

**Rationale**: spec Assumptions 확정 — 작가가 목표 초과를 인지하도록. 캡하면 "목표 달성 후 얼마나 더 썼는지" 정보 손실.

**Alternatives**: 100% 캡 — 정보 손실로 기각.

## R3. "작업 종료" 버튼 위치

**Decision**: 집필 화면(`WriteStudioScreen`)의 **보기/설정 메뉴 또는 Titlebar 우측** 영역. 기존 `WriteStudioScreen` 의 보기 메뉴(테마·자동저장 토글)·Titlebar 패턴과 정합하는 자리에 배치. 구현 시 기존 컨트롤 군집에 합류.

**Rationale**: 집필 흐름을 막지 않는 보조 액션. 본문 영역 침범 회피. 클릭 시 모달(기록 메모)로 전환.

**Alternatives**: 본문 하단 고정 버튼 — 페이지 분할/줄노트 레이아웃과 충돌 위험으로 기각. Rail(좌측 전역 내비) — Rail 은 화면 전환 전용이라 의미 충돌로 기각.

**참고**: 모달 형태는 Phase 5 빠른 메모 캡처 모달 패턴 재사용(textarea + 저장/취소).

## R4. 세션 자동 시작/종료 결선 위치

**Decision**: **`App.tsx` 단일 effect** 에서 `screen`·`activeProject` 를 의존성으로 세션 생명주기를 관리한다.

- effect 진입: `screen === "write" && activeProject` 면 `sessions.start(activeProject.id)`
- effect cleanup(의존성 변화 = 화면 전환·작품 전환): 직전 작품의 `sessions.end(prevProjectId)`
- 앱 닫힘: renderer effect cleanup 은 quit 시 신뢰 불가 → **main 프로세스 `app.on("before-quit")`** 에서 `store.endAllOpenSessions(now)` 로 DB 의 열린 세션 전부 종료
- 앱 시작: `app.whenReady` 에서 Store 초기화 직후 `store.closeDangling()` — 비정상 종료로 남은 열린 세션을 폐기(`ended_at = started_at`)

**Rationale**: `App.tsx` 가 이미 `screen`/`activeProject` 상태와 그에 키된 effect(메모 패널 재조회)를 가짐 → 동일 패턴. 작품 전환은 `activeProject.id` 변화로, 화면 이탈은 `screen !== "write"` 로 cleanup 이 자연 발화. quit 은 renderer 가 못 잡으므로 main 이 DB 레벨에서 마감(렌더러가 어느 세션을 열었는지 main 이 몰라도, DB 의 `ended_at IS NULL` 행을 종료하면 됨).

**Alternatives**: WriteStudioScreen mount/unmount 로 관리 — 화면 전환 외 작품 전환 케이스를 놓치기 쉬움. App 레벨이 단일 진실점.

**검증 의무(구현 시)**: React effect cleanup 이 화면 전환·작품 전환에서 직전 projectId 로 end 를 호출하는지(stale closure 주의 — cleanup 캡처값 사용). 이전 회귀(Phase 6 패널 stale)와 동류 위험.

## R5. 시각(시간) 생성 — 어느 레이어에서

**Decision**: 시각(ISO 문자열)은 **repository/Store(main 프로세스 런타임)** 에서 생성(`new Date().toISOString()`). 기존 repository 들이 `created_at`/`updated_at` 을 자체 생성하는 패턴과 동일.

**Rationale**: 단일 시계 출처(main). renderer 가 시각을 보내면 신뢰성·일관성 저하. duration 계산도 동일 시계.

**Alternatives**: renderer 가 timestamp 전달 — 시계 불일치 위험으로 기각.

## R6. 30초 미만 폐기 — 적용 지점

**Decision**: `WorkSessionRepository.endOpen(projectId, endedAt)` 와 `endAllOpenSessions(endedAt)` 내부에서 종료 직전 `endedAt − started_at < 30s` 면 그 세션 **행 삭제**. 단, **명시 종료(기록 메모 동반)** 경로는 별도 처리 — `endSessionWithLog` 는 짧아도 세션을 보존(작가가 의도적으로 남긴 기록 보호).

**Rationale**: spec FR-015. 자동 종료 경로에만 30s 폐기 적용, 기록 메모가 붙은 명시 종료는 의미 있는 작업으로 간주.

**구현 주의**: `endSessionWithLog` 는 짧은 세션 폐기 로직을 타지 않도록 분기. 30초 경계는 상수(`MIN_SESSION_MS = 30_000`)로 명시.

## R7. 기존 데이터 재사용 경로 검증(읽기 확인 완료)

| 표시값 | 출처 | 검증 |
|---|---|---|
| 현재 글자수 | `documents.word_count` | `Editor.tsx:59` = `text.replace(/\s/g,"").length`(공백 제외 글자수) ✅ |
| 목표 글자수 | `projects.target_length`(nullable) | `schema.ts:20` `target_length INTEGER`(null 허용) ✅ |
| 최근 수정일 | `projects.updated_at` | `store.updateDocument` 가 `projects.touch(projectId)` 호출 ✅ |
| 마지막 문장 | `documents.plain_text` → `lastSentence()` | `src/lib/lastSentence.ts` 존재, 작품 벽 카드 재사용 ✅ |
| 작품/본문 1:1 | `createProjectWithDocument` | 작품 생성 시 document 1개 자동 생성 ✅ |

**결론**: Phase 0 미해결(NEEDS CLARIFICATION) 없음. 모든 열린 결정 해소 완료 → Phase 1 진입 가능.
