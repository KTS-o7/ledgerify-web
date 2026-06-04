import { createContext, useContext, createSignal, type JSX } from "solid-js";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: JSX.Element }) {
  const savedUser = localStorage.getItem("user");
  const [user, setUser] = createSignal<User | null>(
    savedUser ? JSON.parse(savedUser) : null
  );

  const isAuthenticated = () => !!localStorage.getItem("jwt_token");

  const login = (token: string, userData: User) => {
    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
