// Ten muted hues for tag chips, assigned by slug hash.
export const TAG_PALETTE = [
  "#7C9CFF",
  "#6FC2B0",
  "#D9A65E",
  "#C987C9",
  "#E08A7E",
  "#8FB86F",
  "#7FB3D5",
  "#B79CE0",
  "#D7C46A",
  "#9AA7B8",
] as const;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function colorForSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}
