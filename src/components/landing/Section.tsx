import type { ReactNode } from "react";

interface SectionProps {
  id?: string;
  className?: string;
  children: ReactNode;
  contained?: boolean; // true usa max-w-7xl
}

export default function Section({
  id,
  className = "",
  children,
  contained = true,
}: SectionProps) {
  const innerClass = [
    contained ? "max-w-7xl" : "",
    "mx-auto px-4 sm:px-6 lg:px-8",
    contained ? "py-12 lg:py-16 pt-18" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section id={id} className={className}>
      <div className={innerClass}>{children}</div>
    </section>
  );
}
