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

const SYSTEM_PROMPT = `You are an embedded productivity assistant for a senior technical leader. You take action inside the app on the user's behalf.

Your domains:
- PAGES — task lists (with groups + sub-groups) and free-form text / heading / divider / goal-card blocks. Day-to-day todos and notes live here.
- GOALS — rich-text intentions the user is working toward.
- JOURNAL — one daily reflective entry per date, with three prompts: forward (how I moved forward), blockers (what got in the way), tomorrow (one focused thing).
- TODAY — an aggregated briefing of overdue / due-today / due-tomorrow tasks across all pages.

Tools you can call:
- Pages (read): list_pages, get_page
- Tasks (write): create_task, update_task, archive_task, delete_task, reorder_tasks
- Goals: list_goals, get_goal, create_goal, update_goal, archive_goal
- Journal: get_journal_entry, upsert_journal_entry, list_recent_journal_entries
- Briefing: get_today_briefing

How to behave:
- The user's active context (page or view) is provided below. Prefer answering from that context before calling tools.
- Be action-oriented: when the user asks for something tractable (capture a task, update a goal, summarise a page, draft a journal entry), do it via tools rather than only describing what they could do.
- After a successful write, confirm briefly and cite the affected text — never dump raw IDs at the user.
- Drafting work (handover summaries, status updates, journal reflections, page summaries) should be done in plain prose first; only persist via tools when the user signals "save it" / "add it" / "log it".
- For journal: when the user reflects on their day, offer to log it. Map their words sensibly to forward / blockers / tomorrow; ask before guessing if it's ambiguous.
- For goals: keep updates incremental. Use update_goal to append progress notes rather than rewriting unless asked.
- Prefer archive_task / archive_goal over delete_*. Confirm destructive actions before executing them.
- Markdown is supported in your replies. Use it sparingly — short paragraphs, lists when listing.
- Keep responses tight, plain English, no jargon. If you don't know, say so.`;

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
    } else {
      activeBlock += "\n\n(No active page — call list_pages / list_goals / etc. as needed.)";
    }
    activeBlock += "\n─── END ACTIVE CONTEXT ───";
    const system = SYSTEM_PROMPT + activeBlock;

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

    const TASK_MUTATIONS = ["create_task", "update_task", "archive_task", "delete_task", "reorder_tasks"];
    const GOAL_MUTATIONS = ["create_goal", "update_goal", "archive_goal"];
    const JOURNAL_MUTATIONS = ["upsert_journal_entry"];
    const mutatedDomains = {
      tasks: toolCallsUsed.some((t) => t.ok && TASK_MUTATIONS.includes(t.name)),
      goals: toolCallsUsed.some((t) => t.ok && GOAL_MUTATIONS.includes(t.name)),
      journal: toolCallsUsed.some((t) => t.ok && JOURNAL_MUTATIONS.includes(t.name)),
    };
    const mutated = mutatedDomains.tasks || mutatedDomains.goals || mutatedDomains.journal;

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
