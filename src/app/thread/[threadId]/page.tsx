"use client";

import { use } from "react";
import { SessionProvider } from "next-auth/react";
import { MainLayout } from "@/components/layout/MainLayout";

interface ThreadPageProps {
  params: Promise<{
    threadId: string;
  }>;
}

export default function ThreadPage({ params }: ThreadPageProps) {
  const { threadId } = use(params);

  return (
    <SessionProvider>
      <MainLayout threadId={threadId} />
    </SessionProvider>
  );
}
