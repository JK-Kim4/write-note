package com.writenote.service

import com.writenote.entity.Memo
import com.writenote.model.request.CaptureMemoRequest
import com.writenote.model.request.MobileCaptureRequest
import com.writenote.model.response.MemoResponse
import com.writenote.repository.MemoRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class MemoService(
    private val memoRepository: MemoRepository,
) {
    /**
     * 데스크탑 캡처 (source=DESKTOP, JWT 인증).
     *
     * activeProjectId 는 작성 중이던 프로젝트 ID (nullable).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun captureDesktop(
        userId: Long,
        request: CaptureMemoRequest,
    ): MemoResponse {
        require(request.body.isNotBlank()) { "body 는 비어있을 수 없습니다." }
        val memo =
            memoRepository.save(
                Memo(
                    userId = userId,
                    body = request.body.trim(),
                    source = SOURCE_DESKTOP,
                    capturedAt = Instant.now(),
                    activeProjectAtCapture = request.activeProjectId,
                ),
            )
        return toResponse(memo)
    }

    /**
     * 모바일 캡처 (source=MOBILE, ApiToken 인증).
     *
     * active_project 는 없음. body 만 필수.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun captureMobile(
        userId: Long,
        request: MobileCaptureRequest,
    ): MemoResponse {
        require(request.body.isNotBlank()) { "body 는 비어있을 수 없습니다." }
        val memo =
            memoRepository.save(
                Memo(
                    userId = userId,
                    body = request.body.trim(),
                    source = SOURCE_MOBILE,
                    capturedAt = Instant.now(),
                    activeProjectAtCapture = null,
                ),
            )
        return toResponse(memo)
    }

    private fun toResponse(memo: Memo): MemoResponse =
        MemoResponse(
            id = requireNotNull(memo.id),
            body = memo.body,
            source = memo.source,
            capturedAt = requireNotNull(memo.capturedAt),
            activeProjectAtCapture = memo.activeProjectAtCapture,
            reasonNote = memo.reasonNote,
            tags = memo.tags,
            projects = emptyList(),
        )

    companion object {
        const val SOURCE_DESKTOP = "DESKTOP"
        const val SOURCE_MOBILE = "MOBILE"
    }
}
