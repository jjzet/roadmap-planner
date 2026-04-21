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

const SYSTEM_PROMPT = `You are an assistant embedded in a personal task/notes app for a senior technical leader.

Your scope is the user's PAGES only — task lists and free-form text/heading blocks on those pages. You do NOT have access to roadmap data, goals, or daily insights.

You can answer questions about the pages and help the user think. In this first version you can READ pages but cannot yet write to them — if asked to create, update, archive, or reorder anything, acknowledge the request briefly and tell the user write tools are coming next.

The user's currently active page (if any) is provided in full below. Prefer answering from that context before calling tools. Use list_pages only when the user references a different page, or asks something that spans pages.

Be concise and conversational. Plain English, no jargon. If you don't know, say so.`;

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
];

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

    const { user_message, active_page_id } = await req.json();
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

    // Build active-page context for system prompt.
    let activePageBlock = "";
    if (active_page_id) {
      const { data: pageRow } = await supabase
        .from("todo_lists")
        .select("id, name, data, updated_at")
        .eq("id", active_page_id)
        .maybeSingle();
      if (pageRow) {
        activePageBlock = `\n\n─── ACTIVE PAGE ───\n${serializePage(pageRow as PageRow)}\n─── END ACTIVE PAGE ───`;
      }
    } else {
      activePageBlock = "\n\n(No active page — user is on a non-page view.)";
    }
    const system = SYSTEM_PROMPT + activePageBlock;

    // Build message array: prior history + new user turn.
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
      ...prior.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: user_message },
    ];

    const toPersist: Array<{ role: "user" | "assistant"; content: unknown }> = [
      { role: "user", content: user_message },
    ];

    let finalText = "";

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
        const result = await runTool(
          supabase,
          tu.name,
          (tu.input ?? {}) as Record<string, unknown>
        );
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

    return new Response(
      JSON.stringify({ text: finalText, conversation_id: conversationId }),
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
