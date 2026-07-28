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

// 추천 폼이 실제로 다루는 카테고리 그룹.
// 상품관심사(CATEGORY_ID.interests)는 폼에 대응 UI가 없다.
const FORM_MANAGED_GROUPS = ["regions", "status", "savingPeriod", "benefits", "bankRelation"];

function managedOptionIds(categories) {
  return new Set(
    FORM_MANAGED_GROUPS.flatMap((group) =>
      (categories?.[group] || []).map((option) => toNumber(option.optionId)),
    ).filter((id) => id !== null),
  );
}

/**
 * 추천 폼 입력을 PUT /user/me/profile 본문으로 변환한다.
 *
 * 금액 단위는 폼과 마이페이지가 모두 만원을 쓰므로 그대로 저장한다.
 * (원 단위 변환은 검색 요청 경계인 buildRecommendationRequest에서만 한다.)
 *
 * PUT은 전체 덮어쓰기라서 폼이 다루지 않는 값은 기존 프로필에서 이어받아야 한다.
 */
export function buildProfileRequest(data, categories, previousProfile) {
  const managed = managedOptionIds(categories);
  const preservedOptionIds = (previousProfile?.selectedOptionIds || [])
    .map(toNumber)
    .filter((id) => id !== null && !managed.has(id));
  const selectedOptionIds = selectedOptions(data, categories?.categoryIds)
    .map((option) => option.optionId);

  const employmentMonths = toNumber(data.employmentMonths);

  return {
    birthdate: toBirthdate(data),
    annualIncome: toNumber(data.income),
    householdSize: toNumber(data.householdCount) ?? 1,
    householdIncomePercent: toNumber(data.householdIncomePercent),
    tenureMonths: employmentMonths && employmentMonths > 0 ? employmentMonths : null,
    // 프로필은 "물어봤고 아니라고 답했다"를 false로 남긴다(검색 요청과 달리 null로 뭉개지 않는다).
    isFirstJob: Boolean(data.isFirstJob),
    isHomeless:
      data.housingStatus === "무주택"
        ? true
        : data.housingStatus === "유주택"
          ? false
          : null,
    isHouseholder: Boolean(data.isTenant),
    monthlySavingsGoal: toNumber(data.monthlyAmount),
    mainBanks: previousProfile?.mainBanks ?? [],
    neverUsedBanks: data.firstBanks || [],
    maturedSavingBanks: data.maturedBanks || [],
    selectedOptionIds: [...new Set([...selectedOptionIds, ...preservedOptionIds])],
  };
}

// 생년월일 select의 option 값은 0 패딩이 없는 문자열이라 "02" -> "2"로 맞춰야 한다.
function toSelectValue(part) {
  const number = toNumber(part);
  return number === null ? "" : String(number);
}

/** 저장된 프로필을 추천 폼 상태로 되돌린다. 프로필이 없으면 null. */
export function applyProfileToFormData(profile, categories) {
  if (!profile?.hasProfile) return null;

  const [year, month, day] = String(profile.birthdate || "").split("-");
  const idsOfGroup = (group) => {
    const ids = new Set((categories?.[group] || []).map((option) => toNumber(option.optionId)));
    return (profile.selectedOptionIds || [])
      .map(toNumber)
      .filter((id) => id !== null && ids.has(id));
  };

  const regionIds = idsOfGroup("regions");

  return {
    birthYear: toSelectValue(year),
    birthMonth: toSelectValue(month),
    birthDay: toSelectValue(day),
    income: profile.annualIncome ?? "",
    householdCount: profile.householdSize ?? 1,
    householdIncomePercent: profile.householdIncomePercent ?? null,
    employmentMonths: profile.tenureMonths ?? "",
    isFirstJob: Boolean(profile.isFirstJob),
    housingStatus:
      profile.isHomeless === true ? "무주택" : profile.isHomeless === false ? "유주택" : "",
    isTenant: Boolean(profile.isHouseholder),
    monthlyAmount: profile.monthlySavingsGoal ?? "",
    firstBanks: profile.neverUsedBanks || [],
    maturedBanks: profile.maturedSavingBanks || [],
    region: regionIds[0] ?? "",
    status: idsOfGroup("status"),
    savingPeriod: idsOfGroup("savingPeriod"),
    benefits: idsOfGroup("benefits"),
    bankRelation: idsOfGroup("bankRelation"),
  };
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
