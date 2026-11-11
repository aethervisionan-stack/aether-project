/**
 * Canvas document + semantic-diff client — Vite `/api/canvas` → FastAPI `/canvas`.
 */

export interface CanvasDiffOp {
  id?: string;
  op: string;
  content?: string;
  heading?: string | null;
  match?: string | null;
  anchor?: string | null;
}

export interface CanvasDiff {
  id: string;
  doc_id?: string;
  base_revision?: number;
  author?: string;
  summary?: string;
  ops: CanvasDiffOp[];
}

export interface CanvasDocument {
  id: string;
  title: string;
  kind: string;
  markdown: string;
  revision: number;
  profile_id?: string;
  updated_at?: number;
  pending_diffs?: CanvasDiff[];
  history_len?: number;
}

export interface CanvasPreview {
  ok: boolean;
  before: string;
  after: string;
  before_len: number;
  after_len: number;
}

const DEFAULT_PROFILE = "local";

function apiUrl(path: string): string {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function listCanvasDocs(
  profileId: string = DEFAULT_PROFILE,
): Promise<CanvasDocument[]> {
  const q = new URLSearchParams({ profile_id: profileId });
  const res = await fetch(apiUrl(`/canvas/docs?${q}`));
  const body = await readJson<{ docs?: CanvasDocument[] }>(res);
  return Array.isArray(body.docs) ? body.docs : [];
}

export async function getCanvasDoc(docId: string): Promise<CanvasDocument> {
  const res = await fetch(apiUrl(`/canvas/docs/${encodeURIComponent(docId)}`));
  const body = await readJson<{ doc: CanvasDocument }>(res);
  return body.doc;
}

export async function createCanvasDoc(input: {
  title?: string;
  markdown?: string;
  kind?: string;
  profileId?: string;
  docId?: string;
}): Promise<CanvasDocument> {
  const res = await fetch(apiUrl("/canvas/docs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title ?? "Untitled",
      markdown: input.markdown ?? "",
      kind: input.kind ?? "article",
      profile_id: input.profileId ?? DEFAULT_PROFILE,
      doc_id: input.docId ?? null,
    }),
  });
  const body = await readJson<{ doc: CanvasDocument }>(res);
  return body.doc;
}

export async function saveCanvasDoc(
  docId: string,
  markdown: string,
  opts: { title?: string; expectedRevision?: number } = {},
): Promise<CanvasDocument> {
  const res = await fetch(apiUrl(`/canvas/docs/${encodeURIComponent(docId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown,
      title: opts.title,
      expected_revision: opts.expectedRevision,
    }),
  });
  const body = await readJson<{ doc: CanvasDocument }>(res);
  return body.doc;
}

export async function proposeCanvasDiff(
  docId: string,
  instruction: string,
  author = "ai",
): Promise<{ diff: CanvasDiff; doc: CanvasDocument | null }> {
  const res = await fetch(apiUrl(`/canvas/docs/${encodeURIComponent(docId)}/propose`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, author }),
  });
  const body = await readJson<{ diff: CanvasDiff; doc?: CanvasDocument | null }>(res);
  return { diff: body.diff, doc: body.doc ?? null };
}

export async function applyCanvasDiff(
  docId: string,
  diffId: string,
  opts: { accept?: boolean; opIds?: string[] } = {},
): Promise<CanvasDocument> {
  const res = await fetch(
    apiUrl(`/canvas/docs/${encodeURIComponent(docId)}/diffs/${encodeURIComponent(diffId)}/apply`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accept: opts.accept ?? true,
        op_ids: opts.opIds ?? null,
      }),
    },
  );
  const body = await readJson<{ doc: CanvasDocument }>(res);
  return body.doc;
}

export async function previewCanvasOps(
  markdown: string,
  ops: CanvasDiffOp[],
): Promise<CanvasPreview> {
  const res = await fetch(apiUrl("/canvas/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown, ops }),
  });
  return readJson<CanvasPreview>(res);
}
