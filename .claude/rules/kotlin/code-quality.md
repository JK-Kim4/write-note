# Kotlin 코드 퀄리티

본 프로젝트 백엔드 (Kotlin 2.2 + Spring Boot 4.0.6 on Java 24 toolchain) 룰. 출처: Kotlin 공식 conventions + Android Kotlin Style + ktlint.

## 네이밍

| 대상 | 컨벤션 |
|---|---|
| 패키지 | lowercase, 언더스코어 X |
| 클래스 / 인터페이스 / 객체 | UpperCamelCase |
| 함수 / 프로퍼티 / 변수 | lowerCamelCase |
| 상수 (top-level `const val`) | SCREAMING_SNAKE_CASE |
| Backing property | `_` prefix (`_memos`) |
| 테스트 메서드 | backtick + 한국어 / 공백 허용 |

- 약어 2글자 둘 다 대문자 (`IOStream`), 3+ 첫 글자만 (`XmlParser`)
- 무의미한 이름 금지 — `Manager`, `Util`, `Helper` 단독 X

## 불변성 / Null

- `val` 기본, `var` 는 재할당 필요 시만. 컬렉션도 불변형 (`listOf`, `setOf`)
- Public API 반환 / 프로퍼티는 nullable 명시 (`String?` vs `String`)
- 플랫폼 타입 (Java interop) 은 Kotlin 타입 명시 — 추론 의존 금지
- `!!` 사용 시 사유 주석 필수

## 함수 / 분기

- 단일 표현식은 expression body: `fun double(x: Int) = x * 2`
- Default 파라미터 > 오버로드, 동일 타입 / Boolean 다중 파라미터는 named arguments 의무
- 파라미터 6개 초과 → DTO / data class 래핑
- 분기 2개 `if`, 3개+ `when`. `for` > `forEach` (체이닝 / nullable receiver 예외)
- Range open-ended: `0..<n`

## 람다 / 스코프 함수

- 짧고 비중첩이면 `it`, 중첩 / 의미 다르면 명시 이름. 라벨 return 남용 금지
- `let` (null+변환) / `apply` (초기화) / `also` (부작용) / `run` (블록+결과) / `with` (리시버)

## 클래스 설계

- 선언 순서: 프로퍼티+init → secondary constructor → 메서드 → companion
- Modifier 순서는 ktlint 자동 정렬 (visibility → modality → override → suspend → …)
- 인터페이스 구현 멤버는 인터페이스 선언 순서대로. 오버로드 인접 배치
- 팩토리 함수 > 복잡한 오버로드 생성자

## Annotation 인자

### 배열 인자 (`KClass[]`) 일관성

Kotlin annotation 의 배열 인자 (`@Transactional(rollbackFor = ...)`, `@Scheduled`, `@ConditionalOnProperty(name = ...)`, `@SpringBootTest(classes = ...)` 등) 박을 때:

- Kotlin 문법 = `[X::class]` 형식. 단일 값이라도 배열 brackets 의무 (`rollbackFor = Exception::class` 는 컴파일 fail — `Argument type mismatch: actual type is 'KClass<Exception>', but 'Array<KClass<out Throwable>>' was expected`)
- 새 클래스 작성 전 기존 service grep 1회 의무 — `grep -rn "rollbackFor\|@Scheduled" backend/src/main/kotlin/` 으로 패턴 정합

```kotlin
// 잘못된 예 — Kotlin 컴파일 fail
@Transactional(rollbackFor = Exception::class)

// 올바른 예
@Transactional(rollbackFor = [Exception::class])
```

회피 가능 시점: 신규 service 작성 시 ktlint 또는 build 진입 전 grep 1회.

회귀 사례 (2026-05-24): TokenCleanupService (Phase 9 R1) 컴파일 fail. 5 service (AuthService / LoginAttemptService / PasswordResetService / AccountLinkService 등) 가 모두 `[Exception::class]` 박혔는데 신규 service 가 단일 값 시도 → fail → grep 후 fix.

## 문자열 / 파일

- 템플릿 `"$name"` > concatenation, 멀티라인은 `"""...""".trimIndent()`
- 파일명: 단일 클래스 = 클래스명, 다중 선언 = 의미 있는 UpperCamelCase. 300줄 이하 (글로벌 룰)

## 문서화 / 임시 코드

- 모든 public 멤버 KDoc (단순 override 면제). `@param` 보다 본문 inline + `[paramName]` 링크
- 임시/stub: KDoc *"임시 — {언제} swap"* + `TODO(이슈번호)`

## 도구 / 검증

- ktlint (`ktlint_official` style) + Checkstyle (line 120, no wildcard import)
- `./gradlew ktlintCheck ktlintFormat checkstyleMain`

## 테스트 (글로벌 `testing-strategy.md`)

- JUnit 5 + AssertJ + MockK (단위), Spring Boot Test + Testcontainers (통합)
- `@DisplayName` 한국어 / backtick 함수명
- `any()` matcher 금지 — 식별자 / 코드 / payload 는 `eq()` / `match { }` 정확값
- JPA 엔티티는 mock 또는 팩토리 — protected 생성자 직접 호출 X

## Spring Boot 정합 (글로벌 `spring-patterns.md`)

- 생성자 주입만 — 필드 `@Autowired` 금지
- `@Transactional`: 쓰기 `rollbackFor = Exception::class`, 읽기 `readOnly = true`
- `publishEvent(...)` 호출 메서드는 `@Transactional` 의무 (AFTER_COMMIT 보장). 외부 API 호출은 트랜잭션 밖
- Controller → Service → Component → Repository, 역방향 / 순환 금지

## 출처

- [Kotlin 공식 Coding Conventions](https://kotlinlang.org/docs/coding-conventions.html) / [Android Kotlin Style](https://developer.android.com/kotlin/style-guide) / [ktlint](https://pinterest.github.io/ktlint/)
- 글로벌 룰 `~/.claude/rules/java/`
