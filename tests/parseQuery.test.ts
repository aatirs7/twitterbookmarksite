import { describe, expect, it } from "vitest";
import { buildExcludeTsQuery, buildTsQuery, parseQuery } from "@/lib/search/parseQuery";

describe("parseQuery", () => {
  it("returns an empty query for blank input", () => {
    const p = parseQuery("   ");
    expect(p.terms).toEqual([]);
    expect(buildTsQuery(p)).toBeNull();
  });

  it("ANDs terms and prefix-matches the last one", () => {
    const p = parseQuery("claude cod");
    expect(p.terms).toEqual(["claude", "cod"]);
    expect(buildTsQuery(p)).toBe("'claude' & 'cod':*");
  });

  it("does not prefix-match when the user typed a trailing space", () => {
    expect(buildTsQuery(parseQuery("claude code "))).toBe("'claude' & 'code'");
  });

  it("handles quoted phrases with <->", () => {
    const p = parseQuery('"claude code" agents');
    expect(p.phrases).toEqual([["claude", "code"]]);
    expect(buildTsQuery(p)).toBe("'agents':* & ('claude' <-> 'code')");
  });

  it("does not prefix a phrase that ends the query", () => {
    expect(buildTsQuery(parseQuery('agents "claude code"'))).toBe("'agents' & ('claude' <-> 'code')");
  });

  it("extracts operators into filters", () => {
    const p = parseQuery("from:@Karpathy tag:ai-and-llms site:www.GitHub.com has:video has:link rust");
    expect(p.from).toEqual(["karpathy"]);
    expect(p.tags).toEqual(["ai-and-llms"]);
    expect(p.sites).toEqual(["github.com"]);
    expect(p.has).toEqual({ video: true, link: true });
    expect(p.terms).toEqual(["rust"]);
    expect(p.freeText).toBe("rust");
  });

  it("collects excludes, including quoted excludes", () => {
    const p = parseQuery('react -vue -"angular js"');
    expect(p.terms).toEqual(["react"]);
    expect(p.excludes).toEqual(["vue", "angular", "js"]);
    expect(buildExcludeTsQuery(p)).toBe("'vue' | 'angular' | 'js'");
    expect(buildTsQuery(p)).toBe("'react'");
  });

  it("an exclude as the last token disables prefix matching", () => {
    expect(parseQuery("react -vue").prefixLast).toBe(false);
  });

  it("strips tsquery syntax characters from words", () => {
    const p = parseQuery("a&b c|d (e) f:*");
    expect(buildTsQuery(p)).toBe("'a' & 'b' & 'c' & 'd' & 'e' & 'f':*");
  });

  it("escapes single quotes", () => {
    expect(buildTsQuery(parseQuery("don't"))).toBe("'don' & 't':*");
  });

  it("tolerates an unterminated quote", () => {
    const p = parseQuery('"claude cod');
    expect(p.phrases).toEqual([["claude", "cod"]]);
  });
});
