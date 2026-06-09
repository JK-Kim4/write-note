package com.writenote.error

import java.time.Instant

/**
 * 본문 저장 시 optimistic lock 버전 불일치 — 409 DOCUMENT_VERSION_CONFLICT.
 *
 * [currentVersion] 은 현재 DB 의 updatedAt 토큰, [currentBody] 는 현재 DB 에 저장된 본문.
 * GlobalExceptionHandler 가 이 예외를 409 로 매핑하여 DocumentConflictResponse 반환.
 */
class DocumentConflictException(
    val currentVersion: Instant,
    val currentBody: String,
) : RuntimeException("Document version conflict: current version is $currentVersion")
