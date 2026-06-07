import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS, type ElectronAPI } from "./ipc/contract";

// renderer 는 Node/DB 에 직접 접근하지 않는다. 아래 화이트리스트 채널만 window.electronAPI 로 노출한다.
const api: ElectronAPI = {
  platform: process.platform,
  projects: {
    create: (input) => ipcRenderer.invoke(CHANNELS.projectsCreate, input),
    list: () => ipcRenderer.invoke(CHANNELS.projectsList),
    listCards: () => ipcRenderer.invoke(CHANNELS.projectsListCards),
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
    listByProject: (projectId) => ipcRenderer.invoke(CHANNELS.memosListByProject, projectId),
    pickReentry: (projectId) => ipcRenderer.invoke(CHANNELS.memosPickReentry, projectId),
    addLink: (memoId, projectId) => ipcRenderer.invoke(CHANNELS.memosAddLink, memoId, projectId),
    removeLink: (memoId, projectId) => ipcRenderer.invoke(CHANNELS.memosRemoveLink, memoId, projectId),
    setPin: (memoId, projectId, pinned) => ipcRenderer.invoke(CHANNELS.memosSetPin, memoId, projectId, pinned),
    delete: (id) => ipcRenderer.invoke(CHANNELS.memosDelete, id),
    restore: (id) => ipcRenderer.invoke(CHANNELS.memosRestore, id),
  },
  settings: {
    get: (key) => ipcRenderer.invoke(CHANNELS.settingsGet, key),
    set: (key, value) => ipcRenderer.invoke(CHANNELS.settingsSet, key, value),
  },
  contact: {
    send: (input) => ipcRenderer.invoke(CHANNELS.contactSend, input),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(CHANNELS.shellOpenExternal, url),
  },
  logs: {
    list: () => ipcRenderer.invoke(CHANNELS.logsList),
    listByProject: (projectId: string) => ipcRenderer.invoke(CHANNELS.logsListByProject, projectId),
    add: (projectId: string, body: string) => ipcRenderer.invoke(CHANNELS.logsAdd, projectId, body),
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
