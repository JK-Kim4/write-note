# 로그 모니터링 (Loki + Alloy + Grafana) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영 서버(OCI free-a1)에 Loki+Alloy+Grafana 로그 스택을 additive 로 올려 백엔드·DB 로그 조회와 Discord 에러 알림을 갖춘다.

**Architecture:** 신규 Docker Compose 스택 1개(전용 브리지 네트워크). Alloy 가 docker.sock(ro)으로 전 컨테이너 stdout 로그를 수거해 Loki 에 push, Grafana 는 Caddy 서브도메인(logs.soseolbi.com) 뒤에서 조회·알림. 기존 백엔드·PostgreSQL 컨테이너·blue-green 배포 스크립트 무변경.

**Tech Stack:** Loki 3.7.3 / Alloy v1.17.1 / Grafana 13.1.0 (전부 Docker Hub 태그 실재 + arm64 동작 검증 완료), Spring Boot 4.0.0 structured logging (logstash JSON).

**Spec:** `docs/superpowers/specs/2026-07-02-logging-monitoring-design.md`

## Global Constraints

- 이미지 태그 고정: `grafana/loki:3.7.3` / `grafana/alloy:v1.17.1` / `grafana/grafana:13.1.0` (latest 금지)
- 자원 상한: Loki `mem_limit: 1g, cpus: 0.75` / Grafana `512m, 0.5` / Alloy `256m, 0.25`
- 보존 14일 (`retention_period: 14d`), 라벨은 `container` + `app` 2개만
- 외부 노출 0: Loki/Grafana 는 `127.0.0.1` 바인딩만, 공개 진입은 Caddy `logs.soseolbi.com` 프록시 유일
- repo 에 비밀값 0: `infra/monitoring/monitoring.env` 는 gitignore, Discord 웹훅 URL 은 Grafana UI 에만
- **운영 서버 상태 변경(Task 4·5·6 의 서버 실행 단계)은 실행 직전 사용자 컨펌 필수** (external-infra-safety §1)
- 원격 실행·전송 명령은 절대경로/subshell + exit code 확인 (agent-workflow-discipline §30)
- 작업 브랜치: develop 직접 (신규 파일 위주 + 백엔드 1줄 — 028 선례)

---

### Task 1: `infra/monitoring/` 설정 파일 일체 작성

**Files:**
- Create: `infra/monitoring/docker-compose.yml`
- Create: `infra/monitoring/loki-config.yaml`
- Create: `infra/monitoring/config.alloy`
- Create: `infra/monitoring/grafana/provisioning/datasources/loki.yaml`
- Create: `infra/monitoring/README.md`
- Modify: `.gitignore` (15행 근처, `.env*.local` 아래)

**Interfaces:**
- Produces: compose 서비스명 `loki`/`alloy`/`grafana`, Grafana 호스트 포트 `127.0.0.1:3200`, Loki 호스트 포트 `127.0.0.1:3100`, 라벨 `container`(전 컨테이너)·`app`(`backend`|`postgres`), env 파일 규약 `./monitoring.env`(compose 옆, gitignore) — Task 2~7 이 전부 이 값을 사용

- [ ] **Step 1: `infra/monitoring/docker-compose.yml` 작성**

```yaml
services:
  loki:
    image: grafana/loki:3.7.3
    command: -config.file=/etc/loki/config.yaml
    ports:
      - "127.0.0.1:3100:3100"   # 서버 내 상태 확인용. 외부 미노출
    volumes:
      - ./loki-config.yaml:/etc/loki/config.yaml:ro
      - loki-data:/loki
    mem_limit: 1g
    cpus: 0.75
    restart: unless-stopped

  alloy:
    image: grafana/alloy:v1.17.1
    command: run --storage.path=/var/lib/alloy/data /etc/alloy/config.alloy
    volumes:
      - ./config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - alloy-data:/var/lib/alloy/data
    mem_limit: 256m
    cpus: 0.25
    restart: unless-stopped
    depends_on:
      - loki

  grafana:
    image: grafana/grafana:13.1.0
    ports:
      - "127.0.0.1:3200:3000"   # Caddy reverse_proxy 대상. 외부 미노출
    env_file:
      - ./monitoring.env        # GF_SECURITY_ADMIN_PASSWORD (gitignore, 환경별 생성)
    environment:
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_ROOT_URL=https://logs.soseolbi.com   # 알림 메시지 내 링크 도메인 (로컬 검증엔 무해)
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana-data:/var/lib/grafana
    mem_limit: 512m
    cpus: 0.5
    restart: unless-stopped
    depends_on:
      - loki

volumes:
  loki-data:
  alloy-data:
  grafana-data:
```

주: env 파일 경로는 스펙의 `/etc/write-note/monitoring.env` 를 `./monitoring.env`(compose 옆)로 정정 — 로컬 선검증과 서버가 같은 compose 파일로 동작하기 위함(스펙 정정 사항, 커밋 메시지에 명시).

- [ ] **Step 2: `infra/monitoring/loki-config.yaml` 작성**

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-04-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

compactor:
  working_directory: /loki/retention
  delete_request_store: filesystem
  retention_enabled: true

limits_config:
  retention_period: 14d
```

- [ ] **Step 3: `infra/monitoring/config.alloy` 작성**

```alloy
discovery.docker "all" {
  host             = "unix:///var/run/docker.sock"
  refresh_interval = "5s"
}

discovery.relabel "all" {
  targets = []

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/wn-be-.*"
    target_label  = "app"
    replacement   = "backend"
  }

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/write-note-postgres"
    target_label  = "app"
    replacement   = "postgres"
  }
}

loki.source.docker "all" {
  host          = "unix:///var/run/docker.sock"
  targets       = discovery.docker.all.targets
  relabel_rules = discovery.relabel.all.rules
  forward_to    = [loki.write.default.receiver]
}

loki.write "default" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

- [ ] **Step 4: `infra/monitoring/grafana/provisioning/datasources/loki.yaml` 작성**

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: true
    editable: false
```

- [ ] **Step 5: `.gitignore` 에 env 제외 추가** — 기존 `.env*.local`(14행) 아래에:

```
infra/monitoring/monitoring.env
```

- [ ] **Step 6: `infra/monitoring/README.md` 작성**

````markdown
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
````

- [ ] **Step 7: compose 문법 검증**

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring && echo "GF_SECURITY_ADMIN_PASSWORD=localtest" > monitoring.env && docker compose config -q && echo "compose OK"
```

Expected: `compose OK` (오류 시 yaml 수정)

- [ ] **Step 8: Commit**

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note && git add infra/monitoring .gitignore && git commit -m "feat(infra): 로그 모니터링 스택 구성 — Loki/Alloy/Grafana compose (버전 고정·자원 상한·보존 14d)

스펙 정정: monitoring.env 경로 /etc/write-note → compose 상대경로(로컬/서버 동일 동작)"
```

---

### Task 2: 로컬 선검증 — 운영 구성 그대로 Mac 에서 끝단 확인

**Files:** 없음 (검증만. `~/loki-playground` 는 실습용 구버전이라 먼저 제거)

**Interfaces:**
- Consumes: Task 1 의 compose (`infra/monitoring/`, env 파일 `monitoring.env` 이미 Step 7 에서 생성)
- Produces: 검증된 스택 — Task 4 는 이 구성을 서버에 그대로 반영

- [ ] **Step 1: 구 실습 스택 제거 (포트 3100/3200 충돌 방지)**

```bash
(cd ~/loki-playground && docker compose down -v) && echo "playground 정리 완료"
```

Expected: 컨테이너·볼륨 삭제 메시지 후 `playground 정리 완료`

- [ ] **Step 2: 로컬 DB 기동 (라벨 `app="postgres"` 검증 대상 확보)**

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note && docker compose up -d --wait postgres
```

Expected: `write-note-postgres` Healthy

- [ ] **Step 3: 스택 기동**

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring && docker compose up -d && docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

Expected: monitoring-loki-1 / monitoring-alloy-1 / monitoring-grafana-1 모두 Up

- [ ] **Step 4: 버전·수집·라벨 검증 (30초 대기 후)**

```bash
sleep 30
curl -s http://localhost:3100/loki/api/v1/status/buildinfo | python3 -c "import json,sys; print('loki', json.load(sys.stdin)['version'])"
curl -s "http://localhost:3100/loki/api/v1/label/app/values" | python3 -m json.tool
curl -sG "http://localhost:3100/loki/api/v1/query_range" --data-urlencode 'query={app="postgres"}' --data-urlencode 'limit=1' | python3 -c "import json,sys; print('postgres 스트림:', len(json.load(sys.stdin)['data']['result']))"
```

Expected: `loki 3.7.3` / app values 에 `"postgres"` 포함 / `postgres 스트림: 1` (참고: `app="backend"` 는 wn-be-* 컨테이너가 로컬에 없어 서버 반영 후 검증 — relabel 메커니즘 자체는 postgres 규칙으로 동일 증명)

- [ ] **Step 5: Grafana 데이터소스 provisioning 검증**

```bash
curl -s -u admin:localtest http://localhost:3200/api/datasources | python3 -c "import json,sys; ds=json.load(sys.stdin); print([(d['name'], d['type'], d['isDefault']) for d in ds])"
```

Expected: `[('Loki', 'loki', True)]` — UI 수동 등록 없이 자동 등록 확인

- [ ] **Step 6: 자원 상한 적용 검증**

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}" | grep monitoring
```

Expected: LIMIT 열이 1GiB / 256MiB / 512MiB 로 표시 (usage 는 그 미만)

- [ ] **Step 7: 로컬 스택 정리 (검증 완료 후. 서버가 본 무대이므로 로컬 상주 불필요)**

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring && docker compose down -v && echo "로컬 검증 완료·정리"
```

Expected: `로컬 검증 완료·정리` (커밋 없음 — 검증 태스크)

---

### Task 3: 백엔드 prod JSON 구조화 로깅 (R2 코드 변경분)

**Files:**
- Modify: `backend/src/main/resources/application-prod.yml` (현재 11행 파일 끝에 추가)

**Interfaces:**
- Produces: 운영 로그 flat JSON (`level`/`logger_name`/`message`/`@timestamp` + MDC) — Task 6 배포 후 Task 7 의 `| json` 질의·알림 규칙이 이 필드를 사용

TDD 주: 설정 파일 수정 = CLAUDE.md §5-5 예외 (테스트 파일 없음). 검증은 실행 관찰 + 기존 게이트.

- [ ] **Step 1: `application-prod.yml` 끝에 추가**

```yaml

logging:
  structured:
    format:
      console: logstash
```

(기존 `app.cookie.secure: true` 블록 아래, 최상위 `logging:` 키)

- [ ] **Step 2: 로컬 실행 관찰로 JSON 출력 검증** — prod 프로파일 대신 CLI 속성 오버라이드로 같은 기능을 로컬에서 확인 (로컬 DB 는 Task 2 Step 2 에서 기동됨):

```bash
(cd /Users/jongwan-air/Desktop/workspaces/write-note/backend && timeout 90 ./gradlew bootRun --args='--spring.profiles.active=local --logging.structured.format.console=logstash' 2>&1 | grep -m 2 '"@timestamp"')
```

Expected: `{"@timestamp":...,"level":"INFO",...,"logger_name":...}` 형태 JSON 라인 2줄 출력 (기동 로그가 JSON 으로 나오면 성공, timeout 종료는 정상)

- [ ] **Step 3: 백엔드 전체 게이트**

```bash
(cd /Users/jongwan-air/Desktop/workspaces/write-note/backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build)
```

Expected: BUILD SUCCESSFUL (yml 1줄 추가라 기존 테스트 무영향이어야 함 — RED 시 원인 추적)

- [ ] **Step 4: Commit**

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note && git add backend/src/main/resources/application-prod.yml && git commit -m "feat(backend): 운영 프로파일 logstash JSON 구조화 로깅 — Loki | json 질의 정합"
```

---

### Task 4: 서버 스택 기동 (운영 반영 — **사용자 컨펌 게이트**)

**Files:** 없음 (서버 작업. repo 정본은 Task 1)

**Interfaces:**
- Consumes: Task 1 의 `infra/monitoring/` 일체, README 의 반영 절차
- Produces: 서버 `~/monitoring/` 스택 가동, `{app="backend"}` 로그 유입 — Task 5(Caddy)·Task 7(Grafana 구성)의 전제

- [ ] **Step 1: 사용자 컨펌** — "운영 서버에 모니터링 스택 3 컨테이너를 기동합니다(기존 컨테이너 무변경, 자원 상한 합계 1.75GB, 롤백 = `sudo docker compose down`). 진행할까요?" 명시 승인 후 진행

- [ ] **Step 2: develop push + 서버 디렉토리 생성 + 파일 전송** (절대경로, §30)

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note && git push origin develop
ssh oci 'mkdir -p ~/monitoring/grafana/provisioning/datasources' && echo "mkdir exit=$?"
scp /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring/docker-compose.yml /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring/loki-config.yaml /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring/config.alloy oci:monitoring/ && echo "scp1 exit=$?"
scp /Users/jongwan-air/Desktop/workspaces/write-note/infra/monitoring/grafana/provisioning/datasources/loki.yaml oci:monitoring/grafana/provisioning/datasources/ && echo "scp2 exit=$?"
```

Expected: 각 `exit=0`

- [ ] **Step 3: 서버 monitoring.env 생성 (admin 비밀번호)** — 로컬에서 생성해 사용자에게 1회 표시(비밀번호 관리자 저장 안내), 서버 파일은 chmod 600:

```bash
PW=$(openssl rand -base64 18) && echo "Grafana admin 비밀번호(저장하세요): $PW" && ssh oci "umask 177 && echo 'GF_SECURITY_ADMIN_PASSWORD=$PW' > ~/monitoring/monitoring.env" && echo "env exit=$?"
```

Expected: 비밀번호 1회 표시 + `env exit=0`

- [ ] **Step 4: 스택 기동 + 상태 확인**

```bash
ssh oci 'cd ~/monitoring && sudo docker compose up -d && sudo docker compose ps --format "table {{.Name}}\t{{.Status}}"'
```

Expected: 3 컨테이너 Up (이미지 pull 포함 1~2분)

- [ ] **Step 5: 끝단 검증 — 백엔드 로그 유입 + 자원 상한 + 서비스 무영향**

```bash
ssh oci 'sleep 30; curl -s http://localhost:3100/loki/api/v1/label/app/values; echo; curl -sG http://localhost:3100/loki/api/v1/query_range --data-urlencode "query={app=\"backend\"}" --data-urlencode "limit=1" | head -c 300; echo; sudo docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"'
curl -s -o /dev/null -w "api health=%{http_code}\n" https://api.soseolbi.com/actuator/health
```

Expected: app values 에 `backend`(+`postgres`), backend 스트림 결과 존재(이 시점엔 텍스트 로그 — JSON 은 Task 6 후), 메모리 LIMIT 반영, `api health=200`(기존 서비스 무영향)

---

### Task 5: Caddy 서브도메인 + DNS + 브라우저 접속 (**사용자 컨펌 게이트 + 사용자 DNS 작업**)

**Files:** 없음 (서버 `/etc/caddy/Caddyfile` — repo 미형상관리 자산, §23 확인 완료)

**Interfaces:**
- Consumes: Task 4 의 Grafana `127.0.0.1:3200`
- Produces: `https://logs.soseolbi.com` 접속 경로 — Task 7 의 UI 작업 무대

- [ ] **Step 1: 서버 Caddyfile 의 api 블록 TLS 패턴 확인** (읽기 전용)

```bash
ssh oci 'sudo cat /etc/caddy/Caddyfile'
```

Expected: `api.soseolbi.com` 블록의 tls 지시자(Cloudflare Origin Certificate 경로) 확인 — logs 블록에 동일 패턴 적용. Origin Cert 가 `*.soseolbi.com` 커버인지 인증서 CN/SAN 확인(`openssl x509 -in <경로> -noout -text` 서버에서), 미커버 시 사용자에게 Cloudflare 에서 서브도메인 포함 재발급 안내

- [ ] **Step 2: 사용자 컨펌** — "Caddyfile 에 logs.soseolbi.com 블록을 추가하고 reload 합니다(기존 블록 무변경, validate 통과 시에만 reload, 실패 시 원복). 진행할까요?"

- [ ] **Step 3: Caddyfile 백업 + logs 블록 추가 + validate + reload**

```bash
ssh oci 'sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d%H%M) && sudo tee -a /etc/caddy/Caddyfile > /dev/null <<EOF

logs.soseolbi.com {
    tls <Step 1 에서 확인한 api 블록과 동일한 cert/key 경로>
    reverse_proxy localhost:3200
}
EOF
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy && echo "caddy reload OK"'
```

Expected: `caddy reload OK` (validate 실패 시 `.bak` 원복 후 재작성 — tls 줄은 Step 1 실측값으로 치환)

- [ ] **Step 4: 사용자 DNS 작업 안내** — Cloudflare 대시보드 → soseolbi.com → DNS → 레코드 추가:
  - Type `A`, Name `logs`, IPv4 = api.soseolbi.com 과 동일 IP (`dig +short api.soseolbi.com` 이 프록시 IP 를 주므로 실제 서버 IP 는 `ssh oci 'curl -s ifconfig.me'` 로 확인), Proxy status **ON** (api 와 동일)

- [ ] **Step 5: 접속 검증**

```bash
dig +short logs.soseolbi.com | head -2
curl -s -o /dev/null -w "grafana login page=%{http_code}\n" https://logs.soseolbi.com/login
```

Expected: dig 응답(Cloudflare 프록시 IP) + `grafana login page=200`. 이후 사용자 브라우저에서 admin/Task 4 비밀번호 로그인 확인

---

### Task 6: 백엔드 재배포 — JSON 로그 운영 반영 (**사용자 컨펌 게이트**)

**Files:** 없음 (Task 3 커밋분 배포)

**Interfaces:**
- Consumes: Task 3 의 application-prod.yml (develop 에 커밋·push 됨)
- Produces: 운영 백엔드 JSON 로그 — Task 7 의 `| json` 질의·알림 규칙 전제

- [ ] **Step 1: 베이스 정합 확인** (§18·§22)

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note && git fetch origin && git status -sb && git log --oneline HEAD..origin/develop
```

Expected: develop 이 origin 과 동기(뒤처짐 없음), 빈 출력

- [ ] **Step 2: 사용자 컨펌** — "백엔드를 blue-green 재배포합니다(JSON 로깅 1줄 변경분, 무중단, health 실패 시 자동 롤백). 진행할까요?"

- [ ] **Step 3: bootJar + 전송 + blue-green 배포** (절대경로 + exit 확인, §30)

```bash
(cd /Users/jongwan-air/Desktop/workspaces/write-note/backend && ./gradlew bootJar) && echo "jar exit=$?"
scp /Users/jongwan-air/Desktop/workspaces/write-note/backend/build/libs/backend-0.0.1-SNAPSHOT.jar oci:be-build/backend.jar && echo "scp exit=$?"
ssh oci 'sudo bash ~/be-build/blue-green-deploy.sh'
```

Expected: `jar exit=0` / `scp exit=0` / 스크립트 출력 `배포 완료: wn-be-...(:...) 활성`

- [ ] **Step 4: 운영 JSON 로그 + 새 컨테이너 자동 추적 검증**

```bash
ssh oci 'curl -sG http://localhost:3100/loki/api/v1/query_range --data-urlencode "query={app=\"backend\"} | json | level=~\".+\"" --data-urlencode "limit=2"' | python3 -c "import json,sys; rs=json.load(sys.stdin)['data']['result']; print('JSON 파싱 스트림:', len(rs)); print('컨테이너:', sorted({r['stream'].get('container') for r in rs}))"
curl -s -o /dev/null -w "api health=%{http_code}\n" https://api.soseolbi.com/actuator/health
```

Expected: `JSON 파싱 스트림: 1+` / 컨테이너 = 방금 전환된 wn-be-blue 또는 green (blue-green 전환을 Alloy 가 자동 추적했다는 증거) / `api health=200`

---

### Task 7: Grafana 대시보드 v1 + Discord 알림 (UI 작업, 사용자와 함께 — dogfooding 게이트)

**Files:** 없음 (Grafana DB 볼륨에 영속. 웹훅 URL 은 repo·대화 로그에 안 남기게 사용자가 UI 에 직접 입력)

**Interfaces:**
- Consumes: Task 5 의 `https://logs.soseolbi.com`, Task 6 의 JSON 로그
- Produces: 운영 대시보드 1개 + Discord ERROR 알림 규칙 1개 (스펙 §7)

- [ ] **Step 1: 사용자 Discord 웹훅 생성 안내** — Discord 앱에서: 알림 받을 서버(길드) 선택 → 채널 설정(⚙) → 연동 → 웹훅 → 새 웹훅 → 이름 `soseolbi-logs` → **웹훅 URL 복사** (URL 은 나에게 붙여넣지 말고 Step 2 에서 Grafana 화면에 직접 입력)

- [ ] **Step 2: Grafana contact point 구성 (사용자 UI)** — logs.soseolbi.com 로그인 → 좌측 메뉴 Alerting → Contact points → Add contact point: Name `discord`, Integration `Discord`, Webhook URL 붙여넣기 → **Test 버튼** → Save

Expected: Discord 채널에 테스트 메시지 수신

- [ ] **Step 3: 알림 규칙 생성 (사용자 UI, 값 그대로 입력)** — Alerting → Alert rules → New alert rule:
  - Rule name: `backend-error`
  - Query (Loki, Code 모드): `sum(count_over_time({app="backend"} | json | level="ERROR" [5m]))`
  - Condition: `IS ABOVE 0`
  - Folder/Evaluation group: `monitoring` 신규 / interval `1m`, pending period `0s` (즉시 발화)
  - Contact point: `discord` → Save

- [ ] **Step 4: 대시보드 v1 생성 (사용자 UI)** — Dashboards → New dashboard → 패널 3개 (질의는 Code 모드 입력):
  1. 레벨 분포 (Time series): `sum by (level) (count_over_time({app="backend"} | json [$__auto]))`
  2. 최근 ERROR (Logs): `{app="backend"} | json | level="ERROR"`
  3. 컨테이너별 로그량 (Time series): `sum by (container) (count_over_time({container=~".+"}[$__auto]))`
  - 저장 이름: `소설비 백엔드 로그`

- [ ] **Step 5: 최종 dogfooding 체크리스트 (전항 사용자 확인 — §25)**
  - [ ] `{app="backend"}` 실로그 조회 + `| json | level="ERROR"` 필터 동작
  - [ ] blue-green 새 컨테이너 자동 추적 (Task 6 Step 4 결과 재확인)
  - [ ] Discord 테스트 알림 수신 (Task 7 Step 2)
  - [ ] 대시보드 3 패널 렌더
  - [ ] 스택 재기동 영속: `ssh oci 'cd ~/monitoring && sudo docker compose restart'` 후 데이터소스·대시보드·알림 잔존
  - [ ] 서비스 무영향: api health 200 + 프론트 정상

- [ ] **Step 6: 계획 체크박스 갱신 커밋**

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note && git add docs/superpowers/plans/2026-07-02-logging-monitoring.md && git commit -m "docs(plan): 로그 모니터링 구현 완료 체크"
```

---

## 후속 (범위 밖 — 스펙 §10)

Caddy 접근 로그 수집 / 메트릭·트레이스 / uptime 외부 감시 / 로컬 dev 수집. 완료 후 finish-work(vault 02-PROGRESS 갱신)와 회고는 별도 트랙.
