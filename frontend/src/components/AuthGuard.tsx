import { Show, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../lib/store";

export function AuthGuard(props: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <Show
      when={isAuthenticated()}
      fallback={<>{navigate("/login", { replace: true })}</>}
    >
      {props.children}
    </Show>
  );
}
