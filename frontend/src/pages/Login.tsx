import { createSignal } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { useAuth } from "../lib/store";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { AuthShell, AuthField } from "../components/settings/auth-shell";

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
      const res = await api.post<{ token: string; user: any }>("/v1/auth/login", { email: email(), password: password() });
      login(res.token, res.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell error={error()}>
      <h1 class="sr-only">Sign in to Ledgerify</h1>
      <form onSubmit={handleSubmit} class="flex flex-col gap-3.5">
        <AuthField id="login-email" label="Email" type="email" value={email()} onInput={setEmail} autocomplete="email" />
        <AuthField id="login-password" label="Password" type="password" value={password()} onInput={setPassword} autocomplete="current-password" />
        <Button type="submit" size="lg" disabled={loading()} class="w-full mt-2">{loading() ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p class="text-center text-[14px] text-muted mt-6">
        New here? <A href="/register" class="font-medium underline-offset-4 hover:underline">Create an account</A>
      </p>
    </AuthShell>
  );
}
