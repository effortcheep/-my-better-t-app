import { createContext, useContext, createSignal, type ParentComponent, onMount } from "solid-js";
import { getCurrentUser, getStoredUser, isAuthenticated, type UserInfo } from "@/lib/auth-api";

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  setUser: (user: UserInfo | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<UserInfo | null>(getStoredUser());
  const [isLoading, setIsLoading] = createSignal(true);

  const refreshUser = async () => {
    if (!isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      localStorage.setItem("userInfo", JSON.stringify(currentUser));
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userInfo");
    window.location.href = "/login";
  };

  onMount(() => {
    if (isAuthenticated()) {
      refreshUser();
    } else {
      setIsLoading(false);
    }
  });

  return (
    <AuthContext.Provider
      value={{
        get user() {
          return user();
        },
        get isAuthenticated() {
          return isAuthenticated();
        },
        get isLoading() {
          return isLoading();
        },
        setUser,
        refreshUser,
        logout,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
