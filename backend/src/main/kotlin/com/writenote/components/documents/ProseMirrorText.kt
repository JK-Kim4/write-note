package com.writenote.components.documents

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule

/**
 * ProseMirror JSON → plainText 추출 유틸 (022 US4).
 *
 * FE `wordCountUtils.ts#extractPlainText` 와 동일 알고리즘:
 * - type=doc 루트 이외의 입력은 빈 문자열 반환
 * - text 노드: text 값 직접 반환
 * - 블록 자식(paragraph·heading 등 — text 이외 type)이 있는 노드: 자식을 \\n 구분자로 결합 (문단 경계 보존)
 * - inline 만 있는 노드(블록 자식 없음): 자식을 그대로 이어붙임
 */
object ProseMirrorText {
    private val jsonMapper: JsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()

    /**
     * ProseMirror JSON 문자열을 plainText 로 변환.
     * 유효하지 않은 JSON 또는 type=doc 이 아닌 경우 빈 문자열 반환.
     */
    fun extractPlainText(body: String): String {
        val root =
            try {
                jsonMapper.readTree(body)
            } catch (e: Exception) {
                return ""
            }
        val typeNode = root.path("type")
        if (!typeNode.isTextual || typeNode.asText() != "doc") {
            return ""
        }
        return collectText(root)
    }

    private fun collectText(node: JsonNode): String {
        val type = node.path("type").takeIf { it.isTextual }?.asText() ?: ""
        if (type == "text") {
            val textNode = node.path("text")
            return if (textNode.isTextual) textNode.asText() else ""
        }
        val content = node.path("content")
        if (!content.isArray) return ""
        val children = content.toList()
        if (children.isEmpty()) return ""
        // 블록 자식(type != "text")이 있으면 줄바꿈으로 구분 — 문단 경계 보존 (FE 동일 기준)
        val hasBlockChild =
            children.any { child ->
                val childType = child.path("type").takeIf { it.isTextual }?.asText() ?: ""
                childType != "text"
            }
        val separator = if (hasBlockChild) "\n" else ""
        return children.joinToString(separator) { collectText(it) }
    }
}
