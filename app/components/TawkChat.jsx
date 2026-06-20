// app/components/TawkChat.jsx
// Loads the Tawk.to live-chat widget inside the embedded admin (client-side, once).
import { useEffect } from "react";

export default function TawkChat({ src }) {
  useEffect(() => {
    if (!src) return;
    // Guard against double-injection across client-side navigations / re-renders.
    if (window.Tawk_API || document.getElementById("tawk-script")) return;

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    const s = document.createElement("script");
    s.id = "tawk-script";
    s.async = true;
    s.src = src;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    document.body.appendChild(s);
  }, [src]);

  return null;
}
