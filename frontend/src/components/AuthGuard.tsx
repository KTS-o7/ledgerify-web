import { Show, type JSX } from "solid-js";
import { useNavigate, type RouteSectionProps } from "@solidjs/router";
import { useAuth } from "../lib/store";

export function AuthGuard(props: RouteSectionProps) {
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
