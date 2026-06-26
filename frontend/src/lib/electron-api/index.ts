/**
 * webElectronApi (015 T006) — desktop `window.electronAPI` 의 web 구현체 진입점.
 *
 * 화면은 이 객체(또는 lib/query 훅)만 호출한다(설계 §3). 도메인은 단계적으로 추가:
 * - projects/documents: US1 (projects 풀스택)
 * - memos/logs/sessions/contact/shell/settings: 각 US 단계에서 동일 패턴으로 추가
 *   (contracts/web-electron-api.md 매핑)
 */
import { projects } from "./projects";
import { categories } from "./categories";
import { documents } from "./documents";
import { memos } from "./memos";
import { sessions } from "./sessions";
import { logs } from "./logs";
import { contact } from "./contact";
import { shell } from "./shell";
import { settings } from "./settings";
import { boards } from "./boards";

export const webElectronApi = {
    projects,
    categories,
    documents,
    memos,
    sessions,
    logs,
    contact,
    shell,
    settings,
    boards,
};

export type WebElectronApi = typeof webElectronApi;
