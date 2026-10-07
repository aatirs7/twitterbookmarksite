import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normalizeEntry, normalizeTweet, parseXDate, type NormalizedTweet } from "@/lib/x/normalize";
import { entriesFromImportFile, parseBookmarksResponse } from "@/lib/x/timeline";

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "synthetic-page.json"), "utf8"),
);
const page = parseBookmarksResponse(fixture);

function byId(id: string): NormalizedTweet {
  const entry = page.entries.find((e) => e.entryId === `tweet-${id}`);
  if (!entry) throw new Error(`missing entry ${id}`);
  const r = normalizeEntry(entry);
  if (!r.ok) throw new Error(r.reason);
  return r.tweet;
}

describe("parseBookmarksResponse", () => {
  it("extracts tweet entries and the bottom cursor", () => {
    expect(page.entries).toHaveLength(8);
    expect(page.bottomCursor).toBe("CURSOR_BOTTOM_ABC");
    expect(page.entries[0].sortIndex).toBe("1900000000000000009");
  });

  it("accepts the various import file shapes", () => {
    expect(entriesFromImportFile(fixture)).toHaveLength(8);
    expect(entriesFromImportFile([fixture, fixture])).toHaveLength(16);
    expect(entriesFromImportFile({ entries: page.entries })).toHaveLength(8);
    expect(entriesFromImportFile(page.entries)).toHaveLength(8);
  });
});

describe("normalizeTweet", () => {
  it("plain tweet", () => {
    const t = byId("1800000000000000001");
    expect(t.authorHandle).toBe("PlainAuthor");
    expect(t.authorHandleLc).toBe("plainauthor");
    expect(t.authorVerified).toBe(true);
    expect(t.authorAvatarUrl).toBe("https://pbs.twimg.com/profile_images/1/a_bigger.jpg");
    expect(t.text).toBe("Plain tweet about Claude Code & agents <3");
    expect(t.createdAt?.toISOString()).toBe("2018-10-10T20:19:24.000Z");
    expect(t.likeCount).toBe(42);
    expect(t.viewCount).toBe(12345);
    expect(t.hasMedia || t.hasLink || t.isTombstone).toBe(false);
  });

  it("long note tweet uses full note text with expanded links", () => {
    const t = byId("1800000000000000002");
    expect(t.text).toContain("Read more at https://www.example.com/long-read because");
    expect(t.text).not.toContain("t.co");
    expect(t.authorHandle).toBe("LegacyLong");
    expect(t.authorAvatarUrl).toContain("b_bigger.png");
    expect(t.links.map((l) => l.url)).toEqual(["https://www.example.com/long-read"]);
    expect(t.links[0].domain).toBe("example.com");
  });

  it("quote tweet normalizes the quoted tweet and strips the trailing permalink", () => {
    const t = byId("1800000000000000003");
    expect(t.text).toBe("Hot take on this");
    expect(t.quotedTweetId).toBe("1700000000000000001");
    expect(t.quoted?.text).toBe("The original quoted thought");
    expect(t.quoted?.authorHandle).toBe("Original");
    expect(t.quoted?.quoted).toBeNull();
    expect(t.links).toHaveLength(0);
    expect(t.hasLink).toBe(false);
  });

  it("photo set", () => {
    const t = byId("1800000000000000004");
    expect(t.text).toBe("Two shots from the studio");
    expect(t.media).toHaveLength(2);
    expect(t.media[0]).toMatchObject({ type: "photo", width: 1200, altText: "A desk", position: 0 });
    expect(t.hasMedia).toBe(true);
    expect(t.hasVideo).toBe(false);
  });

  it("video picks the highest bitrate mp4", () => {
    const t = byId("1800000000000000005");
    expect(t.text).toBe("Watch this demo");
    expect(t.media[0].videoUrl).toBe("https://video.twimg.com/v_high.mp4");
    expect(t.media[0].durationMs).toBe(30500);
    expect(t.hasVideo).toBe(true);
  });

  it("link card metadata maps onto the link", () => {
    const t = byId("1800000000000000006");
    expect(t.text).toBe("Check out https://github.com/acme/great-repo");
    expect(t.links).toEqual([
      {
        url: "https://github.com/acme/great-repo",
        domain: "github.com",
        title: "Great Repo",
        description: "A repo that does things",
        imageUrl: "https://pbs.twimg.com/card_img/1.jpg",
      },
    ]);
    expect(t.hasLink).toBe(true);
  });

  it("tombstone keeps the id from the entry", () => {
    const t = byId("1800000000000000007");
    expect(t.isTombstone).toBe(true);
    expect(t.id).toBe("1800000000000000007");
    expect(t.text).toBe("This post is unavailable.");
  });

  it("visibility wrapped tweet with article and reply metadata", () => {
    const t = byId("1800000000000000008");
    expect(t.text).toBe("Visibility wrapped post");
    expect(t.authorHandle).toBe("Limited");
    expect(t.isArticle).toBe(true);
    expect(t.articleTitle).toBe("My Long Article");
    expect(t.inReplyToTweetId).toBe("1799999999999999999");
    expect(t.inReplyToHandle).toBe("Someone");
  });

  it("returns a reason instead of throwing on unknown shapes", () => {
    expect(normalizeTweet(null).ok).toBe(false);
    expect(normalizeTweet({ __typename: "SomethingNew" }).ok).toBe(false);
    expect(normalizeTweet({ __typename: "TweetTombstone" }).ok).toBe(false);
  });

  it("parses X dates with offsets", () => {
    expect(parseXDate("Wed Oct 10 20:19:24 -0130 2018")?.toISOString()).toBe("2018-10-10T21:49:24.000Z");
    expect(parseXDate(undefined)).toBeNull();
  });
});

// Real captured pages (gitignored) are exercised when present.
const fixtureDir = path.join(__dirname, "fixtures");
const realFiles = fs.readdirSync(fixtureDir).filter((f) => f.startsWith("real-") && f.endsWith(".json"));
describe.skipIf(realFiles.length === 0)("real fixtures", () => {
  it.each(realFiles)("%s normalizes every entry", (file) => {
    const json = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), "utf8"));
    const entries = entriesFromImportFile(json);
    expect(entries.length).toBeGreaterThan(0);
    const failures = entries.map(normalizeEntry).filter((r) => !r.ok);
    expect(failures).toEqual([]);
  });
});
