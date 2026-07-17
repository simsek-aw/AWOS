import { notFound } from "next/navigation";
import AWhrStudio from "@/components/tools/AWhrStudio";
import { requireSession } from "@/lib/auth";
import { loadApplicants, loadEmployees, loadVacations } from "./actions";

// AWhr — recruiting + vacation. Employee-only; access to individual data is
// enforced in the actions (admins/HR see all, reviewers see their applicants,
// everyone sees their own vacation).
export default async function AWhrPage() {
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") notFound();

  const [vac, rec, employees] = await Promise.all([
    loadVacations(),
    loadApplicants(),
    loadEmployees(),
  ]);

  return (
    <AWhrStudio
      isAdmin={vac.isAdmin}
      mine={vac.mine}
      allVac={vac.all}
      applicants={rec.applicants}
      employees={employees}
    />
  );
}
