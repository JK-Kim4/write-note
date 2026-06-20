#!/usr/bin/env bash
# 소설비 백엔드 blue-green 무중단 배포 (OCI Compute, Docker).
#
# 전제: cutover 완료 후 — 두 컨테이너(wn-be-blue:8080 / wn-be-green:8081)를 Caddy upstream 전환으로 교대.
# 사용:
#   1) 로컬: cd backend && ./gradlew bootJar
#   2) 로컬: scp build/libs/backend-0.0.1-SNAPSHOT.jar oci:/tmp/be-build/backend.jar
#   3) OCI : sudo bash /opt/write-note/blue-green-deploy.sh
#
# 동작: Caddy 가 가리키는 활성 포트의 반대편에 새 이미지를 기동 → health 통과 시 Caddy 전환(reload) → 구 컨테이너 중지.
#       health 실패 시 신규 컨테이너만 제거하고 Caddy 무변경(=무중단 롤백).
set -euo pipefail

BUILD_DIR=/tmp/be-build          # backend.jar + Dockerfile 위치 (jar 는 배포 전 scp)
ENV_FILE=/etc/write-note/backend.env
CADDYFILE=/etc/caddy/Caddyfile
IMG=write-note-backend:latest
HEALTH_WAIT=60                   # health 최대 대기(초)

# Dockerfile 이 build dir 에 없으면 repo 것 복사 필요 — 여기선 이미 있다고 가정
[ -f "$BUILD_DIR/backend.jar" ] || { echo "ERROR: $BUILD_DIR/backend.jar 없음 (jar 를 먼저 scp)"; exit 1; }
[ -f "$BUILD_DIR/Dockerfile" ]  || { echo "ERROR: $BUILD_DIR/Dockerfile 없음"; exit 1; }

# 현재 Caddy 활성 포트 → 신규/구 결정
ACTIVE_PORT=$(grep -oP 'reverse_proxy localhost:\K[0-9]+' "$CADDYFILE" | head -1)
if [ "$ACTIVE_PORT" = "8080" ]; then
  NEW_PORT=8081; NEW_NAME=wn-be-green; OLD_NAME=wn-be-blue
else
  NEW_PORT=8080; NEW_NAME=wn-be-blue;  OLD_NAME=wn-be-green
fi
echo "[blue-green] 활성=$ACTIVE_PORT → 신규=$NEW_PORT ($NEW_NAME), 구=$OLD_NAME"

# 이미지 빌드
docker build -t "$IMG" "$BUILD_DIR"

# 신규 포트에 새 컨테이너 기동
docker rm -f "$NEW_NAME" 2>/dev/null || true
docker run -d --name "$NEW_NAME" --restart unless-stopped \
  --network host -e SERVER_PORT="$NEW_PORT" --env-file "$ENV_FILE" "$IMG"

# health 대기
ok=0
for ((i=1; i<=HEALTH_WAIT/2; i++)); do
  if curl -sf "http://localhost:$NEW_PORT/actuator/health" >/dev/null 2>&1; then ok=1; echo "[blue-green] $NEW_NAME health OK (~$((i*2))s)"; break; fi
  sleep 2
done
if [ "$ok" != "1" ]; then
  echo "[blue-green] ERROR: $NEW_NAME health 실패 → 롤백(신규 제거, Caddy 무변경)"
  docker logs --tail 30 "$NEW_NAME" || true
  docker rm -f "$NEW_NAME"
  exit 1
fi

# Caddy upstream 전환 (api.soseolbi.com + api.harubuild.xyz 두 블록 모두)
sed -i "s/reverse_proxy localhost:$ACTIVE_PORT/reverse_proxy localhost:$NEW_PORT/g" "$CADDYFILE"
caddy validate --config "$CADDYFILE"
systemctl reload caddy
echo "[blue-green] Caddy → localhost:$NEW_PORT 전환·reload 완료"

# 구 컨테이너 중지 (롤백 대비 rm 안 함 — 다음 배포 시 동일 이름 재사용으로 교체)
docker stop "$OLD_NAME" 2>/dev/null || true
echo "[blue-green] 배포 완료: $NEW_NAME(:$NEW_PORT) 활성 / $OLD_NAME 중지"
