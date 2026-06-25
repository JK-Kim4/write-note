# 구현 로드맵 — 보드 (Board Implementation Roadmap)

| 항목 | 내용 |
|------|------|
| 문서 상태 | v1.1 (진척 추적 + 세션 핸드오프 구조 반영) |
| 작성일 | 2026-06-25 |
| 함께 보는 문서 | `board-prd.md`(무엇을 — 데이터·API·매핑) · `board-ux-worksheet.md`(어떻게 — 인터랙션·문구) |
| 본 문서의 역할 | **현재 어디까지 + 어떤 순서로 + 다음 무엇** (실행 순서·진척·세션 핸드오프 SoT) |

> **충돌 시 우선순위**: PRD/UX 가 "무엇을 만드는가"의 상위 SoT. 본 문서는 그 위에서 "현재 상태 + 실행 순서 + 진척"을 박는다. 본질 명세가 바뀌면 PRD/UX 를 먼저 고치고 본 문서를 동기화.

---

## 0. 현재 진입점 (Current Entry Point) ⭐ 새 세션은 여기부터

> 세션이 바뀌거나 컨텍스트 compact 가 나도 **이 블록 + §1 대시보드만 읽으면 어디서 이어갈지** 안다.

| | |
|---|---|
| 마지막 갱신 | 2026-06-25 (트랙 A 완료 — 커밋, merge 보류) |
| 완료된 트랙 | **A — 연결(Link) UI** ✅ (커밋 `d19b879`, develop merge 보류) |
| 진행 중 트랙 | — |
| **다음 진입** | **트랙 B — 유비쿼터스 언어 정리 (§5-B): `brainstorming`/영향범위 조사부터**. ⚠️ 트랙 A가 `node` 도메인 용어·V26 앵커 유지 → rename 대상에 포함 |
| 블로커/대기 | 없음 |
| 직전 세션이 한 일 | **트랙 A 완료·커밋 `d19b879`**: SDD 전과정 + FE 구현 + dogfooding 전항 통과. dogfooding 파생 **BE V26 앵커 확장**(floating 폐기, `board_edges.source_handle/target_handle`) + 클릭클릭 **카드 외부 분리 인디케이터**("연결할 카드 고르기"). 게이트 GREEN. **develop merge는 보드 트랙 B~E 후로 보류**. 회고 `~/obsidian/.../2026-06-25-board-link-ui-track-a.md` + 룰 §24(structured 입력)·§25(dogfooding 전항 확인) 추가 |

**새 세션 첫 행동**: ① 본 §0 → ② §1 대시보드 → ③ §5 진행 중(또는 다음) 트랙의 체크박스·링크 → ④ CLAUDE.md 의무대로 vault `02-PROGRESS`·`03-ISSUES`.

---

## 1. 진척 대시보드

| 트랙 | 내용 | 상태 | 무게 |
|---|---|---|---|
| **A** | 연결(Link) UI 재개 | ✅ 완료 (커밋 `d19b879`, merge 보류) | FE + BE V26 앵커 |
| **B** | 유비쿼터스 언어 정리 | ⬜ 대기 | 무거움 (마이그레이션+전면 rename) |
| **C** | 진입점·매핑·아이디어 보드 | ⬜ 대기 | 중간 (BE 신규 3) |
| **D** | 카드 종류 + UX 안전망 | ⬜ 대기 | 가벼움 |
| **E** | 메모·인물 통합 | 🔴 후순위 (별도 spec) | 최대 |

> 상태 범례: ⬜ 대기 · 🔵 진행 중 · ✅ 완료 · 🔴 후순위/보류. 트랙 완료 시 이 표 + §0 + §5 체크박스를 함께 갱신.

---

## 2. 현재 구현 상태 (038, 2026-06-25 기준)

038 `feat: 플롯 보드 — 독립 보드/노드/타입 (연결 UI 보류)` 까지. **백엔드는 완성형, 프론트는 "독립 보드 MVP"**, 화면 결선(연결 UI)만 빠짐.

| 레이어 | 상태 | 비고 |
|---|---|---|
| DB (`boards`/`board_nodes`/`board_edges`, V24·V25) | ✅ | 캡처 메모(`memos`)·인물(`characters`)과 **완전 별개**(무참조) |
| 백엔드 service/controller (보드·노드·엣지 CRUD, 매핑, 뷰포트) | ✅ | `BoardController` 14 endpoint, 엣지 검증(중복 409·자기연결 400) |
| 백엔드 테스트 (`BoardServiceTest`/`BoardControllerIT`) | ✅ | 엣지 케이스 포함 GREEN |
| FE 보드 목록/생성/이름변경/삭제/매핑 | ✅ | `/boards` 단일 목록 |
| FE 캔버스 (노드 생성·편집·드래그·뷰포트 영속, 종류 5종 색상) | ✅ | React Flow v12 |
| FE 엣지 API·훅·하이드레이션 (`createEdge`/`deleteEdge`/`useCreateEdge`/`useDeleteEdge`/`BoardDetail.edges`) | ✅ | 데이터·계약 살아있음 |
| **FE 연결 화면 결선** (`onConnect`·`Handle`·엣지 렌더·백링크 패널) | ❌ | `nodesConnectable={false}`, "어디서 잇나" 미확정으로 제거 |

> **연결 UI 보류 = 기술 문제 아님.** BE·훅·하이드레이션까지 구현됨, 화면 인터랙션 한 겹만 제거. 회고(`2026-06-25-038-plot-board.md`): *"백엔드 보존됐으니 FE만 재구성, 단 '어디서 잇나' UX 먼저 확정"*.

---

## 3. PRD v0.2 와의 갭

| 축 | PRD v0.2 | 현재 | 성격 |
|---|---|---|---|
| 연결(Link) | 최우선. 잇기+빈곳생성+클릭클릭+백링크 | 캔버스 결선만 ❌ | 증분(가벼움) |
| 유비쿼터스 언어 | `Card/Link`, 화면 기술용어 금지 | 코드·화면 `노드/연결/board_nodes` | 증분(전면 rename) |
| 진입점 3곳 | 전역 허브(라벨·검색)·내부 탭·집필 참조 | `/boards` 단일 목록만 | 증분(BE 신규 3) |
| 아이디어 보드 | owner=null "아이디어" 라벨·나중에 붙이기 | 데이터상 가능, UX 라벨/검색 ❌ | 증분 |
| 카드 종류 | 4종(인물/장소/사건/테마), 선택 후에만 묻기 | 5종(plot=사건흡수·character·place·theme·note), 생성 시 강제 선택, 변경 UI 없음 | 증분(UX 차이) |
| 메모·인물 통합 | 두 메뉴 폐기→보드 Card 흡수 | **정반대 — 완전 별개** | 🔴 데이터 재설계 |

### 메모·인물 통합이 "그냥 이관" 불가인 이유 (데이터 충돌)

| | 메모(memos) | 인물(characters) | 보드 노드(board_nodes) |
|---|---|---|---|
| 소속 | user 글로벌, 작품과 **M:N**(`memo_projects`) | 작품 종속 **1:N** | **1보드 전속** |
| 본문 | `body` 평문 + `tags[]` | 구조화 필드(name·age·gender·traits·notes) | `body` 평문만 |
| 정체성 | **iOS 캡처**(source·captured_at), soft-delete·복구 | 작품별 인물 카드 | 플롯 설계 노드 |

→ 메모의 **M:N·캡처 정체성·soft-delete·iOS 경로**, 인물의 **구조화 필드** 가 노드 "1보드 전속 + body 평문" 에 그대로 안 들어간다. **038 의 "독립 보드" 는 이 충돌을 발견한 의도적 회피**. 통합은 메뉴 흡수가 아니라 **도메인 데이터 모델 재설계** 선행.

---

## 4. 확정 결정 (2026-06-25)

1. **트랙 순서** — A → B → C → D 증분, **E(메모·인물 통합)는 후순위**.
2. **메모·인물 통합 운영 원칙** — 기본 후순위. 단 A~D 진행 중 유비쿼터스 언어·개념이 메모·인물과 **불가피하게 충돌하는 지점**이 생기면 그 지점에 한해 **이번 범위에서 폐기까지 포함**해 정리. 충돌 없으면 손대지 않음.
   - ⚠️ 메모·인물은 **iOS 캡처 경로·집필실 패널·곁쪽지 복구** 가 살아있어, 폐기가 실제 트리거되면 **구체 범위(메뉴 숨김 / 라우트 제거 / 데이터까지)는 충돌 발생 시점에 재확인** 후 진행. 충돌 추정만으로 데이터·캡처 경로 제거 금지.
3. **유비쿼터스 언어 범위** — **테이블명까지 일괄 적용**. `board_nodes`→`cards`, `board_edges`→`links`, 엔티티·repository·service·DTO·API 경로·FE 전부 + 마이그레이션.

---

## 5. 작업 트랙 (각 트랙 = 독립 세션 단위)

> 각 트랙 진척 체크박스를 단계 완료 시마다 `[x]` 로 갱신하고, brainstorming/설계 결론은 **링크된 파일**(`specs/` 또는 본 문서 부록)에 박는다 — 대화에만 두지 않는다.

### 트랙 A — 연결(Link) UI 재개 🥇  `상태: ✅ 완료 (커밋 d19b879, develop merge 보류)`
- **목표**: 보류된 연결 UI 복원. BE·훅 그대로, FE 캔버스 결선만.
- **범위(FE only)**: `NodeCard` 연결점(`Handle`) + `PlotBoardCanvas` `useEdgesState`·`edges` 렌더·`nodesConnectable={true}`·`onConnect`(→`useCreateEdge`)·엣지 삭제(→`useDeleteEdge`) + PRD `TASK-2` UX(hover 단서·드래그 피드백·빈 곳 drop "새 카드 만들어 잇기"·클릭-클릭 대체).
- **PRD 근거**: `board-ux-worksheet.md` TASK-2.
- **확정 결정(brainstorming 2026-06-25)**: ① **무방향 선**(화살표·source/target 구분 없음, RF `ConnectionMode.Loose`. 단 BE는 A→B·B→A 별개 허용 → FE가 "이미 이어진 쌍(양방향)·자기연결" 선제 차단). ② **이웃 하이라이트**(별도 백링크 패널 없음 — 선택 카드의 이웃 node/edge 강조·나머지 dim).
- **실측 확정(재개 전 확인 완료)**: `useCreateEdge`/`useDeleteEdge` = 순수 mutationFn, **낙관/롤백·캐시무효화 없음**(노드 훅은 `onSettled: invalidate list` 함). 제거분 = `nodesConnectable={false}`·`useEdgesState`/`edges`/`onConnect` 없음·`Handle` 미노출. BE 엣지: 자기연결 400·타보드/없는노드 400·정확순서쌍 중복 409·relation_type 없음.
- **진척**:
  - [x] brainstorming (연결 인터랙션 요구사항 확정) — 결론: `specs/039-board-link-ui/spec.md`(US1 잇기·US2 끊기·US3 이웃강조) + 본 절 확정 결정
  - [x] spec — `specs/039-board-link-ui/spec.md`(NEEDS_CLARIFICATION 0, 끊기=hover ✕·빈곳drop=확인모달 default)
  - [x] plan — `specs/039-board-link-ui/plan.md`(+research·data-model·contracts·quickstart). RF v12 연결 API 설치본 타입 직접검증, 변경/신규 파일·순수헬퍼 시그니처 확정
  - [x] tasks — `specs/039-board-link-ui/tasks.md`(25 task: Setup/Foundational/US1 잇기·US2 끊기·US3 이웃/Polish, 순수헬퍼 TDD + 캔버스=dogfooding 게이트)
  - [x] 구현 (FE, TDD) — linkGraph(TDD 13)·LinkEdge·PlotBoardCanvas 결선·NodeCard Handle. 화면문구 노드→카드. **+ dogfooding 파생 BE V26 앵커 확장**(테두리 고정 영속, floating 폐기)
  - [x] 검증 — **자동 게이트 GREEN**(FE typecheck·lint 0err·test 685·build / BE ktlint·test) + **dogfooding 전항 통과**(테두리 앵커·이웃강조·재진입 유지·끊기·빈곳·클릭클릭 인디케이터·가드·회귀)
  - [x] 마무리 — **커밋 `d19b879`**(038-memo-plot-board). **develop merge 보류**(보드 트랙 B~E 후) + 회고

### 트랙 B — 유비쿼터스 언어 정리  `상태: ⬜ 대기 (← 다음 진입)`
- **목표**: `node/edge/노드/연결/board_nodes` → `Card/Link/카드/잇기/cards` 전면 통일.
- **범위(BE 전면 + FE)**: 테이블 rename 마이그레이션 + 엔티티/repository/service/DTO/controller 경로 + FE 도메인 타입·훅·화면 문구. PRD §8 어댑터 경계(React Flow `node/edge` 는 어댑터 안에서만).
- **⚠️ 트랙 A 완료로 추가된 rename 대상(놓치지 말 것)**: `board_edges.source_handle/target_handle`(V26)·신규 `linkGraph.ts`/`LinkEdge.tsx`/`boardActions.startConnect`·`useCreateEdge`의 sourceHandle/targetHandle·`BoardEdgeResponse`. 트랙 A는 화면 문구만 "카드"로 바꾸고 **코드 식별자(`NodeCard`/`board_nodes`/`useCreateNode` 등)는 `node`로 유지** → 전면 rename은 본 트랙 몫. 연결 UI는 동작 보존(회귀 grep 필수).
- **리스크**: 광범위 rename·마이그레이션 회귀 → **A 안정 후** 진행(A 커밋 `d19b879`, develop 미merge — B와 함께 또는 후속에 merge 결정).
- **진척**:
  - [ ] brainstorming/영향범위 조사 (rename 대상 전수) — 결론 박을 위치: ______
  - [ ] spec/plan/tasks
  - [ ] 구현 (BE 선행 → FE)
  - [ ] 검증 (게이트 + dogfooding + 회귀 grep)
  - [ ] 마무리 (finish-work + 회고)

### 트랙 C — 진입점·매핑·아이디어 보드 고도화  `상태: ⬜ 대기`
- **목표**: PRD §5.4 세 진입점 + 아이디어 보드 UX.
- **범위(BE 신규 3 + FE)**: 전역 허브(소속 라벨·`?q=` 검색) / 작품·시리즈 진입점(T043) / 집필 참조(`GET /works/:id/reference-boards` + 마지막 본 보드 기억) / 아이디어 보드 라벨·나중에 붙이기.
- **PRD 근거**: §5.3·§5.4·§9·§10, UX TASK-4·4B·5.
- **진척**:
  - [ ] brainstorming — 결론 박을 위치: ______
  - [ ] spec/plan/tasks
  - [ ] 구현 (BE 선행 → FE)
  - [ ] 검증 (게이트 + dogfooding)
  - [ ] 마무리 (finish-work + 회고)

### 트랙 D — 카드 종류 정합 + UX 안전망  `상태: ⬜ 대기`
- **목표**: 종류 progressive disclosure + 안전망.
- **범위**: 생성 시 안 묻고 선택 후 칩 + 종류 변경 UI / 한눈에 보기·undo·redo·온보딩. **결정 보류**: PRD 4종 vs 현재 5종 정합.
- **PRD 근거**: UX TASK-3·6·7.
- **진척**:
  - [ ] brainstorming (4종 vs 5종 결정 포함) — 결론 박을 위치: ______
  - [ ] (필요시) spec/plan/tasks
  - [ ] 구현
  - [ ] 검증 (게이트 + dogfooding)
  - [ ] 마무리 (finish-work + 회고)

### 트랙 E — 메모·인물 통합 🔴  `상태: 후순위 (별도 spec)`
- **선행 결정(데이터 모델)**: ① 완전 통합(메모·인물 폐기, M:N·캡처 손실 감수) ② 부분 통합(인물만 카드로) ③ 참조 통합(데이터 유지, "가져오기"로 카드화) ④ 보류(독립 유지).
- **진척**:
  - [ ] 데이터 모델 결정 (①~④, 사용자 컨펌) — 결론 박을 위치: ______
  - [ ] 별도 spec/plan/tasks
  - [ ] (이후 구현·검증·마무리)

---

## 6. 작업 워크플로우 + 세션 핸드오프 프로토콜

### 6-1. 트랙 단위 increment (전체 일괄 X)

```
트랙 N → brainstorming(요구사항·결정 지점 확정)
       → SDD spec/plan/tasks (BE 변경/마이그레이션 동반 시. FE-only 소규모는 경량화)
       → 구현: BE 선행 GREEN → 배포(컨펌) → FE 후행
       → 검증: 게이트(ktlint/test/build) + dogfooding(authed)
       → finish-work(merge·배포·vault 갱신) + 회고
       → 트랙 N+1
```
**전체 일괄 비권장**: (1) 조기 dogfooding 으로 "어디서 잇나" 류 미확정 조기 차단(§10) (2) 트랙마다 배포 단위 다름(A=FE only / B=마이그레이션+BE / C=BE 신규) (3) B 전면 rename 은 A 안정 후라야 회귀 적음.

### 6-2. 세션 핸드오프 프로토콜 (compact·세션 전환 대비)

> 진척·결정·요구사항은 **대화가 아니라 파일**(본 로드맵 + `specs/` + vault)에 박는다. compact 가 날리는 건 대화 맥락이지 디스크 산출물이 아니다.

**세션 시작 (복원)**
1. 본 문서 §0 "현재 진입점" → 다음 할 일 파악
2. §1 대시보드 → 전체 진척 한눈에
3. 진행 중(또는 다음) 트랙 §5 체크박스 + 링크된 산출물(brainstorm/spec 결론) 읽기
4. CLAUDE.md 의무대로 vault `02-PROGRESS`·`03-ISSUES` 읽기

**세션 종료 / 단계 완료 (영속화)**
1. §5 완료 단계 체크박스 `[x]` 갱신 + 트랙 상태 아이콘(§1) 갱신
2. §0 "현재 진입점" 갱신 (완료 트랙·진행 중·다음 진입·블로커·직전 세션 한 일)
3. brainstorming 결론·설계 결정은 `specs/` 또는 본 문서에 박기 (해당 체크박스의 "결론 박을 위치" 링크 채우기)
4. 트랙 완료 시 finish-work(merge·배포·vault) + 회고

---

## 7. 후속/미해결

- **E 데이터 모델 결정** — 메모·인물 통합 방식 ①~④ (E 진입 시).
- **카드 종류 4 vs 5** — PRD 4종 vs 현재 5종 정합 (트랙 D brainstorming).
- **BE 신규 엔드포인트** — `GET /boards/mine`(또는 `/boards` 확장)·`GET /works/:id/reference-boards`·`?q=` (트랙 C).
