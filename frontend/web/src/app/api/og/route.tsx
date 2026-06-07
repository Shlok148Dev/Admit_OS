import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || "ADMIT OS";
    const subtitle = searchParams.get("subtitle") || "Post-Exam Command Center";
    const badge = searchParams.get("badge") || "PREDICTIONS";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundColor: "#0f172a", // Slate 900
            backgroundImage: "radial-gradient(circle at 80% 20%, #1e1b4b 0%, #0f172a 100%)", // Indigo 950 gradient
            padding: "80px",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.05em" }}>
                ADMIT<span style={{ color: "#10b981", marginLeft: "4px" }}>OS</span>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                border: "1.5px solid rgba(16, 185, 129, 0.2)",
                borderRadius: "50px",
                padding: "8px 20px",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981", marginRight: 8 }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#10b981", letterSpacing: "0.05em" }}>
                {badge.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Main Info */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
            <h1
              style={{
                fontSize: 64,
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                marginBottom: 20,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: "#94a3b8", // Slate 400
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              paddingTop: 30,
            }}
          >
            <span style={{ fontSize: 16, color: "#64748b", fontWeight: 600 }}>
              VERIFIED OFFICIAL COUNSELING DATA
            </span>
            <span style={{ fontSize: 16, color: "#38bdf8", fontWeight: 700 }}>
              admitos.in
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error("OG Image generation error:", e);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
