// Phase 2 UI (T4): renders assistant prose as GitHub-flavored Markdown, so the
// model's single-newline text and GFM tables display as formatted content. The
// chart is NOT rendered here - it stays a Recharts subtree keyed off the typed
// tool result. react-markdown emits no raw HTML by default, so LLM-authored
// prose is safe inline without a sandbox.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}
