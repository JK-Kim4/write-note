# 외부 데이터 스토어 안전 (DB · redis) — HARD-GATE

본 프로젝트(write-note)의 외부 데이터 스토어에 대한 Claude 자동 작업 가드레일.
범위는 **DB (PostgreSQL / Supabase Postgres) + redis (도입 시점부터)** 한정.
외부 API · 클라우드 콘솔 · 모니터링은 본 룰 미적용 (별도 룰 검토).

## 왜 이 룰이 필요한가

LLM 은 컨텍스트에 잡힌 자격증명 / 환경변수 / 마이그레이션 파일을 보고 **"기왕이면 실행까지"** 로 진입하기 쉽다.
한 번의 독단 INSERT / UPDATE / TRUNCATE 가 운영 데이터를 되돌리기 어렵게 만든다.
**쓰기는 항상 사용자 명시 컨펌이 필요한 결정**이며, 룰로 의도를 박고 `settings.json` deny 로 차단을 보강한다.

## 1. 쓰기 작업 — 사용자 명시 컨펌 없이 실행 금지

다음 작업은 **사용자가 본 세션에서 명시적으로 "실행해줘" 발언한 경우에만 실행 가능**:

| 카테고리 | 차단 대상 (예시) |
|---|---|
| DDL | `CREATE` / `ALTER` / `DROP` / `TRUNCATE` / `RENAME` (table, index, schema, sequence, type, function) |
| DML 쓰기 | `INSERT` / `UPDATE` / `DELETE` / `MERGE` / `UPSERT` |
| 락 획득 | `SELECT ... FOR UPDATE` / `SELECT ... FOR SHARE` |
| 통계 / 공간 | `VACUUM` / `ANALYZE` / `REINDEX` (통계·메타 변경) |
| 데이터 이동 | `COPY ... FROM` (stdin/file → table) |
| 권한 / config | `GRANT` / `REVOKE` / `SET ROLE` / `ALTER USER` / `ALTER SYSTEM` |
| 백업 / 복구 | `pg_restore` / `pg_dump --clean` / `redis BGREWRITEAOF` / `redis SAVE` |
| redis 쓰기 | `SET` / `DEL` / `FLUSHDB` / `FLUSHALL` / `RENAME` / `HSET` / `LPUSH` / `RPUSH` / `ZADD` / `SADD` / `EXPIRE` / `PERSIST` / `MIGRATE` / `PUBLISH` / `CONFIG SET` / `DEBUG *` |

**예외 (실행이 아닌 작성·검토는 허용)**:
- 마이그레이션 SQL 파일 작성 / 수정 / 리뷰 → OK
- 마이그레이션 적용 (`./gradlew flywayMigrate`, `psql -f`, `liquibase update`) → **컨펌 필수**
- 단위 테스트 내 `@Sql` / `@Transactional + rollback` 기반 fixture → OK (테스트 격리 환경 한정)

## 2. 읽기 작업 — 컨펌 없이 허용

| 카테고리 | 허용 대상 (예시) |
|---|---|
| DML 읽기 | `SELECT` (락 절 없음) |
| 메타데이터 | `\d`, `\dt`, `\df`, `information_schema.*`, `pg_catalog.*` |
| 실행 계획 | `EXPLAIN` (단, `EXPLAIN ANALYZE` 는 실제 실행 → §1 적용) |
| redis 읽기 | `GET` / `MGET` / `EXISTS` / `TYPE` / `TTL` / `HGETALL` / `LRANGE` / `SMEMBERS` / `ZRANGE` / `SCAN` / `KEYS` (운영에서 KEYS 는 블로킹 주의) |
| 통계 조회 | `pg_stat_*` 뷰, redis `INFO` / `CONFIG GET` / `CLIENT LIST` |

**주의 — 읽기로 위장한 쓰기**:
- `EXPLAIN ANALYZE INSERT/UPDATE/DELETE` → 실제 실행됨 → 쓰기
- `SELECT pg_advisory_lock(...)` → 락 획득 → 쓰기
- `SELECT setval('seq', ...)` → 시퀀스 변경 → 쓰기
- redis `GETSET`, `GETDEL` → 읽기 + 변경 → 쓰기

## 3. 인프라 접속 민감 정보 — 독단 재사용 금지

다음 시그널 발견 시 **즉시 stop + 사용자 컨펌**:

- `.env`, `.env.local`, `.env.production`, `.env.development` 등 환경 파일 Read 시도
- 환경변수 echo / printenv / `set | grep` — 특히 `DATABASE_URL`, `REDIS_URL`, `*_PASSWORD`, `*_TOKEN`, `*_KEY`, `*_SECRET`, `SUPABASE_*`
- 이전 세션 / 다른 워크트리 / 다른 프로젝트에서 본 자격증명을 본 세션에 재투입
- DB 접속 문자열 / API 키를 코드 · 문서 · commit 메시지 · 로그에 직접 인용
- `.env.sample` Read 후 실제 `.env` 도 비슷할 것이라 추정하여 Read 시도

**허용**:
- 본 세션에서 사용자가 명시적으로 제공한 자격증명을 본 세션 내에서 사용
- 단, 파일 · commit · 로그 · 회고 산출물에 영구화 금지
- 사용 직후 본 세션 외부로 전파 금지 (다른 워크트리 작업에 캐리 X)

## self-check 의무 (HARD-GATE)

DB / redis 관련 도구 호출 직전 다음 3 질문 의무. 대상 도구:
- `Bash` 중 `psql`, `pg_dump`, `pg_restore`, `redis-cli`, `flyway`, `liquibase`
- Spring Data Repository / `JdbcTemplate` / `EntityManager` 직접 실행 코드
- MCP DB 서버 (`mcp__*__query`, `mcp__*__execute` 등)
- `docker exec ... psql/redis-cli ...`

| Q | 질문 | NO 시 |
|---|---|---|
| Q1 | 이 작업이 **읽기**인가 **쓰기**인가? §1·§2 표에서 분류했나? | 분류 안 했으면 stop, 분류부터 |
| Q2 | 쓰기라면 사용자가 **본 세션에서 명시적으로 실행 컨펌**했나? | NO → stop, 컨펌 받기 |
| Q3 | 접속 자격증명 **출처가 명확**한가? (이전 세션 / 다른 워크트리 / `.env` 무단 Read 가 아닌가) | NO → stop, 출처 보고 |

1개라도 NO → 즉시 stop. 사용자에게 다음을 명시 후 컨펌:
1. 작업 의도 (어떤 변경을 어떤 데이터에 가하는가)
2. 영향 범위 (어떤 row / key / 테이블 / 인덱스)
3. rollback 방안 (트랜잭션 / 백업 / `BEGIN; ... ROLLBACK;` dry-run 가능 여부)

## 회피 안티패턴

- **"테스트 데이터 삽입은 쓰기 아니다" 단정** — `INSERT` 는 쓰기. 테스트 환경이라도 컨펌 필수 (단, 단위 테스트 내 `@Sql` / `@Transactional rollback` 격리 fixture 는 §1 예외)
- **"production 아니니 자유" 단정** — 환경 식별 자체가 사용자 컨펌 영역. 본 세션에서 환경 확인 없이 dev/staging 단정 금지
- **마이그레이션 파일 작성 후 사용자 모르게 적용** — 작성·리뷰 OK, 적용은 컨펌
- **`.env.sample` Read 후 실제 `.env` 추정 Read** — 다른 파일. 시그널 §3 적용
- **사용자가 한 번 컨펌한 쓰기 작업의 범위 확장** — "컨펌 받은 김에 비슷한 것도" 금지. 컨펌은 명시 범위만
- **읽기 가장 쓰기** — `EXPLAIN ANALYZE INSERT`, `GETSET`, `setval` 등을 "조회" 로 분류
- **운영 신호 우회** — slow query log / connection pool 경고 발견 시 끄지 말고 추적 (`~/.claude/rules/shared/observability-signals.md` 적용)

## 다층 방어 — 본 룰의 위치

| 층 | 메커니즘 | 강제력 | 위치 |
|---|---|---|---|
| 1 | 본 룰 (의도 명시 + self-check) | 약 (Claude 이행 시) | `.claude/rules/infra/external-infra-safety.md` |
| 2 | `settings.json` permission deny | 중 (Bash 패턴 차단) | `.claude/settings.json` |
| 3 | PreToolUse 훅 | 강 (정밀 차단) | 인프라 도입 시점 별도 검토 |
| 4 | 인프라 read-only credential | 최강 (Claude 통제 밖) | Supabase / Render — DB 도입 시점 |

본 프로젝트 현 시점 (V1 wireframe 완료, 구현 진입 전): 1+2 즉시 적용. 3+4 는 인프라 실제 도입 시점에 검토.

## 인접 룰 / 출처

- 글로벌 `~/.claude/rules/shared/security.md` — 시크릿 관리 / 자격증명 보호
- 글로벌 `~/.claude/rules/shared/observability-signals.md` — DB / redis 운영 신호 취급
- 프로젝트 `CLAUDE.md` — 기술 스택 / SoT
- 글로벌 `~/.claude/rules/java/spring/jpa-mongodb.md` — JPA `@Transactional` / N+1 / 트랜잭션 경계
