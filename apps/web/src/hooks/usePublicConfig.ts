import { useEffect, useState } from "react"

interface PublicConfig {
  googleEnabled: boolean
}

/** Server-side feature flags that decide which buttons we show (e.g. Google sign-in). */
export function usePublicConfig(): PublicConfig {
  const [config, setConfig] = useState<PublicConfig>({ googleEnabled: false })

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/config", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<PublicConfig>) : null))
      .then((data) => {
        if (data) setConfig(data)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return config
}
