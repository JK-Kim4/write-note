package com.writenote.service

import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule

/**
 * 앵커 범위 검증(046 R2 / H1 화해) — 순수 로직.
 *
 * 스냅샷 평문 PM JSON(복호 후)을 **프론트 `pmConvert.ts` 의 `flattenNode`/`chunksOf` 와 동형으로 평탄화**해
 * 댓글 앵커가 유효한지 판정한다:
 *   `anchorBlockIndex < 블록 수` && `anchorStart >= 0` && `anchorLength >= 0` && `anchorStart + anchorLength <= 블록 텍스트 길이`.
 *
 * H1 화해(2026-06-28): 종전엔 PM **top-level 노드**를 블록으로 세고 text 노드만 길이로 셌으나, 프론트는
 * 목록을 **항목별**, 다단락 인용을 **단락별**로 평탄화하고 hardBreak 를 **U+2028 1글자**로 센다. 두 모델이
 * 어긋나 목록/인용/소프트줄바꿈 본문에서 정상 댓글이 거짓 400 으로 거부됐다(spec research.md R-4 정정). 본 구현은
 * 프론트 평탄화를 그대로 미러링해 렌더·선택·작성·검증이 같은 블록 모델을 쓰게 한다.
 *
 * 블록 텍스트 길이 = 해당 블록의 inline text 이어붙임 길이(text 노드 = 텍스트, hardBreak = U+2028 1글자).
 * 길이는 UTF-16 코드 유닛 기준(JS `String.length` 와 Kotlin `String.length` 동일). 스냅샷 불변이라 영구 안정.
 */
@Component
class AnchorValidator {
    private val jsonMapper: JsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()

    fun isValid(
        plainPmJson: String,
        anchorBlockIndex: Int,
        anchorStart: Int,
        anchorLength: Int,
    ): Boolean {
        if (anchorBlockIndex < 0 || anchorStart < 0 || anchorLength < 0) {
            return false
        }
        val blocks = flattenBlocks(plainPmJson) ?: return false
        if (anchorBlockIndex >= blocks.size) {
            return false
        }
        // Int 오버플로 회피(L1) — Long 비교.
        return anchorStart.toLong() + anchorLength.toLong() <= blocks[anchorBlockIndex].length.toLong()
    }

    /**
     * PM JSON → 블록 텍스트 배열(null = 무효 입력 = 거부). 유효 doc 의 평탄화는 프론트 `pmJsonToModel` 과 동형:
     * top-level `content` 를 `flattenNode` 로 평탄화, content 가 비면 빈 블록 1개(EMPTY_MODEL).
     * 단 파싱 실패·비-doc 루트·content 부재는 거부(null) — 스냅샷은 항상 유효 doc 이라 불가 케이스이며 방어적으로 거부.
     */
    private fun flattenBlocks(body: String): List<String>? {
        val root =
            try {
                jsonMapper.readTree(body)
            } catch (e: Exception) {
                return null
            }
        if (root.typeStr() != "doc") {
            return null
        }
        val content = root.path("content")
        if (!content.isArray) {
            return null
        }
        val blocks = content.toList().flatMap { flattenNode(it, 0, NO_LIST) }
        return blocks.ifEmpty { listOf("") }
    }

    /** `pmConvert.ts` `flattenNode` 미러링. 반환 = 블록 텍스트들(검증엔 길이만 필요해 attr/run 생략). */
    private fun flattenNode(
        node: JsonNode,
        listDepth: Int,
        listKind: String,
    ): List<String> {
        when (node.typeStr()) {
            "paragraph", "heading" -> return listOf(chunksText(node))

            "bulletList" -> {
                val children = node.children()
                return if (children.isEmpty()) listOf("") else children.flatMap { flattenNode(it, listDepth, "bullet") }
            }

            "orderedList" -> {
                val children = node.children()
                return if (children.isEmpty()) listOf("") else children.flatMap { flattenNode(it, listDepth, "ordered") }
            }

            "listItem" -> {
                val children = node.children()
                if (children.isEmpty()) return listOf("")
                val out = mutableListOf<String>()
                for (child in children) {
                    val childType = child.typeStr()
                    if (childType == "bulletList" || childType == "orderedList") {
                        val nestedKind = if (childType == "bulletList") "bullet" else "ordered"
                        for (nestedItem in child.children()) {
                            out += flattenNode(nestedItem, listDepth + 1, nestedKind)
                        }
                    } else {
                        out += flattenNode(child, listDepth, listKind)
                    }
                }
                return out
            }

            "blockquote" -> {
                val children = node.children()
                if (children.isEmpty()) return listOf("")
                return children.flatMap { child ->
                    if (child.typeStr() == "paragraph") {
                        listOf(chunksText(child))
                    } else {
                        flattenNode(child, 0, NO_LIST)
                    }
                }
            }

            "horizontalRule" -> return listOf("")

            else -> return listOf(chunksText(node))
        }
    }

    /** `pmConvert.ts` `chunksOf` 미러링: hardBreak = U+2028, text 노드 = 텍스트, 그 외 = 자식 이어붙임. */
    private fun chunksText(node: JsonNode): String {
        if (node.typeStr() == "hardBreak") {
            return SOFT_BREAK
        }
        val textNode = node.path("text")
        if (textNode.isTextual) {
            return textNode.asText()
        }
        return node.children().joinToString("") { chunksText(it) }
    }

    private fun JsonNode.typeStr(): String = path("type").let { if (it.isTextual) it.asText() else "" }

    private fun JsonNode.children(): List<JsonNode> = path("content").let { if (it.isArray) it.toList() else emptyList() }

    companion object {
        /** 블록 내 소프트 줄바꿈 마커(U+2028) — model.ts SOFT_BREAK 와 동일 코드포인트. */
        private const val SOFT_BREAK = "\u2028"
        private const val NO_LIST = ""
    }
}
