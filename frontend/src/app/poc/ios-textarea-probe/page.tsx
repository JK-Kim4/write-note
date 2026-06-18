"use client";

import { useRef, useState } from "react";

/**
 * 026 — iOS textarea 입력 프록시 검증 PoC.
 *
 * deep research(2026-06-18) 결론: contenteditable+DOM재구성은 iOS IME 상태를 orphan → 실패.
 * 대안 1순위 = hidden textarea 입력 프록시(CodeMirror/Monaco). 본구현 전 F절 검증 항목 확인:
 *  - F-1: textarea 에 compositionstart/end 가 오는가?
 *  - F-5: Enter 가 textarea value 에 \n 을 자연히 넣는가?
 *  - 한글 IME 가 value diff(폴링/input)로 안정 반영되는가?
 *
 * 검증만 하는 독립 페이지(CustomEditor 비의존). 결과로 textarea 어댑터 본구현 진입 여부 결정.
 */
export default function IosTextareaProbePage() {
    const taRef = useRef<HTMLTextAreaElement>(null);
    const [val, setVal] = useState("");
    const [sel, setSel] = useState("0/0");
    const [ev, setEv] = useState({ cs: 0, ce: 0, enter: 0, input: 0 });
    const [log, setLog] = useState<string[]>([]);
    const add = (m: string) => setLog((l) => [...l.slice(-16), m]);

    const sync = () => {
        const ta = taRef.current;
        if (!ta) return;
        setVal(ta.value);
        setSel(`${ta.selectionStart}/${ta.selectionEnd}`);
    };

    return (
        <div style={{ padding: 12, fontFamily: "monospace" }}>
            <div style={{ fontWeight: 700, color: "#111", fontSize: 14 }}>
                value = &quot;{val.replace(/\n/g, "⏎")}&quot; (len {val.length}, 줄수 {val.split("\n").length})
            </div>
            <div style={{ color: "#111", fontSize: 13 }}>sel = {sel}</div>
            <div style={{ fontWeight: 700, color: "#a00", fontSize: 13, marginTop: 4 }}>
                이벤트: compStart={ev.cs} compEnd={ev.ce} Enter={ev.enter} input={ev.input}
            </div>
            <div style={{ whiteSpace: "pre-wrap", color: "#0a6", fontSize: 11, lineHeight: 1.4, marginTop: 6, maxHeight: 220, overflow: "auto", wordBreak: "break-all" }}>
                {log.join("\n")}
            </div>
            <textarea
                ref={taRef}
                placeholder="여기에 한글 입력 + Enter 테스트 (예: 안녕하세요 ⏎ 안녕하세요)"
                onInput={(e) => {
                    const ie = e.nativeEvent as InputEvent;
                    add(`input ${ie.inputType ?? ""} "${ie.data ?? ""}"`);
                    setEv((c) => ({ ...c, input: c.input + 1 }));
                    sync();
                }}
                onCompositionStart={() => {
                    add("compositionstart");
                    setEv((c) => ({ ...c, cs: c.cs + 1 }));
                }}
                onCompositionEnd={(e) => {
                    add(`compositionend "${e.data ?? ""}"`);
                    setEv((c) => ({ ...c, ce: c.ce + 1 }));
                    sync();
                }}
                onKeyDown={(e) => {
                    add(`keydown key="${e.key}" code=${e.keyCode} comp=${(e.nativeEvent as KeyboardEvent).isComposing}`);
                    if (e.key === "Enter") setEv((c) => ({ ...c, enter: c.enter + 1 }));
                }}
                onSelect={sync}
                style={{ width: "100%", height: 140, marginTop: 12, fontSize: 18, padding: 10, border: "2px solid #888", borderRadius: 8, boxSizing: "border-box" }}
            />
        </div>
    );
}
