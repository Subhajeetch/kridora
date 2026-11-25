import {
  WEAPON_CATALOG,
  type KillWeaponIconId,
  type MapDefinition,
  type PickupKind,
} from "../types";

export type AssetStatus = "idle" | "loading" | "loaded" | "error";

interface ImageEntry {
  status: AssetStatus;
  image: HTMLImageElement | null;
}

const ABILITY_ICON_PATHS: Record<"grenade" | "jetpack" | "melee", string> = {
  grenade: "/assets/pocket-war/icons/ability_grenade.png",
  jetpack: "/assets/pocket-war/icons/ability_jetpack.png",
  melee: "/assets/pocket-war/icons/ability_melee.png",
};

export function getKillWeaponIconPath(weaponId: KillWeaponIconId): string {
  if (weaponId === "grenade" || weaponId === "barrel") {
    return ABILITY_ICON_PATHS.grenade;
  }
  if (weaponId === "melee") {
    return ABILITY_ICON_PATHS.melee;
  }
  return WEAPON_CATALOG[weaponId].iconPath;
}

export function getPickupIconPath(kind: PickupKind): string | null {
  switch (kind) {
    case "weapon_m4a1":
      return WEAPON_CATALOG.m4a1.iconPath;
    case "weapon_spas12":
      return WEAPON_CATALOG.spas12.iconPath;
    case "weapon_barrett50":
      return WEAPON_CATALOG.barrett50.iconPath;
    case "weapon_rpg7":
      return WEAPON_CATALOG.rpg7.iconPath;
    case "grenade_pack":
      return ABILITY_ICON_PATHS.grenade;
    case "medkit":
      return null;
  }
}

/**
 * Non-blocking image cache for Pocket War map layers and HUD/setup icons.
 * Gracefully records missing assets as `"error"` without throwing so procedural
 * fallbacks render seamlessly until generated art is dropped into `public/assets/pocket-war/`.
 */
export class AssetLoader {
  private entries = new Map<string, ImageEntry>();
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public requestImage(path: string): HTMLImageElement | null {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      return null;
    }

    const existing = this.entries.get(path);
    if (existing) {
      return existing.status === "loaded" ? existing.image : null;
    }

    const entry: ImageEntry = {
      status: "loading",
      image: null,
    };
    this.entries.set(path, entry);

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        entry.status = "loaded";
        entry.image = img;
      } else {
        entry.status = "error";
        entry.image = null;
      }
      this.notify();
    };
    img.onerror = () => {
      entry.status = "error";
      entry.image = null;
      this.notify();
    };
    img.src = path;

    return null;
  }

  public getLoadedImage(path: string): HTMLImageElement | null {
    const entry = this.entries.get(path);
    if (!entry) {
      return this.requestImage(path);
    }
    if (
      entry.status === "loaded" &&
      entry.image &&
      entry.image.complete &&
      entry.image.naturalWidth > 0
    ) {
      return entry.image;
    }
    return null;
  }

  public getStatus(path: string): AssetStatus {
    return this.entries.get(path)?.status ?? "idle";
  }

  public preloadMap(map: MapDefinition): void {
    this.requestImage(map.assets.sky);
    this.requestImage(map.assets.mountains);
    this.requestImage(map.assets.midJungle);
    this.requestImage(map.assets.terrain);
    this.requestImage(map.assets.foreground);
    this.requestImage(map.assets.thumbnail);
  }

  public preloadIcons(): void {
    for (const weapon of Object.values(WEAPON_CATALOG)) {
      this.requestImage(weapon.iconPath);
    }
    this.requestImage(ABILITY_ICON_PATHS.grenade);
    this.requestImage(ABILITY_ICON_PATHS.jetpack);
    this.requestImage(ABILITY_ICON_PATHS.melee);
  }

  public preloadAll(map: MapDefinition): void {
    this.preloadMap(map);
    this.preloadIcons();
  }
}

export const pocketWarAssets = new AssetLoader();
