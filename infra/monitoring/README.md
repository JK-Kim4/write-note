# 로그 모니터링 스택 (Loki + Alloy + Grafana)

운영(OCI free-a1) 로그 수집·조회·알림. 설계 SoT = `docs/superpowers/specs/2026-07-02-logging-monitoring-design.md`.

## 구성

- `docker-compose.yml` — 3 컨테이너(버전 고정·자원 상한). Grafana `127.0.0.1:3200`, Loki `127.0.0.1:3100` (외부 미노출, 공개 진입은 Caddy `logs.soseolbi.com`)
- `loki-config.yaml` — 모놀리식 + filesystem + tsdb v13, 보존 14d
- `config.alloy` — docker.sock 전 컨테이너 수집, 라벨 `container`/`app`(wn-be-* = backend, write-note-postgres = postgres)
- `monitoring.env` — **gitignore.** 환경별 생성: `GF_SECURITY_ADMIN_PASSWORD=<값>` 1줄, chmod 600

## 서버 반영 (사용자 컨펌 후)

```bash
ssh oci 'mkdir -p ~/monitoring/grafana/provisioning/datasources'
scp /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring/docker-compose.yml \
    /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring/loki-config.yaml \
    /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring/config.alloy oci:monitoring/
scp /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring/grafana/provisioning/datasources/loki.yaml \
    oci:monitoring/grafana/provisioning/datasources/
ssh oci 'cd ~/monitoring && sudo docker compose up -d'
```

설정 변경 반영도 동일(scp 후 `sudo docker compose up -d` 재실행). 중지: `sudo docker compose down` (볼륨 보존).

## 로컬 검증

같은 디렉토리에서 `monitoring.env` 만들고 `docker compose up -d` — Grafana http://localhost:3200 (admin / env 값).
