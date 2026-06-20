"use client";

/**
 * PoC #51 — PDF 인쇄 정합 후보 라우트
 *
 * 목표: 화면 column-wrap 분할이 브라우저 인쇄(→ PDF 저장)에서도 같은 위치에 페이지 구분이
 * 생기는지 사용자가 직접 비교하는 테스트 화면.
 *
 * 방법 A — 화면 그대로 + @media print
 *   - 기존 .paper-editor 마크업/CSS 를 그대로 사용.
 *   - @media print 로 책상 배경·그림자 제거 + column-wrap 레이아웃이 인쇄 시 유지되는지 관찰.
 *
 * 방법 B — 인쇄 전용 재구성
 *   - A4 용지 기하(25mm 여백, 본문 26줄)를 @page + explicit break-after: page 로 재현.
 *   - 각 "장"을 별도 div 로 분리해 인쇄 시 정확히 페이지 구분.
 *
 * 본문은 정적 한국어 더미(3장 분량) — 에디터 비의존 PoC 인쇄 정합 검증용.
 * 시각적 정합은 사용자 직접 dogfooding 필요 — 자동 검증 불가.
 */

import { useState } from "react";
import "@/components/editor/paper-editor.css";
import { paperGeometry } from "@/components/editor/pageLayout";

const A4 = paperGeometry("A4");

// 3장 분량 더미 본문 (A4 기준 약 78줄 — 3페이지 overflow 확인용)
// 각 단락은 실제 문단과 유사한 길이의 한국어 산문
const DUMMY_PARAGRAPHS = [
    "그날 아침 미령은 창문 너머로 스며드는 빛을 오래 바라봤다. 차가운 유리 너머로 느껴지는 공기의 질감이 계절이 바뀌고 있다는 사실을 조용히 알리고 있었다. 그녀는 이 순간이 영원히 지속되기를 바라는 마음과, 하루빨리 무언가가 달라지기를 원하는 마음이 동시에 자신 안에 공존하고 있다는 것을 알았다.",
    "복도 끝 방에서는 할머니의 기침 소리가 이따금 들려왔다. 한 번, 두 번, 그리고 잠잠해지는 침묵. 미령은 그 침묵이 안도인지 포기인지 구분할 수 없었다. 이 집에서 오랫동안 쌓인 시간들은 말없이 벽지 속에 스며들어 있었다. 흰 페인트가 군데군데 들떠 있는 천장, 나무가 삭아 삐걱거리는 문틀, 그리고 창틀에 쌓인 먼지—모두가 이야기를 하고 있었지만 아무도 귀를 기울이지 않았다.",
    "그녀가 어릴 때 이 집은 다른 집이었다. 마당에는 큰 감나무가 있었고, 가을이면 온 식구가 나와 감을 땄다. 아버지는 장대로 높은 가지를 두드렸고, 어머니는 떨어진 감을 바구니에 담았다. 미령과 오빠는 그 사이를 뛰어다니며 깔깔거렸다. 그 소리들이 아직도 어딘가에 남아 있을 것 같았다. 공기 중에, 흙 속에, 혹은 자신의 기억이라는 이름의 미로 안 어딘가에.",
    "부엌으로 내려가자 어머니가 이미 밥상을 차리고 있었다. 된장찌개 냄새가 방 안을 가득 채웠다. 미령은 의자를 끌어당겨 앉으며 \"잘 잤어요?\"라고 물었다. 어머니는 찌개를 저으며 \"응, 너는?\"하고 짧게 대답했다. 두 사람 사이에 떠도는 말들은 언제나 이런 식이었다. 표면 아래에는 훨씬 더 많은 것이 있었지만, 그것을 꺼내는 방법을 둘 다 잊은 지 오래였다.",
    "밥을 먹고 나서 미령은 마당으로 나갔다. 감나무는 이제 없었다. 몇 해 전 폭풍에 쓰러진 뒤 베어냈다고 했다. 그 자리에는 잡초가 무성했고, 겨울을 앞두고 누렇게 시들어가고 있었다. 미령은 그 자리에 서서 잠시 눈을 감았다. 나무가 있었던 자리의 공기는 어딘가 다른 것 같았다—더 텅 빈, 더 넓은, 그러나 동시에 더 무거운 무언가.",
    "오후가 되자 오빠가 왔다. 차 소리와 함께 현관문이 열리고, 어린 조카들의 목소리가 집 안을 가득 채웠다. 한동안 조용했던 공간이 갑자기 살아난 것 같았다. 미령은 조카들을 안아 들며 웃었다. 그 웃음이 진심인지 아닌지는 그녀 자신도 잘 알 수 없었다. 다만 그 아이들의 손이 따뜻하고, 그들의 눈이 아직 세상에 상처받지 않은 빛으로 빛나고 있다는 사실이 그녀를 조금은 편안하게 했다.",
    "저녁 식사 자리에서 오빠는 어머니의 건강 이야기를 꺼냈다. 병원에 다시 가야 한다, 검사도 해야 한다, 의사가 당부했다는 말들. 어머니는 \"괜찮아\"라는 말만 반복했다. 미령은 숟가락을 내려놓고 오빠와 눈을 마주쳤다. 그 눈빛 안에는 오랜 시간 쌓인 피로와 걱정이 함께 담겨 있었다. 두 사람은 말하지 않았지만 같은 생각을 하고 있었다—이 상황이 언제까지 이런 식으로 이어질 수 있을까.",
    "밤이 깊어지자 가족들이 떠났다. 미령은 혼자 방에 앉아 오늘 하루를 되짚었다. 특별히 큰일이 일어난 것도 아니고, 무언가 해결된 것도 아니었다. 그저 하루가 지나갔을 뿐이었다. 그러나 그 안에 얼마나 많은 감정들이 오고 갔는지, 얼마나 많은 말들이 발화되지 못한 채 공중에서 사라졌는지—그것을 기억하는 것은 오직 그녀 자신뿐이었다.",
];

// ── 방법 A: 화면 그대로 + @media print ──────────────────────────────────────────────

function MethodA() {
    return (
        <div className="paper-editor" style={{ minHeight: "100vh" }}>
            <style>{`
                @media print {
                    /* 화면용 UI 숨김 */
                    .poc-toolbar { display: none !important; }
                    /* 책상 배경 제거 → 흰 배경 */
                    .paper-editor { background: white !important; }
                    .paper-editor .editor-scroll { padding: 0 !important; }
                    /* 종이 그림자/둥근 모서리 제거 */
                    .paper-editor .sheet {
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        background: white !important;
                    }
                    /* column-wrap 레이아웃을 그대로 두고 인쇄 — 브라우저가 column 단위로 페이지 나누는지 관찰 대상 */
                }
            `}</style>
            <main className="editor-scroll">
                <h1 className="doc-title">PDF 인쇄 정합 PoC — 방법 A</h1>
                <article
                    className="paper"
                    style={{ minHeight: `${2 * A4.stridePx + A4.sheetHpx}px` }}
                >
                    <div className="sheets" aria-hidden="true">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="sheet sheet--lined"
                                style={{ top: `${i * A4.stridePx}px`, height: `${A4.sheetHpx}px` }}
                            />
                        ))}
                    </div>
                    <div className="prose">
                        <div
                            className="ProseMirror"
                            style={{
                                fontFamily: "var(--pe-serif)",
                                fontSize: 18,
                                lineHeight: 1.92,
                                minHeight: `${A4.pageHpx}px`,
                            }}
                        >
                            {DUMMY_PARAGRAPHS.map((text, i) => (
                                <p key={i}>{text}</p>
                            ))}
                        </div>
                    </div>
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="page-num"
                            style={{ top: `${i * A4.stridePx + A4.sheetHpx - 18 * 1.92 * 0.5}px` }}
                        >
                            {i + 1}
                        </div>
                    ))}
                </article>
            </main>
        </div>
    );
}

// ── 방법 B: 인쇄 전용 재구성 ─────────────────────────────────────────────────────

// 더미 본문을 3페이지로 나누기: 약 26줄/페이지. 단락 기준 3분할.
const PAGE_SPLITS = [
    DUMMY_PARAGRAPHS.slice(0, 3), // 1장
    DUMMY_PARAGRAPHS.slice(3, 6), // 2장
    DUMMY_PARAGRAPHS.slice(6, 8), // 3장
];

function MethodB() {
    return (
        <>
            <style>{`
                @media print {
                    /* 화면용 UI 숨김 */
                    .poc-toolbar { display: none !important; }
                    /* @page: A4, 25mm 여백 */
                    @page { size: A4 portrait; margin: 25mm; }
                    /* 인쇄 전용 영역만 표시 */
                    .method-b-screen { display: none !important; }
                    .method-b-print { display: block !important; }
                }
                @media screen {
                    .method-b-print { display: none !important; }
                }
            `}</style>

            {/* 화면 미리보기 (approximate) */}
            <div className="paper-editor method-b-screen" style={{ minHeight: "100vh" }}>
                <main className="editor-scroll">
                    <h1 className="doc-title">PDF 인쇄 정합 PoC — 방법 B</h1>
                    {PAGE_SPLITS.map((paras, pageIdx) => (
                        <article
                            key={pageIdx}
                            className="paper"
                            style={{ marginBottom: `${A4.stridePx - A4.sheetHpx}px`, minHeight: `${A4.sheetHpx}px` }}
                        >
                            <div className="sheets" aria-hidden="true">
                                <div
                                    className="sheet sheet--lined"
                                    style={{ top: 0, height: `${A4.sheetHpx}px` }}
                                />
                            </div>
                            <div className="prose">
                                <div
                                    className="ProseMirror"
                                    style={{
                                        fontFamily: "var(--pe-serif)",
                                        fontSize: 18,
                                        lineHeight: 1.92,
                                        minHeight: `${A4.pageHpx}px`,
                                        // 방법 B에서는 column-wrap 없음 — 명시적 분할
                                        columnWidth: "unset",
                                    }}
                                >
                                    {paras.map((text, i) => (
                                        <p key={i}>{text}</p>
                                    ))}
                                </div>
                            </div>
                            <div
                                className="page-num"
                                style={{ top: `${A4.sheetHpx - 18 * 1.92 * 0.5}px` }}
                            >
                                {pageIdx + 1}
                            </div>
                        </article>
                    ))}
                </main>
            </div>

            {/* 인쇄 전용 DOM — break-after: page 로 페이지 구분 */}
            <div className="method-b-print">
                {PAGE_SPLITS.map((paras, pageIdx) => (
                    <div
                        key={pageIdx}
                        style={{
                            breakAfter: pageIdx < PAGE_SPLITS.length - 1 ? "page" : "avoid",
                            fontFamily:
                                "var(--font-nanum-myeongjo), 'Apple SD Gothic Neo', 'Noto Serif KR', serif",
                            fontSize: "12pt",
                            lineHeight: 1.92,
                            color: "#211f1b",
                        }}
                    >
                        <p
                            style={{
                                fontSize: "10pt",
                                textAlign: "right",
                                color: "#b4b0a6",
                                margin: "0 0 1em 0",
                            }}
                        >
                            {pageIdx + 1}쪽
                        </p>
                        {paras.map((text, i) => (
                            <p key={i} style={{ margin: "0 0 1em 0", wordBreak: "keep-all" }}>
                                {text}
                            </p>
                        ))}
                    </div>
                ))}
            </div>
        </>
    );
}

// ── 메인 PoC 페이지 ────────────────────────────────────────────────────────────────

export default function ExportPrintPocPage() {
    const [method, setMethod] = useState<"A" | "B">("A");

    const handlePrint = () => window.print();

    return (
        <div>
            {/* 툴바 — 인쇄 시 @media print 로 숨김 */}
            <div
                className="poc-toolbar"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: "#fff",
                    borderBottom: "1px solid #e7e3da",
                    padding: "10px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 14,
                }}
            >
                <strong style={{ marginRight: 8 }}>PoC #51 — PDF 인쇄 정합</strong>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                        type="radio"
                        name="method"
                        value="A"
                        checked={method === "A"}
                        onChange={() => setMethod("A")}
                    />
                    방법 A — 화면 그대로 + @media print
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                        type="radio"
                        name="method"
                        value="B"
                        checked={method === "B"}
                        onChange={() => setMethod("B")}
                    />
                    방법 B — 인쇄 전용 재구성 (break-after: page)
                </label>
                <button
                    type="button"
                    onClick={handlePrint}
                    style={{
                        marginLeft: "auto",
                        padding: "7px 18px",
                        background: "#3b5bdb",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                    }}
                >
                    인쇄 (PDF 저장)
                </button>
                <span style={{ color: "#b4b0a6", fontSize: 12 }}>
                    현재: 방법 {method} | A4 기하: 26줄 × {A4.pageHpx.toFixed(1)}px/장
                </span>
            </div>

            {/* 본문 (툴바 높이 offset) */}
            <div style={{ paddingTop: 56 }}>
                {method === "A" ? <MethodA /> : <MethodB />}
            </div>
        </div>
    );
}
