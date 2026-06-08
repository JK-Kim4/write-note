"use client";

import { useSyncExternalStore } from "react";

/**
 * 다운로드 버튼 2종 — 방문자 OS 를 감지해 해당 OS 버튼을 강조하되 둘 다 노출.
 * 링크는 GitHub Releases 의 `latest/download` 고정 경로(버전 무관 불변).
 * 파일명은 desktop/electron-builder.yml 의 artifactName 과 정확히 일치해야 한다.
 */

const REPO_RELEASES = "https://github.com/JK-Kim4/write-note/releases/latest/download";

const DOWNLOADS = {
    windows: {
        label: "Windows용 다운로드",
        href: `${REPO_RELEASES}/Narae-Note-Setup.exe`,
        sub: ".exe · Windows 10 이상",
    },
    mac: {
        label: "macOS용 다운로드",
        href: `${REPO_RELEASES}/Narae-Note.dmg`,
        sub: ".dmg · Intel · Apple Silicon",
    },
} as const;

type DetectedOs = "windows" | "mac" | "unknown";

function detectOs(): DetectedOs {
    if (typeof navigator === "undefined") return "unknown";
    const signature = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    if (signature.includes("win")) return "windows";
    if (signature.includes("mac")) return "mac";
    return "unknown";
}

// navigator 는 변하지 않는 브라우저 전용 값 → 구독은 no-op.
const subscribe = () => () => {};
const getServerSnapshot = (): DetectedOs => "unknown";

export function DownloadButtons() {
    // 서버/초기 렌더는 "unknown"(중립), 클라이언트에서 OS 감지 — setState-in-effect 없이 hydration 안전.
    const detected = useSyncExternalStore(subscribe, detectOs, getServerSnapshot);

    return (
        <div className="flex flex-col gap-3 w-full max-w-sm">
            {(["windows", "mac"] as const).map((os) => {
                const item = DOWNLOADS[os];
                const isPrimary = detected === os;
                return (
                    <a
                        key={os}
                        href={item.href}
                        data-os={os}
                        data-recommended={isPrimary ? "true" : undefined}
                        className="flex flex-col items-center gap-0.5 px-6 py-4 rounded-button-pill font-semibold transition-colors"
                        style={
                            isPrimary
                                ? { backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }
                                : {
                                      backgroundColor: "transparent",
                                      color: "var(--w-ink)",
                                      border: "1px solid var(--w-hairline)",
                                  }
                        }
                    >
                        <span>{item.label}</span>
                        <span className="text-xs font-normal opacity-70">{item.sub}</span>
                    </a>
                );
            })}
        </div>
    );
}
