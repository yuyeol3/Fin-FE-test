import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import {
  fetchBankProviders,
  fetchDynamicForm,
  fetchProductDetail,
  searchProducts,
} from "../api/products";
import { fetchUserProfile, saveUserProfile } from "../api/user";
import {
  applyProfileToFormData,
  buildBankCategories,
  buildBankNameByCode,
  buildProfileRequest,
  buildRecommendationRequest,
  mapRecommendCategories,
} from "../utils/recommendationPayload";
import { persistRecommendation } from "../utils/recommendationResult";
import { MOCK_BANK_PROVIDERS } from "../data/mypage";

// 상세 조회는 상품 수만큼 POST가 나가므로 상위 랭킹만 미리 채운다.
const DETAIL_PREFETCH_LIMIT = 30;

// 적합도 상위 상품의 상세를 미리 받아 카드에 필요한 지표/키워드를 채운다.
// 정부 상품만 받던 예전 동작 때문에 은행 상세가 전부 버려지고 있었다.
async function fetchProductDetails(result, request) {
  const matches = [
    ...(Array.isArray(result?.governmentRanked) ? result.governmentRanked : []),
    ...(Array.isArray(result?.bankRanked) ? result.bankRanked : []),
  ].filter((match) => match?.productId);

  const uniqueMatches = [
    ...new Map(
      matches.map((match) => [`${match.productId}:${match.productPropertyId}`, match]),
    ).values(),
  ].slice(0, DETAIL_PREFETCH_LIMIT);

  const detailResults = await Promise.allSettled(
    uniqueMatches.map((match) =>
      fetchProductDetail(match.productId, {
        productPropertyId: match.productPropertyId ?? null,
        options: request.options,
        detailedOptions: request.detailedOptions,
      }),
    ),
  );

  return detailResults.flatMap((detailResult) =>
    detailResult.status === "fulfilled" && detailResult.value
      ? [detailResult.value]
      : [],
  );
}

// 백엔드가 중위소득을 주기 전에 쓰는 기본값(가구원 1인 기준).
const FALLBACK_INCOME_LEVELS = [
  { percent: 60, label: "중위소득 60%", amount: "월 154만원 이하" },
  { percent: 80, label: "중위소득 80%", amount: "월 205만원 이하" },
  { percent: 100, label: "중위소득 100%", amount: "월 256만원 이하" },
  { percent: 120, label: "중위소득 120%", amount: "월 308만원 이하" },
  { percent: 150, label: "중위소득 150%", amount: "월 385만원 이하" },
  { percent: 180, label: "중위소득 180%", amount: "" },
];

// medianIncomes의 금액 단위는 만원이다. 시드가 없는 가구원 수는 0이 내려오므로 금액을 비운다.
function buildIncomeLevels(medianIncomes) {
  if (!medianIncomes) return FALLBACK_INCOME_LEVELS;

  return [60, 80, 100, 120, 150, 180].map((percent) => {
    const amount = medianIncomes[`p${percent}`];
    return {
      percent,
      label: `중위소득 ${percent}%`,
      amount: amount > 0 ? `월 ${amount}만원 이하` : "",
    };
  });
}

const MOCK_CATEGORIES = {
  regions: [
    { optionId: "mock_seoul", optionValue: "서울특별시" },
    { optionId: "mock_busan", optionValue: "부산광역시" },
    { optionId: "mock_ulsan", optionValue: "울산광역시" },
    { optionId: "mock_gyeongnam", optionValue: "경상남도" },
    { optionId: "mock_gwangju", optionValue: "광주광역시" },
    { optionId: "mock_jeonnam", optionValue: "전라남도" },
    { optionId: "mock_jeonbuk", optionValue: "전북특별자치도" },
    { optionId: "mock_jeju", optionValue: "제주특별자치도" },
  ],
  status: [
    { optionId: "mock_student", optionValue: "학생" },
    { optionId: "mock_worker", optionValue: "재직자" },
  ],
  savingPeriod: [
    { optionId: "mock_short", optionValue: "1년 내외(단기)" },
    { optionId: "mock_long", optionValue: "3년 초과(장기)" },
  ],
  benefits: [
    { optionId: "mock_rate", optionValue: "우대금리" },
    { optionId: "mock_support", optionValue: "정부지원" },
  ],
  bankRelation: [
    { optionId: "mock_first", optionValue: "첫 거래" },
    { optionId: "mock_salary", optionValue: "급여 이체" },
  ],
  categoryIds: {},
  bankCategories: buildBankCategories(MOCK_BANK_PROVIDERS),
  bankNameByCode: buildBankNameByCode(MOCK_BANK_PROVIDERS),
  incomeLevel: FALLBACK_INCOME_LEVELS,
};

function isMockRecommendMode() {
  return import.meta.env.DEV
    && new URLSearchParams(window.location.search).get("mock") === "true";
}

export default function useRecommendForm() {
  const { accessToken } = useAuth();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [cats, setCats] = useState(null);
  const [loading, setLoading] = useState(true);
  const mockMode = isMockRecommendMode();
  const householdCount = formData.householdCount || 1;
  // PUT /user/me/profile은 전체 덮어쓰기라, 폼이 다루지 않는 값을 이어받기 위해 직전 프로필을 들고 있는다.
  const savedProfileRef = useRef(null);

  useEffect(() => {
    if (mockMode) {
      setCats(MOCK_CATEGORIES);
      setLoading(false);
      return;
    }

    // /api/categories 와 /providers/banks 는 인증이 필요하다.
    if (!accessToken) return;

    let cancelled = false;

    const loadFormOptions = async () => {
      try {
        // 저장된 프로필 조회는 실패해도 폼 자체는 열려야 한다.
        const [categoriesRes, banks, profile] = await Promise.all([
          client.get("/api/categories"),
          fetchBankProviders(),
          fetchUserProfile().catch((e) => {
            console.error("저장된 개인정보를 불러오지 못했습니다:", e);
            return null;
          }),
        ]);
        if (cancelled) return;

        const mappedCats = mapRecommendCategories(categoriesRes.data, {
          bankCategories: buildBankCategories(banks),
          bankNameByCode: buildBankNameByCode(banks),
          incomeLevel: FALLBACK_INCOME_LEVELS,
        });
        setCats(mappedCats);

        savedProfileRef.current = profile;
        const prefilled = applyProfileToFormData(profile, mappedCats);
        // 사용자가 이미 입력을 시작했다면 덮어쓰지 않는다.
        if (prefilled) {
          setFormData((prev) => (Object.keys(prev).length > 0 ? prev : prefilled));
        }
      } catch (e) {
        console.error("추천 폼 옵션을 불러오지 못했습니다:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFormOptions();

    return () => {
      cancelled = true;
    };
  }, [accessToken, mockMode]);

  // 중위소득 기준은 가구원 수에 따라 달라지므로 값이 바뀔 때마다 다시 받아온다.
  useEffect(() => {
    if (mockMode || !cats) return;

    let cancelled = false;

    fetchDynamicForm(householdCount)
      .then((dynamicForm) => {
        if (cancelled) return;
        const incomeLevel = buildIncomeLevels(dynamicForm?.medianIncomes);
        setCats((prev) => (prev ? { ...prev, incomeLevel } : prev));
      })
      .catch((e) => console.error("중위소득 기준을 불러오지 못했습니다:", e));

    return () => {
      cancelled = true;
    };
    // cats 전체를 의존성에 넣으면 setCats가 다시 이 effect를 깨우므로 존재 여부만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdCount, mockMode, Boolean(cats)]);

  const handleSubmit = async () => {
    const request = buildRecommendationRequest(formData, cats);

    if (mockMode) {
      return { request, result: null };
    }

    let result;
    try {
      result = await searchProducts(request);
    } catch (error) {
      throw new Error(error.response?.data?.message || "상품 분석에 실패했습니다.");
    }

    // 입력한 개인정보를 저장한다. 저장이 실패해도 이미 계산된 추천 결과는 보여준다.
    const persistProfile = async () => {
      try {
        await saveUserProfile(buildProfileRequest(formData, cats, savedProfileRef.current));
        savedProfileRef.current = await fetchUserProfile();
      } catch (e) {
        console.error("개인정보를 저장하지 못했습니다:", e);
      }
    };

    const [productDetails] = await Promise.all([
      fetchProductDetails(result, request),
      persistProfile(),
    ]);

    const recommendation = {
      request,
      result: {
        ...result,
        productDetails,
        // 정부 상세만 쓰던 기존 화면 호환용
        governmentDetails: productDetails.filter((detail) => detail?.government),
      },
    };

    // request가 없으면 상세/계산기에서 같은 조건으로 재조회할 수 없다.
    persistRecommendation(recommendation);
    return recommendation;
  };

  const go = (n) => () => setStep(n);

  return { step, formData, setFormData, cats, loading, go, handleSubmit };
}
