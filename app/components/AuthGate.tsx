"use client";

import { useState, useEffect, ReactNode } from "react";

const PASSWORD = "REDACTED";
const STORAGE_KEY = "sanhedrin-auth";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setAuthed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "true");
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  }

  // Still checking localStorage
  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authed) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm text-center space-y-6"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-[#d4af37] leading-tight">
          סנהדרין דיגיטלית
        </h1>
        <p className="text-[#f5f0e1]/70 text-sm">
          Enter the password to proceed
        </p>

        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-[#d4af37]/40 bg-[#1f1f39] text-[#f5f0e1] px-4 py-3 text-center text-lg placeholder:text-[#f5f0e1]/30 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-colors"
          autoFocus
        />

        {error && (
          <p className="text-red-400 text-sm animate-pulse">
            Incorrect password. Try again.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-[#d4af37] text-[#1a1a2e] font-bold py-3 text-lg hover:bg-[#e6c455] transition-colors cursor-pointer"
        >
          Enter
        </button>
      </form>
    </div>
  );
}

export function SignOutButton() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }}
      className="fixed top-4 left-4 z-40 text-[#f5f0e1]/40 hover:text-[#d4af37] text-xs transition-colors cursor-pointer"
    >
      Sign Out
    </button>
  );
}
