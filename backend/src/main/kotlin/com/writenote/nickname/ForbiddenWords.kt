package com.writenote.nickname

/**
 * 사용자가 직접 입력하는 닉네임을 차단하는 금칙어 사전(FR-017).
 *
 * 자동 생성용 안전 어휘([NicknameWords])와 목적이 반대인 별도 차단 목록이다.
 * 정규화(소문자·공백 제거) 후 부분 문자열로 포함 여부를 검사한다.
 * 완벽한 우회 방지(변형 표기·자모 분리·유사 문자)는 v1 범위 밖이며 핵심 금칙어 차단을 목표로 한다.
 */
object ForbiddenWords {
    private val WORDS: List<String> =
        listOf(
            // 비속어 / 욕설
            "씨발",
            "시발",
            "씨바",
            "개새",
            "새끼",
            "병신",
            "지랄",
            "좆",
            "존나",
            "엠창",
            "느금",
            "니애미",
            // 성적 표현
            "보지",
            "자지",
            "섹스",
            "야동",
            "후장",
            // 혐오 / 차별 (대표)
            "한남충",
            "된장녀",
            "김치녀",
            "틀딱",
            "급식충",
            "맘충",
            // 영어
            "fuck",
            "shit",
            "bitch",
            "asshole",
            "dick",
            "pussy",
            "porn",
            "nigger",
            "cunt",
        )

    /** 정규화 후 금칙어를 부분 문자열로 포함하면 true. */
    fun contains(nickname: String): Boolean {
        val normalized = nickname.lowercase().replace(" ", "")
        return WORDS.any { normalized.contains(it) }
    }
}
