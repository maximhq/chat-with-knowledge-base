"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ApiKeysSettings } from "@/components/settings/ApiKeysSettings";
import { Toaster } from "@/components/ui/sonner";
import { Settings, Key, ArrowLeft } from "lucide-react";

export interface SettingsSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  description?: string;
}

// Default settings sections - easily extensible
const defaultSections: SettingsSection[] = [
  {
    id: "api-keys",
    label: "API Keys",
    icon: Key,
    component: ApiKeysSettings,
    description: "Manage your API keys for programmatic access",
  },
  // Future sections can be added here:
  // {
  //   id: "profile",
  //   label: "Profile",
  //   icon: User,
  //   component: ProfileSettings,
  //   description: "Manage your profile and account settings",
  // },
  // {
  //   id: "notifications",
  //   label: "Notifications",
  //   icon: Bell,
  //   component: NotificationSettings,
  //   description: "Configure notification preferences",
  // },
  // {
  //   id: "security",
  //   label: "Security",
  //   icon: Shield,
  //   component: SecuritySettings,
  //   description: "Security and privacy settings",
  // },
];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("api-keys");

  // Allow for custom sections to be injected (future extensibility)
  const sections = defaultSections;

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  <h1 className="text-xl font-semibold">Settings</h1>
                </div>
              </div>

              {/* User Info */}
              {session?.user?.email && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{session.user.email}</p>
                    <p className="text-xs text-gray-500">Account Settings</p>
                  </div>
                  <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {session.user.email[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">
            {/* Settings Navigation */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Settings Categories
                </h2>
                <nav className="space-y-2">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                          activeSection === section.id
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{section.label}</div>
                          {section.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {section.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Settings Content */}
            <div className="flex-1 min-w-0">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="p-6">
                    {sections.map((section) => {
                      if (section.id !== activeSection) return null;
                      const Component = section.component;
                      return <Component key={section.id} />;
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>

        {/* Toast Notifications */}
        <Toaster position="top-right" />
      </div>
    </AuthGuard>
  );
}
