// App icon artwork, rendered with next/og ImageResponse for every size we need.
// A bookmark ribbon in the accent color with an X cut through it, on the app's ink background.
// Full-bleed and opaque: iOS rounds the corners itself and rejects transparency.

export const ICON_BG = "#0F1115";
export const ICON_ACCENT = "#7C9CFF";

/** `scale` is the ribbon height as a fraction of the icon (keep it under 0.6 for maskable safe zones). */
export function BrandIcon({ size, scale = 0.56 }: { size: number; scale?: number }) {
  const h = size * scale;
  const w = h * (100 / 130);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 50% 38%, #1B1F27 0%, ${ICON_BG} 70%)`,
      }}
    >
      <svg width={w} height={h} viewBox="0 0 100 130">
        <path d="M8 0 H92 Q100 0 100 8 V126 L50 96 L0 126 V8 Q0 0 8 0 Z" fill={ICON_ACCENT} />
        <path d="M31 28 L69 70 M69 28 L31 70" stroke={ICON_BG} strokeWidth="12" strokeLinecap="round" />
      </svg>
    </div>
  );
}
