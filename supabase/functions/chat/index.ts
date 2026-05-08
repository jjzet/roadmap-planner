// AI chat edge function.
// Tools span the user's productivity surface: pages/tasks, goals, journal,
// and memory palaces. Active view context is folded into the system prompt so
// the model can answer most questions without a tool call.
//
// Request:  { user_message: string, active_page_id?: string | null, active_view?: string | null }
// Response: { text, conversation_id, tool_calls, mutated }
//
// Deploy: supabase functions deploy chat

import Anthropic from "npm:@anthropic-ai/sdk@^0.82.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const USER_ID = "default";
const MODEL = "claude-opus-4-6";
const MAX_TOOL_ITERATIONS = 10;
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are an action-oriented assistant embedded in a personal productivity app for a senior technical leader.

Your job is to help the user move work forward — not just describe it. When the user asks for something that maps to a tool, do it. When they ask a question, answer it from context first; only reach for tools when context is insufficient.

Surfaces you can act on:
- PAGES: task lists and free-form blocks (text/heading/divider). Tools: list_pages, get_page, create_page, create_task, update_task, archive_task, delete_task, reorder_tasks.
- GOALS: short-form goal cards. Tools: list_goals, create_goal, update_goal, archive_goal.
- JOURNAL: one entry per date with three prompts (forward, blockers, tomorrow). Tools: get_journal_entry, list_recent_journal, upsert_journal_entry.
- MEMORY PALACES: 2D mnemonic maps with rooms and objects (each object carries a memory note). Tools: list_palaces, get_palace, create_palace, add_palace_room, add_palace_object, update_palace_object.

Operating principles:
- Prefer one decisive action over five clarifying questions. If a request is ambiguous, make a reasonable choice and explain it briefly afterwards.
- Favour archive over delete for tasks and goals. Confirm before deleting many items at once.
- For journal work: when the user asks to summarise their day or week, READ first (list_recent_journal or get_journal_entry), draft the summary inline, and offer to save the result back into the relevant date's entry — don't write without explicit consent.
- For memory palace work: when the user wants to memorise a concept, propose a sensible spatial layout (a room per theme, an object per item) before placing anything, and use evocative emoji sprites.
- For text-style requests like "add a note about X", append a text block to the active page rather than creating a task.
- Keep replies concise and conversational. Cite item text when you act, not raw IDs.`;

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
};

type PageBlock =
  | { type: "group"; data: TodoGroup }
  | { type: "text"; data: { id: string; content: string; order: number } }
  | { type: "heading"; data: { id: string; content: string; level: number; order: number } }
  | { type: "divider"; data: { id: string; order: number } }
  | { type: "goal_card"; data: { id: string; goalId: string; order: number } };

type JournalRow = {
  id: string;
  date: string;
  forward: string;
  blockers: string;
  tomorrow: string;
};

type PalaceRoom = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  note?: string;
};

type PalaceObject = {
  id: string;
  x: number;
  y: number;
  sprite: string;
  label: string;
  note: string;
  roomId?: string;
};

type PalaceRow = {
  id: string;
  name: string;
  description: string;
  theme: string;
  grid_width: number;
  grid_height: number;
  rooms: PalaceRoom[];
  objects: PalaceObject[];
  updated_at: string;
};

// ─── Page serialization ────────────────────────────────────────────────
function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

function serializePage(page: PageRow): string {
  const lines: string[] = [];
  lines.push(`# Page: ${page.name} (id: ${page.id})`);
  lines.push("");

  const blocks = page.data?.blocks ?? [];
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
  // Pages
  {
    name: "list_pages",
    description:
      "List all non-archived pages (task lists / text pages). Returns id, name, and last-updated timestamp.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_page",
    description:
      "Fetch the full content of a page by id, serialized as readable text with task IDs preserved.",
    input_schema: {
      type: "object" as const,
      properties: { page_id: { type: "string" } },
      required: ["page_id"],
    },
  },
  {
    name: "create_page",
    description:
      "Create a new page (task list / notes). Returns the new page id. The page starts with one empty task group so create_task is immediately usable.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Display name of the page" },
        first_group_name: { type: "string", description: "Name of the initial task group (default: 'Tasks')" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_task",
    description: "Add a new task to a task-list group on a page. Returns the new task id.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        group_id: { type: "string", description: "The task list (group) id" },
        text: { type: "string", description: "Plain text" },
        due_date: { type: "string", description: "YYYY-MM-DD (optional)" },
        pinned: { type: "boolean" },
        notes: { type: "string" },
        sub_group_id: { type: "string" },
      },
      required: ["page_id", "group_id", "text"],
    },
  },
  {
    name: "update_task",
    description:
      "Update fields on an existing task. Only provided fields change; omitted fields are left alone.",
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
      },
      required: ["page_id", "task_id"],
    },
  },
  {
    name: "archive_task",
    description: "Archive a task (soft-hide). Preferred over delete_task.",
    input_schema: {
      type: "object" as const,
      properties: { page_id: { type: "string" }, task_id: { type: "string" } },
      required: ["page_id", "task_id"],
    },
  },
  {
    name: "delete_task",
    description: "Permanently delete a task. Confirm first unless user is explicit.",
    input_schema: {
      type: "object" as const,
      properties: { page_id: { type: "string" }, task_id: { type: "string" } },
      required: ["page_id", "task_id"],
    },
  },
  {
    name: "reorder_tasks",
    description:
      "Reorder tasks within a group. Provide the full ordered list of task ids; orders are reassigned 0..N.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string" },
        group_id: { type: "string" },
        ordered_task_ids: { type: "array", items: { type: "string" } },
      },
      required: ["page_id", "group_id", "ordered_task_ids"],
    },
  },
  // Goals
  {
    name: "list_goals",
    description: "List all non-archived goals with title and body excerpt.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "create_goal",
    description: "Create a new goal with a title and optional body.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        body: { type: "string", description: "Optional HTML or plain text body" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_goal",
    description: "Update a goal's title and/or body.",
    input_schema: {
      type: "object" as const,
      properties: {
        goal_id: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
      },
      required: ["goal_id"],
    },
  },
  {
    name: "archive_goal",
    description: "Archive a goal (soft-hide).",
    input_schema: {
      type: "object" as const,
      properties: { goal_id: { type: "string" } },
      required: ["goal_id"],
    },
  },
  // Journal
  {
    name: "get_journal_entry",
    description: "Fetch the journal entry for a specific date (YYYY-MM-DD).",
    input_schema: {
      type: "object" as const,
      properties: { date: { type: "string" } },
      required: ["date"],
    },
  },
  {
    name: "list_recent_journal",
    description: "List recent journal entries (newest first). Default limit 7.",
    input_schema: {
      type: "object" as const,
      properties: { limit: { type: "number" } },
      required: [],
    },
  },
  {
    name: "upsert_journal_entry",
    description:
      "Create or replace a journal entry for a date. Use to save a summary the user has approved. Empty strings clear that prompt.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        forward: { type: "string", description: "How did I move forward?" },
        blockers: { type: "string", description: "What got in the way?" },
        tomorrow: { type: "string", description: "Tomorrow's one thing" },
      },
      required: ["date"],
    },
  },
  // Memory palaces
  {
    name: "list_palaces",
    description: "List the user's memory palaces with id, name, theme, and dimensions.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_palace",
    description: "Fetch the full content of a palace including rooms and objects.",
    input_schema: {
      type: "object" as const,
      properties: { palace_id: { type: "string" } },
      required: ["palace_id"],
    },
  },
  {
    name: "create_palace",
    description:
      "Create a new memory palace. Themes: forest, dungeon, castle, beach, space. Default grid is 16×12.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        theme: { type: "string", description: "forest | dungeon | castle | beach | space" },
        description: { type: "string" },
        grid_width: { type: "number" },
        grid_height: { type: "number" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_palace_room",
    description:
      "Add a room to a palace. (x, y) is the top-left tile; w/h are tile dimensions. Rooms group related memories — name them after themes.",
    input_schema: {
      type: "object" as const,
      properties: {
        palace_id: { type: "string" },
        name: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        w: { type: "number" },
        h: { type: "number" },
        color: { type: "string", description: "Hex like #7c5e3c" },
        note: { type: "string" },
      },
      required: ["palace_id", "name", "x", "y", "w", "h"],
    },
  },
  {
    name: "add_palace_object",
    description:
      "Place a memory object on a tile. The sprite should be a single emoji that evokes the concept. The note explains what it stands for.",
    input_schema: {
      type: "object" as const,
      properties: {
        palace_id: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        sprite: { type: "string" },
        label: { type: "string" },
        note: { type: "string" },
        room_id: { type: "string" },
      },
      required: ["palace_id", "x", "y", "sprite", "label"],
    },
  },
  {
    name: "update_palace_object",
    description: "Update the label, sprite or note on an existing palace object.",
    input_schema: {
      type: "object" as const,
      properties: {
        palace_id: { type: "string" },
        object_id: { type: "string" },
        sprite: { type: "string" },
        label: { type: "string" },
        note: { type: "string" },
      },
      required: ["palace_id", "object_id"],
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

async function persistPalace(
  supabase: ReturnType<typeof createClient>,
  palaceId: string,
  patch: Record<string, unknown>
): Promise<string | null> {
  const { error } = await supabase
    .from("memory_palaces")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", palaceId);
  return error?.message ?? null;
}

async function loadPalace(
  supabase: ReturnType<typeof createClient>,
  palaceId: string
): Promise<{ palace: PalaceRow | null; error?: string }> {
  const { data, error } = await supabase
    .from("memory_palaces")
    .select("*")
    .eq("id", palaceId)
    .maybeSingle();
  if (error) return { palace: null, error: error.message };
  if (!data) return { palace: null, error: "palace not found" };
  return { palace: data as PalaceRow };
}

async function runTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  // ── Pages ────────────────────────────────────────────────────────────
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

  if (name === "create_page") {
    const pageName = (input.name as string) ?? "";
    if (!pageName.trim()) return JSON.stringify({ error: "name required" });
    const groupName = (input.first_group_name as string) || "Tasks";
    const groupId = genId("group");
    const data: TodoData = {
      blocks: [
        {
          type: "group",
          data: { id: groupId, name: groupName, items: [], subGroups: [], order: 0 } as TodoGroup & { order: number },
        },
      ],
      groups: [],
    };
    const { data: row, error } = await supabase
      .from("todo_lists")
      .insert({ name: pageName.trim(), data })
      .select("id, name")
      .single();
    if (error || !row) return JSON.stringify({ error: error?.message ?? "create failed" });
    return JSON.stringify({ ok: true, page_id: row.id, name: row.name, group_id: groupId });
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
      text,
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
    const extras = items.filter((it) => !ordered.includes(it.id));
    extras.forEach((it, idx) => (it.order = ordered.length + idx));

    const saveErr = await savePageData(supabase, pageId, page.data);
    if (saveErr) return JSON.stringify({ error: saveErr });
    return JSON.stringify({ ok: true, count: ordered.length });
  }

  // ── Goals ────────────────────────────────────────────────────────────
  if (name === "list_goals") {
    const { data, error } = await supabase
      .from("goals")
      .select("id, title, body, updated_at")
      .eq("archived", false)
      .order("updated_at", { ascending: false });
    if (error) return JSON.stringify({ error: error.message });
    const goals = (data ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      body_excerpt: stripHtml(g.body as string).slice(0, 240),
      updated_at: g.updated_at,
    }));
    return JSON.stringify({ goals });
  }

  if (name === "create_goal") {
    const title = (input.title as string) ?? "";
    const body = (input.body as string) ?? "";
    if (!title.trim()) return JSON.stringify({ error: "title required" });
    const { data, error } = await supabase
      .from("goals")
      .insert({ title: title.trim(), body })
      .select("id, title")
      .single();
    if (error || !data) return JSON.stringify({ error: error?.message ?? "create failed" });
    return JSON.stringify({ ok: true, goal_id: data.id });
  }

  if (name === "update_goal") {
    const goalId = input.goal_id as string;
    if (!goalId) return JSON.stringify({ error: "goal_id required" });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof input.title === "string") patch.title = input.title;
    if (typeof input.body === "string") patch.body = input.body;
    const { error } = await supabase.from("goals").update(patch).eq("id", goalId);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, goal_id: goalId });
  }

  if (name === "archive_goal") {
    const goalId = input.goal_id as string;
    if (!goalId) return JSON.stringify({ error: "goal_id required" });
    const { error } = await supabase
      .from("goals")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("id", goalId);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, goal_id: goalId });
  }

  // ── Journal ──────────────────────────────────────────────────────────
  if (name === "get_journal_entry") {
    const date = input.date as string;
    if (!date) return JSON.stringify({ error: "date required" });
    const { data, error } = await supabase
      .from("journal_entries")
      .select("date, forward, blockers, tomorrow")
      .eq("date", date)
      .maybeSingle();
    if (error) return JSON.stringify({ error: error.message });
    if (!data) return JSON.stringify({ entry: null, message: "no entry for date" });
    return JSON.stringify({ entry: data });
  }

  if (name === "list_recent_journal") {
    const limit = typeof input.limit === "number" ? input.limit : 7;
    const { data, error } = await supabase
      .from("journal_entries")
      .select("date, forward, blockers, tomorrow")
      .order("date", { ascending: false })
      .limit(limit);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ entries: data ?? [] });
  }

  if (name === "upsert_journal_entry") {
    const date = input.date as string;
    if (!date) return JSON.stringify({ error: "date required" });
    const payload = {
      date,
      forward: typeof input.forward === "string" ? input.forward : "",
      blockers: typeof input.blockers === "string" ? input.blockers : "",
      tomorrow: typeof input.tomorrow === "string" ? input.tomorrow : "",
      updated_at: new Date().toISOString(),
    };
    // If user provided no fields at all, refuse — too easy to wipe an entry.
    if (
      typeof input.forward !== "string" &&
      typeof input.blockers !== "string" &&
      typeof input.tomorrow !== "string"
    ) {
      return JSON.stringify({ error: "provide at least one of forward/blockers/tomorrow" });
    }
    // Preserve any field the caller didn't supply.
    const { data: existing } = await supabase
      .from("journal_entries")
      .select("forward, blockers, tomorrow")
      .eq("date", date)
      .maybeSingle();
    if (existing) {
      if (typeof input.forward !== "string") payload.forward = (existing as JournalRow).forward;
      if (typeof input.blockers !== "string") payload.blockers = (existing as JournalRow).blockers;
      if (typeof input.tomorrow !== "string") payload.tomorrow = (existing as JournalRow).tomorrow;
    }
    const { error } = await supabase.from("journal_entries").upsert(payload, { onConflict: "date" });
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ ok: true, date });
  }

  // ── Memory palaces ───────────────────────────────────────────────────
  if (name === "list_palaces") {
    const { data, error } = await supabase
      .from("memory_palaces")
      .select("id, name, theme, grid_width, grid_height, updated_at, rooms, objects")
      .eq("archived", false)
      .order("updated_at", { ascending: false });
    if (error) return JSON.stringify({ error: error.message });
    const palaces = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      theme: p.theme,
      grid: `${p.grid_width}×${p.grid_height}`,
      rooms: (p.rooms as PalaceRoom[] | null)?.length ?? 0,
      objects: (p.objects as PalaceObject[] | null)?.length ?? 0,
      updated_at: p.updated_at,
    }));
    return JSON.stringify({ palaces });
  }

  if (name === "get_palace") {
    const palaceId = input.palace_id as string;
    if (!palaceId) return JSON.stringify({ error: "palace_id required" });
    const { palace, error } = await loadPalace(supabase, palaceId);
    if (error || !palace) return JSON.stringify({ error: error ?? "palace not found" });
    const lines: string[] = [];
    lines.push(`# Palace: ${palace.name} (id: ${palace.id})`);
    lines.push(`Theme: ${palace.theme} · Grid: ${palace.grid_width}×${palace.grid_height}`);
    if (palace.description) lines.push(`Description: ${palace.description}`);
    lines.push("");
    lines.push("## Rooms");
    for (const r of palace.rooms ?? []) {
      lines.push(`- ${r.name} (id: ${r.id}) — at (${r.x},${r.y}), ${r.w}×${r.h}${r.note ? ` · ${r.note}` : ""}`);
    }
    lines.push("");
    lines.push("## Objects");
    for (const o of palace.objects ?? []) {
      lines.push(
        `- ${o.sprite} ${o.label} (id: ${o.id}) at (${o.x},${o.y})${o.roomId ? ` in room ${o.roomId}` : ""}${o.note ? ` — ${o.note}` : ""}`
      );
    }
    return lines.join("\n");
  }

  if (name === "create_palace") {
    const palaceName = (input.name as string) ?? "";
    if (!palaceName.trim()) return JSON.stringify({ error: "name required" });
    const themeRaw = (input.theme as string) ?? "forest";
    const theme = ["forest", "dungeon", "castle", "beach", "space"].includes(themeRaw) ? themeRaw : "forest";
    const payload = {
      name: palaceName.trim(),
      description: (input.description as string) ?? "",
      theme,
      grid_width: typeof input.grid_width === "number" ? input.grid_width : 16,
      grid_height: typeof input.grid_height === "number" ? input.grid_height : 12,
      rooms: [],
      objects: [],
    };
    const { data, error } = await supabase
      .from("memory_palaces")
      .insert(payload)
      .select("id, name")
      .single();
    if (error || !data) return JSON.stringify({ error: error?.message ?? "create failed" });
    return JSON.stringify({ ok: true, palace_id: data.id });
  }

  if (name === "add_palace_room") {
    const palaceId = input.palace_id as string;
    if (!palaceId) return JSON.stringify({ error: "palace_id required" });
    const { palace, error } = await loadPalace(supabase, palaceId);
    if (error || !palace) return JSON.stringify({ error: error ?? "palace not found" });
    const room: PalaceRoom = {
      id: genId("room"),
      name: (input.name as string) ?? "Room",
      x: Math.max(0, Math.min(palace.grid_width - 1, input.x as number)),
      y: Math.max(0, Math.min(palace.grid_height - 1, input.y as number)),
      w: Math.max(1, input.w as number),
      h: Math.max(1, input.h as number),
      color: (input.color as string) ?? "#7c5e3c",
      note: (input.note as string) ?? "",
    };
    const rooms = [...(palace.rooms ?? []), room];
    const err = await persistPalace(supabase, palaceId, { rooms });
    if (err) return JSON.stringify({ error: err });
    return JSON.stringify({ ok: true, room_id: room.id });
  }

  if (name === "add_palace_object") {
    const palaceId = input.palace_id as string;
    if (!palaceId) return JSON.stringify({ error: "palace_id required" });
    const { palace, error } = await loadPalace(supabase, palaceId);
    if (error || !palace) return JSON.stringify({ error: error ?? "palace not found" });
    const obj: PalaceObject = {
      id: genId("obj"),
      x: Math.max(0, Math.min(palace.grid_width - 1, input.x as number)),
      y: Math.max(0, Math.min(palace.grid_height - 1, input.y as number)),
      sprite: (input.sprite as string) ?? "✨",
      label: (input.label as string) ?? "",
      note: (input.note as string) ?? "",
      roomId: (input.room_id as string) || undefined,
    };
    const objects = [...(palace.objects ?? []), obj];
    const err = await persistPalace(supabase, palaceId, { objects });
    if (err) return JSON.stringify({ error: err });
    return JSON.stringify({ ok: true, object_id: obj.id });
  }

  if (name === "update_palace_object") {
    const palaceId = input.palace_id as string;
    const objectId = input.object_id as string;
    if (!palaceId || !objectId) return JSON.stringify({ error: "palace_id and object_id required" });
    const { palace, error } = await loadPalace(supabase, palaceId);
    if (error || !palace) return JSON.stringify({ error: error ?? "palace not found" });
    const objects = (palace.objects ?? []).map((o) => {
      if (o.id !== objectId) return o;
      return {
        ...o,
        ...(typeof input.sprite === "string" ? { sprite: input.sprite } : {}),
        ...(typeof input.label === "string" ? { label: input.label } : {}),
        ...(typeof input.note === "string" ? { note: input.note } : {}),
      };
    });
    const err = await persistPalace(supabase, palaceId, { objects });
    if (err) return JSON.stringify({ error: err });
    return JSON.stringify({ ok: true, object_id: objectId });
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

// ─── Context building ──────────────────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

async function buildContextBlock(
  supabase: ReturnType<typeof createClient>,
  activePageId: string | null,
  activeView: string | null
): Promise<string> {
  const parts: string[] = [];

  // Active goals — small, almost always relevant.
  const { data: goalRows } = await supabase
    .from("goals")
    .select("id, title")
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (goalRows && goalRows.length > 0) {
    parts.push("─── ACTIVE GOALS ───");
    for (const g of goalRows) {
      parts.push(`- ${g.title} (id: ${g.id})`);
    }
  }

  // Today's journal — surface so AI can summarise / reflect.
  const today = todayISO();
  const { data: todayEntry } = await supabase
    .from("journal_entries")
    .select("date, forward, blockers, tomorrow")
    .eq("date", today)
    .maybeSingle();
  if (todayEntry) {
    parts.push(`\n─── TODAY'S JOURNAL (${today}) ───`);
    if (todayEntry.forward) parts.push(`Forward: ${todayEntry.forward}`);
    if (todayEntry.blockers) parts.push(`Blockers: ${todayEntry.blockers}`);
    if (todayEntry.tomorrow) parts.push(`Tomorrow: ${todayEntry.tomorrow}`);
  } else {
    parts.push(`\n(No journal entry yet for ${today}.)`);
  }

  // View context.
  parts.push(`\n─── VIEW ───`);
  parts.push(`Current view: ${activeView ?? "unknown"}`);
  if (activePageId) {
    const { data: pageRow } = await supabase
      .from("todo_lists")
      .select("id, name, data, updated_at")
      .eq("id", activePageId)
      .maybeSingle();
    if (pageRow) {
      parts.push(`\n─── ACTIVE PAGE ───`);
      parts.push(serializePage(pageRow as PageRow));
      parts.push(`─── END ACTIVE PAGE ───`);
    }
  }

  return parts.length === 0 ? "" : "\n\n" + parts.join("\n");
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

    const conversationId = await getOrCreateConversation(supabase);
    const prior = await loadMessages(supabase, conversationId);
    const nextSeq = prior.length > 0 ? prior[prior.length - 1].sequence + 1 : 0;

    const contextBlock = await buildContextBlock(supabase, active_page_id ?? null, active_view ?? null);
    const system = SYSTEM_PROMPT + contextBlock;

    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
      ...prior.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: user_message },
    ];

    const toPersist: Array<{ role: "user" | "assistant"; content: unknown }> = [
      { role: "user", content: user_message },
    ];

    let finalText = "";
    const toolCallsUsed: Array<{ name: string; input: Record<string, unknown>; ok: boolean; error?: string }> = [];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: TOOLS,
        // deno-lint-ignore no-explicit-any
        messages: messages as any,
      });

      messages.push({ role: "assistant", content: response.content });
      toPersist.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((b) => b.type === "text");
        finalText = textBlock && textBlock.type === "text" ? textBlock.text : "";
        break;
      }

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
          // result wasn't JSON — treat as success.
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

    const MUTATING_TOOLS = new Set([
      "create_task",
      "update_task",
      "archive_task",
      "delete_task",
      "reorder_tasks",
      "create_page",
      "create_goal",
      "update_goal",
      "archive_goal",
      "upsert_journal_entry",
      "create_palace",
      "add_palace_room",
      "add_palace_object",
      "update_palace_object",
    ]);
    const mutated = toolCallsUsed.some((t) => MUTATING_TOOLS.has(t.name));
    const mutatedSurfaces = new Set<string>();
    for (const t of toolCallsUsed) {
      if (!MUTATING_TOOLS.has(t.name)) continue;
      if (t.name.startsWith("create_palace") || t.name.startsWith("add_palace") || t.name.startsWith("update_palace"))
        mutatedSurfaces.add("palace");
      else if (t.name.endsWith("_goal") || t.name === "list_goals") mutatedSurfaces.add("goals");
      else if (t.name.includes("journal")) mutatedSurfaces.add("journal");
      else mutatedSurfaces.add("page");
    }

    return new Response(
      JSON.stringify({
        text: finalText,
        conversation_id: conversationId,
        tool_calls: toolCallsUsed,
        mutated,
        mutated_surfaces: Array.from(mutatedSurfaces),
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
