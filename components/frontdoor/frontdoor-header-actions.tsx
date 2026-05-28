import Link from "next/link";
import { resolveFrontdoorAuthState } from "@/lib/auth/frontdoorAuthState";

type FrontdoorHeaderActionsProps = {
  currentPath: "/" | "/brains";
};

const secondaryLinkClass =
  "rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]";
const primaryLinkClass =
  "rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]";

export default async function FrontdoorHeaderActions({ currentPath }: FrontdoorHeaderActionsProps) {
  const authState = await resolveFrontdoorAuthState();
  const signedIn = authState.status === "signed-in";

  return (
    <div
      data-testid="frontdoor-header-actions"
      className="flex flex-wrap items-center justify-start gap-2 sm:justify-end"
    >
      {currentPath !== "/" ? (
        <Link href="/" className={secondaryLinkClass}>
          Home
        </Link>
      ) : null}

      <Link href="/brains" className={signedIn ? primaryLinkClass : secondaryLinkClass}>
        Open Brains
      </Link>

      {signedIn ? (
        <div
          data-testid="frontdoor-authenticated-state"
          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700"
        >
          Signed in
        </div>
      ) : (
        <>
          <Link href="/sign-in" className={secondaryLinkClass}>
            Sign in
          </Link>
          <Link href="/sign-up" className={secondaryLinkClass}>
            Create account
          </Link>
        </>
      )}
    </div>
  );
}
