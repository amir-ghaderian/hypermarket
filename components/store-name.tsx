"use client";

import { useEffect, useState } from "react";

export default function StoreName({ fallback = "فروشگاه" }: { fallback?: string }) {
  const [name, setName] = useState(fallback);
  useEffect(() => {
    fetch("/api/store").then((response) => response.json()).then((data) => {
      if (data.store?.storeName) {
        setName(data.store.storeName);
        document.title = `${data.store.storeName} | مدیریت فروشگاه`;
      }
    }).catch(() => undefined);
  }, []);
  return <>{name}</>;
}
