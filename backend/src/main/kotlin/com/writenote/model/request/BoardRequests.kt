package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

// 플롯 보드(038, 041 트랙 C) 요청 DTO 모음. 소속(ownerType/ownerId)은 다형 단일 — null 짝=아이디어 보드.
// 카드 위치(posX/posY)는 캔버스 절대 좌표(음수·소수 허용).

/** 보드 생성 — 소속은 선택(미지정 시 아이디어 보드). ownerType="project"|"category", null 짝=아이디어. */
data class CreateBoardRequest(
    @field:NotBlank
    @field:Size(max = 120)
    val name: String,
    val ownerType: String? = null,
    val ownerId: Long? = null,
)

/** 보드 이름 변경. */
data class RenameBoardRequest(
    @field:NotBlank
    @field:Size(max = 120)
    val name: String,
)

/** 소속 지정/해제(041) — ownerType/ownerId 짝(작품/시리즈에 연결), null 짝=아이디어로 해제. PUT /project·/category 통합. */
data class SetBoardOwnerRequest(
    val ownerType: String? = null,
    val ownerId: Long? = null,
)

/** 화면 상태(줌·이동) 저장 — 조작 종료 후 디바운스 1회. */
data class UpdateViewportRequest(
    val zoom: Double,
    val x: Double,
    val y: Double,
)

/** 카드 생성 — 생성 시점 위치 부여. [body] 미지정 시 빈 본문. [type] 미지정 시 무지정(null, 트랙 D). */
data class CreateCardRequest(
    val body: String? = null,
    val posX: Double,
    val posY: Double,
    val zIndex: Int? = null,
    val type: String? = null,
)

/** 카드 단건 수정(본문/위치) — null 필드는 미변경. 종류 변경은 [UpdateCardTypeRequest] 전용 경로. */
data class UpdateCardRequest(
    val body: String? = null,
    val posX: Double? = null,
    val posY: Double? = null,
    val zIndex: Int? = null,
)

/** 카드 종류 설정/해제(트랙 D). [type]=null 이면 무지정 해제, 값은 4종(character/place/event/theme). */
data class UpdateCardTypeRequest(
    val type: String? = null,
)

/** 배치 위치 갱신 1건(드래그 종료·다중선택). */
data class BatchCardPositionItem(
    val id: Long,
    val posX: Double,
    val posY: Double,
    val zIndex: Int? = null,
)

/** 연결 생성 — source≠target, 같은 보드 카드, 중복 불가. [sourceHandle]/[targetHandle]=연결 테두리 앵커(top/right/bottom/left, 미지정 시 기본 핸들). */
data class CreateLinkRequest(
    val sourceCardId: Long,
    val targetCardId: Long,
    val sourceHandle: String? = null,
    val targetHandle: String? = null,
)
