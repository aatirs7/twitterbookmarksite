import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { colorForSlug, slugify } from "./palette";

const SEED: [string, string][] = [
  ["AI and LLMs", "Artificial intelligence, large language models, ML research, prompting, AI products"],
  ["Claude and Anthropic", "Anything about Claude, Claude Code, Anthropic, or its API and tooling"],
  ["Dev tools", "Developer tools, libraries, frameworks, editors, CLIs, open source projects"],
  ["Coding practices", "Software engineering craft, architecture, patterns, testing, code quality"],
  ["Cloud and infra", "Cloud providers, hosting, databases, DevOps, networking, infrastructure"],
  ["Cybersecurity", "Security, vulnerabilities, privacy, hacking, defense, compliance"],
  ["Design and UI", "Visual design, UI, UX, typography, product design, design inspiration"],
  ["Interiors and spaces", "Interior design, architecture, homes, workspaces, furniture"],
  ["Startups and business", "Founding, fundraising, strategy, company building, business lessons"],
  ["Marketing and growth", "Marketing, distribution, sales, audience building, copywriting, SEO"],
  ["Money and investing", "Personal finance, investing, markets, crypto, economics"],
  ["Productivity", "Workflows, habits, focus, note taking, personal systems"],
  ["Health and fitness", "Exercise, nutrition, sleep, mental health, longevity"],
  ["Islam and learning", "Islamic knowledge, Quran, faith, reflection, religious learning"],
  ["Travel", "Places, trips, travel tips, destinations"],
  ["Tech hardware", "Computers, phones, gadgets, chips, devices, setups"],
  ["Deals and freebies", "Discounts, free resources, giveaways, limited offers"],
  ["Humor", "Jokes, memes, funny posts"],
  ["Other", "Anything that fits no other tag"],
];

const seeded = new Set<string>();

/** Inserts the default taxonomy the first time a user has no tags at all. */
export async function ensureSeedTags(userId: string) {
  if (seeded.has(userId)) return;
  const existing = await db.select({ id: tags.id }).from(tags).where(eq(tags.userId, userId)).limit(1);
  if (existing.length) {
    seeded.add(userId);
    return;
  }
  await db
    .insert(tags)
    .values(
      SEED.map(([name, description]) => {
        const slug = slugify(name);
        return { userId, slug, name, description, color: colorForSlug(slug), createdBy: "system" };
      }),
    )
    .onConflictDoNothing();
  seeded.add(userId);
}
