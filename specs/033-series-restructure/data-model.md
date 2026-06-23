# Data Model: 시리즈 중심 재구성 (Phase 1)

**Feature**: 033-series-restructure | **Date**: 2026-06-22

## 운영 스키마 기준선 (R0 실측, 2026-06-22)

- 운영 DB = **V19까지 적용, V20(032) 미적용**(`projects.category_id` 부재로 확인; `paper_size`·`layout_mode` 존재).
- 따라서 배포 시 **V20(032 categories + projects.category_id) + V21(033 시리즈 메타)** 가 운영에 **처음 함께 적용**된다. 기존 작품 6개는 전부 미분류(`category_id IS NULL`)로 시작.
- 본문: 모든 작품이 **활성 본문 정확히 1개**(최대 1, 0개 작품 0). soft-deleted 본문 1개 존재.
- 결론: 챕터 1:1 회귀는 데이터 보강 마이그레이션 없이 안전. effective 판형은 초기 전부 fallback.

## 엔티티 변경

### Category (시리즈) — 확장 (V21)

기존(V20) + 출판 메타 컬럼 추가. **전부 nullable**(Clarify Q1: 시리즈 판형 선택).

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| (기존) id, user_id, name(60), parent_id, sort_order, created_at, updated_at | — | — | 032 |
| `paper_size` | VARCHAR(16) | NULL | 시리즈 판형(미설정 시 하위 작품 기본값). 식별자는 031 정의(ISO 4 + 출판 4) |
| `layout_mode` | VARCHAR(16) | NULL | 시리즈 출판방식 `paper`/`web`(미설정 시 기본값) |
| `genre` | VARCHAR(100) | NULL | 시리즈 장르 |
| `synopsis` | TEXT | NULL | 시리즈 줄거리 |
| `target_length` | INTEGER | NULL | **시리즈 총 목표 분량**(하위 작품 글자수 합산 진척 기준) |

**검증**: `layout_mode` 값은 `paper`/`web` 중 하나(null 허용). `paper_size`는 031 허용 식별자 집합(null 허용). 기존 Category 검증(name 비어있지 않음, parentId null 강제)은 유지.

### Project (작품) — 컬럼 보존, 논리적 재배치

스키마 변경 **없음**(additive·무손실). 컬럼의 *사용*만 바뀐다.

| 컬럼 | 처리 | 근거 |
|---|---|---|
| `tone_notes`, `world_notes`, `next_scene` | **보존**, UI 노출만 제거 | FR-013/014 (데이터 보존) |
| `paper_size`, `layout_mode` | **보존하되 effective 해석에서 미사용**(작품 자체 판형으로 안 씀) | FR-009 미분류=시스템 기본값. DROP 안 함(무손실·롤백) |
| `genre`, `synopsis` | **보존하되 미사용**(시리즈 값으로 대체 표시) | 무손실. 향후 여지 |
| `target_length` | **유지·계승**(작품 단위 목표) | FR-017 |
| `category_id` | 유지(032) | 시리즈 소속 |
| `font_scale`, `archived_at` | 무관, 유지 | — |

> Project 컬럼을 DROP하지 않는 것이 본 plan의 무손실 핵심. 화면·effective 로직에서 "안 읽을" 뿐 데이터는 영속.

### Document (본문) — 앱 레벨 1:1, 스키마 보존

스키마 변경 **없음**. `sort_order`·`deleted_at` 컬럼 **보존**.

| 변화 | 내용 |
|---|---|
| 관계 | 작품 1 : N → **앱 레벨 1 : 1**(활성 본문 1개). 물리 제약은 추가 안 함(기본) |
| 채택 규칙 | 작품 본문 = `deleted_at IS NULL` 인 본문(작품당 1개 보장 — R0 실측). soft-deleted 본문은 조회 제외·보존 |
| 생성 | 작품 생성 시 본문 1개 동반 생성(기존 유지) |
| 컬럼 | `sort_order`/`deleted_at` DROP 안 함(롤백·무손실). 미사용 전환 |

**조건부 V22 (기본=없음)**: 무결성 강제를 원하면 `CREATE UNIQUE INDEX ... ON documents(project_id) WHERE deleted_at IS NULL`(데이터 파괴 0). R0에서 활성 본문 최대 1 확인됨 → 기본 plan은 V22 생략, 코드 레벨 1:1로 충분.

## 파생/계산 값 (응답 시 해석, 저장 안 함)

### Effective 판형/출판방식 (Project 응답)

```
effectivePaperSize  = (categoryId != null && category.paperSize != null) ? category.paperSize : "A4"
effectiveLayoutMode = (categoryId != null && category.layoutMode != null) ? category.layoutMode : "paper"
```

- 시스템 기본값 상수 `"A4"`/`"paper"` = 현행 Project default 재사용(렌더 연속성).
- `ProjectResponse`·`ProjectCardResponse`에 `effectivePaperSize`·`effectiveLayoutMode` 필드 추가(additive). 기존 `paperSize`/`layoutMode` 필드는 하위호환 위해 당분간 유지하되 FE는 effective로 전환.

### 시리즈 진척 (Category 응답)

```
totalWordCount = Σ word_count of (active documents of non-archived projects where category_id = this)
progress       = targetLength 있으면 totalWordCount / targetLength, 없으면 "목표 없음"(FE 처리)
```

- `CategoryResponse`에 `totalWordCount`·`targetLength` 추가. 0 나눗셈/null 가드는 FE(FR-018).

## 마이그레이션 순서 (배포)

```
운영 현재: V19
배포 적용: V20 (032 — categories 테이블 + projects.category_id FK ON DELETE SET NULL)   ← 032가 buffer에 도입
           V21 (033 — categories에 paper_size/layout_mode/genre/synopsis/target_length nullable 추가)
           (V22 생략 — R0상 불필요)
```

- 모든 마이그레이션 **작성·리뷰만**, 로컬/운영 적용은 사용자 컨펌(external-infra-safety §1).
- V21은 순수 additive(nullable 컬럼) → 기존 시리즈(운영엔 0개) 무영향.

## 상태 전이 / 무손실 체크포인트

| 시나리오 | 보장 |
|---|---|
| 챕터 제거 | 활성 본문(작품당 1) 그대로 단일 본문. 텍스트 유실 0 (FR-003) |
| 톤류 화면 제거 | tone_notes/world_notes/next_scene 컬럼·값 보존 (FR-014) |
| 작품 시리즈 이동 | category_id만 변경 → effective 판형 재해석. 본문 불변 (FR-022) |
| 시리즈 판형 미설정 | effective = 기본값. 하위 작품 정상 렌더 (FR-021) |
| 시리즈 삭제(032 계승) | `ON DELETE SET NULL` → 작품 보존·미분류화 → effective 기본값 |
