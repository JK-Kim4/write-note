# 설계 — 집필실 3단 (Studio 3-panel) · Scope B 1차

> **작성일**: 2026-06-10
> **트랙**: Web 디자인 개선 Scope B (신규 IA) — 1차 조각
> **대상**: Web(Next.js) 집필실 `/projects/[id]/write`
> **선행**: Scope A 웜 리스킨(`feat/web-warm-reskin`) 위에서 진행.
> **결정 경위**: 시안(`docs/design/web/`) 기반 브레인스토밍 — 선택 채택(B) → 집필실 3단(①) → 아웃라인=heading TOC → 레이아웃 B(세로 스택) → 인물=보기+빠른추가.

## 1. 목표 / 본질

집필 중인 작가가 **"한 작업실에 모든 맥락"**(PRODUCT.md 원칙 2)을 누리도록, 집필 surface 양옆에 **장면 아웃라인**과 **인물 노트**를 두어 흩어진 맥락을 글 쓰는 자리로 모은다. Scrivener의 복잡함이 아니라 **iA Writer의 절제**로 — 평소엔 물러나고(접기), 필요할 때 곁에.

비목표: 글쓰기 효율 기능, 장면 단위 문서 분할(Scrivener 바인더), AI 보조.

## 2. 범위

### 포함 (1차)
- 집필실 3단 레이아웃: `[아웃라인 | 원고 | 우측 패널]`, 좌·우 접기 토글.
- **아웃라인 패널(좌)**: 본문 heading 파생 목차 + 클릭 점프 + 현재 섹션 하이라이트.
- **인물 노트 패널(우 상단)**: 기존 등장인물 데이터 보기 + 빠른 추가.
- **곁쪽지 패널(우 하단)**: 기존 `MemoPanel` 동작 불변, 스택 하단 배치.

### 영구 제외 (제품 원칙 충돌)
- **AI Assistant · Ambience(음악)** — PRODUCT.md "MVP는 AI를 쓰지 않는다" / 마찰 설계 > 자동화.

### 후속 spec (이번 범위 밖)
- 아웃라인 **순서 변경**, **장면별 설명 메타**(= 장면 엔티티 신설).
- 대시보드 허브, 영감 보드(메이슨리) 재구성.

## 3. 레이아웃

집필실 본문 영역(`.studio`)을 3열 그리드로:

```
[ 아웃라인 ~240px ] [ 원고 1fr ] [ 우측 패널 ~320px ]
       (접기)                          (접기)
                                  ├─ 인물 노트 (상단)
                                  └─ 곁쪽지   (하단)   ← 각 섹션 헤더로 개별 접기
```

- **접기**: 좌측 아웃라인·우측 패널 각각 토글. 둘 다 접으면 원고만(몰입). Titlebar의 기존 패널 토글과 정합되게 확장(좌·우 2개 토글).
- **반응형(구조적)**: 폭이 좁아지면 ① 아웃라인 먼저 접힘 → ② 우측 패널 접힘. 모바일 폭에서는 패널을 오버레이/시트로(원고 우선). 유동 타이포 금지(product 레지스터).
- surface 순도: 원고는 종이 그대로, 패널은 `--surface-sunken` 톤으로 물러나게(기존 패널 톤 계승).

## 4. 아웃라인 패널 (좌)

### 동작
- 에디터(`PaperEditor`)의 현재 문서(ProseMirror doc)에서 **heading 노드(level 1·2)** 를 순서대로 추출 → 목차 항목 `{ level, text, pos }`.
- 항목 클릭 → 해당 `pos`로 **스크롤 점프**(+ 커서 이동은 선택). 스크롤 위치에 따라 **현재 섹션 하이라이트**.
- 문서 변경 시 목차 재파생(디바운스). **백엔드/데이터 모델 변경 없음** — 순수 파생.

### 데이터/전제
- `PaperEditor`는 `@tiptap/starter-kit`(Heading 포함) 사용 — BubbleMenu에 제목(level 2) 토글 존재. heading 파생 가능(확인됨).
- 파생은 **순수함수**로 분리(`outlineFromDoc(doc) → OutlineItem[]`) → 단위 테스트.

### 빈 상태
- heading 0개: "장면에 큰 제목을 달면 여기 목차가 생겨요." (작성 유도)

## 5. 인물 노트 패널 (우 상단)

### 동작
- 기존 등장인물 API **재사용**: `listCharacters(projectId)` 로 목록, `createCharacter(projectId, {name, ...})` 로 빠른 추가.
- 표시: 이름 · 한 줄 설명 · 상세 노트(펼침/접힘).
- **빠른 추가**: 이름(+한 줄) 인라인 입력. 상세 수정·삭제·재정렬은 **기존 `/projects/[id]/characters` 화면으로 링크**(중복 구현 회피).
- React Query(`characters` 키) — 추가 시 낙관적 갱신 또는 invalidate.

### 빈 상태
- 인물 0명: "곁에 둘 인물을 추가." + 빠른 추가 입력.

## 6. 곁쪽지 패널 (우 하단)
- 기존 `MemoPanel`(연결 메모 목록·고정·해제) **동작 불변**, 우측 스택 하단에 배치. 섹션 헤더로 접기.

## 7. 데이터 흐름 / 컴포넌트

| 소스 | 데이터 | 비고 |
|---|---|---|
| 아웃라인 | 에디터 ProseMirror doc → 파생 | 클라이언트 전용, 백엔드 0 |
| 인물 | React Query `listCharacters` | 기존 API 재사용 |
| 곁쪽지 | 기존 `useProjectMemos` 등 | 불변 |

**신규/변경 컴포넌트**
- `StudioOutline.tsx` (신규) — 목차 파생·점프·하이라이트. `'use client'`.
- `outline.ts` (신규) — `outlineFromDoc` 순수함수 + 타입.
- `CharacterPanel.tsx` (신규) — 인물 보기 + 빠른 추가. `'use client'`.
- 우측 패널 **스택 컨테이너** — 인물/곁쪽지 섹션 + 개별 접기.
- `/projects/[id]/write/page.tsx` — 3단 그리드 결선(아웃라인·우측 스택 추가), 에디터 인스턴스를 아웃라인에 연결.
- `desktop-app.css` — `.studio`/`.screen-body` 그리드 3열화 + 패널 토글·반응형 + 아웃라인/인물 패널 클래스.

**백엔드 변경: 없음.**

## 8. 접근성 / 한국어
- WCAG AA: 패널 텍스트 대비 ≥4.5:1(기존 토큰 계승), 아웃라인 현재-섹션 하이라이트는 색만으로 구분하지 않음(굵기/배경 병행).
- 패널 토글·아웃라인 항목은 키보드 포커스·`aria-current`/`aria-expanded`.
- `prefers-reduced-motion`: 점프 스크롤은 reduce 시 즉시 이동.
- 한국어 본문/제목 heading 파생 정상(텍스트 추출).

## 9. 테스트 / 게이트 (TDD)
- `outlineFromDoc` 순수함수: heading 추출·순서·중첩·빈 문서 — 단위 테스트(Red→Green).
- `StudioOutline`: 항목 렌더·클릭 점프 호출·빈 상태 — RTL(행위).
- `CharacterPanel`: 목록 렌더·빈 상태·빠른 추가 호출(시스템 경계 mock=HTTP) — RTL.
- 회귀 0: 기존 `MemoPanel`·자동저장·페이지분할.
- 게이트: `pnpm build`(RSC 경계 — 신규 패널 `'use client'` 검출) + `vitest` + `tsc` + `eslint`.

## 10. 미해결 / 플랜에서 확정할 점
- 에디터 인스턴스를 page→StudioOutline에 어떻게 노출할지(상위에서 editor 보유 vs 콜백). 구현 계획에서 결정.
- 아웃라인 점프 시 커서 이동 여부(스크롤만 vs 커서까지).
- 인물 빠른 추가 후 동기화 방식(낙관적 vs invalidate).

## 출처 / 인접
- 제품/스타일: `PRODUCT.md`, `docs/reports/2026-06-09-narae-note-product-design-brief.md`
- 시안: `docs/design/web/`(03-studio 외)
- 현행 집필실: `frontend/src/app/projects/[id]/write/page.tsx` · `components/editor/PaperEditor.tsx` · `components/workspace/MemoPanel.tsx`
- 인물 API: `frontend/src/lib/electron-api/characters.ts`
