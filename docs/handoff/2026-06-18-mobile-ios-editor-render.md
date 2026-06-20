# 핸드오프 — 026 모바일 iOS 에디터 (렌더 잔여)

**작성**: 2026-06-18 / **브랜치**: `026-mobile-editor-support` / **마지막 커밋**: `7882a78`

## 한 줄 요약

iOS(WebKit)에서 자체 에디터 한글 **입력은 완전히 동작**한다(양보불가 핵심 달성). 남은 것은 **iOS 렌더 1건** — 글자가 작게 보이고 줄바꿈이 시각적으로 안 따라오는 문제. 모델(buffer)은 정상이라 `transform:scale` 렌더 구조 문제로 추정. **다음 세션은 iPhone을 Mac에 연결해 Safari 웹 인스펙터로 직접 관찰**하면 추측-배포 반복 없이 원인을 확정할 수 있다.

## 진입 절차 (다음 세션 시작 시)

1. **iPhone ↔ Mac USB 연결 + Safari 웹 인스펙터 활성화**
   - iPhone: 설정 → Safari → 고급 → **웹 속성(웹 인스펙터) 켜기**
   - Mac Safari: 설정 → 고급 → **개발자용 메뉴 표시** 켜기
   - Mac Safari 메뉴 → **개발자용 → [iPhone] → PoC 페이지** 선택 → 실제 DOM/스타일/콘솔 직접 검사
2. **PoC 라우트 배포** — `cd frontend && vercel deploy --yes` → 나온 Preview URL + `/poc/mobile-editor` 를 iPhone Safari로 접속
   - (Vercel 프로젝트 링크됨: `write-note`, `.vercel/project.json`)
3. 웹 인스펙터에서 **확인할 것** (아래 "미해결 디버깅 가이드" 참조)

## 확정 해결된 것 (실기기 dogfooding으로 원인 확정)

| 항목 | 원인 (확정) | 해결 |
|---|---|---|
| **iOS 한글 입력** | iOS는 한글 조합을 `compositionstart/end` 없이 `beforeinput insertText`로 **조합 단계별 발화**(ㅇ→아→안, 각 단계가 이전 글자 치환). 첫 설계(insertText 직접 삽입)는 누적("ㅇ아안")으로 깨짐 | `contentEditableAdapter`를 **surface diff 방식**으로 재작성 — 표면이 텍스트를 담고 브라우저가 자유 편집(조합 포함), `input`에서 직전 텍스트와 diff해 변경분만 모델에 반영. buffer 정확, 받침 정상 |
| **소프트 키보드 미출현** | iOS는 **사용자가 직접 탭한 요소가 contenteditable**이라야 키보드를 띄움(JS `focus()`로 다른 요소 포커스는 거부) | 입력 표면(surface)을 stage(원고) **전체에 덮음**(투명). 원고 탭 = 표면 탭 |
| **줄 측정(measure) 깨짐** | `visibility:hidden` 요소의 `Range.getBoundingClientRect`가 iOS에서 **0** → 줄/글자폭 측정 전부 깨짐 | `measure.ts` 오프스크린 div에서 `visibility:hidden` 제거(화면 밖 `left:-99999px`로만 숨김). 70자→4줄 정상, 글자폭 16px |
| **줄 세로 겹침** | **CSS `zoom`이 iOS WebKit에서 글자·줄 배치 불균일**(WebKit bug 77998, Safari 26.4 전까지). zoom 끄기 실험으로 확정 | **iOS만 `transform:scale`**(기능 감지 분기), 데스크탑은 기존 `zoom` 유지(무회귀) |
| **데스크탑 자모 분리/Enter 회귀** | transform을 데스크탑·iOS 공통 적용했더니 데스크탑 EditContext 경로 회귀 | transform을 **iOS 한정**으로 분기 → 데스크탑 zoom 복원. 사용자 "정상" 확인(로그에 beforeinput 안 뜸 = EditContext 경로 정상) |
| **Enter "두 번 쳐야"** (오진단) | 로그로 반증: `keydown Enter isComposing=false`(둘 다), buffer `\n` Enter당 정확 1개. **모델은 정상** | 모델 정상 → 렌더 문제로 재분류(아래 미해결) |

### 부수 (text inflation)
- `globals.css`에 `html { -webkit-text-size-adjust: 100%; }` 추가(iOS 본문 자동확대 차단). measure는 무관했으나(진단 tsa:none 동일) reset 차원 유지.

## 미해결 (다음 세션 핵심)

### 증상
iOS에서 한글 입력 후 화면에 **"가"가 작게** 보이고, 줄바꿈(Enter)이 **시각적으로 1번에 안 따라옴**(사용자 표현 "Enter 두 번 쳐야 줄바꿈"). **단, buffer(모델)는 정상**(`keydown isComposing=false`, `\n` 정확). → **렌더 레이어 단일 문제.**

### 강한 의심: iOS `transform:scale` 렌더 구조
- `CustomEditor.tsx`에서 iOS(`useTransformScale = typeof EditContext === "undefined"`, line ~422)일 때 페이지 컨테이너를 **wrapper + inner(transform:scale)** 구조로 렌더(line ~1134):
  - wrapper: `width/height = naturalSize.{w,h} * effectiveScale`, `position:relative`
  - inner(`innerRef`): `position:absolute; transform:scale(effectiveScale); transformOrigin:top left; width:max-content`
  - `naturalSize`는 `innerRef` ResizeObserver로 실측(line ~441 effect)
- **데스크탑(정상)은 단순 `zoom:effectiveScale`** 단일 div.
- 의심 지점:
  1. `naturalSize` 초기 `{0,0}` → wrapper `width:max-content, height:undefined` → inner `absolute`라 wrapper 높이 0 → 첫 페인트 크기/위치 이상 가능. ResizeObserver 측정 후 갱신되며 **글자 크기/캐럿 위치가 어긋날** 수 있음.
  2. `effectiveScale = scale * userZoom` 에서 `scale`(fit-to-width)이 초기 1 → 0.52로 바뀌는 타이밍과 `naturalSize` 측정 타이밍 경합.
  3. 캐럿 위치(`caretToScreen` 결과 `caret.x/y`)는 inner 안 절대좌표인데, transform/wrapper 구조에서 **캐럿만 다른 스케일로** 그려질 가능성("가" 작고 캐럿 줄 큼).

### 웹 인스펙터로 확인할 것 (배포 없이)
1. "가" 텍스트 요소의 **computed `font-size`** — 18px인가, 더 작은가? 부모들의 `transform` 값.
2. wrapper div의 `width`/`height` 실제값 vs inner `offsetWidth/Height * effectiveScale` 일치 여부.
3. `naturalSize` state 값(React DevTools 또는 콘솔에 로그 추가) — `{0,0}`에 머무는지.
4. 캐럿(`.poc-caret`)의 실제 위치/크기 vs 글자 위치 — 같은 transform 안인지.

### 가능한 수정 방향 (확정 후)
- transform inner를 `absolute` 대신 일반 흐름 + wrapper에 명시적 scaled 크기(측정 경합 제거).
- 또는 `transform-origin: top center` + wrapper 중앙정렬 재검토.
- 또는 모바일 fit-to-width를 **transform이 아닌 다른 방식**(예: 페이지 자체를 화면 폭에 맞춰 작은 geo로 렌더 — measure/layout 재계산)으로.
- **데스크탑 무회귀 절대 유지** — 수정은 `useTransformScale`(iOS) 경로에 한정.

## 파일별 변경 맵 (이번 작업)

```
frontend/src/components/custom-editor/
├── input/
│   ├── inputAdapter.ts          # InputAdapter 인터페이스 + focusInput() 추가 (커밋 71e4635)
│   ├── editContextAdapter.ts    # focusInput=host.focus() (데스크탑, 커밋 71e4635)
│   ├── contentEditableAdapter.ts# ★ surface diff 방식 재작성 + 전체덮기 투명 표면 + focusInput + syncSelection DOM캐럿
│   └── contentEditableAdapter.test.ts # diff 방식 테스트(ㅇ→아→안 치환 등)
├── CustomEditor.tsx             # ★ useTransformScale 분기(iOS transform / 데스크탑 zoom) + naturalSize/innerRef
│                                #   + onEdit(splitBlock/softBreak) 구현 + focusInput 호출 + 배너 비활성
│                                #   + debugNoZoom prop(실험용, 현재 미사용 — 정리 가능)
├── measure.ts                   # ★ 오프스크린 div visibility:hidden 제거
└── geometry.ts / layoutEngine.ts / printLayout.tsx  # 무변경

frontend/src/app/
├── globals.css                  # html text-size-adjust:100%
└── poc/mobile-editor/page.tsx   # 진단 라우트(입력 이벤트·buffer·keydown 로그) — dogfooding 전용
```

## 진단 라우트 (유지됨)

`/poc/mobile-editor` — CustomEditor를 빈 원고로 띄우고 상단에 진단 표시:
- `buffer = "..."` (모델 텍스트, ⏎=\n)
- 입력 이벤트 로그(beforeinput/input inputType, composition, keydown Enter isComposing)
- 다음 세션에서 렌더 진단용으로 measure/naturalSize 표시를 추가해도 좋음.

## 커밋 히스토리 (026 브랜치)

```
7882a78 feat(mobile): iOS 한글 입력·줄측정·줄겹침 해결 (Phase 3 진행) — 렌더 잔여  ← HEAD
71e4635 fix(mobile): iOS 소프트 키보드 — 사용자 제스처 내 입력 표면 focus
28df813 feat(mobile): iOS contenteditable 입력 어댑터 + PoC 라우트 (Phase 3)
80e6cdd feat(mobile): 입력 어댑터 추출 + 데스크탑 무회귀 (Phase 2)
```

- **origin push 상태**: `28df813`까지 push됨. `71e4635`·`7882a78`은 **로컬만**(다음 세션에서 `git push` 필요 — Vercel 프리뷰 자동배포 X, `vercel deploy --yes`로 수동 배포 중).

## tasks.md 진행 상태

- Phase 1·2(어댑터 추출·무회귀) ✅ / Phase 3(US1 iOS 입력) — 입력·키보드·measure·겹침 ✅, **렌더 잔여**
- Phase 4(US2 편집 이식): Enter(splitBlock/softBreak)는 contentEditable onEdit로 일부 구현됨. 나머지(선택/마크/블록/undo/복붙/목차/자동저장) 미착수.
- Phase 5(US3 반응형): 미착수. Phase 6(정리): 미착수(진단 UI·debugNoZoom 제거 포함).

## 절대 잊지 말 것

- **데스크탑 무회귀가 MUST 게이트** — 모든 수정은 iOS 경로(`useTransformScale` / `contentEditableAdapter`)에 한정. 데스크탑은 EditContext + zoom으로 이미 정상.
- **추측-배포 반복 금지**(§11) — 렌더 문제는 **웹 인스펙터로 직접 관찰 후** 수정. 이번 세션의 교훈: measure/zoom 모두 진단(관찰)으로 확정한 뒤 고쳤을 때 해결됐고, 추측 수정은 전부 실패했다.
