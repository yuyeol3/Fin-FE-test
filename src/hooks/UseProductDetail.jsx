import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchProductCatalog, fetchProductDetail } from "../api/products";
import { readPersistedRecommendation, asArray } from "../utils/recommendationResult";
import { buildProductDetailViewModel } from "../utils/productViewModel";

// 저장된 추천 결과에서 해당 상품의 property/점수/금리를 찾는다.
function findInResult(result, productId) {
  const numericId = Number(productId);
  const rows = [
    ...asArray(result?.governmentRanked),
    ...asArray(result?.bankRanked),
  ];
  const rates = [
    ...asArray(result?.governmentRateRanked),
    ...asArray(result?.bankRateRanked),
    ...asArray(result?.subscriptionProducts),
  ];
  return {
    match: rows.find((row) => row.productId === numericId) ?? null,
    rate: rates.find((row) => row.productId === numericId) ?? null,
  };
}

/**
 * 상세는 항상 서버에서 다시 받는다.
 * 저장된 추천 결과는 "같은 조건으로 재조회"하기 위한 요청 본문으로만 쓴다.
 * productPropertyId가 없으면 백엔드가 대표 property로 대체하므로 목록 수치와 달라질 수 있다.
 */
export default function useProductDetail(productId) {
  const location = useLocation();
  const persisted = useMemo(() => readPersistedRecommendation(), []);
  const request = persisted?.request ?? null;
  const result = persisted?.result ?? null;

  const { match, rate } = useMemo(() => findInResult(result, productId), [result, productId]);
  const productPropertyId = location.state?.productPropertyId
    ?? match?.productPropertyId
    ?? rate?.productPropertyId
    ?? null;

  // 요청 키를 함께 보관해 렌더 중 setState 없이 로딩 여부를 판별한다.
  const requestKey = `${productId}:${productPropertyId ?? ""}`;
  const [fetched, setFetched] = useState({ key: null, detail: null, error: null });
  const [catalogEntry, setCatalogEntry] = useState(null);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    fetchProductDetail(productId, {
      productPropertyId,
      options: request?.options ?? [],
      detailedOptions: request?.detailedOptions ?? null,
    })
      .then((data) => {
        if (!cancelled) setFetched({ key: requestKey, detail: data, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("상품 상세를 불러오지 못했습니다:", e);
        setFetched({ key: requestKey, detail: null, error: e });
      });

    return () => {
      cancelled = true;
    };
  }, [productId, productPropertyId, request, requestKey]);

  const loading = fetched.key !== requestKey;
  const detail = fetched.detail;
  const error = fetched.error;

  // 상세 응답에는 기본/최대 금리가 은행상품에만 있어 카탈로그로 보완한다.
  useEffect(() => {
    let cancelled = false;

    fetchProductCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setCatalogEntry(catalog.find((item) => item.productId === Number(productId)) ?? null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const product = useMemo(
    () => buildProductDetailViewModel(detail, { productPropertyId, catalogEntry, match, rate }),
    [detail, productPropertyId, catalogEntry, match, rate],
  );

  return { product, loading, error, request };
}
