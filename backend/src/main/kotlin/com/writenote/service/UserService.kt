package com.writenote.service

import com.writenote.components.UserAuthConverter
import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import com.writenote.model.response.AuthMeResponse
import com.writenote.nickname.ForbiddenWords
import com.writenote.nickname.NicknamePolicy
import com.writenote.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 사용자 계정 정보(닉네임 등) 유스케이스.
 */
@Service
class UserService(
    private val userRepository: UserRepository,
    private val userAuthConverter: UserAuthConverter,
) {
    /**
     * 닉네임 변경 — 형식(NicknamePolicy)·금칙어(ForbiddenWords)·중복(existsByNickname) 검증.
     *
     * 현재 닉네임과 동일한 값은 충돌로 보지 않고 수용한다(자기 자신 충돌 오인 방지).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun changeNickname(
        userId: Long,
        rawNickname: String,
    ): AuthMeResponse {
        val nickname = NicknamePolicy.normalize(rawNickname)
        if (!NicknamePolicy.isValidFormat(nickname)) {
            throw AuthException(AuthErrorCode.NICKNAME_INVALID_FORMAT)
        }
        if (ForbiddenWords.contains(nickname)) {
            throw AuthException(AuthErrorCode.NICKNAME_FORBIDDEN_WORD)
        }
        val user =
            userRepository.findById(userId).orElseThrow {
                AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
            }
        if (user.nickname != nickname) {
            if (userRepository.existsByNickname(nickname)) {
                throw AuthException(AuthErrorCode.NICKNAME_ALREADY_REGISTERED)
            }
            user.nickname = nickname
            userRepository.save(user)
        }
        return userAuthConverter.toAuthMeResponse(user)
    }
}
