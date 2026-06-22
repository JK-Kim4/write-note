# 031 출판 방식(종이/웹)·판형·글자크기·웹연속 렌더 + 분량 지표 + 내보내기 개선 — prod 배포까지

- 일자: 2026-06-22
- 워크트리 / 브랜치: write-note(메인) / 031-publish-layout-modes → develop → main
- 관련 커밋: BE `e91de38` / FE `cf85997` / fix `bb89a92` / develop merge `d1030b8` / main 승격 `67ad009`
- 작업 시간: 한 세션(판형 조사부터 prod 배포·vault 갱신까지 연속)

## 1. 무엇을 했는가 (사실)

- **판형 개념 조사** — 웹 검색으로 출판 판형(版型) vs 종이 규격 차이·한국 단행본 표준 조판값(신국판 1면≈원고지 3.5매 앵커)을 출처와 함께 확정.
- **brainstorm → /speckit-specify·plan·tasks·implement** — 031 spec 산출(`specs/031-publish-layout-modes/`). 출판 방식(종이/웹) 분기 + 판형 + 실측 분량 + 웹 연속 렌더로 설계.
- **백엔드**: `Project.layoutMode`(paper/web, V17) + `paperSize` 출판 판형 4종 확장(V18, VARCHAR16·8종 CHECK) + `fontScale` 5단(V19) + 서비스 검증·`ProjectControllerIT`.
- **프론트**: 작품 생성 강제 선택(library) + 집필실 전환 토글; 판형 실측 분량(`geometry.ts` 프리셋·`fontPxFor`·`estimateCharsPerPage`); 글자 크기 5단(US5, dogfooding 중 추가); 웹 연속 렌더(`layout(∞)`·`webPageGeometry`·PageBox 내용높이 분기·좌표계 보존); 분량 지표(`countChars` 실시간 → 우패널 목표 진행률 카드).
- **내보내기 개선**(dogfooding 파생): `@dnd-kit` 챕터 순서 드래그앤드롭, TXT·JSON 형식(`textExport`), 줄노트(lined) 제거, 판형 한글 라벨·"(제목 없음)"·단일 챕터 핸들 숨김.
- **배포**: 3커밋 → develop merge → **BE blue-green 무중단(V17~19 prod DB 적용)** → **FE main→Vercel production** → prod 검증(api 401·flyway success·soseolbi 200) → vault 02-PROGRESS/03-ISSUES 갱신 → 로컬 정리.

## 2. 어떻게 했는가 (접근)

- **추측 금지 철저**: 판형은 웹 조사 + `geometry.ts`/생성흐름/마이그레이션 번호를 Explore agent로 코드 grep 후 확정. 옵션 비교·plan 작성 전에 사실을 박음.
- **brainstorm으로 의도 발굴**: 종이/웹 분기·강제 선택·5단·판형 기본+덮어쓰기 등 핵심 결정을 사용자 인터뷰로 확정(추측 X).
- **가장 불확실한 US3(웹 연속)는 PoC-first**: 위험 3지점(layout 분할/caret 좌표계/geometry 높이) 명시 후 구현, 순수부(layout∞·webPageGeometry) TDD.
- **순수함수 TDD**: geometry 프리셋·fontPxFor·countChars·textExport·reorderByDrag·layout(∞).
- **dogfooding 반복**: 단계마다 사용자가 실환경 확인 → 발견 버그 즉시 수정.
- **배포 BE 선행→FE 후행**: 새 BE가 nullable 필드로 구 FE도 수용 → 무중단 순서 안전.

## 3. 잘 된 점

1) **추측 금지가 설계 정확도를 지킴** — 판형 실측 분량을 "모델 근사(한글 1em 가정)"로 명시하고 dogfooding 보정 전제로 둠. 실제 0.85em임을 사용자 실측("가나다라" 카운트)으로 확인 → geometry 한 곳만 조정 가능한 구조. (근거: 사용자가 글자수를 직접 세어 모델과 대조했고, 캘리브레이션이 한 파일에 모임)
2) **PoC-first가 위험 영역을 1발에 통과** — US3 웹 연속 렌더 dogfooding(연속·캐럿·선택·IME·자동저장) 모두 정상. 좌표계가 단일 페이지(pageIndex=0)로 자연 정합. (근거: 사용자 "1.이어짐 2.종이없음 3.캐럿 잘 4.정상 5.문제없음 6.자동저장됨")
3) **순수함수 TDD가 회귀를 막음** — 게이트 GREEN 유지(test 599), 변경 다수에도 회귀 0.
4) **dogfooding이 실버그를 다수 포착** — mungopan 라벨·빈 챕터 화살표·분량 0자 등 자동 게이트로 못 잡는 UX/표시 버그를 사용자 확인이 잡음.
5) **prod 배포가 깔끔** — BE→FE 순서·무손실 마이그레이션·prod 검증(flyway V17~19 success=t, api 401, soseolbi 200) 모두 확인.

## 4. 어긋난 점

- **분량 지표 stale 버그(내 명백한 결함)** — 처음에 "현재 챕터 **저장된** wordCount"로 분량을 표시 → 사용자 "글 있는데 0글자인데" 멈춤. 측정(편집 중 model)과 표시(저장 wordCount)가 **서로 다른 데이터소스**라 실시간 내용이 반영 안 됨. **회피 가능 시점**: 분량 지표 설계 시 "이 표시값이 실시간이어야 하는가? 그렇다면 저장값(비실시간)이 아니라 편집 model에서 파생해야"를 점검했어야(§9 화면 표시값 출처의 연장).
- **per-keystroke 리렌더 위험을 뒤늦게 인지** — 실시간 글자수 보고를 먼저 구현한 뒤에야 "타이핑마다 부모 setState → 에디터 더블렌더 → 입력 지연" 위험을 깨닫고 400ms 디바운스 추가. **회피 가능 시점**: 자식→부모 고빈도 보고 설계 시 처음부터 디바운스 고려.
- **커밋을 3회 미룸** — Foundational/US1/US2/US5/US3+내보내기까지 GREEN이 크게 누적됐는데, 사용자가 dogfooding 중 새 요청을 계속 줘 커밋을 3번 권했으나 미뤄짐(손실 위험 누적). 사용자 주도라 강제는 불가하나, 더 일찍 "작은 단위 조기 커밋"을 제안했어야.
- **U+2028 테스트 문자 fumbling** — 보이지 않는 소프트 줄바꿈 문자를 테스트에 직접 입력하려다 Edit 매칭 3회 실패 → `String.fromCharCode`/`model.ts` import로 우회. 약간의 시간 낭비.
- **멈춤 신호 다수** — "이건 뭐지?"·"화살표 왜있어?"·"글 있는데 0"·"드래그드롭으로 하면 공수 커?" 등. 대부분 dogfooding 중 UX 불명확/개선요청(생산적)이나, 분량 0자는 내 버그.
- **031 spec 밖 기능 누적** — US5(글자크기)·내보내기 5건이 spec 범위 밖에서 추가됨. 트랜잭션 분기는 그때그때 보고했으나 spec/tasks 문서엔 일부만 반영(02-PROGRESS엔 정리).

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- 집필실의 **분량/카운트 지표는 편집 중 `model`(실시간)에서 파생**한다. 저장 wordCount(자동저장 후 갱신)는 stale라 "글 있는데 0" 회귀를 만든다. 실시간 필요 시 에디터가 셸로 보고(디바운스).
- 자식 에디터→부모 셸 **고빈도 보고는 디바운스 기본**. 부모 setState가 슬롯(renderEditor)을 재호출해 에디터를 더블렌더하므로 입력 지연 위험.
- 긴 dogfooding 세션에서 GREEN이 누적되면 사용자 추가 요청 사이에 **작은 단위 조기 커밋을 먼저 제안**.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 A — 표시 지표는 그것이 반영해야 할 실제 소스에서 파생 (측정/표시 데이터소스 정합)**
- (1) 대상: 프로젝트 `.claude/rules/shared/agent-workflow-discipline.md` (§9 "화면 표시값의 출처" 연장)
- (2) 본문(일반 원칙): "화면의 실시간 지표(분량·카운트·진행률 등)는 **그 값이 반영해야 할 실제 소스에서 파생**한다. '측정 소스(편집 중 상태)'와 '표시 소스(저장값·집계값)'가 다르면 표시가 실제와 어긋난다 — 표시값이 실시간이어야 하는지 먼저 판단하고, 그렇다면 비실시간 저장값을 쓰지 않는다."
- (3) 근거: §4 분량 지표 stale 버그(저장 wordCount → "글 있는데 0").

**후보 B — 자식→부모 고빈도 보고는 디바운스/스로틀 기본 고려**
- (1) 대상: 프로젝트 `.claude/rules/typescript/code-quality.md` (React 섹션)
- (2) 본문(일반 원칙): "자식이 부모로 **고빈도(키 입력·스크롤 등) 콜백 보고**를 할 때, 부모 setState가 자식 트리를 재렌더(특히 슬롯/렌더prop 재호출)하면 입력 지연·과잉 렌더가 생긴다. 고빈도 자식→부모 보고는 **디바운스/스로틀을 기본 적용**하고, 보고 콜백은 안정 참조(setState 세터/useCallback)로 전달한다."
- (3) 근거: §4 per-keystroke 리렌더(실시간 글자수 → 400ms 디바운스).

**후보 C — 긴 세션 GREEN 누적 시 조기 커밋 제안**
- (1) 대상: 프로젝트 `.claude/rules/shared/agent-workflow-discipline.md`
- (2) 본문(일반 원칙): "한 세션에서 GREEN 산출이 크게 누적되는데 사용자가 인접 요청을 이어가면, 요청 사이에 **작은 단위 조기 커밋을 먼저 제안**한다(미커밋 손실 위험). 커밋은 사용자 결정이나, 제안 시점을 미루지 않는다."
- (3) 근거: §4 커밋 3회 미룸.

> ※ U+2028 테스트 입력 fumbling·mungopan 라벨 등은 앱 구현 특정 세부라 룰 승격 제외(§4 기록만).

**사용자 컨펌 전까지 실제 룰 파일 수정 안 함.**
