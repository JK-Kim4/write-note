package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

// 플롯 보드(038) 요청 DTO 모음. 매핑 필드(projectId·categoryId)는 0~1 — null=미매핑/해제.
// 노드 위치(posX/posY)는 캔버스 절대 좌표(음수·소수 허용).

/** 보드 생성 — 매핑은 선택(미지정 시 독립 보드). 대상에 이미 보드가 있으면 409. */
data class CreateBoardRequest(
    @field:NotBlank
    @field:Size(max = 120)
    val name: String,
    val projectId: Long? = null,
    val categoryId: Long? = null,
)

/** 보드 이름 변경. */
data class RenameBoardRequest(
    @field:NotBlank
    @field:Size(max = 120)
    val name: String,
)

/** 작품 매핑 set/clear — null=해제(미분류). 대상에 다른 보드가 있으면 409. */
data class SetBoardProjectRequest(
    val projectId: Long? = null,
)

/** 시리즈 매핑 set/clear — null=해제. */
data class SetBoardCategoryRequest(
    val categoryId: Long? = null,
)

/** 화면 상태(줌·이동) 저장 — 조작 종료 후 디바운스 1회. */
data class UpdateViewportRequest(
    val zoom: Double,
    val x: Double,
    val y: Double,
)

/** 노드 생성 — 생성 시점 위치 부여. [body] 미지정 시 빈 본문. [type] 미지정 시 'plot'(V25). */
data class CreateNodeRequest(
    val body: String? = null,
    val posX: Double,
    val posY: Double,
    val zIndex: Int? = null,
    val type: String? = null,
)

/** 노드 단건 수정(본문/위치/타입) — null 필드는 미변경. */
data class UpdateNodeRequest(
    val body: String? = null,
    val posX: Double? = null,
    val posY: Double? = null,
    val zIndex: Int? = null,
    val type: String? = null,
)

/** 배치 위치 갱신 1건(드래그 종료·다중선택). */
data class BatchNodePositionItem(
    val id: Long,
    val posX: Double,
    val posY: Double,
    val zIndex: Int? = null,
)

/** 연결 생성 — source≠target, 같은 보드 노드, 중복 불가. */
data class CreateEdgeRequest(
    val sourceNodeId: Long,
    val targetNodeId: Long,
)
