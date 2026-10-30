import { createFileRoute } from "@tanstack/react-router";
import { ScanResultPage } from "../scan/$scanId";

export const Route = createFileRoute("/share/$shareId")({
  component: ScanResultPage,
  head: () => ({
    meta: [
      { title: "Shared Security Report — PoisonGuard" },
      { name: "description", content: "Public verification link for PoisonGuard address-poisoning and token approval audit." },
    ],
  }),
});

