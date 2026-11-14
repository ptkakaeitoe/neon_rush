"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { audio } from "@/lib/audio";

/**
 * Flat button with three weights:
 * - primary: the one main action on a screen (accent fill)
 * - secondary: hairline outline
 * - ghost: text only
 */
const VARIANTS = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "border border-line-strong text-ink hover:border-white/30 hover:bg-white/[0.04]",
  ghost: "text-muted hover:text-ink",
} as const;

type Props = HTMLMotionProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: "sm" | "md" | "lg";
};

export function PixelButton({ variant = "secondary", size = "md", className = "", onMouseEnter, children, ...rest }: Props) {
  const sz =
    size === "lg" ? "h-12 px-6 text-sm" : size === "sm" ? "h-9 px-3 text-xs" : "h-10 px-4 text-[13px]";
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      onMouseEnter={(e) => {
        audio.sfx("hover");
        onMouseEnter?.(e);
      }}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-md font-medium transition-[color,background-color,border-color,filter] duration-150 ease-out cursor-pointer disabled:pointer-events-none disabled:opacity-35 ${VARIANTS[variant]} ${sz} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
