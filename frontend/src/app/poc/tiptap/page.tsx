"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * PoC 0-1 — TipTap 한국어 IME 회귀 4 케이스 수동 검증 페이지.
 *
 * 임시 — Phase 1A 진입 시 (또는 Phase 0-1 통과 결정 후) 폐기.
 * 본격 에디터 화면은 Phase 3 (Week 3) 에 별도 구현.
 *
 * 검증 대상 (DESIGN.md L183 + 01-phase §2 + 00-stack §5-2):
 *   1. 빠른 타자 — 조합 중 빠른 타이핑 시 글자 누락/순서 어긋남
 *   2. 조합 중 mark 적용 — 한글 조합 도중 Bold/Italic 단축키
 *   3. 한자 변환 — macOS Option+Enter (또는 Windows 한자키) 시 텍스트 유지
 *   4. Backspace 분해 — 한글 완성형에서 Backspace 시 자모 vs 글자 단위 삭제
 */
export default function TipTapPoCPage() {
    const editor = useEditor({
        extensions: [StarterKit],
        content: `
            <h2>TipTap 한국어 IME PoC</h2>
            <p>아래에 한국어를 입력해보세요. 4 회귀 케이스를 검증합니다.</p>
            <p></p>
        `,
        // Next.js SSR hydration mismatch 회피
        immediatelyRender: false,
    });

    if (!editor) {
        return <main style={{ padding: "2rem" }}>에디터 로딩 중...</main>;
    }

    return (
        <main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                TipTap 한국어 IME PoC (Phase 0-1)
            </h1>
            <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                통과 기준 (`00-stack §5-2`): 4 회귀 케이스 모두 정상. 실패 시 Lexical fallback 재검토.
            </p>

            <section style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>검증 케이스</h2>
                <ol style={{ paddingLeft: "1.5rem", lineHeight: 1.7 }}>
                    <li>
                        <strong>빠른 타자</strong> — "안녕하세요" 를 의식적으로 빠르게 입력 (스페이스
                        없이 연속). 글자 누락 / 자모 분리 / 순서 어긋남이 있는지 확인.
                    </li>
                    <li>
                        <strong>조합 중 mark 적용</strong> — "한" 자 조합 도중 (ㅎ → ㅏ → ㄴ 중간 단계
                        예: "ㅎㅏ" 상태에서) <code>⌘+B</code> (Bold) 또는 <code>⌘+I</code> (Italic)
                        적용. 글자가 깨지거나 mark 가 엉뚱한 곳에 박히는지 확인.
                    </li>
                    <li>
                        <strong>한자 변환</strong> — "한국" 입력 후 <code>Option+Enter</code> (macOS) 로
                        한자 변환 메뉴 띄움. 변환된 글자 (예: "韓國") 가 정상 삽입되는지, 원본 텍스트가
                        유지되는지 확인.
                    </li>
                    <li>
                        <strong>Backspace 분해</strong> — "한" 한 글자 입력 후 <code>Backspace</code>.
                        자모 단위 (ㅎㅏㄴ 순으로 하나씩) 또는 글자 단위 (한 → 비어있음) 어느 쪽으로
                        동작하는지 확인. 한국어 사용자 기대는 보통 **자모 단위** 분해 (조합 중) 또는
                        **글자 단위** 삭제 (조합 완료 후) — 일관성 확인.
                    </li>
                </ol>
            </section>

            <div
                style={{
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    padding: "1rem",
                    minHeight: "200px",
                }}
            >
                <EditorContent editor={editor} />
            </div>

            <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.85rem" }}>
                결과 보고: 4 케이스 통과/실패 + 이상 동작 관찰 메모 → 세션으로 전달
            </p>
        </main>
    );
}
