import { createSignal } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { useAuth } from "../lib/store";
import { api } from "../lib/api";

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
    <div class="auth-page">
      <form onSubmit={handleSubmit}>
        <hgroup>
          <h1>Ledgerify</h1>
          <p>Sign in to your account</p>
        </hgroup>
        {error() && <div class="error">{error()}</div>}
        <label>
          Email
          <input
            type="email"
            placeholder="you@example.com"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            required
            autocomplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="Password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            required
            autocomplete="current-password"
          />
        </label>
        <button type="submit" disabled={loading()} aria-busy={loading()}>
          {loading() ? "Signing in…" : "Sign in"}
        </button>
        <p style="text-align:center;margin-top:1rem">
          No account? <A href="/register">Register</A>
        </p>
      </form>
    </div>
  );
}
