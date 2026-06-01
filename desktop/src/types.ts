export type Theme = "light" | "dark";
export type SaveState = "saved" | "saving" | "error";
export type MemoState = "loaded" | "empty" | "loading";

export type Memo = {
  id: string;
  body: string;
  date: string;
  tag: string;
};
