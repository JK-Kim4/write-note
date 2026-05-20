# Frontend Route & Page Scaffold — Data Model

본 spec 은 새 도메인 entity 를 도입하지 않는다. 본 문서는 **클라이언트 측 상태 모델** 만 다룬다 (서버 측 entity 는 Phase 1A `User` / `Project` 그대로).

## 1. UI Preferences Store (Zustand persist)

DESIGN.md §7 분리 원칙 의 "설정 (영구 환경)" 항목 — 작성 모드, 원고지 크기, 테마, 자동 저장 등 — 을 본 spec 범위에 한정해 박는다.

| 필드 | 타입 | 기본값 | 출처 |
|---|---|---|---|
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | DESIGN.md §6 다크 모드 전 앱 |
| `writingMode` | `'manuscript' \| 'editor'` | `'editor'` | DESIGN.md §핵심 UX 결정 §1 |
| `manuscriptSize` | `200 \| 400 \| 1000` | `400` | DESIGN.md §핵심 UX 결정 §2 |

- 영속 mechanism: `zustand` middleware `persist` → localStorage key `writenote.preferences.v1`
- Version 1 prefix 의무 — 후속 phase 에서 스키마 추가 시 migration 가능
- 자동 저장 ON/OFF 등 추가 preference 는 Week 3 (작성 + 자동 저장 phase) 에서 합류

## 2. Auth Session Placeholder (Zustand)

Phase 1A 의 임시 `X-User-Id` ownership 메커니즘과 정합. Week 1B-1~2 에서 JWT 기반으로 swap.

| 필드 | 타입 | 기본값 | 출처 |
|---|---|---|---|
| `userId` | `string \| null` | `null` | Phase 1A spec.md §FR-018 |

- 영속 mechanism: localStorage key `writenote.auth.placeholder.v1` (Week 1B 진입 시 폐기 + httpOnly cookie 기반 JWT 로 swap)
- dogfooding 시 임시 user id 설정 UI (설정 페이지의 hidden dev 영역 또는 인증 surface 의 임시 폼) 제공 — Week 1B 도래 시 일괄 제거
- 본 placeholder 는 **인증 흐름의 시각 검증만 위한 신호** — 실제 세션/토큰/만료 의미 없음

## 3. Transient UI Store (Zustand, persist 없음)

세션 범위 임시 상태. localStorage 영속 X.

| 필드 | 타입 | 기본값 | 출처 |
|---|---|---|---|
| `sidePanelOpen` | `boolean` | `true` | DESIGN.md §에디터 사이드 패널 |
| `currentWritingScroll` | `number` | `0` | 작성 ↔ 미리보기 ↔ 작성 복귀 시 스크롤 보존 (FR-008) |

후속 phase 에서 transient state 가 추가될 때 본 store 에 합류.

## 4. Server State (React Query)

본 spec 은 Phase 1A `/api/projects` 에 placeholder query 1 건만 박는다 (FR-020 검증용). 풀 사용은 Week 2 (Project CRUD UI).

### Query: `useProjects`

```
queryKey: ['projects', { page: 0, size: 20 }]
queryFn: api.projects.list({ page: 0, size: 20 })
응답 타입: Page<ProjectResponse>   // Phase 1A contract 와 정합
캐시: 기본 staleTime / gcTime (placeholder — Week 2 에서 조정)
```

- 본 spec 의 사용처: `app/page.tsx` 의 홈 동적 변형 분기 (프로젝트 카운트 0 → H0, 1+ → 일반 홈)
- placeholder 데이터: Phase 1A backend 가 빈 상태로 응답하면 `totalElements: 0` → H0 외관 활성화

### ProjectResponse (Phase 1A contract 인용)

```
{
  id: string (UUID),
  userId: string (UUID),
  title: string,
  archived: boolean,
  createdAt: string (ISO-8601),
  updatedAt: string (ISO-8601),
}
```

- `genre`, `targetLength`, `toneNotes`, `synopsis`, `worldNotes` 는 Week 2 합류
- 본 spec 시점에는 placeholder card 외관만 — 실제 데이터 표시는 Week 2

### Page<T> (Phase 1A contract 인용)

```
{
  content: T[],
  totalElements: number,
  totalPages: number,
  number: number,    // 현재 page (0-based)
  size: number,
}
```

## 5. 상태 전이

본 spec 단계에서 의미 있는 상태 전이:

### 5-1. 테마 전이

```
system → (사용자 토글) → light → dark → system → ...
        (OS 변경 감지)       (system 일 때만)
```

- `theme === 'system'` 일 때 `usePreferences` hook 이 `prefers-color-scheme` MediaQueryList 구독
- 토글 순서는 `ThemeToggle` UI 가 결정 (정확한 순서는 plan-implement 단계 영역)

### 5-2. 작성 모드 전이

```
editor → (설정에서 manuscript 선택) → manuscript → ...
```

- 작성 모드 변경 = `app/settings/page.tsx` 의 작성 모드 카드 선택
- `/write` 진입 시 `writingMode` 값에 따라 layout 분기
- DESIGN.md §핵심 UX 결정 §1 — top bar 에 모드 토글 없음

### 5-3. 인증 placeholder 전이

```
null → (개발자가 임시 id 설정) → "dev-user-id" → ...
     (라우트 가드: 메인/작성/메모/설정 진입 차단)
     (Week 1B 진입 시 일괄 폐기 + JWT 로 swap)
```

## 6. 검증 규칙

- `theme` 값은 `'light' | 'dark' | 'system'` 만 허용 — Zod 또는 union narrow 적용
- `writingMode` 값은 `'manuscript' | 'editor'` 만 허용
- `manuscriptSize` 값은 `200 | 400 | 1000` 만 허용
- `userId` 는 `null` 또는 비어있지 않은 string — `''` 빈 string 은 `null` 로 정규화
- localStorage 직접 조작 (사용자가 DevTools 등) 시 invalid 값 검증 → `persist` 의 `migrate` 또는 schema validator 로 reset

## 7. 후속 phase 합류 예정

본 spec 영역 밖이나 본 데이터 모델이 후속 phase 합류에 호환되도록 설계됨:

- `Document` (Week 3) — TipTap body, word_count, updated_at
- `Memo` (Week 4) — body, source, captured_at, reason_note, tags, pinned_position
- `Character` (Week 2) — name, short_description, notes
- `SessionNote` (Week 5) — body, ended_at, word_count_at_end
- `ApiToken` (Week 4) — 모바일 캡처 토큰

이들은 모두 Phase 1A → Week N 의 backend 측 entity 가 박힌 후 클라이언트 React Query / Zustand 모델 추가.
