import type { ExportDoc } from "@/lib/export/exportDoc";

/**
 * 워드(HWPX/DOCX) export API — 백엔드 ByteArray 응답을 blob 으로 받는다.
 *
 * 공용 client(`apiFetch`)는 `Result<T>` JSON envelope 전용이라 blob 다운로드엔 부적합 →
 * `fetch` 직접 사용. baseURL·인증은 client.ts 와 동일하게:
 * - same-origin 상대 경로(`/api/...`) — Next rewrites 가 backend 로 프록시.
 * - `credentials: "include"` — httpOnly 쿠키 자동 전송(client.ts 의 rawFetch 와 정합).
 */

function parseFilename(disposition: string | null, fallback: string): string {
    const m = disposition?.match(/filename\*=UTF-8''([^;]+)/);
    return m ? decodeURIComponent(m[1]) : fallback;
}

/** 워드 export — ExportDoc 을 POST 하고 응답 blob + 파일명을 반환. */
export async function exportWord(
    projectId: number,
    format: "hwpx" | "docx",
    doc: ExportDoc,
): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch(`/api/export/${projectId}/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(doc),
    });
    if (!res.ok) throw new Error(`export failed: ${res.status}`);
    const blob = await res.blob();
    return { blob, filename: parseFilename(res.headers.get("Content-Disposition"), `export-${projectId}.${format}`) };
}

/** blob 을 브라우저 다운로드로 트리거. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
