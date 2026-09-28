import { ImageResponse } from "next/og";
export const alt = "Auromode Auroville — A place to stay. A way to be.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#344a3b",
        color: "#f8f5f0",
        padding: 80,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 35, letterSpacing: 6 }}>AUROMODE · AUROVILLE</div>
      <div
        style={{
          fontSize: 80,
          lineHeight: 1.1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span>A place to stay.</span>
        <span>A way to be.</span>
      </div>
      <div style={{ fontSize: 20, letterSpacing: 5 }}>
        STAY / WORK / EAT / CONNECT
      </div>
    </div>,
    { ...size },
  );
}
