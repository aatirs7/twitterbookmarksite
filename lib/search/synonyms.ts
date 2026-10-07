// Small concept map for query expansion. Each group is a set of words that should find each other.
// Lowercase, single tokens (they become tsquery lexemes).
export const SYNONYM_GROUPS: string[][] = [
  ["ai", "llm", "llms", "gpt", "chatgpt", "openai", "gemini", "model", "models", "genai"],
  ["claude", "anthropic", "opus", "sonnet", "haiku"],
  ["agent", "agents", "agentic", "autonomous", "automation"],
  ["deal", "deals", "discount", "discounts", "coupon", "promo", "free", "freebie", "giveaway", "sale", "offer", "perks"],
  ["design", "designer", "ui", "ux", "figma", "interface", "layout", "aesthetic"],
  ["website", "web", "site", "landing", "webpage", "frontend"],
  ["code", "coding", "programming", "developer", "dev", "engineering", "software"],
  ["tool", "tools", "app", "apps", "software", "product"],
  ["startup", "startups", "founder", "founders", "company", "business", "saas"],
  ["money", "invest", "investing", "stocks", "finance", "wealth", "crypto"],
  ["job", "jobs", "career", "hiring", "interview", "internship", "resume"],
  ["learn", "learning", "tutorial", "guide", "course", "lesson", "explained"],
  ["video", "videos", "clip", "film", "youtube"],
  ["photo", "photos", "image", "images", "picture", "pictures"],
  ["fitness", "gym", "workout", "exercise", "training", "health"],
  ["food", "recipe", "recipes", "cooking", "meal", "eat"],
  ["travel", "trip", "vacation", "flight", "flights", "visa", "relocate", "abroad"],
  ["security", "cybersecurity", "hacking", "hacker", "vulnerability", "infosec", "privacy"],
  ["phone", "iphone", "android", "mobile", "ios"],
  ["laptop", "macbook", "computer", "pc", "mac"],
  ["scholarship", "scholarships", "grant", "grants", "funding", "fellowship"],
  ["student", "students", "university", "college", "school", "education"],
  ["marketing", "growth", "seo", "ads", "audience", "sales"],
  ["prompt", "prompts", "prompting"],
  ["mcp", "plugin", "plugins", "integration", "integrations", "extension"],
  ["opensource", "github", "repo", "repository"],
  ["funny", "meme", "memes", "joke", "lol", "humor"],
];

const index = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  for (const w of group) {
    const set = index.get(w) ?? new Set<string>();
    group.forEach((g) => g !== w && set.add(g));
    index.set(w, set);
  }
}

export function synonymsOf(word: string): string[] {
  return [...(index.get(word.toLowerCase()) ?? [])];
}
