"use client";

import { useState } from "react";
import { CustomEditor } from "@/components/custom-editor/CustomEditor";
import { pmJsonToModel } from "@/components/custom-editor/pmConvert";
import type { DocModel } from "@/components/custom-editor/model";

/**
 * 026 모바일 입력 PoC — iOS 한글 dogfooding 전용 라우트.
 *
 * CustomEditor 를 빈 원고로 띄운다(로그인·자동저장·작품/챕터 불필요). CustomEditor 가 기능 감지로
 * iOS(WebKit)에서는 contentEditableAdapter 를 자동 선택하므로, iPhone Safari 로 이 라우트에 접속해
 * 한글을 입력하면 contenteditable 경로가 검증된다(quickstart Phase A: 입력·받침 재조합).
 */
export default function MobileEditorPocPage() {
    const [model, setModel] = useState<DocModel>(() => pmJsonToModel(JSON.stringify({ type: "doc", content: [] })));
    return (
        <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 12px", fontSize: 13, color: "#555", borderBottom: "1px solid #eee", flex: "none" }}>
                026 모바일 입력 PoC — iPhone Safari에서 한글을 입력해 보세요(받침 재조합 확인).
            </div>
            <CustomEditor model={model} onModelChange={setModel} paperSize="A4" fontSizePx={18} />
        </div>
    );
}
