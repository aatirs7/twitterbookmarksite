// Tags every untagged bookmark now instead of waiting for the hourly cron.
// Run with: pnpm tag
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

async function main() {
  console.log(process.env.ANTHROPIC_API_KEY ? "Using Claude" : "No ANTHROPIC_API_KEY: using free keyword rules");
  const { OWNER_ID } = await import("@/lib/auth/session");
  const { tagBookmarks } = await import("@/lib/ai/tagBookmarks");
  let total = 0;
  for (;;) {
    const n = await tagBookmarks(OWNER_ID, 100);
    total += n;
    console.log(`tagged ${n} (total ${total})`);
    if (n === 0) break;
  }
  console.log("done");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
