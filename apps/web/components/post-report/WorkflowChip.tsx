"use client";

import { Badge } from "@/components/ui/badge";

const WORKFLOW_LABELS: Record<string, string> = {
  money_movement_fraud: "Money Movement Fraud",
  identity_account_control: "Identity & Account Control",
  personal_safety_extortion: "Personal Safety & Extortion",
  device_data_compromise: "Device & Data Compromise",
  platform_content_suspect: "Platform & Suspect Content",
};

interface WorkflowChipProps {
  workflow: string;
  isPrimary?: boolean;
}

export function WorkflowChip({ workflow, isPrimary = false }: WorkflowChipProps) {
  const label = WORKFLOW_LABELS[workflow] || workflow.replace(/_/g, " ");
  return (
    <Badge
      variant={isPrimary ? "default" : "secondary"}
      className="capitalize px-3 py-1 font-semibold"
    >
      {isPrimary ? "Primary: " : "Secondary: "} {label}
    </Badge>
  );
}
