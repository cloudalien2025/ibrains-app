import { SignIn } from "@clerk/nextjs";
import { resolveClerkRouteContract, resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export default function SignInPage() {
  const runtimeContract = resolveClerkRuntimeContract();
  const routeContract = resolveClerkRouteContract();

  if (!runtimeContract.publishableKey) {
    return (
      <div className="ibrains-shell flex min-h-screen items-center justify-center p-6 text-[#334155]">
        <div className="w-full max-w-lg rounded-xl border border-amber-300/50 bg-amber-100 p-5 text-sm text-amber-700">
          Clerk auth is not configured. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY`.
        </div>
      </div>
    );
  }

  return (
    <div className="ibrains-shell flex min-h-screen items-center justify-center p-6">
      <SignIn
        fallbackRedirectUrl={routeContract.signInFallbackRedirectUrl}
        path={routeContract.signInUrl}
        routing="path"
        signUpUrl={routeContract.signUpUrl}
      />
    </div>
  );
}
