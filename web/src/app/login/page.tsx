"use client";

import React from "react";
import { SignInView } from "../../components/auth/SignInView";

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-subtle)" }}>
      <SignInView />
    </div>
  );
}
