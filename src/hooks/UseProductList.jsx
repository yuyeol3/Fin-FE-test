import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchProductCatalog } from "../api/products";
import { readPersistedRecommendation } from "../utils/recommendationResult";
import { buildCatalogViewModels, buildProductListViewModels } from "../utils/productViewModel";

/**
 * 상품 목록 화면 데이터.
 * 추천 결과(POST /search/products)는 목록/금리 순위와 적합도를 주지만 최대금리를 주지 않는다.
 * GET /search/products?searchInput= 가 전체 카탈로그의 baseRate/maxRate를 한 번에 주므로 합쳐 쓴다.
 */
export default function useProductList(sortMode) {
  const location = useLocation();
  const persisted = useMemo(() => readPersistedRecommendation(), []);

  const recommendation = location.state?.recommendation ?? persisted;
  const recommendationResult = location.state?.recommendationResult
    ?? recommendation?.result;
  const request = recommendation?.request ?? null;

  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchProductCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((e) => console.error("상품 목록을 불러오지 못했습니다:", e))
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo(() => {
    // 추천 결과 없이 들어온 경우엔 공개 카탈로그만으로 둘러보기 목록을 만든다.
    if (!recommendationResult) return buildCatalogViewModels(catalog);

    return buildProductListViewModels({
      result: recommendationResult,
      catalog,
      details: recommendationResult.productDetails
        ?? recommendationResult.governmentDetails
        ?? [],
      sortMode,
    });
  }, [recommendationResult, catalog, sortMode]);

  const tabs = recommendationResult?.tabs ?? null;

  return {
    products,
    catalog,
    loading: catalogLoading,
    hasRecommendation: Boolean(recommendationResult),
    tabs,
    request,
  };
}
