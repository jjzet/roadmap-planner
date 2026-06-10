// AI chat edge function.
// Phase 1: read-only tool use. Tools: list_pages, get_page.
// Active page is pre-serialized into the system prompt.
//
// Request:  { user_message: string, active_page_id?: string | null }
// Response: { text: string, conversation_id: string }
//
// Deploy: supabase functions deploy chat

import Anthropic from "npm:@anthropic-ai/sdk@^0.82.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const USER_ID = "default";
const MODEL = "claude-opus-4-6";
const MAX_TOOL_ITERATIONS = 8;
const MAX_TOKENS = 4096;

// ─── Skills (Anthropic Agent Skills pattern) ───────────────────────────
// Each skill is a folder under ./skills/<slug>/ containing a SKILL.md with
// YAML frontmatter (`name`, `description`). Progressive disclosure: the
// system prompt only advertises the trigger description; the assistant must
// call `load_skill` to fetch the full procedure when it matches.
const SKILL_SLUGS = ["draft-review", "link-goals-and-todos"] as const;

type SkillRecord = { slug: string; name: string; description: string; body: string };

function parseSkillFile(slug: string, raw: string): SkillRecord {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  let name = slug;
  let description = "";
  let body = raw;
  if (match) {
    const frontmatter = match[1];
    body = match[2].trim();
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim();
    // description may span lines until the next top-level YAML key.
    const descMatch = frontmatter.match(/^description:\s*([\s\S]*?)(?=\n[a-zA-Z_][\w-]*:|\n*$)/m);
    if (descMatch) description = descMatch[1].trim().replace(/\s+/g, " ");
  }
  return { slug, name, description, body };
}

async function loadSkills(): Promise<SkillRecord[]> {
  const out: SkillRecord[] = [];
  for (const slug of SKILL_SLUGS) {
    try {
      const url = new URL(`./skills/${slug}/SKILL.md`, import.meta.url);
      const raw = await Deno.readTextFile(url);
      out.push(parseSkillFile(slug, raw));
    } catch (err) {
      console.warn(`skill load failed for ${slug}:`, err);
    }
  }
  return out;
}

// Loaded once per cold-start. Cheap (small text files) and avoids per-request IO.
const SKILLS: SkillRecord[] = await loadSkills();
const SKILLS_BY_SLUG = new Map<string, SkillRecord>(SKILLS.map((s) => [s.slug, s]));

const SYSTEM_PROMPT = `You are an embedded productivity assistant for a senior technical leader. You take action inside the app on the user's behalf.

Your domains:
- PAGES — task lists (with groups + sub-groups) and free-form text / heading / divider / goal-card blocks. Day-to-day todos and notes live here.
- GOALS — rich-text intentions the user is working toward.
- JOURNAL — one daily reflective entry per date, with three prompts: forward (how I moved forward), blockers (what got in the way), tomorrow (one focused thing).
- TODAY — an aggregated briefing of overdue / due-today / due-tomorrow tasks across all pages.
- PALACES — 8-bit-style 2D memory palaces. Each palace is a tile map (default 24×16) holding rooms (named coloured zones) and objects (memory anchors with free-form content placed at tile coords). Use these to anchor things the user wants to remember spatially: people, processes, definitions, references.

Tools you can call:
- Pages (read): list_pages, get_page
- Tasks (write): create_task, update_task, archive_task, delete_task, reorder_tasks
- Goal ↔ task links: link_task_to_goal, unlink_task_from_goal, list_tasks_for_goal
- Goals: list_goals, get_goal, create_goal, update_goal, archive_goal
- Journal: get_journal_entry, upsert_journal_entry, list_recent_journal_entries
- Briefing: get_today_briefing
- Palaces: list_palaces, get_palace, create_palace, add_palace_room, add_palace_memory, update_palace_memory, delete_palace_memory, search_palace_memories
- Review: get_review_context
- Skills: load_skill (progressive-disclosure: fetch a skill's full procedure when its trigger matches)

How to behave:
- The user's active context (page or view) is provided below. Prefer answering from that context before calling tools.
- Be action-oriented: when the user asks for something tractable (capture a task, update a goal, summarise a page, draft a journal entry, drop a fact into a palace), do it via tools rather than only describing what they could do.
- After a successful write, confirm briefly and cite the affected text — never dump raw IDs at the user.
- Drafting work (handover summaries, status updates, journal reflections, page summaries) should be done in plain prose first; only persist via tools when the user signals "save it" / "add it" / "log it".
- For journal: when the user reflects on their day, offer to log it. Map their words sensibly to forward / blockers / tomorrow; ask before guessing if it's ambiguous.
- For goals: keep updates incremental. Use update_goal to append progress notes rather than rewriting unless asked.
- For palaces: when the user shares something worth remembering ("remember that…", "add this to my palace", "what was X"), reach for palace tools. If they don't specify a palace, pick the most relevant existing one or ask. Choose icons that match content (book = reference, npc = person, key = credential/access, scroll = note, sign = label, crystal = idea, chest = collection). Auto-place inside an appropriate room when one fits the topic.
- Prefer archive_task / archive_goal over delete_*. Confirm destructive actions before executing them.
- Markdown is supported in your replies. Use it sparingly — short paragraphs, lists when listing.
- Keep responses tight, plain English, no jargon. If you don't know, say so.

Skills — only the trigger is listed here. If a trigger matches the user's request, call \`load_skill\` with the skill name to fetch the full procedure BEFORE you start drafting.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Types ─────────────────────────────────────────────────────────────
type PageRow = {
  id: string;
  name: string;
  data: TodoData;
  updated_at: string;
};

type TodoData = {
  groups?: TodoGroup[];
  blocks?: PageBlock[];
};

type TodoGroup = {
  id: string;
  name: string;
  items: TodoItem[];
  subGroups?: { id: string; name: string; order: number }[];
};

type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
  pinned?: boolean;
  dueDate?: string;
  notes?: string;
  archived?: boolean;
  devStatus?: string;
  order: number;
  subGroupId?: string;
  tags?: string[];
  link?: string;
  expanded?: boolean;
  goalId?: string;
};

type PageBlock =
  | { type: "group"; data: TodoGroup }
  | { type: "text"; data: { id: string; content: string; order: number } }
  | { type: "heading"; data: { id: string; content: string; level: number; order: number } }
  | { type: "divider"; data: { id: string; order: number } }
  | { type: "goal_card"; data: { id: string; goalId: string; order: number } };

// ─── Palace types ─────────────────────────────────────────────────────
const VALID_THEMES = ["overworld", "dungeon", "castle", "forest", "beach", "lab"] as const;
const VALID_ICONS = [
  "chest", "book", "scroll", "crystal", "key", "tree", "sign",
  "lantern", "npc", "gem", "potion", "sword", "shield", "star", "heart",
] as const;

type PalaceRoom = {
  id: string; name: string; description?: string;
  x: number; y: number; width: number; height: number; color: string;
};
type PalaceObject = {
  id: string; name: string; content: string;
  x: number; y: number; icon: string; color: string;
  roomId?: string; link?: string;
};
type PalaceData = { width: number; height: number; rooms: PalaceRoom[]; objects: PalaceObject[] };
type PalaceRow = {
  id: string; name: string; theme: string; description: string;
  data: PalaceData; archived: boolean; updated_at: string;
};

// ─── Page serialization ────────────────────────────────────────────────
function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function shiftIsoDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function serializePage(page: PageRow): string {
  const lines: string[] = [];
  lines.push(`# Page: ${page.name} (id: ${page.id})`);
  lines.push("");

  const blocks = page.data?.blocks ?? [];
  // Fallback: if no blocks but groups exist, synthesize group blocks.
  const effectiveBlocks: PageBlock[] = blocks.length
    ? blocks
    : (page.data?.groups ?? []).map((g, i) => ({
        type: "group" as const,
        data: { ...g, order: i } as TodoGroup & { order: number },
      }));

  const sorted = [...effectiveBlocks].sort((a, b) => {
    const ao = (a.data as { order?: number }).order ?? 0;
    const bo = (b.data as { order?: number }).order ?? 0;
    return ao - bo;
  });

  for (const block of sorted) {
    if (block.type === "heading") {
      const prefix = "#".repeat(Math.min(Math.max(block.data.level, 1), 3) + 1);
      lines.push(`${prefix} ${stripHtml(block.data.content)}`);
      lines.push("");
    } else if (block.type === "text") {
      const txt = stripHtml(block.data.content);
      if (txt) {
        lines.push(`[text block id: ${block.data.id}]`);
        lines.push(txt);
        lines.push("");
      }
    } else if (block.type === "divider") {
      lines.push("---");
      lines.push("");
    } else if (block.type === "goal_card") {
      lines.push(`[goal card id: ${block.data.id}, goal: ${block.data.goalId}]`);
      lines.push("");
    } else if (block.type === "group") {
      const g = block.data;
      lines.push(`## Task list: ${g.name} (group id: ${g.id})`);
      const items = [...(g.items ?? [])].sort((a, b) => a.order - b.order);
      const subs = new Map<string, string>();
      for (const s of g.subGroups ?? []) subs.set(s.id, s.name);
      let currentSub: string | null | undefined = undefined;
      for (const it of items) {
        if (it.archived) continue;
        if (it.subGroupId !== currentSub) {
          currentSub = it.subGroupId;
          if (currentSub) {
            lines.push(`  — sub-group: ${subs.get(currentSub) ?? currentSub}`);
          }
        }
        const box = it.completed ? "[x]" : "[ ]";
        const meta: string[] = [`id: ${it.id}`];
        if (it.dueDate) meta.push(`due: ${it.dueDate}`);
        if (it.pinned) meta.push("pinned");
        if (it.devStatus) meta.push(`status: ${it.devStatus}`);
        if (it.goalId) meta.push(`goal: ${it.goalId}`);
        lines.push(`- ${box} ${stripHtml(it.text)}  {${meta.join(", ")}}`);
        if (it.notes) {
          const noteTxt = stripHtml(it.notes);
          if (noteTxt) lines.push(`    notes: ${noteTxt}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─── Tools ─────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_pages",
    description:
      "List all non-archived pages (task lists / text pages). Returns id, name, and last-updated timestamp.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_page",
    description:
      "Fetch the full content of a page by id, serialized as readable text with task IDs preserved. Use this when the user references a page other than the currently active one.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string", description: "The page id" },
      },
      required: ["page_id"],
    },
  },
  {
    name: "create_task",
    description:
      "Add a new task to a task-list group on a page. Returns the created task's id.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        group_id: { type: "string", description: "The task list (group) id" },
        text: { type: "string", description: "Task text (plain text — HTML not needed)" },
        due_date: { type: "string", description: "YYYY-MM-DD (optional)" },
        pinned: { type: "boolean" },
        notes: { type: "string" },
        sub_group_id: { type: "string", description: "Optional sub-group id within the group" },
        goal_id: { type: "string", description: "Optional goal id to link the new task to (see list_goals)" },
      },
      required: ["page_id", "group_id", "text"],
    },
  },
  {
    name: "update_task",
    description:
      "Update fields on an existing task. Only provided fields change; omitted fields are left alone. Use to toggle completion, edit text, change due date, pin/unpin, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        task_id: { type: "string" },
        text: { type: "string" },
        completed: { type: "boolean" },
        due_date: { type: "string", description: "YYYY-MM-DD, or empty string to clear" },
        pinned: { type: "boolean" },
        notes: { type: "string" },
        goal_id: { type: "string", description: "Goal id to link to, or empty string to unlink" },
      },
      required: ["page_id", "task_id"],
    },
  },
  {
    name: "archive_task",
    description:
      "Archive a task (soft-hide it without deleting). Preferred over delete_task unless the user explicitly asks to delete.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["page_id", "task_id"],
    },
  },
  {
    name: "delete_task",
    description:
      "Permanently delete a task. Destructive — confirm with the user before calling unless they've been explicit.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["page_id", "task_id"],
    },
  },
  {
    name: "reorder_tasks",
    description:
      "Reorder tasks within a group. Provide the full ordered list of task ids for the group; order fields will be reassigned 0..N.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        group_id: { type: "string" },
        ordered_task_ids: {
          type: "array",
          items: { type: "string" },
          description: "Task ids in desired order (must be the complete set for that group)",
        },
      },
      required: ["page_id", "group_id", "ordered_task_ids"],
    },
  },
  // ─── Goals ────────────────────────────────────────────────────────────
  {
    name: "list_goals",
    description:
      "List the user's active (non-archived) goals. Returns id, title, a short snippet of body text, and updated_at.",
    input_schema: {
      type: "object" as const,
      properties: {
        include_archived: { type: "boolean", description: "Default false" },
      },
      required: [],
    },
  },
  {
    name: "get_goal",
    description: "Fetch the full body of a goal as plain text (HTML stripped).",
    input_schema: {
      type: "object" as const,
      properties: {
        goal_id: { type: "string" },
      },
      required: ["goal_id"],
    },
  },
  {
    name: "create_goal",
    description: "Create a new goal. Body is optional plain text — will be stored as a paragraph.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        body: { type: "string", description: "Optional initial body (plain text)" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_goal",
    description:
      "Update a goal's title and/or body. By default `body` REPLACES the existing body; pass `mode: \"append\"` to instead add a new paragraph at the end (preferred for incremental progress notes).",
    input_schema: {
      type: "object" as const,
      properties: {
        goal_id: { type: "string" },
        title: { type: "string" },
        body: { type: "string", description: "Plain text. Will be wrapped in <p>…</p>." },
        mode: { type: "string", description: "'replace' (default) or 'append'" },
      },
      required: ["goal_id"],
    },
  },
  {
    name: "archive_goal",
    description: "Archive a goal (preferred over delete).",
    input_schema: {
      type: "object" as const,
      properties: {
        goal_id: { type: "string" },
      },
      required: ["goal_id"],
    },
  },
  // ─── Journal ──────────────────────────────────────────────────────────
  {
    name: "get_journal_entry",
    description:
      "Fetch a single journal entry by date (YYYY-MM-DD). If no date is provided, today is used. Returns the three fields (forward / blockers / tomorrow) or null if no entry exists.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
      },
      required: [],
    },
  },
  {
    name: "list_recent_journal_entries",
    description:
      "List recent journal entries (most recent first). Useful for spotting trends in what blocks the user week-on-week.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Default 7, max 30" },
      },
      required: [],
    },
  },
  {
    name: "upsert_journal_entry",
    description:
      "Create or update a journal entry for a date (defaults to today). All three fields are optional; omitted fields are LEFT ALONE on existing entries (or empty on new ones). Pass an empty string to explicitly clear a field.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
        forward: { type: "string", description: "How I moved forward today" },
        blockers: { type: "string", description: "What got in the way" },
        tomorrow: { type: "string", description: "Tomorrow's one focused thing" },
      },
      required: [],
    },
  },
  // ─── Today briefing ───────────────────────────────────────────────────
  {
    name: "get_today_briefing",
    description:
      "Return an aggregated briefing of tasks across all pages: overdue, due today, due tomorrow, and pinned items. Useful when the user asks 'what should I focus on?' or 'what's due today?'.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ─── Memory palaces ───────────────────────────────────────────────────
  {
    name: "list_palaces",
    description:
      "List the user's memory palaces (id, name, theme, room count, object count, updated_at).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_palace",
    description:
      "Fetch a palace's full content: rooms (with coords + colour) and objects (memories — name, content, icon, coords, room).",
    input_schema: {
      type: "object" as const,
      properties: { palace_id: { type: "string" } },
      required: ["palace_id"],
    },
  },
  {
    name: "create_palace",
    description:
      "Create a new memory palace. Theme is one of: overworld, dungeon, castle, forest, beach, lab. Defaults to overworld. Width × height default to 24×16 tiles.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        theme: { type: "string", description: "overworld | dungeon | castle | forest | beach | lab" },
        description: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_palace_room",
    description:
      "Add a room (named coloured zone) to a palace at given tile coords. Default size 6×4. Coords are 0-indexed tile positions inside the palace grid.",
    input_schema: {
      type: "object" as const,
      properties: {
        palace_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        color: { type: "string", description: "Hex (e.g. #7DD3FC)" },
      },
      required: ["palace_id", "name"],
    },
  },
  {
    name: "add_palace_memory",
    description:
      "Drop a memory object into a palace. Pass `name` (short label), `content` (the thing to remember), and ideally an `icon` matching the content (book / scroll / chest / crystal / key / tree / sign / lantern / npc / gem / potion / sword / shield / star / heart). If `room_name` is given, the object is placed inside that room (auto-placed if x/y are omitted).",
    input_schema: {
      type: "object" as const,
      properties: {
        palace_id: { type: "string" },
        name: { type: "string" },
        content: { type: "string" },
        icon: { type: "string" },
        color: { type: "string", description: "Hex accent (default cyan)" },
        room_name: { type: "string", description: "Place inside a room with this name (case-insensitive)" },
        x: { type: "number" },
        y: { type: "number" },
        link: { type: "string" },
      },
      required: ["palace_id", "name", "content"],
    },
  },
  {
    name: "update_palace_memory",
    description:
      "Update fields on an existing memory object. Only provided fields change.",
    input_schema: {
      type: "object" as const,
      properties: {
        palace_id: { type: "string" },
        object_id: { type: "string" },
        name: { type: "string" },
        content: { type: "string" },
        icon: { type: "string" },
        color: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        link: { type: "string" },
      },
      required: ["palace_id", "object_id"],
    },
  },
  {
    name: "delete_palace_memory",
    description: "Remove a memory object from a palace.",
    input_schema: {
      type: "object" as const,
      properties: {
        palace_id: { type: "string" },
        object_id: { type: "string" },
      },
      required: ["palace_id", "object_id"],
    },
  },
  {
    name: "search_palace_memories",
    description:
      "Search across all palaces for memories whose name or content match a query (case-insensitive substring). Useful when the user asks 'what was…' or 'where did I store…'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
  // ─── Review ─────────────────────────────────────────────────────────
  {
    name: "get_review_context",
    description:
      "Aggregate the user's recent activity into a single payload for drafting a daily / weekly / monthly review. Returns tasks (completed snapshot, pinned, overdue, due in window), journal entries in the window, goals updated in the window, recent daily insights, and palaces touched in the window. Prefer this single call over chaining list_pages / list_recent_journal_entries / list_goals when drafting a review.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_back: {
          type: "number",
          description: "Lookback window in days. Default 7. Use 1 for daily, 7 for weekly, 30 for monthly. Clamped to [1, 30].",
        },
      },
      required: [],
    },
  },
  // ─── Goal ↔ task links ──────────────────────────────────────────────
  {
    name: "link_task_to_goal",
    description:
      "Link an existing task to a goal so the task counts toward that goal. Idempotent — re-linking to the same goal is a no-op; linking to a different goal replaces the link.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        task_id: { type: "string" },
        goal_id: { type: "string" },
      },
      required: ["page_id", "task_id", "goal_id"],
    },
  },
  {
    name: "unlink_task_from_goal",
    description: "Remove a task's link to whatever goal it's currently associated with.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["page_id", "task_id"],
    },
  },
  {
    name: "list_tasks_for_goal",
    description:
      "List every task linked to a goal across all pages, plus completion stats. Use this for 'what am I doing toward goal X?' / 'show me progress on goal Y'. By default open tasks come first; pass include_completed=false to skip completed.",
    input_schema: {
      type: "object" as const,
      properties: {
        goal_id: { type: "string" },
        include_completed: { type: "boolean", description: "Default true." },
      },
      required: ["goal_id"],
    },
  },
  // ─── Skills (progressive disclosure) ────────────────────────────────
  {
    name: "load_skill",
    description:
      "Fetch the full procedure for one of the registered Skills (e.g. 'draft-review'). The system prompt only advertises Skill triggers — call this BEFORE you start drafting once a trigger matches, then follow the returned procedure.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "The Skill slug, e.g. 'draft-review'" },
      },
      required: ["name"],
    },
  },
];

// ─── Mutation helpers ──────────────────────────────────────────────────
async function loadPageForMutation(
  supabase: ReturnType<typeof createClient>,
  pageId: string
): Promise<{ page: PageRow | null; error?: string }> {
  const { data, error } = await supabase
    .from("todo_lists")
    .select("id, name, data, updated_at")
    .eq("id", pageId)
    .maybeSingle();
  if (error) return { page: null, error: error.message };
  if (!data) return { page: null, error: "page not found" };
  return { page: data as PageRow };
}

async function savePageData(
  supabase: ReturnType<typeof createClient>,
  pageId: string,
  data: TodoData
): Promise<string | null> {
  const { error } = await supabase
    .from("todo_lists")
    .update({ data, updated_at: new Date().toISOString() })
    .eq("id", pageId);
  return error?.message ?? null;
}

// Return [group, blockIndex] for a given group id, searching both `blocks` and legacy `groups`.
function findGroup(data: TodoData, groupId: string): TodoGroup | null {
  for (const b of data.blocks ?? []) {
    if (b.type === "group" && b.data.id === groupId) return b.data;
  }
  for (const g of data.groups ?? []) {
    if (g.id === groupId) return g;
  }
  return null;
}

function allGroups(data: TodoData): TodoGroup[] {
  const out: TodoGroup[] = [];
  for (const b of data.blocks ?? []) {
    if (b.type === "group") out.push(b.data);
  }
  if ((!data.blocks || data.blocks.length === 0) && data.groups) {
    out.push(...data.groups);
  }
  return out;
}

function findTask(data: TodoData, taskId: string): { group: TodoGroup; item: TodoItem } | null {
  for (const g of allGroups(data)) {
    const item = g.items?.find((it) => it.id === taskId);
    if (item) return { group: g, item };
  }
  return null;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function runTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  if (name === "list_pages") {
    const { data, error } = await supabase
      .from("todo_lists")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ pages: data ?? [] });
  }

  if (name === "get_page") {
    const pageId = input.page_id as string;
    if (!pageId) return JSON.stringify({ error: "page_id is required" });
    const { data, error } = await supabase
      .from("todo_lists")
      .select("id, name, data, updated_at")
      .eq("id", pageId)
      .maybeSingle();
    if (error) return JSON.stringify({ error: error.message });
    if (!data) return JSON.stringify({ error: "page not found" });
    return serializePage(data as PageRow);
  }

  if (name === "create_task") {
    const pageId = input.page_id as string;
    const groupId = input.group_id as string;
    const text = (input.text as string) ?? "";
    if (!pageId || !groupId || !text) {
      return JSON.stringify({ error: "page_id, group_id, text required" });
    }
    const { page, error } = await loadPageForMutation(supabase, pageId);
    if (error || !page) return JSON.stringify({ error: error ?? "page not found" });

    const group = findGroup(page.data, groupId);
    if (!group) return JSON.stringify({ error: "group not found on page" });

    group.items = group.items ?? [];
    const maxOrder = group.items.reduce((m, it) => Math.max(m, it.order ?? 0), -1);
    const newItem: TodoItem = {
      id: genId("task"),
      text: text,
      completed: false,
      pinned: false,
      link: "",
      tags: [],
      order: maxOrder + 1,
      notes: "",
      expanded: false,
      archived: false,
    };
    if (input.due_date) newItem.dueDate = input.due_date as string;
    if (input.pinned) newItem.pinned = true;
    if (input.notes) newItem.notes = input.notes as string;
    if (input.sub_group_id) newItem.subGroupId = input.sub_group_id as string;
    if (typeof input.goal_id === "string" && input.goal_id) {
      newItem.goalId = input.goal_id;
    }

    group.items.push(newItem);
    const saveErr = await savePageData(supabase, pageId, page.data);
    if (saveErr) return JSON.stringify({ error: saveErr });
    return JSON.stringify({ ok: true, task_id: newItem.id, group_id: groupId });
  }

  if (name === "update_task") {
    const pageId = input.page_id as string;
    const taskId = input.task_id as string;
    if (!pageId || !taskId) return JSON.stringify({ error: "page_id, task_id required" });
    const { page, error } = await loadPageForMutation(supabase, pageId);
    if (error || !page) return JSON.stringify({ error: error ?? "page not found" });

    const found = findTask(page.data, taskId);
    if (!found) return JSON.stringify({ error: "task not found on page" });

    const it = found.item;
    if (typeof input.text === "string") it.text = input.text;
    if (typeof input.completed === "boolean") it.completed = input.completed;
    if (typeof input.pinned === "boolean") it.pinned = input.pinned;
    if (typeof input.notes === "string") it.notes = input.notes;
    if (typeof input.due_date === "string") {
      if (input.due_date === "") delete it.dueDate;
      else it.dueDate = input.due_date;
    }
    if (typeof input.goal_id === "string") {
      if (input.goal_id === "") delete it.goalId;
      else it.goalId = input.goal_id;
    }

    const saveErr = await savePageData(supabase, pageId, page.data);
    if (saveErr) return JSON.stringify({ error: saveErr });
    return JSON.stringify({ ok: true, task_id: taskId });
  }

  if (name === "archive_task" || name === "delete_task") {
    const pageId = input.page_id as string;
    const taskId = input.task_id as string;
    if (!pageId || !taskId) return JSON.stringify({ error: "page_id, task_id required" });
    const { page, error } = await loadPageForMutation(supabase, pageId);
    if (error || !page) return JSON.stringify({ error: error ?? "page not found" });

    const found = findTask(page.data, taskId);
    if (!found) return JSON.stringify({ error: "task not found on page" });

    if (name === "archive_task") {
      found.item.archived = true;
    } else {
      found.group.items = (found.group.items ?? []).filter((it) => it.id !== taskId);
    }

    const saveErr = await savePageData(supabase, pageId, page.data);
    if (saveErr) return JSON.stringify({ error: saveErr });
    return JSON.stringify({ ok: true, task_id: taskId });
  }

  if (name === "reorder_tasks") {
    const pageId = input.page_id as string;
    const groupId = input.group_id as string;
    const ordered = input.ordered_task_ids as string[];
    if (!pageId || !groupId || !Array.isArray(ordered)) {
      return JSON.stringify({ error: "page_id, group_id, ordered_task_ids required" });
    }
    const { page, error } = await loadPageForMutation(supabase, pageId);
    if (error || !page) return JSON.stringify({ error: error ?? "page not found" });

    const group = findGroup(page.data, groupId);
    if (!group) return JSON.stringify({ error: "group not found on page" });

    const items = group.items ?? [];
    const byId = new Map(items.map((it) => [it.id, it]));
    const missing = ordered.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return JSON.stringify({ error: `task ids not in group: ${missing.join(", ")}` });
    }
    ordered.forEach((id, idx) => {
      const it = byId.get(id)!;
      it.order = idx;
    });
    // Preserve items not in ordered list at the end (shouldn't happen if caller sends full list).
    const extras = items.filter((it) => !ordered.includes(it.id));
    extras.forEach((it, idx) => (it.order = ordered.length + idx));

    const saveErr = await savePageData(supabase, pageId, page.data);
    if (saveErr) return JSON.stringify({ error: saveErr });
    return JSON.stringify({ ok: true, count: ordered.length });
  }

  // ─── Goals ──────────────────────────────────────────────────────────
  if (name === "list_goals") {
    const includeArchived = input.include_archived === true;
    let q = supabase.from("goals").select("id, title, body, updated_at, archived").order("updated_at", { ascending: false });
    if (!includeArchived) q = q.eq("archived", false);
    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    const rows = (data ?? []) as Array<{ id: string; title: string; body: string; updated_at: string; archived: boolean }>;
    return JSON.stringify({
      goals: rows.map((g) => {
        const text = stripHtml(g.body ?? "");
        const snippet = text.length > 140 ? text.slice(0, 140) + "…" : text;
        return { id: g.id, title: g.title, snippet, updated_at: g.updated_at, archived: g.archived };
      }),
    });
  }

  if (name === "get_goal") {
    const id = input.goal_id as string;
    if (!id) return JSON.stringify({ error: "goal_id is required" });
    const { data, error } = await supabase.from("goals").select("id, title, body, updated_at, archived").eq("id", id).maybeSingle();
    if (error) return JSON.stringify({ error: error.message });
    if (!data) return JSON.stringify({ error: "goal not found" });
    const g = data as { id: string; title: string; body: string; updated_at: string; archived: boolean };
    return JSON.stringify({
      id: g.id,
      title: g.title,
      body: stripHtml(g.body ?? ""),
      updated_at: g.updated_at,
      archived: g.archived,
    });
  }

  if (name === "create_goal") {
    const title = (input.title as string) ?? "";
    const bodyText = (input.body as string) ?? "";
    if (!title.trim()) return JSON.stringify({ error: "title is required" });
    const body = bodyText.trim() ? `<p>${escapeHtml(bodyText)}</p>` : "";
    const { data, error } = await supabase.from("goals").insert({ title, body }).select("id").single();
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, goal_id: (data as { id: string }).id });
  }

  if (name === "update_goal") {
    const id = input.goal_id as string;
    if (!id) return JSON.stringify({ error: "goal_id is required" });
    const mode = (input.mode as string) === "append" ? "append" : "replace";
    const patch: { title?: string; body?: string; updated_at?: string } = {};
    if (typeof input.title === "string") patch.title = input.title;
    if (typeof input.body === "string") {
      const newPara = `<p>${escapeHtml(input.body as string)}</p>`;
      if (mode === "append") {
        const { data: cur, error: gErr } = await supabase.from("goals").select("body").eq("id", id).maybeSingle();
        if (gErr) return JSON.stringify({ error: gErr.message });
        if (!cur) return JSON.stringify({ error: "goal not found" });
        const existing = (cur as { body: string }).body ?? "";
        patch.body = existing ? `${existing}\n${newPara}` : newPara;
      } else {
        patch.body = newPara;
      }
    }
    if (Object.keys(patch).length === 0) return JSON.stringify({ error: "nothing to update" });
    patch.updated_at = new Date().toISOString();
    const { error } = await supabase.from("goals").update(patch).eq("id", id);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, goal_id: id, mode });
  }

  if (name === "archive_goal") {
    const id = input.goal_id as string;
    if (!id) return JSON.stringify({ error: "goal_id is required" });
    const { error } = await supabase
      .from("goals")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, goal_id: id });
  }

  // ─── Journal ────────────────────────────────────────────────────────
  if (name === "get_journal_entry") {
    const date = (input.date as string) || todayISO();
    const { data, error } = await supabase
      .from("journal_entries")
      .select("date, forward, blockers, tomorrow, updated_at")
      .eq("date", date)
      .maybeSingle();
    if (error) return JSON.stringify({ error: error.message });
    if (!data) return JSON.stringify({ date, entry: null });
    return JSON.stringify({ date, entry: data });
  }

  if (name === "list_recent_journal_entries") {
    const raw = Number(input.limit ?? 7);
    const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 7, 1), 30);
    const { data, error } = await supabase
      .from("journal_entries")
      .select("date, forward, blockers, tomorrow, updated_at")
      .order("date", { ascending: false })
      .limit(limit);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ entries: data ?? [] });
  }

  if (name === "upsert_journal_entry") {
    const date = (input.date as string) || todayISO();
    const incoming: Partial<{ forward: string; blockers: string; tomorrow: string }> = {};
    if (typeof input.forward === "string") incoming.forward = input.forward;
    if (typeof input.blockers === "string") incoming.blockers = input.blockers;
    if (typeof input.tomorrow === "string") incoming.tomorrow = input.tomorrow;
    if (Object.keys(incoming).length === 0) {
      return JSON.stringify({ error: "Provide at least one of forward / blockers / tomorrow" });
    }
    // Read existing so omitted fields are preserved.
    const { data: existing, error: rErr } = await supabase
      .from("journal_entries")
      .select("forward, blockers, tomorrow")
      .eq("date", date)
      .maybeSingle();
    if (rErr) return JSON.stringify({ error: rErr.message });
    const cur = (existing ?? { forward: "", blockers: "", tomorrow: "" }) as {
      forward: string; blockers: string; tomorrow: string;
    };
    const payload = {
      date,
      forward: incoming.forward ?? cur.forward ?? "",
      blockers: incoming.blockers ?? cur.blockers ?? "",
      tomorrow: incoming.tomorrow ?? cur.tomorrow ?? "",
      updated_at: new Date().toISOString(),
    };
    const isEmpty = !payload.forward.trim() && !payload.blockers.trim() && !payload.tomorrow.trim();
    if (isEmpty) {
      const { error } = await supabase.from("journal_entries").delete().eq("date", date);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, date, deleted: true });
    }
    const { error } = await supabase.from("journal_entries").upsert(payload, { onConflict: "date" });
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, date, entry: payload });
  }

  // ─── Goal ↔ task links ──────────────────────────────────────────────
  if (name === "link_task_to_goal" || name === "unlink_task_from_goal") {
    const pageId = input.page_id as string;
    const taskId = input.task_id as string;
    if (!pageId || !taskId) return JSON.stringify({ error: "page_id and task_id required" });

    const isLink = name === "link_task_to_goal";
    const goalId = isLink ? (input.goal_id as string) : "";
    if (isLink && !goalId) return JSON.stringify({ error: "goal_id required" });

    if (isLink) {
      const { data: goalRow, error: gErr } = await supabase
        .from("goals")
        .select("id, title, archived")
        .eq("id", goalId)
        .maybeSingle();
      if (gErr) return JSON.stringify({ error: gErr.message });
      if (!goalRow) return JSON.stringify({ error: "goal not found" });
      if ((goalRow as { archived: boolean }).archived) {
        return JSON.stringify({ error: "goal is archived — un-archive it first" });
      }
    }

    const { page, error } = await loadPageForMutation(supabase, pageId);
    if (error || !page) return JSON.stringify({ error: error ?? "page not found" });

    const found = findTask(page.data, taskId);
    if (!found) return JSON.stringify({ error: "task not found on page" });

    if (isLink) found.item.goalId = goalId;
    else delete found.item.goalId;

    const saveErr = await savePageData(supabase, pageId, page.data);
    if (saveErr) return JSON.stringify({ error: saveErr });
    return JSON.stringify({ ok: true, task_id: taskId, goal_id: isLink ? goalId : null });
  }

  if (name === "list_tasks_for_goal") {
    const goalId = (input.goal_id as string) ?? "";
    if (!goalId) return JSON.stringify({ error: "goal_id is required" });
    const includeCompleted = input.include_completed === false ? false : true;

    const { data: goalRow, error: gErr } = await supabase
      .from("goals")
      .select("id, title, archived")
      .eq("id", goalId)
      .maybeSingle();
    if (gErr) return JSON.stringify({ error: gErr.message });
    if (!goalRow) return JSON.stringify({ error: "goal not found" });

    const { data: pages, error: pErr } = await supabase
      .from("todo_lists")
      .select("id, name, data");
    if (pErr) return JSON.stringify({ error: pErr.message });

    const open: Array<{ page_id: string; page: string; group: string; task_id: string; text: string; due?: string; pinned?: boolean }> = [];
    const completed: Array<{ page_id: string; page: string; group: string; task_id: string; text: string }> = [];
    for (const row of (pages ?? []) as PageRow[]) {
      for (const g of allGroups(row.data ?? { groups: [], blocks: [] })) {
        for (const it of g.items ?? []) {
          if (it.goalId !== goalId) continue;
          if (it.archived) continue;
          const text = stripHtml(it.text);
          if (it.completed) {
            if (includeCompleted) {
              completed.push({ page_id: row.id, page: row.name, group: g.name, task_id: it.id, text });
            }
          } else {
            open.push({
              page_id: row.id, page: row.name, group: g.name, task_id: it.id, text,
              due: it.dueDate, pinned: it.pinned,
            });
          }
        }
      }
    }
    return JSON.stringify({
      goal: { id: goalRow.id, title: (goalRow as { title: string }).title },
      counts: { open: open.length, completed: completed.length, total: open.length + completed.length },
      open,
      completed,
    });
  }

  // ─── Today briefing ─────────────────────────────────────────────────
  if (name === "get_today_briefing") {
    const { data, error } = await supabase
      .from("todo_lists")
      .select("id, name, data");
    if (error) return JSON.stringify({ error: error.message });
    const today = todayISO();
    const tomorrow = shiftIsoDate(today, 1);
    const overdue: Array<{ page: string; group: string; text: string; due: string }> = [];
    const dueToday: Array<{ page: string; group: string; text: string }> = [];
    const dueTomorrow: Array<{ page: string; group: string; text: string }> = [];
    const pinned: Array<{ page: string; group: string; text: string }> = [];
    for (const row of (data ?? []) as PageRow[]) {
      for (const g of allGroups(row.data ?? { groups: [], blocks: [] })) {
        for (const it of g.items ?? []) {
          if (it.archived || it.completed) continue;
          const text = stripHtml(it.text);
          if (it.pinned) pinned.push({ page: row.name, group: g.name, text });
          if (it.dueDate) {
            if (it.dueDate < today) overdue.push({ page: row.name, group: g.name, text, due: it.dueDate });
            else if (it.dueDate === today) dueToday.push({ page: row.name, group: g.name, text });
            else if (it.dueDate === tomorrow) dueTomorrow.push({ page: row.name, group: g.name, text });
          }
        }
      }
    }
    return JSON.stringify({
      date: today,
      counts: { overdue: overdue.length, due_today: dueToday.length, due_tomorrow: dueTomorrow.length, pinned: pinned.length },
      overdue,
      due_today: dueToday,
      due_tomorrow: dueTomorrow,
      pinned,
    });
  }

  // ─── Palaces ────────────────────────────────────────────────────────
  if (name === "list_palaces") {
    const { data, error } = await supabase
      .from("memory_palaces")
      .select("id, name, theme, description, data, updated_at")
      .eq("archived", false)
      .order("updated_at", { ascending: false });
    if (error) return JSON.stringify({ error: error.message });
    const rows = (data ?? []) as PalaceRow[];
    return JSON.stringify({
      palaces: rows.map((p) => ({
        id: p.id,
        name: p.name,
        theme: p.theme,
        description: p.description,
        rooms: p.data?.rooms?.length ?? 0,
        memories: p.data?.objects?.length ?? 0,
        updated_at: p.updated_at,
      })),
    });
  }

  if (name === "get_palace") {
    const id = input.palace_id as string;
    if (!id) return JSON.stringify({ error: "palace_id is required" });
    const { data, error } = await supabase
      .from("memory_palaces")
      .select("id, name, theme, description, data, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return JSON.stringify({ error: error.message });
    if (!data) return JSON.stringify({ error: "palace not found" });
    const p = data as PalaceRow;
    const roomById = new Map<string, string>();
    for (const r of p.data.rooms ?? []) roomById.set(r.id, r.name);
    return JSON.stringify({
      id: p.id,
      name: p.name,
      theme: p.theme,
      description: p.description,
      width: p.data.width,
      height: p.data.height,
      rooms: (p.data.rooms ?? []).map((r) => ({
        id: r.id, name: r.name, description: r.description ?? "",
        x: r.x, y: r.y, width: r.width, height: r.height, color: r.color,
      })),
      objects: (p.data.objects ?? []).map((o) => ({
        id: o.id, name: o.name, content: o.content,
        x: o.x, y: o.y, icon: o.icon, color: o.color,
        room: o.roomId ? roomById.get(o.roomId) ?? null : null,
        link: o.link ?? null,
      })),
    });
  }

  if (name === "create_palace") {
    const palaceName = (input.name as string)?.trim();
    if (!palaceName) return JSON.stringify({ error: "name is required" });
    const themeRaw = (input.theme as string) ?? "overworld";
    const theme = (VALID_THEMES as readonly string[]).includes(themeRaw) ? themeRaw : "overworld";
    const description = (input.description as string) ?? "";
    const { data, error } = await supabase
      .from("memory_palaces")
      .insert({
        name: palaceName,
        theme,
        description,
        data: { width: 24, height: 16, rooms: [], objects: [] },
      })
      .select("id")
      .single();
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, palace_id: (data as { id: string }).id, name: palaceName, theme });
  }

  if (name === "add_palace_room") {
    const palaceId = input.palace_id as string;
    if (!palaceId) return JSON.stringify({ error: "palace_id is required" });
    const { data: row, error: lErr } = await supabase
      .from("memory_palaces").select("id, data").eq("id", palaceId).maybeSingle();
    if (lErr) return JSON.stringify({ error: lErr.message });
    if (!row) return JSON.stringify({ error: "palace not found" });
    const palace = row as { id: string; data: PalaceData };
    const palette = ["#7DD3FC","#86EFAC","#FCD34D","#FCA5A5","#C4B5FD","#FDBA74"];
    const idx = palace.data.rooms.length;
    const room: PalaceRoom = {
      id: genId("room"),
      name: (input.name as string) ?? `Room ${idx + 1}`,
      description: (input.description as string) ?? "",
      x: typeof input.x === "number" ? input.x : 1 + (idx % 3) * 7,
      y: typeof input.y === "number" ? input.y : 1 + Math.floor(idx / 3) * 5,
      width: typeof input.width === "number" ? input.width : 6,
      height: typeof input.height === "number" ? input.height : 4,
      color: (input.color as string) ?? palette[idx % palette.length],
    };
    palace.data.rooms.push(room);
    const { error } = await supabase
      .from("memory_palaces")
      .update({ data: palace.data, updated_at: new Date().toISOString() })
      .eq("id", palaceId);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, room_id: room.id, name: room.name });
  }

  if (name === "add_palace_memory") {
    const palaceId = input.palace_id as string;
    const memName = (input.name as string)?.trim();
    const content = (input.content as string) ?? "";
    if (!palaceId || !memName) return JSON.stringify({ error: "palace_id and name required" });
    const { data: row, error: lErr } = await supabase
      .from("memory_palaces").select("id, data").eq("id", palaceId).maybeSingle();
    if (lErr) return JSON.stringify({ error: lErr.message });
    if (!row) return JSON.stringify({ error: "palace not found" });
    const palace = row as { id: string; data: PalaceData };
    const iconRaw = (input.icon as string) ?? "chest";
    const icon = (VALID_ICONS as readonly string[]).includes(iconRaw) ? iconRaw : "chest";
    const color = (input.color as string) ?? "#06B6D4";
    let roomId: string | undefined;
    const roomName = (input.room_name as string)?.trim().toLowerCase();
    if (roomName) {
      const r = palace.data.rooms.find((r) => r.name.toLowerCase() === roomName);
      if (r) roomId = r.id;
    }
    let x = typeof input.x === "number" ? input.x : undefined;
    let y = typeof input.y === "number" ? input.y : undefined;
    if (x == null || y == null) {
      const room = roomId ? palace.data.rooms.find((r) => r.id === roomId) : palace.data.rooms[0];
      if (room) {
        const taken = new Set(
          palace.data.objects.filter((o) => o.roomId === room.id).map((o) => `${o.x},${o.y}`)
        );
        outer: for (let oy = room.y + 1; oy < room.y + room.height - 1; oy++) {
          for (let ox = room.x + 1; ox < room.x + room.width - 1; ox++) {
            if (!taken.has(`${ox},${oy}`)) { x = ox; y = oy; break outer; }
          }
        }
      }
      if (x == null || y == null) {
        x = Math.min(palace.data.width - 2, 2 + (palace.data.objects.length % (palace.data.width - 4)));
        y = Math.min(palace.data.height - 2, 2 + Math.floor(palace.data.objects.length / (palace.data.width - 4)));
      }
    }
    const obj: PalaceObject = {
      id: genId("mem"),
      name: memName,
      content,
      x, y, icon, color,
      roomId,
      link: typeof input.link === "string" && input.link ? input.link : undefined,
    };
    palace.data.objects.push(obj);
    const { error } = await supabase
      .from("memory_palaces")
      .update({ data: palace.data, updated_at: new Date().toISOString() })
      .eq("id", palaceId);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, object_id: obj.id, name: obj.name, x, y, icon });
  }

  if (name === "update_palace_memory") {
    const palaceId = input.palace_id as string;
    const objectId = input.object_id as string;
    if (!palaceId || !objectId) return JSON.stringify({ error: "palace_id and object_id required" });
    const { data: row, error: lErr } = await supabase
      .from("memory_palaces").select("id, data").eq("id", palaceId).maybeSingle();
    if (lErr) return JSON.stringify({ error: lErr.message });
    if (!row) return JSON.stringify({ error: "palace not found" });
    const palace = row as { id: string; data: PalaceData };
    const obj = palace.data.objects.find((o) => o.id === objectId);
    if (!obj) return JSON.stringify({ error: "memory object not found" });
    if (typeof input.name === "string") obj.name = input.name;
    if (typeof input.content === "string") obj.content = input.content;
    if (typeof input.icon === "string" && (VALID_ICONS as readonly string[]).includes(input.icon)) {
      obj.icon = input.icon;
    }
    if (typeof input.color === "string") obj.color = input.color;
    if (typeof input.x === "number") obj.x = input.x;
    if (typeof input.y === "number") obj.y = input.y;
    if (typeof input.link === "string") obj.link = input.link || undefined;
    // Re-link to a room based on new coords.
    const inRoom = palace.data.rooms.find(
      (r) => obj.x >= r.x && obj.x < r.x + r.width && obj.y >= r.y && obj.y < r.y + r.height
    );
    obj.roomId = inRoom?.id;
    const { error } = await supabase
      .from("memory_palaces")
      .update({ data: palace.data, updated_at: new Date().toISOString() })
      .eq("id", palaceId);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, object_id: objectId });
  }

  if (name === "delete_palace_memory") {
    const palaceId = input.palace_id as string;
    const objectId = input.object_id as string;
    if (!palaceId || !objectId) return JSON.stringify({ error: "palace_id and object_id required" });
    const { data: row, error: lErr } = await supabase
      .from("memory_palaces").select("id, data").eq("id", palaceId).maybeSingle();
    if (lErr) return JSON.stringify({ error: lErr.message });
    if (!row) return JSON.stringify({ error: "palace not found" });
    const palace = row as { id: string; data: PalaceData };
    palace.data.objects = palace.data.objects.filter((o) => o.id !== objectId);
    const { error } = await supabase
      .from("memory_palaces")
      .update({ data: palace.data, updated_at: new Date().toISOString() })
      .eq("id", palaceId);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, object_id: objectId });
  }

  if (name === "search_palace_memories") {
    const q = ((input.query as string) ?? "").trim().toLowerCase();
    if (!q) return JSON.stringify({ error: "query is required" });
    const { data, error } = await supabase
      .from("memory_palaces")
      .select("id, name, data")
      .eq("archived", false);
    if (error) return JSON.stringify({ error: error.message });
    const hits: Array<{ palace_id: string; palace: string; object_id: string; name: string; snippet: string; icon: string; room: string | null }> = [];
    for (const row of (data ?? []) as Array<{ id: string; name: string; data: PalaceData }>) {
      const roomById = new Map<string, string>();
      for (const r of row.data.rooms ?? []) roomById.set(r.id, r.name);
      for (const o of row.data.objects ?? []) {
        const hay = `${o.name}\n${o.content}`.toLowerCase();
        if (hay.includes(q)) {
          const snippet = o.content.length > 140 ? o.content.slice(0, 140) + "…" : o.content;
          hits.push({
            palace_id: row.id, palace: row.name,
            object_id: o.id, name: o.name, snippet,
            icon: o.icon,
            room: o.roomId ? roomById.get(o.roomId) ?? null : null,
          });
        }
      }
    }
    return JSON.stringify({ query: q, count: hits.length, hits });
  }

  // ─── Review ─────────────────────────────────────────────────────────
  if (name === "get_review_context") {
    const rawDays = Number(input.days_back ?? 7);
    const days = Math.min(Math.max(Number.isFinite(rawDays) ? Math.round(rawDays) : 7, 1), 30);
    const end = todayISO();
    const start = shiftIsoDate(end, -days + 1);
    const cap = <T,>(arr: T[]): T[] => (arr.length > 50 ? arr.slice(0, 50) : arr);

    // Tasks across all pages.
    const completed: Array<{ page: string; group: string; text: string; due?: string }> = [];
    const pinned: Array<{ page: string; group: string; text: string; due?: string }> = [];
    const overdue: Array<{ page: string; group: string; text: string; due: string }> = [];
    const dueInWindow: Array<{ page: string; group: string; text: string; due: string }> = [];
    const { data: pages, error: pErr } = await supabase
      .from("todo_lists")
      .select("id, name, data");
    if (pErr) return JSON.stringify({ error: pErr.message });
    for (const row of (pages ?? []) as PageRow[]) {
      for (const g of allGroups(row.data ?? { groups: [], blocks: [] })) {
        for (const it of g.items ?? []) {
          if (it.archived) continue;
          const text = stripHtml(it.text);
          if (!text) continue;
          if (it.completed) {
            completed.push({ page: row.name, group: g.name, text, due: it.dueDate });
            continue;
          }
          if (it.pinned) pinned.push({ page: row.name, group: g.name, text, due: it.dueDate });
          if (it.dueDate) {
            if (it.dueDate < end) overdue.push({ page: row.name, group: g.name, text, due: it.dueDate });
            else if (it.dueDate >= end && it.dueDate <= shiftIsoDate(end, days)) {
              dueInWindow.push({ page: row.name, group: g.name, text, due: it.dueDate });
            }
          }
        }
      }
    }

    // Journal entries in window.
    const { data: journalRows, error: jErr } = await supabase
      .from("journal_entries")
      .select("date, forward, blockers, tomorrow")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });
    const journal = (jErr ? [] : (journalRows ?? [])) as Array<{
      date: string; forward: string; blockers: string; tomorrow: string;
    }>;

    // Goals updated in window.
    const { data: goalRows } = await supabase
      .from("goals")
      .select("id, title, body, updated_at, archived")
      .eq("archived", false)
      .gte("updated_at", `${start}T00:00:00Z`)
      .order("updated_at", { ascending: false });
    const goalsUpdated = ((goalRows ?? []) as Array<{ id: string; title: string; body: string; updated_at: string }>).map(
      (g) => {
        const txt = stripHtml(g.body ?? "");
        return { id: g.id, title: g.title, snippet: txt.length > 200 ? txt.slice(0, 200) + "…" : txt, updated_at: g.updated_at };
      }
    );

    // Recent daily insights.
    const { data: insightRows } = await supabase
      .from("daily_insights")
      .select("date, insight_data")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });
    const insights = ((insightRows ?? []) as Array<{ date: string; insight_data: Record<string, unknown> }>).map(
      (row) => {
        const d = row.insight_data ?? {};
        return {
          date: row.date,
          concept: typeof d.concept === "string" ? d.concept : "",
          lesson: typeof d.lesson === "string" ? d.lesson : "",
        };
      }
    );

    // Palaces touched in window.
    const { data: palaceRows } = await supabase
      .from("memory_palaces")
      .select("id, name, theme, data, updated_at")
      .eq("archived", false)
      .gte("updated_at", `${start}T00:00:00Z`)
      .order("updated_at", { ascending: false });
    const palacesTouched = ((palaceRows ?? []) as PalaceRow[]).map((p) => ({
      id: p.id,
      name: p.name,
      theme: p.theme,
      rooms: p.data?.rooms?.length ?? 0,
      memories: p.data?.objects?.length ?? 0,
      updated_at: p.updated_at,
    }));

    return JSON.stringify({
      range: { start, end, days },
      counts: {
        completed_tasks: completed.length,
        pinned_tasks: pinned.length,
        overdue_tasks: overdue.length,
        due_in_window: dueInWindow.length,
        journal_entries: journal.length,
        goals_updated: goalsUpdated.length,
        insights: insights.length,
        palaces_touched: palacesTouched.length,
      },
      tasks: {
        completed: cap(completed),
        pinned: cap(pinned),
        overdue: cap(overdue),
        due_in_window: cap(dueInWindow),
      },
      journal: cap(journal),
      goals_updated: cap(goalsUpdated),
      insights: cap(insights),
      palaces_touched: cap(palacesTouched),
    });
  }

  // ─── Skills (progressive disclosure) ────────────────────────────────
  if (name === "load_skill") {
    const slug = ((input.name as string) ?? "").trim();
    if (!slug) return JSON.stringify({ error: "name is required" });
    const skill = SKILLS_BY_SLUG.get(slug);
    if (!skill) {
      return JSON.stringify({
        error: `unknown skill '${slug}'`,
        available: SKILLS.map((s) => s.slug),
      });
    }
    return JSON.stringify({ name: skill.slug, body: skill.body });
  }

  return JSON.stringify({ error: `unknown tool: ${name}` });
}

// ─── Conversation persistence ──────────────────────────────────────────
async function getOrCreateConversation(
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const { data: existing } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", USER_ID)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: USER_ID })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "failed to create conversation");
  return created.id as string;
}

type StoredMessage = {
  role: "user" | "assistant";
  content: unknown;
  sequence: number;
};

async function loadMessages(
  supabase: ReturnType<typeof createClient>,
  conversationId: string
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("role, content, sequence")
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StoredMessage[];
}

async function appendMessages(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  startSeq: number,
  msgs: Array<{ role: "user" | "assistant"; content: unknown }>
) {
  if (msgs.length === 0) return;
  const rows = msgs.map((m, i) => ({
    conversation_id: conversationId,
    sequence: startSeq + i,
    role: m.role,
    content: m.content,
  }));
  const { error } = await supabase.from("ai_messages").insert(rows);
  if (error) throw new Error(error.message);
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

// ─── Handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!apiKey || !supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing env (ANTHROPIC_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_message, active_page_id, active_view } = await req.json();
    if (!user_message || typeof user_message !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'user_message'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const anthropic = new Anthropic({ apiKey });

    // Load / create conversation and prior messages.
    const conversationId = await getOrCreateConversation(supabase);
    const prior = await loadMessages(supabase, conversationId);
    let nextSeq = prior.length > 0 ? prior[prior.length - 1].sequence + 1 : 0;

    // Build active-context for the system prompt.
    let activeBlock = "";
    const today = todayISO();
    const viewLabel = typeof active_view === "string" && active_view ? active_view : "unknown";
    activeBlock += `\n\n─── ACTIVE CONTEXT ───\nDate: ${today}\nCurrent view: ${viewLabel}`;

    if (active_page_id) {
      const { data: pageRow } = await supabase
        .from("todo_lists")
        .select("id, name, data, updated_at")
        .eq("id", active_page_id)
        .maybeSingle();
      if (pageRow) {
        activeBlock += `\n\n${serializePage(pageRow as PageRow)}`;
      }
    } else if (viewLabel === "journal") {
      const { data: je } = await supabase
        .from("journal_entries")
        .select("date, forward, blockers, tomorrow")
        .eq("date", today)
        .maybeSingle();
      activeBlock += je
        ? `\n\nToday's journal entry:\n- forward: ${je.forward}\n- blockers: ${je.blockers}\n- tomorrow: ${je.tomorrow}`
        : "\n\nToday's journal entry: (empty)";
    } else if (viewLabel === "goals") {
      const { data: gs } = await supabase
        .from("goals")
        .select("id, title, body")
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (gs && gs.length) {
        const lines = (gs as Array<{ id: string; title: string; body: string }>).map(
          (g) => `- ${g.title} (id: ${g.id})${g.body ? ` — ${stripHtml(g.body).slice(0, 120)}` : ""}`
        );
        activeBlock += `\n\nActive goals:\n${lines.join("\n")}`;
      } else {
        activeBlock += "\n\nActive goals: (none)";
      }
    } else if (viewLabel === "today") {
      activeBlock += "\n\n(User is viewing the Today briefing — feel free to call get_today_briefing to ground answers.)";
    } else if (viewLabel === "palaces") {
      const { data: ps } = await supabase
        .from("memory_palaces")
        .select("id, name, theme, data")
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(8);
      if (ps && ps.length) {
        const lines = (ps as Array<{ id: string; name: string; theme: string; data: PalaceData }>).map(
          (p) => `- ${p.name} (${p.theme}, id: ${p.id}) — ${p.data?.rooms?.length ?? 0} rooms, ${p.data?.objects?.length ?? 0} memories`
        );
        activeBlock += `\n\nMemory palaces:\n${lines.join("\n")}\n\n(Call get_palace for the full layout, or search_palace_memories to find a stored memory.)`;
      } else {
        activeBlock += "\n\nMemory palaces: (none yet — offer to create one when the user wants to start remembering things spatially.)";
      }
    } else {
      activeBlock += "\n\n(No active page — call list_pages / list_goals / etc. as needed.)";
    }
    activeBlock += "\n─── END ACTIVE CONTEXT ───";

    // Registered Skills — triggers only (progressive disclosure). The assistant
    // calls load_skill(name) to fetch the full procedure once a trigger matches.
    let skillsBlock = "";
    if (SKILLS.length > 0) {
      const lines = SKILLS.map((s) => `- ${s.slug} — ${s.description}`);
      skillsBlock = `\n\n─── REGISTERED SKILLS ───\n${lines.join("\n")}\n─── END SKILLS ───`;
    }
    const system = SYSTEM_PROMPT + skillsBlock + activeBlock;

    // Build message array: prior history + new user turn.
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
      ...prior.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: user_message },
    ];

    const toPersist: Array<{ role: "user" | "assistant"; content: unknown }> = [
      { role: "user", content: user_message },
    ];

    let finalText = "";
    const toolCallsUsed: Array<{ name: string; input: Record<string, unknown>; ok: boolean; error?: string }> = [];

    // Tool-use loop.
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: TOOLS,
        // deno-lint-ignore no-explicit-any
        messages: messages as any,
      });

      // Persist the assistant turn (raw content blocks).
      messages.push({ role: "assistant", content: response.content });
      toPersist.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((b) => b.type === "text");
        finalText = textBlock && textBlock.type === "text" ? textBlock.text : "";
        break;
      }

      // Execute each tool_use block and build a single tool_result user turn.
      const toolUses = response.content.filter((b) => b.type === "tool_use");
      const toolResults = [];
      for (const tu of toolUses) {
        if (tu.type !== "tool_use") continue;
        const toolInput = (tu.input ?? {}) as Record<string, unknown>;
        const result = await runTool(supabase, tu.name, toolInput);
        let ok = true;
        let errMsg: string | undefined;
        try {
          const parsed = JSON.parse(result);
          if (parsed && typeof parsed === "object" && "error" in parsed) {
            ok = false;
            errMsg = String(parsed.error);
          }
        } catch {
          // result wasn't JSON (e.g. serializePage markdown) — treat as success.
        }
        toolCallsUsed.push({ name: tu.name, input: toolInput, ok, error: errMsg });
        toolResults.push({
          type: "tool_result" as const,
          tool_use_id: tu.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
      toPersist.push({ role: "user", content: toolResults });
    }

    if (!finalText) {
      finalText = "(No response — tool loop exceeded max iterations.)";
    }

    await appendMessages(supabase, conversationId, nextSeq, toPersist);

    const TASK_MUTATIONS = [
      "create_task", "update_task", "archive_task", "delete_task", "reorder_tasks",
      "link_task_to_goal", "unlink_task_from_goal",
    ];
    const GOAL_MUTATIONS = ["create_goal", "update_goal", "archive_goal"];
    const JOURNAL_MUTATIONS = ["upsert_journal_entry"];
    const PALACE_MUTATIONS = [
      "create_palace", "add_palace_room", "add_palace_memory",
      "update_palace_memory", "delete_palace_memory",
    ];
    const mutatedDomains = {
      tasks: toolCallsUsed.some((t) => t.ok && TASK_MUTATIONS.includes(t.name)),
      goals: toolCallsUsed.some((t) => t.ok && GOAL_MUTATIONS.includes(t.name)),
      journal: toolCallsUsed.some((t) => t.ok && JOURNAL_MUTATIONS.includes(t.name)),
      palaces: toolCallsUsed.some((t) => t.ok && PALACE_MUTATIONS.includes(t.name)),
    };
    const mutated = mutatedDomains.tasks || mutatedDomains.goals || mutatedDomains.journal || mutatedDomains.palaces;

    return new Response(
      JSON.stringify({
        text: finalText,
        conversation_id: conversationId,
        tool_calls: toolCallsUsed,
        mutated,
        mutated_domains: mutatedDomains,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
