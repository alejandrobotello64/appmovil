import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "size-8 text-[10px]",
  md: "size-10 text-xs",
  lg: "size-16 text-base",
} as const;

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function UserAvatar({
  name,
  photoUrl,
  size = "sm",
  className,
}: UserAvatarProps) {
  const url = (photoUrl ?? "").trim();
  const label = initials(name);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground",
        sizeClass[size],
        className
      )}
      aria-hidden={url ? undefined : true}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : label ? (
        <span className="font-semibold tracking-wide text-foreground/80">
          {label}
        </span>
      ) : (
        <UserRound className="size-[55%]" />
      )}
    </span>
  );
}
