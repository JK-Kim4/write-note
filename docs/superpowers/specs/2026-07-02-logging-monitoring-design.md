# 백엔드 로그 모니터링 (Grafana Loki + Alloy + Grafana) — 설계 문서

- 작성일: 2026-07-02
- 상태: 브레인스토밍 확정(사용자 승인) → 구현 계획(writing-plans) 입력 대기
- 기반 조사·학습:
  - OCI free-a1 유휴 자원 실측 + ELK 수용성 조사 (본 세션, 2026-07-02)
  - 학습 문서 `docs/research/2026-07-02-loki-grafana-learning-guide.html` (개념·LogQL·실습)
  - 로컬 실습 검증 `~/loki-playground` (Alloy docker 수집 → Loki → Grafana 끝단 확인)

## 0. 배경 · 문제

운영 백엔드(OCI free-a1, Docker)의 로그를 보려면 현재 `ssh oci` 후 `docker logs` 가 유일한 수단이다. 에러 발생을 알 방법이 없고(알림 0), 과거 로그 검색·집계도 불가능하다. 본 설계는 같은 서버에 경량 로그 스택(Loki + Alloy + Grafana)을 additive 로 올려 조회·검색·알림을 갖춘다.

**인프라 실측 (2026-07-02, OCI CLI + ssh):**

| 항목 | 값 |
|---|---|
| 인스턴스 | VM.Standard.A1.Flex, 2 OCPU (aarch64), 12GB RAM, 디스크 185GB 여유 |
| 상주 부하 | 백엔드 컨테이너 ~516MB + PostgreSQL 컨테이너 ~52MB + 호스트 Caddy. 부하평균 ~0 |
| 유휴 메모리 | 약 10GB. **스왑 없음** (자원 상한 필수 근거) |
| A1 무료 한도 | 코어 2/2·메모리 12/12 전부 사용 중 — **증설 불가, 동거 확정** |
| 백엔드 기동 | blue-green: `wn-be-blue`(:8080)/`wn-be-green`(:8081) 교대, `--network host`, 구 컨테이너는 중지 상태로 잔존 |
| 백엔드 로깅 | Spring Boot 기본 텍스트 콘솔 (logback xml 없음, prod 프로파일 로깅 오버라이드 없음) |

**ELK 기각 근거:** 상주 ~3GB+(JVM 힙)로 무료 한도 소진 상태의 동거 서버에 과함. Loki 스택은 ~1GB 상한으로 같은 목적 달성 (조사 결론).

## 1. 확정 결정 (사용자 승인)

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| D1 | 수집 범위 | **서버 Docker 컨테이너 전부** (백엔드 + PostgreSQL + 모니터링 스택 자신) | Alloy 자동 발견이라 백엔드만 잡는 것과 비용 동일, DB 에러도 같은 화면에서 |
| D2 | 수집 경로 | **Alloy docker.sock 수거** (직접 전송·Loki 드라이버 기각) | 앱 무변경·결합 최소·실습 검증 완료. 로깅 스택 전체가 죽어도 서비스 무영향 |
| D3 | Grafana 접근 | **Caddy 서브도메인 `logs.soseolbi.com`** | 기기 무관 접근 + Grafana 로그인 보호. Loki/Alloy 는 외부 미노출 |
| D4 | 보존 기간 | **14일** (사용자 지정) | 현 트래픽에서 디스크 부담 무시 가능 수준 |
| D5 | 알림 채널 | **Discord 웹훅** (사용자 지정) | Grafana 네이티브 contact point, URL 하나로 구성 |
| D6 | 백엔드 로그 포맷 | **prod 프로파일만 logstash flat JSON** | Spring Boot 4.0.0 공식 지원 검증 완료(`logging.structured.format.console: logstash`). 로컬은 텍스트 유지 |
| D7 | 라벨 | **`container` + `app` 2개만** | 카디널리티 원칙. level 은 라벨 아닌 질의 시점 파싱 |
| D8 | 자원 상한 | Loki 1g/0.75코어 · Grafana 512m/0.5코어 · Alloy 256m/0.25코어 | 스왑 없는 서버 OOM 가드. 합계 상한 1.75GB |

## 2. 아키텍처

```
[wn-be-blue/green] [write-note-postgres]     (기존 — 무변경)
        │ stdout            │ stdout
        └────── docker.sock (ro) ──────┐
                                       ▼
                              [Alloy] ──HTTP push──▶ [Loki :3100(127.0.0.1)]
                                                        ▲ LogQL
                              [Grafana :3200(127.0.0.1)]┘
                                       ▲
                     Caddy(호스트) logs.soseolbi.com reverse_proxy
```

- 신규 = **Docker Compose 스택 1개** (loki·alloy·grafana 3컨테이너, 전용 브리지 네트워크). 기존 컨테이너·배포 스크립트 무변경.
- 포트: Grafana `127.0.0.1:3200`(Caddy 프록시 대상), Loki `127.0.0.1:3100`(서버 내 상태 확인용), Alloy 미노출. 외부 직접 노출 0.
- 백엔드 `--network host` 는 무관 — 수집이 네트워크가 아닌 docker.sock 경유(로컬 실습에서 동일 구조 검증).
- Alloy 의 docker.sock 마운트는 **read-only**.

## 3. 형상관리 · 배포 (신규 `infra/monitoring/`)

repo 정본(agent-workflow-discipline §23) 구성:

```
infra/monitoring/
├── docker-compose.yml          # 이미지 태그 버전 고정(latest 금지), 자원 상한 포함
├── loki-config.yaml            # 모놀리식 + filesystem + tsdb v13 + 보존 14d
├── config.alloy                # discovery.docker + relabel + loki.write
├── grafana/provisioning/datasources/loki.yaml   # 데이터소스 자동 등록
└── README.md                   # 서버 반영 절차
```

- 서버 배치: `/home/ubuntu/monitoring/` (scp 반영 → `docker compose up -d`).
- 비밀값: Grafana admin 비밀번호는 서버 `/etc/write-note/monitoring.env` 에만 (backend.env 선례). Discord 웹훅 URL 은 Grafana UI 로 1회 구성(Grafana DB 볼륨에 영속) — **repo 에 비밀값 0**.
- 이미지 버전: 구현 시점 최신 안정 태그 확인 후 고정 (Loki 3.x / Alloy 1.x / Grafana — 실습에서 13.1.0 확인).
- Caddy: `logs.soseolbi.com` 블록 추가(`reverse_proxy localhost:3200`). TLS 구성은 서버 Caddyfile 의 기존 `api.soseolbi.com` 블록 패턴을 구현 시 확인해 동일 적용 + Cloudflare DNS 레코드 1개 추가 (Origin Certificate 의 서브도메인 커버 여부 구현 시 확인).
- **운영 서버 상태 변경(스택 기동·Caddyfile 수정·DNS)은 실행 직전 사용자 컨펌** (external-infra-safety §1).

## 4. 수집 · 라벨 설계

Alloy 파이프라인 (학습 문서 4-1절 검증 구성의 운영판):

```
discovery.docker (5s) → discovery.relabel → loki.source.docker → loki.write(http://loki:3100)
```

relabel 규칙:

| 라벨 | 값 | 규칙 |
|---|---|---|
| `container` | Docker 컨테이너 이름 그대로 | `__meta_docker_container_name` 에서 `/` 제거 |
| `app` | `backend` | 이름 `wn-be-.*` 매칭 |
| `app` | `postgres` | 이름 `write-note-postgres` 매칭 |
| `app` | (미부여) | 그 외(모니터링 스택 자신 등)는 `container` 라벨만 |

- 평시 질의는 `{app="backend"}` (blue/green 무관). 배포 직후 새 컨테이너만 보려면 `{container="wn-be-green"}`.
- **level 은 라벨로 뽑지 않는다** — `| json | level="ERROR"` 질의 시점 파싱. (Loki 3.x 자동 레벨 감지 `detected_level` 존재로 알고 있으나 미검증 — 구현 시 확인, 없어도 파서로 충분.)
- 구 blue/green 컨테이너는 중지 상태로 잔존하나 discovery 는 실행 중 컨테이너만 잡으므로 무영향.

## 5. 백엔드 로그 포맷 (prod 만 JSON)

`backend/src/main/resources/application-prod.yml` 에 추가 (검증 완료 — Spring Boot 4.0.0 reference):

```yaml
logging:
  structured:
    format:
      console: logstash
```

- 출력: flat JSON `{"@timestamp":..., "level":"ERROR", "logger_name":..., "message":..., (MDC 자동 포함)}` → LogQL `| json` 과 정합.
- 로컬(local 프로파일)·테스트 무변경 — 사람이 읽는 텍스트 유지.
- 백엔드 재배포 1회 필요 (blue-green). 로깅 레이어 변경이므로 API 계약 무관, 배포 순서 제약 없음.

## 6. Loki 설정 핵심

- 모놀리식(`-target=all` 단일 프로세스), filesystem 저장, tsdb v13 스키마 (로컬 실습 구성 계승).
- 보존:

```yaml
compactor:
  working_directory: /loki/retention
  delete_request_store: filesystem
  retention_enabled: true
limits_config:
  retention_period: 14d
```

- `auth_enabled: false` (단일 테넌트, 외부 미노출이므로).

## 7. Grafana 구성

- 데이터소스: provisioning 파일로 Loki 자동 등록 (UI 수동 등록 금지 — 재현성).
- 계정: admin 단일 계정(비밀번호 env), 익명 접근·회원가입 비활성.
- 알림: contact point = Discord(웹훅 URL, UI 1회 구성). v1 알림 규칙 1개 — **"5분간 백엔드 ERROR 1건 이상 → Discord 통지"**, 질의는 JSON 파싱 기반(R2 이후 구성): `sum(count_over_time({app="backend"} | json | level="ERROR" [5m])) >= 1`. 저트래픽이라 전수 통지로 시작, 소음 시 임계 상향.
- 대시보드 v1: (a) 시간대별 레벨 분포 그래프, (b) 최근 ERROR 로그 패널, (c) 컨테이너별 로그량. 이후 필요 시 추가.

## 8. 검증 전략

1. **로컬 선검증**: `~/loki-playground` 를 본 설계 구성(relabel 규칙·버전 고정 태그·보존 설정)으로 교체해 재검증 — 라벨 부여·JSON 파싱 질의까지 로컬에서 확인 후 서버 반영.
2. **운영 dogfooding 게이트** (반영 후):
   - `{app="backend"}` 실로그 조회 + `| json | level="ERROR"` 파싱 동작 (JSON 전환 배포 후)
   - blue-green 배포 1회 수행 후 새 컨테이너 로그 자동 추적 확인
   - Discord 테스트 알림 수신 확인 (Grafana contact point test)
   - 스택 재기동(`docker compose restart`) 후 로그·설정 영속 확인
3. **서비스 무영향 확인**: 스택 기동 후 `docker stats` 로 상한 준수 + 백엔드 응답 정상 확인.

## 9. 구현 라운드 (계획 입력용)

- **R1 — 스택 구축·서버 반영**: `infra/monitoring/` 작성 → 로컬 선검증 → (컨펌) 서버 기동 + Caddy/DNS → Grafana 접속 확인
- **R2 — 백엔드 JSON 로그**: application-prod.yml 1줄 + 게이트 GREEN → (컨펌) blue-green 재배포 → JSON 파싱 질의 확인
- **R3 — 대시보드·알림**: 데이터소스 provisioning 확인, 대시보드 v1, Discord contact point + ERROR 알림 규칙 + 테스트 발화

R1과 R2 는 기술적으로 독립이나 R1 선행이 자연스럽다(스택이 있어야 R2 결과를 눈으로 확인).

## 10. 범위 밖 (이번에 안 함)

- Caddy HTTP 접근 로그 수집 (journald/파일 수집 부품 + Caddyfile log 지시자 — 후속 additive 가능)
- 서버·앱 메트릭(CPU/메모리/응답시간 — Prometheus 영역), 트레이스
- 가동상태(uptime) 외부 감시 (로그 스택으로는 "서버 통째 다운"을 못 잡음 — 별도 주제)
- 로컬 개발 환경 로그 수집, Promtail(EOL 2026-03-02) 관련 일체

## 11. 참고 자산

- 학습 문서(개념·실습): `docs/research/2026-07-02-loki-grafana-learning-guide.html`
- 로컬 실습 환경: `~/loki-playground` (형상관리 밖, R1 에서 설계 구성으로 교체 재활용)
- 공식 문서: Loki get-started / LogQL / Alloy / Grafana Alerting (학습 문서 10절 링크)
