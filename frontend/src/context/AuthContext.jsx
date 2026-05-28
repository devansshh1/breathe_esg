import { createContext, useContext, useEffect, useState } from "react";

import { apiFetch, ensureCsrfCookie } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        await ensureCsrfCookie();
      } catch {
        // Ignore bootstrap CSRF failures until the backend is running.
      }

      try {
        const currentUser = await apiFetch("/api/auth/me/");
        if (isMounted) {
          setUser(currentUser);
        }
      } catch (error) {
        if (error?.status === 401) {
          try {
            await apiFetch("/api/auth/refresh/", {
              method: "POST",
            });
            const currentUser = await apiFetch("/api/auth/me/");

            if (isMounted) {
              setUser(currentUser);
            }
          } catch {
            if (isMounted) {
              setUser(null);
            }
          }
        } else if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthReady(true);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async ({ username, password }) => {
    setIsAuthBusy(true);
    setAuthError("");

    try {
      const response = await apiFetch("/api/auth/login/", {
        method: "POST",
        body: {
          username,
          password,
        },
      });

      setUser(response.user || { username });
      return response;
    } catch (error) {
      setUser(null);
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  };

  const logout = async () => {
    setIsAuthBusy(true);
    setAuthError("");

    try {
      await apiFetch("/api/auth/logout/", {
        method: "POST",
      });
    } catch (error) {
      if (error?.status !== 401 && error?.status !== 403) {
        setAuthError(error.message);
      }
    } finally {
      setUser(null);
      setIsAuthBusy(false);
    }
  };

  const clearAuthError = () => {
    setAuthError("");
  };

  return (
    <AuthContext.Provider
      value={{
        authError,
        clearAuthError,
        isAuthenticated: Boolean(user),
        isAuthBusy,
        isAuthReady,
        login,
        logout,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
