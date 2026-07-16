import { notFound } from "next/navigation";
import AWideogramStudio from "@/components/tools/AWideogramStudio";
import { requireSession } from "@/lib/auth";
import { listGenerations } from "./actions";

// AWideogram — Ideogram 4.0 image generation with visual layout control.
// Employee-only native AWOS tool.
export default async function AWideogramPage() {
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") notFound();

  // Never let a failing gallery load (e.g. migration 0028 not applied yet)
  // white-screen the whole tool — degrade to an empty gallery instead.
  let initial: Awaited<ReturnType<typeof listGenerations>> = [];
  try {
    initial = await listGenerations();
  } catch (e) {
    console.error("awideogram: listGenerations failed", e);
  }
  const hasKey = !!process.env.IDEOGRAM_API_KEY;

  return <AWideogramStudio initial={initial} hasKey={hasKey} />;
}
