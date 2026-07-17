import { notFound } from "next/navigation";
import AWComposeStudio from "@/components/tools/AWComposeStudio";
import { requireSession } from "@/lib/auth";
import { listGenerations } from "../awideogram/actions";

// AWcompose — place a real product photo exactly onto a (AI) background.
export default async function AWComposePage() {
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") notFound();

  // Offer recent AWideogram images as background choices.
  let backgrounds: { id: string; url: string }[] = [];
  try {
    const gens = await listGenerations(24);
    backgrounds = gens.map((g) => ({ id: g.id, url: g.url }));
  } catch {
    backgrounds = [];
  }

  return <AWComposeStudio backgrounds={backgrounds} />;
}
