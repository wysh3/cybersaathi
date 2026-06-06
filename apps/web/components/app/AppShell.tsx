"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppBackground } from "@/components/app/AppBackground";
import { DesktopSidebar } from "@/components/app/DesktopSidebar";
import { MobileBottomNav } from "@/components/app/MobileBottomNav";
import { MobileTopBar } from "@/components/app/MobileTopBar";
import { AdminLoginModal } from "@/components/admin/AdminLoginModal";

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
      <div className="mx-auto min-h-screen w-full max-w-[1680px] px-0 py-0 md:px-8 md:py-8 xl:px-12">
        <div
          data-app-chrome="true"
          className="mx-auto min-h-screen w-full overflow-hidden bg-sky-50/70 shadow-glass backdrop-blur-2xl md:min-h-[calc(100vh-4rem)] md:rounded-[34px] md:border md:border-white/70 md:bg-white/38"
        >
          <div className="grid min-h-screen md:min-h-[calc(100vh-4rem)] md:grid-cols-[260px_minmax(0,1fr)]">
            <DesktopSidebar onAdminClick={() => setAdminModalOpen(true)} />
            <section className="flex min-w-0 flex-col">
              <header
                data-app-chrome="true"
                className="hidden h-[92px] items-center justify-between border-b border-white/45 px-10 md:flex"
              >
                <div className="flex-1" />
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAdminModalOpen(true)}
                    className="h-10 rounded-full border-white/50 bg-white/40 px-4 font-medium text-ink-700 hover:bg-white/70"
                    title="Authority Access"
                  >
                    <ShieldCheck className="size-4" />
                    <span className="ml-1.5 hidden lg:inline">Admin</span>
                  </Button>
                  <Button
                    asChild
                    variant="destructive"
                    className="h-12 rounded-full bg-emergency-soft px-6 font-semibold text-emergency shadow-glass-soft hover:bg-emergency-soft/90"
                  >
                    <a href="tel:1930" aria-label="Call 1930 cybercrime helpline">
                      <Phone className="size-4" aria-hidden />
                      Emergency SOS
                    </a>
                  </Button>

                </div>
              </header>
              <main
                id="main"
                data-print="root"
                className="flex-1 px-4 pb-28 pt-5 sm:px-6 md:px-12 md:pb-10 md:pt-8 xl:px-16"
              >
                {children}
              </main>
            </section>
          </div>
        </div>
      </div>
      <MobileBottomNav onAdminClick={() => setAdminModalOpen(true)} />
    </>
  );
}
