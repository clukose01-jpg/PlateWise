"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loginStatus } from "@/lib/account-client";

// On New plan, for someone on a new device who already has an account.
export default function LoginLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    loginStatus().then((status) => setShow(status.enabled && !status.email));
  }, []);

  if (!show) return null;
  return (
    <p className="login-link">
      Already use PlateWise? <Link href="/login?next=/">Log in</Link>
    </p>
  );
}
