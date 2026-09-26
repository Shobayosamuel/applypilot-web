"use client";

import Script from "next/script";
import { useRef } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, options: { theme: string; size: string; text: string; width: number }) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!CLIENT_ID) return null;

  function render() {
    if (!window.google || !ref.current) return;
    window.google.accounts.id.initialize({ client_id: CLIENT_ID!, callback: (r) => onCredential(r.credential) });
    window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", width: 360 });
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={render} />
      <div ref={ref} className="flex h-10 justify-center" />
    </>
  );
}
