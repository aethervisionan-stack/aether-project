/**
 * Client adaptation of `/server/src/agent/deepResearch.ts`.
 * Runs Deep Research via FastAPI `POST /api/research/run` (Vite proxy → backend).
 */

export interface DeepResearchSource {
  title?: string;
  url?: string;
  snippet?: string;
  query?: string;
  trust_score?: number;
  [key: string]: unknown;
}

export interface DeepResearchCanvasDoc {
  id: string;
  title: string;
  kind: string;
  markdown: string;
  revision: number;
  profile_id?: string;
  updated_at?: number;
  pending_diffs?: unknown[];
  history_len?: number;
}

export interface DeepResearchResult {
  ok: boolean;
  topic: string;
  subquestions: string[];
  sources: DeepResearchSource[];
  report_markdown: string;
  elapsed_ms: number;
  model?: string | null;
  error?: string | null;
  stages?: Record<string, unknown>;
  canvas?: DeepResearchCanvasDoc | null;
}

export interface RunDeepResearchOptions {
  topic: string;
  profileId?: string;
  maxSubquestions?: number;
  minTrust?: number;
  sourceLimit?: number;
  openInCanvas?: boolean;
  canvasDocId?: string | null;
}

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

/** Run Deep Research on a topic; optionally upsert the Markdown report into Canvas. */
export async function runDeepResearch(
  opts: RunDeepResearchOptions | string,
): Promise<DeepResearchResult> {
  const options: RunDeepResearchOptions =
    typeof opts === "string" ? { topic: opts } : opts;
  const topic = (options.topic || "").trim();
  if (!topic) {
    return {
      ok: false,
      topic: "",
      subquestions: [],
      sources: [],
      report_markdown: "",
      elapsed_ms: 0,
      error: "topic is required",
      canvas: null,
    };
  }

  const res = await fetch(apiUrl("/research/run"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      profile_id: options.profileId ?? "local",
      max_subquestions: options.maxSubquestions ?? 5,
      min_trust: options.minTrust ?? 0.5,
      source_limit: options.sourceLimit ?? 12,
      open_in_canvas: options.openInCanvas ?? true,
      canvas_doc_id: options.canvasDocId ?? null,
    }),
  });

  const body = await readJson<Partial<DeepResearchResult> & { ok?: boolean }>(res);
  return {
    ok: Boolean(body.ok),
    topic: String(body.topic || topic),
    subquestions: Array.isArray(body.subquestions) ? body.subquestions.map(String) : [],
    sources: Array.isArray(body.sources) ? (body.sources as DeepResearchSource[]) : [],
    report_markdown: String(body.report_markdown || ""),
    elapsed_ms: Number(body.elapsed_ms || 0),
    model: body.model ?? null,
    error: body.error ?? null,
    stages: body.stages && typeof body.stages === "object" ? body.stages : {},
    canvas: (body.canvas as DeepResearchCanvasDoc | null | undefined) ?? null,
  };
}

export async function researchHealth(): Promise<{
  ok: boolean;
  deep_research?: boolean;
  gemini_text?: boolean;
  pipeline?: string[];
}> {
  const res = await fetch(apiUrl("/research/health"));
  return readJson(res);
}
