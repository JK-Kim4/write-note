# Quickstart: 시리즈 중심 재구성 — 라운드별 검증

**Feature**: 033-series-restructure | **Date**: 2026-06-22

각 라운드 GREEN 게이트 + dogfooding 시나리오. 자동 게이트 = `backend verify` + `frontend verify`(CLAUDE.md 스크립트).

## 공통 게이트

```bash
# backend
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
# frontend
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

> 마이그레이션(V21)은 작성·리뷰만. 로컬/운영 적용은 사용자 컨펌. 테스트는 Testcontainers 격리 DB.

## R0 — 운영 데이터 재확인 (완료, 2026-06-22)

- [x] 운영 V20 미적용(category_id 부재), 작품 6 전부 미분류 시작.
- [x] 작품별 활성 본문 최대 1 → 챕터 1:1 회귀 안전, V22 불필요.
- [x] soft-deleted 본문 1개 → 활성만 채택·보존.

## R1 — 챕터 제거 (US1, P1)

**자동(TDD)**: DocumentController 챕터 endpoint 제거 후 단일 본문 조회·저장 테스트 GREEN. 챕터 전용 서비스/검증(ChapterReorderValidator 등) 제거로 인한 회귀 0.

**dogfooding**:
1. 기존 작품 열기 → 챕터 목록·추가·전환·삭제 UI가 **보이지 않음**.
2. 단일 본문이 그대로 표시(기존 텍스트 유실 0) → 집필·자동저장 정상.
3. 새 작품 생성 → 본문 1개로 바로 집필.
4. (016 회귀 가드) 챕터 전환이 없어졌으므로 거짓 409 경로 소멸 확인.

## R2 — 판형·출판방식 시리즈 종속 (US2·US3, P1·P2)

**자동(TDD)**:
- V21 마이그레이션(Category 메타 nullable) 적용 후 스키마 검증.
- effective 해석 행위 테스트: (a) 시리즈 판형 설정 작품 → 시리즈값, (b) 미분류 작품 → `"A4"`/`"paper"`, (c) 시리즈 판형 미설정 → 기본값.
- 작품 이동(PATCH category) 후 effective 재해석 테스트.

**dogfooding**:
1. 시리즈 생성·편집에 판형/출판방식 입력 → 저장.
2. 그 시리즈 하위 작품 전부 시리즈 판형으로 집필실 렌더.
3. 시리즈 판형 변경 → 하위 작품 일괄 반영(개별 변경 0회).
4. 미분류 작품 열기 → 기본 판형으로 정상 렌더.
5. 작품을 다른 시리즈로 이동 → 새 판형 적용, 본문 불변.
6. 내보내기(PDF/DOCX) → effective 판형으로 출력.
7. 작품 폼에 판형·출판방식 입력란 없음.

## R3 — 장르·줄거리 시리즈 이동 + 톤류 UI 제거 (US2·US5·US6, P1·P3)

**자동(TDD)**: Category genre/synopsis 저장·응답. Project 응답에 톤류 필드 남되 FE 미표시(테스트로 미렌더 확인). 톤류 데이터 보존(컬럼 미변경) 검증.

**dogfooding**:
1. 시리즈 폼에 장르·줄거리 입력 → 시리즈에 저장·표시.
2. 작품 카드/목록에 장르·줄거리·다음 장면 **표시 안 됨**(FR-023).
3. 작품 폼에 톤·문체·세계관·다음 장면 입력란 없음.
4. (보존) 이전에 세계관 적은 작품의 DB 값 유지(운영 조회로 확인).

## R4 — 두 층위 목표 분량 (US4, P2)

**자동(TDD)**: Category.targetLength 저장. totalWordCount 집계(하위 작품 활성 본문 word_count 합, archived 제외) 테스트. 목표 null/0 가드.

**dogfooding**:
1. 시리즈 총 목표 입력 → 하위 작품 글자수 합 대비 진척 표시.
2. 작품 생성 시 작품 목표 입력 → 시리즈 총 목표와 독립 관리.
3. 목표 미설정 시 진척 표시 오류(0 나눗셈) 없음.
4. 빈 시리즈 총 목표 진척 = 0.

## 통합 검증 (buffer → develop 전)

- [ ] 전 라운드 게이트 GREEN.
- [ ] `git log HEAD..origin/develop` 누락 커밋(보안·공개경로) 재점검(§18).
- [ ] 무손실: 운영 작품 본문·톤류 데이터 유실 0(배포 전후 읽기 조회 비교).
- [ ] 032 + 033 함께 dogfooding 후 develop 머지 결정(사용자 승인 시 main 승격).
