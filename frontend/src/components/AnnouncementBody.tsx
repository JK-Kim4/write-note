"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

/**
 * 공지 본문 마크다운 렌더 (032) — 제목/볼드/글머리표 수준.
 * remark-breaks 로 단일 줄바꿈 보존(기존 평문 공지 호환). rehype-raw 미사용 → 원시 HTML 차단(XSS-safe).
 */
export function AnnouncementBody({ body }: { body: string }) {
    return (
        <div className="text-sm leading-relaxed text-ink">
            <ReactMarkdown
                remarkPlugins={[remarkBreaks]}
                components={{
                    h2: (props) => <h2 className="mb-2 mt-4 text-lg font-bold text-ink" {...props} />,
                    h3: (props) => <h3 className="mb-1.5 mt-3 text-base font-bold text-ink" {...props} />,
                    p: (props) => <p className="my-2" {...props} />,
                    ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
                    ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
                    strong: (props) => <strong className="font-semibold" {...props} />,
                    a: (props) => <a className="text-teal-700 underline" {...props} />,
                }}
            >
                {body}
            </ReactMarkdown>
        </div>
    );
}
