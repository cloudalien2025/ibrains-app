import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  clerkProviderProps: null as Record<string, unknown> | null,
}));

vi.mock("@clerk/nextjs", async () => {
  const React = await import("react");

  return {
    ClerkProvider: ({ children, ...props }: { children: ReactNode }) => {
      mocks.clerkProviderProps = props as Record<string, unknown>;
      return React.createElement("div", { "data-testid": "clerk-provider" }, children);
    },
    SignIn: (props: { path?: string }) =>
      React.createElement("div", { "data-testid": "clerk-sign-in", "data-path": props.path ?? "" }),
    SignUp: (props: { path?: string }) =>
      React.createElement("div", { "data-testid": "clerk-sign-up", "data-path": props.path ?? "" }),
  };
});

describe("clerk auth route runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.clerkProviderProps = null;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_runtime_contract";
    delete process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL;
  });

  it("sign-in route renders SignIn when unauthenticated", async () => {
    const { default: SignInPage } = await import("@/app/sign-in/[[...sign-in]]/page");
    const html = renderToStaticMarkup(<SignInPage />);

    expect(html).toContain("clerk-sign-in");
    expect(html).toContain('data-path="/sign-in"');
  });

  it("sign-up route renders SignUp when unauthenticated", async () => {
    const { default: SignUpPage } = await import("@/app/sign-up/[[...sign-up]]/page");
    const html = renderToStaticMarkup(<SignUpPage />);

    expect(html).toContain("clerk-sign-up");
    expect(html).toContain('data-path="/sign-up"');
  });

  it("ConfiguredClerkProvider receives signInUrl/signUpUrl route contract values", async () => {
    const { default: SignInPage } = await import("@/app/sign-in/[[...sign-in]]/page");
    renderToStaticMarkup(<SignInPage />);

    expect(mocks.clerkProviderProps).toMatchObject({
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      signInFallbackRedirectUrl: "/brains",
      signUpFallbackRedirectUrl: "/brains",
    });
  });

  it("passes server-resolved CLERK_PUBLISHABLE_KEY into ConfiguredClerkProvider when NEXT_PUBLIC is absent", async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    process.env.CLERK_PUBLISHABLE_KEY = "pk_live_server_runtime";

    const { default: SignInPage } = await import("@/app/sign-in/[[...sign-in]]/page");
    renderToStaticMarkup(<SignInPage />);

    expect(mocks.clerkProviderProps).toMatchObject({
      publishableKey: "pk_live_server_runtime",
    });
  });

  it("omits proxyUrl when NEXT_PUBLIC_CLERK_PROXY_URL is blank", async () => {
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL = "";

    const { default: SignInPage } = await import("@/app/sign-in/[[...sign-in]]/page");
    renderToStaticMarkup(<SignInPage />);

    expect(mocks.clerkProviderProps).not.toHaveProperty("proxyUrl");
  });

  it("passes proxyUrl when NEXT_PUBLIC_CLERK_PROXY_URL is non-empty", async () => {
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL = "  https://app.ibrains.ai/__clerk/  ";

    const { default: SignInPage } = await import("@/app/sign-in/[[...sign-in]]/page");
    renderToStaticMarkup(<SignInPage />);

    expect(mocks.clerkProviderProps).toMatchObject({
      proxyUrl: "https://app.ibrains.ai/__clerk/",
    });
  });
});
