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

const SYSTEM_PROMPT = `You are a personal learning advisor to a senior technical leader and strategist. Your job is to surface genuinely surprising, non-obvious insights — things a sharp, well-read professional would not already know.

DEPTH BAR — the insight must pass this test:
- Could a professional guess this without reading about it? → rejected
- Is it the headline takeaway on a back cover, Amazon summary, or top Google result? → rejected
- Is it a well-known idea just re-attributed? → rejected
- Would another LLM, given the same category, also produce this? → rejected
The insight should make the reader think "I never would have guessed that."

REACH FOR THE TAIL OF THE DISTRIBUTION — this is the most important rule:
You are a large language model; your default is to return the median, most-cited material in any category. That is exactly what the reader does NOT want. You must deliberately reach past the obvious into the long tail. Concretely:

- AVOID the saturated pop-science canon unless the specific finding you are surfacing is genuinely buried (NOT the headline thesis):
  Kahneman, Walker (Why We Sleep), Duhigg, Cialdini, Clear (Atomic Habits), the Heath brothers, Sinek, Newport, Pink, Grant, Gladwell, Ariely, Dweck, Brené Brown, Covey, Goleman, Sutherland, Ferriss, Robbins, Lencioni. If you find yourself reaching for one of these, stop and pick something else.
- PREFER under-mined sources: academic monographs, primary-research books from university presses, foreign-language authors in translation (Japanese, German, French, Eastern European management/philosophy traditions), older classics (1950s-1980s organisational research, military doctrine, intelligence-community tradecraft), industry-specific operations literature, niche biographies of operators and craftspeople, ethnographies, post-mortem reports from accident investigation boards.
- YOU DO NOT HAVE TO CITE A BOOK. If a fresh, non-obvious idea comes from synthesis across fields, primary research, a documented case study, an obscure paper, an organisational practice (e.g. Toyota, Pixar, Bell Labs, NASA, US Navy nuclear programme, particular trading firms), or your own reasoned synthesis of patterns across domains, that is welcome — set source_type to "research" or "synthesis" and leave book/author empty.
- VARY ERA AND CULTURE: don't always reach for 2010s American non-fiction. A given week's insights should span different decades, traditions, and disciplines.

WRITING STYLE — equally important:
- Write like a brilliant friend explaining something over coffee, not a scientist writing a paper
- No jargon. If a mechanism is involved, explain it in one plain sentence a non-expert immediately understands
- The practical "so what" must be front and centre — not buried at the end of technical detail
- Every sentence should feel like it's talking to the reader, not at them
- If you catch yourself writing words like "cytochrome", "upregulation", "transcription factor", "ROS", or similar — stop and rewrite in plain English

The reader leads technical teams, makes high-stakes decisions, manages stakeholders, and wants to perform at their best. Insights that connect to leadership, decision quality, communication, energy, or execution are especially valuable — but the surprise must come from a non-obvious source, not from re-stating advice the reader has already heard ten times.

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

    const { date, history } = await req.json();
    if (!date || typeof date !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'date' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const category = categoryForDate(date);
    const client = new Anthropic({ apiKey });

    // Build deduplicated avoid-lists from prior insights — books AND concepts.
    const historyArr: Array<{ book?: string; author?: string; concept?: string }> =
      Array.isArray(history) ? history : [];
    const seenBooks = new Set<string>();
    const seenConcepts = new Set<string>();
    const bookLines: string[] = [];
    const conceptLines: string[] = [];
    for (const h of historyArr) {
      const book = (h?.book ?? "").trim();
      const author = (h?.author ?? "").trim();
      const concept = (h?.concept ?? "").trim();
      if (book) {
        const key = `${book.toLowerCase()}|${author.toLowerCase()}`;
        if (!seenBooks.has(key)) {
          seenBooks.add(key);
          bookLines.push(author ? `- "${book}" by ${author}` : `- "${book}"`);
        }
      }
      if (concept) {
        const ckey = concept.toLowerCase();
        if (!seenConcepts.has(ckey)) {
          seenConcepts.add(ckey);
          conceptLines.push(`- ${concept}`);
        }
      }
    }
    const bookAvoid = bookLines.length
      ? `\n\nBOOKS ALREADY USED — do NOT pick any of these (even for a different finding):\n${bookLines.join("\n")}`
      : "";
    const conceptAvoid = conceptLines.length
      ? `\n\nFINDINGS ALREADY COVERED — do NOT restate any of these, even sourced from a different book or framed differently. The point is to bring a fresh idea, not the same idea wearing a new coat:\n${conceptLines.join("\n")}`
      : "";
    const avoidBlock = bookAvoid + conceptAvoid;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Today is ${date}. Generate a daily insight in the category: ${category}.

Surface a surprising, non-obvious finding — something most well-read professionals would NOT have already encountered. Then explain it in plain, direct language. The source can be a book, a piece of primary research, an organisational case study, or your own reasoned synthesis across fields. What matters is that the IDEA sits in the long tail of what an LLM would normally produce for this category — not the median.${avoidBlock}

Tone target — specific, surprising, and a smart teenager could follow it. Examples of the shape I want (do NOT reuse these specific findings or sources — they're for tone calibration only):
- "In post-mortems of US Navy nuclear submarine incidents, the variable that most predicted whether a junior officer's warning got heard wasn't seniority — it was whether the officer named the specific consequence within the first eight words. 'We could lose reactor coolant' got acted on; 'I'm worried about the trend' did not, even with identical underlying data."
- "The researcher who set up Toyota's first Western plant noticed that the workers who pulled the andon cord most often were not the most capable — they were the ones whose first manager had personally thanked them for stopping the line in their first week. The behaviour was set permanently in week one and almost impossible to install later."

Notice these don't come from famous pop-science books. They are specific, mechanistic, and named. That's the bar.

Return a single JSON object. Use book/author ONLY if the insight genuinely comes from a specific book; otherwise leave them empty strings and use source_type accordingly:
{
  "source_type": "book" | "research" | "synthesis",
  "book": "exact published title, or empty string if not a book",
  "author": "First Last, or empty string if not a book",
  "source": "if not a book: short attribution e.g. 'NASA Apollo 13 post-mortem', 'Toyota Production System internal training', 'synthesis across X and Y research', or empty string",
  "category": "${category}",
  "concept": "the surprising idea in plain English, 8-12 words — no jargon",
  "lesson": "one sentence: what to do differently starting tomorrow, written plainly (max 35 words)",
  "why_it_matters": "2 plain-English sentences: what's surprising about this and why it changes how you should think or act at work",
  "long_summary": "3-4 sentences in plain English: the finding, why it's counterintuitive, a concrete example, and one specific thing to try this week"
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

    const required = ["concept", "lesson"];
    const missing = required.filter((k) => !parsed[k]);
    if (missing.length > 0) {
      throw new Error(`Insight missing required fields: ${missing.join(", ")}`);
    }
    // Ensure source_type is sensible. If book is provided, force "book".
    if (parsed.book && parsed.book.trim().length > 0) {
      parsed.source_type = "book";
    } else if (!parsed.source_type) {
      parsed.source_type = "synthesis";
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
