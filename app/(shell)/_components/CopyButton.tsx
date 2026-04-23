"use client";

import { useState } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

export default function CopyButton({ value, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ||
        "rounded-full border border-[#D9E4F0] bg-white px-3 py-1 text-xs font-medium text-[#0F172A] transition hover:bg-[#F8FBFF]"
      }
    >
      {copied ? "Copied" : label}
    </button>
  );
}
