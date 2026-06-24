"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { webElectronApi } from "@/lib/electron-api";

const BODY_PLACEHOLDER = "의견을 자유롭게 적어주세요";
// 카카오 채널(소설비) 채팅 진입 URL. 메일이 부담스러울 때 실시간 대화 대안.
const KAKAO_CHAT_URL = "https://pf.kakao.com/_xcuxhxfX/chat";
// 선택 입력이라 엄밀 RFC 검증 대신 최소 형식만 본다.
const EMAIL_RE = /.+@.+\..+/;
// 문의 유형(선택) — 선택 시 Formsubmit 메일 제목에 [분류] prefix 로 붙어 받은편지함에서 분류된다.
const CATEGORIES = ["버그 신고", "개선 제안", "기능 제안", "사용 후기", "기타"] as const;

/**
 * 문의 화면 (공개) — 로그인 불필요. 인앱 메일 폼으로 의견 전송, 회신 이메일 선택.
 */
export default function ContactPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [category, setCategory] = useState("");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

    // 진입 경로로 복귀 — 마이페이지·홈 등 어디서 왔든 뒤로. 직접 진입(히스토리 없음)이면 소개로 fallback.
    const handleBack = () => {
        if (window.history.length > 1) router.back();
        else router.push("/welcome");
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim() || sending) return;
        if (email.trim() !== "" && !EMAIL_RE.test(email.trim())) {
            setNotice({ kind: "error", text: "이메일 형식을 확인해주세요." });
            return;
        }
        setSending(true);
        try {
            const result = await webElectronApi.contact.send({ email, body, category });
            if (result.ok) {
                setNotice({ kind: "success", text: "보내주셔서 감사합니다." });
                setEmail("");
                setCategory("");
                setBody("");
            } else {
                setNotice({ kind: "error", text: "전송 실패, 잠시 후 다시 시도해주세요." });
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 px-4 py-10">
            <div className="mx-auto max-w-lg">
                <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-terracotta-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                >
                    ← 뒤로
                </button>

                <div className="mt-6 rounded-2xl border border-gray-100 bg-white px-8 py-10 shadow-sm">
                    <h1 className="text-xl font-bold text-gray-900">의견을 들려주세요</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        쓰면서 불편했던 점이나 바라는 점을 보내주시면 다음 버전에 반영합니다.
                    </p>

                    <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                        <label className="block text-sm text-gray-700">
                            문의 유형 <span className="text-gray-400">(선택)</span>
                            <select
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                                value={category}
                                onChange={(e) => {
                                    setCategory(e.target.value);
                                    setNotice(null);
                                }}
                            >
                                <option value="">선택 안 함</option>
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block text-sm text-gray-700">
                            회신 이메일 <span className="text-gray-400">(선택)</span>
                            <input
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
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
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
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
                            className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1 disabled:opacity-50"
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
                            className="mt-2 flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                            onClick={() => window.open(KAKAO_CHAT_URL, "_blank")}
                        >
                            카카오톡으로 문의
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
