"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkflowStore } from "@/lib/workflow-store";
import { PostReportGuide } from "./PostReportGuide";
import { EducationNote } from "../documents/EducationNote";

export function ResponseGuideClient() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const {
    complaintId,
    hydrateFromCaseId,
    caseId: storeCaseId,
  } = useWorkflowStore();

  useEffect(() => {
    if (caseId && !complaintId && !storeCaseId) {
      hydrateFromCaseId(caseId).catch(() => {});
    }
  }, [caseId, complaintId, storeCaseId, hydrateFromCaseId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <PostReportGuide caseId={caseId} />
      <EducationNote />
    </div>
  );
}
