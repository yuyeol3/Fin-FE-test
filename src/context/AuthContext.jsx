// AuthContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import client, { refreshAccessToken, registerTokenAccessor } from "../api/client";

const AuthContext = createContext(null);

// 개발 편의: 실제 소셜 로그인 없이 화면을 확인할 때 쓰는 토큰 주입 지점.
// 콘솔에서 sessionStorage.setItem("DEV_ACCESS_TOKEN", "<jwt>") 후 새로고침한다.
// 리프레시 쿠키가 없으므로 토큰이 만료되면 그대로 로그아웃된다.
function readDevAccessToken() {
  if (!import.meta.env.DEV) return null;
  try {
    return window.sessionStorage.getItem("DEV_ACCESS_TOKEN");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(readDevAccessToken);
  const [fetchedRole, setFetchedRole] = useState(null);
  // 주입된 개발용 토큰이 있으면 부트스트랩 refresh를 건너뛰므로 이미 초기화된 상태로 시작한다.
  const [isInitialized, setIsInitialized] = useState(() => Boolean(readDevAccessToken()));

  // 인터셉터는 렌더 밖에서 돌기 때문에 최신 토큰을 ref로도 들고 있어야 한다.
  const tokenRef = useRef(accessToken);

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
    // 주입된 개발용 토큰이 있으면 쿠키가 없으니 refresh를 시도하지 않는다.
    if (tokenRef.current) return;

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
