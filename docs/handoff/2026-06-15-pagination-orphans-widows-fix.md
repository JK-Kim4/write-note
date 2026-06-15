# 집필 페이지 분할 버그 — orphans/widows + 정수 줄높이 수정 (2026-06-15, /loop 자율 작업)

> 사용자 취침 중 /loop 자율 작업. **확실히 검증되기 전 "해결" 단정 금지** 원칙 준수.

## 사용자 보고 버그
1. 글/커서가 괘선 밖 여백에 (하단 줄 선택 안됨)
2. **홀수 페이지(1,3,5,7)에서 페이지 추가 시 문단이 한꺼번에 다음 장으로 넘어감**
3. (사용자 단서) "집필 페이지를 A4 비율에 맞춘 다음부터 발생"
4. (regression) 집필 페이지 좌우 비대칭 여백 — 직전 내 `zoom→transform` 변경 부작용

## 확정된 근본 원인 (격리 하니스 + 실제 앱 재현)
multicol `column-wrap` 페이지 분할에서:
1. **비정수 줄높이(34.56px=18×1.92)** → 브라우저 device-pixel 스냅으로 줄박스가 커져 `column-height(26×34.56)`에 26줄이 안 들어감(24~25). 페이지마다 24/25로 들쭉날쭉 → 사용자가 "홀수 페이지"로 인지.
2. **CSS `orphans`/`widows` 기본값 2** → 문단의 마지막 1~2줄을 페이지에 남기지 않고 **통째로 다음 장으로 밀어냄**. = "문단이 한꺼번에 넘어감"의 직접 원인. **기하와 무관** → 직전 세션·내 정수화 수정이 이걸 놓쳐 "그대로"였음.

하니스 증거: `line=34.56` → [24,25] / `line=35`(정수만) → [26,25] / **`line=35`+`orphans:1;widows:1` → [26,26]** (모든 페이지 꽉 참 + 문단 줄 단위 분할).

## 수정 (4 파일, multicol·페이지분리 유지 — 재작성 아님)
- `pageLayout.ts`: `LINE_PX 34.56 → 35`(정수)
- `paper-editor.css`(A형): `--page-line 35px`, `line-height: var(--page-line)`, **`orphans:1; widows:1`**
- `b.css`(B형): `--b-page-line 35px`, `line-height: var(--b-page-line)`, **`orphans:1; widows:1`**, `.b-paged-paper` `zoom`→`transform: scale`(+`transform-origin: top left`), `.b-paged-fit` 래퍼 추가
- `BEditor.tsx`: `.b-paged-fit` 래퍼에 축소된 폭·높이(`calc(...*zoom)`) 예약 → 좌우 여백·하단 빈 스크롤 regression 복구

### 왜 B형은 transform 인가
B형 fit-zoom 의 `zoom`은 .ProseMirror 줄높이(정수 35)를 27.08px(비정수)로 다시 깨 under-fill 재발. `transform: scale`은 레이아웃(26줄 계산)을 보존하고 시각만 축소 → 정수 유지. 단 transform 은 레이아웃 박스를 안 줄여 중앙정렬/스크롤이 깨지므로 `.b-paged-fit` 래퍼가 축소 크기를 예약.

## 검증 결과 (실제 Chrome 149, 헤드리스)
| | A형 | B형(사용자 모드) |
|---|---|---|
| 다중문단 페이지별 줄수 | [26,26,26,6] | [26,26,18] |
| 문단 줄 단위 경계 분할 | ✅ (통째 점프 0) | ✅ |
| 중앙 정렬 | ✅ | ✅ leftGap=rightGap=32 |
| 홀수 페이지 포함 결정론적 26 | ✅ (하니스 0~3 전부 26) | ✅ |
| typecheck/test(292)/lint/build | ✅ | ✅ |

## ⚠️ 미검증 — 사용자 확인 필요
- **한글 IME 자모 분해**: puppeteer 가 OS IME 를 안 거쳐 헤드리스 재현 불가. 수정은 IME 처리(`view.composing` 가드)를 안 건드림. **사용자가 B형/A형에서 빠른 한글 타자로 직접 확인 필요.**

## 추가 처리 (Iteration 2, 사용자 추가 보고 대응)
- **"마지막 줄에 괘선 없음"(사용자 image 12)**: 사용자 실제 시나리오(짧은 줄 24개 + 긴 줄) 재현 측정 → `p1Lines=26, spillBelowRuledPx=-5`(마지막 줄 bottom 이 26번째 괘선보다 5px 위 = **아래 괘선 정상 존재, spill 0**). → **orphans/widows+정수 수정이 이 문제도 해결.** image 12 는 수정 로드 전 상태였음. 사용자 제안(마지막 줄에 괘선 추가)은 이미 해결돼 불필요(상시 빈 괘선 추가는 오히려 어색).
- **규격 배지("A4 · 210×297mm") 종이 위로 떠다님(사용자 보고)**: `.b-paper-badge` 가 `position: sticky` 라 스크롤 시 종이 위로 뜸. 좌패널 용지 셀렉터와 중복이므로 **sticky 제거**(static, 스크롤과 함께 사라짐). 검증: scrollTop overlapY=0, scrolled overlapY=0(안 뜸).
- 게이트 재확인: typecheck/292 tests GREEN.

## 추가 처리 (Iteration 3 — 사용자 전략 제안: 백지 기본)
사용자 제안: "괘선을 없애고 백지를 기본 레이아웃으로 — 워드프로세서 기본이 백지고, 향후 글씨크기·목차 등에 유연". **백지엔 정렬할 격자가 없어 괘선 정렬 버그 클래스 자체가 소멸.** 채택(보수적: 백지=기본 + 괘선=옵션 토글 유지, 되돌리기 가능).
- A형 `projects/[id]/write/page.tsx`: `lined` 기본 `true→false`(토글 기존).
- **B형은 괘선 하드코딩(`b-sheet--lined`)이라 토글 없었음** → BEditor 로컬 `lined` state(기본 false) + BPagedBody `lined` prop + 툴바 ☰ 줄노트 토글 추가. 기본 백지.
- 검증(B형, 사용자 모드): 기본 `linedSheets=0`(백지)·[26,26,18]·갭침범0 / 토글ON `linedSheets=3`(괘선 복원)·동일. 스크린샷 `blank-default.png` = 깨끗한 백지 워드프로세서 페이지.
- 게이트: 292 tests + lint + build GREEN.

**중요:** 백지 기본은 **제품 기본값 변경**이라 사용자 최종 확인 필요(되돌리기 쉬움). 괘선 모드도 fix(orphans/widows+정수)되어 옵션으로 정상 동작.

## 미커밋 / 남은 항목
- 아직 커밋 안 함 (사용자 IME 확인 후 커밋 예정)
- 이슈 C(click-fill 빈줄 오염)는 별개 — 이번 수정 범위 아님(다음 반복에서 상호작용 점검 예정)
- 로컬 dev DB 무변경, 스크래치 챕터 모두 정리됨(919=챕터1개)
