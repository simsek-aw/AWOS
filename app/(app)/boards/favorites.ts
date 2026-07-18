"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

// Star / unstar a board for the current user. RLS ensures a user can only ever
// touch their own rows.
export async function toggleBoardFavorite(
  boardId: string,
  makeFavorite: boolean,
) {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();

  if (makeFavorite) {
    await supabase
      .from("board_favorites")
      .upsert(
        { user_id: ctx.userId, board_id: boardId },
        { onConflict: "user_id,board_id" },
      );
  } else {
    await supabase
      .from("board_favorites")
      .delete()
      .eq("user_id", ctx.userId)
      .eq("board_id", boardId);
  }

  // Refresh the sidebar (app layout) and the dashboard Favoriten section.
  revalidatePath("/", "layout");
}
