// supabase/functions/extract-electives/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4.0.0";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";
import { createClient } from "npm:@supabase/supabase-js";

const githubToken = Deno.env.get("GITHUB_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

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

    // Authenticate user via Supabase
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
        global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid user" }), { status: 401 });
    }

    // Parse uploaded PDF
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    let text = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }


    const client = new OpenAI({ apiKey: githubToken, baseURL: "https://models.github.ai/inference" });

    // Inside your Edge Function
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `Extract ONLY COMP elective course codes from the text.
                Output valid JSON only, no markdown: { "electives": ["CODE123", "CODE456", ...] }`
            },
            { role: "user", content: text }
        ]
    });

    // Parse LLM output
    const electivesJson = JSON.parse(response.choices[0].message.content);

    // Attach Supabase user_id (from auth)
    electivesJson.user_id = user.id;

    // Store in Supabase
    const { error: insertError } = await supabase
        .from("user_electives")
        .insert(electivesJson);


    if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ status: "ok", stored: electivesJson }), {
        headers: { "Content-Type": "application/json" },
    });
});
