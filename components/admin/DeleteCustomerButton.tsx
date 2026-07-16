"use client";

import { deleteCustomer } from "@/app/admin/actions";

export default function DeleteCustomerButton({
  customerId,
  name,
  hasBoards,
}: {
  customerId: string;
  name: string;
  hasBoards: boolean;
}) {
  return (
    <form
      action={deleteCustomer}
      onSubmit={(e) => {
        if (
          !confirm(
            `Kunde „${name}" löschen? Zugehörige Kundenzugänge werden ebenfalls entfernt.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="customer_id" value={customerId} />
      <button
        title={hasBoards ? "Erst Boards löschen/archivieren" : "Kunde löschen"}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--faint)",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Löschen
      </button>
    </form>
  );
}
