import axios from "axios";

// 로컬 개발은 .env.local의 VITE_API_BASE_URL(http://localhost:8080)을 사용한다.
// 값이 없으면 배포된 테스트 서버로 떨어지므로 Vercel 빌드는 그대로 동작한다.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://test-fin.duckdns.org";

const client = axios.create({ baseURL: API_BASE_URL });

// refresh_token 쿠키가 필요한 곳은 /auth/refresh와 /auth/logout 둘뿐이다.
const WITH_REFRESH_COOKIE = { withCredentials: true };

// 소셜 로그인은 브라우저 전체 이동이라 axios가 아니라 URL 문자열이 필요하다.
export function oauthLoginUrl(provider) {
  return `${API_BASE_URL}/oauth2/authorization/${provider}`;
}

// --- 액세스 토큰 접근자 ---------------------------------------------------
// axios 모듈이 React 상태를 직접 읽으면 순환 의존이 되므로,
// AuthProvider가 마운트될 때 자기 상태를 읽고 쓰는 함수를 여기에 등록한다.
let tokenAccessor = {
  get: () => null,
  set: () => {},
  onAuthFailure: () => {},
};

export function registerTokenAccessor(accessor) {
  tokenAccessor = { ...tokenAccessor, ...accessor };
}

// --- 리프레시 -------------------------------------------------------------
// 서버는 리프레시 토큰을 회전시키고 기존 토큰을 즉시 무효화한다(1회용).
// 따라서 동시에 두 번 호출하면 서로의 세션을 깨뜨리므로 진행 중인 요청 하나로 합친다.
let refreshPromise = null;

export function refreshAccessToken() {
  if (!refreshPromise) {
    // client가 아니라 axios를 직접 쓴다. 인터셉터를 타면 401에서 무한 재귀가 된다.
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, {}, WITH_REFRESH_COOKIE)
      .then((res) => {
        const token = res.data?.data ?? null;
        tokenAccessor.set(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function logout() {
  return axios.post(`${API_BASE_URL}/auth/logout`, {}, WITH_REFRESH_COOKIE);
}

// JWT의 exp만 읽는다(검증은 서버 몫). payload는 base64url이라 atob 전에 치환이 필요하다.
function expiresAtMs(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).exp * 1000;
  } catch {
    return 0;
  }
}

const REFRESH_MARGIN_MS = 30_000;

client.interceptors.request.use(async (config) => {
  let token = tokenAccessor.get();

  // /search/** 는 permitAll이라 토큰이 만료돼도 401이 아니라 200 + metricsLocked로 돌아온다.
  // 즉 401 인터셉터로는 복구할 수 없으므로, 만료가 임박하면 보내기 전에 갱신한다.
  if (token && expiresAtMs(token) - Date.now() < REFRESH_MARGIN_MS) {
    token = await refreshAccessToken().catch(() => null);
  }

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    // 액세스 토큰 TTL이 10분이라 401은 정상적으로 발생한다. 한 번만 갱신하고 재시도한다.
    if (error.response?.status !== 401 || !config || config.__retried) {
      return Promise.reject(error);
    }

    config.__retried = true;
    try {
      const token = await refreshAccessToken();
      if (!token) throw error;
      config.headers.Authorization = `Bearer ${token}`;
      return client(config);
    } catch {
      tokenAccessor.set(null);
      tokenAccessor.onAuthFailure();
      return Promise.reject(error);
    }
  },
);

export default client;
