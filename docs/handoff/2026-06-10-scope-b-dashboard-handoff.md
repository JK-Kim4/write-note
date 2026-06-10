# 핸드오프 — Scope B 후속: 대시보드 허브 (내용 A 확정 · 잔여 결정→design) + 017 집필실 3단 완료

> **작성일**: 2026-06-10
> **브랜치**: `feat/studio-three-panel` (Scope A 웜 리스킨 위 스택, origin push 완료)
> **목적**: 다음 세션이 (1) 완료된 017 집필실 3단의 상태를 파악하고 (2) 착수한 대시보드 허브 브레인스토밍을 **결정 지점에서 이어받아** design→speckit→구현으로 진행하게 한다.

---

## 0. 가장 먼저 읽을 것

| 문서 | 역할 |
|---|---|
| **본 핸드오프** | 결정·진행 상태·다음 진입점 |
| `PRODUCT.md` | 제품 본질·anti-reference(특히 "카드 그득한 SaaS 대시보드" 금지)·원칙(효율 아님·마찰>자동화) |
| `docs/design/web/01-dashboard.html` | 대시보드 **시안**(웜 리스킨 5종 IA 중 하나) — 단 제품 원칙과 충돌 부분 있음(§2 참조) |
| `docs/design/web/mockups/dashboard-reentry-hub.html` | **이번 세션 제작 목업**(추천안 = 재진입 허브). 실제 `desktop-app.css` 토큰 링크. file://로 열면 실제 톤 |
| `docs/superpowers/specs/2026-05-31-project-dashboard-design.md` | 옛 대시보드 spec(작품별 재진입 허브) — 철학 참고(재진입>관리) |
| `specs/017-studio-three-panel/` | 직전 완료 작업 spec/plan/tasks |

---

## 1. 직전 완료 — 017 집필실 3단 (Studio 3-panel) ✅

speckit 풀파이프(specify→plan→tasks→analyze→implement) + 서브에이전트 2회 검증 완료. **이 커밋에 포함, 게이트 GREEN.**

- **구현**: 집필실 `/projects/[id]/write` 3열화 `[아웃라인 | 원고 | 인물+곁쪽지]`. 좌·우 접기 토글, 진입 기본=아웃라인만 펼침.
  - 아웃라인(좌): 본문 H1·H2 파생 목차(순수함수 `outlineFromDoc`) + 클릭 점프(커서 이동+스크롤, reduced-motion 분기) + 현재 섹션 하이라이트.
  - 인물(우상): 기존 등장인물 API 재사용 보기 + 빠른 추가(`useCharacters` 신규 훅).
  - 곁쪽지(우하): 기존 `MemoPanel` 불변, 우측 스택 하단.
- **백엔드 변경 0.** 신규 8 파일 + 변경 3(`PaperEditor.tsx` onEditorReady prop만 / `write/page.tsx` 결선 / `desktop-app.css` `.screen-body--studio` 3열화).
- **게이트**: vitest **103 pass**(+20 신규), tsc(기존 `documents.test.ts` 1건만, 016 부채·무관), 신규파일 eslint clean, `pnpm build`(RSC OK).
- **검증**: 서브에이전트 2회 SHIP 가능, 버그 0. 보고서 `docs/reports/2026-06-10-studio-three-panel-implementation.html`.
- **남은 일(라이브 dogfooding, 사용자 영역)**: T024 한국어 IME 4케이스 실타이핑·자동저장·페이지분할 회귀 확인 / T025 시각(패널 4조합·반응형). tasks.md 25/27 완료, 이 둘만 미완.
- **알려진 무관 사항**: `page.tsx:107` eslint `set-state-in-effect` 경고 = 016 시기 기존 코드(HEAD 동일, 본 작업 변경 아님). `documents.test.ts` typecheck 에러도 016 부채. **둘 다 건드리지 말 것.**

---

## 2. 진행 중 — 대시보드 허브 브레인스토밍 (결정 지점에서 멈춤)

`superpowers:brainstorming` 스킬로 진입. **HARD-GATE: 아직 design doc 미작성 · 구현 0.** 다음 세션은 brainstorming을 이어서 → design doc → speckit.

### 2-1. 확정된 결정
- **IA 위치 = 새 홈** (사용자 확정): `/`가 대시보드(작가 홈), 기존 작품 벽은 `/library`로 이동. → **라우팅·Rail 네비 재편 동반**(현 Rail: 작품`/`·집필·메모`/memos`·기록`/logs`·문의`/contact` → 대시보드 진입점 추가 + 작품 벽 경로 이동).
- **내용 방향 = A. 재진입 허브** (사용자 확정, 2026-06-10): 목업 `dashboard-reentry-hub.html` 그대로. 효율 타일(streak·목표게이지·주간그래프)·자동 인용구 **제외**, 백엔드 0. 구성 = ① 인사+날짜 ② **이어서 쓰기**(최근작 최대 타일: 제목+마지막 문장+다음 장면+[이어서 쓰기]) ③ **작품** 빠른 진입(미니 카드) ④ **최근 곁쪽지**. → 절충안 ghost 타일("이번 주 집필 시간")은 **미채택**(목업에서 제거 대상).

### 2-2. 핵심 긴장 (시안 vs 제품 원칙) — 재조정 대상
시안 `01-dashboard.html`은 bento 그리드에 ① 인사+**연속 집필 streak** ② **오늘의 문장(자동 인용구)** ③ 이어서 쓰기 ④ **오늘의 기록(목표 게이지+주간 그래프)** ⑤ 최근 메모.
- **유지 정합**: 이어서 쓰기(재진입=핵심)·최근 메모(맥락). 데이터 있음(`ProjectCardView.lastSentence`/`nextScene`).
- **충돌**: streak·목표 게이지·주간 그래프 → 효율·게이미피케이션 + **데이터 없음(연속일/일일목표/주간 집계 백엔드 신규 필요)** + anti-ref("카드 그득한 SaaS 대시보드"). 자동 인용구 → "마찰 설계 > 자동화" 위배.

### 2-3. 내용 방향 확정 = **A. 재진입 허브** ✅
목업(`dashboard-reentry-hub.html`)을 보여주고 내용 방향을 물어 **A 채택**(2026-06-10). 더 이상 내용 방향은 미정 아님.
- **A. 재진입 허브** (채택) — 인사+날짜 / 이어서 쓰기(최대 타일) / 작품 빠른진입 / 최근 곁쪽지. streak·목표·그래프·자동인용구 제외. 백엔드 0.
- ~~B. 절충(이번 주 시간 한 줄)~~ / ~~C. 더 손보기~~ — 미채택.

**→ 다음 세션 첫 액션: 내용은 A로 고정. brainstorming의 *잔여 결정*(§2-4: 디자인 시스템·데이터 매핑·`/`→`/library` 영향)만 마무리 → design doc → speckit.**

### 2-4. 아직 미확정(브레인스토밍 잔여)
- 내용 방향 A/B/C (위).
- 디자인 시스템: **`desktop-app.css` 웜 토큰 재사용 권장**(accent=잉크블루 `oklch(0.470 0.125 252)`, 종이=크림). 시안의 Tailwind/Material/blue는 시각 참고만(017이 03-studio를 참고만 한 것과 동일).
- 데이터 출처별 IPC/쿼리 훅 매핑(이어서쓰기=`useProjectCards`/`lastSentence`, 최근메모=`useInboxMemos` 등) — design 단계 data-model에 명시.
- 작품 벽 `/`→`/library` 이동의 영향 범위(Rail `Rail.tsx`, `rememberLastProject`, 홈 링크들) — design에서 정리.

---

## 3. 검증된 코드 사실 (재확인 불필요, grep 1회 권장)

- 대시보드 데이터 후보:
  - `frontend/src/lib/projectView.ts` — `ProjectCardView { id, title, lastSentence, nextScene }`. 작품 카드 = `useProjectCards()`.
  - `frontend/src/lib/query/useMemos.ts` — `useInboxMemos()`(전역 곁쪽지), `useProjectMemos(id)`.
  - `frontend/src/lib/query/useLogs.ts` — work_session/log 데이터(012). streak·일일목표 집계는 **없음**.
- 현재 홈/네비:
  - `frontend/src/app/page.tsx` — 작품 벽(ProjectsWallPage). `/library` 이동 시 라우트 신설.
  - `frontend/src/components/workspace/Rail.tsx` — 화면 전환 네비(작품/집필/메모/기록/문의 + 잉크 한 방울). 대시보드 항목 추가·작품 경로 변경 지점.
- 토큰: `frontend/src/styles/desktop-app.css` `:root` OKLCH 웜 토큰(`--bg`/`--surface`/`--paper`/`--scrap`/`--ink`/`--muted`/`--hairline`/`--accent`=잉크블루/`--radius`). 다크는 `.dark`(또는 `prefers-color-scheme`) variant.

---

## 4. 제약 / HARD-GATE (대시보드 구현 시)

- **제품 원칙 우선** — anti-ref "카드 그득한 SaaS 대시보드" 금지. 효율·게이미피케이션 타일은 사용자가 명시 선택(B/시안)하지 않는 한 제외. "조용한 작업실 입구"가 목표.
- **AI·자동 생성 금지** — 자동 인용구 등 "마찰 설계 > 자동화" 위배 요소 배제.
- **백엔드 변경 최소** — A안은 0. 효율 지표 채택 시에만 백엔드 집계 신설(별도 spec 권장).
- **웜 토큰 재사용** — 시안의 별도 디자인 시스템 이식 X, `desktop-app.css` 계승.
- **한국어 1차 / 접근성 AA / 신규 패널 'use client' + 작성 직후 `pnpm build`(RSC) / TDD / 빌드·테스트 포어그라운드** (017과 동일 규율).
- `docs/qa/2026-06-09-frontend-full-qa.md`는 본 작업과 무관한 기존 미추적 파일 — 커밋에 미포함.

---

## 5. 실행/검증 환경

- Node 24.14.0 + pnpm 8.15.5(corepack). `cd frontend`. dev: `pnpm dev`(포트 3000 이미 사용 시 자동 3001 — 단 같은 디렉터리 dev 중복 기동은 "another dev server" 종료됨, 기존 3000 사용).
- 게이트: `node_modules/.bin/vitest run` · `tsc --noEmit`(기존 1건 무시) · `eslint src` · `pnpm build`.
- 시각 검증: 정적 목업 HTML + `desktop-app.css` 링크 + headless Chrome(`--blink-settings=preferredColorScheme=1` 라이트 강제) 스크린샷.

---

## 6. 다음 세션 진입 순서 (요약)

1. 본 핸드오프 + `PRODUCT.md` + 목업 HTML(`dashboard-reentry-hub.html`) 확인. **내용 방향은 A 고정**(§2-3).
2. brainstorming **잔여 결정만 마무리**(§2-4): (a) 웜 토큰 재사용 확정 (b) 타일별 데이터 출처→쿼리 훅 매핑(이어서쓰기=`useProjectCards`/`lastSentence`, 작품=`useProjectCards`, 최근곁쪽지=`useInboxMemos`) (c) `/`→`/library` 이동 영향(`page.tsx`·`Rail.tsx`·홈 링크·`rememberLastProject`).
3. design doc `docs/superpowers/specs/2026-06-1X-dashboard-hub-design.md` 작성(A안 확정 반영) → 사용자 리뷰.
4. speckit specify→plan→tasks→analyze→implement (017과 동일 흐름).
5. 별도: 017 라이브 dogfooding(T024/T025)·Scope A/B develop merge 결정(사용자 영역)·vault 02-PROGRESS 동기(Scope A/B 미반영 상태).

---

## 7. 범위 밖 / 후속

- 작품별 대시보드(옛 spec 2026-05-31, 프로젝트 상세 재진입 허브) — 전역 대시보드와 별개. 후속.
- 영감 보드(Inspiration, 시안 04) · Library 정식 재구성 · 효율 지표 백엔드(streak/목표/주간) — 각각 별도 spec.
