/**
 * webElectronApi.shell (015 US4) — desktop `electronAPI.shell` 의 web 판본.
 * desktop `shell.openExternal` → 브라우저 새 탭(`window.open(url, "_blank", "noopener")`).
 */
export const shell = {
    openExternal: (url: string): void => {
        if (typeof window !== "undefined") {
            window.open(url, "_blank", "noopener");
        }
    },
};
