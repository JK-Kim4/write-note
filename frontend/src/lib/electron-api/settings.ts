/**
 * webElectronApi.settings (015 US4) — desktop `electronAPI.settings` 의 web 판본.
 * desktop 은 로컬 store 의 key-value. web 은 localStorage(보기 설정 등 기기 로컬, 서버 비영속 — R7).
 * 보기 설정 전반은 zustand `preferences`(persist)가 소유하고, 본 shim 은 임의 key-value 계약 완결용.
 */
const PREFIX = "wn:settings:";

export const settings = {
    get: (key: string): string | null =>
        typeof localStorage !== "undefined" ? localStorage.getItem(`${PREFIX}${key}`) : null,

    set: (key: string, value: string): void => {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(`${PREFIX}${key}`, value);
        }
    },
};
