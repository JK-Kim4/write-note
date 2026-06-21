# Quickstart & Dogfooding 검증: 031 출판 방식 레이아웃

**Feature**: 031-publish-layout-modes | **Date**: 2026-06-21

자동 테스트(GREEN)는 매핑·검증·순수함수만 보장한다. 자체 에디터 렌더·좌표계·한국어 IME·실측 분량은 **dogfooding 게이트**로 검증한다(§14 생성물 단위테스트 한계 정합).

## 라운드별 게이트

### R1 — 모드 선택/전환 (US1, US4)
1. 새 작품 생성 시 출판 방식을 고르지 않으면 생성이 막힌다(강제 선택).
2. "종이 출판" 생성 → 집필실이 페이지 분할로 열린다.
3. "웹 출판" 생성 → 집필실에 판형/용지 UI가 없다.
4. 기존 작품(본 기능 이전 생성) → 그대로 페이지 분할로 열린다.
5. 본문 있는 작품을 web↔paper 왕복 전환 → **전환 전후 본문 텍스트 동일**(무손실).

### R2 — 웹 연속 표시 (US3) — PoC 먼저
> PoC 게이트(결선 전 필수): 작은 범위로 `layout(∞)`+웹 렌더만 띄워 아래를 통과.
1. 긴 본문이 페이지로 나뉘지 않고 연속 스크롤로 흐른다.
2. **한국어 IME 4케이스**(빠른 타자/조합 중 마크/한자 변환/Backspace 분해) 정상.
3. 캐럿 이동·드래그 선택·클릭이 연속 좌표에서 정상.
4. 자동저장(016)·챕터 전환(022)이 web 모드에서 무회귀.

### R3 — 판형 + 실측 분량 (US2)
1. 종이 작품에서 판형 select 에 ISO 4종 + 판형 4종(신국판/국판/46판/문고판)이 보인다.
2. 신국판 선택 → 종이 크기·비율이 신국판으로, **1면 글자수 ≈ 700~800자(원고지 3.3~3.7매, SC-002)**.
3. 판형 변경 시 본문 텍스트 유지, 페이지 나뉨만 재계산(무손실).
4. 작은 폰트라도 zoom 으로 읽고 쓰기에 충분한 가독성.
5. 한국어 IME 4케이스 무회귀(폰트/여백 변경이 측정에 영향).

### R4 — 분량 지표 (US2, US3)
1. 웹 작품 분량이 글자수(공백 제외 우선)로 표시·실시간 갱신.
2. 종이 작품 분량이 페이지 수 + 원고지 매수로 표시.
3. 홈 카드에서 모드별 지표가 맞게 보인다.

## 검증 명령 (게이트)

```bash
# frontend (cwd=frontend/ 고정)
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build

# backend
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test

# 마이그레이션 적용은 사용자 컨펌 후 (로컬 dev DB 직접 적용 금지 — IT/Testcontainers 만)
```

## 배포 순서 (HARD-GATE)
- R1·R3·R4: **BE 선행 → FE 후행** (BE 가 layoutMode/판형 값을 받아들인 뒤 FE 가 전송. FE 선행 시 구 BE 가 신규 키 포함 요청을 400 거부 위험).
- R2: **FE 단독** (BE 무변경).
- 배포 전 `git fetch origin develop && git log --oneline HEAD..origin/develop` 로 베이스 정합 확인(§18).

## 회귀 주의 (과거 사례 active recall)
- **거짓 409 저장충돌(§12)**: 모드/판형이 작품 단위라 챕터 전환 세션 리마운트(`key={documentId}`) 유지 점검.
- **client.ts status 분기**: 본 기능은 신규 status/에러코드 0 → 409 오분류 회귀 없음(계약서 §5).
- **RSC 경계**: 모드 select/전환 토글 컴포넌트는 `'use client'` 확인 + 작성 직후 `pnpm build`.
- **직렬화 왕복 idempotence**: 모드 전환은 본문 미변경(저장 무관)이라 거짓 dirty 경로 없음 — 단 web↔paper 가 bodyJson 을 건드리지 않는지 결선 시 확인.
