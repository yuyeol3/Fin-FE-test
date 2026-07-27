import {
  asArray,
  formatContributionAmount,
  formatContributionRate,
  formatMonthlyDeposit,
  formatNumber,
  productSubtitle,
  toFiniteNumber,
  updateSuitabilityTag,
} from "./recommendationResult";
import {
  APPLICATION_METHOD_FALLBACK,
  CONTRIBUTION_CAPTION_FALLBACK,
  RECRUIT_PERIOD_FALLBACK,
} from "../data/productCopy";

// 백엔드 ProductSource.code 값. DTO 주석의 government/bank가 아니라 실제로 이 값이 내려온다.
export const SOURCE_GOVERNMENT = "ONTONG";
export const SOURCE_BANK = "FSS";

// ProductList.jsx의 SECTIONS.name과 반드시 같은 문자열이어야 한다.
export const CATEGORY_GOVERNMENT = "정부 청년 상품";
export const CATEGORY_BANK = "시중 은행 상품 · 제 1금융권";
export const CATEGORY_SUBSCRIPTION = "청약 상품";

// KeywordValueEnum -> 화면 태그. 백엔드는 enum 이름만 주고 한글 라벨을 갖고 있지 않다.
const KEYWORD_TAG_LABELS = {
  BENEFIT_MAX_INTEREST: "최고이율",
  BENEFIT_TAX_FREE: "비과세",
  BENEFIT_EASY_CONDITION: "조건 간편",
  BENEFIT_GOV_SUBSIDY: "정부기여금",
  INTEREST_SAVINGS: "예·적금",
  INTEREST_LOAN: "대출",
  TERM_AROUND_1_YEAR: "1년 내외",
  TERM_2_TO_3_YEARS: "2~3년",
  TERM_OVER_3_YEARS: "3년 초과",
  STATUS_UNEMPLOYED: "무소득(학생)",
  STATUS_PART_TIME: "알바/프리랜서",
  STATUS_SME_WORKER: "중소기업 재직",
  STATUS_MILITARY: "군복무",
  BANK_FIRST_TRANSACTION: "첫거래 우대",
  BANK_SALARY_TRANSFER: "급여이체 우대",
  BANK_CARD_USAGE: "카드실적 우대",
  BANK_AUTO_TRANSFER: "자동이체 우대",
  BANK_MARKETING: "마케팅 동의",
  BANK_REDEPOSIT: "재예치 우대",
  BANK_ONLINE_JOIN: "온라인 가입",
  BANK_AGE: "연령 우대",
  BANK_ETC: "기타 우대",
};

// ProductType -> 화면 라벨
const PRODUCT_TYPE_LABELS = {
  DEPOSIT: "정기예금",
  SAVING: "정기적금",
  POLICY: "정책형 적립상품",
  SUBSCRIPTION: "주택청약종합저축",
};

const INTEREST_TYPE_LABELS = {
  SINGLE_INTEREST: "단리",
  COMPOUND_INTEREST: "복리",
};

// 알 수 없는 enum이 오면 원본 코드를 그대로 보여준다(빈칸으로 사라지지 않게).
export function keywordTagLabel(code) {
  return KEYWORD_TAG_LABELS[code] ?? code;
}

function categoryOf(sourceCode, isSubscription) {
  if (isSubscription) return CATEGORY_SUBSCRIPTION;
  return sourceCode === SOURCE_BANK ? CATEGORY_BANK : CATEGORY_GOVERNMENT;
}

function formatRate(value) {
  const rate = toFiniteNumber(value);
  return rate === null ? null : formatNumber(rate);
}

function toMapByProductId(items) {
  return new Map(
    asArray(items)
      .filter((item) => item?.productId != null)
      .map((item) => [item.productId, item]),
  );
}

// 여러 줄/구분자로 이어진 안내 문장을 목록으로 쪼갠다.
function splitLines(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n|\.\s+|·/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function contributionCaptionOf(government) {
  const monthlyDeposit = formatMonthlyDeposit(government?.effectiveMonthlyDeposit);
  const months = toFiniteNumber(government?.contributionPeriodMonths);
  if (monthlyDeposit && months) {
    return `월 ${monthlyDeposit} 납입 · ${months}개월 기준`;
  }
  return CONTRIBUTION_CAPTION_FALLBACK;
}

/**
 * 목록 카드용 뷰모델.
 * 백엔드가 이미 정렬해서 주므로 화면에서 다시 정렬하지 않는다.
 * (정부 기여금 환산수익률과 은행 금리를 한 축으로 섞어 정렬하면 잘못된 순서가 된다.)
 */
export function buildProductListViewModels({
  result,
  catalog = [],
  details = [],
  sortMode = "match",
}) {
  if (!result) return [];

  const subscriptionIds = new Set(
    asArray(result.subscriptionProducts).map((item) => item.productId),
  );
  const matchById = toMapByProductId([
    ...asArray(result.governmentRanked),
    ...asArray(result.bankRanked),
  ]);
  const rateById = toMapByProductId([
    ...asArray(result.governmentRateRanked),
    ...asArray(result.bankRateRanked),
    ...asArray(result.subscriptionProducts),
  ]);
  const catalogById = toMapByProductId(catalog);
  const detailById = toMapByProductId(details);

  // 백엔드가 내려준 순서를 그대로 쓴다.
  const orderedRows =
    sortMode === "rate"
      ? [
          ...asArray(result.governmentRateRanked),
          ...asArray(result.bankRateRanked),
          ...asArray(result.subscriptionProducts),
        ]
      : [...asArray(result.governmentRanked), ...asArray(result.bankRanked)];

  const seen = new Set();

  return orderedRows.flatMap((row) => {
    const productId = row?.productId;
    if (productId == null || seen.has(productId)) return [];
    seen.add(productId);

    const match = matchById.get(productId);
    const rate = rateById.get(productId);
    const catalogEntry = catalogById.get(productId);
    const detail = detailById.get(productId);
    const sourceCode = row.source;
    const isSubscription = subscriptionIds.has(productId) || Boolean(rate?.isSubscription);
    const category = categoryOf(sourceCode, isSubscription);
    const government = detail?.government;
    const score = toFiniteNumber(match?.totalScore);

    const keywordTags = asArray(detail?.keywords).map(keywordTagLabel);
    const fallbackTag = category === CATEGORY_GOVERNMENT
      ? "정부지원"
      : category === CATEGORY_SUBSCRIPTION
        ? "청약"
        : null;

    const contributionRate = formatContributionRate(
      government?.annualizedYield ?? (category === CATEGORY_GOVERNMENT ? rate?.achievableRate : null),
    );
    const maturityContribution = formatContributionAmount(government?.expectedTotalContribution);

    return [{
      id: productId,
      productPropertyId: row.productPropertyId ?? match?.productPropertyId ?? rate?.productPropertyId ?? null,
      sourceCode,
      category,
      title: row.productName ?? catalogEntry?.productName,
      institution: row.providerName ?? catalogEntry?.providerName ?? "정부 지원",
      subtitle: detail
        ? productSubtitle(detail)
        : row.providerName ?? catalogEntry?.providerName ?? "정부 지원",
      // 정부 상품의 ProductRateDto.baseRate는 0으로 고정돼 있어 쓰지 않는다.
      baseRate: formatRate(catalogEntry?.baseRate ?? detail?.bank?.baseRate),
      maxRate: formatRate(catalogEntry?.maxRate ?? detail?.bank?.maxRate),
      myRate: formatRate(rate?.achievableRate),
      suitability: score ?? 0,
      tags: updateSuitabilityTag(
        keywordTags.length > 0 ? keywordTags : [fallbackTag].filter(Boolean),
        score,
      ),
      contributionRate,
      maturityContribution,
      contributionCaption: contributionCaptionOf(government),
      hasCalculatedContribution: Boolean(contributionRate && maturityContribution),
      rateNote: rate?.rateComparable === false ? rate?.subscriptionNote : null,
      applyUrl: detail?.applyUrl ?? null,
    }];
  });
}

/**
 * 추천 결과가 없을 때(직접 /products 진입 등) 공개 카탈로그만으로 만드는 둘러보기 목록.
 * 적합도/달성 가능 금리는 추천 결과가 있어야 계산되므로 비워둔다.
 */
export function buildCatalogViewModels(catalog = []) {
  return asArray(catalog)
    .filter((item) => item?.productId != null)
    .map((item) => {
      const category = categoryOf(item.source, false);
      return {
        id: item.productId,
        // 카탈로그 응답에는 property가 없어 찜/계산기는 상세에서만 가능하다.
        productPropertyId: null,
        sourceCode: item.source,
        category,
        title: item.productName,
        institution: item.providerName ?? "정부 지원",
        subtitle: item.providerName ?? "정부 지원",
        baseRate: formatRate(item.baseRate),
        maxRate: formatRate(item.maxRate),
        myRate: null,
        suitability: 0,
        tags: [category === CATEGORY_GOVERNMENT ? "정부지원" : "제1금융권"],
        contributionRate: null,
        maturityContribution: null,
        contributionCaption: CONTRIBUTION_CAPTION_FALLBACK,
        hasCalculatedContribution: false,
        rateNote: null,
        applyUrl: null,
      };
    });
}

/** 상세 화면용 뷰모델. */
export function buildProductDetailViewModel(detail, { productPropertyId, catalogEntry, match, rate } = {}) {
  if (!detail) return null;

  const isSubscription = detail.productType === "SUBSCRIPTION";
  const category = categoryOf(detail.sourceCode, isSubscription);
  const government = detail.government;
  const bank = detail.bank;
  const periods = asArray(detail.saveTrms).map(toFiniteNumber).filter((p) => p !== null);
  const maxPeriod = periods.length > 0 ? Math.max(...periods) : null;
  const minPeriod = periods.length > 0 ? Math.min(...periods) : null;
  const score = toFiniteNumber(detail.matchScore ?? match?.totalScore);

  const monthlyRange = (() => {
    const min = formatMonthlyDeposit(detail.minMonthlyLimit);
    const max = formatMonthlyDeposit(detail.maxMonthlyLimit);
    if (min && max) return `월 ${min} ~ ${max}`;
    if (max) return `월 최대 ${max}`;
    return null;
  })();

  // 선택된 기간의 금리표 행. 이자 계산 방식 표기에 쓴다.
  const selectedRateRow = asArray(detail.rateTable).find((row) => row.saveTrm === maxPeriod)
    ?? asArray(detail.rateTable)[0];

  const rateConditions = [
    ...asArray(bank?.metConditions).map((condition) => ({
      label: condition.description || keywordTagLabel(condition.keywordCode),
      value: `+${formatNumber(condition.rate)}%`,
      status: "matched",
    })),
    ...asArray(bank?.unmetConditions).map((condition) => ({
      label: condition.description || keywordTagLabel(condition.keywordCode),
      value: `+${formatNumber(condition.rate)}%`,
      status: "missed",
    })),
  ];
  if (selectedRateRow?.intrRateType) {
    rateConditions.push({
      label: "이자 계산 방식",
      value: INTEREST_TYPE_LABELS[selectedRateRow.intrRateType] ?? selectedRateRow.intrRateType,
      status: "neutral",
    });
  }

  const contributionRate = formatContributionRate(
    government?.annualizedYield ?? rate?.achievableRate,
  );
  const maturityContribution = formatContributionAmount(government?.expectedTotalContribution);

  const target = [
    detail.minAge != null || detail.maxAge != null
      ? `만 ${detail.minAge ?? 0}세 이상${detail.maxAge != null ? ` ~ ${detail.maxAge}세 이하` : ""}`
      : null,
    detail.requiresHomeless ? "무주택 요건 충족 필요" : null,
    detail.requiresHouseholder ? "세대주 요건 충족 필요" : null,
    ...splitLines(detail.eligibilityText),
  ].filter(Boolean);

  return {
    id: detail.productId,
    productPropertyId: productPropertyId ?? null,
    sourceCode: detail.sourceCode,
    category,
    title: detail.productName,
    detailTitle: detail.productName,
    institution: detail.providerName || "정부 지원",
    metaInstitution: `기관 ${detail.providerName || "정부 지원"}`,
    subtitle: productSubtitle(detail),
    periodSummary: maxPeriod
      ? maxPeriod % 12 === 0 ? `${maxPeriod / 12}년 만기` : `${maxPeriod}개월 만기`
      : "상시",
    amountSummary: monthlyRange ?? "한도 정보 없음",
    savingPeriod: maxPeriod
      ? periods.length > 1 ? `${minPeriod}~${maxPeriod}개월` : `${maxPeriod}개월 만기`
      : "상시",
    depositRange: monthlyRange ?? "한도 정보 없음",
    productType: [
      PRODUCT_TYPE_LABELS[detail.productType] ?? detail.productType,
      detail.reserveTypeName ? `(${detail.reserveTypeName})` : null,
    ].filter(Boolean).join(" "),
    rawProductType: detail.productType,
    reserveType: detail.reserveType,
    saveTrms: periods,
    applicationMethod: detail.joinMethod || APPLICATION_METHOD_FALLBACK,
    target,
    caution: splitLines(detail.cautionText),
    recruitPeriod: detail.recruitmentPeriod || RECRUIT_PERIOD_FALLBACK,
    content: detail.content,
    contentSummary: detail.contentSummary,
    tags: updateSuitabilityTag(asArray(detail.keywords).map(keywordTagLabel), score),
    suitability: score ?? 0,
    baseRate: formatRate(bank?.baseRate ?? catalogEntry?.baseRate),
    maxRate: formatRate(bank?.maxRate ?? catalogEntry?.maxRate),
    myRate: formatRate(bank?.achievableRate ?? rate?.achievableRate),
    rateRows: asArray(detail.rateTable).map((row) => ({
      term: `${row.saveTrm}개월`,
      baseRate: `${formatNumber(row.baseRate)}%`,
      maxRate: `${formatNumber(row.maxRate)}%`,
      interestTypeLabel: INTEREST_TYPE_LABELS[row.intrRateType] ?? row.intrRateType,
    })),
    rateConditions,
    contributionRate,
    maturityContribution,
    contributionCaption: contributionCaptionOf(government),
    hasCalculatedContribution: Boolean(contributionRate && maturityContribution),
    bank,
    government,
    isSubscription,
    metricsLocked: Boolean(detail.metricsLocked),
    lockMessage: detail.lockMessage,
    applyUrl: detail.applyUrl ?? null,
  };
}

/**
 * POST /calculator 요청 본문.
 * appliedRate는 퍼센트가 아니라 소수다(백엔드가 maxRate/100과 비교한다).
 */
export function buildCalculatorRequest(detailVm, controls) {
  const ratePercent = toFiniteNumber(
    detailVm?.bank?.achievableRate ?? detailVm?.bank?.maxRate,
  );
  if (ratePercent === null || !detailVm?.productPropertyId) return null;

  return {
    productPropertyId: detailVm.productPropertyId,
    productType: detailVm.rawProductType,
    interestRateType: controls.interestType === "복리" ? "COMPOUND_INTEREST" : "SINGLE_INTEREST",
    reserveType: controls.accumulationType === "정액" ? "FIXED" : "FREE",
    appliedRate: ratePercent / 100,
    amount: controls.monthlyAmount,
    saveTrm: controls.months,
    taxType: String(controls.taxType).includes("비과세") ? "NON_TAX" : "GENERAL",
  };
}

export function calculatorResultViewModel(response) {
  if (!response) return null;
  const taxRate = toFiniteNumber(response.taxRate) ?? 0;

  return {
    principal: toFiniteNumber(response.principal) ?? 0,
    preTaxInterest: toFiniteNumber(response.preTaxInterest) ?? 0,
    interestTax: toFiniteNumber(response.interestTax) ?? 0,
    taxLabel: `이자 과세 (${formatNumber(taxRate * 100, 1)}%)`,
    afterTaxAmount: toFiniteNumber(response.afterTaxAmount) ?? 0,
    maturityAmount: toFiniteNumber(response.maturityAmount) ?? 0,
    assumptionNote: response.assumptionNote,
  };
}
