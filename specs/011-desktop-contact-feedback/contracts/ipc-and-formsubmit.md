# Contracts: IPC 추가분 + Formsubmit

본 기능이 추가하는 인터페이스 계약. 기존 IPC 3계층(`contract.ts` 타입/채널 → `preload.ts` 노출 → `registerHandlers.ts` 등록) 패턴을 그대로 따른다.

> 전송 서비스 = **Formsubmit**(2026-06-08 실측 확정, research R1). main 프로세스 호출 + `Referer` 헤더. (Web3Forms 는 main 차단으로 폐기)

## 1. IPC 계약 추가 (`desktop/electron/ipc/contract.ts`)

### 타입 — `ElectronAPI`에 2개 네임스페이스 추가

```ts
export type ContactInput = { email: string; body: string };
export type ContactResult = { ok: boolean };

export type ElectronAPI = {
  // ...기존(platform, projects, documents, memos, settings) 유지...
  contact: {
    send: (input: ContactInput) => Promise<ContactResult>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
};
```

### 채널 — `CHANNELS`에 2개 추가

```ts
export const CHANNELS = {
  // ...기존 유지...
  contactSend: "contact:send",
  shellOpenExternal: "shell:openExternal",
} as const;
```

## 2. preload 노출 (`desktop/electron/preload.ts`)

```ts
const api: ElectronAPI = {
  // ...기존...
  contact: {
    send: (input) => ipcRenderer.invoke(CHANNELS.contactSend, input),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(CHANNELS.shellOpenExternal, url),
  },
};
```

## 3. main 핸들러 (`desktop/electron/ipc/registerHandlers.ts`)

```ts
import { app, ipcMain, shell } from "electron";
import { sendContact } from "../contactSender";

// registerHandlers(store) 내부에 추가:
ipcMain.handle(CHANNELS.contactSend, (_e, input: ContactInput) =>
  sendContact(input, {
    appVersion: app.getVersion(),
    os: process.platform,
    sentAt: new Date().toISOString(),
  }),
);

ipcMain.handle(CHANNELS.shellOpenExternal, async (_e, url: string) => {
  // R8: http(s) scheme 만 허용(임의 scheme 열림 방지)
  if (/^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
  }
});
```

> 메타(앱 버전·OS·시각)는 핸들러가 부여한다(R5). renderer는 `{ email, body }`만 전달.

## 4. `contactSender.ts` 모듈 계약 (신설)

```ts
export type ContactMeta = { appVersion: string; os: NodeJS.Platform; sentAt: string };

/** 순수 매핑 — Formsubmit JSON body 구성. email 비면 키 생략(익명). message 에 메타 푸터. */
export function buildContactPayload(input: ContactInput, meta: ContactMeta): FormsubmitPayload;

/** payload 구성 + fetch POST(Referer/Accept 헤더) + 성공 판정(R2). fetch 는 시스템 경계(테스트서 mock). */
export function sendContact(input: ContactInput, meta: ContactMeta): Promise<ContactResult>;
```

### 모듈 상수 (플레이스홀더 — 사용자 준비물)

```ts
// 수신 엔드포인트: 이메일 직접 노출 회피 위해 Formsubmit 랜덤 해시 권장(research R3)
const FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/<HASH_OR_EMAIL>";
const CONTACT_SUBJECT = "write-note 데스크탑 의견";
const CONTACT_REFERER = "https://write-note.local/contact"; // Referer 의무(R2) — 임의 https 상수
```

## 5. Formsubmit HTTP 계약 (외부 · R1/R2 실측 확정)

### 요청

```
POST https://formsubmit.co/ajax/<hash-or-email>
Content-Type: application/json
Accept: application/json
Referer: https://write-note.local/contact      ← 필수(없으면 success:"false")

{
  "_subject": "write-note 데스크탑 의견",
  "_captcha": "false",
  "message": "<본문>\n\n---\n앱 버전: 0.0.0 · OS: darwin · 전송: 2026-06-08T12:34:56.000Z",
  "email": "<회신 이메일 — 있을 때만>"
}
```

### 응답 (실측)

```
HTTP 200
{ "success": "true",  "message": "The form was submitted successfully." }   // 성공
{ "success": "false", "message": "..." }                                     // 실패(Referer 부재/미활성 등)
```

### 성공 판정 (R2 — 회귀 함정 주의)

- **HTTP 200 AND body `success === "true"`(문자열!)** → `{ ok: true }`.
- 비-200 / `success !== "true"` / fetch reject(오프라인) → `{ ok: false }`.
- ⚠️ `success` 는 boolean 아님 — `=== "true"` 문자열 비교 의무.

## 6. 검증(테스트) 계약

| 대상 | 위치(project) | 검증 |
|---|---|---|
| `buildContactPayload` | `electron/contactSender.test.ts` (node) | email 유무에 따른 키 생략/포함, 메타 푸터 포맷, `_subject`/`_captcha` 상수 |
| `sendContact` | `electron/contactSender.test.ts` (node) | fetch mock — 200+`success:"true"` → `{ok:true}`; 200+`success:"false"`/비-200/reject → `{ok:false}`; 요청에 `Referer`/`Accept` 헤더 포함 확인 |
| `ContactScreen` | `src/screens/ContactScreen.test.tsx` (renderer) | 빈 본문 [보내기] 비활성, 성공→감사 안내+폼 초기화, 실패→실패 안내+내용 보존, 카카오 버튼→`shell.openExternal` 호출 |

> 회귀: 기존 vitest 스위트 GREEN 유지(SC-007). `vi.stubGlobal("electronAPI", …)` 에 `contact`/`shell` 추가(ContactScreen 테스트 stub 한정).
