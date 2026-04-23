import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
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
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}
