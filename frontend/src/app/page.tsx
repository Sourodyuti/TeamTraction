import { redirect } from "next/navigation";

// Root route goes straight to the overlay — that is the product.
// There is no landing page.
export default function RootPage() {
  redirect("/overlay");
}
