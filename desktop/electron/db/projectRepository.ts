import type { DatabaseSync } from "node:sqlite";
import type { Project } from "./types";

type ProjectRow = {
  id: string;
  title: string;
  summary: string;
  tone: string;
  genre: string;
  target_length: number | null;
  created_at: string;
  updated_at: string;
};

function toProject(r: ProjectRow): Project {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    tone: r.tone,
    genre: r.genre,
    targetLength: r.target_length,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type CreateProjectInput = {
  title: string;
  summary?: string;
  tone?: string;
  genre?: string;
  targetLength?: number | null;
};

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "title">> & { title?: string };

export class ProjectRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: CreateProjectInput): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      title: input.title,
      summary: input.summary ?? "",
      tone: input.tone ?? "",
      genre: input.genre ?? "",
      targetLength: input.targetLength ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO projects (id, title, summary, tone, genre, target_length, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        project.id,
        project.title,
        project.summary,
        project.tone,
        project.genre,
        project.targetLength,
        project.createdAt,
        project.updatedAt,
      );
    return project;
  }

  getById(id: string): Project | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
    return row ? toProject(row) : null;
  }

  list(): Project[] {
    const rows = this.db
      .prepare("SELECT * FROM projects ORDER BY updated_at DESC, created_at DESC")
      .all() as ProjectRow[];
    return rows.map(toProject);
  }

  update(id: string, patch: UpdateProjectInput): Project | null {
    const current = this.getById(id);
    if (!current) return null;
    const next: Project = {
      ...current,
      ...patch,
      targetLength: patch.targetLength === undefined ? current.targetLength : patch.targetLength,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        "UPDATE projects SET title = ?, summary = ?, tone = ?, genre = ?, target_length = ?, updated_at = ? WHERE id = ?",
      )
      .run(next.title, next.summary, next.tone, next.genre, next.targetLength, next.updatedAt, id);
    return next;
  }
}
