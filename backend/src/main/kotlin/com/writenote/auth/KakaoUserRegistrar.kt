package com.writenote.auth

import com.writenote.crypto.UserKeyService
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 카카오 신규 가입 시 User INSERT + DEK 생성을 동일 트랜잭션으로 묶는 컴포넌트.
 *
 * [KakaoOAuth2UserService.loadUser] 는 외부 카카오 API 호출을 포함하므로
 * 거기에 직접 `@Transactional` 을 두면 안 된다(외부 호출 = 트랜잭션 밖 원칙).
 * 두 DB 쓰기만 별도 public 메서드로 추출하여 프록시 트랜잭션 적용.
 */
@Component
class KakaoUserRegistrar(
    private val userRepository: UserRepository,
    private val userKeyService: UserKeyService,
) {
    /**
     * User INSERT + DEK 생성을 동일 트랜잭션에서 실행.
     * DEK 생성 실패 시 User INSERT 도 롤백된다(research.md D5 "동일 트랜잭션, 실패 시 가입 롤백" 계약).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun registerAndCreateKey(
        email: String,
        kakaoId: String,
    ): User {
        val now = Instant.now()
        val user =
            User(
                email = email,
                kakaoId = kakaoId,
                passwordHash = null,
                emailVerifiedAt = now,
                lastLoginAt = now,
            )
        val saved = userRepository.save(user)
        userKeyService.create(requireNotNull(saved.id))
        return saved
    }
}
