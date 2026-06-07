import { createSignal, Show } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { useAuth } from "../lib/store";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { BentoBlock } from "../components/ui/bento-block";

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
    <div class="min-h-screen flex items-center justify-center bg-bg p-4">
      <BentoBlock class="w-full max-w-sm">
        <div class="flex flex-col items-center text-center mb-6">
          <div class="w-12 h-12 rounded-input bg-primary flex items-center justify-center text-bg font-display font-bold text-2xl mb-3">L</div>
          <h1 class="font-display text-2xl font-bold text-text">Ledgerify</h1>
          <p class="text-sm text-muted mt-1">Create your account</p>
        </div>

        <Show when={error()}>
          <div class="mb-4 rounded-input bg-accent/10 border border-accent/30 px-3 py-2 text-sm text-accent">{error()}</div>
        </Show>

        <form onSubmit={handleSubmit} class="flex flex-col gap-3">
          <div>
            <label for="register-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">Name</label>
            <Input id="register-name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} required autocomplete="name" />
          </div>
          <div>
            <label for="register-email" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">Email</label>
            <Input id="register-email" type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} required autocomplete="email" />
          </div>
          <div>
            <label for="register-password" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">Password</label>
            <Input id="register-password" type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} required autocomplete="new-password" />
          </div>
          <Button type="submit" disabled={loading()} class="w-full mt-1">{loading() ? "Creating account…" : "Create account"}</Button>
        </form>

        <p class="text-center text-sm text-muted mt-4">
          Already have an account? <A href="/login" class="text-primary hover:underline font-medium">Sign in</A>
        </p>
      </BentoBlock>
    </div>
  );
}
