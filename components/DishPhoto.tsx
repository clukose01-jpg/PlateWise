"use client";

import { useEffect, useRef, useState } from "react";

// An AI-made picture of tonight's dinner. The first time, it takes a few seconds to make; if it
// can't be made, nothing shows.
export default function DishPhoto({ planId, day, name }: { planId: string; day: string; name: string }) {
  const [state, setState] = useState<"loading" | "shown" | "failed">("loading");
  const image = useRef<HTMLImageElement>(null);

  // A saved picture can finish loading before the page is ready to notice.
  useEffect(() => {
    const img = image.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "shown" : "failed");
  }, []);

  if (state === "failed") return null;
  return (
    <figure className={`dish-photo ${state}`}>
      <div className="dish-photo-frame">
        <img
          ref={image}
          src={`/api/dish-photo/${planId}/${day}?dish=${encodeURIComponent(name)}`}
          alt={`A picture of ${name}`}
          onLoad={() => setState("shown")}
          onError={() => setState("failed")}
        />
        {state === "loading" && <span className="dish-photo-wait">Making a picture of tonight&apos;s dinner…</span>}
      </div>
      <figcaption>AI-made picture, for a rough idea. Follow the ingredient list.</figcaption>
    </figure>
  );
}
