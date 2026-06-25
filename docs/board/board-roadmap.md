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
| 마지막 갱신 | 2026-06-25 (트랙 C 코어 완료 — 커밋 `c9857d1`, develop merge 계속 보류) |
| 완료된 트랙 | **A — 연결(Link) UI** ✅ (`d19b879`) · **B — 유비쿼터스 언어 정리** ✅ (`567935e`) · **C 코어 — 진입점·매핑·아이디어 보드** ✅ (`c9857d1`) |
| 진행 중 트랙 | — |
| **다음 진입** | **트랙 D — 카드 종류 정합 + UX 안전망 (§5-D): `brainstorming`부터**(4종 vs 5종 결정 포함). (§4 권장 순서 A→B→C→D) |
| 블로커/대기 | 없음. **develop merge 계속 보류**(D·E 더 모은 뒤 — 사용자 결정 2026-06-25). 038이 develop보다 4커밋 뒤처짐(홈카드·다크모드 등) → merge 시 양방향 병합. 038 브랜치 유지 |
| 직전 세션이 한 일 | **트랙 C 코어(041) 완료**: 매핑 모델 **dual-FK(project_id/category_id)→다형 단일소유(owner_type 'project'/'category'/null + owner_id) + 1:N** 전환(V24 in-place 편집·부분유니크인덱스 제거·CHECK 짝·idx_boards_owner). 다형이라 진짜 FK 상실 → 대상 hard delete 시 보드 owner null 강등(보존)을 ProjectService/CategoryService 훅. BE: `GET /boards/mine`(소속 라벨 작품 title/시리즈 name/"아이디어"·N+1 일괄·최근순) 신규 + `PATCH /{id}/owner`(set/clear, PUT 2개 대체) + POST owner(매핑충돌 409 제거) + `BOARD_OWNER_INVALID`(+)·`BOARD_*_ALREADY_MAPPED`(−). FE: `/boards` 허브 재설계(소속 라벨 칩 **작품=terracotta/시리즈=teal/아이디어=gray + "작품 ·"/"시리즈 ·" 종류 라벨**·클라 검색·생성 picker `BoardOwnerPicker`·나중에 붙이기/소속 변경), `BoardMappingControl` 제거. 로컬 DB 리셋(컨펌)·BE 게이트 GREEN·FE 게이트(test 690)·회귀 grep 0·**dogfooding 6/6**(소속 라벨 종류 구분 fix 포함). SDD=`specs/041-board-entry-points/`, 설계=`docs/board/board-track-c-design.md`. **내부 탭·집필 참조는 범위 밖(후속 ②③)**. 038에 커밋, develop 미merge |

**새 세션 첫 행동**: ① 본 §0 → ② §1 대시보드 → ③ §5 진행 중(또는 다음) 트랙의 체크박스·링크 → ④ CLAUDE.md 의무대로 vault `02-PROGRESS`·`03-ISSUES`.

---

## 1. 진척 대시보드

| 트랙 | 내용 | 상태 | 무게 |
|---|---|---|---|
| **A** | 연결(Link) UI 재개 | ✅ 완료 (커밋 `d19b879`, merge 보류) | FE + BE V26 앵커 |
| **B** | 유비쿼터스 언어 정리 | ✅ 완료 (rename 전면+마이그레이션, develop merge 보류) | 무거움 (마이그레이션+전면 rename) |
| **C 코어** | 진입점·매핑·아이디어 보드 | ✅ 완료 (커밋 `c9857d1`, merge 보류) | 중간 (마이그레이션 + BE 신규 2) |
| **D** | 카드 종류 + UX 안전망 | ⬜ 대기 (← 다음 진입) | 가벼움 |
| **E** | 메모·인물 통합 | 🔴 후순위 (별도 spec) | 최대 |
| **C-2** | 내부 탭(작품/시리즈 상세) · 집필 참조 | ⬜ 후속 (C에서 분리) | 중간 (호스트 UI·에디터 분할) |

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

### 트랙 B — 유비쿼터스 언어 정리  `상태: ✅ 완료 (커밋, develop merge 보류)`
- **목표**: `node/edge/노드/연결/board_nodes` → `Card/Link/카드/잇기/cards` 전면 통일.
- **범위(BE 전면 + FE)**: 테이블 rename 마이그레이션 + 엔티티/repository/service/DTO/controller 경로 + FE 도메인 타입·훅·화면 문구. PRD §8 어댑터 경계(React Flow `node/edge` 는 어댑터 안에서만).
- **⚠️ 트랙 A 완료로 추가된 rename 대상(놓치지 말 것)**: `board_edges.source_handle/target_handle`(V26)·신규 `linkGraph.ts`/`LinkEdge.tsx`/`boardActions.startConnect`·`useCreateEdge`의 sourceHandle/targetHandle·`BoardEdgeResponse`. 트랙 A는 화면 문구만 "카드"로 바꾸고 **코드 식별자(`NodeCard`/`board_nodes`/`useCreateNode` 등)는 `node`로 유지** → 전면 rename은 본 트랙 몫. 연결 UI는 동작 보존(회귀 grep 필수).
- **리스크**: 광범위 rename·마이그레이션 회귀 → **A 안정 후** 진행(A 커밋 `d19b879`, develop 미merge — B와 함께 또는 후속에 merge 결정).
- **진척**:
  - [x] brainstorming/영향범위 조사 (rename 대상 전수) — 결론: **`docs/board/board-track-b-impact-survey.md`**(§0 네이밍 맵·§1 BE·§2 FE 인벤토리·§3 확정 결정). brainstorming 4결정(in-place 마이그레이션 / FE 이름만 통일 / bare Card·Link / boards 불변) 사용자 승인
  - [x] spec/plan/tasks — `specs/040-board-ubiquitous-language/`(spec·plan·research·data-model·contracts/board-api·tasks). NEEDS_CLARIFICATION 0
  - [x] 구현 (BE 선행 → FE) — BE: 마이그레이션 V24~26 in-place(`cards`/`links`+`source_card_id`/`target_card_id`+제약·인덱스명)·엔티티 `Card`/`Link`·`CardRepository`/`LinkRepository`·service createCard/createLink·DTO·controller endpoint `/cards`·`/links`·에러 `BOARD_LINK_*`·테스트. 로컬 DB 리셋(보드 3테이블 drop+history 삭제+재마이그레이션, 사용자 컨펌). FE: 데이터계층·`cardKinds`·`CardNode`·`linkGraph`(`neighborCardIds`/`incidentLinkIds`)·캔버스 도메인참조, **RF API 보존**
  - [x] 검증 (게이트 + dogfooding + 회귀 grep) — BE test 536 / FE typecheck·lint0err·test 690·build / 회귀 grep 0(어댑터 밖 node/edge·DB board_nodes/edges·화면문구) / dogfooding 전항 통과
  - [x] 마무리 — **038 커밋, develop merge 보류**(트랙 더 모은 뒤). 회고
- **+ 보드 폴리시(트랙 B 세션 dogfooding 파생, 같은 커밋군)**:
  - [x] 클릭-클릭 연결 앵커 — 두 카드 중심 우세축으로 마주보는 테두리 자동(`linkGraph.nearestHandlePair` TDD, V26 앵커 재사용·신규 BE 0). 드래그 경로는 RF Loose라 기존대로
  - [x] 카드 디자인(Miro 스타일·저채도) — 타입별 **배경 틴트(-50)**+**전체 테두리(-200)**+**선택선/링(-500/-200)**+**핸들(-400)**+**칩(-100)** 타입색 통일, **좌측 스트라이프 제거**(디자인 안티패턴). `cardKinds.ts`+`CardNode.tsx`. 목업 `docs/research/2026-06-25-board-card-bg-mockup.html`(A안=Whisper 채택). 보드 `colorMode=light` 고정이라 다크 변형 불요

### 트랙 C 코어 — 진입점·매핑·아이디어 보드  `상태: ✅ 완료 (커밋 c9857d1, develop merge 보류)`
- **목표**: 매핑 모델 전환 + 전역 허브 + 아이디어 보드·나중에 붙이기 + 전역 생성 picker. (내부 탭·집필 참조는 C-2로 분리)
- **범위(마이그레이션 + BE 신규 2 + FE)**: dual-FK→owner 다형 단일소유+1:N(V24 in-place) / `GET /boards/mine`(소속 라벨·최근순) / `PATCH /{id}/owner`(set/clear) / 아이디어 보드·picker / 검색=클라 필터.
- **PRD 근거**: §5.3·§5.4·§7·§10, UX TASK-4·4B.
- **확정 결정(brainstorming 2026-06-25)**: 데이터 모델 B(owner_type/owner_id 다형 + 1:N) · 스코프 분할(코어만, ②③ 후속) · owner_type='project'/'category' · 대상 삭제 시 owner null 강등 · 검색 클라 필터.
- **진척**:
  - [x] brainstorming — 결론: `docs/board/board-track-c-design.md`(설계 SoT) + 본 절 확정 결정
  - [x] spec/plan/tasks — `specs/041-board-entry-points/`(spec·plan·research·data-model·contracts/board-api·quickstart·tasks·checklists). NEEDS_CLARIFICATION 0
  - [x] 구현 (BE 선행 → FE) — V24 in-place·엔티티/repo/service/DTO/controller/에러코드·삭제 훅 / FE 데이터계층·허브 재설계·picker·BoardMappingControl 제거
  - [x] 검증 — BE 게이트 GREEN(로컬 DB 리셋 후) / FE typecheck·lint0err·test 690·build / 회귀 grep 0 / **dogfooding 6/6**(소속 라벨 작품·시리즈 종류 구분 fix 포함)
  - [x] 마무리 — **038 커밋 `c9857d1`**, develop merge 계속 보류(사용자 결정) + roadmap·vault 갱신 + 회고

### 트랙 C-2 — 내부 탭 + 집필 참조 (C에서 분리)  `상태: ⬜ 후속`
- **목표**: PRD §5.4 ② 작품/시리즈 내부 보드 탭 + ③ 집필 중 보드 참조(분할 뷰).
- **범위·미결**: ② **호스트 UI 결정 필요**(작품 상세=현 집필 화면, 시리즈 상세=/library 드릴인 — 별도 상세 페이지 부재). `GET /boards?ownerType=&ownerId=`(C에서 계약 준비됨) 위. ③ `GET /works/:id/reference-boards`(작품+상위 시리즈, 상위 시리즈=project.categoryId) + **마지막 본 보드 저장소 결정**(localStorage vs 신규 서버 키 — `SettingsService.ALLOWED`는 임의값 불가) + 에디터 분할 뷰(dynamic import 격리).
- **진척**:
  - [ ] brainstorming (호스트 UI·저장소 결정) — 결론 박을 위치: ______
  - [ ] spec/plan/tasks · 구현 · 검증 · 마무리

### 트랙 D — 카드 종류 정합 + UX 안전망  `상태: 🔵 진행 중 (brainstorming 완료, 구현 중)`
- **목표**: 종류 4종 정합 + progressive disclosure + 안전망.
- **범위**: 종류 4종(인물·장소·사건·테마)·기본 무지정·생성 후 칩 부여/재탭 해제 / 한눈에 보기·미니맵 토글. **undo/redo·온보딩 제외**(별도/후순위).
- **PRD 근거**: UX TASK-3·6. PRD §3·§11(2).
- **확정 결정(brainstorming 2026-06-25)**: 4종(plot→event·note 폐기) · 기본 무지정(null) · 생성 후 칩(progressive disclosure) · 무지정 외관=중립 회색(A안) · 칩 위치=카드 우측 세로 플로팅(C안) · 안전망=한눈에 보기 버튼+미니맵 토글(undo/redo 제외). 목업 `docs/research/2026-06-25-board-card-types-mockup.html`.
- **진척**:
  - [x] brainstorming (4종 vs 5종 결정 포함) — 결론: **`docs/board/board-track-d-design.md`**(설계 SoT) + 본 절 확정 결정
  - [x] 설계 문서 — `docs/board/board-track-d-design.md`(색 매핑·BE/FE 변경·종류 전용 경로·검증). speckit 풀과정 대신 경량 설계문서(사용자 "일단 작업하고 결과물 확인")
  - [x] 구현 (BE 선행 → FE) — BE: ALLOWED 4종·`normalizeCardType` nullable(TDD)·종류 전용 `PATCH .../cards/{id}/type`·`Card.type`/`CardResponse.type` nullable·V25 in-place(NOT NULL DEFAULT plot→nullable)·로컬 DB 리셋(컨펌). FE: `cardKinds` 4종+무지정(`UNTYPED_KIND`·`kindOf` TDD)·`CardNode` 우측 칩 트레이/무지정 외관·`+카드` 단일 버튼(무지정 생성)·`setCardType` API/훅/액션·한눈에 보기 버튼·미니맵 토글
  - [x] 검증 (게이트 + 회귀 grep + dogfooding) — BE ktlint·checkstyle·test·build GREEN / FE typecheck·lint0err·test 694·build GREEN / 회귀 grep 0(폐기 plot·note·DEFAULT_*·5종·addMenuOpen, RF nodeTypes 키 'plot'은 어댑터 식별자라 유지) / **dogfooding 전항 통과** + UX 피드백 반영(무지정만 트레이 자동·종류 지정은 배지 클릭·"이건 뭔가요?" 헤더 제거)
  - [ ] 마무리 (finish-work + 회고) — 진행 중(038 커밋·roadmap/vault·회고). develop merge 여부 사용자 확인

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
- **C-2 미결** — ② 내부 탭 호스트 UI(작품/시리즈 상세 페이지 부재) · ③ 집필 참조 `GET /works/:id/reference-boards` + 마지막 본 보드 저장소(localStorage vs 신규 서버 키) + 에디터 분할 뷰.
- **develop merge 보류 중** — 보드 A+B+C 가 038 누적, develop 미반영(D·E 더 모은 뒤 — 사용자 결정). 038이 develop보다 4커밋 뒤처져 merge 시 양방향 병합 주의.
- ✅ 완료(트랙 C): `GET /boards/mine`·`PATCH /{id}/owner` (`?q=`는 클라 필터로 대체, `/works/:id/reference-boards`는 C-2로 이연).
