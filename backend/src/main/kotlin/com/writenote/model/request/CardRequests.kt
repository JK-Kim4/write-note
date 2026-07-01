package com.writenote.model.request

// 카드 관리(048, /api/cards) 요청 DTO. 보드 캔버스 카드 DTO(BoardRequests.kt 의 CreateCardRequest/UpdateCardRequest)와 별개 —
// 이쪽은 유저 스코프(여러 보드 가로지름 + 독립 카드)이고 위치(pos)를 안 받는다.

/** 독립 카드 생성 — board_id=null·소유=principal. [body] 미지정 시 빈 본문(FE 가 내용 필수 가드). [type] 미지정 시 무지정(4종 검증). */
data class CreateStandaloneCardRequest(
    val body: String? = null,
    val type: String? = null,
)

/** 카드 본문/종류 수정 — null 필드는 미변경. 보드 카드·독립 카드 공통. */
data class EditCardRequest(
    val body: String? = null,
    val type: String? = null,
)

/** 카드 소속 보드 변경 — [boardId]=대상 보드(본인 소유)에 배정, null=독립으로 떼기. 연결 있는 카드는 거부(400). */
data class SetCardBoardRequest(
    val boardId: Long? = null,
)
