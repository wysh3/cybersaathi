"use client";

import { useEffect, useState } from "react";

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { StatusBadge } from "@/components/app/StatusBadge";

import type { GeneratedDocument } from "@/lib/types";

import { DOCUMENT_TABS, type DocumentTabKey } from "./DocumentActionCard";

/**
 * DocumentWorkspace — the editable draft surface. Owns the active tab
 * state, the editable body, and the copy/download actions. Renders
 * the tabs in a TabsList (hidden in print) and the editor with monospace
 * for the body.
 */
export function DocumentWorkspace({
  documents,
}: {
  documents: GeneratedDocument[];
}) {
  const [activeDoc, setActiveDoc] = useState<DocumentTabKey>(
    "ncrp_complaint_draft",
  );
  const activeDocument =
    documents.find((doc) => doc.kind === activeDoc) ?? null;
  const [editableBody, setEditableBody] = useState<string>(
    activeDocument?.editable_body ?? "",
  );

  useEffect(() => {
    void (() => {
      setEditableBody(activeDocument?.editable_body ?? "");
    })();
  }, [activeDocument?.id, activeDocument?.editable_body]);

  function copyActive() {
    if (!editableBody) return;
    void navigator.clipboard.writeText(editableBody);
    toast.success("Copied to clipboard");
  }

  function downloadActive() {
    if (!activeDocument) return;
    const blob = new Blob([editableBody], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeDocument.kind}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="overflow-hidden" data-print="surface">
      <Tabs
        value={activeDoc}
        onValueChange={(v) => setActiveDoc(v as DocumentTabKey)}
        data-print="hide"
        className="no-print"
      >
        <CardHeader>
          <div className="flex flex-col gap-1.5">
            <CardTitle className="font-serif-display">
              {activeDocument?.title ?? "Document"}
            </CardTitle>
            <CardDescription>
              Generated{" "}
              {activeDocument
                ? new Date(activeDocument.created_at).toLocaleString("en-IN")
                : "—"}
            </CardDescription>
          </div>
          <TabsList>
            {DOCUMENT_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.key} value={tab.key}>
                  <Icon className="size-3.5" aria-hidden />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {DOCUMENT_TABS.map((tab) => (
            <TabsContent key={tab.key} value={tab.key}>
              {activeDocument?.kind === tab.key ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge label="Draft" tone="saffron" />
                      <Badge variant="outline" className="rounded-full font-mono">
                        {tab.description}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyActive}
                        disabled={!editableBody}
                      >
                        <Copy aria-hidden />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={downloadActive}
                        disabled={!editableBody}
                      >
                        <Download aria-hidden />
                        Download
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[460px] rounded-md border border-border bg-muted/30">
                    <Textarea
                      value={editableBody}
                      onChange={(event) =>
                        setEditableBody(event.target.value)
                      }
                      className="min-h-[440px] resize-none border-0 bg-transparent font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
                      aria-label="Editable document body"
                      spellCheck
                    />
                  </ScrollArea>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Document not available.
                </p>
              )}
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>
    </Card>
  );
}
