---
target: impeccable critique desktop app
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-06-05T18-51-55Z
slug: desktop-src-app-tsx
---
# Impeccable Critique: Desktop App

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---:|---:|---|
| 1 | Visibility of System Status | 3 | 저장 상태와 글자 수는 좋지만, 메모 연결 반영과 실패 회복 피드백은 약함 |
| 2 | Match System / Real World | 3 | 작업실, 종이, 메모 연결 언어는 제품 맥락과 잘 맞음 |
| 3 | User Control and Freedom | 2 | 삭제 undo는 있으나 빠른 메모 초안 유실, modal focus 회복, 작품 삭제 회복 여지가 작음 |
| 4 | Consistency and Standards | 3 | 레일, 버튼, 세그먼트, 패널 vocabulary는 대체로 일관됨 |
| 5 | Error Prevention | 2 | 빈 submit 방지는 있으나 캡처 닫기/저장 실패/연결 지연에서 예방 장치가 약함 |
| 6 | Recognition Rather Than Recall | 2 | 레일 라벨은 좋지만 빠른 메모 plus, 줄노트, 패널 아이콘 의미는 즉시 읽히지 않음 |
| 7 | Flexibility and Efficiency | 2 | autosave, Cmd+S, zoom은 있으나 핵심 capture shortcut과 keyboard-first 흐름이 부족함 |
| 8 | Aesthetic and Minimalist Design | 3 | 집필 surface는 강하지만 주변 chrome과 관리형 메모 화면이 몰입을 침범함 |
| 9 | Error Recovery | 2 | 메모 삭제 되돌리기는 좋고, 나머지 실패/취소 상태는 얕음 |
| 10 | Help and Documentation | 2 | empty copy는 좋지만 재진입/메모 연결/테마 의미 안내가 제한적 |
| **Total** |  | **24/40** | **Good direction, still too much workstation friction for a writing sanctuary** |

## Anti-Patterns Verdict

**LLM assessment**: 바로 "AI가 만든 SaaS 대시보드"로 보이지는 않는다. 우드 톤 작업실, A4 종이, 세리프 본문, 잉크블루 accent는 제품의 "따뜻한 문학 작업실" 방향과 맞는다. 다만 실제 상호작용 구조는 아직 작업실보다 생산성 앱 셸에 가깝다. 왼쪽 rail, titlebar controls, 우측 패널, 설정 FAB, 카드형 메모 inbox가 동시에 보이면서 "도구가 물러난다"는 약속을 일부 깬다.

**Deterministic scan**: `node .agents/skills/impeccable/scripts/detect.mjs --json desktop/src` 결과는 exit code 0, findings 0건이다. detector는 gradient text, card-grid slop, obvious anti-pattern을 잡지 못했다. 이 clean result는 현재 UI가 표면적인 AI slop은 피했다는 근거다.

**Detector가 놓친 근거**: 코드 근거상 placeholder/보조 텍스트 대비가 약할 가능성이 있다. `--faint` on `--surface-sunken`은 light 약 2.33:1, dark 약 3.03:1로 placeholder 기준 4.5:1에 못 미친다. `--muted` on `--surface`도 light 약 4.27:1이라 13-15px 보조 텍스트에는 위험하다. 전역 `:focus-visible { outline: none; }`도 일부 action button, toast action, custom dialog에서 focus ring 누락 위험을 만든다.

**Visual overlays**: Electron desktop target이라 browser overlay는 생략했다. renderer가 `window.electronAPI`에 의존하므로 일반 localhost browser에서 script overlay를 주입해도 동일 surface라고 보기 어렵다. 실제 화면 근거는 Computer Use로 Electron 창을 직접 확인했다.

## Overall Impression

앱의 가장 강한 순간은 집필 화면이다. 종이와 여백, 본문 중심의 구성은 "글을 쓰는 surface는 순도 높게"라는 원칙을 잘 구현한다. 가장 큰 기회는 주변 작업실의 정보 구조를 "기능 모음"에서 "재진입을 돕는 맥락 장치"로 바꾸는 것이다. 지금은 좋은 방향의 prototype이지만, 매일 쓰는 작가 도구로는 아직 chrome과 관리 화면의 존재감이 크다.

## What's Working

1. **집필 surface가 주인공이다**: A4 비율의 종이, 넓은 여백, 세리프 본문, 얇은 titlebar는 본문을 중심에 둔다. 이 화면은 제품의 정체성과 가장 잘 맞는다.
2. **메모를 작품에 붙이는 구조가 제품 핵심과 맞다**: 메모 inbox에서 작품 연결 후 집필 패널에 나타나는 흐름은 "죽은 메모를 다시 살린다"는 목적과 직접 연결된다.
3. **copy가 과하게 설명하지 않는다**: "현재 작품에 연결됩니다", "이 작품에 연결된 메모가 아직 없어요" 같은 문구는 짧고 기능적이다. 한국어 product UI로서 큰 어색함이 없다.

## Priority Issues

### [P1] 집필 화면의 visible decision points가 너무 많음

- **Why it matters**: 사용자가 글을 쓰기 시작하는 첫 3초에 레일 5개, 저장 상태, zoom, 줄노트, 메모 패널, 설정 FAB까지 보인다. 도구가 물러나야 하는 화면에서 조작 선택지가 4개를 훨씬 넘는다.
- **Fix**: 집필 모드에서는 상태와 조작을 분리한다. 저장 상태와 글자 수는 남기되 zoom/줄노트/테마/자동저장은 하나의 조용한 보기 메뉴로 합친다. 연결 메모 토글은 연결된 메모가 있을 때만 더 의미 있게 노출한다.
- **Suggested command**: `$impeccable distill`

### [P1] 재진입 안도감이 아직 구체적인 맥락으로 구현되지 않음

- **Why it matters**: 제품의 핵심 약속은 "어디까지 했지"를 다시 떠올리지 않게 하는 것이다. 현재 작품 카드는 제목, 짧은 preview, 마지막 작업 날짜만 보여준다. 마지막 문장, 진행 목표, 연결 메모 수 같은 재진입 단서가 부족하다.
- **Fix**: 작품 카드와 집필 진입 직후에 "마지막으로 쓰던 한 줄", 최근 연결 메모 수, 이번 세션 진입 cue를 작게 보여준다. 카드가 단순 프로젝트 목록이 아니라 "이어서 쓸 문맥"이 되어야 한다.
- **Suggested command**: `$impeccable shape`

### [P2] 빠른 메모는 핵심 기능인데 affordance가 너무 약함

- **Why it matters**: 현재 빠른 메모는 rail 하단 `+` 버튼이다. 사용자는 이것을 "새 작품", "새 항목", "추가"로 해석할 수 있다. 실제 QA에서도 Computer Use 접근성 액션에서 frame이 불안정했다.
- **Fix**: capture 전용 아이콘/라벨/shortcut affordance로 바꾼다. 집필 중에는 작은 "빠른 메모" cue 또는 keyboard shortcut hint를 제공한다. modal은 초안 유실 방지, focus trap, focus restore를 갖춰야 한다.
- **Suggested command**: `$impeccable harden`

### [P2] 메모 inbox가 "살아나는 메모"보다 "관리 화면"으로 읽힘

- **Why it matters**: 필터, inline 입력, 연결 버튼, 삭제 버튼, 연결 칩, 오른쪽 통계가 동시에 보이면서 메모를 정리하는 DB 화면처럼 느껴진다. 작가에게 필요한 것은 통계보다 "이 메모를 어느 작품에 다시 붙일까"다.
- **Fix**: 메모 inbox의 첫 우선순위를 미연결 메모 큐레이션으로 좁힌다. 통계 패널은 덜어내거나 "작품에 다시 붙일 후보" 같은 문맥형 패널로 바꾼다. 연결 성공 시 카드와 summary count를 즉시 갱신한다.
- **Suggested command**: `$impeccable layout`

### [P2] 접근성 대비와 focus 회복이 부족할 가능성

- **Why it matters**: placeholder와 보조 텍스트 대비가 낮으면 종이 질감 위에서 흐려진다. 전역 focus outline 제거 후 일부 button/dialog에서 대체 focus가 빠지면 키보드 사용자에게 현재 위치가 사라진다.
- **Fix**: `--faint`, `--muted` 사용처의 contrast를 WCAG AA 기준으로 조정한다. `QuickCapture`, 삭제 확인 dialog, toast action에 focus trap/restore와 명시적 focus-visible style을 추가한다.
- **Suggested command**: `$impeccable audit`

### [P3] 나무결 재료가 장식으로 과해질 위험

- **Why it matters**: 현재 texture는 제품 분위기를 만들지만, `feTurbulence` 기반 질감은 과하면 "재료"보다 "필터 장식"으로 보인다. 제품 anti-reference의 cream/beige slop은 피했지만, texture slop으로 옮겨갈 수 있다.
- **Fix**: 실제 렌더에서 grain opacity를 더 낮추거나, 중요한 화면에서는 배경 질감보다 종이 shadow/여백 rhythm으로 따뜻함을 만든다.
- **Suggested command**: `$impeccable polish`

## Persona Red Flags

**주말 45분 세션 작가**: 작품을 열면 바로 본문에는 들어가지만, 작품 목록에서 마지막 문장이나 지난 목표를 알 수 없다. "마지막 작업 2일 전"은 날짜 정보일 뿐, 재진입을 도와주는 맥락이 아니다.

**메모를 많이 쌓는 장르 단편 작가**: 메모 inbox에서 연결은 가능하지만, 각 카드의 연결/삭제/칩/필터/통계가 동시에 보여 정리 업무처럼 느껴진다. "이 메모가 어느 작품의 어느 장면에 다시 떠야 하는가"가 UI의 중심이 아니다.

**키보드 중심 집필 사용자**: `Cmd+S`는 있지만 빠른 메모 capture shortcut과 modal focus loop가 약하다. 핵심 capture 흐름이 rail 하단 버튼에 숨어 있으면 마우스 없는 집필 흐름에서 놓치기 쉽다.

## Minor Observations

- `기록` 화면이 아직 placeholder라면 rail에 상시 노출되는 것이 미완성감을 줄 수 있다.
- `종이/촛불`은 정서적으로 좋지만, 사용자가 이것이 light/dark 전환임을 바로 이해하도록 보조 cue가 필요하다.
- hover 때만 드러나는 삭제 affordance는 조용하지만 발견성, keyboard, touch에는 취약하다.
- 메모 연결 popover는 연결 성공 후 카드/카운트 반영이 늦게 보이는 순간이 있었다. success feedback을 명확히 해야 한다.

## Questions to Consider

1. 집필 화면에서 사용자가 글을 쓰기 시작한 뒤 10초 동안 남아 있어야 하는 UI는 저장 상태와 본문 말고 무엇인가?
2. 프로젝트 카드가 날짜 대신 "마지막 문장"을 첫 번째 정보로 보여주면 재진입 감정이 얼마나 달라질까?
3. 메모 inbox는 관리 화면이어야 하나, 아니면 작품에 다시 붙여 메모를 살리는 작업대여야 하나?
4. 빠른 메모 버튼이 plus가 아니라 capture 전용 affordance라면 제품 정체성이 더 선명해질까?
