package com.writenote.auth

import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import io.jsonwebtoken.ExpiredJwtException
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import java.time.Instant
import java.util.Date
import javax.crypto.SecretKey

/**
 * JWT access token 발급 및 파싱 컴포넌트.
 *
 * 빈 등록은 [com.writenote.config.JwtConfig] 가 담당 (`@Bean` 직접 등록).
 * `@Component` 없음 — 시크릿 검증 후 생성자 주입으로만 인스턴스화.
 *
 * 출처: research.md R-1, contracts/token-formats.md §1.
 */
class JwtTokenProvider(
    keyBytes: ByteArray,
    private val accessTokenValiditySeconds: Long,
) {
    private val key: SecretKey = Keys.hmacShaKeyFor(keyBytes)

    /**
     * Access token 발급.
     *
     * @param userId 사용자 ID (`sub` claim — JWT 표준 string)
     * @param email 사용자 이메일 (`email` claim)
     * @param now 발급 기준 시각 (기본값 현재 시각 — 테스트에서 고정 시각 주입 가능)
     */
    fun createAccessToken(
        userId: Long,
        email: String,
        now: Instant = Instant.now(),
    ): String =
        Jwts
            .builder()
            .subject(userId.toString())
            .claim("email", email)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(accessTokenValiditySeconds)))
            .signWith(key, Jwts.SIG.HS256)
            .compact()

    /**
     * Access token 파싱 및 검증.
     *
     * - 서명 검증 실패 / 형식 오류 → [AuthException] (`AUTH_TOKEN_INVALID`)
     * - 만료 (`exp` < now) → [AuthException] (`AUTH_TOKEN_EXPIRED`)
     *
     * @param token Bearer 헤더에서 추출한 JWT 문자열
     * @return [AuthenticatedPrincipal] (`userId`, `email`)
     */
    fun parseAccessToken(token: String): AuthenticatedPrincipal {
        try {
            val claims =
                Jwts
                    .parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .payload
            val userId =
                claims.subject?.toLongOrNull()
                    ?: throw AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
            val email =
                claims["email", String::class.java]
                    ?: throw AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
            return AuthenticatedPrincipal(userId = userId, email = email)
        } catch (ex: ExpiredJwtException) {
            throw AuthException(AuthErrorCode.AUTH_TOKEN_EXPIRED)
        } catch (ex: JwtException) {
            throw AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
        } catch (ex: IllegalArgumentException) {
            throw AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
        }
    }
}
