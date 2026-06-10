# 대시보드 허브 (재진입 허브) — 설계

> **작성일**: 2026-06-10 · **브랜치**: `feat/studio-three-panel`
> **전제**: 내용 방향 **A. 재진입 허브** 사용자 확정(2026-06-10, 재논의 없음). IA = `/`가 새 홈(대시보드), 기존 작품 벽 → `/library`.
> **목업**: `docs/design/web/mockups/dashboard-reentry-hub.html` (ghost 타일 "이번 주 집필 시간"은 미채택 — 구현 제외)
> **원칙**: PRODUCT.md — "카드 그득한 SaaS 대시보드" 금지 / 효율·게이미피케이션 배제 / AI·자동 생성 배제 / "조용한 작업실 입구"

---

## 1. 화면 구성 (A안 그대로)

`/` 진입 시 위에서 아래로 4 블록. 모두 읽기 전용 + 진입 동작만(이 화면에서 편집하지 않는다 — 유일한 예외 없음, 벽의 "다음 장면" 인라인 편집도 대시보드에는 두지 않는다).

| # | 블록 | 내용 | 동작 |
|---|---|---|---|
| ① | 인사 + 날짜 | 인사 한 줄 + "YYYY년 M월 D일 X요일" | 없음(정적) |
| ② | 이어서 쓰기 | **최근작 1편** 최대 타일: 제목 + 마지막 문장(세리프 인용) + 다음 장면 한 줄 + "N시간 전 저장 · N자" + [이어서 쓰기 →] | 타일/버튼 → `/projects/{id}/write` |
| ③ | 작품 | 최근작 **제외** 나머지 작품 미니 카드(제목 + 마지막 문장 2줄 클램프) + "+ 새 작품" 카드 | 카드 → 집필실, 새 작품 → `/library?new=1` |
| ④ | 최근 곁쪽지 | 최신 곁쪽지 **2장**(쪽지 톤 `--scrap` 카드: 본문 + 상대 날짜) | 카드 → `/memos` |

- 인사말에 **이름을 쓰지 않는다** — 검증 결과 사용자 이름 데이터가 없다(`AuthMeResponse` = userId/email/kakaoLinked뿐, nickname 부재. 목업의 "나래님"은 더미). 이메일 앞부분 표시는 정서에 어긋나 배제. 카피 예: "안녕하세요." / 날짜 밑 한 줄("오늘도 곁에 있을게요")은 목업 유지.
- streak · 목표 게이지 · 주간 그래프 · 자동 인용구 · ghost 타일 — **전부 제외**(확정).

## 2. 데이터 매핑 — 타일별 출처 (표시값 출처 명시, agent-discipline §9)

| 표시값 | 분류 | 출처 |
|---|---|---|
| 인사·날짜 | 클라 정적 | `new Date()` 한국어 포맷(외부 데이터 0) |
| 최근작 선정 | 파생 | `useProjectCards()` 결과를 **문서 저장 시각(`docUpdatedAt`, 신규 — §3) 내림차순** 정렬, 첫 번째 = 이어서 쓰기, 나머지 = 작품 미니 카드 |
| 제목·다음 장면 | 저장 입력 | `ProjectCard.title` / `ProjectCard.nextScene` (기존) |
| 마지막 문장 | 파생 표시 | `lastSentence(card.lastSentenceSource)` — 단 **현재 listCards 가 placeholder(빈 문자열)라 §3 선행 필요** |
| "N시간 전 저장" | 파생 표시 | `docUpdatedAt`(문서 저장 시각, 신규) → 상대 시간. `project.updatedAt`은 메타 변경 시각이라 "저장" 표기에 부적합 — 미사용 |
| "N자" | 파생 표시 | `wordCount`(문서 글자수, 신규 — §3) |
| 최근 곁쪽지 | 저장 입력 + 파생 라벨 | `useInboxMemos()` → `capturedAt` 내림차순 상위 2 + `memoView.ts`의 `formatRelativeDay` 재사용 |

**백엔드 변경 0** — 전부 기존 endpoint + 클라 조립(014 R6 정합).

## 3. 선행 격차 해소 — `listCards()` 마지막 문장 placeholder (핵심 발견)

**현황(코드 사실)**: `frontend/src/lib/electron-api/projects.ts:39`의 `listCards()`가 `lastSentenceSource: ""` placeholder를 반환한다("US1 에서 채운다" 주석만 남음). 그 결과 **작품 벽의 마지막 문장도 현재 전부 "아직 첫 문장을 기다리는 중"으로 표시**된다. 015 data-model §1은 `ProjectCard = GET /api/projects + document fetch + 클라 파생`으로 명시했으므로 이는 의도된 보류가 아니라 **구현 격차**다(핸드오프 §3 "데이터 있음"은 타입 기준 서술 — 값은 빈 상태).

**해소(본 설계에 포함)**: `listCards()`를 `logs.list()`와 동일 패턴으로 채운다 —

```
listCards = listProjects(size:100) 후 작품별 getProjectDocument(id) 병렬 fetch
  → lastSentenceSource = extractPlainText(doc.body)
  → ProjectCard 에 wordCount: number, docUpdatedAt: string 필드 추가
```

- 효과: 대시보드(②③)와 **작품 벽이 한 번에** 015 설계대로 동작. N+1은 `logs.list()` 전례(베타, 작품 소수 전제) 그대로 수용.
- 캐시: 대시보드·벽 모두 `projectKeys.cards()` 공유 — 화면 이동 시 재호출 없음.
- 영향 파일: `electron-api/projects.ts`(+테스트), `types/domain.ts`(ProjectCard 필드 2개 추가 — 기존 소비처는 추가 필드라 비파괴).

대안 비교(기각): (B) 이어서 쓰기 타일만 문서 1건 fetch — 미니 카드·벽의 빈 문장 방치, 목업 미충족. (C) 대시보드 전용 집계 신설 — 벽과 데이터 경로 이원화 + 벽 격차 방치. → **A 채택**(015 설계 의도 완성 + 완성도 우선).

## 4. 라우팅 · Rail 재편 (`/` → `/library` 영향 전수)

### 4-1. 라우트
- `src/app/page.tsx` → **신규 대시보드**(`'use client'` + `useAuthGuard("requireAuth")` + `.app` 셸(Rail+Titlebar) 유지).
- 기존 ProjectsWallPage → `src/app/library/page.tsx` 이동(내용 불변). `?new=1` searchParam이면 create 모드로 진입(③ "+ 새 작품" 진입로. Next 16 App Router에서 `useSearchParams`는 Suspense 경계 필요 — plan 단계에서 처리).

### 4-2. Rail (`components/workspace/Rail.tsx`)
| 항목 | 변경 |
|---|---|
| **홈** (신규, 최상단) | `href:"/"`, `match: p === "/"` — 대시보드 진입점 |
| 작품 | `href:"/" → "/library"`, `match: p === "/" → p.startsWith("/library")` |
| 집필 | fallback `push("/")` 유지 — 마지막 작품 없으면 대시보드(재진입 허브가 그 역할) |
| 메모·기록·문의·잉크 한 방울 | 불변 |

Titlebar 제목: 대시보드 = **"홈"**(Rail 라벨과 통일), library = "작품"(기존 유지).

### 4-3. 기존 `"/"` 참조 전수 (grep 검증 완료)
| 위치 | 처리 |
|---|---|
| `projects/[id]/write/page.tsx:81` 작업 종료 후 `push("/")` | **유지** — 세션 종료 후 귀환점 = 대시보드(허브 취지 부합) |
| `projects/[id]/write/page.tsx:220` "작품 벽으로" 버튼 | `push("/library")`로 변경(라벨-목적지 정합) |
| `projects/[id]/page.tsx:45,63` (006 레거시 상세) | 유지 — `/` = 홈으로 자연 동작 |
| `LoginForm.tsx:37` 로그인 후 `push("/")` | 유지 — 로그인 직후 대시보드 |
| `auth/guard.ts:40` requireAnon → `replace("/")` | 유지 |
| `not-found.tsx` / `auth/verify-done` `href="/"` | 유지 |
| `lastProject.ts` (`rememberLastProject`) | **불변** — 집필실 진입 시 기록하는 기존 동작 그대로. 대시보드는 이 값을 쓰지 않고 `docUpdatedAt` 정렬로 최근작을 정한다(localStorage 의존 없이 기기 간 일관) |

## 5. 빈 상태

| 상황 | 표시 |
|---|---|
| 작품 0 | ②③ 대신 환영 블록(벽의 `welcome` 톤 재사용) + "첫 작품 시작하기" → `/library?new=1` |
| 작품 있으나 본문 0 | 마지막 문장 자리 = "아직 첫 문장을 기다리는 중"(벽과 동일 카피) |
| 다음 장면 빈 문자열 | 그 줄 숨김 |
| 작품 1편뿐 | ③에 "+ 새 작품" 카드만 |
| 곁쪽지 0 | ④ 라벨 유지 + "아직 곁쪽지가 없어요" 한 줄(조용한 빈 상태) |
| 로딩/에러 | 벽과 동일 패턴(skel / 재시도 버튼) |

## 6. 스타일 — 웜 토큰 재사용 (확정)

- 목업의 대시보드 클래스(`.dash-*`, `.resume*`, `.work-card*`, `.memo-card*`)를 **`desktop-app.css`로 이관**, 값은 전부 기존 토큰(`--bg/--paper/--surface/--scrap/--scrap-edge/--scrap-ink/--hairline/--accent/--radius/--radius-sm/--shadow-paper`) 계승 — 전 토큰 존재 grep 확인 완료. 다크는 `.dark` variant 토큰이 자동 적용.
- 시안(`01-dashboard.html`)의 Tailwind/Material/blue 는 시각 참고만 — 이식하지 않는다.
- 접근성: 대비 AA(특히 `--muted` 텍스트), 모든 진입 동작은 button/link 시맨틱 + 포커스 가시화, `prefers-reduced-motion` 시 등장 애니메이션 제거.

## 7. 컴포넌트 분해 · 테스트 (TDD)

| 단위 | 책임 | 테스트 |
|---|---|---|
| `lib/dashboardView.ts` (신규, 순수) | `ProjectCard[]` → `{ resume, others }` 정렬·선정 + 상대시간 포맷 | vitest 단위(빈 배열/1편/동시각/본문 0) — **선작성** |
| `electron-api/projects.ts` `listCards` | 문서 병렬 fetch + 파생 채움(§3) | 기존 electron-api 테스트 패턴으로 집계 검증 — **선작성** |
| `components/dashboard/ResumeCard.tsx` | ② 표시 전용(props만) | RTL 행위(제목/문장/빈 상태) |
| `components/dashboard/WorkMiniCard.tsx` | ③ 카드 표시 전용 | RTL |
| `app/page.tsx` (대시보드) | 훅 호출 + 조립 + 빈 상태 분기 | RTL 통합(쿼리 mock) |
| `app/library/page.tsx` | 기존 벽 + `?new=1` create 진입 | 기존 테스트 이동 + searchParam 1건 |
| `Rail.tsx` | §4-2 재편 | 기존 테스트 보강(있으면) |

게이트(017 동일): vitest → `tsc --noEmit`(기존 `documents.test.ts` 1건 무시) → `eslint src` → `pnpm build`(RSC, **작성 직후**). 빌드·테스트 포어그라운드. 기존 무관 부채(`documents.test.ts`·`page.tsx:107` lint)는 불변.

## 8. 범위 밖

- 효율 지표 백엔드(streak/목표/주간) · 영감 보드 · Library 정식 재구성 · 작품별 대시보드(옛 2026-05-31 spec) — 각각 별도 spec.
- 메모 delete/restore 등 015 보류 트랙 — 불변.
