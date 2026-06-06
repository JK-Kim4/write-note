import type { Document, Memo, Project, ProjectCard, ProjectMemo } from "../db/types";
import type { CreateProjectInput, UpdateProjectInput } from "../db/projectRepository";
import type { UpdateDocumentInput } from "../db/documentRepository";
import type { CaptureMemoInput } from "../db/store";

/** renderer 에 노출되는 IPC API 계약. preload 와 renderer 타입(global.d.ts)이 공유한다. */
export type ElectronAPI = {
  platform: NodeJS.Platform;
  projects: {
    create: (input: CreateProjectInput) => Promise<{ project: Project; document: Document }>;
    list: () => Promise<Project[]>;
    listCards: () => Promise<ProjectCard[]>;
    get: (id: string) => Promise<Project | null>;
    update: (id: string, patch: UpdateProjectInput) => Promise<Project | null>;
    delete: (id: string) => Promise<boolean>;
  };
  documents: {
    getByProject: (projectId: string) => Promise<Document | null>;
    update: (id: string, patch: UpdateDocumentInput) => Promise<Document | null>;
  };
  memos: {
    create: (input: CaptureMemoInput) => Promise<Memo>;
    list: () => Promise<Memo[]>;
    listByProject: (projectId: string) => Promise<ProjectMemo[]>;
    pickReentry: (projectId: string) => Promise<Memo | null>;
    addLink: (memoId: string, projectId: string) => Promise<void>;
    removeLink: (memoId: string, projectId: string) => Promise<void>;
    setPin: (memoId: string, projectId: string, pinned: boolean) => Promise<void>;
    delete: (id: string) => Promise<boolean>;
    restore: (id: string) => Promise<Memo | null>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
  };
};

/** IPC 채널명 — main(registerHandlers)과 preload 가 공유한다. */
export const CHANNELS = {
  projectsCreate: "projects:create",
  projectsList: "projects:list",
  projectsListCards: "projects:listCards",
  projectsGet: "projects:get",
  projectsUpdate: "projects:update",
  projectsDelete: "projects:delete",
  documentsGetByProject: "documents:getByProject",
  documentsUpdate: "documents:update",
  memosCreate: "memos:create",
  memosList: "memos:list",
  memosListByProject: "memos:listByProject",
  memosPickReentry: "memos:pickReentry",
  memosAddLink: "memos:addLink",
  memosRemoveLink: "memos:removeLink",
  memosSetPin: "memos:setPin",
  memosDelete: "memos:delete",
  memosRestore: "memos:restore",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
} as const;
