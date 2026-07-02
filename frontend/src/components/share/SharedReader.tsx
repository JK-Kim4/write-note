"use client";

import { type CSSProperties, useMemo } from "react";
import { FONT_FAMILY, IMG_SRC, renderRuns } from "@/components/custom-editor/printLayout";
import { buildSharedView } from "@/lib/share/sharedDoc";

/**
 * 공유 공개 페이지(046 R5) — 스냅샷 본문 읽기 전용 렌더.
 *
 * bodyJson(평문 PM JSON) → pmJsonToModel → relayout(View) 를 그대로 재사용하되, 페이지 분할 대신
 * 블록을 연속 흐름으로 렌더한다(읽기 글). EditContext·contentEditable 미부착 = 편집 불가.
 * 각 본문 블록은 `data-block-index` 를 가진 요소로 렌더 → 텍스트 구간 선택→앵커 도출(CommentLayer)이
 * 그 인덱스를 그대로 쓴다(View.blocks 순서 = 앵커 blockIndex, research R-4).
 *
 * 마커(불릿/번호)·인용 바는 `data-block-index` 요소 밖에 두어 선택 오프셋 계산에 끼지 않게 한다.
 *
 * 050 US4: 본문 색을 하드코딩 hex 대신 앱 토큰으로 교체 — `var(--w-ink)`(집필 화면 `CustomEditor` 본문과
 * 동일 토큰, 다크 자동 대응) · 인용 마커 `var(--w-ms-quote)` · 목록 마커 `var(--w-muted)` · 구분선 `var(--w-border)`.
 */
type Props = { bodyJson: string };

const READING_MAX_WIDTH = 680;

export function SharedReader({ bodyJson }: Props) {
    const view = useMemo(() => buildSharedView(bodyJson), [bodyJson]);

    return (
        <div
            className="mx-auto"
            style={{ maxWidth: READING_MAX_WIDTH, color: "var(--w-ink)", fontFamily: FONT_FAMILY }}
        >
            {view.blocks.map((b, i) => {
                if (b.kind === "image") {
                    // eslint-disable-next-line @next/next/no-img-element
                    return <img key={b.id} src={IMG_SRC} alt="" style={{ display: "block", maxWidth: "100%", margin: "16px 0" }} />;
                }

                if (b.attr.type === "hr") {
                    return <hr key={b.id} style={{ border: 0, borderTop: "2px solid var(--w-border)", margin: "20px 0" }} />;
                }

                const textStyle: CSSProperties = {
                    fontSize: b.fontSizePx,
                    lineHeight: `${b.lineHeightPx}px`,
                    fontFamily: FONT_FAMILY,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    // 빈 문단도 한 줄 높이를 차지해 본문 간격을 유지(선택 가능 텍스트는 없음).
                    minHeight: b.lineHeightPx,
                };

                // data-block-index 요소의 textContent = 그 블록 본문(앵커 오프셋 기준). 마커는 바깥.
                const textNode = (
                    <div data-block-index={i} style={textStyle}>
                        {b.text.length > 0 ? renderRuns(b.text, b.marks) : null}
                    </div>
                );

                if (b.attr.type === "blockquote") {
                    return (
                        <div key={b.id} style={{ position: "relative", paddingLeft: 16, margin: "6px 0" }}>
                            <div style={{ position: "absolute", left: 0, top: 2, bottom: 2, width: 3, background: "var(--w-ms-quote)" }} aria-hidden />
                            {textNode}
                        </div>
                    );
                }

                if (b.attr.type === "listItem") {
                    const marker = b.listNumber != null ? `${b.listNumber}.` : "•";
                    return (
                        <div key={b.id} style={{ display: "flex", gap: 8, margin: "2px 0", paddingLeft: 8 }}>
                            <span
                                aria-hidden
                                style={{ flex: "0 0 auto", color: "var(--w-muted)", fontSize: b.fontSizePx, lineHeight: `${b.lineHeightPx}px`, minWidth: 16, textAlign: b.listNumber != null ? "right" : "center" }}
                            >
                                {marker}
                            </span>
                            <div style={{ flex: "1 1 auto" }}>{textNode}</div>
                        </div>
                    );
                }

                // paragraph · heading — 블록 폰트(heading 은 relayout 이 큰 폰트로 파생).
                return (
                    <div key={b.id} style={{ margin: b.headingLevel ? "16px 0 8px" : "6px 0", fontWeight: b.headingLevel ? 700 : undefined }}>
                        {textNode}
                    </div>
                );
            })}
        </div>
    );
}
