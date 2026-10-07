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
    <div>
      <h2>{isSignUp ? "Create account" : "Log in"}</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">
          {isSignUp ? "Create account" : "Log in"}
        </button>
      </form>

      {error && <p>{error}</p>}
      {message && <p>{message}</p>}

      <button
        type="button"
        onClick={() => {
          setIsSignUp(!isSignUp);
          setError("");
          setMessage("");
        }}
      >
        {isSignUp ? "Already have an account?" : "Create an account"}
      </button>
    </div>
  );
}