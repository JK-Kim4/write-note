# Research: 보드 "끌어서 잇기" 첫-진입 코치마크

모든 결정은 brainstorming(2026-06-27, 사용자 승인)에서 확정. 본 문서는 그 결정과 **실측 근거**를 record.

## R1. React Flow `Handle` 이 어느 연결점에 커서가 올라갔는지 감지 가능한가 (실측)

- **Decision**: 각 `<Handle>` 에 `onMouseEnter`/`onMouseLeave` 를 직접 부착해 `hoveredHandle`(top/right/bottom/left)을 추적한다.
- **Rationale (실측, 추측 아님)**: `@xyflow/react@12.11.1` 타입 정의
  ```ts
  // node_modules/@xyflow/react/dist/esm/components/Handle/index.d.ts
  type HandleProps = HandlePropsSystem & Omit<HTMLAttributes<HTMLDivElement>, 'id'> & { onConnect?: OnConnect }
  ```
  → `Handle` 은 `id` 만 빼고 표준 div 속성 전부 forward → `onMouseEnter`/`onMouseLeave` 가용. 연결 드래그는 pointerdown 기반이라 mouseenter/leave hover 감지와 무충돌. 라벨 `pointer-events-none` 으로 드래그/클릭 방해 0.
- **Alternatives considered**:
  - 순수 CSS per-handle group(`group/handle`) — 1회성 게이팅에 JS(localStorage) 가 어차피 필요해 이점 적음. JS hover 상태로 통일.
  - 카드 hover 시 커서 최근접 핸들 자동 표시 — 사용자 결정 "커서가 올라간 그 점에서" 와 어긋남(기각).

## R2. 노출 메커니즘 — 자체(custom) vs driver.js

- **Decision**: **자체 코치마크**(CardNode 내부 라벨). driver.js 재사용 안 함.
- **Rationale**: (1) driver.js 는 배경 스포트라이트 = worksheet "튜토리얼 벽 금지, 상황형 코치마크만" 과 어긋남. (2) driver.js 는 마운트 시 다단계 투어 도구라 "처음 연결점 hover" 같은 동적 트리거에 부적합. (3) body-append 오버레이라 다크모드 색 함정(ISSUE-046) — 자체 라벨은 보드 light 고정이라 무관.
- **Alternatives**: driver.js 단일 step(배경 끔) — 동적 hover 트리거 결선이 여전히 어색, 이득 없음(기각).

## R3. 영속 — localStorage vs 서버 설정

- **Decision**: **localStorage 단일 플래그**. 키 `writenote.board.coachmark.v1`, shape `{ linkHint?: true }`.
- **Rationale**: 서버 `SettingsService.ALLOWED` 는 **값 화이트리스트**(`onboardingCompleted to setOf("true")` 식)라 임의 키 적재 시 BE 변경+배포 → "FE only" 깨짐. 코치마크 "봤음" 은 가벼운 1회성 값이라 043 `lastViewedBoard`(localStorage) 선례 그대로. 기기별 1회 재노출은 허용.
- **Alternatives**: 서버 settings 키 추가(`boardLinkHintSeen to setOf("true")`) — 기기 간 동기 이점 있으나 BE 변경+배포 비용 > 이득, 본 트랙 FE only 깨짐(기각).

## R4. 범위 — 어느 캔버스에 적용되나

- **Decision**: 공유 캔버스 컴포넌트(`CardNode`)에 박으므로 보드 페이지(`/boards/[id]`) + 집필 참조 패널(`BoardReferencePanel`) **양쪽 자동**. "봤음" 단일 전역 플래그라 어디서 먼저 보든 전체에서 1회.
- **Rationale**: `CardNode` 는 두 렌더처 공통(043). 별도 게이팅 불요. 홈 온보딩(driver.js, `/`)과는 화면·트리거가 달라 독립(상호 게이팅 없음).

## R5. "이건 뭔가요?"(처음 카드 선택 종류 안내) 포함 여부

- **Decision**: **제거**(범위 밖, spec FR-008).
- **Rationale**: 사용자 결정(2026-06-27). 트랙 D 에서 무지정 카드 선택 시 종류 칩 트레이가 이미 자동 노출돼 충분. worksheet TASK-7 두번째 항목의 의도적 축소(룰 28 — 사용자 결정이 worksheet 상위).

## R6. 1회성 표시·해제 동작

- **Decision**: 첫 연결점 hover(`onMouseEnter`) 시 `!hasSeenLinkHint()` 이면 그 점에 라벨 표시 + 즉시 `markLinkHintSeen()`. 라벨은 그 hover 동안만(해당 `<Handle>` `onMouseLeave` 또는 카드 이탈 시 사라짐). seen=true 후 재노출 없음.
- **Rationale**: "1회 후 사라짐"(worksheet) 충족. 즉시 마크라 다른 연결점/카드로 옮겨도 재노출 0. 드래그 시작으로 커서가 점을 벗어나면 라벨 사라짐(이미 마크됨) — 잇기 방해 0.
