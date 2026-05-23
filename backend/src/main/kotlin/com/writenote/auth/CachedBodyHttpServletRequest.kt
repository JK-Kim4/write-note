package com.writenote.auth

import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import java.io.BufferedReader
import java.io.ByteArrayInputStream
import java.io.InputStreamReader

/**
 * Filter 가 body 1회 읽고 cache + controller 가 다시 읽을 수 있도록 wrap.
 *
 * Spring 의 ContentCachingRequestWrapper 는 cache 박지만 getInputStream 재읽기를 지원하지 않음
 * (logging 용 — getContentAsByteArray 로만 cache 접근). 본 클래스는 byte[] cache + 매 getInputStream
 * 호출마다 새 ByteArrayInputStream 반환 → controller 의 @RequestBody 매핑 정합.
 */
class CachedBodyHttpServletRequest(
    request: HttpServletRequest,
) : HttpServletRequestWrapper(request) {
    val bodyBytes: ByteArray = request.inputStream.readAllBytes()

    override fun getInputStream(): ServletInputStream {
        val inputStream = ByteArrayInputStream(bodyBytes)
        return object : ServletInputStream() {
            override fun isFinished(): Boolean = inputStream.available() == 0

            override fun isReady(): Boolean = true

            override fun setReadListener(listener: ReadListener?): Unit = throw UnsupportedOperationException("ReadListener not supported")

            override fun read(): Int = inputStream.read()
        }
    }

    override fun getReader(): BufferedReader = BufferedReader(InputStreamReader(getInputStream()))
}
