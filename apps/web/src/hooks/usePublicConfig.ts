import { useEffect, useState } from "react"
import { API_URL } from "@/lib/api-url"

interface PublicConfig {
  googleEnabled: boolean
}

/** Server-side feature flags that decide which buttons we show (e.g. Google sign-in). */
export function usePublicConfig(): PublicConfig {
  const [config, setConfig] = useState<PublicConfig>({ googleEnabled: false })

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_URL}/api/config`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return null
        const contentType = res.headers.get("content-type") || ""
        if (!contentType.includes("application/json")) return null
        return (await res.json()) as PublicConfig
      })
      .then((data) => {
        if (data) setConfig(data)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return config
}
