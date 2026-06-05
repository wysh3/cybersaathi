"use client";

import { useState } from "react";
import { Calendar, Link2, ChevronDown, ChevronRight, Globe, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface FollowUpItem {
  after: string;
  action: string;
}

interface OfficialPath {
  label: string;
  url: string;
  note: string;
}

interface FollowUpTimelineProps {
  schedule: FollowUpItem[];
  officialPaths: OfficialPath[];
}

export function FollowUpTimeline({ schedule, officialPaths }: FollowUpTimelineProps) {
  const [showBehindScenes, setShowBehindScenes] = useState(false);
  const reminderCount = schedule.length;

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-sky-700" />
          <CardTitle className="text-base font-bold text-ink-900">
            Action Timeline & Escalation Path
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-ink-600">
          Track official responses and follow this timeline if updates are delayed. {reminderCount} reminders prepared.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 flex flex-col gap-6">
        
        {/* Timeline Grid (4 Columns on Desktop, Vertical Stack on Mobile) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Day 0 Card */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/5 p-4 hover:border-sky-200 transition-colors">
            <div>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                  Day 0
                </span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-full">
                  Step 1
                </span>
              </div>
              <h4 className="text-xs font-bold text-foreground">
                Submit Drafts & Portals
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                File the CyberSaathi generated NCRP complaint draft and send the bank nodal dispute email immediately.
              </p>
            </div>
            
            {/* Embedded Portal Links */}
            {officialPaths && officialPaths.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-3 bg-muted/20 p-2 rounded-lg border border-border/40">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Globe className="size-3" /> Action Links:
                </p>
                {officialPaths.map((p, idx) => (
                  <a
                    key={idx}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded bg-background p-1.5 text-[10px] font-semibold border border-border/60 hover:bg-accent hover:text-sky-700 transition-all truncate"
                  >
                    <span className="truncate">{p.label}</span>
                    <Link2 className="size-3 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Day 1-3 Card */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/5 p-4 hover:border-sky-200 transition-colors">
            <div>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                  Day 1–3
                </span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-full">
                  Step 2
                </span>
              </div>
              <h4 className="text-xs font-bold text-foreground">
                Verify Bank Holds
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                Check with the sending/receiving banks to confirm if a hold has been successfully placed on the funds.
              </p>
            </div>
            
            <div className="mt-3 bg-sky-50/50 p-2 rounded-lg border border-sky-100 text-[10px] leading-normal text-sky-850">
              <span className="font-bold block text-sky-900 mb-0.5">⚠️ No notice received?</span>
              Email your transaction receipt and NCRP ID to both banks&apos; Nodal Officers.
            </div>
          </div>

          {/* Day 7 Card */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/5 p-4 hover:border-sky-200 transition-colors">
            <div>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                  Day 7
                </span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-full">
                  Step 3
                </span>
              </div>
              <h4 className="text-xs font-bold text-foreground">
                Visit Cyber Cell
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                If the NCRP portal status remains &quot;Pending&quot; and no status change occurs, escalate locally.
              </p>
            </div>
            
            <div className="mt-3 bg-saffron-50/50 p-2 rounded-lg border border-saffron-100 text-[10px] leading-normal text-saffron-850">
              <span className="font-bold block text-saffron-900 mb-0.5">⚠️ No response yet?</span>
              Print the CyberSaathi PDF dossier and visit the nearest cyber crime police station.
            </div>
          </div>

          {/* Day 15-30 Card */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/5 p-4 hover:border-sky-200 transition-colors">
            <div>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                  Day 15–30
                </span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-full">
                  Step 4
                </span>
              </div>
              <h4 className="text-xs font-bold text-foreground">
                Case Resolution
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                Typical resolution timeline for reversal of held/blocked funds under police directions.
              </p>
            </div>
            
            <div className="mt-3 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 text-[10px] leading-normal text-emerald-850">
              <span className="font-bold block text-emerald-900 mb-0.5">❓ Still unresolved?</span>
              Submit a formal grievance to the Reserve Bank of India Retail Banking Ombudsman.
            </div>
          </div>

        </div>

        {/* Collapsible Behind-The-Scenes Info Section */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowBehindScenes(!showBehindScenes)}
            className="flex w-full items-center justify-between text-xs font-bold text-ink-700 hover:text-sky-700 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="size-4 text-sky-700" />
              <span>How the government & banking process works behind the scenes</span>
            </span>
            {showBehindScenes ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          
          {showBehindScenes && (
            <div className="mt-3 grid gap-4 sm:grid-cols-3 rounded-xl border border-border/70 bg-muted/10 p-4 text-[11px] leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
              <div>
                <span className="font-bold text-ink-900 block mb-1">1. Helpline & Nodal Alert (Immediate)</span>
                Once a complaint is recorded via 1930 or the NCRP Portal, the system pushes a direct request to the fraudster&apos;s receiving bank nodal desk to freeze/hold the stolen transaction amount.
              </div>
              <div>
                <span className="font-bold text-ink-900 block mb-1">2. Police Jurisdiction (1 to 7 Days)</span>
                NCRP routes your complaint to the cyber cell of your local police jurisdiction. An officer reviews the facts, coordinates with bank portals, and registers an official report if funds are traceable.
              </div>
              <div>
                <span className="font-bold text-ink-900 block mb-1">3. Fund Reversal (15 to 30 Days)</span>
                Once funds are successfully blocked and verified, the court or designated police officer issues a release request to banks to reverse the held funds back to the victim&apos;s account.
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
