"use client";

import { useState, useTransition } from "react";
import { updateOwnName } from "@/app/(app)/profile/actions";
import { toast } from "@/components/toast";

export default function ProfileNameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        const fd = new FormData();
        fd.set("full_name", n);
        start(async () => {
          await updateOwnName(fd);
          toast("Profil gespeichert");
        });
      }}
      style={{ display: "flex", gap: 8 }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Vor- und Nachname"
        required
        style={{
          flex: 1,
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "9px 12px",
          color: "var(--text)",
          fontSize: 14,
        }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "9px 16px",
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        {pending ? "…" : "Speichern"}
      </button>
    </form>
  );
}
