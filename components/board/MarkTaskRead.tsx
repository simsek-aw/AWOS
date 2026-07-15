"use client";

import { useEffect } from "react";
import { markTaskRead } from "@/app/(app)/boards/[id]/actions";

/** Marks a task's update thread as read for the current user on mount. */
export default function MarkTaskRead({ taskId }: { taskId: string }) {
  useEffect(() => {
    markTaskRead(taskId);
  }, [taskId]);
  return null;
}
