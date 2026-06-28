# POC — 안정적 블록 ID (공유/댓글 위치 지정 앵커링)

| 항목 | 내용 |
|---|---|
| 일자 | 2026-06-28 |
| 관련 PRD | [docs/share/share-prd.md](../share/share-prd.md) §6.2 |
| 코드 | `frontend/src/lib/poc/blockId/` (idModel.ts · idPmConvert.ts · blockId.poc.test.ts) |
| 결과 | **17 테스트 GREEN + 타입체크 클린. 옵션 A(블록 ID 주입) 구현 가능 — 침습도 "중".** |

## 1. 검증한 질문

공유 PRD §6.2는 위치 지정 댓글을 "블록(문단)의 **안정적 ID**"에 앵커링한다고 전제한다. 그러나 자체 에디터의 문서 모델 `DocModel = { buffer, blockAttrs[], markRuns[][] }` 에는 **블록 식별자가 없다.** 블록은 `buffer` 의 `\n` 경계 + 배열 인덱스(위치)로만 구분되고, 디스크 저장 포맷(PM JSON)의 노드도 `heading.level` 외 어떤 id attr 도 없다. 유일하게 `blockId` 라 불리는 값(`printLayout.tsx:65` `"b"+i`)은 매 렌더마다 새로 만드는 위치 인덱스다.

> **질문:** 이 에디터에 블록별 "안정적 ID" 를 부여해, 편집(타이핑·분할·병합·삭제)과 영속 왕복을 거쳐도 ID 가 안정적으로 보존되게 만들 수 있는가? 가능하다면 핵심부(IME·저장유실 회귀 이력이 있는) 를 얼마나 건드려야 하는가?

## 2. 방법

핵심부를 직접 건드리는 대신, **격리 모듈**에서 알고리즘을 증명했다:

1. `blockIds: string[]` 를 `blockAttrs` 와 **병렬 배열**로 둔다(INV: 길이 = 블록 수, 전부 unique).
2. 실제 `model.ts` 의 모든 편집이 수렴하는 `insertText` 의 배열 재구성 골격
   `newAttrs = [...prefix, startAttr, ...inserted(fresh), ...suffix]`
   을 `blockIds` 에 **그대로 미러링**한다.
3. **충실성 cross-check**: POC 의 `buffer`/`blockAttrs` 출력이 실제 `insertText`/`mergeWithPrev` 출력과 **정확히 일치**함을 테스트로 박는다 → POC 가 현실을 충실히 반영함을 보장(허구의 평행 구현이 아님).
4. 그 위에서 ID 안정성 불변식을 TDD 로 검증.

## 3. 핵심 알고리즘

```
insertText(lo, hi, text) 의 ID 재구성 (attr 골격과 동일):
  startBlockIdx = 편집 시작 블록
  newBlockIds = [
    ...blockIds.slice(0, startBlockIdx),                       // prefix — 무조건 보존
    blockIds[startBlockIdx],                                   // 시작 블록 — ID 유지
    ...freshIds(insertedBlockCount),                           // 새 블록 — fresh
    ...blockIds.slice(startBlockIdx + 1 + removedBlockCount),  // suffix — 무조건 보존
  ]
```

이 골격의 결과로 **편집 시작 블록을 제외한 모든 prefix·suffix 블록의 ID 가 무조건 보존**된다. 즉 위/아래 어디에 문단을 삽입·삭제·분할해도 **다른 블록의 댓글 앵커가 밀리지 않는다** — PRD 가 글자 오프셋 방식에서 피하려던 바로 그 문제가 블록 단위에서 해소된다.

## 4. 편집 의미론 (POC 로 확정)

| 연산 | ID 거동 | 댓글 앵커 영향 |
|---|---|---|
| 블록 내부 타이핑 | 전 블록 ID 불변 | 모든 댓글 그 자리 유지(본문만 바뀜) |
| 다른 곳에 문단 삽입 | 기존 ID 전부 보존 + 새 ID 1개 | 기존 댓글 안 흔들림 |
| 블록 분할(Enter) | **윗부분이 ID 유지**, 아랫부분 fresh | 댓글은 윗부분에 남음 |
| 블록 병합(Backspace) | **앞 블록 ID 생존**, 흡수된 블록 ID 소멸 | 흡수된 블록 댓글 = orphan |
| 블록 삭제 | 삭제 블록 ID orphan | 그 블록 댓글 = orphan(보존+분리 표시) |

**알려진 뉘앙스 (POC 가 노출):** 블록 삭제 시 orphan 대상이 **삭제 범위의 경계 정렬에 의존**한다. 선행 개행(`\nBravo`)과 함께 지우면 해당 블록이 깔끔히 orphan 되지만, 후행 개행(`Bravo\n`)과 함께 지우면 실제 에디터의 attr 재배치와 동일하게 ID 가 인접 블록으로 re-home 된다. → **견고한 orphan 판정에는 ID 단독이 아니라 경량 content fingerprint 백스톱을 병행**하는 게 안전(PRD §6.2 반영).

## 5. 영속 (PM JSON 왕복 + 레거시 backfill)

- 블록 ID 는 각 블록 노드의 `attrs.bid` 로 PM JSON 에 실어 왕복 → **DB 스키마 변경 0**(기존 `documents.body` jsonb 안에 들어감).
- 기존 문서(bid 없음)는 로드 시 1회 mint(backfill) → 다음 저장에서 박혀 영속.
- 왕복 idempotence 검증: ID 보유 모델 → PM → 모델' 에서 ID 보존 → code-quality "직렬화 왕복 idempotence" 룰(거짓 dirty 방지) 정합.

## 6. 실제 통합 시 touch points (침습도 평가)

격리 POC 가 증명한 알고리즘을 프로덕션에 옮길 때 건드릴 지점:

- `model.ts`: `DocModel` 에 `blockIds` 추가 → `insertText`(442-453)·`mergeWithPrev`(720-724)·`insertHr`·`reconcileAttrs`(블록 수 drift 시 mint/trim)·`sliceModel`(복사) 미러링. 빈 모델 INV-3 에 ID 1개.
- `pmConvert.ts`: paragraph/heading/blockquote/listItem/hr 직렬화·파싱에 `attrs.bid` 부여 + 부재 시 backfill.
- **복붙 재mint(주의)**: 복사한 블록을 붙여넣을 때 fresh ID 발급(중복 ID 방지) — 명시 처리 필요.
- **자동저장 baseline 정규화(주의)**: serverBody 를 ID 포함 동일 변환으로 정규화(로드 즉시 거짓 dirty 방지, 024 회귀 사례 정합).
- 저위험: IME 조합·undo/redo 는 전부 `insertText`/모델 스냅샷 경유라 ID 자동 동행.

**평가:** 병렬 배열 하나를 ~8개 모델 함수 + pmConvert 직렬화/파싱에 관통시키는 **국소·기계적 작업**. 핵심 위험은 (a) 복붙 재mint, (b) 자동저장 idempotence 두 곳뿐이고 둘 다 본 코드베이스에 확립된 패턴/룰이 있다. **전면 재작성 아님 → 침습도 "중".**

## 7. 결론

옵션 A(살아있는 원문에 안정적 블록 ID 주입)는 **구현 가능**하다. 알고리즘은 17 테스트 + 실제 model 연산 충실성 cross-check 로 증명됐다. 다만 핵심 에디터 회귀 이력(룰 §12·§15) 때문에 실제 통합은 복붙·자동저장 idempotence 를 포함한 dogfooding 게이트를 거쳐야 한다.

이로써 PRD §9 미결정(스냅샷 vs 블록 ID)에서 **블록 ID 안이 "기술적으로 불가/과대"가 아님이 확정**됐다. 스냅샷 안과의 최종 선택은 *"작가가 원문을 고치면 공유본·댓글에 즉시 반영돼야 하는가"* 라는 제품 요구로 가른다(PRD §9 참조).

## 8. 결정 결과 (2026-06-28)

사용자 결정 = **옵션 B(공유 시점 스냅샷)**. 공유본은 동결 사본이라 댓글이 *불변 스냅샷의 블록 인덱스* 로 안정 앵커되어, **Phase 1 에서는 살아있는 에디터에 블록 ID 를 주입할 필요가 없다**. 따라서 본 POC 가 증명한 옵션 A 는 **미래의 "원문 수정 공유본 실시간 반영" 기능용 근거로 보존**한다(폐기 아님). 상세 = [docs/share/share-prd.md](../share/share-prd.md) §3-6 · §7.2.
