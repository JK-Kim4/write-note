"use client";

/**
 * 문서 버전 충돌 선택 UI (006 T019).
 *
 * 자동저장 409 → useAutoSave 가 conflict 상태 노출 → 본 다이얼로그 표시.
 * - 다시 불러오기: 서버 최신본(currentBody)으로 교체 (로컬 편집 내용 폐기)
 * - 덮어쓰기: 내 편집을 currentVersion 으로 강제 저장
 */

import type { ConflictData } from "@/hooks/useAutoSave";

interface ConflictDialogProps {
    conflict: ConflictData;
    onReload: (currentBody: string) => void;
    onOverwrite: (currentVersion: number) => void;
}

export function ConflictDialog({ conflict, onReload, onOverwrite }: ConflictDialogProps) {
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="conflict-dialog-title"
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
            <div
                className="rounded-card-mode p-6 max-w-md w-full mx-4 flex flex-col gap-4"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    border: "1px solid var(--w-hairline)",
                    color: "var(--w-ink)",
                }}
            >
                <h2 id="conflict-dialog-title" className="font-semibold text-base">
                    문서가 다른 곳에서 변경되었습니다
                </h2>
                <p style={{ fontSize: "14px", opacity: 0.7 }}>
                    현재 열린 문서보다 최신 버전(v{conflict.currentVersion})이 서버에 있습니다.
                    어떻게 처리할까요?
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => onReload(conflict.currentBody)}
                        className="px-4 py-2 rounded-button-utility text-sm font-medium"
                        style={{
                            backgroundColor: "var(--w-ink)",
                            color: "var(--w-canvas)",
                        }}
                    >
                        다시 불러오기 (내 편집 내용 폐기)
                    </button>
                    <button
                        type="button"
                        onClick={() => onOverwrite(conflict.currentVersion)}
                        className="px-4 py-2 rounded-button-utility text-sm"
                        style={{
                            border: "1px solid var(--w-hairline)",
                            color: "var(--w-ink)",
                        }}
                    >
                        내 버전으로 덮어쓰기
                    </button>
                </div>
            </div>
        </div>
    );
}
