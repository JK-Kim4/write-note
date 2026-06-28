# Contract — 보안 필터 델타 + 에러 코드

## SecurityConfig 변경 (R1)

`authorizeHttpRequests` 에 추가(기존 permitAll 블록과 동형):

```kotlin
// 공개 공유 열람 (046) — 비로그인 허용, optional auth(JwtAuthenticationFilter pass-through)
.requestMatchers(HttpMethod.GET, "/api/shared/**")
.permitAll()
.requestMatchers(HttpMethod.POST, "/api/shared/**")  // 댓글 작성 — 컨트롤러가 회원 검증(nullable principal)
.permitAll()
```

- `/api/shared/**` 만 permitAll. `/api/share-links/**`·`/api/share-comments/**`·`/api/projects/{id}/comments` 는 `anyRequest().authenticated()` 로 보호(기존 규칙).
- **검증**: 만료/무효 토큰은 공개 경로라도 `JwtAuthenticationFilter` 가 401(R-1 엣지). 비로그인(토큰 0)은 pass-through.
- CSRF: 기존 `CsrfDefenseFilter` 가 쿠키 변경요청에 `X-WriteNote-Client` 헤더 요구([[security-csrf-and-ip-throttle]]). 댓글 POST(회원, 쿠키 인증 시) 는 FE 가 그 헤더 동봉. Bearer 헤더 인증이면 무관.

## 신규 에러 코드 — ShareErrorCode (enum)

기존 `ErrorCode`/`AuthErrorCode` 패턴(code String + httpStatus + defaultMessage) 답습. `GlobalExceptionHandler` 가 Result.failure 로 변환.

| code | HTTP | 메시지(예) |
|---|---|---|
| SHARE_LINK_NOT_FOUND | 404 | 더 이상 볼 수 없는 링크입니다. (비활성·미존재 동형 — 대상 존재 비노출) |
| SHARE_TARGET_NOT_FOUND | 404 | 공유 대상을 찾을 수 없습니다. |
| SHARE_TARGET_INVALID | 400 | 공유 대상이 올바르지 않습니다. |
| SHARE_FORBIDDEN | 403 | 권한이 없습니다. |
| COMMENT_UNAUTHENTICATED | 401 | 로그인이 필요합니다. |
| COMMENT_NOT_FOUND | 404 | 댓글을 찾을 수 없습니다. |
| COMMENT_FORBIDDEN | 403 | 권한이 없습니다. |
| COMMENT_ANCHOR_INVALID | 400 | 댓글 위치가 올바르지 않습니다. |

- 비활성/미존재 링크는 **동일한 SHARE_LINK_NOT_FOUND(404)** 로 응답(FR-006 대상 존재 비노출).
- client.ts(FE) status 분기 시 `error.code` 기준(code-quality 룰 — 409/400/404 공유 코드 grep 의무).

## 가시성·인가 불변식 (서브에이전트 리뷰 체크포인트)
1. 공개 GET shared work → 타인 댓글 누설 0(요청자 본인 필터 WHERE author_id).
2. 공개 read → 비활성 링크 차단(스냅샷 미노출).
3. 스냅샷 복호 → owner 키만(요청자 키 아님), readOnly 트랜잭션 안전(decryptToPlain 비생성).
4. 댓글 삭제 → author 본인만. 작가 인박스 → project 소유자만.
5. 공유 토큰 → 추측불가 + 원문 저장이되 capability(노출 시 열람 = 의도된 설계).
