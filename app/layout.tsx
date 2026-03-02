import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "iBrains",
  description: "Operational intelligence for platform teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const chunkRecoveryScript = `
    (function () {
      if (typeof window === "undefined") return;
      var KEY = "__ibrains_chunk_recover_once__";
      function isChunkErrorMessage(message) {
        if (!message) return false;
        return /Loading chunk\\s+\\d+\\s+failed/i.test(message) ||
          /ChunkLoadError/i.test(message) ||
          /Failed to fetch dynamically imported module/i.test(message);
      }
      function recover(reason) {
        try {
          var url = new URL(window.location.href);
          url.searchParams.delete("__chunk_recover");
          url.searchParams.delete("__chunk_reason");
          var pathKey = url.pathname + url.search;
          var seen = window.sessionStorage.getItem(KEY);
          if (seen === pathKey) return;
          window.sessionStorage.setItem(KEY, pathKey);
          url.searchParams.set("__chunk_recover", String(Date.now()));
          if (reason) url.searchParams.set("__chunk_reason", reason.slice(0, 40));
          window.location.replace(url.toString());
        } catch (_e) {
          window.location.reload();
        }
      }
      window.addEventListener("error", function (event) {
        var target = event && event.target;
        var source = target && target.src ? String(target.src) : "";
        if (source.indexOf("/_next/static/chunks/") !== -1) {
          recover("script");
          return;
        }
        if (isChunkErrorMessage(event && event.message ? String(event.message) : "")) {
          recover("window-error");
        }
      }, true);
      window.addEventListener("unhandledrejection", function (event) {
        var reason = event && event.reason;
        var message = "";
        if (typeof reason === "string") message = reason;
        else if (reason && typeof reason.message === "string") message = reason.message;
        if (isChunkErrorMessage(message)) {
          recover("promise");
        }
      });
    })();
  `;

  return (
    <html lang="en">
      <body
        className="antialiased bg-slate-950 text-slate-100"
        style={{ backgroundColor: "#020617", color: "#e2e8f0" }}
      >
        <Script
          id="chunk-recovery"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: chunkRecoveryScript }}
        />
        {children}
      </body>
    </html>
  );
}
