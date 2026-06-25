import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDailyDigest } from "./digestService.js";
import { renderEmail } from "./emailTemplate.js";

const outputDir = path.join(process.cwd(), "outputs");

async function main(): Promise<void> {
  const { digest, mode, fallbackReason } = await getDailyDigest();
  const html = renderEmail(digest);

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "newsletter.json"), `${JSON.stringify(digest, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDir, "newsletter.html"), html, "utf8")
  ]);

  console.log(`Saved digest using mode: ${mode}`);
  if (fallbackReason) {
    console.log(`Fallback reason: ${fallbackReason}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
