import { PocEditor } from "@/components/poc-editor/PocEditor";

/** PoC 정적 렌더(M4, 입력 없음) — /poc/editor-static. 라이브 런타임 이슈 시 ①②③ 확인용 fallback. */
export default function PocEditorStaticPage() {
    return <PocEditor />;
}
