const RECOMMENDATION_SESSION_KEY = "fin:last-recommendation";

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits,
  }).format(value);
}

export function formatContributionRate(value) {
  const rate = toFiniteNumber(value);
  return rate === null ? null : `연 ${formatNumber(rate)}%`;
}

export function formatContributionAmount(value) {
  const won = toFiniteNumber(value);
  if (won === null) return null;

  if (won % 10_000 === 0) {
    return `${formatNumber(won / 10_000, 1)} 만원`;
  }

  return `${formatNumber(won, 0)} 원`;
}

export function formatMonthlyDeposit(value) {
  const won = toFiniteNumber(value);
  if (won === null) return null;
  if (won % 10_000 === 0) return `${formatNumber(won / 10_000, 1)}만원`;
  return `${formatNumber(won, 0)}원`;
}

export function updateSuitabilityTag(tags, score) {
  if (score === null) return asArray(tags);
  const nextTag = `적합도 ${Math.round(score)}%`;
  const remainingTags = asArray(tags).filter((tag) => !String(tag).includes("적합도"));
  return [nextTag, ...remainingTags];
}

// providerName · N개월 만기 · 월 a~b 형태의 카드 부제목.
export function productSubtitle(detail) {
  const providerName = detail?.providerName || "정부 지원";
  const periods = asArray(detail?.saveTrms)
    .map(toFiniteNumber)
    .filter((period) => period !== null);
  const period = periods.length > 0 ? `${Math.max(...periods)}개월` : null;
  const minMonthlyLimit = formatMonthlyDeposit(detail?.minMonthlyLimit);
  const maxMonthlyLimit = formatMonthlyDeposit(detail?.maxMonthlyLimit);
  const monthlyLimit = minMonthlyLimit && maxMonthlyLimit
    ? `월 ${minMonthlyLimit}~${maxMonthlyLimit}`
    : maxMonthlyLimit
      ? `월 최대 ${maxMonthlyLimit}`
      : null;

  return [providerName, period, monthlyLimit].filter(Boolean).join(" · ");
}

// 추천 결과는 request와 result를 함께 저장한다.
// request가 없으면 상세/계산기에서 같은 조건으로 재조회할 수 없다.
export function persistRecommendation(recommendation) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(RECOMMENDATION_SESSION_KEY, JSON.stringify(recommendation));
  } catch {
    // 브라우저 저장소를 사용할 수 없어도 현재 화면 이동은 계속 진행한다.
  }
}

export function readPersistedRecommendation() {
  if (typeof window === "undefined") return null;

  try {
    const value = window.sessionStorage.getItem(RECOMMENDATION_SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function clearPersistedRecommendation() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(RECOMMENDATION_SESSION_KEY);
  } catch {
    // 로그아웃 자체는 브라우저 저장소 상태와 무관하게 완료되어야 한다.
  }
}

// 값이 없으면 가짜 숫자를 만들지 않고 비어 있음을 그대로 보여준다.
export function contributionDisplayValue(value, isUnlocked) {
  if (!value) return "—";
  if (!isUnlocked) return String(value).includes("만원") ? "??? 만원" : "연 ??? %";
  return value;
}
