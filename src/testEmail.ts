import { writeFile } from "node:fs/promises";
import { getDailyDigest } from "./digestService.js";
import { renderEmail } from "./emailTemplate.js";

const { digest } = await getDailyDigest();
await writeFile("output.html", renderEmail(digest), "utf8");
console.log(`Generated output.html from ${digest.resources.length} resources.`);
