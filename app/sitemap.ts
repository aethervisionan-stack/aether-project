import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { PRODUCT_ROUTES } from "@/lib/products";

/**
 * Public indexable routes only.
 * - `/` = Quiz Medieval (ARCANUM) — `(medieval)`
 * - `/aether` = Aether Vision — `(aether)/aether`
 * `/teste-qi` (TestLineQi) is intentionally omitted (`robots: noindex`).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}${PRODUCT_ROUTES.aetherVision}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}
