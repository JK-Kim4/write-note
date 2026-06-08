import { useState, type FormEvent } from "react";
import { Titlebar } from "../components/Titlebar";

const BODY_PLACEHOLDER = "의견을 자유롭게 적어주세요";
// 카카오 채널 채팅 진입 URL(사용자 준비물). 메일이 부담스러울 때 실시간 대화 대안.
const KAKAO_CHAT_URL = "https://pf.kakao.com/_mxlxlnX/chat";
// 선택 입력이라 엄밀 RFC 검증 대신 최소 형식만 본다(FR-006).
const EMAIL_RE = /.+@.+\..+/;

/** 문의 전용 화면 — 인앱 메일 폼으로 의견을 보낸다. 회신 이메일은 선택(비면 익명). */
export function ContactScreen() {
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
      const result = await window.electronAPI.contact.send({ email, body });
      if (result.ok) {
        // 성공일 때만 폼 초기화. 실패면 작성 내용 보존(FR-012).
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
    <div className="main">
      <Titlebar title="문의" />
      <div className="screen-body screen-body--solo">
        <div className="screen-main">
          <section className="newproject contact" aria-label="문의 보내기">
            <div className="create-head">
              <h1 className="screen-h1">의견을 들려주세요</h1>
              <p className="newproject__sub">
                쓰면서 불편했던 점이나 바라는 점을 보내주시면 다음 버전에 반영합니다.
              </p>
            </div>

            <form className="newproject__form" onSubmit={handleSubmit} noValidate>
              <label className="field">
                <span className="field__label">
                  회신 이메일 <em>선택</em>
                </span>
                <input
                  className="input"
                  type="email"
                  placeholder="답장받을 이메일"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>

              <label className="field">
                <span className="field__label">의견</span>
                <textarea
                  className="input textarea"
                  placeholder={BODY_PLACEHOLDER}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setNotice(null);
                  }}
                />
              </label>

              <button type="submit" className="btn btn--primary" disabled={!body.trim() || sending}>
                {sending ? "보내는 중…" : "보내기"}
              </button>

              {notice && (
                <p className={`contact-notice contact-notice--${notice.kind}`} role="status">
                  {notice.text}
                </p>
              )}
            </form>

            <div className="contact-alt">
              <span className="contact-alt__hint">실시간으로 이야기하고 싶다면</span>
              <button
                type="button"
                className="btn btn--secondary contact-alt__kakao"
                onClick={() => void window.electronAPI.shell.openExternal(KAKAO_CHAT_URL)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 3.5c-4.97 0-9 3.16-9 7.06 0 2.49 1.66 4.67 4.15 5.92-.18.65-.66 2.4-.76 2.77-.12.46.17.45.36.33.15-.1 2.36-1.6 3.32-2.26.62.09 1.27.14 1.93.14 4.97 0 9-3.16 9-7.06S16.97 3.5 12 3.5Z" />
                </svg>
                카카오톡으로 문의
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
