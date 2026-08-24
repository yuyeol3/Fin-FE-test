import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import { fetchBankProviders } from "../api/products";
import { fetchFavorites, removeFavorite as removeFavoriteRequest } from "../api/favorites";
import { CATEGORY_ID, findCategoryById } from "../utils/recommendationPayload";
import {
  MOCK_PROFILE,
  MOCK_OPTION_CATEGORIES,
  MOCK_FAVORITES,
  MOCK_BANK_PROVIDERS,
} from "../data/mypage";

// 카테고리 이름은 DB 텍스트라 바뀔 수 있어서 CategoryIdEnum 기준 id로 매칭한다.
const CATEGORY_ID_BY_GROUP = {
  savingPeriod: CATEGORY_ID.savingPeriod,
  status: CATEGORY_ID.status,
  benefits: CATEGORY_ID.benefits,
  bankRelation: CATEGORY_ID.bankRelation,
};

export function splitTrailingParen(value) {
  if (!value) return { main: "", caption: "" };
  const match = value.match(/^(.*?)(\([^)]*\))\s*$/);
  if (!match) return { main: value, caption: "" };
  return { main: match[1].trim(), caption: match[2] };
}

function isMockMode() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("mock") === "true";
}

function buildOptionTagsByCategory(profile, categories) {
  const groups = { savingPeriod: [], status: [], benefits: [], bankRelation: [] };
  if (!profile || !categories) return groups;

  const optionMap = {};
  categories.forEach((category) => {
    (category.options || []).forEach((option) => {
      optionMap[option.optionId] = {
        categoryId: Number(category.categoryId),
        optionValue: option.optionValue,
      };
    });
  });

  (profile.selectedOptionIds || []).forEach((id) => {
    const option = optionMap[id];
    if (!option) return;
    const groupKey = Object.keys(CATEGORY_ID_BY_GROUP).find(
      (key) => CATEGORY_ID_BY_GROUP[key] === option.categoryId,
    );
    if (groupKey) groups[groupKey].push(option.optionValue);
  });

  return groups;
}

export function findCategoryOptions(categories, categoryId) {
  return findCategoryById(categories, categoryId)?.options || [];
}

export function findSelectedOptionIds(categories, categoryId, selectedOptionIds) {
  const ids = new Set(findCategoryOptions(categories, categoryId).map((option) => option.optionId));
  return (selectedOptionIds || []).filter((id) => ids.has(id));
}

export function replaceCategorySelection(selectedOptionIds, categories, categoryId, newIds) {
  const ids = new Set(findCategoryOptions(categories, categoryId).map((option) => option.optionId));
  const kept = (selectedOptionIds || []).filter((id) => !ids.has(id));
  return [...kept, ...newIds];
}

function buildProfileRequestBody(profile, patch) {
  return {
    birthdate: profile.birthdate,
    annualIncome: profile.annualIncome,
    householdSize: profile.householdSize,
    householdIncomePercent: profile.householdIncomePercent,
    tenureMonths: profile.tenureMonths,
    isFirstJob: profile.isFirstJob,
    isHomeless: profile.isHomeless,
    isHouseholder: profile.isHouseholder,
    monthlySavingsGoal: profile.monthlySavingsGoal,
    mainBanks: profile.mainBanks,
    neverUsedBanks: profile.neverUsedBanks,
    maturedSavingBanks: profile.maturedSavingBanks,
    selectedOptionIds: profile.selectedOptionIds,
    ...patch,
  };
}

function calculateAge(birthdate) {
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

// mock 모드는 실제 백엔드가 없어 display를 재계산할 서버가 없으므로, 미리보기용으로 최소한만 다시 계산한다.
function applyMockPatch(prev, patch, categories) {
  const merged = { ...prev, ...patch };
  const display = { ...prev.display };

  if (patch.birthdate) {
    display.age = calculateAge(patch.birthdate);
  }

  if (patch.selectedOptionIds) {
    const regionOption = findCategoryOptions(categories, CATEGORY_ID.regions).find((option) =>
      patch.selectedOptionIds.includes(option.optionId),
    );
    if (regionOption) display.region = regionOption.optionValue;
  }

  if (patch.neverUsedBanks || patch.maturedSavingBanks) {
    display.transactionHistory = {
      firstTransactionBanks: patch.neverUsedBanks ?? prev.neverUsedBanks ?? [],
      redepositBanks: patch.maturedSavingBanks ?? prev.maturedSavingBanks ?? [],
    };
  }

  return { ...merged, display };
}

export default function useMyPage() {
  const { accessToken } = useAuth();
  const mockMode = isMockMode();

  const [profile, setProfile] = useState(mockMode ? MOCK_PROFILE : null);
  const [categories, setCategories] = useState(mockMode ? MOCK_OPTION_CATEGORIES : null);
  const [banks, setBanks] = useState(mockMode ? MOCK_BANK_PROVIDERS : []);
  const [favorites, setFavorites] = useState(mockMode ? MOCK_FAVORITES.items : []);
  const [showComparisonNotice, setShowComparisonNotice] = useState(
    mockMode ? MOCK_FAVORITES.showComparisonNotice : false,
  );
  const [loading, setLoading] = useState(!mockMode);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mockMode || !accessToken) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, categoriesRes, favoritesData, bankProviders] = await Promise.all([
          client.get("/user/me/profile"),
          client.get("/api/categories"),
          fetchFavorites(),
          fetchBankProviders(),
        ]);
        if (cancelled) return;
        setProfile(profileRes.data);
        setCategories(categoriesRes.data || []);
        setBanks(bankProviders);
        setFavorites(favoritesData.items || []);
        setShowComparisonNotice(Boolean(favoritesData.showComparisonNotice));
      } catch (e) {
        if (!cancelled) setError(e);
        console.error("마이페이지 정보를 불러오지 못했습니다:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, mockMode]);

  const optionTagsByCategory = useMemo(
    () => buildOptionTagsByCategory(profile, categories),
    [profile, categories],
  );

  const removeFavorite = async (productPropertyId) => {
    const prevFavorites = favorites;
    setFavorites((prev) => prev.filter((item) => item.productPropertyId !== productPropertyId));

    if (mockMode) return;
    try {
      await removeFavoriteRequest(productPropertyId);
    } catch (e) {
      console.error("찜 삭제에 실패했습니다:", e);
      setFavorites(prevFavorites);
    }
  };

  const updateProfile = async (patch) => {
    if (mockMode) {
      setProfile((prev) => applyMockPatch(prev, patch, categories));
      return { ok: true };
    }

    const body = buildProfileRequestBody(profile, patch);
    try {
      await client.put("/user/me/profile", body);
      const res = await client.get("/user/me/profile");
      setProfile(res.data);
      return { ok: true };
    } catch (e) {
      console.error("개인정보 수정에 실패했습니다:", e);
      return { ok: false };
    }
  };

  return {
    profile,
    categories,
    banks,
    optionTagsByCategory,
    favorites,
    showComparisonNotice,
    loading,
    error,
    removeFavorite,
    updateProfile,
  };
}
