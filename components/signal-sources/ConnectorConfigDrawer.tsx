"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type ConnectorConfigDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export default function ConnectorConfigDrawer({
  open,
  title,
  description,
  onOpenChange,
  children,
}: ConnectorConfigDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-cyan-300/20 bg-slate-950/95 p-6 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.75)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-slate-300">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-slate-200 transition hover:bg-white/10">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
