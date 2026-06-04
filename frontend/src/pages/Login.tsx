import { createSignal, Show } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { useAuth } from "../lib/store";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function Login() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>("/v1/auth/login", {
        email: email(),
        password: password(),
      });
      login(res.token, res.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-sm">
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div class="mb-6 text-center">
            <h1 class="text-xl font-semibold text-gray-900">Ledgerify</h1>
            <p class="text-sm text-gray-500 mt-1">Sign in to your account</p>
          </div>

          <Show when={error()}>
            <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error()}
            </div>
          </Show>

          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <div>
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                autocomplete="email"
              />
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Password</label>
              <Input
                type="password"
                placeholder="Password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                autocomplete="current-password"
              />
            </div>
            <Button type="submit" disabled={loading()} class="w-full mt-1">
              {loading() ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p class="text-center text-sm text-gray-500 mt-4">
            No account? <A href="/register" class="text-[#c25a3e] hover:underline font-medium">Register</A>
          </p>
        </div>
      </div>
    </div>
  );
}
