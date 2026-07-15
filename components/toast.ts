// Tiny global toast helper. Fire-and-forget from any client component:
//   import { toast } from "@/components/toast";  toast("Gespeichert");
// A <Toaster/> mounted in the app shell renders them.
export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("awos-toast", { detail: { message } }),
  );
}
