/**
 * Render public/brochure.pdf from the existing jsPDF generator.
 *
 * Run: npm run build:brochure
 *
 * Output: public/brochure.pdf — committed asset linked from PostSubmitScreen
 * and PaiementPage. Re-run whenever seminar pricing/dates/content change in
 * src/data/seminars.ts or any of the build*Page() functions in
 * src/admin/brochurePdf.ts.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBrochurePdfDoc } from "../src/admin/brochurePdf";
import { SEMINARS } from "../src/data/seminars";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "..", "public", "brochure.pdf");

const allSeminarIds = new Set(SEMINARS.map((s) => s.id));
const doc = buildBrochurePdfDoc(allSeminarIds);
const buf = Buffer.from(doc.output("arraybuffer"));

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buf);

const pageCount = doc.getNumberOfPages();
const sizeKb = (buf.byteLength / 1024).toFixed(1);
console.log(`Wrote ${outPath}`);
console.log(`Pages: ${pageCount}  Size: ${sizeKb} KB`);
