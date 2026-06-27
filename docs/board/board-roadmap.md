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
| 마지막 갱신 | 2026-06-27 (**보드 "끌어서 잇기" 코치마크(045) + 집필 인라인 보드 편집·열고닫기(046) 완료** — dogfooding 통과, develop merge. **ISSUE-051 완전 종료**. ux-mockup 스킬 신설) |
| 완료된 트랙 | **A — 연결(Link) UI** ✅ (`d19b879`) · **B — 유비쿼터스 언어 정리** ✅ (`567935e`) · **C 코어 — 진입점·매핑·아이디어 보드** ✅ (`c9857d1`) · **D — 카드 종류 4종 정합 + UX 안전망** ✅ (`5909456`) · **C-2 — 내부 탭 + 집필 참조** ✅ (042 `c7a3c88` · 043 `976c4dd`/`02b9b62`) · **E 1단계 — 보드 중심 전환(메모·인물 UI 폐기)** ✅ (`048f22e`) · **TASK-1 — 카드 만들기 UX 보완(044)** ✅ · **045 — "끌어서 잇기" 코치마크(TASK-2/7 잔여)** ✅ · **046 — 집필 인라인 보드 편집·열고닫기** ✅ (ISSUE-051 완전 종료) |
| 진행 중 트랙 | — (보드 코어 A~E1 + TASK-1 + 045 코치마크 + 046 인라인 오버레이 완료) |
| **다음 진입** | **E 2단계 가져오기**(메모·인물→보드 카드 복제, 비파괴 ③ 참조통합 권고, **D1~D6 사용자 결정이 게이트**, 설계 `board-track-e-design-draft.md`). 코치마크(045)·인라인 오버레이(046)·**ISSUE-051 잔여 완료**. ⚠️ **번호 정정**: 045=코치마크, 046=인라인 오버레이(경량 설계문서 `board-writing-inline-overlay-design.md`) → **E 가져오기 = `specs/047` 후보** |
| 블로커/대기 | 없음. 045+046 **develop merge**(함께). **main 승격 미실행**(사용자 결정 대기 — 보드 A~E1·044·045·046 누적). E 데이터 모델 D1~D6은 사용자 결정 대기. **delete-race fix는 공용 PlotBoardCanvas 변경**(메인 페이지 회귀 dogfooding 통과) |
| 직전 세션이 한 일 | **보드 "끌어서 잇기" 코치마크(045) + 집필 인라인 보드 편집·열고닫기(046) — brainstorming(목업)→구현→dogfooding**: **(045)** 처음 어느 카드든 연결점에 커서 올리면 그 점에서 "끌어서 잇기" 1회(localStorage 1회성, 매 hover는 연결점만). 자체 코치마크(driver.js 아님 — 튜토리얼벽·다크함정 회피), `boardCoachmark`(seen)·`linkHintPlacement`(앵커→방향) 순수 TDD + `CardNode` Handle onMouseEnter/Leave 결선(hover 시점 hasSeenLinkHint 확인=전역 1회). 문서 모순 화해(룰28): worksheet TASK-7 vs 핸드오프 TASK-2 → 첫 진입 1회 통합. "이건 뭔가요?"(처음 선택 종류 안내)=사용자 결정 제거. **ISSUE-051 잔여(TASK-2 힌트·TASK-7) 종료**. **(046)** 집필 화면 보드 목록 "열기"의 완전 이탈(`router.push`)→이미 있던 인라인 참조 패널(`BoardReferencePanel`=편집 가능 캔버스)로 통일 + 열고/닫기 다듬기(`InlineBoardList` onOpenBoard·`BStudioShell` 토글·active·`BoardReferencePanel` 슬라이드·투명 바깥클릭·⤢ 넓게·↗ 전체화면). 디자인=**인터랙티브 목업으로 잠금**(사용자 승인)→경량 설계문서. **dogfooding 버그픽스 2**: (a) 인라인 편집 후 재오픈 유실=`useBoardDetail`을 항상 마운트 부모서 호출→same-board 재오픈 시 refetchOnMount 미발동·stale 재시드 → detail+캔버스를 열림따라 마운트되는 자식 `BoardReferenceCanvas`로 분리(재오픈마다 fresh refetch). (b) 연결카드 삭제 간헐 거짓 "연결 끊기 실패"=RF가 deleteCard+deleteLink 동시 발화, 백엔드 FK CASCADE가 링크 이미 정리→프론트 deleteLink 중복·racy → 삭제중 카드 id ref + onEdgesDelete 마이크로태스크 지연으로 cascade 연결선 deleteLink 생략(공용 `PlotBoardCanvas`, 메인 페이지 회귀 dogfooding 통과). **ux-mockup 스킬 신설**(`.claude/skills/ux-mockup/` — UX·인터랙션 결정은 글 대신 인터랙티브 목업, 세부는 직접 판단). 게이트 GREEN(typecheck·lint0err·**test 727**·build)·**사용자 dogfooding 전항 통과**. **이전: TASK-1 카드 만들기 UX 보완(044) — speckit 사이클 + dogfooding + 버그픽스**(ISSUE-051 해소): 빈 보드(카드 0개) 진입 시 캔버스(격자·툴바) 유지한 채 **중앙 안내 오버레이**(`BoardEmptyGuide`, "여기에 첫 카드를 적어보세요"+버튼, 사용자 피드백으로 흰 화면 takeover→투명 오버레이 정정) + **빈 곳 더블클릭→그 자리 생성**(RF 12 onPaneDoubleClick 부재→wrapper onDoubleClick+isPaneHit pane 한정, zoomOnDoubleClick=false) + 세 경로 공통 `createCardAt`+**생성 직후 자동 편집**(autoEditCardId, onSuccess 실제 id 확정 후) + 빈 카드 즉시저장·잔존(사용자 결정). **카드 선택 시 '삭제' 버튼 추가**(연결할 카드 고르기 옆, deleteElements 재사용). **버그픽스**: 연결된 카드 삭제 시 RF가 엣지 onEdgesDelete도 발화→백엔드 cascade로 사라진 링크 중복삭제 404→거짓 "연결 끊기 실패" 토스트 → `isNotFoundError` 멱등 처리로 제거(키보드 Backspace 기존 버그도 해소). FE only(BE 0)·038 FR-005 모순 정정 동반. 게이트 GREEN(lint0err·typecheck·**test 716**·build)·FE/BE 런타임로그 에러0·DB 고아링크0·**사용자 dogfooding 빈보드 안내 확정**. speckit `specs/044-board-card-creation-ux/`. **이전: develop merge(PR #74 MERGED) + 기획 vs 구현 GAP 분석 + TASK-1 핸드오프**: 보드 A~E1을 develop에 merge(양방향 충돌 9파일 해소 — 홈 `page.tsx`=develop 작품카드/다크모드+044 보드패널 / `BStudioShell`·`BWorkSidePanel`=다크모드토큰+044구조 / `memos`·`characters`·`BMemoStrip`=삭제유지 / `CLAUDE.md` union·룰 §24/25 유지+develop §26/27 재번호 / 신규 보드 컴포넌트 다크모드 토큰화; 게이트 FE test 707·BE build GREEN). **GAP 분석**(`docs/research/2026-06-26-board-spec-vs-impl-gap.html`): PRD/UX worksheet↔코드 전수 대조(✅5/⚠️3/❌4/⏸5) — 미회수 잔여=TASK-1 ②③(빈 보드 안내·빈곳 더블클릭 생성)·TASK-7·TASK-2 hover 힌트; 원인=로드맵 §3 갭분석이 UX TASK 단위 미카탈로그+"TASK-1 잔여" 추적주인 부재+038 FR-005 모순. → ISSUE-051 등재 + 핸드오프 `docs/board/2026-06-26-task1-card-creation-handoff.md`. **이전: E 1단계 = 044 보드 중심 전환**(사용자 대화로 결정): 메모·인물 앱 내 UI 전부 폐기 → 보드가 이야기 요소의 유일한 자리. **데이터·스키마·iOS 캡처(`POST /api/capture`)·BE 컨트롤러/서비스 보존(비파괴, 복원 가능)**. 홈 우측 메모 패널→보드 패널(신규 `BBoardStrip`), 집필실 `BWorkSidePanel` 메모·인물 탭 폐기→보드 단일, nav 메모·인물 폐기, `/memos`·`/characters` 라우트 삭제+redirect, ⌘+N 메모 캡처 폐기, 온보딩 메모·인물 단계→보드 단계. 고아 컴포넌트 삭제(BMemoStrip·QuickCapture·QuickCaptureModal·LinkPopover). 게이트 GREEN(typecheck·lint0err·test 704·build)·**서브에이전트 전수조사로 메모·인물 도달 경로 0 확인**·**사용자 dogfooding 통과("작동 잘 됨")**. 커밋 `048f22e`. "가져오기"는 E 2단계(후속). 죽은 FE 모듈 5(useMemos·useCharacters·api/memo·api/characters·memoView)는 가져오기 재사용 위해 보존. 설계=`docs/superpowers/specs/2026-06-26-board-centric-shift-design.md`. **이전: C-2(내부 탭 + 집필 참조) 완료 + E 비파괴 초안**(야간 자동 진행). **042 내부 탭**(FE only, BE=0): 별도 작품/시리즈 상세 페이지 부재(실측) → 작품 상세=집필 화면 `BWorkSidePanel` "보드" 탭, 시리즈 상세=`/library` 드릴인 "시리즈 보드" 섹션. owner picker 없이 이름만 생성(owner 자동) + 열기(→/boards/{id}). 신규 `InlineBoardList`(View 테스트 5). **043 집필 참조**(BE 선행→FE): `GET /api/boards/reference?projectId=`(작품 보드 + 상위 시리즈 보드 최근순, BoardServiceTest 3 + IT 2) + FE 집필 좌패널 "보드 참조" 토글 → 우측 슬라이드오버(`PlotBoardCanvas` dynamic·후보 전환·last-viewed localStorage·집필 3패널 무변경). 마지막 본 보드는 `SettingsService.ALLOWED` 값 화이트리스트라 임의 boardId 불가 → localStorage(비파괴). 게이트 BE(ktlint·checkstyle·test·build) / FE(typecheck·lint0err·test 703·build) GREEN·회귀 grep clean. **authed dogfooding = 2026-06-26 사용자 로컬 풀스택 통과("잘 작동")** — 자동 진행 시점엔 로그인 불가였으나 풀스택 기동 후 확인. **E**=메모·인물 통합 비파괴 설계 초안(충돌 정리·4 옵션·D1~D6 결정지점·③ 참조통합 권고) — **코드/스키마/캡처 경로 무변경**(가드 3). 설계 SoT=`docs/board/board-track-c2-design.md`·`board-track-e-design-draft.md`. 보고서=`docs/research/2026-06-26-overnight-autorun-report.html` |

**새 세션 첫 행동**: ① 본 §0 → ② §1 대시보드 → ③ §5 진행 중(또는 다음) 트랙의 체크박스·링크 → ④ CLAUDE.md 의무대로 vault `02-PROGRESS`·`03-ISSUES`.

---

## 1. 진척 대시보드

| 트랙 | 내용 | 상태 | 무게 |
|---|---|---|---|
| **A** | 연결(Link) UI 재개 | ✅ 완료 (커밋 `d19b879`, merge 보류) | FE + BE V26 앵커 |
| **B** | 유비쿼터스 언어 정리 | ✅ 완료 (rename 전면+마이그레이션, develop merge 보류) | 무거움 (마이그레이션+전면 rename) |
| **C 코어** | 진입점·매핑·아이디어 보드 | ✅ 완료 (커밋 `c9857d1`, merge 보류) | 중간 (마이그레이션 + BE 신규 2) |
| **D** | 카드 종류 4종 + UX 안전망 | ✅ 완료 (커밋 `5909456`, merge 보류) | 가벼움 (BE 종류모델 + FE 칩·안전망) |
| **C-2** | 내부 탭(작품/시리즈 상세) · 집필 참조 | ✅ 완료 (042 `c7a3c88` · 043 `976c4dd`/`02b9b62`, merge 보류) | 중간 (FE 탭/섹션 + BE reference-boards + 슬라이드오버) |
| **E 1단계** | 보드 중심 전환(메모·인물 UI 폐기) | ✅ 완료 (`048f22e`, dogfooding 통과) | 큼 (FE 전면 제거 + 홈 보드 패널) |
| **TASK-1 UX** | 카드 만들기 UX 보완(빈 보드 안내·빈곳 더블클릭 생성·자동 편집·삭제 버튼) | ✅ 완료 (044, develop merge) | 작음 (FE only, BE 0) |
| **045 코치마크** | "끌어서 잇기" 첫-진입 코치마크(TASK-2/7 잔여) | ✅ 완료 (045, **ISSUE-051 종료**) | 작음 (FE only) |
| **046 인라인 오버레이** | 집필 인라인 보드 편집 + 오버레이 열고/닫기 다듬기 | ✅ 완료 (046, dogfooding 통과) | 작음 (FE only + 공용 캔버스 fix 2) |
| **E 2단계** | 가져오기(메모·인물 → 보드 카드 복제) | ⬜ 후속 (`specs/047` 후보) | 중간 (BE import endpoint + FE) |

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

### 트랙 C-2 — 내부 탭 + 집필 참조 (C에서 분리)  `상태: ✅ 완료 (042 c7a3c88 · 043 976c4dd/02b9b62, merge 보류)`
- **목표**: PRD §5.4 ② 작품/시리즈 내부 보드 탭 + ③ 집필 중 보드 참조(분할 뷰).
- **확정 결정(야간 자동 — 코드 실측 기반)**: ② **호스트 UI** = 별도 작품/시리즈 상세 페이지 부재(실측 — 라우트 /library·/works/[id]·/boards뿐) → 작품 상세=집필 화면 `BWorkSidePanel` "보드" 탭, 시리즈 상세=/library 드릴인 "시리즈 보드" 섹션. `GET /boards?ownerType=&ownerId=`(041 계약) 재사용 → 042 BE=0. ③ **마지막 본 보드 저장소** = localStorage(`SettingsService.ALLOWED`가 값 화이트리스트라 임의 boardId 서버 키 불가 — 실측 확정, 비파괴 기본값). `GET /api/boards/reference?projectId=`(작품 보드 + 상위 시리즈, 상위=project.categoryId) 신규. 분할 뷰=우측 슬라이드오버(overlay, 집필 3패널 flex 무변경 — 회귀 위험 ↓). 설계 SoT=`docs/board/board-track-c2-design.md`.
- **진척**:
  - [x] 결정 (호스트 UI·저장소) — 결론: `docs/board/board-track-c2-design.md` §0 실측표·§1·§2
  - [x] 042 내부 탭 (FE only, BE=0) — `specs/042-board-internal-tabs/`. `InlineBoardList`(View 테스트 5)·BWorkSidePanel 보드 탭·LibraryBoard 시리즈 보드 섹션. 게이트 GREEN(typecheck·lint0err·test 699·build·회귀 clean). 커밋 `c7a3c88`
  - [x] 043 집필 참조 (BE 선행→FE) — `specs/043-board-writing-reference/`. BE: `listReferenceBoards`·`GET /reference`(BoardServiceTest 3 + IT 2). FE: `lastViewedBoard`(TDD 4)·`useReferenceBoards`·`BoardReferencePanel` 슬라이드오버·BStudioShell 토글. 게이트 GREEN(BE ktlint·checkstyle·test·build / FE typecheck·lint0err·test 703·build·회귀 clean). 커밋 `976c4dd`(BE)·`02b9b62`(FE)
  - [x] 검증 — 자동 게이트 전항 GREEN + 회귀 grep clean. **authed dogfooding = 2026-06-26 사용자 로컬 풀스택 통과("잘 작동")**(집필실 보드 탭·시리즈 보드 섹션·생성→이동·참조 슬라이드오버). 자동 진행 시점엔 로그인 불가였으나 풀스택(DB·BE 8080·FE 3000) 기동 후 확인
  - [x] 마무리 — 038 커밋(develop merge 보류) + roadmap/vault 갱신 + HTML 보고서

### 트랙 D — 카드 종류 정합 + UX 안전망  `상태: ✅ 완료 (커밋 5909456, develop merge 보류)`
- **목표**: 종류 4종 정합 + progressive disclosure + 안전망.
- **범위**: 종류 4종(인물·장소·사건·테마)·기본 무지정·생성 후 칩 부여/재탭 해제 / 한눈에 보기·미니맵 토글. **undo/redo·온보딩 제외**(별도/후순위).
- **PRD 근거**: UX TASK-3·6. PRD §3·§11(2).
- **확정 결정(brainstorming 2026-06-25)**: 4종(plot→event·note 폐기) · 기본 무지정(null) · 생성 후 칩(progressive disclosure) · 무지정 외관=중립 회색(A안) · 칩 위치=카드 우측 세로 플로팅(C안) · 안전망=한눈에 보기 버튼+미니맵 토글(undo/redo 제외). 목업 `docs/research/2026-06-25-board-card-types-mockup.html`.
- **진척**:
  - [x] brainstorming (4종 vs 5종 결정 포함) — 결론: **`docs/board/board-track-d-design.md`**(설계 SoT) + 본 절 확정 결정
  - [x] 설계 문서 — `docs/board/board-track-d-design.md`(색 매핑·BE/FE 변경·종류 전용 경로·검증). speckit 풀과정 대신 경량 설계문서(사용자 "일단 작업하고 결과물 확인")
  - [x] 구현 (BE 선행 → FE) — BE: ALLOWED 4종·`normalizeCardType` nullable(TDD)·종류 전용 `PATCH .../cards/{id}/type`·`Card.type`/`CardResponse.type` nullable·V25 in-place(NOT NULL DEFAULT plot→nullable)·로컬 DB 리셋(컨펌). FE: `cardKinds` 4종+무지정(`UNTYPED_KIND`·`kindOf` TDD)·`CardNode` 우측 칩 트레이/무지정 외관·`+카드` 단일 버튼(무지정 생성)·`setCardType` API/훅/액션·한눈에 보기 버튼·미니맵 토글
  - [x] 검증 (게이트 + 회귀 grep + dogfooding) — BE ktlint·checkstyle·test·build GREEN / FE typecheck·lint0err·test 694·build GREEN / 회귀 grep 0(폐기 plot·note·DEFAULT_*·5종·addMenuOpen, RF nodeTypes 키 'plot'은 어댑터 식별자라 유지) / **dogfooding 전항 통과** + UX 피드백 반영(무지정만 트레이 자동·종류 지정은 배지 클릭·"이건 뭔가요?" 헤더 제거)
  - [x] 마무리 — **038 커밋 `5909456`**, develop merge 계속 보류(사용자 결정 2026-06-26) + roadmap §0/§1/§5 + vault 02-PROGRESS 갱신 + 회고

### 트랙 E — 메모·인물 통합  `상태: 1단계 완료(044 보드 중심 전환, 048f22e) · 2단계(가져오기) 후속`

- **확정(사용자 대화 2026-06-26)**: 완전 보드 중심 — 메모·인물 앱 내 UI 전부 폐기(메뉴·라우트·홈 패널·집필실 탭·⌘+N), **데이터·스키마·iOS 캡처·BE 보존**(비파괴). 홈 우측=보드 패널(`BBoardStrip`). 가져오기는 2단계. 설계 SoT=`docs/superpowers/specs/2026-06-26-board-centric-shift-design.md`. 게이트 GREEN(test 704)·전수조사 도달경로 0·dogfooding 통과.
- **2단계(가져오기, 후속 `specs/045`)**: 기존 메모·인물(DB 보존) → 보드 카드 복제. BE import 조회/생성 endpoint + FE "가져오기" UI. 죽은 FE 모듈(useMemos·useCharacters·api/memo·api/characters·memoView)은 이때 재사용.

- **선행 결정(데이터 모델)**: ① 완전 통합(메모·인물 폐기, M:N·캡처 손실 감수) ② 부분 통합(인물만 카드로) ③ 참조 통합(데이터 유지, "가져오기"로 카드화) ④ 보류(독립 유지).
- **비파괴 초안(야간 자동 — 코드/스키마 무변경)**: `docs/board/board-track-e-design-draft.md`. 충돌 본질(메모 M:N·캡처 정체성·soft-delete / 인물 구조화 필드 / 카드 1보드전속·평문 — 실측 확정) + 4 옵션 비파괴 분석 + **데이터 모델 결정 지점 D1~D6** + **③ 참조 통합 권고**(비파괴, 마이그레이션 0, 되돌리기=가져온 카드 삭제). ①②는 파괴적이라 자동 진행 금지 영역.
- **진척**:
  - [x] 데이터 모델 충돌 정리 + 4 옵션 + 결정 지점(D1~D6) — 결론: `docs/board/board-track-e-design-draft.md`. **③ 권고 / ④ 보류 안전**
  - [ ] **데이터 모델 D1~D6 사용자 결정** (③ 채택 시 D2 복제 vs 링크 등) — 사용자 컨펌 대기
  - [ ] (결정 후) 별도 spec — ③=`specs/045-board-import-from-memo-character/`(비파괴, 추가 only; ⚠️ 044는 TASK-1이 사용 → 045) / ①②=파괴적이라 마이그레이션·백필·롤백 설계. 핸드오프 `docs/board/2026-06-27-next-session-handoff.md`
  - [ ] (이후 구현·검증·마무리)

### 트랙 TASK-1 보완 — 카드 만들기 UX (044)  `상태: ✅ 완료 (develop merge, ISSUE-051 해소)`
- **목표**: 기획 vs 구현 GAP 분석에서 드러난 board-ux-worksheet **TASK-1 ②③** 미회수 잔여 회수(빈 보드 안내·빈 곳 더블클릭 생성) + 038 FR-005 모순 정정.
- **범위(FE only, BE 0)**: 기존 카드 생성(`POST /api/boards/{id}/cards`)·본문 편집 재사용. 변경 = `PlotBoardCanvas`·`CardNode`·`boardActions` + 신규 `BoardEmptyGuide`·`boardCanvasHelpers`.
- **확정 결정(brainstorming 2026-06-27)**: ① 빈 카드도 즉시 저장·잔존(worksheet "본문 없이 벗어나면 카드 안 남음" 대체) ② 범위=TASK-1만(TASK-2 hover 힌트·TASK-7 코치마크는 ISSUE-051 잔여로 분리) ③ 038 FR-005 직접 정정 + 044 supersede ④ (dogfooding 피드백) 빈 보드 안내는 **보드를 가리는 별도 페이지가 아니라 캔버스 위 투명 오버레이**.
- **진척**:
  - [x] brainstorming (저장 시점·범위·FR-005 화해 확정) — 핸드오프 `docs/board/2026-06-26-task1-card-creation-handoff.md`
  - [x] spec/plan/tasks — `specs/044-board-card-creation-ux/`(NEEDS_CLARIFICATION 0, React Flow 12 API 설치본 실측: onPaneDoubleClick 부재·zoomOnDoubleClick·screenToFlowPosition·pane class)
  - [x] 구현 (FE, TDD) — `BoardEmptyGuide`·빈곳 더블클릭(isPaneHit TDD)·`createCardAt` 통합·autoEdit(실제 id 확정 후)·삭제 버튼(deleteElements). 빈보드 안내 투명 오버레이 정정
  - [x] 검증 — 게이트 GREEN(lint0err·typecheck·**test 716**·build) + FE/BE 런타임로그 에러0 + DB 고아링크0 + **사용자 dogfooding 빈보드 안내 확정**
  - [x] 버그픽스 — 연결된 카드 삭제 거짓 "연결 끊기 실패"(RF onEdgesDelete↔백엔드 cascade 404) → `isNotFoundError` 멱등(TDD 4). 키보드 Backspace 기존 버그도 해소
  - [x] 마무리 — develop merge + roadmap/vault 갱신 + 회고. **잔여=TASK-2 hover 힌트·TASK-7 코치마크(ISSUE-051, 별도 트랙 → `specs/046` 후보, 다음 세션 트랙 2)**. 핸드오프 `docs/board/2026-06-27-next-session-handoff.md`

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

- **E 데이터 모델 결정** — 메모·인물 통합 방식 ①~④ + D1~D6(비파괴 초안 `board-track-e-design-draft.md` 권고 = ③ 참조 통합). **사용자 결정 대기**.
- ✅ **C-2 authed dogfooding 통과**(2026-06-26 사용자 로컬 풀스택 "잘 작동") — 042 보드 탭·시리즈 섹션·생성→이동 / 043 참조 슬라이드오버. 자동 진행 시점 미검증분 해소(전 마이크로 항목 개별 확인은 사용자 판단).
- ✅ **develop merge 완료** — 보드 A~E1(PR #74) + TASK-1 UX 보완(044) 모두 develop 반영. **main 승격(production 배포)만 사용자 결정 대기.**
- ✅ **완료(TASK-1 044)** — 빈 보드 안내(투명 오버레이)·빈 곳 더블클릭 생성·생성 직후 자동 편집·카드 삭제 버튼·연결카드 삭제 거짓에러 버그픽스.
- ✅ **완료(045 코치마크 — ISSUE-051 완전 종료)** — TASK-2 hover "끌어서 잇기" 텍스트 힌트·TASK-7 첫 진입 코치마크를 **첫-진입 1회 코치마크 하나로 통합**(커서 올라간 연결점에서, localStorage 1회성). "이건 뭔가요?"는 사용자 결정 제거. 자체 코치마크(driver.js 아님). 설계 `board-link-coachmark-design.md`.
- ✅ **완료(046 집필 인라인 보드 편집·열고닫기)** — 집필 보드 목록 "열기"의 완전 이탈→인라인 오버레이(편집 가능) 통일 + 토글·active·슬라이드·✕/ESC/투명 바깥클릭·⤢ 넓게·↗ 전체화면. **dogfooding 버그픽스 2**: (a) 재오픈 유실(detail 자식 분리 refetch) (b) 연결카드 삭제 거짓토스트(중복 link 삭제 레이스 제거, 공용 `PlotBoardCanvas`). 디자인=인터랙티브 목업 잠금→경량 설계문서 `board-writing-inline-overlay-design.md`. **ux-mockup 스킬 신설**.
- ⬜ **E 가져오기 = `specs/047`**(번호 정정: 045=코치마크·046=인라인 오버레이가 선점). 설계 `board-track-e-design-draft.md`(③ 참조통합 권고), D1~D6 사용자 결정 대기.
- ✅ 완료(트랙 C-2): `GET /api/boards/reference?projectId=`(작품+상위 시리즈, `/works/:id/...`는 코드베이스 API 베이스 `/api/boards`로 정합) · 내부 탭 호스트 UI(작품=집필 화면 탭·시리즈=라이브러리 섹션) · 마지막 본 보드=localStorage.
- ✅ 완료(트랙 D): 카드 종류 4 vs 5 정합(4종+무지정).
- ✅ 완료(트랙 C): `GET /boards/mine`·`PATCH /{id}/owner` (`?q=`는 클라 필터로 대체).
