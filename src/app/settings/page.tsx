"use client";

import { SessionProvider } from "next-auth/react";
import SettingsPage from "@/components/settings/SettingsPage";

export default function Settings() {
  return (
    <SessionProvider>
      <SettingsPage />
    </SessionProvider>
  );
}
