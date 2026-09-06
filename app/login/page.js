"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Wrong email or password.");
    } else {
      router.push("/");
    }
  }

  return (
    <main className="max-w-sm mx-auto mt-32 p-6 font-sans">
      <h1 className="text-2xl font-bold mb-6">My Dashboard — Login</h1>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border rounded px-3 py-2 w-full mb-3 text-gray-900"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        className="border rounded px-3 py-2 w-full mb-4 text-gray-900"
      />
      <button
        onClick={handleLogin}
        className="bg-black text-white px-4 py-2 rounded w-full"
      >
        Log in
      </button>
    </main>
  );
}