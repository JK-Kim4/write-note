package com.writenote.error

import org.springframework.http.HttpStatus

/**
 * 공유하기(046) 에러 코드. 기존 [com.writenote.enums.AuthErrorCode] 패턴(httpStatus + defaultMessage) 답습.
 *
 * 비활성/미존재 링크는 동일한 [SHARE_LINK_NOT_FOUND](404)로 응답한다 — 대상 존재 비노출(FR-006).
 */
enum class ShareErrorCode(
    val httpStatus: HttpStatus,
    val defaultMessage: String,
) {
    SHARE_LINK_NOT_FOUND(HttpStatus.NOT_FOUND, "더 이상 볼 수 없는 링크입니다."),
    SHARE_TARGET_NOT_FOUND(HttpStatus.NOT_FOUND, "공유 대상을 찾을 수 없습니다."),
    SHARE_TARGET_INVALID(HttpStatus.BAD_REQUEST, "공유 대상이 올바르지 않습니다."),
    SHARE_FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    SHARE_LINK_LIMIT_EXCEEDED(HttpStatus.CONFLICT, "공유 링크는 작품·시리즈당 5개까지 만들 수 있어요. 기존 링크를 삭제하고 다시 시도해 주세요."),

    // 위치 지정 댓글(046 R2)
    COMMENT_UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "댓글을 달려면 로그인이 필요합니다."),
    COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."),
    COMMENT_FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    COMMENT_ANCHOR_INVALID(HttpStatus.BAD_REQUEST, "댓글 위치가 올바르지 않습니다."),

    // 이모지 반응(050 US3)
    REACTION_EMOJI_INVALID(HttpStatus.BAD_REQUEST, "지원하지 않는 이모지입니다."),
    ;

    companion object {
        /** 반응 이모지 화이트리스트(050 US3) — 서버가 강제, 그 외 값은 [REACTION_EMOJI_INVALID]. */
        val ALLOWED_EMOJIS = setOf("❤️", "👍", "😮", "😢", "🔥")
    }
}
