import type { SVGProps } from "react";

/**
 * Crisp vector frag grenade icon (ribbed pineapple/M67 body, fuse collar,
 * side safety lever, and pull-pin ring) for HUD and ability cards.
 */
export function GrenadeIcon({
  className = "h-5 w-5",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Pull-pin ring */}
      <circle
        cx="6.2"
        cy="5.8"
        r="2.1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.3 5.8H10.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Top fuse assembly & striker collar */}
      <rect
        x="9.5"
        y="3.2"
        width="5"
        height="3.3"
        rx="0.9"
        fill="currentColor"
      />
      {/* Side safety lever (spoon) */}
      <path
        d="M14.5 4.4C17.4 4.7 19.1 7.1 19.3 11.4C19.4 13.1 19.1 14.5 18.6 15.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Main frag grenade body */}
      <rect
        x="6.7"
        y="7.4"
        width="10.6"
        height="13.4"
        rx="5.2"
        fill="currentColor"
      />
      {/* Fragmentation grid notches */}
      <path
        d="M7.3 11.5H16.7M7.3 15.6H16.7M12 7.8V20.4"
        stroke="#0F172A"
        strokeOpacity="0.6"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Crisp curved firearm magazine + brass cartridge tip + subtle reload arc
 * so the reload action is unmistakable at HUD button sizes.
 */
export function MagazineReloadIcon({
  className = "h-5 w-5",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Top cartridge tip sitting in feed lips */}
      <path
        d="M9.6 5.2L11.4 3.4L14.8 4.4L13.7 6.5"
        fill="currentColor"
        fillOpacity="0.85"
      />
      {/* Curved tactical magazine body */}
      <path
        d="M8.1 6.4H14.5C14.7 10.2 15.8 13.7 17.9 16.9L12.1 19.6C9.5 15.4 8.2 11 8.1 6.4Z"
        fill="currentColor"
      />
      {/* Magazine baseplate */}
      <path
        d="M11.2 19.2L18.4 15.9L19.3 17.7L12.1 21L11.2 19.2Z"
        fill="currentColor"
      />
      {/* Rib lines on magazine body */}
      <path
        d="M10.4 9.7L13.6 9.3M11.1 12.8L14.5 12.1M12.3 15.9L15.7 14.8"
        stroke="#0F172A"
        strokeOpacity="0.58"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      {/* Curved reload arrow on the left */}
      <path
        d="M5.4 15.2C4.2 12.8 4.3 9.8 5.8 7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M4.2 7.5L6.2 6.8L6.4 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
