// supabase/functions/_shared/pdf.ts
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";

export async function pdfToString(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    const pageTexts = await Promise.all(
        Array.from({ length: pdfDoc.numPages }, async (_, i) => {
            const page = await pdfDoc.getPage(i + 1);
            const { items } = await page.getTextContent();
            return items.map((x: any) => x.str).join(" ");
        })
    );

    return pageTexts.join("\n");
}
