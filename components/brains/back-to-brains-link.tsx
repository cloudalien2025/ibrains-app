"use client";

import Link from "next/link";

type BackToBrainsLinkProps = {
  className?: string;
};

export default function BackToBrainsLink({ className }: BackToBrainsLinkProps) {
  return (
    <Link href="/brains" className={className ?? "text-sm text-[#2563EB] hover:text-[#1D4ED8]"}>
      ← iBrains Dashboard
    </Link>
  );
}
