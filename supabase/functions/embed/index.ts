import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4.0.0";
import { pdfToString } from "../pdf.ts";
import { Pinecone } from "npm:@pinecone-database/pinecone";

const githubToken = Deno.env.get("GITHUB_TOKEN");
const pineconeKey = Deno.env.get("PINECONE_KEY");

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, content-type",
            },
        });
    }
    const text = await pdfToString(formData.get("file") as File);

    // Init OpenAI client
    const client = new OpenAI({ apiKey: githubToken, baseURL: "https://models.github.ai/inference" });

    // Summarize into concise JSON
    const response = await client.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `Output ONLY valid JSON, no markdown/line break: { "id": "str", "metadata": { "title": "str", "level": int }, "text": ["str", "str"] }, 
                "text" must be an array of concise keywords covering every concept in the syllabus`
            },
            { role: "user", content: text }
        ]
    });

    console.log(response.choices[0].message.content);
    const course = JSON.parse(response.choices[0].message.content);

    // Embed concise text
    const embeddingRes = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: course.text
    });
    const embedding = embeddingRes.data[0].embedding;

    // Store in Pinecone
    const pc = new Pinecone({ apiKey: pineconeKey });
    const index = pc.index("courses");
    await index.upsert([{ id: course.id, values: embedding, metadata: course.metadata }]);

    return new Response(JSON.stringify({ status: "ok", stored: course }), {
        headers: { "Content-Type": "application/json" }
    });
});
