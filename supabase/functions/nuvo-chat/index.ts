import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are NUVO, the built-in AI assistant inside NUVORA, a global real-time messaging app. You are friendly, helpful, and concise. You help users with:
- Answering questions and explaining concepts
- Writing assistance (composing, rewriting, improving messages)
- Summarizing text
- Translating text between languages
- Brainstorming ideas
- Generating suggestions and helping compose replies
- General AI assistance

Keep responses clear and natural. When helping rewrite or compose messages, provide the rewritten text directly. You are an AI assistant — never pretend to be a human user.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if an AI API key is configured
    const aiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("AI_API_KEY");

    if (!aiKey) {
      // Return a helpful fallback response
      const fallback = getFallback(message);
      return new Response(
        JSON.stringify({ reply: fallback, offline: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the AI API (OpenAI-compatible)
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${aiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const fallback = getFallback(message);
      return new Response(
        JSON.stringify({ reply: fallback, offline: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || getFallback(message);

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Could not process request", reply: "I'm having trouble right now. Please try again later." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getFallback(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("translate")) {
    return "I can help with translations! For full AI translation, the NUVO service needs to be configured with an API key. Contact the app administrator to enable full AI capabilities.";
  }
  if (lower.includes("summar")) {
    return "To summarize text, paste it here and I'll condense it for you. (Note: Full AI summarization requires the NUVO service to be configured with an API key.)";
  }
  if (lower.includes("write") || lower.includes("reply") || lower.includes("compose")) {
    return "I'd be happy to help you write a message! Tell me what you want to say and to whom, and I'll help you craft it. (Note: Full AI writing requires the NUVO service to be configured with an API key.)";
  }
  if (lower.includes("brainstorm") || lower.includes("idea")) {
    return "Let's brainstorm! Share your topic and I'll suggest some ideas. (Note: Full AI brainstorming requires the NUVO service to be configured with an API key.)";
  }
  return "Hi! I'm NUVO, your AI assistant inside NUVORA. I can help with writing, translation, summarization, brainstorming, and answering questions. For full AI capabilities, the NUVO service needs to be configured with an API key. In the meantime, feel free to ask me anything!";
}
