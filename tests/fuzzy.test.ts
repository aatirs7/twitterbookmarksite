import { describe, expect, it } from "vitest";
import { editDistance, fuzzyVariants } from "@/lib/search/fuzzy";
import { synonymsOf } from "@/lib/search/synonyms";

describe("fuzzy", () => {
  it("computes edit distance with transpositions", () => {
    expect(editDistance("anthropic", "anthorpic", 2)).toBe(1);
    expect(editDistance("design", "desgin", 2)).toBe(1);
    expect(editDistance("claude", "cloud", 2)).toBe(2);
    expect(editDistance("abc", "xyzxyz", 2)).toBe(3);
  });

  it("suggests close vocabulary words, most common first", () => {
    const vocab = [
      { word: "anthropic", ndoc: 40 },
      { word: "discount", ndoc: 5 },
      { word: "discounts", ndoc: 2 },
      { word: "design", ndoc: 90 },
    ];
    expect(fuzzyVariants("anthorpic", vocab)).toEqual(["anthropic"]);
    expect(fuzzyVariants("discunt", vocab)[0]).toBe("discount");
    expect(fuzzyVariants("dsign", vocab)).toEqual(["design"]);
    expect(fuzzyVariants("ux", vocab)).toEqual([]);
  });

  it("knows related concepts", () => {
    expect(synonymsOf("discount")).toEqual(expect.arrayContaining(["deal", "free", "coupon"]));
    expect(synonymsOf("LLM")).toContain("ai");
  });
});
