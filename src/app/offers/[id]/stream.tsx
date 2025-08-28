"use client";
import { useEffect, useState } from "react";

export default function ChatStream({ offerId, initial }: { offerId: number; initial: any[] }) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch(`/api/messages?offerId=${offerId}`, { cache: "no-store" });
      const data = await res.json();
      setItems(data.items);
    }, 3000);
    return () => clearInterval(t);
  }, [offerId]);

  return (
    <ul className="space-y-2 border border-neutral-800 rounded p-3 max-h-[60vh] overflow-auto">
      {items.map((m) => (
        <li key={m.id} className="text-sm">
          <span className="opacity-60 mr-2">{new Date(m.createdAt).toLocaleTimeString()}</span>
          {m.text}
        </li>
      ))}
      {items.length === 0 && <li className="opacity-60">Aucun message.</li>}
    </ul>
  );
}
