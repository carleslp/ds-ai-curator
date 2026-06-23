import { writeFile } from "node:fs/promises";
import { curateResources } from "./curate.js";
import { renderEmail } from "./emailTemplate.js";

const digest = await curateResources();
await writeFile("output.html", renderEmail(digest), "utf8");
console.log(`Generated output.html from ${digest.resources.length} live AI-curated resources.`);
