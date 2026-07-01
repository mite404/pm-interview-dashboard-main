// 02 · Tool-Call Status - the shared lifecycle primitive reused inline in the
// chat thread (01) and the agent-runs table (06, later). Purely
// presentational: it takes an already-resolved `ChipStatus` (see
// `lib/toolCallStatus.ts` for the `ToolStatus -> ChipStatus` mapping used by
// the chat shell) plus the method name/meta text, and renders the chip. No
// data fetching, no state - the calling/done/error -> chip mapping is the only
// logic, and it lives in the pure lib fn so it is unit-testable without a DOM.

import type { ComponentType } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChipStatus } from "@/lib/toolCallStatus";

// A hand-drawn 8px ring reads more faithfully at chip scale than a scaled-down
// 24x24 lucide glyph would, so `queued` gets its own tiny component instead of
// a lucide icon - kept to the same `{ className }` shape as the others so the
// palette table below can stay uniform (no optional `Icon`, no per-status
// branching in the render below).
function RingDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("rounded-full border-2 border-dc-queued-fg", className)}
    />
  );
}

interface ChipPalette {
  label: string;
  fg: string;
  bg: string;
  Icon: ComponentType<{ className?: string }>;
}

// The four-state color/label/icon map is the single most-reused token table
// in the handoff (README.md: "keep the four color triples as a token map").
const PALETTE: Record<ChipStatus, ChipPalette> = {
  queued: {
    label: "Queued",
    fg: "text-dc-queued-fg",
    bg: "bg-dc-queued-bg",
    Icon: RingDot,
  },
  running: {
    label: "Running",
    fg: "text-dc-warning-fg",
    bg: "bg-dc-warning-bg",
    Icon: Loader2,
  },
  success: {
    label: "Success",
    fg: "text-dc-success-fg",
    bg: "bg-dc-success-bg",
    Icon: Check,
  },
  failed: {
    label: "Failed",
    fg: "text-dc-error-fg",
    bg: "bg-dc-error-bg",
    Icon: X,
  },
};

// The chip alone (color + label + icon), split out so the agent-runs table (06)
// reuses the exact same four-state token map inline in a row, without the mono
// method line the chat pill wants below it.
export function StatusChip({ status }: { status: ChipStatus }) {
  const { label, fg, bg, Icon } = PALETTE[status];
  return (
    <span
      className={cn(
        "hd-cond inline-flex items-center gap-[7px] px-[10px] py-[5px] text-[11px]",
        fg,
        bg,
        status === "running" && "animate-dc-pulse",
      )}
    >
      <Icon
        className={cn(
          status === "queued" ? "size-2" : "size-[11px] stroke-[3]",
          status === "running" && "animate-dc-spin",
        )}
      />
      {label}
    </span>
  );
}

interface ToolCallStatusProps {
  status: ChipStatus;
  /** Convex tool/method name shown mono below the chip, e.g. "groups.listSignedUpUsers". */
  method: string;
  /** Optional trailing detail, e.g. "128 rows · 42ms" or "timeout after 30s". */
  meta?: string;
}

export function ToolCallStatus({ status, method, meta }: ToolCallStatusProps) {
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <StatusChip status={status} />
      <span
        className={cn(
          "font-mono text-[11.5px]",
          status === "failed" ? "text-dc-error-fg" : "text-dc-faint",
        )}
      >
        {method}
        {meta ? ` · ${meta}` : ""}
      </span>
    </div>
  );
}
