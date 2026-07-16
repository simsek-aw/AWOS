import { notFound } from "next/navigation";
import AWideogramStudio from "@/components/tools/AWideogramStudio";
import { requireSession } from "@/lib/auth";
import { listGenerations } from "./actions";

// AWideogram — Ideogram 4.0 image generation with visual layout control.
// Employee-only native AWOS tool.
export default async function AWideogramPage() {
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") notFound();

  const initial = await listGenerations();
  const hasKey = !!process.env.IDEOGRAM_API_KEY;

  return <AWideogramStudio initial={initial} hasKey={hasKey} />;
}
