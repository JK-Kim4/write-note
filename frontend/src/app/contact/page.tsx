"use client";

import { useState, type FormEvent } from "react";
import { useAuthGuard } from "@/lib/auth/guard";
import { webElectronApi } from "@/lib/electron-api";

const BODY_PLACEHOLDER = "의견을 자유롭게 적어주세요";
// 카카오 채널 채팅 진입 URL(사용자 준비물). 메일이 부담스러울 때 실시간 대화 대안.
const KAKAO_CHAT_URL = "https://pf.kakao.com/_mxlxlnX/chat";
// 선택 입력이라 엄밀 RFC 검증 대신 최소 형식만 본다.
const EMAIL_RE = /.+@.+\..+/;

/**
 * 문의 화면 (015 US4) — desktop ContactScreen 1:1 이식. 인앱 메일 폼으로 의견 전송, 회신 이메일 선택.
 */
export default function ContactPage() {
    useAuthGuard("requireAuth");
    const [email, setEmail] = useState("");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim() || sending) return;
        if (email.trim() !== "" && !EMAIL_RE.test(email.trim())) {
            setNotice({ kind: "error", text: "이메일 형식을 확인해주세요." });
            return;
        }
        setSending(true);
        try {
            const result = await webElectronApi.contact.send({ email, body });
            if (result.ok) {
                setNotice({ kind: "success", text: "보내주셔서 감사합니다." });
                setEmail("");
                setBody("");
            } else {
                setNotice({ kind: "error", text: "전송 실패, 잠시 후 다시 시도해주세요." });
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <main className="mx-auto max-w-lg px-4 py-12">
            <h1 className="text-xl font-bold text-gray-900">의견을 들려주세요</h1>
            <p className="mt-2 text-sm text-gray-500">
                쓰면서 불편했던 점이나 바라는 점을 보내주시면 다음 버전에 반영합니다.
            </p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                <label className="block text-sm text-gray-700">
                    회신 이메일 <span className="text-gray-400">(선택)</span>
                    <input
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                        type="email"
                        placeholder="답장받을 이메일"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setNotice(null);
                        }}
                    />
                </label>

                <label className="block text-sm text-gray-700">
                    의견
                    <textarea
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                        placeholder={BODY_PLACEHOLDER}
                        rows={6}
                        value={body}
                        onChange={(e) => {
                            setBody(e.target.value);
                            setNotice(null);
                        }}
                    />
                </label>

                <button
                    type="submit"
                    disabled={!body.trim() || sending}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    {sending ? "보내는 중…" : "보내기"}
                </button>

                {notice && (
                    <p
                        role="status"
                        className={notice.kind === "success" ? "text-sm text-green-600" : "text-sm text-red-600"}
                    >
                        {notice.text}
                    </p>
                )}
            </form>

            <div className="mt-8 border-t border-gray-100 pt-6">
                <span className="text-sm text-gray-500">실시간으로 이야기하고 싶다면</span>
                <button
                    type="button"
                    className="mt-2 flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => window.open(KAKAO_CHAT_URL, "_blank")}
                >
                    카카오톡으로 문의
                </button>
            </div>
        </main>
    );
}
