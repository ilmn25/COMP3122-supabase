import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4.0.0";
import pdfParse from "npm:pdf-parse";

const token = Deno.env.get("GITHUB_TOKEN");

Deno.serve(async (req) => {
    const { pdfUrl } = await req.json();

    const pdfRes = await fetch(pdfUrl);
    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer());
    const parsed = await pdfParse(pdfBuffer);

    const client = new OpenAI({ baseURL: "https://models.github.ai/inference", apiKey: token });
    const response = await client.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: parsed.text.slice(0, 2000) }]
    });

    return new Response(JSON.stringify({ result: response.choices[0].message.content }), {
        headers: { "Content-Type": "application/json" }
    });
});


/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/query' \
    --header 'Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwODQ4NjQzOTN9.aNcs6Lz4notlPmUT0vOzkG27ZtaTrxRsdQnv-Psi4KBq1JRYHJWtFHetgDhZoJSWS9Wco6A9RJ7L5CwJqhZaJQ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
