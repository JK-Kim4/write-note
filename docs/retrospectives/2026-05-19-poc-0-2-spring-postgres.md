# PoC 0-2 — Spring Boot 4.0.6 + PostgreSQL 17 연결 검증

- 일자: 2026-05-19
- 워크트리 / 브랜치: `.claude/worktrees/poc-spring-postgres` (정리 완료) / `feature/poc-spring-postgres` (삭제 완료)
- 관련 커밋: `6f2c451` (PoC 결과) → `14e47e5` (merge) → `origin/develop` push
- 작업 시간 (대략): 본 세션 후반 ~50분

## 1. 무엇을 했는가 (사실)

- `feature/poc-spring-postgres` 워크트리 분기 (`develop` 기반)
- `docker compose up -d --wait postgres` — `postgres:17-alpine` 컨테이너 healthy
- `application.properties` 갱신 — datasource (localhost:5432) + JPA validate + Flyway enabled
- Flyway `V1__create_ping.sql` (`ping` 테이블: id BIGSERIAL / message VARCHAR(100) / created_at TIMESTAMP DEFAULT NOW())
- `PingEntity` (Kotlin allOpen JPA Entity) + `PingRepository` (JpaRepository)
- `PingRepositoryIT` — `@SpringBootTest` + `@Transactional` smoke test
- `./gradlew test` 1차 fail — `Inconsistent JVM-target compatibility: compileJava(25) vs compileKotlin(24)`
- `build.gradle.kts` toolchain 25 → 24 회귀
- docs 5곳 갱신 — `00-stack §2-1` + `§10` 변경 이력 / `CLAUDE.md` / `README.md` / `.claude/rules/kotlin/code-quality.md`
- `./gradlew test` 2차 fail — `assertNotNull(fetched.createdAt)` AssertionFailedError (JPA 1차 캐시)
- `EntityManager.flush() + clear()` 패턴 적용
- `./gradlew test` 3차 — **BUILD SUCCESSFUL (2 tests / 0 failed)**
- `docs/poc/0-2-spring-postgres.md` 통과 보고 작성
- `feature → develop` merge (`--no-ff`) + push + cleanup

## 2. 어떻게 했는가 (접근)

- `start.spring.io` metadata 2회 호출 (bootVersion + javaVersion + dependencies id) — 추측 영역 검증 의무 정합
- Java 25 "지원 표시" 만 보고 toolchain 25 박음 — Initializr 자동값 (24) 의 이유 미점검 (검증 부족)
- 빌드 fail 의 명확한 메시지 (`Kotlin does not yet support 25 JDK target`) 로 회귀 원인 즉시 식별
- 회귀 결정 시 옵션 3개 (A 24 회귀 / B Kotlin 2.3 + Java 25 / C Java 21) 비교 표 + default A 추천 + 사용자 컨펌
- JPA 1차 캐시 함정 — 표준 동작이지만 PoC 작성 시 미인지. fail 후 `EntityManager.flush+clear` 패턴 즉시 적용

## 3. 잘 된 점

1. **PoC 본질 = 위험 식별 정확 달성** — 회귀 1건 (Java 25/Kotlin 한계) + 함정 1건 (JPA 1차 캐시) 모두 본 단계에서 잡음. Phase 1A 본격 진입 후 발견했으면 더 큰 비용. 빌드 fail 가 명확한 신호로 작동
2. **docs 5곳 일관 갱신** — Java 25 → 24 회귀가 SoT 5곳에 모두 정합 박힘. 미래 세션이 "왜 toolchain 24 인가" 1회 grep 으로 추적 가능
3. **통과 보고 §"폐기 시점" 명시** — Phase 1A 진입 시 Ping skeleton 4개 폐기 추적 가능. PoC = throwaway 본질 박힘

## 4. 어긋난 점

- **추측 영역 미검증 (회피 가능)** — `start.spring.io` metadata 가 `javaVersion=25` 지원 표시했지만, **Initializr 가 자동 `toolchain=24` 박은 데에는 이유가 있다** 는 의문 무시. metadata 단순 "지원 가능" 표시만으로 cross-version (Kotlin × Java × Spring Boot) 호환 확정 단정. `agent-workflow-discipline §1` 정신 위반. **회피 가능 시점**: Initializr 출력 `build.gradle.kts` 의 toolchain 24 관찰 시점에 "보낸 값 25 와 다른데 왜?" 1회 점검 의무
- **"default 추천" 마크 부착 + 검증 부족** — 사용자에게 옵션 b (Spring Boot 4.0.6 + Java 25) 를 "default 추천" 으로 박음, 실제로는 빌드 미검증 상태. `agent-workflow-discipline §2` 정신 위반 (권장 마크 = 검증 완료 신호로만 사용)
- **JPA 1차 캐시 함정 — 빌드 fail 2차 trigger** — Spring Data JPA 표준 동작인데 PoC 테스트 작성 시 단순 `save + findById` 박음. 글로벌 룰 `jpa-mongodb.md` 가 N+1 / batch / fetch 패턴 박았지만 "1차 캐시 우회" 패턴은 미박힘. 본 함정은 PoC 만의 문제 아닌 Phase 1A 이후 모든 Repository 테스트 영역
- **사용자 멈춤 신호 0회** — PoC 진행 중 stop 신호 없음. 자동 흐름 + 회귀 시점에 사용자 컨펌 받음. 잘 된 점이긴 하나 어긋남 추적 시 멈춤 신호 부재가 곧 모든 게 잘 돌아갔다는 신호는 아님
- **Spring Initializr starter.zip 500 (단발 사례)** — 1차 시도 description 공백 + javaVersion=25 동시 → 500. 2차 시도 (description 제외) → 200. 정확 원인 미확인. 단발이라 룰화 안 함, 단 관찰 영구화 (다음 호출 시 description 회피 또는 인코딩 점검)

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1. **Spring Initializr 자동값은 이유 있는 선택** — 명시 보낸 파라미터와 결과 `build.gradle.kts` 값이 다르면 (예: javaVersion=25 → toolchain=24) "왜 다른가" 점검 의무. cross-version 호환 매트릭스가 metadata 단순 "지원" 표시보다 우선
2. **Spring Data JPA Repository 검증 표준 패턴** — `save() + EntityManager.flush() + EntityManager.clear() + findById()`. Phase 1A 이후 모든 Repository 테스트 의무. 단순 `save+findById` 는 1차 캐시 hit
3. **PoC 산출물 폐기 시점 명시 의무** — 통과 보고 §"폐기 시점" 박은 패턴. Phase 1A 진입 시 Ping 5개 (Entity / Repository / IT / V1 SQL / PoC 한정 application.properties datasource 블록) swap 추적

### 5-2. 룰 갱신 결과

| 후보 | 대상 | 결과 |
|---|---|---|
| 1. `agent-workflow-discipline §1` Spring Initializr toolchain 자동값 무시 회귀 사례 추가 | `.claude/rules/shared/agent-workflow-discipline.md` | **스킵** — 사용자 결정. "사례 추가" 형태라 실질 개선 약함 |
| 2. `agent-workflow-discipline §2` "default 추천" 단정 회귀 사례 추가 | `.claude/rules/shared/agent-workflow-discipline.md` | **스킵** — 사용자 결정 (1번과 동일 사유) |
| 3. **JPA 1차 캐시 우회 패턴 신규 룰 (실질 개선안)** | `~/.claude/rules/kotlin/spring/jpa-test-patterns.md` (글로벌, 신규) | **채택 ✅ — 본 회고와 함께 작성됨** |

채택된 후보 3 의 실제 룰 본문:
- §1 1차 캐시 우회 — Repository 검증 의무 패턴 (HARD-GATE) — 표준 코드 + 적용 시점 + 안티패턴
- §2 `@Transactional` 테스트 rollback — `external-infra-safety §1` 예외 명시
- §3 Testcontainers vs docker-compose 선택 가이드
- 회귀 사례 — 본 PoC 0-2 의 `fetched.createdAt` AssertionFailedError 1줄

본 회고 §4 의 미채택 사례 (Spring Initializr 자동값 / "default 추천" 단정) 는 본 회고 §4 본문에 영구 기록됨 — 다음 세션이 회고 검색 시 발견 가능. 룰 파일 추가는 안 했지만 회고 그라운드 트루스는 유지.
