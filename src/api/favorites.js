import client from "./client";

// 백엔드가 SearchRequestDto를 요구하는 최소 형태.
// options / detailedOptions 는 @NotNull 이라 빈 값이라도 반드시 채워야 한다.
const EMPTY_SEARCH_REQUEST = { options: [], detailedOptions: {} };

/**
 * 찜 목록. 응답은 { items, showComparisonNotice } 형태다.
 *
 * GET /favorites 는 내부적으로 request=null 로 호출되는데
 * RateCalculatorService가 request를 널 체크 없이 역참조해 500(C002)이 난다.
 * 같은 데이터를 주는 POST /favorites/list 에 바디를 실어 보내 우회한다.
 * 추천 조건(request)을 넘기면 적합도·달성 가능 금리까지 프로필 기준으로 재계산된다.
 */
export async function fetchFavorites(request) {
  const res = await client.post("/favorites/list", request ?? EMPTY_SEARCH_REQUEST);
  return res.data ?? { items: [], showComparisonNotice: false };
}

export function addFavorite(productPropertyId) {
  return client.post("/favorites", { productPropertyId });
}

export function removeFavorite(productPropertyId) {
  return client.delete(`/favorites/${productPropertyId}`);
}

// 스칼라 boolean이 그대로 내려온다.
export async function fetchFavoriteStatus(productPropertyId) {
  const res = await client.get(`/favorites/${productPropertyId}/status`);
  return Boolean(res.data);
}

// 스칼라 정수가 그대로 내려온다.
export async function fetchFavoriteCount() {
  const res = await client.get("/favorites/count");
  return Number(res.data) || 0;
}
