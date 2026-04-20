import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070a12] p-6 text-slate-200">
        <div className="w-full max-w-lg rounded-xl border border-amber-300/40 bg-amber-500/10 p-5 text-sm">
          Clerk auth is not configured. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY`.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a12] p-6">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
