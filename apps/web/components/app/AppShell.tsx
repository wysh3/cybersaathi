"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { AppBackground } from "@/components/app/AppBackground";
import { DesktopSidebar } from "@/components/app/DesktopSidebar";
import { MobileBottomNav } from "@/components/app/MobileBottomNav";
import { MobileTopBar } from "@/components/app/MobileTopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  return (
    <>
      <AdminLoginModal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onLoginSuccess={() => {
          setAdminModalOpen(false);
          router.push("/admin/dashboard");
        }}
      />
      <AppBackground />
      <MobileTopBar />
      <div className="flex min-h-dvh w-full">
        <DesktopSidebar onAdminClick={() => setAdminModalOpen(true)} />
        <main
          id="main"
          data-print="root"
          className="flex min-w-0 flex-1 flex-col px-4 pb-28 pt-5 sm:px-6 md:px-12 md:pb-10 md:pt-8 xl:px-16"
        >
          {children}
        </main>
      </div>
      <MobileBottomNav onAdminClick={() => setAdminModalOpen(true)} />
    </>
  );
}
