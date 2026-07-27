import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { addFavorite, fetchFavorites, removeFavorite } from "../api/favorites";
import { readPersistedRecommendation } from "../utils/recommendationResult";

/**
 * 찜 상태를 productPropertyId 집합으로 들고 있는다.
 * 카드마다 /favorites/{id}/status를 부르면 요청이 카드 수만큼 늘어나므로 목록 한 번만 받는다.
 */
const EMPTY_IDS = new Set();

export default function useFavorites() {
  const { accessToken } = useAuth();
  const isLoggedIn = Boolean(accessToken);
  // 추천 조건을 함께 보내면 서버가 적합도·금리를 프로필 기준으로 재계산해준다.
  const request = useMemo(() => readPersistedRecommendation()?.request ?? null, []);
  // 로그인 여부를 함께 담아, 로그아웃 시 렌더 중 setState 없이 빈 집합으로 떨어지게 한다.
  const [loaded, setLoaded] = useState({ loggedIn: false, ids: EMPTY_IDS });

  const favoriteIds = isLoggedIn && loaded.loggedIn ? loaded.ids : EMPTY_IDS;

  useEffect(() => {
    // 토큰이 10분마다 갱신되므로 토큰 문자열이 아니라 로그인 여부에만 반응한다.
    if (!isLoggedIn) return;

    let cancelled = false;

    fetchFavorites(request)
      .then((data) => {
        if (cancelled) return;
        setLoaded({
          loggedIn: true,
          ids: new Set((data.items || []).map((item) => item.productPropertyId)),
        });
      })
      .catch((e) => console.error("찜 목록을 불러오지 못했습니다:", e));

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, request]);

  const isFavorite = useCallback(
    (productPropertyId) => favoriteIds.has(productPropertyId),
    [favoriteIds],
  );

  // 비로그인이면 "login"을 돌려주고 호출부가 안내 모달을 띄운다.
  const toggleFavorite = useCallback(
    async (productPropertyId) => {
      if (!isLoggedIn) return "login";
      if (productPropertyId == null) return "unavailable";

      const wasFavorite = favoriteIds.has(productPropertyId);
      const applyChange = (add) => setLoaded((prev) => {
        const next = new Set(prev.ids);
        if (add) next.add(productPropertyId);
        else next.delete(productPropertyId);
        return { loggedIn: true, ids: next };
      });

      applyChange(!wasFavorite);

      try {
        if (wasFavorite) await removeFavorite(productPropertyId);
        else await addFavorite(productPropertyId);
        return "ok";
      } catch (e) {
        console.error("찜 상태를 변경하지 못했습니다:", e);
        applyChange(wasFavorite); // 실패하면 낙관적 변경을 되돌린다.
        return "error";
      }
    },
    [isLoggedIn, favoriteIds],
  );

  return { favoriteIds, isFavorite, toggleFavorite, count: favoriteIds.size };
}
