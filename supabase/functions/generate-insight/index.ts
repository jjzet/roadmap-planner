import Anthropic from "npm:@anthropic-ai/sdk@^0.82.0";

const CATEGORIES = [
  "leadership",
  "communication",
  "design thinking",
  "performance",
  "decision making",
  "negotiation",
  "biohacking",
  "systems thinking",
  "habits",
  "creativity",
  "organisational culture",
];

const SYSTEM_PROMPT = `You are a personal learning advisor to a senior technical leader and strategist. Your job is to surface genuinely surprising, non-obvious insights from great books — things a sharp, well-read professional would not already know.

DEPTH BAR — the insight must pass this test:
- Could a professional guess this without reading the book? → rejected
- Is it the headline takeaway on the back cover or Amazon summary? → rejected
- Is it a well-known idea just attributed to a book? → rejected
The insight should make the reader think "I never would have guessed that."

WRITING STYLE — this is equally important:
- Write like a brilliant friend explaining something over coffee, not a scientist writing a paper
- No jargon. If a mechanism is involved, explain it in one plain sentence a non-expert immediately understands
- The practical "so what" must be front and centre — not buried at the end of technical detail
- Every sentence should feel like it's talking to the reader, not at them
- If you catch yourself writing words like "cytochrome", "upregulation", "transcription factor", "ROS", or similar — stop and rewrite in plain English

The reader leads technical teams, makes high-stakes decisions, manages stakeholders, and wants to perform at their best. Insights that connect to leadership, decision quality, communication, energy, or execution are especially valuable.

Return only valid JSON. No markdown fences. No preamble.`;

function categoryForDate(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (d.getTime() - start.getTime()) / 86_400_000
  );
  return CATEGORIES[dayOfYear % CATEGORIES.length];
}

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

    const { date } = await req.json();
    if (!date || typeof date !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'date' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const category = categoryForDate(date);
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Today is ${date}. Generate a daily book insight in the category: ${category}.

Pick a surprising, non-obvious finding from the book — something buried past the headline that most readers miss. Then explain it in plain, direct language.

Good examples of the tone and depth I want:
- "Kahneman found that experts who get fast, clear feedback (chess players, firefighters) build real intuition — but experts in slow-feedback fields (fund managers, therapists) build confidence without accuracy. The two feel identical from the inside, which means high confidence is not evidence of expertise."
- "Walker measured that after 17 hours awake your decision-making is as impaired as if you were legally drunk — yet most professionals don't track this the way they track other performance inputs."

Both are specific and surprising, but a teenager could understand them.

Return a single JSON object:
{
  "book": "exact published title",
  "author": "First Last",
  "category": "${category}",
  "concept": "the surprising idea in plain English, 8-12 words — no jargon",
  "lesson": "one sentence: what to do differently starting tomorrow, written plainly (max 35 words)",
  "why_it_matters": "2 plain-English sentences: what's surprising about this and why it changes how you should think or act at work",
  "long_summary": "3-4 sentences in plain English: the finding, why it's counterintuitive, a concrete example from the book, and one specific thing to try this week"
}`,
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

    if (!parsed.category) parsed.category = category;

    const required = ["book", "concept", "lesson"];
    const missing = required.filter((k) => !parsed[k]);
    if (missing.length > 0) {
      throw new Error(`Insight missing required fields: ${missing.join(", ")}`);
    }

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
