package com.writenote.error

/**
 * 마지막 활성 챕터 삭제 시도 — 409 LAST_CHAPTER_UNDELETABLE.
 *
 * 활성 챕터가 1개뿐일 때 챕터 삭제를 거부한다.
 * GlobalExceptionHandler 가 이 예외를 409 로 매핑한다.
 */
class LastChapterException : RuntimeException("마지막 챕터는 삭제할 수 없습니다")
