import { ipcMain } from "electron";
import type { Store } from "../db/store";
import type { CreateProjectInput, UpdateProjectInput } from "../db/projectRepository";
import type { UpdateDocumentInput } from "../db/documentRepository";
import type { CreateMemoInput } from "../db/memoRepository";
import { CHANNELS } from "./contract";

/** Store 를 ipcMain.handle 채널로 노출한다. renderer 는 preload 를 통해서만 접근한다. */
export function registerHandlers(store: Store): void {
  ipcMain.handle(CHANNELS.projectsCreate, (_e, input: CreateProjectInput) =>
    store.createProjectWithDocument(input),
  );
  ipcMain.handle(CHANNELS.projectsList, () => store.projects.list());
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

  ipcMain.handle(CHANNELS.memosCreate, (_e, input: CreateMemoInput) => store.memos.create(input));
  ipcMain.handle(CHANNELS.memosList, () => store.memos.list());
  ipcMain.handle(CHANNELS.memosLink, (_e, id: string, projectId: string | null) =>
    store.memos.link(id, projectId),
  );

  ipcMain.handle(CHANNELS.settingsGet, (_e, key: string) => store.settings.get(key));
  ipcMain.handle(CHANNELS.settingsSet, (_e, key: string, value: string) => store.settings.set(key, value));
}
