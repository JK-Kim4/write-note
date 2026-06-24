# Phase 0 Research: 사용자 닉네임 + 마이페이지

본 기능은 brainstorming 단계에서 코드베이스 조사·WebSearch 검증으로 대부분의 unknown 이 해소되었다. 아래는 확정된 결정과 근거 기록.

## D1. 닉네임 생성 방식 — 직접 큐레이션 단어사전 (외부 의존성 0)

**Decision**: 외부 라이브러리 없이 백엔드에 큐레이션된 한글 수식어·명사 상수 사전을 두고 `수식어+명사+4자리숫자` 로 조합. 충돌 시 숫자 재추첨.

**Rationale**:
- JVM(Kotlin/Spring)에서 쓸 만한 한글 닉네임 생성 라이브러리가 사실상 없음(WebSearch 검증).
- `ko-nickname`(warmwhiten)은 이름은 맞지만 **NPM(JavaScript) 전용**이라 백엔드 사용 불가 + 스타 0·고유성 미보장.
- `datafaker`/`kotlin-faker`는 locale 지원하나 이름·주소 위주이고 닉네임(수식어+명사)은 영문 `funnyName`류 → 한글 요구 부적합.
- 직접 사전: 작가용 서비스 톤에 맞는 어휘 큐레이션 가능 + 비속어 배제 통제 + 고유성 로직 직접 제어 + 의존성 0.

**Alternatives considered**: ko-nickname(JS 전용 탈락), datafaker(한글 닉네임 부적합), `사용자<id>` 결정값(랜덤 요구와 어긋나 신규엔 부적합 — 기존 회원 백필에만 채택).

**조합 공간**: 수식어 약 50 × 명사 약 50 × 숫자 9000 ≈ 2,250만 → 충돌 실질적으로 드뭄. 충돌 시 숫자 재추첨 N회(예: 10회), 그래도 실패 시 숫자 자릿수 확장으로 고유성 보장.

## D2. 기존 회원 백필 — `사용자<id>` SQL 단순값

**Decision**: V23 마이그레이션에서 `UPDATE users SET nickname = '사용자' || id` 로 백필.

**Rationale**:
- `id`(BIGSERIAL, unique)를 접미로 쓰므로 백필 시점 상호 충돌 0(고유성 자동 보장).
- 마이그레이션 SQL 에는 한글 단어사전이 없어 예쁜 랜덤 조합 불가 → 결정적 단순값이 가장 안전·단순.
- 기존 회원은 마이페이지에서 직접 변경 가능하므로 초기값이 단순해도 수용 가능(사용자 확정).

**Alternatives considered**: 앱 레이어 일회성 백필(한글 조합) — 마이그레이션 후 별도 백필 코드·NOT NULL 타이밍 복잡 → 기각.

## D3. 마이그레이션 제약 적용 순서 (운영 안전)

**Decision**: 단일 마이그레이션 V23 에서 3단계 — (1) `nickname` nullable 컬럼 추가 → (2) 기존 행 백필 → (3) `NOT NULL` + `UNIQUE` 제약 추가.

**Rationale**: NOT NULL/UNIQUE 를 빈 컬럼에 즉시 걸면 기존 행 위반. nullable 추가 후 백필로 전 행을 채운 뒤 제약을 거는 것이 표준 안전 순서. Flyway 가 순서대로 단일 트랜잭션 적용.

**컬럼 타입**: `VARCHAR(16)` — 닉네임 최대 16자와 일치(Postgres VARCHAR(n)은 문자 수 기준). 백필값 `사용자`+id 는 16자 이내(현실적 id 자릿수).

## D4. 에러 처리 — 기존 AuthErrorCode/AuthException/Result 재사용

**Decision**: 신규 enum 미생성. `AuthErrorCode` 에 3개 추가:
- `NICKNAME_INVALID_FORMAT`(400) — 길이·허용문자 위반
- `NICKNAME_ALREADY_REGISTERED`(409) — 중복
- `NICKNAME_FORBIDDEN_WORD`(400) — 금칙어 포함

`throw AuthException(AuthErrorCode.X)` → `GlobalExceptionHandler` → `Result{success,data,error{code,message}}` envelope.

**Rationale**: 프로젝트의 유일한 ErrorCode enum 이 AuthErrorCode 이고 닉네임은 user/auth 인접 도메인. 신규 enum 신설은 단순성 위반. 중복(409)은 ValidationException(400)으로 표현 불가하므로 AuthErrorCode 통일이 일관적.

**Alternatives considered**: ValidationException(형식·금칙어) + 별도 중복 예외 혼용 → 코드 분기 일관성 저하로 기각. 도메인별 신규 UserErrorCode enum → 단일 enum 관례와 어긋나 기각.

## D5. 닉네임 형식 검증 — @Size + 서비스 정규식

**Decision**: 요청 DTO `SetNicknameRequest` 에 `@field:NotBlank @field:Size(min=2,max=16)`, 허용문자 정규식 `^[가-힣a-zA-Z0-9_]{2,16}$` 은 서비스(NicknamePolicy)에서 검증.

**Rationale**: 프로젝트 전체가 `@Pattern` 미사용, 형식 검증은 서비스 로직 관례(Explore 확인). trim(앞뒤 공백 제거) 후 검증. 위반 시 `NICKNAME_INVALID_FORMAT`.

## D6. 직접 입력 금칙어 필터 (사용자 확정 = B)

**Decision**: 사용자가 직접 변경하는 닉네임은 `ForbiddenWords` 사전 포함 검사. 정규화(소문자·공백제거) 후 핵심 금칙어 포함 시 `NICKNAME_FORBIDDEN_WORD`(400).

**Rationale**: 닉네임이 추후 공유/첨삭에서 타인에게 노출되므로 부적절 닉네임 사전 차단 필요(사용자 강조). 자동 생성용 안전 사전과 **목적이 반대인 별도 차단 사전**.

**범위 한정**: 완벽한 우회 방지(변형 표기·자모 분리·유사 문자)는 v1 범위 밖. 핵심 금칙어 차단을 목표(spec Assumptions).

## D7. me() 응답 확장 — nickname·createdAt 추가

**Decision**: `AuthMeResponse` 에 `nickname: String`, `createdAt: Instant?` 추가. `UserAuthConverter.toAuthMeResponse` 에서 `user.nickname`, `user.createdAt` 매핑. 가입방식은 기존 `email` + `kakaoLinked` 로 표현(별도 필드 불필요).

**Rationale**: 마이페이지가 기존 `fetchMe()`/`["auth","me"]` 쿼리를 재사용해 닉네임·가입일을 함께 얻음(신규 조회 endpoint 불필요). `createdAt` 은 AuditingEntityListener 로 채워진 접근 가능 필드(Explore 확인). 닉네임 변경 성공 시 동일 쿼리 invalidate 로 갱신.

**Alternatives considered**: 마이페이지 전용 신규 조회 endpoint → 기존 me() 재사용으로 회피(단순성).

## D8. 배포 순서 — BE 선행 → FE 후행 (방향 의존)

**Decision**: R1 BE(컬럼·생성·응답 확장) 배포 → R2 FE(마이페이지·표시) 배포.

**Rationale**: FE 가 `nickname` 을 응답에서 기대(표시)하므로, BE 가 먼저 내려주지 않으면 구 BE 응답에 필드 부재. CLAUDE.md "BE 선행→FE 후행: BE 가 새 계약을 받아들이게 한 뒤 FE 가 그걸 보낼/읽을 때" 패턴.
