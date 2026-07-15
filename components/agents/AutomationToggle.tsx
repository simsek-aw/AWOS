"use client";

import { useState, useTransition } from "react";
import { setAutomation } from "@/app/(app)/agents/actions";
import type { AutomationKey } from "@/lib/agent/settings";

// A pill switch that enables/disables one automatic agent.
export default function AutomationToggle({
  agentKey,
  enabled,
}: {
  agentKey: AutomationKey;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next); // optimistic
    start(() => setAutomation(agentKey, next).catch(() => setOn(!next)));
  };

  return (
    <button
      onClick={toggle}
      disabled={pending}
      role="switch"
      aria-checked={on}
      title={on ? "Aktiv – klicken zum Deaktivieren" : "Inaktiv – klicken zum Aktivieren"}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "none",
        cursor: pending ? "default" : "pointer",
        background: on ? "var(--accent)" : "var(--surface-2)",
        transition: "background 150ms",
        flexShrink: 0,
        opacity: pending ? 0.7 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 150ms",
          boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}
