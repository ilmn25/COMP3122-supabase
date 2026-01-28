import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4.0.0";
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

    // Parse JSON body
    const { topic } = await req.json();

    // Init OpenAI client
    const client = new OpenAI({ apiKey: githubToken, baseURL: "https://models.github.ai/inference" });

    // Create embedding for the query topic
    const embeddingRes = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: topic
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    // Init Pinecone client
    const pc = new Pinecone({ apiKey: pineconeKey });
    const index = pc.index("courses");

    // Query Pinecone for similar courses
    const results = await index.query({
        topK: 5, // number of results to return
        vector: queryEmbedding,
        includeMetadata: true
    });

    return new Response(JSON.stringify({ status: "ok", matches: results.matches }), {
        headers: { "Content-Type": "application/json" }
    });
});
