# Phase 0.5: Desktop Design Definition

## 목표

구현 전에 desktop MVP의 컨셉, 톤앤매너, 디자인 시스템, 핵심 화면 와이어프레임, 구현 금지 패턴을 확정한다.

## 배경

WEB 구현 당시 간단한 와이어프레임만 잡고 구현을 시작하면서 결과물이 원하는 방향과 어긋났다. desktop MVP는 같은 실수를 반복하지 않기 위해 Phase 1 scaffold 전에 디자인 기준을 먼저 고정한다.

## 범위

- 제품 컨셉과 톤앤매너 정의.
- Native Studio 기반 디자인 시스템 정의.
- Projects, Write Studio, Memo Inbox, Quick Capture 와이어프레임 작성.
- empty/loading/error/saving/focus 상태 정의.
- 구현 금지 패턴과 디자인 review checklist 작성.
- 정적 HTML wireframe을 repository에 보관.

## 제외

- Electron scaffold.
- 실제 React component 구현.
- DB/persistence 구현.
- 원고지 모드 디자인.
- 모바일 캡처 디자인.
- dark mode 전체 설계.

## 산출물

아래 파일을 생성한다.

```text
docs/design/desktop/
  00-concept.md
  01-design-system.md
  02-wireframes.md
  03-screen-states.md
  04-implementation-rules.md
  wireframes.html
```

## 디자인 결정 기준

- 기본 톤은 **Native Studio**로 한다.
- macOS native에 가까운 조용한 데스크탑 도구처럼 보여야 한다.
- 글쓰기 canvas가 중심이고, 메모/프로젝트 정보는 보조 정보로 둔다.
- 에디터 page에만 아주 약한 종이 감각을 허용한다.
- blue는 primary action과 focus state에만 제한한다.
- Projects 화면은 새 프로젝트 작성 블럭을 main body에 두고, 기존 project index를 우측에 리스트업한다.

## 금지 패턴

- dashboard card 과잉.
- hero section.
- 과한 beige/cream 톤.
- 기본 dark UI.
- 장식용 gradient.
- 기존 WEB UI component를 디자인 source of truth로 재사용.
- Write Studio에서 side panel이 editor보다 시각적으로 강해지는 구성.

## 작업 지침

1. 현재 임시 목업 `.superpowers/brainstorm/.../desktop-native-studio-wireframes.html`은 참고만 한다.
2. 최종 목업은 `docs/design/desktop/wireframes.html`에 정식 보관한다.
3. 디자인 문서는 구현자가 임의로 색상/spacing/radius/layout을 정하지 않아도 될 정도로 구체화한다.
4. 와이어프레임은 실제 구현 화면의 구조를 반영해야 하며, 장식용 목업으로 흐르면 안 된다.
5. Phase 1 scaffold는 이 phase가 완료되고 사용자 승인을 받은 뒤 시작한다.

## 완료 기준

- 4개 핵심 화면(Projects, Write Studio, Memo Inbox, Quick Capture)의 wireframe이 문서와 HTML 목업 양쪽에 존재한다.
- design token 기준이 문서화되어 있다.
- empty/loading/error/saving/focus 상태가 최소 1회 이상 정의되어 있다.
- 구현 금지 패턴과 review checklist가 문서화되어 있다.
- 사용자 검토 후 “이 디자인 기준으로 구현 시작” 승인이 남아 있다.

## 검증

```bash
find docs/design/desktop -maxdepth 1 -type f | sort
```

수동 확인:

- `docs/design/desktop/wireframes.html`을 브라우저에서 연다.
- Projects 화면에서 새 프로젝트 작성 블럭이 main body에 있는지 확인한다.
- 기존 project index가 우측에 리스트업되는지 확인한다.
- Write Studio에서 editor가 중심이고 side panel이 보조 정보로 보이는지 확인한다.
- Memo Inbox와 Quick Capture가 첫 MVP 범위를 넘지 않는지 확인한다.

## 권장 커밋

```bash
git commit -m "docs: define desktop MVP design system"
```
