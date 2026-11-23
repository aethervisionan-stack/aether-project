"use client";

import type { Ref } from "react";
import {
  buildIntro,
  type ArchetypeProfile,
  type NarrativeResult,
} from "@/src/data/archetypes";

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

type Props = {
  result: NarrativeResult;
  cardRef: Ref<HTMLDivElement>;
};

function Portrait({
  profile,
  width,
  height,
}: {
  profile: ArchetypeProfile;
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        borderRadius: 6,
        border: `2px solid ${profile.accent}88`,
        boxShadow: "0 24px 48px rgba(0,0,0,0.55)",
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profile.image}
        alt={profile.title}
        width={width}
        height={height}
        crossOrigin="anonymous"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, transparent 38%, rgba(5,6,8,0.88) 82%, rgba(5,6,8,0.96) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "28px 22px 26px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "Cinzel, Georgia, serif",
            fontSize: 14,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: profile.accent,
          }}
        >
          Brasão
        </p>
        <h2
          style={{
            margin: "10px 0 0",
            fontFamily: "Cinzel, Georgia, serif",
            fontSize: 36,
            letterSpacing: "0.04em",
            color: "#ece7df",
            fontWeight: 600,
            lineHeight: 1.15,
          }}
        >
          {profile.title}
        </h2>
        <p
          style={{
            margin: "8px 0 0",
            fontFamily: "Lora, Georgia, serif",
            fontSize: 18,
            color: "#a39e94",
          }}
        >
          {profile.subtitle}
        </p>
      </div>
    </div>
  );
}

/**
 * Off-screen 1080×1920 story card for html-to-image capture.
 * Uses inline styles + &lt;img&gt; so the PNG export stays reliable.
 */
export function ShareCardTemplate({ result, cardRef }: Props) {
  const intro = buildIntro(result);
  const hybrid = result.hybrid;
  const portraits = result.dominants.map((d) => d.profile);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -12000,
        top: 0,
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <div
        ref={cardRef}
        data-share-card
        style={{
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
          position: "relative",
          overflow: "hidden",
          background: "#050608",
          color: "#ece7df",
          fontFamily: "Lora, Georgia, serif",
        }}
      >
        {/* Sanctuary background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/sanctuary-runes.jpg"
          alt=""
          width={SHARE_CARD_WIDTH}
          height={SHARE_CARD_HEIGHT}
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.38,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 28%, rgba(5,6,8,0.15) 0%, rgba(5,6,8,0.72) 55%, rgba(5,6,8,0.94) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(5,6,8,0.55) 0%, transparent 22%, transparent 62%, rgba(5,6,8,0.92) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            boxSizing: "border-box",
            padding: "72px 64px 64px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "Cinzel, Georgia, serif",
              fontSize: 18,
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: "#c9894a",
            }}
          >
            Relatório de Expedição
          </p>
          <h1
            style={{
              margin: "22px 0 0",
              fontFamily: "Cinzel, Georgia, serif",
              fontSize: 54,
              letterSpacing: "0.06em",
              textAlign: "center",
              color: "#ece7df",
              fontWeight: 600,
              lineHeight: 1.1,
            }}
          >
            {hybrid ? "Pergaminho Híbrido" : "Seu Arquétipo"}
          </h1>

          <div
            style={{
              marginTop: 56,
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "stretch",
              gap: hybrid ? 28 : 0,
              width: "100%",
            }}
          >
            {hybrid ? (
              portraits.slice(0, 2).map((p) => (
                <Portrait key={p.id} profile={p} width={440} height={660} />
              ))
            ) : (
              <Portrait
                profile={portraits[0]!}
                width={560}
                height={840}
              />
            )}
          </div>

          <p
            style={{
              marginTop: "auto",
              marginBottom: 0,
              maxWidth: 880,
              textAlign: "center",
              fontFamily: "Lora, Georgia, serif",
              fontSize: 28,
              lineHeight: 1.45,
              color: "#c9c3b8",
            }}
          >
            {intro}
          </p>

          <div
            style={{
              marginTop: 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 120,
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, rgba(201,137,74,0.7), transparent)",
              }}
            />
            <p
              style={{
                margin: 0,
                fontFamily: "Cinzel, Georgia, serif",
                fontSize: 16,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#6b665e",
              }}
            >
              Arquétipos · Jung
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
