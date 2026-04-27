import { SignUp } from "@clerk/nextjs";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import { resolveClerkRouteContract, resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export default function SignUpPage() {
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
    <ConfiguredClerkProvider>
      <div className="ibrains-shell flex min-h-screen items-center justify-center p-6">
        <SignUp
          fallbackRedirectUrl={routeContract.signUpFallbackRedirectUrl}
          path={routeContract.signUpUrl}
          routing="path"
          signInUrl={routeContract.signInUrl}
        />
      </div>
    </ConfiguredClerkProvider>
  );
}
