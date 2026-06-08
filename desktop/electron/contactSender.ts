import type { ContactInput, ContactResult } from "./ipc/contract";

/** 전송 직전 main 이 부여하는 환경 메타(사용자 입력 아님). */
export type ContactMeta = { appVersion: string; os: NodeJS.Platform; sentAt: string };

/** Formsubmit ajax 엔드포인트로 보내는 JSON body. email 은 회신 있을 때만. */
export type FormsubmitPayload = {
  _subject: string;
  _captcha: "false";
  message: string;
  email?: string;
};

// 수신 엔드포인트 — Formsubmit 해시 미발급이라 이메일 직접(노출 감수, 추후 해시로 교체 가능).
const FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/jongbell4@gmail.com";
const CONTACT_SUBJECT = "write-note 데스크탑 의견";
// Formsubmit 은 Referer 없는 호출을 거부(실측 R2). 도달 가능 도메인일 필요 없는 앱 식별 상수.
const CONTACT_REFERER = "https://write-note.local/contact";

/** 본문 + 환경 메타 푸터를 사람이 읽는 형태로 합친다. */
function composeMessage(body: string, meta: ContactMeta): string {
  return `${body}\n\n---\n앱 버전: ${meta.appVersion} · OS: ${meta.os} · 전송: ${meta.sentAt}`;
}

/** 순수 매핑 — ContactInput + 메타 → Formsubmit payload. 회신 이메일이 비면 키 생략(익명). */
export function buildContactPayload(input: ContactInput, meta: ContactMeta): FormsubmitPayload {
  const payload: FormsubmitPayload = {
    _subject: CONTACT_SUBJECT,
    _captcha: "false",
    message: composeMessage(input.body, meta),
  };
  if (input.email.trim() !== "") {
    payload.email = input.email;
  }
  return payload;
}

/**
 * 문의를 Formsubmit 으로 전송한다. fetch 는 시스템 경계(테스트서 mock).
 * 성공 = HTTP 200 AND body `success === "true"`(문자열, 실측 R2). 그 외/예외 → ok:false.
 */
export async function sendContact(input: ContactInput, meta: ContactMeta): Promise<ContactResult> {
  try {
    const res = await fetch(FORMSUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // Formsubmit 은 Referer 없는 호출을 거부(실측). main(server-side) 호출을 통과시키는 핵심.
        Referer: CONTACT_REFERER,
      },
      body: JSON.stringify(buildContactPayload(input, meta)),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { success?: unknown };
    return { ok: data.success === "true" };
  } catch {
    // 오프라인/네트워크 실패 — 폼 내용 보존을 위해 renderer 가 재시도(FR-012).
    return { ok: false };
  }
}
