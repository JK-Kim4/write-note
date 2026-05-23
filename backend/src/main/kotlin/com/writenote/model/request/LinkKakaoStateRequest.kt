package com.writenote.model.request

/**
 * 카카오 추가 연결 flow 의 session attribute type-safe wrapper.
 *
 * `POST /api/auth/link/kakao` 진입 시 본인 user id 를 session 에 박은 후
 * `/api/auth/oauth/kakao` 로 redirect. 콜백 시점에 KakaoOAuth2UserService 가
 * session 에서 본 모델 추출 → link flow 분기 결정 (research.md R-3, contracts/auth-endpoints.md §11).
 */
data class LinkKakaoStateRequest(
    val linkUserId: Long,
) {
    companion object {
        /** HttpSession attribute key — KakaoOAuth2UserService / OAuth2SuccessHandler 가 동일 key 로 추출. */
        const val SESSION_ATTRIBUTE_KEY = "writeNote.linkKakao"
    }
}
