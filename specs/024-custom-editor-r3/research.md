# R3 Research — 블록 패리티 + 소프트 줄바꿈

선행 R1/R2 research(평면 모델·오프스크린 measure·affinity)를 상속. 본 문서는 R3 신규 결정만 다룬다. PM 노드 이름은 기존 `pmConvert.flattenNode`가 이미 다루던 값(`bulletList`/`orderedList`/`listItem`/`blockquote`)으로 정합 확인됨 — 외부 리서치 불필요, 코드 인용으로 확정.

## D1. 블록 모델 — 평면 유지 vs 트리

- **Decision**: 평면 블록 모델 유지. `BlockAttr` 판별 유니온에 `blockquote`/`listItem{listKind,depth}`/`hr` 추가. 중첩은 `depth:number`로 표현.
- **Rationale**: R1/R2가 `buffer`(`\n` 분리) + `blockAttrs[]` + `markRuns[][]`로 동작. 산문 글쓰기는 얕은 구조가 표준. 업계(Lexical 평면 노드, Quill Delta) 모두 얕은 리스트는 평면+속성. 트리 전환은 layoutEngine/caret 전면 재작성 비용.
- **Alternatives**: 트리 모델(ProseMirror식) — 깊은 중첩 1:1 보존 가능하나 측정·캐럿·페이지분할 전면 재작성. 본 라운드 범위 초과(설계 §3 합의: 깊은 중첩 비핵심).

## D2. 소프트 줄바꿈 표현 — U+2028 in-buffer 마커

- **Decision**: `buffer` 안에 `U+2028`(LINE SEPARATOR)을 블록 내 줄바꿈으로 둔다. `blockRanges`는 `\n`으로만 블록 분리(`U+2028`은 경계 아님). measure는 `U+2028`에서 강제 줄나눔. pmConvert `U+2028` ↔ `{type:"hardBreak"}`.
- **Rationale**: EditContext는 평면 flat-offset 문자열(`buffer`)을 SoT로 쓴다 — 별도 사이드테이블보다 in-buffer 단일 문자가 offset/캐럿/선택 정합에 자연스럽다. `U+2028`은 의미상 line separator이고 사용자 입력에 거의 없어 충돌 위험 최소. 한 글자라 INV-4(run len 합 = 글자 수)에 그대로 편입.
- **Alternatives**: (a) `\n`을 소프트/하드 양용 + 사이드 비트 — offset 정합 복잡. (b) 별도 softBreaks offset 배열 — buffer와 동기화 부담·idempotence 위험. 모두 기각.
- **검증된 현 결함**: `pmConvert`에 hardBreak 처리 없음(드롭) + `CustomEditor` Enter가 shiftKey 미구분 → 소프트 줄바꿈 미구현. 본 결정이 둘 다 해소.

## D3. 번호 목록 번호 — 저장 vs 렌더 파생

- **Decision**: 번호를 저장하지 않고 렌더 시 파생. 연속된 같은 `listKind:"ordered"`·같은 `depth` 블록을 카운트해 1·2·3…. 비목록 블록 / 다른 listKind / 다른 depth가 끼면 번호 재시작.
- **Rationale**: 번호를 저장하면 삽입·삭제·재정렬마다 재계산·동기화 필요 + idempotence 깨짐. 파생이 단일 진실원. ProseMirror/HTML `<ol>`도 번호는 파생.
- **Alternatives**: blockAttr에 number 저장 — 재계산 누락 버그·왕복 비idempotent. 기각.

## D4. 구분선(hr) — 원자 빈 블록

- **Decision**: hr = `buffer` 세그먼트 `""` + `blockAttr {type:"hr"}` + `markRuns []`. 캐럿이 블록 안으로 못 들어가고(텍스트 0), 화살표는 위/아래 블록으로 건너뛰며, 인접 위치에서 Backspace/Delete로 블록 통째 삭제.
- **Rationale**: hr은 콘텐츠 없는 표식. 빈 문단(`""` + `{type:"paragraph"}`)과 buffer상 동일하므로 **타입으로만 구별** — 캐럿 라우팅이 blockAttr.type을 봐야 한다.
- **주의**: 빈 문단과 hr이 같은 빈 세그먼트라 INV/blockIndex 로직 무영향(타입만 다름). 캐럿 진입 차단은 CustomEditor 키 핸들러 책임.

## D5. measure 일반화 — 인용 들여쓰기·목록 마커 폭

- **Decision**: R2의 run-aware 오프스크린 styled-DOM + `Range.getClientRects()`를 유지하고, 블록 타입별 content 폭만 조정: 인용=좌측 들여쓰기 차감, 목록=마커(•/번호) 폭 차감, depth마다 추가 들여쓰기. `U+2028`은 측정 시 줄 강제 분리.
- **Rationale**: canvas measureText 금지(R2 회귀 룰 — CJK kerning/CSS shaping drift). 마커·들여쓰기는 폭 상수 차감으로 단순 처리, 실제 글자 측정은 기존 styled-span 경로 재사용.
- **Alternatives**: canvas 측정 — 금지. 마커를 텍스트로 buffer에 넣기 — 캐럿/선택 오염, 기각(마커는 순수 표시).

## D6. pmConvert 왕복 idempotence

- **Decision**: `modelToPmJson`이 연속 동일 `listKind`·`depth` listItem 블록을 하나의 `bulletList`/`orderedList` 노드로 재그룹(중첩 depth는 list 안 list로 복원), blockquote 블록 → `blockquote{paragraph}`, hr 블록 → `horizontalRule`, `U+2028` → `hardBreak`. `pmJsonToModel`은 역방향. SC-002 결정론 테스트로 `modelToPmJson(pmJsonToModel(x))` 2회 적용 바이트 동일 강제.
- **Rationale**: 2026-06-15 회귀(빈 문서 비정규화 거짓 dirty)와 동종 — 왕복 비idempotent면 로드 즉시 거짓 dirty → 자동저장 유실 위험. 결정론 테스트가 유일한 방어.
- **Alternatives**: baseline 정규화(serverBody를 같은 변환으로)만 — 차선. idempotent 변환이 근본. 둘 다 적용(방어 다층).

## D7. layoutEngine/geometry 무수정

- **Decision**: 페이지 분할 엔진 무수정. 신규 블록도 measure가 줄 리스트(`{start,end}`)를 내면 기존 블록 단위 분할에 그대로 태워진다.
- **Rationale**: 분할은 "줄 높이 누적 → 페이지 경계" 로직이라 블록 타입 불문. R1/R2가 이미 줄 단위. 인용/목록/hr도 줄로 환원되면 무수정 동작.
- **검증 필요**: hr(줄 1개·높이=가로선) / 인용(들여쓰기 줄) 이 분할에서 깨지지 않는지 dogfooding 확인(SC-001).
