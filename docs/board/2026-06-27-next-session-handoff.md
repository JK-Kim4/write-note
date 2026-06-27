# 핸드오프 — 다음 세션: 보드 E 2단계 가져오기 + TASK-1 잔여(TASK-2 힌트·TASK-7 코치마크)

> 다음 세션 첫 메시지로 **§0 프롬프트**를 붙여넣어 사용. 보드의 남은 **두 트랙을 함께** 진행한다.
> 작업 방식 = 각 트랙 **결정 지점 확정(brainstorming) → speckit(specify→plan→tasks→implement)**.

---

## 0. 다음 세션 첫 프롬프트 (복사해서 붙여넣기)

```
보드의 남은 두 트랙을 함께 진행한다: (1) E 2단계 = 메모·인물을 보드 카드로 "가져오기" (2) TASK-1 잔여 = TASK-2 hover "끌어서 잇기" 텍스트 힌트 + TASK-7 첫 진입 코치마크. 자동 진행이 아니라 결정 지점은 사용자와 대화로 확정한 뒤 speckit으로 구현한다.

## 1. 먼저 읽기 (복원)
1. docs/board/2026-06-27-next-session-handoff.md  ← 본 작업 핸드오프(진입점)
2. docs/board/board-track-e-design-draft.md  ← E 가져오기 D1~D6·③ 참조통합 권고·구현 스케치
3. docs/board/board-roadmap.md  §0·§1·§5(트랙 E·TASK-1 잔여)·§7
4. docs/board/board-ux-worksheet.md  TASK-2(L85-113)·TASK-7(L204-207)·§5 COPY(link.hoverHint·cardType.prompt)
5. board-prd.md §0·§2·§7·§12
6. CLAUDE.md 의무: vault ~/obsidian/write-note/02-PROGRESS.md·03-ISSUES.md(ISSUE-051)
7. 코드: frontend CardNode.tsx(Handle hover·선택 인디케이터)·PlotBoardCanvas.tsx·OnboardingTour(driver.js)·죽은 모듈(useMemos·useCharacters·lib/api/memo·lib/api/characters·memoView)·BE 메모/인물 컨트롤러·서비스(보존)·POST /api/capture

## 2. 범위
- 트랙 1 (E 2단계 가져오기, BE+FE): 메모·인물을 보드 카드로 "가져오기". 비파괴 ③ 참조통합 권고. **D1~D6 사용자 결정이 게이트** → brainstorming 먼저.
- 트랙 2 (ISSUE-051 잔여, FE only): TASK-2 hover "끌어서 잇기" 텍스트 힌트 + TASK-7 첫 진입 1회성 코치마크.

## 3. 작업 방식
- 각 트랙 brainstorming(결정 지점 확정, 자동 결정 금지) → speckit. 새 spec = 045(가져오기)·046(보드 힌트·코치마크) — 진입 시 ls specs/ 로 최대 번호 확정(현재 044). 브랜치=develop 기반 새 브랜치(워크트리 격리, base 검증=룰26).

## 4. 제약 / 추측 금지 (사실은 grep/Read/질문으로 확정)
- 트랙 1: 비파괴 가드 3(메모·인물 테이블/엔티티/서비스/라우트·iOS 캡처·마이그레이션 무변경 — ③ 복제 기준). ①②(완전·부분 통합) 택하면 파괴적이라 별도 범위(마이그레이션·백필·롤백). 죽은 FE 모듈 재사용 전 실재 확인.
- 트랙 2: TASK-7 영속은 SettingsService.ALLOWED 값 화이트리스트라 임의 키 서버 저장 주의(043 lastViewedBoard=localStorage 선례). 기존 OnboardingTour(driver.js)와 겹침 처리.

## 5. 규율 (HARD-GATE)
- CLAUDE.md 전 룰. 추측 금지 / 룰25(dogfooding 전항 사용자 확인 후 통과 단정) / 룰28(요구사항 전수 카탈로그 + 잔여 ISSUE 추적) / 빈상태=컨텍스트 유지 오버레이.
- 게이트: 트랙1 BE(ktlint·checkstyle·test·build)+FE(typecheck·lint·test·build) / 트랙2 FE. authed dogfooding=로컬 풀스택(DB→BE bootRun→FE pnpm dev).
- 마무리: develop merge + vault + 회고 + ISSUE-051 잔여 닫기(트랙2 완료 시).

순서 제안: 트랙 2(작고 결정 적음)부터 빠르게 → 트랙 1(D1~D6 결정 후 구현). 또는 사용자 선호 순서.
```

---

## 1. 한 줄
보드 트랙의 남은 두 가지를 함께: (1) **E 2단계** = 메모·인물을 보드 카드로 "가져오기"(비파괴 **③ 참조통합** 권고, BE+FE) (2) **ISSUE-051 잔여** = TASK-2 hover "끌어서 잇기" 텍스트 힌트 + TASK-7 첫 진입 코치마크(FE only).

## 2. 배경 / 현재 상태
- 보드 코어 **A~E1 + TASK-1(044) develop merge 완료**(main 미배포). roadmap §0·§7.
- **E 2단계**는 데이터 충돌(메모 M:N·iOS 캡처·soft-delete / 인물 구조화 필드 / 카드 1보드전속·평문)로 단순 이관 불가 → 비파괴 **③ 참조통합("가져오기")** 권고. 설계 초안 = `docs/board/board-track-e-design-draft.md`(D1~D6 결정지점 + 구현 스케치). ①②(완전·부분 통합)는 파괴적 → 별도 범위.
- **TASK-2/7**은 TASK-1(044)에서 의도적으로 범위 밖으로 둔 잔여(ISSUE-051 추적). 044는 TASK-1 ②③(빈 보드 안내·빈곳 더블클릭 생성)만 해소.

## 3. 작업 방식 (지정)
- 각 트랙 **brainstorming으로 결정 지점 확정(자동 결정 금지)** → speckit(specify→plan→tasks→implement).
- 트랙 1(가져오기): **D1~D6 결정이 게이트** → brainstorming(사용자 인터뷰) 먼저. BE 선행→FE.
- 트랙 2(힌트·코치마크): FE only. TASK-7 메커니즘(driver.js vs custom·영속) 결정.
- 새 spec: **045**(가져오기)·**046**(보드 힌트·코치마크) — 진입 시 최대 번호 확정(현재 044). ⚠️ E 초안 §6의 "`specs/044-board-import-...`"는 **044가 TASK-1에 쓰여 stale → 045**.
- 브랜치: develop 기반 새 브랜치(워크트리, base 검증 룰26).

## 4. 트랙 1 — E 2단계 가져오기 (BE+FE)

### 결정 지점 (D1~D6 — `board-track-e-design-draft.md` §3, 사용자 결정 필요)
| # | 결정 | 선택지 | 비파괴 기본값(권고) |
|---|---|---|---|
| D1 | 통합 방식 | ①완전 / ②부분 / ③참조 / ④보류 | **③ 참조** (또는 ④ 보류) |
| D2 | (③ 시) 복제 vs 링크 | 복제(snapshot, 스키마 0) / 링크(cards origin FK 신설=마이그레이션) | **복제** |
| D3 | 인물 구조화 필드 직렬화 | 멀티라인 평문 / 향후 구조화 카드 | **멀티라인 평문** |
| D4 | 메모 M:N 가져오기 단위 | 작품 보드=그 작품 연결 메모 / 전체 | **작품 보드=그 작품 연결 메모** |
| D5 | 메뉴 폐기 | 즉시/숨김/유지 | **유지**(③는 폐기 불필요) |
| D6 | iOS 캡처 경로 | 유지/변경 | **유지 절대** |

### 구현 스케치 (③ 복제 채택 시 — `board-track-e-design-draft.md` §4)
- **BE(추가만, 마이그레이션 0)**: `GET /api/projects/{id}/importable`(그 작품 인물 + 연결 메모를 카드化 후보로 반환, **원본 무변경**) + `POST /boards/{id}/cards/import`(선택 id를 새 Card로 **복제 생성**, cards INSERT만).
- **FE(추가만)**: 보드 캔버스 "가져오기" 버튼 → 후보 목록 → 선택 → 카드 생성. 042 내부 탭/043 참조와 결합. 죽은 FE 모듈(useMemos·useCharacters·lib/api/memo·lib/api/characters·memoView) **실재 확인 후** 재사용.
- 되돌리기 = 가져온 카드 삭제(원본 무영향).

### 제약 (비파괴 가드 3 — `board-track-e-design-draft.md` §5)
- 메모·인물 테이블/엔티티/서비스/라우트·iOS 캡처(`POST /api/capture`)·복구·마이그레이션 **무변경**(③ 복제 기준). 링크(D2 링크) 선택 시에만 `cards` nullable origin 컬럼 1개 = 별도 spec. ①② 선택 시 파괴적 → 마이그레이션·백필·롤백 별도 설계.

## 5. 트랙 2 — TASK-2 힌트 + TASK-7 코치마크 (FE only, ISSUE-051 잔여)

### TASK-2 hover "끌어서 잇기" 텍스트 힌트 (`board-ux-worksheet.md` L88-89, §5 COPY `link.hoverHint`)
- **현재**: 카드 hover 시 연결점(`Handle`)만 노출(`CardNode.tsx` `handleVisibility`), COPY `link.hoverHint`("끌어서 잇기") **텍스트 단서 미렌더**.
- **작업**: 카드 hover 시 연결점 근처에 "끌어서 잇기" 텍스트 단서. `CardNode.tsx`.

### TASK-7 첫 진입 1회성 코치마크 (`board-ux-worksheet.md` L204-207)
- 처음 카드 hover "끌어서 잇기" 1회 후 사라짐 / 처음 카드 선택 "이건 뭔가요?" 1회 지목. 튜토리얼 벽 금지, **상황형 코치마크만**.
- **결정 지점**: ① 메커니즘 = driver.js(기존 `OnboardingTour` 재사용) vs custom 상황형 ② 영속 = `user_settings` 신규 키 vs localStorage(SettingsService.ALLOWED 값 화이트리스트 주의 — 043 lastViewedBoard가 localStorage 쓴 선례) ③ 기존 온보딩(driver.js)과 겹침/순서 처리.

## 6. 참조
- `docs/board/board-track-e-design-draft.md`(D1~D6·③ 권고·구현 스케치·가드 3)
- `docs/board/board-prd.md` §0·§2·§7·§12 / `docs/board/board-ux-worksheet.md` TASK-2(L85-113)·TASK-7(L204-207)·§5 COPY
- `docs/board/board-roadmap.md` §0·§1·§5(트랙 E·TASK-1)·§7 / vault `03-ISSUES.md` ISSUE-051
- 코드: `frontend/src/components/board/CardNode.tsx`·`PlotBoardCanvas.tsx`·`OnboardingTour`(driver.js)·죽은 모듈(useMemos·useCharacters·lib/api/memo·lib/api/characters·memoView)·BE 메모/인물 컨트롤러·서비스(보존)·`POST /api/capture`
- 직전 TASK-1 핸드오프 `docs/board/2026-06-26-task1-card-creation-handoff.md`(작업 방식 참고)

## 7. 검증 / 마무리
- 게이트: 트랙1 BE(ktlint·checkstyle·test·build)+FE(typecheck·lint·test·build) / 트랙2 FE.
- dogfooding(authed 로컬 풀스택, 메모리 [[local-dogfooding-needs-backend]]): 트랙1=가져오기(후보 목록·선택 생성·원본 무변경·되돌리기) / 트랙2=hover 힌트·코치마크 1회성(재진입 시 안 뜸).
- 마무리: develop merge + vault(02-PROGRESS·03-ISSUES) + 회고. **트랙2 완료 시 ISSUE-051 완전 종료**.

## 8. 진행 순서 (제안)
1. **트랙 2** 먼저(FE only·작음·결정 적음) → 빠른 완료로 ISSUE-051 닫기. 단 TASK-7 메커니즘 brainstorming 선행.
2. **트랙 1**(가져오기) — D1~D6 brainstorming(사용자 인터뷰) → 045 spec → BE 선행→FE.
- (또는 사용자 선호 순서. 두 트랙은 독립이라 순서 무관.)
