import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "sky" | "emerald" | "amber" | "rose" | "slate";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = React.memo(
  ({ children, variant = "sky", size = "sm", className = "" }) => {
    const variantMap = {
      sky: "bg-m3-primary/10 text-m3-primary border-m3-primary/20",
      emerald:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      amber:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      slate: "bg-m3-hover text-m3-secondary border-m3-border",
    };

    const sizeMap = {
      sm: "px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
      md: "px-2.5 py-1 text-[11px] font-black uppercase tracking-widest",
    };

    return (
      <span
        className={`inline-flex items-center rounded-lg border ${variantMap[variant]} ${sizeMap[size]} ${className}`}
      >
        {children}
      </span>
    );
  },
);
