# Quickstart — Web 포팅 Backend 확장 (014)

본 sub-task 검증·실행 흐름. 기존 backend 스크립트 재사용.

## 사전 준비

```bash
docker compose up -d --wait postgres        # local DB
cd backend
```

## TDD 사이클 (항목별 Red→Green→Refactor)

구현 순서(research §R11): US1 next_scene → US2 pinned → US3 logs → US4 work_sessions.

각 항목:
```bash
# Red — 실패 테스트 1개 추가 후
./gradlew test --tests "*<해당테스트>*"     # RED 확인
# Green — 최소 구현 후
./gradlew test --tests "*<해당테스트>*"     # GREEN 확인
```

## 마이그레이션 (⚠️ 적용은 사용자 컨펌 — external-infra-safety §1)

- 작성·리뷰: `backend/src/main/resources/db/migration/V7__add_next_scene_pin_and_create_logs_sessions.sql` (자유)
- 적용: 통합 테스트는 Testcontainers 가 격리 DB 에 자동 적용(컨펌 불요). **로컬/운영 DB 직접 적용은 사용자 명시 컨펌 후.**

## 항목별 수용 검증(통합 테스트로 자동화)

| 항목 | 핵심 검증(spec Acceptance) |
|---|---|
| next_scene | 저장→조회 왕복(AS1), 빈 값 비우기(AS2), 타 계정 404(AS3), 부분수정 격리(AS4) |
| pinned | 고정 표시(AS1), 작품당 1개 전환(AS2), 해제(AS3), 연결단위 독립(AS4), 타계정 404(AS5) |
| project_logs | 생성→목록(AS1), 최신순(AS2), 최신 1(AS3), 타계정 404(AS4), 작품삭제 연쇄(AS5) |
| work_sessions | 시작(AS1), 작품당 1개 재시작(AS2), 30s 미만 폐기(AS3), 30s 이상 보존(AS4), endWithLog 짧아도 보존(AS5), 로그실패 롤백(AS6), 스케줄러 dangling 폐기(AS7) |

## 전체 게이트 (각 항목 GREEN 후 1회 + 최종)

```bash
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```
- ⚠️ ktlint 는 **main + test 양쪽** 소스셋(agent-workflow-discipline §4 회귀 사례).
- Kotlin annotation 배열 인자 = `[Exception::class]` 형식(kotlin/code-quality 회귀 사례).

## 부팅 확인(선택)

```bash
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
# 신규 endpoint smoke (JWT 필요):
# PATCH /api/projects/{id} {"nextScene":"3장 도입"}
# POST  /api/projects/{id}/work-sessions/start
```

## 완료 정의(DoD)

- 4종 기능 통합 테스트 GREEN + 전체 게이트 통과
- V7 마이그레이션 작성·리뷰 완료(적용은 컨펌)
- `contracts/ipc-rest-mapping.md` 의 ✅/🧩 행이 실제 endpoint 와 일치(계약 공백 0, SC-005)
- vault `02-PROGRESS.md` 갱신(Phase 완료 시점, CLAUDE.md HARD-GATE)
