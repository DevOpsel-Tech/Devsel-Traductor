import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "node:fs";

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Traductor PDF Android Test", { x: 50, y: 550, size: 18, font });
  page.drawText("This is a sample document for mobile testing.", { x: 50, y: 500, size: 12, font });
  page.drawText("Line number two with extra text to verify overlays.", { x: 50, y: 460, size: 12, font });
  const bytes = await doc.save();
  fs.writeFileSync("sample-test.pdf", bytes);
  console.log("OK");
}
main();
