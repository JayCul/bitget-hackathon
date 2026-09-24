import type { ReactNode } from "react";

type Props = {
  lines: ReactNode[];
  as?: "h1" | "h2";
  size?: "display" | "title";
  className?: string;
};

/** Large editorial heading. Each line fades in with a 12px rise, staggered 70ms (CSS, reduced-motion aware). */
export function DisplayHeading({ lines, as = "h1", size = "display", className = "" }: Props) {
  const Tag = as;
  return (
    <Tag className={`font-medium ${size === "display" ? "text-display" : "text-title"} ${className}`}>
      {lines.map((line, i) => (
        <span key={i} className="rise block" style={{ ["--d" as string]: `${i * 70}ms` }}>
          {line}
        </span>
      ))}
    </Tag>
  );
}
