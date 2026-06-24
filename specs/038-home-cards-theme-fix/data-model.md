# Phase 1 Data Model: 038

## US1 — ProjectCard (작품 카드)

홈/보관함에 표시되는 작품 요약. **표시값 출처**(CLAUDE.md §9)를 명시한다.

| 필드 | 출처 | 현재 존재 | 본 작업 |
|---|---|---|---|
| `title` | 저장 입력(작품 제목) | ✅ | 사용 |
| `categoryId` | 저장 입력(시리즈 식별자, nullable=미분류) | ✅ | 사용 |
| **`categoryName`** | 파생(categories.name, categoryId→name 매핑) | ❌ | **추가(additive)** |
| `lastSentenceSource` | 파생(최근 수정 활성 챕터 본문 평문) | ✅ | 표시(기존 1~2줄 자르기 유지) |
| `documentUpdatedAt` | 파생(최근 활성 챕터 updatedAt) | ✅ | 최종 수정일 표시(신규 노출) |
| `createdAt` | 저장 입력(작품 생성 시각) | ✅ | 호버 표시(신규 노출) |
| `totalDurationMs` | 파생(종료 세션 시간 합, 타임워치) | ✅ | 호버 표시(신규 노출) |
| `wordCount`, `effectivePaperSize`, `effectiveLayoutMode` | 파생/저장 | ✅ | 불변 |

**검증 규칙 / 관계**:
- `categoryName`은 `categoryId`가 null이면 null(미분류). 프론트에서 null → "미분류" 라벨.
- `categoryName`은 작품이 속한 **단일** 시리즈명(작품 1개는 시리즈 0~1개, 032/033 모델).
- additive: 기존 필드/순서 불변, 기존 소비자 무영향.

**정렬(불변)**: `documentUpdatedAt` 내림차순, 동률 시 `id` 내림차순(`dashboardView.selectDashboard`). 본 작업은 표시 개수/정보만 변경.

## US1 — Category (시리즈)

기존 엔티티. 본 작업은 **읽기만**(name 조회). 스키마 변경 0.

- `id`, `name`(표시 대상), `userId` 등 기존 필드.
- 관계: `Project.categoryId` → `Category.id` (nullable, ON DELETE SET NULL — 032).

## US2 — 테마/설정 (데이터 변경 없음)

- 테마값 `theme`(light/dark/system)은 기존 `usePreferences` 스토어 + `user_settings` 영속. **스키마·키 변경 0.**
- US2는 **표현(CSS 색상)** 전용 — 데이터 모델 무관. 다크 색상 토큰은 `tokens.css`/`globals.css`의 CSS 변수(데이터 아님).

## 마이그레이션

- **없음.** US1은 기존 `categories.name` 조회, US2는 데이터 무관.
