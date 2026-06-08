# PoC 0-2 — Spring Boot + Postgres 연결 검증

**일자:** 2026-05-19
**상태:** ✅ 통과 (회귀 1건 동반)
**연관:** [01-phase-breakdown.md §2](../plan/01-phase-breakdown.md), [00-stack §5-2](../plan/00-stack-and-schedule.md)

---

## 1. 검증 대상 (`00-stack §5-2`)

> Phase 0-2. Spring Boot + Postgres 연결
> 통과 기준: `application.yml`에 Supabase Postgres connection string, 단순 Entity 1개 + Repository로 INSERT/SELECT GREEN

본 PoC 는 **로컬 docker postgres 컨테이너** 로 진행 (프로덕션 Supabase Postgres 연결은 Phase 1A 또는 Phase 7 영역).

## 2. 환경

| 항목 | 값 |
|---|---|
| Java toolchain | **24** (시스템 Corretto 25 호스트, Gradle 이 toolchain 24 자동 처리) |
| Kotlin | 2.2.21 |
| Spring Boot | 4.0.6.RELEASE |
| Gradle | 9.4.1 (wrapper) |
| PostgreSQL | 17-alpine (docker container `write-note-postgres`, port 5432) |
| Flyway | 4.0.6 starter (`flyway-database-postgresql` transitive) |

## 3. 산출물

| 파일 | 역할 |
|---|---|
| `backend/src/main/resources/application.properties` | datasource URL/credentials + JPA validate + Flyway enabled |
| `backend/src/main/resources/db/migration/V1__create_ping.sql` | `ping` 테이블 1개 (id BIGSERIAL / message VARCHAR(100) / created_at TIMESTAMP DEFAULT NOW()) |
| `backend/src/main/kotlin/com/writenote/poc/PingEntity.kt` | JPA Entity (Kotlin allOpen Plugin 으로 inheritable) |
| `backend/src/main/kotlin/com/writenote/poc/PingRepository.kt` | `JpaRepository<PingEntity, Long>` |
| `backend/src/test/kotlin/com/writenote/poc/PingRepositoryIT.kt` | `@SpringBootTest` + `@Transactional` INSERT + flush+clear + SELECT 검증 |
| `docker-compose.yml` | (셋업 commit) postgres:17-alpine |

## 4. 통과 결과

```
BUILD SUCCESSFUL in 3s
2 tests completed, 0 failed
```

- `BackendApplicationTests.contextLoads` — ApplicationContext 기동 (datasource / Flyway / JPA EntityManager / Spring Security 빈 전부 정상 등록)
- `PingRepositoryIT.Postgres 연결 검증` — Flyway V1 migration 적용 → INSERT → flush+clear → SELECT (실제 쿼리) → message + created_at 검증 GREEN

## 5. 의외 결정 (회귀 1건 + 함정 1건)

### 5-1. Java 25 → Java 24 회귀 (회귀)

**시도**: `build.gradle.kts` toolchain `JavaLanguageVersion.of(25)` — 시스템 환경 정합 + start.spring.io 메타데이터의 javaVersion `[26/25/21/17]` 지원 확정 근거.

**결과**: 빌드 실패 —
```
Kotlin does not yet support 25 JDK target, falling back to Kotlin JVM_24 JVM target
Inconsistent JVM-target compatibility detected for tasks 'compileJava' (25) and 'compileKotlin' (24).
```

**원인**: Kotlin 2.2.21 의 `kotlinc` 가 JVM target 25 미지원. start.spring.io 메타데이터는 "javaVersion=25 옵션" 만 제공하고 Initializr 자체 logic 이 Kotlin 호환을 보고 `toolchain 24` 로 자동 박았던 것. 본인이 그걸 "본질 정합" 으로 보고 25 로 수정한 게 회귀 트리거.

**회귀**: build.gradle.kts toolchain 24 로 회귀. 문서 5곳 갱신 (00-stack §2-1 + §10 / CLAUDE.md / kotlin/code-quality.md / README 2곳).

**후속**: Kotlin 2.3.21 (current stable, 2026-04-23 출시) 가 JVM target 25 지원하는지 미검증. 지원 시 Java 25 재상승 후보. Spring Boot 4.0.6 의 kotlin pinning override 필요 — `ext["kotlin.version"] = "2.3.x"`. 별도 트랙으로 검증 시점에 진행.

### 5-2. EntityManager flush+clear 패턴 (함정)

`pingRepository.save(ping)` 직후 `pingRepository.findById(id)` 호출 시 **JPA 1차 캐시 hit** — saved 인스턴스 그대로 반환. SELECT 쿼리 실제 안 실행. DB 측 default `NOW()` 가 채운 `created_at` 이 entity 에 미반영되어 `assertNotNull(fetched.createdAt)` 실패.

**해결**: `EntityManager.flush()` + `EntityManager.clear()` 후 `findById` → SELECT 실제 실행. created_at 정상 채워짐.

**교훈**: Phase 1A 이후 모든 Repository 검증 테스트에 동일 패턴 적용 필요 — 단순 save+findById 만으로 INSERT/SELECT "둘 다" 검증되지 않음. 글로벌 룰 `~/.claude/rules/kotlin/spring/jpa-mongodb.md` 의 N+1 / batch / 트랜잭션 룰과 별개로 본 함정도 인지 의무.

## 6. 폐기 시점

본 PoC 산출물 5개 (`PingEntity` / `PingRepository` / `PingRepositoryIT` / `V1__create_ping.sql` / `application.properties` 의 datasource 블록) 는 **Phase 1A 진입 시 폐기**:

- `01-phase §3 Week 1A` 의 1A-3 (Flyway 마이그레이션 셋업 + Users Entity 첫 스키마) 에서 본격 schema 시작 → `V1__create_ping.sql` 제거 + `V1__create_users.sql` 신설
- `01-phase §3` 의 1A-5 (Project Entity 단순 버전 CRUD end-to-end — 패턴 검증용) 가 본격 패턴 셋업. Ping 은 PoC 한정 — 본격 코드 진입 시 폐기

`application.properties` 자체는 유지 (datasource 설정은 1A-2 에서 application.yml 로 전환).

## 7. 다음 단계

- Phase 0-1 (TipTap 한국어 IME 검증) 또는 Phase 0-3 (PWA manifest) — 사용자 결정 영역
- 또는 회고 진입 — 본 회귀 사례를 `.claude/rules/shared/agent-workflow-discipline.md` 의 회귀 사례로 surfacing 검토 (옵션 매트릭스에 "(검증 필요)" 마크 안 박고 진행한 영역 — Kotlin 의 Java target 한계 미검증 채 docs 박음)
