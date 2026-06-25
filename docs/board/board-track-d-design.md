# 트랙 D 설계 — 카드 종류 4종 정합 + 종류 progressive disclosure + UX 안전망

| 항목 | 내용 |
|------|------|
| 문서 상태 | v1 (brainstorming 확정) |
| 작성일 | 2026-06-25 |
| 브랜치 | `038-memo-plot-board` (보드 트랙 누적, develop merge 보류) |
| 함께 보는 문서 | `board-roadmap.md` §5-D · `board-prd.md` §3·§11(2) · `board-ux-worksheet.md` TASK-3·6 |
| 목업 | `docs/research/2026-06-25-board-card-types-mockup.html` (무지정 A·칩 위치 C 채택) |
| 무게 | 가벼움 (BE 종류모델 변경 + FE 칩 UI·안전망, undo/redo 제외) |

> 본 문서는 트랙 D 설계 SoT. brainstorming 결론을 compact 내성 위해 박는다. 충돌 시 PRD/UX 가 상위.

---

## 0. 확정 결정 (brainstorming 2026-06-25)

1. **카드 종류 4종**: 인물(character)·장소(place)·사건(event)·테마(theme). 현 `plot/플롯·사건`→`event/사건` 이름 교체(의미 동일), `note/메모` 폐기.
2. **기본 무지정(null)**: 생성 시 종류 안 묻기. 종류 없는 빈 카드로 생성.
3. **종류 부여 = 생성 후 칩**(progressive disclosure): 카드 선택 시 "이건 뭔가요?" 칩 4개 노출, 한 탭=부여, 재탭=무지정 해제. 낙관적 업데이트.
4. **무지정 카드 외관 = 중립 회색 채움(A안)**: slate-50 배경 + slate-200 테두리 + "종류 없음" 옅은 배지(slate-100/500) + slate-400 핸들. 4종과 같은 "옅은 틴트" 문법.
5. **종류 선택 칩 위치 = 카드 우측 세로 플로팅(C안)**: 선택 시 카드 오른쪽에 세로 칩 트레이. ⚠️ 우측 핸들(연결점)과 충돌 주의 → 트레이를 핸들 바깥에 배치, dogfooding 확인.
6. **UX 안전망 2건**: "한눈에 보기" 한글 버튼 + 미니맵 토글. **undo/redo 제외**(무게 큼 → 별도 트랙 후보).

## 1. 색 매핑 (새 색 추가 0 — 트랙 B 팔레트 승계)

| 종류 | 코드 | 계열 | bg(-50) | border(-200) | badge(bg-100/text-700) | handle(-400) | selected(border-500/ring-200) |
|---|---|---|---|---|---|---|---|
| 인물 | character | teal | #ecf5f8 | #a3cdd9 | #cfe6ed / #0a5c79 | #3d8aa3 | #1c7791 / #a3cdd9 |
| 장소 | place | emerald | #ecfdf5 | #a7f3d0 | #d1fae5 / #047857 | #34d399 | #10b981 / #a7f3d0 |
| 사건 | event | terracotta | #fbf3ee | #ecc7ad | #f6e3d6 / #8a4325 | #d48d62 | #c77a4f / #ecc7ad |
| 테마 | theme | violet | #f5f3ff | #ddd6fe | #ede9fe / #6d28d9 | #a78bfa | #8b5cf6 / #ddd6fe |
| (무지정) | null | slate | #f8fafc | #e2e8f0 | "종류 없음" #f1f5f9 / #64748b | #94a3b8 | #64748b / #e2e8f0 |

- `event`는 폐기되는 `plot`의 terracotta 그대로. 무지정은 폐기되는 `note`의 slate 회색을 "종류 없음" 기본으로 전용. Tailwind 클래스 리터럴(JIT 안전).

## 2. 백엔드 변경 (BE 선행)

### 2-1. 마이그레이션 — V25 in-place 편집
- 현재 `V25__add_card_type.sql`: `ALTER TABLE cards ADD COLUMN type VARCHAR(16) NOT NULL DEFAULT 'plot';`
- 변경: **`type VARCHAR(16)`**(nullable, DEFAULT 제거). 무지정 = NULL.
- 보드 미배포(develop·main 부재) → in-place 편집 가능. 로컬 dev DB 리셋 필요(board 3테이블 drop + flyway history 행 삭제 + 재마이그레이션, **사용자 컨펌 후**). 트랙 B/C 동일 패턴.
- ⚠️ BE 게이트는 공유 로컬 Docker PG 사용 → 게이트 실행 전 로컬 DB 정합(리셋) 선처리(트랙 B 회고 §5-1).

### 2-2. BoardService
- `ALLOWED_CARD_TYPES = setOf("character", "place", "event", "theme")` (plot·note 제거, event 추가)
- `DEFAULT_CARD_TYPE` **제거**.
- `normalizeCardType(value: String?): String?` — null이면 null 반환(무지정), 값 있으면 4종 검증, 외 값 `ValidationException`(기존 재사용). 기존 `value ?: DEFAULT` 폴백 제거.
- `createCard`: `type = normalizeCardType(request.type)` (null이면 null 저장).

### 2-3. 종류 변경/해제 — 전용 경로 신설
- 문제: 기존 `updateCard`의 `request.type?.let`는 null=변경스킵이라 **무지정 해제(null로 set) 불가**.
- 해결: **종류 전용 PATCH `PATCH /api/boards/{boardId}/cards/{cardId}/type`**, body `{ "type": "character" }` 또는 `{ "type": null }`. `type=null`이 명시적 무지정 해제(다른 필드 없어 3-state 모호성 0).
- `updateCard`(body/position)에서 **type 처리 제거**(종류는 전용 경로로 일원화). `UpdateCardRequest.type` 제거.
- 신규 `UpdateCardTypeRequest(val type: String?)`. service `setCardType(userId, boardId, cardId, type): CardResponse`.

### 2-4. 엔티티·DTO
- `Card.type`: `String = "plot"` → **`String? = null`**.
- `CardResponse.type`: `String` → **`String?`**. converter `toCard` 그대로 매핑(nullable 전파).
- `CreateCardRequest.type`: 이미 `String? = null`(생략=무지정) — 변경 없음.

## 3. 프론트 변경 (FE 후행)

### 3-1. cardKinds.ts
- `CardKindId`: `"character" | "place" | "event" | "theme"` (plot·note 제거).
- `CARD_KINDS`: 4종(§1 색). label = 인물·장소·사건·테마.
- `DEFAULT_KIND` 제거. 무지정 표현용 `UNTYPED_KIND`(slate, label "종류 없음") 추가 — 칩에는 안 넣고 카드 외관·배지에만.
- `kindOf(id: string | null | undefined): CardKind` — null/미지정이면 UNTYPED 반환(폴백 'plot' 제거).

### 3-2. CardNode.tsx
- `kind` nullable 처리: 무지정이면 slate 외관 + "종류 없음" 배지.
- **카드 우측 세로 플로팅 칩 트레이**(C안): 인물·장소·사건·테마 세로 칩(헤더 문구 없음 — dogfooding 피드백으로 "이건 뭔가요?" 제거). 부여된 칩은 채움 표시. 탭 = `setCardKind`(낙관적), 재탭(현 종류 칩) = 해제(null). 우측 핸들 바깥(`ml-4`)에 배치해 충돌 회피.
- **트레이 노출 규칙(dogfooding 피드백)**: 무지정 카드만 선택 시 자동 노출(종류 정하기 유도). **종류 지정된 카드는 자동 노출 안 함** — 카드 안 배지(예: "인물")를 클릭해야 트레이가 열려 변경/해제(`trayOpen` 상태, 선택 해제 시 닫힘, 칩 탭 후 닫힘). 종류 부여 즉시 트레이 사라짐.
- 기존 "↗ 연결할 카드 고르기"(잇기) 버튼은 하단 유지(C안 = 본문/잇기와 안 겹침).

### 3-3. PlotBoardCanvas.tsx
- `+ 카드` **드롭다운 제거 → 단일 버튼**(무지정 빈 카드 생성). `handleAddCard()` type 미지정.
- 빈 곳 더블클릭/빈 곳 drop 새 카드도 **무지정**(현 `DEFAULT_KIND` 제거).
- 안전망: Panel에 "한눈에 보기" 한글 버튼(`fitView()`) + 미니맵 토글 버튼(`<MiniMap/>` 조건부, 기본 숨김).

### 3-4. 데이터 계층 (lib/api·electron-api·useBoards)
- `setCardType` API(`PATCH .../cards/{id}/type`) + `useSetCardType` 훅(낙관/롤백 또는 invalidate). Card 타입 `type: string | null`.
- boardActions: `setCardKind(cardId, type|null)` 액션 추가.

## 4. 검증·배포·범위

- **TDD**: `normalizeCardType`(null·4종·외값) BE 순수검증 RED→GREEN. FE `kindOf`(null·4종·미지정) 순수. 칩 트레이 인터랙션·안전망 = dogfooding 게이트.
- **게이트**: BE ktlint·checkstyle·test·build / FE typecheck·lint·test·build.
- **회귀 grep**: 폐기 식별자 0 — `plot`·`note`·`DEFAULT_CARD_TYPE`·`DEFAULT_KIND`·5종 잔존(어댑터/마이그레이션 주석 제외 확인).
- **dogfooding**: 무지정 생성 → 칩 부여(색 즉시) → 재탭 해제 → 4종 색 → 한눈에 보기 → 미니맵 토글 → Track A/B/C 무회귀.
- **배포 순서**: BE 선행(종류 nullable·전용 경로·마이그레이션) → FE 후행. 보드 미배포라 prod 위험 0.
- **범위 밖**: undo/redo(별도 트랙) · 온보딩 코치마크(TASK-7, 우선순위 낮음) · C-2(내부 탭·집필 참조).
- **develop merge**: 트랙 D 완료 후 사용자 확인(보드 A+B+C+D 함께). 038이 develop보다 4커밋 뒤처짐 → 양방향 병합(§18 베이스 정합 선확인).
