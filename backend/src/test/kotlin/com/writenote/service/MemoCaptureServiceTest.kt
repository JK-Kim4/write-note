package com.writenote.service

import com.writenote.entity.Memo
import com.writenote.model.request.CaptureMemoRequest
import com.writenote.model.request.MobileCaptureRequest
import com.writenote.repository.MemoRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant

@DisplayName("MemoService 캡처 단위 테스트")
class MemoCaptureServiceTest {
    private lateinit var memoRepository: MemoRepository
    private lateinit var service: MemoService

    @BeforeEach
    fun setUp() {
        memoRepository = mockk()
        service = MemoService(memoRepository)
    }

    @Test
    fun `데스크탑 캡처 시 source=DESKTOP 으로 저장된다`() {
        val slot = slot<Memo>()
        every { memoRepository.save(capture(slot)) } answers {
            slot.captured.apply { id = 1L }
        }
        val request = CaptureMemoRequest(body = "작업 메모", activeProjectId = null)

        val response = service.captureDesktop(userId = 1L, request = request)

        assertThat(response.source).isEqualTo("DESKTOP")
        assertThat(response.body).isEqualTo("작업 메모")
    }

    @Test
    fun `데스크탑 캡처 시 activeProjectId 가 기록된다`() {
        val slot = slot<Memo>()
        every { memoRepository.save(capture(slot)) } answers {
            slot.captured.apply { id = 2L }
        }
        val request = CaptureMemoRequest(body = "프로젝트 중 메모", activeProjectId = 99L)

        service.captureDesktop(userId = 1L, request = request)

        assertThat(slot.captured.activeProjectAtCapture).isEqualTo(99L)
    }

    @Test
    fun `모바일 캡처 시 source=MOBILE 로 저장된다`() {
        val slot = slot<Memo>()
        every { memoRepository.save(capture(slot)) } answers {
            slot.captured.apply { id = 3L }
        }
        val request = MobileCaptureRequest(body = "모바일에서 적은 메모")

        val response = service.captureMobile(userId = 1L, request = request)

        assertThat(response.source).isEqualTo("MOBILE")
        assertThat(slot.captured.activeProjectAtCapture).isNull()
    }

    @Test
    fun `capturedAt 은 서버 시각으로 채워진다`() {
        val before = Instant.now()
        val slot = slot<Memo>()
        every { memoRepository.save(capture(slot)) } answers {
            slot.captured.apply { id = 4L }
        }
        val request = CaptureMemoRequest(body = "타임스탬프 테스트", activeProjectId = null)

        service.captureDesktop(userId = 1L, request = request)

        assertThat(slot.captured.capturedAt).isNotNull()
        assertThat(slot.captured.capturedAt!!).isAfterOrEqualTo(before)
    }

    @Test
    fun `빈 body 로 데스크탑 캡처 시 예외가 발생한다`() {
        val request = CaptureMemoRequest(body = "  ", activeProjectId = null)

        assertThatThrownBy { service.captureDesktop(userId = 1L, request = request) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `빈 body 로 모바일 캡처 시 예외가 발생한다`() {
        val request = MobileCaptureRequest(body = "")

        assertThatThrownBy { service.captureMobile(userId = 1L, request = request) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }
}
