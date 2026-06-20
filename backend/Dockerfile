# 소설비 백엔드 런타임 이미지 — blue-green 무중단 배포용 (jar-COPY 방식).
#
# 빌드 입력: 로컬 `./gradlew bootJar` 산출물을 빌드 컨텍스트에 `backend.jar` 로 둔 뒤 `docker build`.
# 실행: host network 모드 + `--env-file /etc/write-note/backend.env`, 포트는 SERVER_PORT env(blue=8080 / green=8081).
# DB 는 host 의 postgres(localhost:5432) 를 host network 로 그대로 접속(backend.env 무변경).
FROM eclipse-temurin:24-jre
WORKDIR /app
COPY backend.jar app.jar
ENTRYPOINT ["java", "-Xmx1500m", "-jar", "app.jar"]
