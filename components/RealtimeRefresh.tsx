"use client";

// Subscribes to Supabase Realtime changes and re-fetches the current server
// component (via router.refresh()) whenever a relevant row changes. Realtime is
// RLS-filtered, so a customer only ever receives events for their own board.
//
// We deliberately re-fetch instead of mutating client state: router.refresh()
// re-runs the RLS-scoped server query, so what renders is always exactly what
// the user is allowed to see — no risk of a realtime payload leaking a field
// the page query would have hidden.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface RealtimeSub {
  table: string;
  filter?: string; // e.g. "board_id=eq.<uuid>"
}

export default function RealtimeRefresh({
  channel,
  subscriptions,
}: {
  channel: string;
  subscriptions: RealtimeSub[];
}) {
  const router = useRouter();
  const key = JSON.stringify(subscriptions);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(channel);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150); // debounce bursts
    };

    for (const sub of subscriptions) {
      ch.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        scheduleRefresh,
      );
    }

    ch.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
    // key captures the subscription list; channel/router are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, key]);

  return null;
}
