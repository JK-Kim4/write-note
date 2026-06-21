"use client";

import { useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { AnnouncementInput } from "@/lib/api/announcements";
import { applyMarkdown, type MarkdownKind } from "@/lib/markdownToolbar";

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
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const [preview, setPreview] = useState(false);

    const runMarker = (kind: MarkdownKind) => {
        const ta = bodyRef.current;
        if (!ta) return;
        const result = applyMarkdown(body, ta.selectionStart, ta.selectionEnd, kind);
        setBody(result.text);
        requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(result.selStart, result.selEnd);
        });
    };

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
                <div className="mb-1 flex items-center gap-2">
                    <label htmlFor="body" className="text-sm font-medium text-slate-700">본문</label>
                    <div className="ml-auto flex gap-1">
                        {(
                            [
                                ["h2", "제목"],
                                ["h3", "소제목"],
                                ["bold", "굵게"],
                                ["bullet", "목록"],
                            ] as [MarkdownKind, string][]
                        ).map(([kind, label]) => (
                            <button
                                key={kind}
                                type="button"
                                onClick={() => runMarker(kind)}
                                className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                            >
                                {label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPreview((p) => !p)}
                            className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                            {preview ? "편집" : "미리보기"}
                        </button>
                    </div>
                </div>
                {preview ? (
                    <div className="min-h-[16rem] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800">
                        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{body}</ReactMarkdown>
                    </div>
                ) : (
                    <textarea
                        id="body"
                        ref={bodyRef}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={12}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-500"
                    />
                )}
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
