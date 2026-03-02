import { useEffect, useState } from "react";

export function useIdle(delayMs = 200) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let handle = null;
    if (typeof window === "undefined") return undefined;

    if ("requestIdleCallback" in window) {
      handle = window.requestIdleCallback(() => setIdle(true), {
        timeout: delayMs,
      });
      return () => window.cancelIdleCallback?.(handle);
    }

    handle = window.setTimeout(() => setIdle(true), delayMs);
    return () => window.clearTimeout(handle);
  }, [delayMs]);

  return idle;
}
