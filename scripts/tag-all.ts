// Tags every untagged bookmark now instead of waiting for the hourly cron.
// Run with: pnpm tag
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set in .env.local");
    process.exit(1);
  }
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
