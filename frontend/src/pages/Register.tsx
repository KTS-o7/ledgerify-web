import { createSignal } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { useAuth } from "../lib/store";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { AuthShell, AuthField } from "../components/settings/auth-shell";

export default function Register() {
  const [name, setName] = createSignal("");
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
      const res = await api.post<{ token: string; user: any }>("/v1/auth/register", { name: name(), email: email(), password: password() });
      login(res.token, res.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell error={error()}>
      <h1 class="sr-only">Create a Ledgerify account</h1>
      <form onSubmit={handleSubmit} class="flex flex-col gap-3.5">
        <AuthField id="register-name" label="Name" type="text" value={name()} onInput={setName} autocomplete="name" />
        <AuthField id="register-email" label="Email" type="email" value={email()} onInput={setEmail} autocomplete="email" />
        <AuthField id="register-password" label="Password" type="password" value={password()} onInput={setPassword} autocomplete="new-password" />
        <Button type="submit" size="lg" disabled={loading()} class="w-full mt-2">{loading() ? "Creating account…" : "Create account"}</Button>
      </form>
      <p class="text-center text-[14px] text-muted mt-6">
        Already have an account? <A href="/login" class="font-medium underline-offset-4 hover:underline">Sign in</A>
      </p>
    </AuthShell>
  );
}
