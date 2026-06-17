"use client";

import { useEffect, useState } from "react";
import { CustomEditor } from "@/components/custom-editor/CustomEditor";
import { pmJsonToModel } from "@/components/custom-editor/pmConvert";
import type { DocModel } from "@/components/custom-editor/model";

/**
 * 026 모바일 입력 PoC — Enter 이벤트 진단.
 * Enter 두 번 쳐야 줄바꿈되는 원인(조합 확정 소비 의심)을 이벤트 순서로 확정한다.
 */
export default function MobileEditorPocPage() {
    const [model, setModel] = useState<DocModel>(() => pmJsonToModel(JSON.stringify({ type: "doc", content: [] })));
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        const add = (m: string) => setLog((l) => [...l.slice(-13), m]);
        const onBI = (e: Event) => {
            const ie = e as InputEvent;
            add(`beforeinput ${ie.inputType} "${ie.data ?? ""}"`);
        };
        const onIn = (e: Event) => {
            const ie = e as InputEvent;
            add(`input ${ie.inputType ?? ""} "${ie.data ?? ""}"`);
        };
        const onCS = () => add("compositionstart");
        const onCE = (e: Event) => add(`compositionend "${(e as CompositionEvent).data ?? ""}"`);
        const onKD = (e: KeyboardEvent) => {
            if (e.key === "Enter") add(`keydown Enter isComposing=${e.isComposing}`);
        };
        document.addEventListener("beforeinput", onBI);
        document.addEventListener("input", onIn);
        document.addEventListener("compositionstart", onCS);
        document.addEventListener("compositionend", onCE);
        document.addEventListener("keydown", onKD);
        return () => {
            document.removeEventListener("beforeinput", onBI);
            document.removeEventListener("input", onIn);
            document.removeEventListener("compositionstart", onCS);
            document.removeEventListener("compositionend", onCE);
            document.removeEventListener("keydown", onKD);
        };
    }, []);

    const buf = model.buffer;
    return (
        <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 8, fontSize: 12, background: "#fffbe6", borderBottom: "1px solid #eee", flex: "none" }}>
                <div style={{ fontWeight: 700, color: "#111" }}>buffer = &quot;{buf.replace(/\n/g, "⏎")}&quot; (줄수 {buf.split("\n").length})</div>
                <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", color: "#555", maxHeight: 150, overflow: "auto", marginTop: 4 }}>{log.join("\n")}</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <CustomEditor model={model} onModelChange={setModel} paperSize="A4" fontSizePx={18} />
            </div>
        </div>
    );
}
