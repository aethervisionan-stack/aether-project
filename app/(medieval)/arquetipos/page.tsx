import { redirect } from "next/navigation";

/**
 * Quiz Medieval legacy path (`/arquetipos`).
 * Canonical product route is `/` (ARCANUM • XII). Keep this redirect forever.
 */
export default function ArquetiposRedirectPage() {
  redirect("/");
}
