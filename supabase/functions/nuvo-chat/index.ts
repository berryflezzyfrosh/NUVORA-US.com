// supabase/functions/nuvo-chat/index.ts
// NUVO AI Assistant edge function
// Proxies AI requests securely without exposing API keys to the client.

import { createClient } from "npm:@supabase/supabase-js@2";

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

Keep responses clear and natural. When helping rewrite or compose messages, provide the rewritten text directly. You are an AI assistant — never pretend to be a human user. Keep responses under 500 words unless explicitly asked for more detail.`;

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

    // Check for OpenAI API key
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      // Fallback response when no API key is configured
      return new Response(
        JSON.stringify({
          reply: "Hi! I'm NUVO, your AI assistant. I can help with writing, translation, summarization, brainstorming, and answering questions. To enable full AI capabilities, the app administrator needs to configure an AI API key in the Supabase project secrets.",
          configured: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
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

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: "AI service error", reply: "I'm having trouble connecting to my AI service right now. Please try again in a moment." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(
      JSON.stringify({ reply, configured: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, reply: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
