import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env["VITE_PUBLIC_SUPABASE_URL"];
const supabaseKey = import.meta.env["VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );