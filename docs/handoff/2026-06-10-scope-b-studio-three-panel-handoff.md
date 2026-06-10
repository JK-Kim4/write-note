# 핸드오프 — Scope B: 집필실 3단(Studio 3-panel) · speckit 진행용

> **작성일**: 2026-06-10
> **목적**: 새 세션이 컨텍스트 0에서 **speckit 워크플로(spec→plan→tasks→implement)** 로 바로 시작할 수 있게, 결정·제약·검증된 코드 사실·진입점을 한 곳에 박는다.
> **이 작업의 본질**: 시안 기반 Web 디자인 개선의 Scope B 1차 — 집필실에 **장면 아웃라인(좌) + 인물 노트(우)** 패널을 붙여 "한 작업실에 모든 맥락"을 구현.

---

## 0. 가장 먼저 읽을 것 (SoT)

| 문서 | 역할 |
|---|---|
| **`docs/superpowers/specs/2026-06-10-studio-three-panel-design.md`** | **확정 설계 (이 작업의 spec 입력)** — 결정 전부 들어있음 |
| `PRODUCT.md` | 제품 본질·브랜드·anti-ref·디자인 원칙 (특히 "AI 안 씀", "마찰 설계", "모든 맥락 한 곳") |
| `docs/reports/2026-06-09-narae-note-product-design-brief.md` | 제품 개요/스타일/기능 정리 |
| `docs/design/web/` | 외부 제작 시안 5종(웜 보정본). 03-studio 가 본 작업 시각 레퍼런스 |
| `.claude/rules/typescript/code-quality.md` | FE 코드 규율 (RSC 경계 HARD-GATE 등) |

**speckit 진입점**: 위 설계 스펙을 기능 설명 입력으로 삼아 `/speckit-specify` 부터.

---

## 1. 확정된 설계 결정 (브레인스토밍 산출)

- **범위**: 선택 채택 → **집필실 3단**(①) 1차. 대시보드·영감 보드는 후속.
- **레이아웃**: `[아웃라인 ~240px | 원고 1fr | 우측 ~320px]`, 좌·우 접기 토글. **우측 = 인물(상단) + 곁쪽지(하단) 세로 스택**(레이아웃 B), 각 섹션 개별 접기.
- **아웃라인**: 본문 **heading(H1/H2) 파생 TOC** — 클릭 점프 + 현재 섹션 하이라이트. **백엔드/데이터 모델 변경 0** (순수 파생). 순서변경·장면설명 메타는 후속.
- **인물**: 기존 등장인물 API **재사용** — 보기 + **빠른 추가**(이름+한 줄). 상세 수정·삭제·재정렬은 기존 `/projects/[id]/characters` 링크.
- **곁쪽지**: 기존 `MemoPanel` **동작 불변**, 우측 스택 하단.
- **영구 제외**: **AI Assistant·Ambience(음악)** — 제품 원칙 충돌.

---

## 2. 검증된 코드 사실 (새 세션이 재확인 안 해도 됨 — 단 grep 1회로 정합 점검 권장)

집필실 페이지 `frontend/src/app/projects/[id]/write/page.tsx`:
- 구성 = `Rail` + `Titlebar` + `PaperEditor` + `MemoPanel`. 셸은 `.app`/`.studio`/`.screen-body` 클래스(`desktop-app.css`).
- 쓰는 훅: `useDocumentSession`, `useWorkSession`, `useProjectMemos`/`useRemoveLinkMemo`/`useSetPinMemo`, `useProject`, `useProjectDocument`, `useAuthGuard`(인증 게이트).

에디터 `frontend/src/components/editor/PaperEditor.tsx`:
- `@tiptap/starter-kit`(**Heading 포함**) 사용, BubbleMenu에 제목(level 2) 토글 존재 → **heading 파생 아웃라인 가능**.
- 한국어 IME: `editor.view.composing` 가드(조합 중 부모 갱신 억제) — 건드리지 말 것.
- ⚠️ **에디터 인스턴스가 PaperEditor 내부 `useEditor`로 생성됨** → 아웃라인 패널에 노출하려면 상위로 lift 하거나 콜백 필요(설계 §10 미해결, plan에서 확정).

인물 API `frontend/src/lib/electron-api/characters.ts` (REST 014 위 web shim):
- `listCharacters(projectId, params) → Page<CharacterResponse>`, `createCharacter(projectId, input)`, `updateCharacter`, `deleteCharacter`, `reorderCharacters`, `getCharacter`.

곁쪽지: `frontend/src/components/workspace/MemoPanel.tsx` (연결 메모·고정·해제).

스타일 시스템 (중요 — 토큰 **2종 공존**):
- `frontend/src/styles/desktop-app.css` (≈990줄): **메인 화면**. OKLCH 자체 토큰(`--bg`/`--surface`/`--paper`/`--ink`/`--accent`/`--radius`/`--shadow-panel`/`--shadow-paper`/`--ease-*`), 의미론적 BEM 클래스(`.studio`/`.screen-body`/`.rail`/`.titlebar`/`.wall-card`/`.scrap` 등). **집필실 그리드 = `.studio`(flex) + `.screen-body`(`grid-template-columns: minmax(0,1fr) 320px`, `--solo` variant).** 3열화는 여기서.
- `frontend/src/styles/tokens.css` (`--w-*`) + `globals.css` `@theme`: 인증/폼(Tailwind 유틸).
- **Scope A에서 두 시스템 모두 웜으로 정합됨**(아래 §3 브랜치).

기존 게이트 상태: `vitest` **83 pass**. ⚠️ **기존 typecheck 에러 1건** `src/lib/electron-api/documents.test.ts` (version number→string, 016 부채) — **본 작업과 무관, 고치지 말 것**.

---

## 3. 브랜치 계보 (중요)

```
develop
  └─ feat/web-warm-reskin   (Scope A — 미merge)
       ├─ 90e75b3  인증/폼 토큰 웜 통일 + 브랜드 '나래 노트'
       ├─ 337401c  메인 앱 웜 풀(크림 종이·포근한 그림자·모서리)
       └─ bdbf45f  시안 5종 + 브리프 (docs)
       └─ feat/studio-three-panel   (Scope B — 현재 브랜치)
            └─ 1a25ae3  집필실 3단 설계 문서
```

- **새 세션은 `feat/studio-three-panel` 에서 작업** (웜 톤 위에 3단 구현).
- Scope A·B 모두 develop 미merge. **merge 순서 = Scope A 먼저 → Scope B** (사용자 결정 영역).

---

## 4. 제약 / HARD-GATE (구현 시 필수)

- **백엔드 변경 없음** — 아웃라인=클라이언트 파생, 인물=기존 API, 곁쪽지=기존.
- **AI·Ambience 절대 추가 금지** (제품 원칙).
- **한국어 1차** — UI·본문. heading 한국어 텍스트 파생 정상.
- **접근성 AA** — 대비 ≥4.5:1(기존 토큰 계승), 현재-섹션 하이라이트는 색만으로 구분 X(굵기/배경 병행), 패널 토글/항목 키보드+`aria-current`/`aria-expanded`, `prefers-reduced-motion`(점프 즉시 이동).
- **RSC 경계 (HARD-GATE)**: 신규 패널은 인터랙티브 → `'use client'` 의무. **작성 직후 `pnpm build`로 검출**(lint만으론 안 잡힘). `.claude/rules/typescript/code-quality.md` 회귀 사례 참조.
- **TDD**: heading 파생은 **순수함수 `outlineFromDoc(doc)→OutlineItem[]` 먼저**(Red→Green), 그다음 패널. mock은 시스템 경계(HTTP)만.
- **빌드/테스트는 포어그라운드** (CLAUDE.md 작업 실행 지침). `node_modules/.bin/{vitest,tsc,vite}` 직접 실행 권장(pnpm lockfile 충돌 회피).

---

## 5. 실행/검증 환경

- Node **24.14.0** + **pnpm 8.15.5**(corepack). `cd frontend`.
- dev: `pnpm dev` (port 3000 — **이미 떠 있을 수 있음**, 충돌 시 자동 3001). 백엔드 `:8080` 가동 중(401=정상, 인증 필요).
- 게이트: `node_modules/.bin/vitest run` · `tsc --noEmit`(기존 에러 1건 무시) · `eslint` · `pnpm build`(RSC).
- **시각 검증 팁**: 메인 화면은 인증 게이트라 헤드리스로 직접 못 봄. 이번 세션은 **실제 `desktop-app.css`를 `<link>`한 정적 하니스 HTML을 만들어 headless Chrome(`--blink-settings=preferredColorScheme=1`로 라이트 강제) 스크린샷**으로 확인했음. 3단 레이아웃도 같은 방식으로 검증 가능. (로그인 화면은 직접 관찰 가능.)

---

## 6. 산출물 형태 (speckit)

1. `/speckit-specify` — 위 설계 스펙(`docs/superpowers/specs/2026-06-10-studio-three-panel-design.md`)을 기능 설명 입력으로 → `specs/NNN-studio-three-panel/spec.md`.
2. `/speckit-plan` — plan + design artifacts. **설계 §10 미해결 3건을 여기서 확정**:
   - 에디터 인스턴스를 page→아웃라인에 노출하는 방식(상위 보유 vs 콜백)
   - 아웃라인 점프 시 커서 이동 여부(스크롤만 vs 커서까지)
   - 인물 빠른 추가 후 동기화(낙관적 vs invalidate)
3. `/speckit-tasks` — tasks.md (TDD 순서: 파생 순수함수 → 패널 → 그리드 CSS → 결선 → 게이트).
4. (`/speckit-analyze` — 일관성 점검 권장.)
5. `/speckit-implement`.

---

## 7. 범위 밖 / 후속

- 아웃라인 순서변경·**장면 설명 메타(=장면 엔티티 신설)**, 대시보드 허브, 영감 보드(메이슨리). 각각 별도 spec.
- Scope A/B develop merge 결정.
