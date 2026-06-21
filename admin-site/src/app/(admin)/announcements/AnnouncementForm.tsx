"use client";

import { useState, type FormEvent } from "react";
import type { AnnouncementInput } from "@/lib/api/announcements";

interface Props {
    initial?: AnnouncementInput;
    submitLabel: string;
    submitting: boolean;
    error?: string | null;
    onSubmit: (input: AnnouncementInput) => void;
}

/** 공지 작성/수정 공용 폼 (030 US1). */
export function AnnouncementForm({ initial, submitLabel, submitting, error, onSubmit }: Props) {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [body, setBody] = useState(initial?.body ?? "");
    const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
    const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        onSubmit({ title: title.trim(), body, isPublished, isPinned });
    };

    const invalid = title.trim() === "" || body.trim() === "";

    return (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
            <div>
                <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">제목</label>
                <input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
            </div>
            <div>
                <label htmlFor="body" className="mb-1 block text-sm font-medium text-slate-700">본문</label>
                <textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
            </div>
            <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                    공개(사용자에게 노출)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
                    배너 고정
                </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={submitting || invalid}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
                {submitting ? "저장 중…" : submitLabel}
            </button>
        </form>
    );
}
