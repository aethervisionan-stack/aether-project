import { ImageResponse } from "next/og";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "linear-gradient(160deg, #030305 0%, #0a1218 42%, #05060c 100%)",
          color: "#f4f4f5",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            opacity: 0.45,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            right: -80,
            top: -120,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(34,211,238,0.28) 0%, rgba(6,182,212,0.08) 42%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            left: -140,
            bottom: -160,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <img
            src={`${origin}/logo.png`}
            width={76}
            height={76}
            alt=""
            style={{
              borderRadius: 20,
              boxShadow: "0 0 36px rgba(34,211,238,0.45)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: "0.42em",
                color: "#22d3ee",
                textTransform: "uppercase",
              }}
            >
              AETHER
            </div>
            <div style={{ fontSize: 28, letterSpacing: "-0.04em", marginTop: 4 }}>
              Vision
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 920 }}>
          <div
            style={{
              fontSize: 58,
              lineHeight: 1.05,
              letterSpacing: "-0.045em",
              fontWeight: 600,
            }}
          >
            Aether Vision
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 32,
              lineHeight: 1.25,
              color: "#a1a1aa",
              letterSpacing: "-0.02em",
            }}
          >
            Decentralized AI Hardware on Solana
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {["Vision 1.0", "2.0", "3.0", "4.0"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid rgba(34,211,238,0.35)",
                  color: "#22d3ee",
                  fontSize: 16,
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ color: "#22d3ee", fontSize: 18, letterSpacing: "0.08em" }}>
            @VISIONAETH
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}
