# Quickstart: 작품 본문 봉투 암호화 — 환경·배포·dogfooding

## 1. 환경변수 (신규)

| 변수 | 용도 | 필수 | 예시 |
|---|---|---|---|
| `BODY_ENCRYPTION_KEY` | 본문 마스터 키(KEK), Base64(32B) | **필수**(미설정 시 저장 실패) | `openssl rand -base64 32` |
| `DISCORD_ALERT_WEBHOOK_URL` | 복호 실패 알림 디스코드 웹훅 | 선택(미설정=알림 생략) | `https://discord.com/api/webhooks/...` |

application.yml 매핑(예정):
```yaml
app:
  crypto:
    master-key: ${BODY_ENCRYPTION_KEY:}
  alerts:
    discord-webhook-url: ${DISCORD_ALERT_WEBHOOK_URL:}
```
로컬 dev: 프로파일(application-local.yml)에 **dev 전용 고정 키**(비밀 아님) 제공. 테스트: 테스트 설정의 고정 키.

## 2. ⚠️ KEK 운영 수칙 (HARD — 데이터 손실 직결)

- **KEK 분실/변경 = 그 키로 암호화된 모든 본문 영구 복호 불가**(데이터 손실). `BODY_ENCRYPTION_KEY` 는 **안정적으로 유지**하고 **DB 백업과 분리된 곳에 별도 백업**한다(둘이 함께 유출되면 보호 무력화 — spec Assumptions).
- 키 교체가 필요하면 KEK 회전(후속 범위) 흐름으로만. 임의 교체 금지.

## 3. 배포 (BE 단독 — FE 무관)

순서 의존: 본 기능은 **백엔드 단독**(API 계약·프론트 불변). FE 선행/후행 불필요.

배포 전 체크리스트(HARD-GATE):
1. `git fetch origin develop && git log --oneline HEAD..origin/develop` — 베이스 정합(§18).
2. OCI 인스턴스에 `BODY_ENCRYPTION_KEY` 설정 확인(**미설정 시 모든 본문 저장 500**). 선택 `DISCORD_ALERT_WEBHOOK_URL`.
3. V22 마이그레이션 포함 빌드. Flyway 자동 적용(운영 DB 적용은 사용자 컨펌 — external-infra-safety).
4. BE Docker blue-green 무중단 배포(메모리 [[deployment-live]] 절차).

배포 직후: 기존(평문) 작품 로드 정상 + 신규 저장분이 DB에서 암호문인지 운영 DB 읽기 조회([[oci-db-readonly-access]])로 확인.

## 4. Dogfooding 게이트 (R2 첫 통과 + R4 종합)

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | 집필실에서 본문 작성 → 자동저장 | 저장 성공, 글자수 정상 |
| 2 | 운영/로컬 DB `documents.body` 직접 조회 | 작성 원문 안 보임(봉투 JSON) |
| 3 | 같은 작품 재진입(로드) | 원문 손실 0 표시 |
| 4 | 작품 목록(작품 카드) | "마지막 문장" 미리보기 정상(복호) |
| 5 | 저장 충돌(버전 불일치) 유발 | 기존 409 동작 + currentBody 평문 |
| 6 | 배포 전 평문 작품 열기 | 레거시 정상 로드 → 저장 시 암호문 전환 |
| 7 | 빈 본문 / 매우 긴 본문 왕복 | 손실 0 |
| 8 | (선택) 복호 실패 유발(변조 행) | 500 + 디스코드 알림, 평문 미노출 |

> 한글 본문 1문단 이상 포함(한국어 영역 검증 cadence). 인증 뒤 화면이라 운영 검증은 §19 한계 인지.

## 5. 검증 명령

```bash
cd backend
./gradlew test                                   # 단위+IT(Testcontainers)
./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build  # 전체 게이트
```

- 핵심 IT: 저장→`documents.body` 가 원문 부분문자열 미포함 → 로드 평문 일치 / 충돌 currentBody 평문 / 레거시 평문 로드 / listCards 암호문 복호.
- 성능: 대표 본문 encrypt+decrypt 왕복 < 5ms 단일 측정(운영 p95 는 관찰).
