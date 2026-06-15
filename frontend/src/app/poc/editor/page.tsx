import { PocEditorLive } from "@/components/poc-editor/PocEditorLive";

/** PoC 자체 에디터(EditContext 라이브) — /poc/editor. Chromium 121+ 한정 dogfooding. */
export default function PocEditorPage() {
    return <PocEditorLive />;
}
