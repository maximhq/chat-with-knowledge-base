"use client";

import { SessionProvider } from "next-auth/react";
import { MainLayout } from "@/components/layout/MainLayout";

export default function Home() {
  return (
    <SessionProvider>
      <MainLayout />
    </SessionProvider>
  );
}
