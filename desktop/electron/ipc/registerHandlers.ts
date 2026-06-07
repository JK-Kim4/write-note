import { app, ipcMain } from "electron";
import type { Store } from "../db/store";
import type { CreateProjectInput, UpdateProjectInput } from "../db/projectRepository";
import type { UpdateDocumentInput } from "../db/documentRepository";
import type { CaptureMemoInput } from "../db/store";
import { CHANNELS, type ContactInput } from "./contract";
import { sendContact } from "../contactSender";

/** Store 를 ipcMain.handle 채널로 노출한다. renderer 는 preload 를 통해서만 접근한다. */
export function registerHandlers(store: Store): void {
  ipcMain.handle(CHANNELS.projectsCreate, (_e, input: CreateProjectInput) =>
    store.createProjectWithDocument(input),
  );
  ipcMain.handle(CHANNELS.projectsList, () => store.projects.list());
  ipcMain.handle(CHANNELS.projectsListCards, () => store.listProjectCards());
  ipcMain.handle(CHANNELS.projectsGet, (_e, id: string) => store.projects.getById(id));
  ipcMain.handle(CHANNELS.projectsUpdate, (_e, id: string, patch: UpdateProjectInput) =>
    store.projects.update(id, patch),
  );
  ipcMain.handle(CHANNELS.projectsDelete, (_e, id: string) => store.projects.delete(id));

  ipcMain.handle(CHANNELS.documentsGetByProject, (_e, projectId: string) =>
    store.documents.getByProjectId(projectId),
  );
  ipcMain.handle(CHANNELS.documentsUpdate, (_e, id: string, patch: UpdateDocumentInput) =>
    store.updateDocument(id, patch),
  );

  ipcMain.handle(CHANNELS.memosCreate, (_e, input: CaptureMemoInput) => store.captureMemo(input));
  ipcMain.handle(CHANNELS.memosList, () => store.memos.list());
  ipcMain.handle(CHANNELS.memosListByProject, (_e, projectId: string) =>
    store.memos.listByProject(projectId),
  );
  ipcMain.handle(CHANNELS.memosPickReentry, (_e, projectId: string) =>
    store.pickReentryMemo(projectId),
  );
  ipcMain.handle(CHANNELS.memosAddLink, (_e, memoId: string, projectId: string) =>
    store.memos.addLink(memoId, projectId),
  );
  ipcMain.handle(CHANNELS.memosRemoveLink, (_e, memoId: string, projectId: string) =>
    store.memos.removeLink(memoId, projectId),
  );
  ipcMain.handle(CHANNELS.memosSetPin, (_e, memoId: string, projectId: string, pinned: boolean) =>
    store.memos.setPin(memoId, projectId, pinned),
  );
  ipcMain.handle(CHANNELS.memosDelete, (_e, id: string) => store.memos.softDelete(id));
  ipcMain.handle(CHANNELS.memosRestore, (_e, id: string) => store.memos.restore(id));

  ipcMain.handle(CHANNELS.settingsGet, (_e, key: string) => store.settings.get(key));
  ipcMain.handle(CHANNELS.settingsSet, (_e, key: string, value: string) => store.settings.set(key, value));

  // 문의 전송 — 로컬 DB 가 아닌 외부 서비스이므로 Store 밖 contactSender 로 위임.
  // 앱 버전·OS·전송 시각 메타는 renderer 가 신뢰성 있게 줄 수 없어 main 이 부여(research R5).
  ipcMain.handle(CHANNELS.contactSend, (_e, input: ContactInput) =>
    sendContact(input, {
      appVersion: app.getVersion(),
      os: process.platform,
      sentAt: new Date().toISOString(),
    }),
  );
}
