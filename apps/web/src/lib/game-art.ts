export function getGameThumbnailSrc(slug: string): string {
  return `/games/thumbs/${slug}.webp`;
}

export function getGameScreenshotSrc(
  slug: string,
  variant: "gameplay" | string = "gameplay",
): string {
  return `/games/ss/${slug}-${variant}.webp`;
}

