const API_BASE = "/api";

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("jwt_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("jwt_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => authFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    authFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    authFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => authFetch<T>(path, { method: "DELETE" }),
};
