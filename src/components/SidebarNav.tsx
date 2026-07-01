// 09 · Sidebar Navigation - the app shell. Built in the shadcn/radix idiom
// (8px-radius items + selects, ghost hover, filled active), painted in the
// PM × Home Depot skin. This is deliberately distinct from the sheet blocks
// (chat, chips, the transcript modal), which use hard 2px/radius-0 edges - keep
// the two idioms apart.
//
// Two classes of item coexist: in-scope items (backed by the demo data) seed a
// starter question into the composer and set the active route; out-of-scope
// items (Leads, Marketing) are roadmap-only - visibly disabled, INERT (no click
// handler, so they can never reach the loop), with a tooltip + non-color cues.

import type { ComponentType, ReactNode } from "react";
import {
  ChevronDown,
  Coins,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageSquare,
  Target,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type NavId =
  | "overview"
  | "leads"
  | "groups"
  | "tokens"
  | "users"
  | "intelligence"
  | "marketing"
  | "dm";

interface NavItemDef {
  id: NavId;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  // A starter question for in-scope items; absent = roadmap-only (disabled).
  seed?: string;
}

// The eight items + their lucide icons (README nav mapping). Leads and Marketing
// carry no `seed`, which is what marks them roadmap-only below.
const NAV_ITEMS: NavItemDef[] = [
  {
    id: "overview",
    label: "Overview",
    Icon: LayoutGrid,
    seed: "Give me an overview of how our agent runs are doing.",
  },
  { id: "leads", label: "Leads", Icon: MapPin },
  {
    id: "groups",
    label: "Groups",
    Icon: Users,
    seed: "How are our groups doing?",
  },
  {
    id: "tokens",
    label: "Tokens & Cost",
    Icon: Coins,
    seed: "What's our token usage and cost this month?",
  },
  {
    id: "users",
    label: "Users",
    Icon: User,
    seed: "Who are our most active signed-up users?",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    Icon: Target,
    seed: "What's the status of our intelligence tasks?",
  },
  { id: "marketing", label: "Marketing", Icon: Megaphone },
  {
    id: "dm",
    label: "Direct Messages",
    Icon: MessageSquare,
    seed: "Show me recent direct messages to groups.",
  },
];

const ITEM_BASE =
  "flex w-full items-center gap-3 rounded-lg px-3 py-[9px] text-left text-[14.5px] text-dc-navy transition-[background-color,border-color] duration-100";

interface SidebarNavProps {
  active: NavId;
  /** Called only for in-scope items, with the item id and its composer seed. */
  onSelect: (id: NavId, seed: string) => void;
}

// ── nav items ─────────────────────────────────────────────────────────────
function NavItem({
  item,
  active,
  onSelect,
}: {
  item: NavItemDef;
  active: boolean;
  onSelect: SidebarNavProps["onSelect"];
}) {
  const { Icon } = item;

  // Roadmap-only: no seed -> inert. `aria-disabled` (not the native `disabled`
  // attr, which would kill the hover the tooltip needs) + opacity + not-allowed
  // cursor carry the state without relying on color, and no onClick is wired.
  if (item.seed === undefined) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-disabled
            className={cn(
              ITEM_BASE,
              "cursor-not-allowed border border-transparent font-medium opacity-45",
            )}
          >
            <Icon className="size-[18px] text-dc-orange" />
            {item.label}
          </button>
        </TooltipTrigger>
        <TooltipContent>Roadmap - not backed by the demo data</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => {
        onSelect(item.id, item.seed ?? "");
      }}
      className={cn(
        ITEM_BASE,
        "cursor-pointer",
        active
          ? "border border-[rgba(242,98,18,0.35)] bg-[rgba(242,98,18,0.10)] font-semibold hover:bg-[rgba(242,98,18,0.14)]"
          : "border border-transparent font-medium hover:bg-[rgba(11,58,84,0.05)]",
      )}
    >
      <Icon className="size-[18px] text-dc-orange" />
      {item.label}
    </button>
  );
}

// ── select triggers (presentational) ──────────────────────────────────────
// ponytail: the design marks these "visual only here - wire to real options",
// so they render the shadcn Select *look* without a dropdown. Swap for a real
// <Select> once there are deployment/group options to bind.
function SelectGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="hd-cond mb-1.5 text-[10.5px] tracking-[0.1em] text-dc-faint">
        {label}
      </div>
      <div className="flex w-full items-center gap-2 rounded-lg border-[1.5px] border-dc-border-neutral bg-white px-3 py-[9px] text-[13.5px] text-dc-navy transition-colors hover:border-dc-navy">
        {children}
        <ChevronDown className="ml-auto size-4 flex-none text-dc-faint" />
      </div>
    </div>
  );
}

// ── the nav ─────────────────────────────────────────────────────────────
/**
 * The app-shell sidebar (design block 09). In-scope items seed the composer and
 * set the active route; roadmap items are inert with a tooltip.
 *
 * @param props - see {@link SidebarNavProps}
 */
export function SidebarNav({ active, onSelect }: SidebarNavProps) {
  return (
    <TooltipProvider>
      <nav className="flex w-[264px] flex-none flex-col overflow-hidden border-2 border-dc-navy bg-white">
        {/* brand row */}
        <div className="flex items-center gap-[11px] px-4 pb-4 pt-[18px]">
          <div className="hd-cond flex size-[38px] items-center justify-center rounded-md bg-dc-navy text-[15px] font-bold text-dc-orange">
            MC
          </div>
          <span className="hd-cond text-[19px] font-bold text-dc-orange">
            Monsterclaw
          </span>
        </div>
        <div className="mx-3 border-b border-dc-border-hairline" />

        {/* nav items */}
        <div className="flex flex-col gap-0.5 px-2.5 py-3">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={item.id === active}
              onSelect={onSelect}
            />
          ))}
        </div>
        <div className="mx-3 border-b border-dc-border-hairline" />

        {/* select groups */}
        <div className="flex flex-col gap-4 px-3.5 py-4">
          <SelectGroup label="Deployment">
            <span className="size-2 flex-none rounded-full bg-dc-online" />
            <span className="font-medium">Dev</span>
            <span className="mono truncate text-dc-muted">
              (warmhearted-dinosaur)
            </span>
          </SelectGroup>
          <SelectGroup label="Group Filter">
            <span>All Groups</span>
          </SelectGroup>
        </div>
      </nav>
    </TooltipProvider>
  );
}
