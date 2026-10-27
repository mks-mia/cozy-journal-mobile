import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase";

const supabase = createClient();

const AuthContext = createContext<User | null>(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function Auth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check whether a user is already logged in
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Listen for login/logout/session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="min-h-dvh bg-vellum" />;
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-vellum">
        <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
          <div className="w-full">
            <AuthForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={user}>
      {children}
    </AuthContext.Provider>
  );
}

function AuthForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    const { error } = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
            },
          },
        })
      : await supabase.auth.signInWithPassword({
          email,
          password,
        });

    if (error) {
      setError(error.message);
      return;
    }

    if (isSignUp) {
      setMessage(
        "Account created. Please check your email if confirmation is required.",
      );
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background/80 p-8 shadow-sm backdrop-blur-sm">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-4xl tracking-tight text-foreground">
          Lamplit
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A private, lamplit daily diary.
        </p>
      </div>

      <div className="mb-6 text-center">
        <h2 className="text-xl font-medium text-foreground">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          {isSignUp
            ? "Start your private space for reflection."
            : "Continue where you left off."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Name
            </label>

            <input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          {isSignUp ? "Create account" : "Log in"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {message && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
            setMessage("");
          }}
          className="text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
        >
          {isSignUp
            ? "Already have an account? Log in"
            : "Don't have an account? Create one"}
        </button>
      </div>
    </div>
  );
}