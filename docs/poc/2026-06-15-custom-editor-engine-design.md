# 자체 에디터 엔진 PoC — 설계 (2026-06-15)

> 브랜치 `024-custom-editor` (base develop). 집필 에디터를 TipTap 의존에서 자체 엔진으로.
> 본 문서 = brainstorming 산출 설계. 구현/진척은 [build-log](./2026-06-15-custom-editor-build-log.md).

## 0. 왜 (근본 원인)

현재 집필 에디터의 페이지 분할은 **CSS `column-wrap`(비표준·Chrome 전용)이 나누고, JS는 결과 높이를 ÷stride로 장수만 추정**한다. 텍스트(시스템 X)와 종이 그림(시스템 Y)이 단일 진실원 없이 "우연히 좌표가 맞도록" 조율돼 있어, 35px 격자를 벗어나는 순간(제목 margin·인용·**이미지 등 가변높이 블록**) 두 시계가 어긋난다. 증상: 괘선 밖 입력 / 문단 통째 점프 / 규격변경 깨짐 / 이미지 첨부 불가. 이건 버그가 아니라 아키텍처 — `b.css` 6커밋의 두더지잡기가 그 증거.

## 1. 핵심 = 제어 역전

`CSS가 나누고 JS가 추정` → **`JS가 계산하고 결과를 렌더`**. column-wrap 폐기.

```
문서모델(blocks) → 측정(measure) → 레이아웃 엔진(pure) → 렌더 → (EditContext 입력 루프) → 문서모델
```

레이아웃 엔진은 **브라우저 무관**(JS 측정·배치). 브라우저 차이는 입력층(EditContext)에만. → **우선 Chromium 전용** 집중(portable 백엔드/추상화는 안 만듦, YAGNI).

## 2. 레이아웃 엔진 알고리즘 (PoC 핵심, TDD)

`layout(blocks: MeasuredBlock[], contentHeightPx) → LaidOutPage[]` — 순수함수.

- `MeasuredBlock` = `{kind:'paragraph', id, lines: {height,start,end}[]}` | `{kind:'image', id, height}`
  - 측정값(줄별 높이·문자범위, 이미지 자연높이)을 **미리 붙여** 받음 → 엔진은 브라우저 없이 결정론적 → 단위테스트 가능.
- "현재 페이지 남은 높이"(`y`) 커서로 순회:
  - 문단: 줄을 하나씩 놓다가 `y+lineH > contentHeight && y>0`이면 **그 줄부터 다음 페이지로** (= 줄 단위 이어짐, 통째 점프 없음). 한 문단이 두 페이지에 걸치면 페이지별 fragment로 분리.
  - 이미지: 남은 높이에 안 들어가면 **통째로 다음 페이지로 밀고 빈공간 남김**(가변높이 1급 시민).
- 출력 `LaidOutPage = {index, fragments: PlacedFragment[], usedHeight}`. fragment는 (문단 줄범위 startLine..endLine + offsetY) 또는 (이미지 offsetY+height).
- **규격/폰트 변경 = `contentHeightPx`(+측정 폭/줄높이)만 바꿔 같은 함수 1회 재실행** → race 없는 리플로우. 정수 줄높이 제약 없음.

엣지: 페이지보다 큰 단일 줄/이미지는 빈 페이지(y=0)에 그대로 놓아 무한루프 방지(렌더가 이미지를 contentHeight로 스케일다운 → 실제로는 미발생).

## 3. 측정 / 렌더 / 입력

- **measure.ts** (브라우저): 문단 텍스트를 목표 폭(`contentWidthPx`)·폰트로 오프스크린 렌더 후 `Range.getClientRects()`로 줄별 rect(높이·문자범위) 추출. 이미지는 자연높이(스케일다운).
- **renderer**: `LaidOutPage[]`를 실제 페이지 박스로. 문단 fragment는 **전체 문단을 그리되 fragment 밴드만 clip**(전역 1회 측정한 줄바꿈 보존, 페이지별 독립 배치로 이미지 gap 처리). 종이·괘선·텍스트가 한 계산에서 → drift 소멸.
- **EditContext 입력 루프** (Chromium): `textupdate`→문서모델 갱신→영향 블록만 재측정→해당 지점부터 재레이아웃→재렌더, 캐럿/선택은 직접 그림. IME 조합은 EditContext 네이티브. (구체 패턴은 리서치 디제스트 반영 — build-log 참조.)

## 4. 페이지 기하 (실제 A4 비율)

`pageGeometry(size, fontSizePx, lineHeightRatio)` → mm 실측(A4 210×297 등) × (96/25.4)px, 균일 마진. **현재의 stylized 28줄 모델 폐기** → "A4 비율" 불만 해소. 줄높이는 `fontSize×ratio`(분수 허용 — 엔진이 px로 다룸).

## 5. PoC 범위

**IN**: 평문 문단 + 이미지 블록 / 한글 IME / Enter·Backspace / 캐럿(최소) / 용지·폰트 변경 / 이미지 삽입 — Chrome 한정. 독립 라우트 `/poc/editor`.
**OUT(핵심 GREEN 후 연기)**: 서식 마크·저장 결선·기존 화면 통합·전체 커서네비/선택/실행취소/복붙·Safari/Firefox.

## 6. 테스트 전략

- 레이아웃 엔진(순수) = Vitest 단위테스트 TDD — ①줄단위 이어짐 ②리플로우 ③이미지 push 직접 검증.
- 측정·렌더·EditContext·IME = **브라우저 dogfooding**(헤드리스 IME 불가) — 아침 리뷰가 그 게이트.

## 7. 결정 로그

- A안(EditContext+자체 측정-배치 엔진) 채택. B(TipTap 분할만)=두 시계 drift 잔존 탈락. C(canvas)=과함.
- Chromium 전용 우선. EditContext=Chrome/Edge 121+ 전용(FF/Safari 미지원, 2026-06 확인).
- 자율 빌드 중 추가 결정은 build-log §결정 로그에 누적.
