"use client";

import { useEffect, useState } from "react";
import { isDevToolsAvailable } from "@/lib/dev-tools";

/** True only while the exact-localhost authoring dock is expanded. */
export function useDevToolsExpanded() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const sync = () =>
      setExpanded(
        isDevToolsAvailable(process.env.NODE_ENV, window.location.hostname) &&
          document.documentElement.hasAttribute("data-dev-tools")
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-dev-tools"],
    });
    return () => observer.disconnect();
  }, []);

  return expanded;
}
