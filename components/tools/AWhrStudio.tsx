"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addNote,
  addReviewer,
  type ApplicantDetail,
  type ApplicantView,
  createApplicant,
  createVacation,
  decideVacation,
  deleteApplicant,
  deleteVacation,
  getApplicantDetail,
  removeReviewer,
  setStage,
  type VacationView,
  vote,
} from "@/app/(app)/tools/awhr/actions";
import { toast } from "@/components/toast";
import { RECRUIT_STAGES } from "@/lib/hr";

type Emp = { id: string; name: string };

export default function AWhrStudio({
  isAdmin,
  mine,
  allVac,
  applicants,
  employees,
}: {
  isAdmin: boolean;
  mine: VacationView[];
  allVac: VacationView[];
  applicants: ApplicantView[];
  employees: Emp[];
}) {
  const [tab, setTab] = useState<"urlaub" | "recruiting">("urlaub");

  return (
    <div className="page-enter page-pad" style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>🧑‍💼</span>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>AWhr</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>
            Recruiting & Urlaub — vertraulich.{" "}
            {isAdmin ? "Du hast HR-Zugriff." : "Du siehst nur, was dich betrifft."}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          margin: "18px 0 20px",
        }}
      >
        {(["urlaub", "recruiting"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
              color: tab === t ? "var(--text)" : "var(--muted)",
              fontSize: 14,
              fontWeight: 600,
              padding: "8px 12px",
              marginBottom: -1,
              cursor: "pointer",
            }}
          >
            {t === "urlaub" ? "Urlaub" : "Recruiting"}
          </button>
        ))}
      </div>

      {tab === "urlaub" ? (
        <VacationTab
          isAdmin={isAdmin}
          mine={mine}
          allVac={allVac}
          employees={employees}
        />
      ) : (
        <RecruitingTab
          isAdmin={isAdmin}
          applicants={applicants}
          employees={employees}
        />
      )}
    </div>
  );
}

// ------------------------------ Vacation ---------------------------------

function VacationTab({
  isAdmin,
  mine,
  allVac,
  employees,
}: {
  isAdmin: boolean;
  mine: VacationView[];
  allVac: VacationView[];
  employees: Emp[];
}) {
  const router = useRouter();
  const decide = async (id: string, status: "approved" | "rejected") => {
    await decideVacation(id, status);
    toast(status === "approved" ? "Genehmigt" : "Abgelehnt");
    router.refresh();
  };
  const del = async (id: string) => {
    await deleteVacation(id);
    router.refresh();
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Request form */}
      <section>
        <h2 style={h2}>Urlaub beantragen</h2>
        <form
          action={createVacation}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}
        >
          <Field label="Von">
            <input type="date" name="start" required style={input} />
          </Field>
          <Field label="Bis">
            <input type="date" name="end" required style={input} />
          </Field>
          <Field label="Vertretung">
            <select name="substitute" style={input} defaultValue="">
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notiz">
            <input name="reason" placeholder="optional" style={input} />
          </Field>
          <button style={btn}>Antrag senden</button>
        </form>
      </section>

      {/* Own requests */}
      <section>
        <h2 style={h2}>Meine Anträge</h2>
        {mine.length === 0 ? (
          <p style={empty}>Noch keine Anträge.</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {mine.map((v) => (
              <VacationRow key={v.id} v={v} onDelete={del} canDelete={v.status === "pending"} />
            ))}
          </div>
        )}
      </section>

      {/* Admin: all requests + decisions */}
      {isAdmin && (
        <section>
          <h2 style={h2}>Alle Anträge (HR)</h2>
          {allVac.length === 0 ? (
            <p style={empty}>Keine Anträge.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {allVac.map((v) => (
                <VacationRow
                  key={v.id}
                  v={v}
                  admin
                  onDecide={decide}
                  onDelete={del}
                  canDelete
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function VacationRow({
  v,
  admin,
  onDecide,
  onDelete,
  canDelete,
}: {
  v: VacationView;
  admin?: boolean;
  onDecide?: (id: string, s: "approved" | "rejected") => void;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}) {
  const tone =
    v.status === "approved"
      ? "#00c875"
      : v.status === "rejected"
        ? "#e2445c"
        : "#fdab3d";
  const statusLabel =
    v.status === "approved"
      ? "Genehmigt"
      : v.status === "rejected"
        ? "Abgelehnt"
        : "Offen";
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--panel)",
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {admin && <strong style={{ fontSize: 14 }}>{v.userName}</strong>}
        <span style={{ fontSize: 14 }}>
          {fmt(v.start)} – {fmt(v.end)}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{v.days} Tage</span>
        {v.substituteName && (
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            Vertretung: {v.substituteName}
          </span>
        )}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: tone,
            border: `1px solid ${tone}55`,
            borderRadius: 999,
            padding: "1px 8px",
          }}
        >
          {statusLabel}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {admin && onDecide && v.status !== "approved" && (
            <button onClick={() => onDecide(v.id, "approved")} style={smallBtn("#00c875")}>
              Genehmigen
            </button>
          )}
          {admin && onDecide && v.status !== "rejected" && (
            <button onClick={() => onDecide(v.id, "rejected")} style={smallBtn("#e2445c")}>
              Ablehnen
            </button>
          )}
          {canDelete && onDelete && (
            <button
              onClick={() => onDelete(v.id)}
              title="Löschen"
              style={{ ...smallBtn("var(--muted)"), border: "1px solid var(--border)" }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {v.reason && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
          {v.reason}
        </div>
      )}
      {v.warnings.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {v.warnings.map((w, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: "#fdab3d",
                background: "#fdab3d18",
                border: "1px solid #fdab3d55",
                borderRadius: 6,
                padding: "4px 8px",
              }}
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------- Recruiting --------------------------------

function RecruitingTab({
  isAdmin,
  applicants,
  employees,
}: {
  isAdmin: boolean;
  applicants: ApplicantView[];
  employees: Emp[];
}) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {isAdmin && (
        <section>
          <h2 style={h2}>Bewerber anlegen</h2>
          <form
            action={createApplicant}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}
          >
            <Field label="Name">
              <input name="name" required style={input} />
            </Field>
            <Field label="Position">
              <input name="position" placeholder="z. B. Grafik" style={input} />
            </Field>
            <Field label="CV-Link">
              <input name="cv_url" placeholder="https://…" style={input} />
            </Field>
            <button style={btn}>Anlegen</button>
          </form>
        </section>
      )}

      <section>
        <h2 style={h2}>Bewerber</h2>
        {applicants.length === 0 ? (
          <p style={empty}>
            {isAdmin
              ? "Noch keine Bewerber."
              : "Dir sind aktuell keine Bewerber zugewiesen."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {applicants.map((a) => (
              <ApplicantCard key={a.id} a={a} isAdmin={isAdmin} employees={employees} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ApplicantCard({
  a,
  isAdmin,
  employees,
}: {
  a: ApplicantView;
  isAdmin: boolean;
  employees: Emp[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [note, setNote] = useState("");

  const refreshDetail = async () => {
    const d = await getApplicantDetail(a.id);
    setDetail(d);
  };
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) await refreshDetail();
  };
  const doVote = async (value: 1 | -1) => {
    await vote(a.id, value);
    router.refresh();
  };
  const changeStage = async (stage: string) => {
    await setStage(a.id, stage);
    router.refresh();
  };
  const submitNote = async () => {
    if (!note.trim()) return;
    await addNote(a.id, note);
    setNote("");
    await refreshDetail();
  };
  const invite = async (userId: string) => {
    if (!userId) return;
    await addReviewer(a.id, userId);
    await refreshDetail();
    router.refresh();
  };
  const uninvite = async (userId: string) => {
    await removeReviewer(a.id, userId);
    await refreshDetail();
    router.refresh();
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--panel)",
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15 }}>{a.name}</strong>
        {a.position && (
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{a.position}</span>
        )}
        {isAdmin ? (
          <select
            value={a.stage}
            onChange={(e) => changeStage(e.target.value)}
            style={{ ...input, width: 150, padding: "5px 8px" }}
          >
            {RECRUIT_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 12, color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 999, padding: "1px 8px" }}>
            {a.stage}
          </span>
        )}
        {a.cvUrl && (
          <a href={a.cvUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent)" }}>
            CV ↗
          </a>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => doVote(1)}
            style={voteBtn(a.myVote === 1, "#00c875")}
            title="Dafür"
          >
            👍 {a.up}
          </button>
          <button
            onClick={() => doVote(-1)}
            style={voteBtn(a.myVote === -1, "#e2445c")}
            title="Dagegen"
          >
            👎 {a.down}
          </button>
          <button onClick={toggle} style={{ ...smallBtn("var(--muted)"), border: "1px solid var(--border)" }}>
            {open ? "Weniger" : "Details"}
          </button>
          {isAdmin && (
            <button
              onClick={async () => {
                if (confirm(`Bewerber „${a.name}" löschen?`)) {
                  await deleteApplicant(a.id);
                  router.refresh();
                }
              }}
              title="Löschen"
              style={smallBtn("var(--danger)")}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12, display: "grid", gap: 12 }}>
          {/* Reviewers (admin manages) */}
          {isAdmin && (
            <div>
              <div style={subHead}>Reviewer</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                {(detail?.reviewers ?? []).map((r) => (
                  <span
                    key={r.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "2px 4px 2px 10px",
                    }}
                  >
                    {r.name}
                    <button
                      onClick={() => uninvite(r.id)}
                      style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer" }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <select
                  onChange={(e) => {
                    invite(e.target.value);
                    e.target.value = "";
                  }}
                  defaultValue=""
                  style={{ ...input, width: 180, padding: "5px 8px" }}
                >
                  <option value="">+ Reviewer einladen…</option>
                  {employees
                    .filter((e) => !(detail?.reviewers ?? []).some((r) => r.id === e.id))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div style={subHead}>Notizen</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Notiz / Gesprächsnotiz…"
                style={input}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNote();
                }}
              />
              <button onClick={submitNote} style={btn}>
                Hinzufügen
              </button>
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {(detail?.notes ?? []).map((n) => (
                <div key={n.id} style={{ fontSize: 13 }}>
                  <strong>{n.author}</strong>{" "}
                  <span style={{ color: "var(--faint)", fontSize: 11 }}>
                    {fmt(n.at.slice(0, 10))}
                  </span>
                  <div style={{ color: "var(--muted)", whiteSpace: "pre-wrap" }}>
                    {n.body}
                  </div>
                </div>
              ))}
              {detail && detail.notes.length === 0 && (
                <p style={empty}>Noch keine Notizen.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------- shared ----------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
      {label}
      {children}
    </label>
  );
}

function fmt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

const h2: React.CSSProperties = { fontSize: 16, margin: "0 0 10px" };
const empty: React.CSSProperties = { color: "var(--faint)", fontSize: 14 };
const subHead: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--faint)",
  fontWeight: 700,
};
const input: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 13,
  minWidth: 130,
};
const btn: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 14px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const smallBtn = (color: string): React.CSSProperties => ({
  background: "transparent",
  border: `1px solid ${color}55`,
  borderRadius: 8,
  padding: "5px 10px",
  color,
  fontSize: 13,
  cursor: "pointer",
});
const voteBtn = (on: boolean, color: string): React.CSSProperties => ({
  background: on ? color + "22" : "transparent",
  border: `1px solid ${on ? color : "var(--border)"}`,
  borderRadius: 8,
  padding: "4px 10px",
  color: on ? color : "var(--text)",
  fontSize: 13,
  cursor: "pointer",
});
