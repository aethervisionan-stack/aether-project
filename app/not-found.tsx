import Link from "next/link";
import { PRODUCT_BRANDS, PRODUCT_ROUTES } from "@/lib/products";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: "1.25rem",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        background: "#050608",
        color: "#e8e6e3",
      }}
    >
      <div style={{ maxWidth: "28rem", textAlign: "center" }}>
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          404
        </p>
        <h1 style={{ marginTop: "1rem", fontSize: "1.75rem" }}>
          Página não encontrada
        </h1>
        <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", opacity: 0.75 }}>
          Esta rota não existe neste host multi-produto.
        </p>
        <nav
          style={{
            marginTop: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <Link href={PRODUCT_ROUTES.quizMedieval}>
            {PRODUCT_BRANDS.quizMedieval}
          </Link>
          <Link href={PRODUCT_ROUTES.testlineqi}>
            {PRODUCT_BRANDS.testlineqi}
          </Link>
          <Link href={PRODUCT_ROUTES.aetherVision}>
            {PRODUCT_BRANDS.aetherVision}
          </Link>
        </nav>
      </div>
    </main>
  );
}
