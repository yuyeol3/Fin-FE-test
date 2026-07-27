import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useProductDetail from "../hooks/UseProductDetail";
import { simulateCalculator } from "../api/products";
import { buildCalculatorRequest, calculatorResultViewModel } from "../utils/productViewModel";
import { formatNumber } from "../utils/recommendationResult";
import { openProductApplication } from "../utils/productApplyLink";

function ArrowLeftIcon({ className = "" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19 8 12l7-7" />
    </svg>
  );
}

function InfoCircleIcon({ className = "" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 10.5v5" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TaxIcon({ className = "" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10" />
    </svg>
  );
}

function formatWon(value) {
  return `${Math.round(value).toLocaleString("ko-KR")} 원`;
}

// 백엔드 @Min(10_000) 검증에 걸리지 않도록 최소 납입액을 맞춘다.
const MIN_MONTHLY_AMOUNT = 10_000;

function Chip({ label, active }) {
  return (
    <span
      className={`flex h-[44px] items-center justify-center rounded-full px-[24px] text-[22px] font-medium leading-[1.2] ${
        active
          ? "border-2 border-[#03BFA5] bg-[#F7FFFE] text-[#03BFA5]"
          : "border border-[#E4E4E4] bg-white text-[#454545]"
      }`}
    >
      {label}
    </span>
  );
}

function OptionButton({ active, children, onClick, className = "", activeTone = "mint" }) {
  const activeClass = activeTone === "soft"
    ? "border border-[#E4E4E4] bg-[#EFEFEF] text-[#454545]"
    : "border-2 border-[#03BFA5] bg-[#F7FFFE] text-[#03BFA5]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[58px] items-center justify-center rounded-[10px] text-[22px] font-medium leading-[1.2] transition-colors ${
        active
          ? activeClass
          : "border border-[#E4E4E4] bg-white text-[#454545] hover:border-[#03BFA5]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function CalculatorCard({ children, className = "" }) {
  return (
    <section className={`rounded-[20px] border border-[#D5D5D5] bg-white ${className}`}>
      {children}
    </section>
  );
}

function AmountCard({ amount, onChange }) {
  return (
    <CalculatorCard className="relative h-[165px] px-[38px] py-[38px]">
      <h2 className="text-[22px] font-semibold leading-[1.2] text-[#454545]">월 납입액</h2>
      <div className="absolute bottom-[36px] right-[38px] flex items-end gap-[14px] text-[#454545]">
        <input
          type="number"
          min={MIN_MONTHLY_AMOUNT}
          step={10_000}
          value={amount}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="월 납입액"
          className="w-[260px] border-b border-[#D5D5D5] text-right text-[45px] font-bold leading-[1.2] focus:border-[#03BFA5] focus:outline-none"
        />
        <span className="pb-[10px] text-[26px] font-medium leading-[1.2]">원</span>
      </div>
    </CalculatorCard>
  );
}

function PeriodCard({ months, options, onChange }) {
  return (
    <CalculatorCard className="relative h-[220px] px-[42px] py-[38px]">
      <h2 className="text-[22px] font-semibold leading-[1.2] text-[#454545]">저축 기간</h2>
      <div className="absolute right-[38px] top-[65px] flex items-end gap-[10px] text-[#454545]">
        <span className="text-[45px] font-bold leading-[1.2]">{months}</span>
        <span className="pb-[10px] text-[26px] font-medium leading-[1.2]">개월</span>
      </div>
      <div className="absolute bottom-[36px] right-[38px] flex gap-[6px]">
        {options.map((option) => (
          <OptionButton
            key={option}
            active={months === option}
            onClick={() => onChange(option)}
            className="h-[50px] rounded-full px-[24px]"
          >
            {option}개월
          </OptionButton>
        ))}
      </div>
    </CalculatorCard>
  );
}

function ToggleCard({ title, options, value, onChange, activeTone = "soft" }) {
  return (
    <CalculatorCard className="h-[170px] px-[38px] py-[38px]">
      <h2 className="text-[22px] font-semibold leading-[1.2] text-[#454545]">{title}</h2>
      <div className="mt-[6px] grid grid-cols-2 gap-[5px]">
        {options.map((option) => (
          <OptionButton key={option} active={value === option} onClick={() => onChange(option)} activeTone={activeTone}>
            {option}
          </OptionButton>
        ))}
      </div>
    </CalculatorCard>
  );
}

function RateHero({ product }) {
  const navigate = useNavigate();
  const bank = product.bank;
  const metRateSum = (bank?.metConditions ?? []).reduce((sum, condition) => sum + (condition.rate ?? 0), 0);
  const headlineRate = bank?.achievableRate == null ? "-" : `${formatNumber(bank.achievableRate)}%`;
  const baseText = bank?.baseRate == null
    ? ""
    : `기본 ${formatNumber(bank.baseRate)}% + 충족 우대 ${formatNumber(metRateSum)}%`;
  // 충족/미충족 우대조건을 그대로 칩으로 노출한다.
  const chips = [
    ...(bank?.metConditions ?? []).map((condition) => ({
      label: `${condition.description || condition.keywordCode} ${formatNumber(condition.rate)}%`,
      active: true,
    })),
    ...(bank?.unmetConditions ?? []).map((condition) => ({
      label: `${condition.description || condition.keywordCode} ${formatNumber(condition.rate)}%`,
      active: false,
    })),
  ];

  return (
    <section className="relative flex min-h-[180px] items-center justify-between gap-8 rounded-[10px] bg-[#EFFFFD] px-[38px] py-[34px]">
      <button
        type="button"
        onClick={() => navigate(`/products/${product.id}`)}
        className="absolute right-[39px] top-[31px] flex items-center gap-[14px] text-[20px] font-medium leading-[1.2] text-[#454545] transition-colors hover:text-[#03BFA5]"
      >
        <ArrowLeftIcon className="size-[21px]" />
        계산 금리 수정하기
      </button>
      <div>
        <p className="mb-[17px] text-[22px] font-semibold leading-[1.2] text-[#454545]">내가 받을 수 있는 금리</p>
        <div className="flex flex-wrap items-end gap-[7px]">
          <span className="text-[50px] font-bold leading-[1.2] text-[#03BFA5]">{headlineRate}</span>
          <span className="pb-[10px] text-[22px] font-medium leading-[1.2] text-[#454545]">(연)</span>
          <span className="pb-[11px] text-[20px] font-medium leading-[1.2] text-[#454545]">{baseText}</span>
        </div>
      </div>
      <div className="mt-[68px] flex max-w-[620px] flex-wrap justify-end gap-[6px]">
        {chips.map((chip) => (
          <Chip key={chip.label} label={chip.label} active={chip.active} />
        ))}
      </div>
    </section>
  );
}

function ResultRow({ label, value, tone = "default" }) {
  const colorClass = tone === "positive" ? "text-[#03BFA5]" : tone === "negative" ? "text-[#D3455B]" : "text-[#454545]";

  return (
    <div className="flex h-[45px] items-start justify-between border-b border-[#D9D9D9] text-[24px] font-medium leading-[1.2]">
      <span className="text-[#454545]">{label}</span>
      <span className={colorClass}>{value}</span>
    </div>
  );
}

function ResultCard({ result, error }) {
  if (error) {
    return (
      <CalculatorCard className="flex h-[407px] items-center justify-center px-[38px] py-[38px]">
        <p className="text-center text-[20px] font-medium text-[#D3455B]">{error}</p>
      </CalculatorCard>
    );
  }

  if (!result) {
    return (
      <CalculatorCard className="flex h-[407px] items-center justify-center px-[38px] py-[38px]">
        <p className="text-[20px] text-[#8A8A8A]">계산 중이에요...</p>
      </CalculatorCard>
    );
  }

  return (
    <CalculatorCard className="h-[407px] px-[38px] py-[38px]">
      <h2 className="text-[22px] font-semibold leading-[1.2] text-[#454545]">예상 수령액</h2>
      <div className="mt-[35px] flex flex-col gap-[15px]">
        <ResultRow label="납입원금합계" value={formatWon(result.principal)} />
        <ResultRow label="세전 이자" value={`+ ${formatWon(result.preTaxInterest)}`} tone="positive" />
        <div className="flex items-center justify-between text-[24px] font-medium leading-[1.2]">
          <span className="text-[#454545]">{result.taxLabel}</span>
          <span className="flex items-center gap-[5px] text-[#D3455B]">
            <TaxIcon className="size-[22px]" />
            - {formatWon(result.interestTax)}
          </span>
        </div>
      </div>
      <div className="mt-[33px] border-t-2 border-[#D9D9D9] pt-[25px]">
        <div className="flex items-center justify-between">
          <span className="text-[24px] font-semibold leading-[1.2] text-[#454545]">세후 실수령액</span>
          <span className="text-[40px] font-semibold leading-[1.2] text-[#03BFA5]">{formatWon(result.afterTaxAmount)}</span>
        </div>
      </div>
    </CalculatorCard>
  );
}

function BottomActions({ product, assumptionNote }) {
  const navigate = useNavigate();
  const canApply = Boolean(product.applyUrl);

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="grid grid-cols-2 gap-[10px]">
        <button
          type="button"
          onClick={() => navigate(`/products/${product.id}`)}
          className="flex h-[78px] items-center justify-center gap-[10px] rounded-[10px] border-2 border-[#03BFA5] bg-white text-[25px] font-semibold leading-[1.2] text-[#03BFA5]"
        >
          <ArrowLeftIcon className="size-[16px]" />
          상품 상세
        </button>
        <button
          type="button"
          disabled={!canApply}
          title={canApply ? undefined : "공식 신청 페이지가 준비되지 않았어요."}
          onClick={() => openProductApplication(product)}
          className={`flex h-[78px] items-center justify-center rounded-[10px] border-2 text-[25px] font-semibold leading-[1.2] ${
            canApply
              ? "border-[#03BFA5] bg-[#03BFA5] text-white"
              : "cursor-not-allowed border-[#E0E0E0] bg-[#F5F5F5] text-[#B0B0B0]"
          }`}
        >
          {canApply ? "신청하러 가기" : "신청 링크 없음"}
        </button>
      </div>
      <div className="flex min-h-[93px] items-center rounded-[10px] border border-[#03BFA5] bg-[#F7FFFE] px-[37px] py-[22px]">
        <InfoCircleIcon className="mr-[9px] size-[20px] shrink-0 text-[#03BFA5]" />
        <p className="text-[18px] font-normal leading-[1.3] text-[#454545]">
          {assumptionNote
            ?? "매월 초 ∙ 매월 동일액 납입 가정 기준 예상치입니다. 실제 납입 시점 ∙ 금액에 따라 수령액이 달라질 수 있습니다."}
        </p>
      </div>
    </div>
  );
}

export default function ProductRateCalculator() {
  const { productId } = useParams();
  const { product, loading, request } = useProductDetail(productId);

  // 사용자가 만지기 전까지는 상품이 실제로 지원하는 값을 그대로 쓴다.
  // effect로 초기화하면 불필요한 연쇄 렌더가 생기므로 파생 값으로 둔다.
  const [monthsOverride, setMonths] = useState(null);
  const [amountOverride, setMonthlyAmount] = useState(null);
  const [accumulationOverride, setAccumulationType] = useState(null);
  const [interestOverride, setInterestType] = useState(null);
  const [taxType, setTaxType] = useState("일반 15.4%");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const months = monthsOverride ?? product?.saveTrms?.[product.saveTrms.length - 1] ?? 12;
  const accumulationType = accumulationOverride
    ?? (product?.reserveType === "FIXED" ? "정액" : "자유");
  const interestType = interestOverride
    ?? (product?.rateRows?.[0]?.interestTypeLabel === "복리" ? "복리" : "단리");
  const monthlyAmount = amountOverride
    ?? Math.max(MIN_MONTHLY_AMOUNT, request?.detailedOptions?.monthlySavingsGoal ?? 500_000);

  const calculatorRequest = useMemo(() => {
    if (!product || monthlyAmount < MIN_MONTHLY_AMOUNT) return null;
    return buildCalculatorRequest(product, { months, monthlyAmount, accumulationType, interestType, taxType });
  }, [product, months, monthlyAmount, accumulationType, interestType, taxType]);

  useEffect(() => {
    if (!calculatorRequest) return;
    let cancelled = false;

    simulateCalculator(calculatorRequest)
      .then((data) => {
        if (cancelled) return;
        setResult(calculatorResultViewModel(data));
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        // 백엔드가 한글 메시지를 그대로 주므로 사용자에게 노출한다.
        setError(e.response?.data?.message || "수익률을 계산하지 못했어요.");
      });

    return () => {
      cancelled = true;
    };
  }, [calculatorRequest]);

  if (loading || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white font-inter text-[20px] text-[#8A8A8A]">
        상품 정보를 불러오는 중이에요...
      </main>
    );
  }

  const amountError = monthlyAmount < MIN_MONTHLY_AMOUNT
    ? "월 납입액은 10,000원 이상이어야 해요."
    : null;
  const periodOptions = product.saveTrms.length > 0 ? product.saveTrms : [12];

  return (
    <main className="min-h-screen bg-white font-inter text-[#454545]">
      <div className="mx-auto w-full max-w-[1535px]">
        <h1 className="mb-[32px] pt-[74px] text-[32px] font-bold leading-[1.2] text-[#454545]">적금 수익률 계산기</h1>
        <RateHero product={product} />

        <div className="mt-[28px] grid gap-[30px] xl:grid-cols-[752px_762px]">
          <div className="flex flex-col gap-[20px]">
            <AmountCard amount={monthlyAmount} onChange={setMonthlyAmount} />
            <PeriodCard months={months} options={periodOptions} onChange={setMonths} />
            <ToggleCard
              title="적립 방식"
              options={["정액", "자유"]}
              value={accumulationType}
              onChange={setAccumulationType}
            />
            <ToggleCard
              title="이자 방식"
              options={["단리", "복리"]}
              value={interestType}
              onChange={setInterestType}
            />
            <ToggleCard
              title="과세 유형"
              options={["일반 15.4%", "비과세 0%"]}
              value={taxType}
              onChange={setTaxType}
              activeTone="mint"
            />
          </div>

          <div className="flex flex-col gap-[12px]">
            <ResultCard result={result} error={amountError ?? error} />
            <BottomActions product={product} assumptionNote={result?.assumptionNote} />
          </div>
        </div>
      </div>
    </main>
  );
}
