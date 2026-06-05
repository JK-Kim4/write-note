import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS, type ElectronAPI } from "./ipc/contract";

// renderer 는 Node/DB 에 직접 접근하지 않는다. 아래 화이트리스트 채널만 window.electronAPI 로 노출한다.
const api: ElectronAPI = {
  platform: process.platform,
  projects: {
    create: (input) => ipcRenderer.invoke(CHANNELS.projectsCreate, input),
    list: () => ipcRenderer.invoke(CHANNELS.projectsList),
    get: (id) => ipcRenderer.invoke(CHANNELS.projectsGet, id),
    update: (id, patch) => ipcRenderer.invoke(CHANNELS.projectsUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(CHANNELS.projectsDelete, id),
  },
  documents: {
    getByProject: (projectId) => ipcRenderer.invoke(CHANNELS.documentsGetByProject, projectId),
    update: (id, patch) => ipcRenderer.invoke(CHANNELS.documentsUpdate, id, patch),
  },
  memos: {
    create: (input) => ipcRenderer.invoke(CHANNELS.memosCreate, input),
    list: () => ipcRenderer.invoke(CHANNELS.memosList),
    link: (id, projectId) => ipcRenderer.invoke(CHANNELS.memosLink, id, projectId),
    delete: (id) => ipcRenderer.invoke(CHANNELS.memosDelete, id),
    restore: (id) => ipcRenderer.invoke(CHANNELS.memosRestore, id),
  },
  settings: {
    get: (key) => ipcRenderer.invoke(CHANNELS.settingsGet, key),
    set: (key, value) => ipcRenderer.invoke(CHANNELS.settingsSet, key, value),
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
