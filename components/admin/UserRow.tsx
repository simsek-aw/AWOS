"use client";

import { useState } from "react";
import {
  deleteUser,
  sendPasswordReset,
  setUserAdmin,
  setUserPassword,
  updateUser,
} from "@/app/admin/actions";
import type { Customer, Profile } from "@/lib/types";

const deptLabel: Record<string, string> = {
  marketing: "Marketing",
  content: "Content",
  grafik: "Grafik",
};

export default function UserRow({
  profile,
  email,
  customers,
  isSelf,
}: {
  profile: Profile;
  email: string | null;
  customers: Customer[];
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(profile.role);
  const customerName = customers.find((c) => c.id === profile.customer_id)?.name;

  return (
    <li style={rowWrap}>
      <div
        style={{ ...rowHead, cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
        title="Zum Bearbeiten klicken"
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600 }}>{profile.full_name ?? "—"}</span>
          {email && (
            <span style={{ color: "var(--faint)", fontSize: 12 }}>{email}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {profile.is_admin && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                background: "var(--accent)",
                borderRadius: 999,
                padding: "1px 8px",
              }}
            >
              Admin
            </span>
          )}
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {profile.role === "employee"
              ? `Mitarbeiter${profile.department ? " · " + deptLabel[profile.department] : ""}`
              : `Kunde · ${customerName ?? "?"}`}
          </span>
          <span style={linkBtn}>{open ? "Schließen" : "Bearbeiten"}</span>
        </div>
      </div>

      {open && (
        <div style={editorWrap}>
          {/* Profile edit */}
          <form action={updateUser} style={{ display: "grid", gap: 8 }}>
            <input type="hidden" name="user_id" value={profile.id} />
            <div style={formRow}>
              <input
                name="full_name"
                defaultValue={profile.full_name ?? ""}
                placeholder="Name"
                style={input}
              />
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Profile["role"])}
                style={input}
              >
                <option value="customer">Kunde</option>
                <option value="employee">Mitarbeiter</option>
              </select>
            </div>
            <div style={formRow}>
              <select
                name="customer_id"
                defaultValue={profile.customer_id ?? ""}
                style={{ ...input, opacity: role === "customer" ? 1 : 0.5 }}
                disabled={role !== "customer"}
              >
                <option value="">— Kunde wählen —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                name="department"
                defaultValue={profile.department ?? ""}
                style={{ ...input, opacity: role === "employee" ? 1 : 0.5 }}
                disabled={role !== "employee"}
              >
                <option value="">— Abteilung (optional) —</option>
                <option value="marketing">Marketing</option>
                <option value="content">Content</option>
                <option value="grafik">Grafik</option>
              </select>
            </div>
            <button style={{ ...button, justifySelf: "start" }}>
              Änderungen speichern
            </button>
          </form>

          {profile.role === "employee" && (
            <form action={setUserAdmin} style={{ marginTop: 8 }}>
              <input type="hidden" name="user_id" value={profile.id} />
              <input
                type="hidden"
                name="is_admin"
                value={profile.is_admin ? "0" : "1"}
              />
              <button
                style={profile.is_admin ? dangerBtn : button}
                disabled={isSelf && !!profile.is_admin}
                title={
                  isSelf && profile.is_admin
                    ? "Eigene Admin-Rechte können nicht entzogen werden"
                    : undefined
                }
              >
                {profile.is_admin ? "Admin-Recht entziehen" : "Zum Admin machen"}
              </button>
            </form>
          )}

          <hr style={hr} />

          {/* Set password directly */}
          <form action={setUserPassword} style={formRow}>
            <input type="hidden" name="user_id" value={profile.id} />
            <input
              name="password"
              type="text"
              placeholder="Neues Passwort (min. 8 Zeichen)"
              minLength={8}
              required
              style={input}
              autoComplete="off"
            />
            <button style={button}>Passwort setzen</button>
          </form>
          <p style={hint}>
            Setzt das Passwort sofort. Am einfachsten: Passwort setzen und dem
            Mitarbeiter mitteilen — er kann es nach dem Login selbst ändern.
          </p>

          {email && (
            <form action={sendPasswordReset} style={{ marginTop: 4 }}>
              <input type="hidden" name="email" value={email} />
              <button style={linkBtn}>Stattdessen Reset-Link per E-Mail senden</button>
            </form>
          )}

          <hr style={hr} />

          {/* Delete */}
          {!isSelf && (
            <form
              action={deleteUser}
              onSubmit={(e) => {
                if (
                  !confirm(
                    `Nutzer „${profile.full_name ?? email ?? profile.id}" wirklich löschen?`,
                  )
                )
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="user_id" value={profile.id} />
              <button style={dangerBtn}>Nutzer löschen</button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

const rowWrap: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
};

const rowHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const editorWrap: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid var(--border)",
  display: "grid",
  gap: 4,
};

const formRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 160,
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "var(--text)",
  fontSize: 14,
};

const button: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dangerBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--danger)",
  border: "1px solid var(--danger)",
  borderRadius: 8,
  padding: "8px 14px",
  fontWeight: 600,
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
};

const hr: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--border)",
  margin: "10px 0",
};

const hint: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "2px 0 0",
};
