/**
 * Minimal safe Markdown → HTML for the HUD (bold, lists, fenced/inline code).
 * Escapes HTML first, then applies a small allowlist of patterns.
 */

import { escapeHtml } from "./html";

function renderInline(escaped: string): string {
  // inline code `...`
  let out = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  // bold **...** or __...__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // italic *...* (avoid eating bold leftovers)
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  return out;
}

/** Convert a short assistant reply to HTML for the Gemini reply panel. */
export function renderMarkdown(source: string): string {
  const text = (source || "").replaceAll("\r\n", "\n").trim();
  if (!text) {
    return `<p class="md-empty">(vazio)</p>`;
  }

  const lines = text.split("\n");
  const blocks: string[] = [];
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];
  let listBuf: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (!listBuf.length) return;
    const tag = listOrdered ? "ol" : "ul";
    blocks.push(
      `<${tag} class="md-list">${listBuf.map((li) => `<li>${renderInline(li)}</li>`).join("")}</${tag}>`,
    );
    listBuf = [];
  };

  const flushCode = () => {
    if (!inCode) return;
    blocks.push(`<pre class="md-code"><code>${codeBuf.join("\n")}</code></pre>`);
    codeBuf = [];
    inCode = false;
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const fence = line.trim().startsWith("```");
    if (fence) {
      flushList();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
        codeBuf = [];
      }
      i += 1;
      continue;
    }
    if (inCode) {
      codeBuf.push(escapeHtml(line));
      i += 1;
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ul) {
      if (listBuf.length && listOrdered) flushList();
      listOrdered = false;
      listBuf.push(escapeHtml(ul[1] ?? ""));
      i += 1;
      continue;
    }
    if (ol) {
      if (listBuf.length && !listOrdered) flushList();
      listOrdered = true;
      listBuf.push(escapeHtml(ol[1] ?? ""));
      i += 1;
      continue;
    }

    flushList();
    if (!line.trim()) {
      i += 1;
      continue;
    }
    blocks.push(`<p class="md-p">${renderInline(escapeHtml(line))}</p>`);
    i += 1;
  }
  flushList();
  flushCode();

  return `<div class="md">${blocks.join("")}</div>`;
}
