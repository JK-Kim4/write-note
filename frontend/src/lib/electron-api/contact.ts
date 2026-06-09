/**
 * webElectronApi.contact (015 US4) — desktop `electronAPI.contact` 의 web 판본(electron 대체).
 *
 * desktop 은 main 프로세스의 contactSender 가 Formsubmit 으로 보내고 Referer 헤더로 통과시켰다.
 * web 은 브라우저가 Referer 를 자동 전송(수동 설정 불가)하므로 Referer 트릭이 불필요하다.
 * 첨부 메타(앱/환경 정보)는 web 컨텍스트(navigator·빌드버전)에서 재구성한다(FR-020).
 */
export type ContactInput = { email: string; body: string };
export type ContactResult = { ok: boolean };

/** 전송 직전 부여하는 환경 메타(사용자 입력 아님) — web 컨텍스트에서 생성. */
type ContactMeta = { appVersion: string; os: string; sentAt: string };

type FormsubmitPayload = {
    _subject: string;
    _captcha: "false";
    message: string;
    email?: string;
};

// 수신 엔드포인트 — desktop 과 동일(이미 활성화됨). Formsubmit 해시 미발급이라 이메일 직접(노출 감수).
export const FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/jongbell4@gmail.com";
const CONTACT_SUBJECT = "write-note 웹 의견";

function composeMessage(body: string, meta: ContactMeta): string {
    return `${body}\n\n---\n앱 버전: ${meta.appVersion} · 환경: ${meta.os} · 전송: ${meta.sentAt}`;
}

/** 순수 매핑 — ContactInput + 메타 → Formsubmit payload. 회신 이메일이 비면 키 생략(익명). */
function buildPayload(input: ContactInput, meta: ContactMeta): FormsubmitPayload {
    const payload: FormsubmitPayload = {
        _subject: CONTACT_SUBJECT,
        _captcha: "false",
        message: composeMessage(input.body, meta),
    };
    if (input.email.trim() !== "") {
        payload.email = input.email.trim();
    }
    return payload;
}

function webMeta(): ContactMeta {
    const os = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
    return { appVersion: "web", os, sentAt: new Date().toISOString() };
}

export const contact = {
    /**
     * 문의 전송. 성공 = HTTP 200 AND body `success === "true"`(Formsubmit 규약). 그 외/예외 → ok:false.
     * 외부 서비스이므로 credentials 미동반(apiFetch 미사용).
     */
    send: async (input: ContactInput): Promise<ContactResult> => {
        try {
            const res = await fetch(FORMSUBMIT_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(buildPayload(input, webMeta())),
            });
            if (!res.ok) return { ok: false };
            const data = (await res.json()) as { success?: unknown };
            return { ok: data.success === "true" };
        } catch {
            // 오프라인/네트워크 실패 — 폼 내용 보존을 위해 화면이 재시도(FR-020).
            return { ok: false };
        }
    },
};
