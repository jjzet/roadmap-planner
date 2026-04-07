import Anthropic from "npm:@anthropic-ai/sdk@^0.82.0";

const SYSTEM_PROMPT = `You are a personal productivity assistant helping a senior technical leader tidy up their work todo list.

Analyse the list and suggest specific, concrete improvements. Be selective — only flag things that are clearly worthwhile.

Suggestion types and required fields:
- "archive": Item is completed and completedAt is more than 3 days ago, or completed with no date. No extra fields needed.
- "set_dev_status": Item text clearly implies a dev stage ("in review", "raised PR", "testing", "deployed", "merged") but devStatus doesn't match. Set newDevStatus to one of: dev, test, pr, merged.
- "set_due_date": Item mentions a concrete timeframe ("this week", "by Friday", "end of month") but has no dueDate. Set newDueDate as YYYY-MM-DD based on today's date.
- "add_tags": Item belongs to a clear topic cluster with other items. Set newTags as an array of 1-2 short lowercase strings.
- "rename": Item text is vague, ambiguous, or longer than 12 words. Set newText to a cleaner rewrite (max 12 words).
- "flag_stale": Item is incomplete, has no due date, no tags, no devStatus, and appears untouched for a long time. No extra fields needed.

Rules:
- reason: plain English, max 15 words, direct and specific
- displayBefore: current value as a short string (e.g. current text, current devStatus)
- displayAfter: proposed value as a short string (e.g. new text, new devStatus)
- Be selective. Return an empty suggestions array if the list looks clean.

Return only valid JSON matching this schema:
{
  "suggestions": [
    {
      "type": "archive" | "set_dev_status" | "set_due_date" | "add_tags" | "rename" | "flag_stale",
      "groupId": "string",
      "itemId": "string",
      "reason": "string",
      "newText": "string (optional)",
      "newDevStatus": "dev" | "test" | "pr" | "merged" (optional),
      "newDueDate": "YYYY-MM-DD (optional)",
      "newTags": ["string"] (optional),
      "displayBefore": "string (optional)",
      "displayAfter": "string (optional)"
    }
  ]
}

No markdown fences. No preamble.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { items, today } = await req.json();
    if (!items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'items' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Today is ${today}. Analyse this todo list and return suggestions.

${JSON.stringify(items, null, 2)}

Be selective. Only suggest changes that are clearly worthwhile.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
      throw new Error("No text content in response");
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
