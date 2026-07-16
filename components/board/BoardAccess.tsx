"use client";

import { useEffect, useState, useTransition } from "react";
import {
  type BoardMember,
  inviteBoardCustomer,
  listBoardCustomers,
  removeBoardCustomer,
} from "@/app/(app)/boards/[id]/actions";
import Icon from "@/components/icons";
import { toast } from "@/components/toast";

// Toolbar button (customer boards, admins) to invite customers and manage who
// has access to this board.
export default function BoardAccess({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => listBoardCustomers(boardId).then(setMembers);
  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openPanel = () => {
    setOpen(true);
    requestAnimationFrame(() => setShown(true));
  };
  const closePanel = () => {
    setShown(false);
    setTimeout(() => setOpen(false), 220);
  };

  const invite = () => {
    if (!email.trim()) return;
    start(async () => {
      const res = await inviteBoardCustomer(boardId, email, name);
      setMsg(res.message);
      if (res.ok) {
        setEmail("");
        setName("");
        toast("Einladung gesendet");
        await load();
      }
    });
  };

  const remove = (m: BoardMember) => {
    if (!confirm(`Zugriff von „${m.name}" entfernen? Der Account wird gelöscht.`))
      return;
    start(async () => {
      const res = await removeBoardCustomer(boardId, m.id);
      if (res.ok) {
        toast("Zugriff entfernt");
        await load();
      } else setMsg(res.message);
    });
  };

  return (
    <>
      <button onClick={openPanel} style={toolBtn} title="Kundenzugriff verwalten">
        <Icon name="user" size={16} /> Zugriff
      </button>

      {open && (
        <>
          <div
            onClick={closePanel}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 90,
              opacity: shown ? 1 : 0,
              transition: "opacity 220ms ease",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100%)",
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
              zIndex: 91,
              display: "flex",
              flexDirection: "column",
              transform: shown ? "translateX(0)" : "translateX(100%)",
              transition: "transform 220ms cubic-bezier(0.22,1,0.36,1)",
              boxShadow: "-12px 0 40px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <strong style={{ fontSize: 15 }}>Kundenzugriff</strong>
              <button onClick={closePanel} style={iconBtn} title="Schließen">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
              {/* Invite */}
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                Kund:in per E-Mail einladen. Sie erhält einen Link zum Passwort-Setzen
                und sieht danach nur dieses Board.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name (optional)"
                  style={input}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="E-Mail"
                    style={{ ...input, flex: 1 }}
                    onKeyDown={(e) => e.key === "Enter" && invite()}
                  />
                  <button onClick={invite} disabled={pending || !email.trim()} style={primaryBtn}>
                    Einladen
                  </button>
                </div>
              </div>
              {msg && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                  {msg}
                </div>
              )}

              {/* Members */}
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: "var(--faint)",
                  fontWeight: 700,
                  margin: "20px 0 8px",
                }}
              >
                Zugriff ({members.length})
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {members.length === 0 && (
                  <div style={{ color: "var(--faint)", fontSize: 13 }}>
                    Noch keine Kund:innen eingeladen.
                  </div>
                )}
                {members.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                      {m.email && (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {m.email}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => remove(m)}
                      title="Zugriff entfernen"
                      style={{ ...iconBtn, color: "var(--danger)" }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 12 }}>
                Alle Mitarbeiter haben ohnehin Zugriff auf alle Boards. Hier
                verwaltest du nur die Kund:innen dieses Boards.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const toolBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--muted)",
  cursor: "pointer",
};
const iconBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  display: "inline-flex",
};
const input: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 11px",
  color: "var(--text)",
  fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
