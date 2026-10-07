import { describe, expect, it } from "vitest";
import { categorize, parseRules } from "@/lib/tags/ruleTagger";
import { SEED_KEYWORDS } from "@/lib/tags/seedKeywords";

const cats = Object.entries(SEED_KEYWORDS).map(([slug, keywords]) => ({ slug, keywords }));
const tag = (text: string, extra: { authorHandle?: string; domains?: string[] } = {}) =>
  categorize({ text, ...extra }, cats, { fallback: "other" });

describe("ruleTagger", () => {
  it("matches words on boundaries, not inside other words", () => {
    const rules = parseRules("ai, rag");
    expect(rules.some((r) => r.kind === "word" && r.re.test("new ai model"))).toBe(true);
    expect(categorize({ text: "said the brain" }, [{ slug: "x", keywords: "ai" }])).toEqual([]);
    expect(categorize({ text: "dragon" }, [{ slug: "x", keywords: "rag" }])).toEqual([]);
  });

  it("supports prefix, phrase, domain and handle rules", () => {
    const c = [{ slug: "x", keywords: 'invest*, "claude code", github.com, @karpathy' }];
    expect(categorize({ text: "investing tips" }, c)).toEqual(["x"]);
    expect(categorize({ text: "Using Claude   Code daily" }, c)).toEqual(["x"]);
    expect(categorize({ text: "nothing", domains: ["gist.github.com"] }, c)).toEqual(["x"]);
    expect(categorize({ text: "nothing", authorHandle: "Karpathy" }, c)).toEqual(["x"]);
  });

  it("categorizes realistic bookmarks", () => {
    expect(tag("Anthropic is giving startups a free year of Claude Team, $1,000 in API credits")).toEqual(
      expect.arrayContaining(["claude-and-anthropic", "deals-and-freebies"]),
    );
    expect(tag("12 months. $0. for students. Uber One FREE through 10/21, go claim it")[0]).toBe("deals-and-freebies");
    expect(tag("New landing page I designed in Figma, love this typography")[0]).toBe("design-and-ui");
    expect(tag("Up to $5.5M to move your startup to Qatar. Just an MVP gets you in the door")).toContain("startups-and-business");
  });

  it("falls back when nothing matches", () => {
    expect(tag("good morning")).toEqual(["other"]);
  });

  it("returns at most three categories", () => {
    expect(tag("free claude ai startup figma design gym crypto travel iphone").length).toBeLessThanOrEqual(3);
  });
});
