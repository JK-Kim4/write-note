# Specification Quality Checklist: 카드 관리 (Card Management)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-01
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 스코프를 가르는 두 결정(보드 없는 독립 카드 허용 / 캡처 메모 무변경)은 2026-07-01 사용자 인터뷰로 확정 — [NEEDS CLARIFICATION] 마커 0.
- 데이터 도메인 근거: 요청의 "카드 종류"·"카드 간 연결 삭제 경고"·"어느 보드 소속"은 모두 기존 카드(card) 도메인에만 있는 속성 → 폐기된 캡처 메모(memos) 부활이 아님을 spec 정황 요약에 명시.
- 소유 모델 변경(카드의 보드 소속 nullable + 카드 자체 소유자 참조)은 기술적 필연으로 Assumptions·FR-016 에 박음. 구체 구현 방식(직접 nullable vs 숨은 인박스 보드)은 의도적으로 plan 단계로 미룸(spec 은 WHAT 수준 유지).
- "연결 N개"·소속 보드 라벨의 cross-board 조회 경로 신설 필요를 Assumptions 에 명시(표시값 출처를 plan 에 박는 프로젝트 룰 정합).
- 이미 보드에 속한(연결선 걸린) 카드의 이동/독립화, 캡처 메모 통합은 명시적으로 범위 밖(Edge Cases·Assumptions).
- advisor 검토 반영(2026-07-01): FR-016·Key Entities·Assumptions 에서 소유 판별 구현 방식(nullable+cards.user_id) 선확정 문구를 걷어냄 — "숨은 인박스 보드" 대안을 plan 까지 열어두기 위함. plan 인계 메모 2건(마이그레이션-프리 MVP 위상 / 폐기 메모 고아 코드·redirect 정리)을 Assumptions 에 추가.
