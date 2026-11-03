import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";

interface PublicConfig {
  googleEnabled: boolean;
}

let cachedConfig: PublicConfig | null = null;
let pendingFetch: Promise<PublicConfig | null> | null = null;

async function fetchPublicConfig(): Promise<PublicConfig | null> {
  if (cachedConfig) return cachedConfig;
  if (pendingFetch) return pendingFetch;

  pendingFetch = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return null;
      const data = (await res.json()) as PublicConfig;
      cachedConfig = data;
      return data;
    } catch {
      return null;
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
}

/** Server-side feature flags that decide which buttons we show (e.g. Google sign-in). Cached globally. */
export function usePublicConfig(): PublicConfig {
  const [config, setConfig] = useState<PublicConfig>(
    () => cachedConfig ?? { googleEnabled: true },
  );

  useEffect(() => {
    if (cachedConfig) return;

    let active = true;
    void fetchPublicConfig().then((data) => {
      if (active && data) {
        setConfig(data);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return config;
}
