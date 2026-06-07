import { useState, type FormEvent } from "react";
import { Titlebar } from "../components/Titlebar";

const GUIDE = "쓰면서 불편했던 점이나 바라는 점을 들려주세요";
const BODY_PLACEHOLDER = "의견을 자유롭게 적어주세요";
// 선택 입력이라 엄밀 RFC 검증 대신 최소 형식만 본다(FR-006).
const EMAIL_RE = /.+@.+\..+/;

/** 문의 전용 화면 — 인앱 메일 폼으로 의견을 보낸다. 회신 이메일은 선택(비면 익명). */
export function ContactScreen() {
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (email.trim() !== "" && !EMAIL_RE.test(email.trim())) {
      setNotice({ kind: "error", text: "이메일 형식을 확인해주세요." });
      return;
    }
    const result = await window.electronAPI.contact.send({ email, body });
    if (result.ok) {
      setNotice({ kind: "success", text: "보내주셔서 감사합니다." });
      setEmail("");
      setBody("");
    }
  };

  return (
    <div className="main">
      <Titlebar title="문의" />
      <div className="screen-body screen-body--solo">
        <div className="screen-main">
          <div className="contact">
            <p className="contact__guide">{GUIDE}</p>

            <form className="contact__form" onSubmit={handleSubmit} noValidate>
              <input
                className="input"
                type="email"
                placeholder="답장받을 이메일 (선택)"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setNotice(null);
                }}
              />
              <textarea
                className="input contact__body"
                placeholder={BODY_PLACEHOLDER}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setNotice(null);
                }}
              />
              <button type="submit" className="btn btn--primary" disabled={!body.trim()}>
                보내기
              </button>
            </form>

            {notice && (
              <p className={`contact__notice contact__notice--${notice.kind}`} role="status">
                {notice.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
