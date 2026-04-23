import type { ButtonHTMLAttributes } from "react";

type NeonButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export default function NeonButton({ variant = "primary", className, disabled, ...props }: NeonButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#93C5FD]";
  const primary =
    "border border-[#2563EB] bg-[#2563EB] text-white hover:border-[#1D4ED8] hover:bg-[#1D4ED8]";
  const secondary =
    "border border-[#D9E4F0] bg-white text-[#0F172A] hover:bg-[#F8FBFF]";
  const ghost =
    "border border-transparent bg-transparent text-[#0F172A] hover:bg-[#F1F5F9]";
  const disabledCls = "opacity-50 cursor-not-allowed";

  const variantCls = variant === "primary" ? primary : variant === "secondary" ? secondary : ghost;

  return (
    <button
      {...props}
      disabled={disabled}
      className={`${base} ${variantCls} ${disabled ? disabledCls : ""} ${className ?? ""}`}
    />
  );
}
