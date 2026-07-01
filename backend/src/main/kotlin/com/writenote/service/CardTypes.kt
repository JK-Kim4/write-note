package com.writenote.service

import com.writenote.error.ValidationException

/**
 * 카드 역할 종류(트랙 D, 048 공유) — 4종(character/place/event/theme). null=무지정.
 *
 * 보드 카드([BoardService])와 카드 관리·독립 카드([CardService])가 공유하는 종류 검증(매퍼 중복 회피).
 */
object CardTypes {
    val ALLOWED = setOf("character", "place", "event", "theme")

    /** null=무지정(그대로 null), 값은 4종 검증 — 아니면 [ValidationException]. */
    fun normalize(value: String?): String? {
        if (value == null) return null
        if (value !in ALLOWED) {
            throw ValidationException("지원하지 않는 카드 타입입니다: $value")
        }
        return value
    }
}
