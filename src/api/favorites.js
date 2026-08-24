import client from "./client";

// 응답은 { items, showComparisonNotice } 형태다.
export async function fetchFavorites() {
  const res = await client.get("/favorites");
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
