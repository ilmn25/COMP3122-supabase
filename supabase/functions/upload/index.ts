// supabase/functions/extract-electives/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { pdfToString } from "../pdf.ts";
import { createClient } from "npm:@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

function extractCompElectiveCodes(text: string): string[] {
    const block = text.match(/COMP Elective([\s\S]*?)(?=WIE)/)?.[1] || "";
    const electives: string[] = [];
    let last: string | null = null;

    for (const token of block.split(/\s+/)) {
        if (/^(COMP|DSAI|EIE|MM)\d{4}$/.test(token)) last = token;
        else if (last && /^(R|[A-D][+-]?|F)$/.test(token)) {
            electives.push(last);
            last = null;
        }
    }
    return electives;
}

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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const text = await pdfToString(file);

    const electivesJson = { electives: extractCompElectiveCodes(text), user_id: user.id };

    supabase.from("user_electives").upsert(electivesJson, { onConflict: "user_id" });

    return new Response(JSON.stringify({ status: "ok", stored: electivesJson }), {
        headers: { "Content-Type": "application/json" },
    });
});
