# 로그 모니터링 (Loki+Alloy+Grafana) — 세션 재개 핸드오프

- 작성: 2026-07-03 00:30 (세션 중단 시점)
- 계획 SoT: `docs/superpowers/plans/2026-07-02-logging-monitoring.md` / 설계 SoT: `docs/superpowers/specs/2026-07-02-logging-monitoring-design.md`
- 학습 문서: `docs/research/2026-07-02-loki-grafana-learning-guide.html`

## 완료 (Task 1~6 전부 + Task 7 일부)

- **Task 1~3**: `infra/monitoring/` 구성 커밋 + 로컬 선검증 GREEN + 백엔드 prod logstash JSON 커밋(게이트 669 GREEN). develop push 완료(`77a5b96` 까지).
- **Task 4**: 운영 스택 3컨테이너 가동(`~/monitoring/`, 자원상한 적용). Grafana admin 비밀번호 = 서버 `~/monitoring/monitoring.env` + 사용자 비밀번호 관리자(크롬 저장 안내함).
- **Task 5**: Caddy `logs.soseolbi.com` 블록 + Cloudflare DNS(A `logs`, 프록시 ON) — https://logs.soseolbi.com 200 개통. Caddyfile 백업 = `/etc/caddy/Caddyfile.bak.*`.
- **Task 6**: blue-green 재배포(`wn-be-blue`:8080 활성) — JSON 로그 Loki 유입 + `| json` 파싱 + 새 컨테이너 자동 추적 + health 200 실측.
- **Task 7 일부**: 대시보드 3패널 사용자 제작(레벨 분포 / 최근 ERROR / 컨테이너별 로그량) — **Save 여부 재확인 필요**(중단 직전 Save 안내만 한 상태).

## 잔여 (Task 7 나머지 — 재개 지점)

1. **대시보드 저장 확인** — 안 됐으면 3패널 재작성 필요(질의는 계획 Task 7 Step 4).
2. **Discord 웹훅 생성**(사용자, Discord 채널 설정→연동→웹후크) → Grafana Contact point `discord` + **Test 수신 확인**.
3. **알림 규칙** `backend-error`: `sum(count_over_time({app="backend"} | json | level="ERROR" [5m]))` IS ABOVE 0, folder/group `monitoring`, interval 1m, pending 0s, contact point discord.
4. **재기동 영속 확인**(컨펌 후): `ssh oci 'cd ~/monitoring && sudo docker compose restart'` → 대시보드·알림·데이터소스 잔존.
5. **최종 체크리스트 전항 대조**(계획 Task 7 Step 5) → 계획 체크박스 갱신 커밋 → finish-work(vault 갱신)·회고는 별도 제안.

## 세션에서 확정된 사실 (재개 시 알아둘 것)

- **런타임 이슈 2건 규명**(둘 다 해소/자연소멸): (1) 스택 첫 기동 catch-up 배치 폐기로 설치 이전 과거 로그만 Loki 부재 — 1회성, `docker logs` 엔 잔존. (2) JSON 전환 이전 텍스트 로그에 `| json` 시 JSONParserErr — `| __error__=""` 필터(레벨 분포 패널에 적용됨), 보존 14d 후 소멸.
- **gh CLI 활성 계정 JK-Kim4 로 전환됨**(push 403 해소) — 사용자 회사 작업 시 `gh auth switch --user zimssa-jwkim` 필요할 수 있음.
- 로컬 실습 환경 `~/loki-playground` 는 정리됨(down -v). 로컬 재검증은 `infra/monitoring/` 에서 직접(README 참조).
- 첫 게이트 1회 RED 는 일회성(직전 timeout bootRun 잔여 추정) — fresh `--rerun-tasks` 669 GREEN 으로 확정.
