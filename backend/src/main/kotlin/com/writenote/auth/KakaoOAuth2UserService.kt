package com.writenote.auth

import com.writenote.components.KakaoConflictChecker
import com.writenote.components.KakaoLoginDecision
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.user.DefaultOAuth2User
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.stereotype.Component
import java.time.Instant

/**
 * Kakao OAuth2 사용자 정보 처리 컴포넌트.
 *
 * Spring OAuth2 Login filter 가 카카오 token 교환 후 본 서비스를 호출.
 * [KakaoConflictChecker] 의 3 분기 결과에 따라 User INSERT / 조회만 / 충돌 예외 throw.
 *
 * 외부 카카오 API 호출 ([DefaultOAuth2UserService.loadUser]) 은 트랜잭션 밖에서 수행
 * (FR-035, research.md R-3). 본 클래스는 무트랜잭션 — DB 갱신은 [UserRepository.save] 단발성.
 */
@Component
class KakaoOAuth2UserService(
    private val userRepository: UserRepository,
    private val conflictChecker: KakaoConflictChecker,
    private val delegate: DefaultOAuth2UserService = DefaultOAuth2UserService(),
) : OAuth2UserService<OAuth2UserRequest, OAuth2User> {
    override fun loadUser(request: OAuth2UserRequest): OAuth2User {
        val raw = delegate.loadUser(request)
        val kakaoId = raw.attributes["id"].toString()

        @Suppress("UNCHECKED_CAST")
        val kakaoAccount = raw.attributes["kakao_account"] as Map<String, Any>
        val email = kakaoAccount["email"] as String

        val user =
            when (val decision = conflictChecker.evaluateForLogin(kakaoId, email)) {
                is KakaoLoginDecision.NewKakaoUser -> insertNewKakaoUser(decision)
                is KakaoLoginDecision.ExistingKakaoUser -> touchLastLogin(decision.user)
                KakaoLoginDecision.EmailConflictNotLinked ->
                    throw OAuth2AuthenticationException(
                        OAuth2Error(KAKAO_EMAIL_ALREADY_REGISTERED),
                    )
            }

        return DefaultOAuth2User(
            listOf(SimpleGrantedAuthority("ROLE_USER")),
            raw.attributes + ("userId" to user.id!!),
            "id",
        )
    }

    private fun insertNewKakaoUser(decision: KakaoLoginDecision.NewKakaoUser): User {
        val now = Instant.now()
        val user =
            User(
                email = decision.email,
                kakaoId = decision.kakaoId,
                passwordHash = null,
                emailVerifiedAt = now,
                lastLoginAt = now,
            )
        return userRepository.save(user)
    }

    private fun touchLastLogin(user: User): User {
        user.lastLoginAt = Instant.now()
        return userRepository.save(user)
    }

    companion object {
        private const val KAKAO_EMAIL_ALREADY_REGISTERED = "KAKAO_EMAIL_ALREADY_REGISTERED"
    }
}
