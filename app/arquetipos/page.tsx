import { redirect } from "next/navigation";

/** Legacy path — quiz now lives at `/`. */
export default function ArquetiposRedirectPage() {
  redirect("/");
}
