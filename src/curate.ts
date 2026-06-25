import { getDailyDigest } from "./digestService.js";

export type { Digest as CuratedResources } from "./emailTemplate.js";

export async function curateResources() {
  const { digest } = await getDailyDigest();
  return digest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  curateResources()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
