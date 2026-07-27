// AuthContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import client, { refreshAccessToken, registerTokenAccessor } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [fetchedRole, setFetchedRole] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 인터셉터는 렌더 밖에서 돌기 때문에 최신 토큰을 ref로도 들고 있어야 한다.
  const tokenRef = useRef(null);

  const applyAccessToken = useCallback((token) => {
    tokenRef.current = token;
    setAccessToken(token);
  }, []);

  // axios 모듈에 토큰 접근자를 등록한다. 렌더보다 먼저 붙어야 하므로 초기화 effect보다 위에 둔다.
  useEffect(() => {
    registerTokenAccessor({
      get: () => tokenRef.current,
      set: applyAccessToken,
      onAuthFailure: () => setFetchedRole(null),
    });
  }, [applyAccessToken]);

  // OAuth 성공 후 백엔드는 액세스 토큰을 전달하지 않고 refresh_token 쿠키만 심어준다.
  // 따라서 첫 진입 시 /auth/refresh로 액세스 토큰을 받아와야 한다.
  useEffect(() => {
    refreshAccessToken()
      .catch(() => {})
      .finally(() => setIsInitialized(true));
  }, []);

  useEffect(() => {
    if (!accessToken) return; // 토큰이 없으면 조회할 필요가 없음

    let cancelled = false;

    client
      .get("/user/me")
      .then((res) => {
        if (!cancelled) setFetchedRole(res.data.userRole);
      })
      .catch(() => {
        if (!cancelled) setFetchedRole(null);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const userRole = accessToken ? fetchedRole : null;

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        setAccessToken: applyAccessToken,
        userRole,
        setUserRole: setFetchedRole,
        isInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
