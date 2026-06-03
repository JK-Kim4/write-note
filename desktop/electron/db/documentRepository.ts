import type { DatabaseSync } from "node:sqlite";
import type { Document } from "./types";

type DocumentRow = {
  id: string;
  project_id: string;
  title: string;
  body_json: string;
  plain_text: string;
  word_count: number;
  created_at: string;
  updated_at: string;
};

function toDocument(r: DocumentRow): Document {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    bodyJson: r.body_json,
    plainText: r.plain_text,
    wordCount: r.word_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type CreateDocumentInput = {
  projectId: string;
  title?: string;
  bodyJson?: string;
  plainText?: string;
  wordCount?: number;
};

export type UpdateDocumentInput = {
  title?: string;
  bodyJson?: string;
  plainText?: string;
  wordCount?: number;
};

export class DocumentRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: CreateDocumentInput): Document {
    const now = new Date().toISOString();
    const doc: Document = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      title: input.title ?? "",
      bodyJson: input.bodyJson ?? "",
      plainText: input.plainText ?? "",
      wordCount: input.wordCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO documents (id, project_id, title, body_json, plain_text, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        doc.id,
        doc.projectId,
        doc.title,
        doc.bodyJson,
        doc.plainText,
        doc.wordCount,
        doc.createdAt,
        doc.updatedAt,
      );
    return doc;
  }

  getById(id: string): Document | null {
    const row = this.db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRow | undefined;
    return row ? toDocument(row) : null;
  }

  getByProjectId(projectId: string): Document | null {
    const row = this.db
      .prepare("SELECT * FROM documents WHERE project_id = ? ORDER BY created_at ASC LIMIT 1")
      .get(projectId) as DocumentRow | undefined;
    return row ? toDocument(row) : null;
  }

  update(id: string, patch: UpdateDocumentInput): Document | null {
    const current = this.getById(id);
    if (!current) return null;
    const next: Document = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.db
      .prepare(
        "UPDATE documents SET title = ?, body_json = ?, plain_text = ?, word_count = ?, updated_at = ? WHERE id = ?",
      )
      .run(next.title, next.bodyJson, next.plainText, next.wordCount, next.updatedAt, id);
    return next;
  }
}
