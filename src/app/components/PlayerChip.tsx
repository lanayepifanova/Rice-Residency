/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

/**
 * A player wherever the games pages name one: their photo, their name, and a
 * link to their profile. The photo is the same one the directory shows, so a
 * name in the standings and a face on the people page are recognisably the
 * same person. Someone with no photo keeps the initial rather than a gap.
 */
export function PlayerChip({
  name,
  href,
  avatarUrl,
  initial,
  className,
}: {
  name: string;
  href: string | null;
  avatarUrl: string | null;
  initial: string;
  className?: string;
}) {
  const face = avatarUrl ? (
    <img className="profile-image" src={avatarUrl} alt="" />
  ) : (
    <span className="profile-image" aria-hidden="true">
      {initial}
    </span>
  );

  const inner = (
    <>
      {face}
      <span className="player-chip-name">{name}</span>
    </>
  );

  // The whole chip is the target, not just the name: a 28px photo beside a
  // link is something people aim at and miss.
  return href ? (
    <Link className={`player-chip${className ? ` ${className}` : ""}`} href={href}>
      {inner}
    </Link>
  ) : (
    <span className={`player-chip${className ? ` ${className}` : ""}`}>{inner}</span>
  );
}
