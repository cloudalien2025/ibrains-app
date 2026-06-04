"use client";

import Link from "next/link";
import { Bell, BrainCircuit, LogOut, Settings } from "lucide-react";
import { SignOutButton, useUser } from "@clerk/nextjs";

function resolveUserLabel(
  user: ReturnType<typeof useUser>["user"],
  isLoaded: boolean
): string {
  if (!isLoaded) return "Loading account";
  if (!user) return "Signed in";

  const fullName = user.fullName?.trim();
  if (fullName) return fullName;

  const username = user.username?.trim();
  if (username) return username;

  const email = user.primaryEmailAddress?.emailAddress?.trim();
  if (email) return email;

  return "Signed in";
}

export default function IbrainsGlobalHeader() {
  const { user, isLoaded } = useUser();
  const userLabel = resolveUserLabel(user, isLoaded);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-[#1F3A5F] bg-[#061A2E] text-[#E2ECF8]"
      data-testid="ibrains-global-header"
    >
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5">
        <Link
          href="/brains"
          className="inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1 transition hover:bg-[#0A2947]"
          data-testid="ibrains-logo-link"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#0B5FFF] text-white">
            <BrainCircuit className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-semibold tracking-[0.02em]">iBrains</span>
        </Link>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[#D6E4F6] transition hover:bg-[#0A2947] sm:text-sm"
            data-testid="ibrains-header-settings"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>Settings</span>
          </Link>

          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[#D6E4F6] transition hover:bg-[#0A2947] sm:text-sm"
            data-testid="ibrains-header-notifications"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span>Notifications</span>
          </button>

          <span
            className="hidden max-w-[190px] truncate rounded-md border border-[#1A3B62] bg-[#0A2947] px-2 py-1.5 text-xs text-[#D6E4F6] sm:inline"
            data-testid="ibrains-header-user"
          >
            {userLabel}
          </span>

          <SignOutButton redirectUrl="/sign-in">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-[#1A3B62] bg-[#0B2540] px-2 py-1.5 text-xs font-medium text-white transition hover:bg-[#12365A] sm:text-sm"
              data-testid="ibrains-header-logout"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Log out</span>
            </button>
          </SignOutButton>
        </div>
      </div>
    </header>
  );
}
