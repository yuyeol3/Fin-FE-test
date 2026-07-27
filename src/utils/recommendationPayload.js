// 백엔드 CategoryIdEnum과 1:1로 대응한다.
// 카테고리 이름은 DB 텍스트라 언제든 바뀔 수 있어서 id로 매칭한다.
export const CATEGORY_ID = {
  regions: 1,
  status: 2,
  savingPeriod: 3,
  benefits: 4,
  interests: 5,
  bankRelation: 6,
};

const HIDDEN_BANK_RELATION_OPTIONS = new Set(["첫거래고객", "재예치"]);

// 은행 그룹 표시 순서. GET /providers/banks의 category 값(시중/인터넷/특수/지방/기타)과 같다.
const BANK_CATEGORY_ORDER = ["시중", "인터넷", "특수", "지방"];

function normalizeCategoryName(value = "") {
  return value.replace(/[\s·_()-]/g, "").toLowerCase();
}

export function findCategoryById(categories, categoryId) {
  return categories?.find((category) => Number(category?.categoryId) === categoryId);
}

// GET /providers/banks 응답을 BankSelector가 쓰는 그룹 구조로 바꾼다.
// banks는 코드 배열로 두고 표시 이름은 bankNameByCode로 따로 넘긴다.
// (백엔드 프로필 API가 은행 코드를 주고받으므로 선택 값 자체를 코드로 유지한다.)
export function buildBankCategories(banks = []) {
  const byCategory = new Map();
  banks.forEach((bank) => {
    if (!bank?.code) return;
    const category = bank.category || "기타";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(bank.code);
  });

  const orderedNames = [
    ...BANK_CATEGORY_ORDER.filter((name) => byCategory.has(name)),
    ...[...byCategory.keys()].filter((name) => !BANK_CATEGORY_ORDER.includes(name)),
  ];

  return orderedNames.map((name) => ({
    id: name,
    title: `${name}은행`,
    banks: byCategory.get(name),
  }));
}

export function buildBankNameByCode(banks = []) {
  return Object.fromEntries(
    banks.filter((bank) => bank?.code).map((bank) => [bank.code, bank.name]),
  );
}

export function mapRecommendCategories(payload, extras = {}) {
  const categories = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  const matched = Object.fromEntries(
    Object.entries(CATEGORY_ID).map(([key, categoryId]) => [
      key,
      findCategoryById(categories, categoryId),
    ]),
  );

  return {
    regions: matched.regions?.options || [],
    status: matched.status?.options || [],
    savingPeriod: matched.savingPeriod?.options || [],
    benefits: matched.benefits?.options || [],
    bankRelation: (matched.bankRelation?.options || []).filter(
      (option) => !HIDDEN_BANK_RELATION_OPTIONS.has(
        normalizeCategoryName(option?.optionValue),
      ),
    ),
    categoryIds: Object.fromEntries(
      Object.entries(matched).map(([key, category]) => [key, category?.categoryId]),
    ),
    ...extras,
  };
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toWonFromTenThousand(value) {
  const number = toNumber(value);
  return number === null ? null : Math.round(number * 10_000);
}

function toBirthdate(data) {
  if (!data.birthYear || !data.birthMonth || !data.birthDay) return null;
  const month = String(data.birthMonth).padStart(2, "0");
  const day = String(data.birthDay).padStart(2, "0");
  return `${data.birthYear}-${month}-${day}`;
}

function selectedOptions(data, categoryIds) {
  const fields = [
    ["regions", data.region ? [data.region] : []],
    ["status", data.status || []],
    ["savingPeriod", data.savingPeriod || []],
    ["benefits", data.benefits || []],
    ["bankRelation", data.bankRelation || []],
  ];

  const seen = new Set();
  return fields.flatMap(([field, values]) => {
    const categoryId = toNumber(categoryIds?.[field]);
    if (categoryId === null) return [];

    return values.flatMap((value) => {
      const optionId = toNumber(value);
      const key = `${categoryId}:${optionId}`;
      if (optionId === null || seen.has(key)) return [];
      seen.add(key);
      return [{ categoryId, optionId }];
    });
  });
}

export function buildRecommendationRequest(data, categories) {
  const employmentMonths = toNumber(data.employmentMonths);

  return {
    options: selectedOptions(data, categories?.categoryIds),
    detailedOptions: {
      birthdate: toBirthdate(data),
      annualIncome: toWonFromTenThousand(data.income),
      householdSize: toNumber(data.householdCount) ?? 1,
      householdIncomePercent: toNumber(data.householdIncomePercent),
      tenureMonths: employmentMonths && employmentMonths > 0 ? employmentMonths : null,
      isFirstJob: data.isFirstJob ? true : null,
      isHomeless:
        data.housingStatus === "무주택"
          ? true
          : data.housingStatus === "유주택"
            ? false
            : null,
      isHouseholder: data.isTenant ? true : null,
      monthlySavingsGoal: toWonFromTenThousand(data.monthlyAmount),
      mainBanks: [],
      // 선택 값이 이미 은행 코드다(GET /providers/banks의 code).
      neverUsedBanks: data.firstBanks || [],
      maturedSavingBanks: data.maturedBanks || [],
      selectedInterestRateOptions: [],
    },
  };
}
