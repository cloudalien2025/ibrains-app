import type { ButtonHTMLAttributes, ReactNode } from "react";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export default function NeonButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: NeonButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60";

  const styles =
    variant === "primary"
      ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.28)] hover:bg-cyan-400/25"
      : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10";

  return (
    <button className={`${base} ${styles} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
