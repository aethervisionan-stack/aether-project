import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Public indexable routes only.
 * - `/` = Quiz Medieval (ARCANUM)
 * - `/aether` = Aether Vision
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
      url: `${SITE_URL}/aether`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}
