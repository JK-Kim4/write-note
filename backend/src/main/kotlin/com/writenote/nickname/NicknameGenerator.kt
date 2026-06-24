package com.writenote.nickname

import com.writenote.repository.UserRepository
import org.springframework.stereotype.Component
import java.util.UUID
import kotlin.random.Random

/**
 * 가입 시 자동 부여할 닉네임 생성기.
 *
 * `수식어 + 명사 + 4자리 숫자`([NicknameWords]) 조합. 고유성 충돌 시 숫자를 재추첨하고,
 * 그래도 실패하면 자릿수를 확장해 고유성을 보장한다(FR-012). 최후 fallback 은 UUID 기반.
 */
@Component
class NicknameGenerator(
    private val userRepository: UserRepository,
) {
    /** 미사용 고유 닉네임을 생성해 반환한다. */
    fun generate(): String {
        repeat(MAX_ATTEMPTS) {
            val candidate = randomBase() + Random.nextInt(1000, 10000)
            if (!userRepository.existsByNickname(candidate)) return candidate
        }
        repeat(MAX_ATTEMPTS) {
            val candidate = randomBase() + Random.nextInt(100000, 1000000)
            if (!userRepository.existsByNickname(candidate)) return candidate
        }
        return "user_" +
            UUID
                .randomUUID()
                .toString()
                .replace("-", "")
                .take(10)
    }

    private fun randomBase(): String = NicknameWords.MODIFIERS.random() + NicknameWords.NOUNS.random()

    companion object {
        private const val MAX_ATTEMPTS = 10
    }
}
