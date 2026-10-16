const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const nonnegative = (value) => Math.max(0, finite(value));
const percentage = (value) => Math.min(100, Math.max(0, finite(value)));

export function estimateCashToClose({ price, downPaymentPercent, closingCosts, prepaidCosts = 0, credits = 0 }) {
  const purchasePrice = nonnegative(price);
  const downPayment = purchasePrice * percentage(downPaymentPercent) / 100;
  const fees = nonnegative(closingCosts) + nonnegative(prepaidCosts);
  return { downPayment, costs: fees, credits: nonnegative(credits), total: Math.max(0, downPayment + fees - nonnegative(credits)) };
}

export function estimateSellerNet({ salePrice, payoff = 0, liens = 0, commissionPercent = 0, platformFees = 0, repairCredits = 0, otherCosts = 0 }) {
  const gross = nonnegative(salePrice);
  const commission = gross * percentage(commissionPercent) / 100;
  const deductions = nonnegative(payoff) + nonnegative(liens) + commission + nonnegative(platformFees) + nonnegative(repairCredits) + nonnegative(otherCosts);
  return { gross, deductions, net: gross - deductions, commission };
}

export function calculateDebtToIncome({ monthlyDebt, grossMonthlyIncome }) {
  const income = nonnegative(grossMonthlyIncome);
  if (!income) return null;
  return nonnegative(monthlyDebt) / income * 100;
}

export function calculateLoanToValue({ loanBalance, propertyValue }) {
  const value = nonnegative(propertyValue);
  if (!value) return null;
  return nonnegative(loanBalance) / value * 100;
}

export function estimateMonthlyPmi({ loanBalance, annualRatePercent, propertyValue }) {
  const ltv = calculateLoanToValue({ loanBalance, propertyValue });
  if (ltv === null) return null;
  if (ltv <= 80) return 0;
  return nonnegative(loanBalance) * percentage(annualRatePercent) / 100 / 12;
}

export function calculatePricePerSquareFoot({ price, squareFeet }) {
  const area = nonnegative(squareFeet);
  if (!area) return null;
  return nonnegative(price) / area;
}

export function calculateGrossRentYield({ monthlyRent, propertyValue }) {
  const value = nonnegative(propertyValue);
  if (!value) return null;
  return nonnegative(monthlyRent) * 12 / value * 100;
}

export function calculateCapRate({ annualRent, annualOperatingExpenses, propertyValue }) {
  const value = nonnegative(propertyValue);
  if (!value) return null;
  const netOperatingIncome = nonnegative(annualRent) - nonnegative(annualOperatingExpenses);
  return { netOperatingIncome, capRate: netOperatingIncome / value * 100 };
}

export function calculateRentalCashFlow({ monthlyRent, mortgagePayment = 0, taxes = 0, insurance = 0, hoa = 0, maintenance = 0, vacancy = 0, management = 0 }) {
  const income = nonnegative(monthlyRent);
  const expenses = nonnegative(mortgagePayment) + nonnegative(taxes) + nonnegative(insurance) + nonnegative(hoa) + nonnegative(maintenance) + nonnegative(vacancy) + nonnegative(management);
  return { income, expenses, monthly: income - expenses, annual: (income - expenses) * 12 };
}

export function estimateRefinanceBreakEven({ currentMonthlyPayment, newMonthlyPayment, closingCosts }) {
  const monthlySavings = nonnegative(currentMonthlyPayment) - nonnegative(newMonthlyPayment);
  const costs = nonnegative(closingCosts);
  if (monthlySavings <= 0) return { monthlySavings, months: null, recoversCosts: false };
  return { monthlySavings, months: costs / monthlySavings, recoversCosts: true };
}

export function calculateAffordablePurchasePrice({ monthlyBudget, annualRatePercent, termYears, downPaymentPercent, monthlyTaxes = 0, monthlyInsurance = 0, monthlyHoa = 0 }) {
  const paymentBudget = nonnegative(monthlyBudget) - nonnegative(monthlyTaxes) - nonnegative(monthlyInsurance) - nonnegative(monthlyHoa);
  const months = Math.max(1, Math.min(600, finite(termYears, 30) * 12));
  const monthlyRate = percentage(annualRatePercent) / 100 / 12;
  if (paymentBudget <= 0 || percentage(downPaymentPercent) >= 100) return 0;
  const loanAmount = monthlyRate === 0
    ? paymentBudget * months
    : paymentBudget * (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate;
  return loanAmount / (1 - percentage(downPaymentPercent) / 100);
}

export function compareRentAndOwn({ monthlyRent, mortgagePayment, taxes = 0, insurance = 0, hoa = 0, maintenance = 0 }) {
  const rent = nonnegative(monthlyRent);
  const ownership = nonnegative(mortgagePayment) + nonnegative(taxes) + nonnegative(insurance) + nonnegative(hoa) + nonnegative(maintenance);
  return { rent, ownership, monthlyDifference: ownership - rent, annualDifference: (ownership - rent) * 12 };
}

export function calculateEquity({ propertyValue, loanBalance, sellingCosts = 0 }) {
  const value = nonnegative(propertyValue);
  const balance = nonnegative(loanBalance);
  const costs = nonnegative(sellingCosts);
  return { grossEquity: value - balance, estimatedNetEquity: value - balance - costs, loanToValuePercent: value ? balance / value * 100 : null };
}

function monthlyMortgagePayment(principal, annualRatePercent, termYears) {
  const amount = nonnegative(principal);
  const months = Math.max(1, Math.min(600, finite(termYears, 30) * 12));
  const rate = percentage(annualRatePercent) / 1200;
  return rate === 0 ? amount / months : amount * rate / (1 - Math.pow(1 + rate, -months));
}

export function calculateMortgagePayment({ principal, annualRatePercent, termYears }) {
  const payment = monthlyMortgagePayment(principal, annualRatePercent, termYears);
  const months = Math.max(1, Math.min(600, finite(termYears, 30) * 12));
  return { principal: nonnegative(principal), monthlyPrincipalAndInterest: payment, totalPaid: payment * months, totalInterest: payment * months - nonnegative(principal), payments: months };
}

export function calculateExtraPaymentSavings({ principal, annualRatePercent, termYears, extraMonthly = 0 }) {
  const amount = nonnegative(principal);
  const rate = percentage(annualRatePercent) / 1200;
  const basePayment = monthlyMortgagePayment(amount, annualRatePercent, termYears);
  const extra = nonnegative(extraMonthly);
  function payoff(payment) {
    let balance = amount;
    let interest = 0;
    let months = 0;
    while (balance > 0.005 && months < 1200) {
      const charge = balance * rate;
      interest += charge;
      balance -= Math.max(0, payment - charge);
      months += 1;
    }
    return { months, interest };
  }
  const baseline = payoff(basePayment);
  const accelerated = payoff(basePayment + extra);
  return { baselineMonths: baseline.months, acceleratedMonths: accelerated.months, monthsSaved: Math.max(0, baseline.months - accelerated.months), interestSaved: Math.max(0, baseline.interest - accelerated.interest) };
}

export function calculatePointsBreakeven({ loanAmount, pointsPercent, monthlyPaymentSavings }) {
  const cost = nonnegative(loanAmount) * percentage(pointsPercent) / 100;
  const savings = nonnegative(monthlyPaymentSavings);
  return { cost, months: savings ? cost / savings : null, recoversCost: savings > 0 };
}

export function calculateMonthlyEscrow({ annualPropertyTax, annualInsurance, annualOther = 0 }) {
  return { monthlyTax: nonnegative(annualPropertyTax) / 12, monthlyInsurance: nonnegative(annualInsurance) / 12, monthlyOther: nonnegative(annualOther) / 12, monthlyReserve: (nonnegative(annualPropertyTax) + nonnegative(annualInsurance) + nonnegative(annualOther)) / 12 };
}

export function compareDownPayments({ price, annualRatePercent, termYears, downPaymentPercents = "5,10,15,20" }) {
  return String(downPaymentPercents).split(",").map((raw) => percentage(raw.trim())).filter((value, index, values) => values.indexOf(value) === index).map((percentDown) => {
    const downPayment = nonnegative(price) * percentDown / 100;
    const principal = nonnegative(price) - downPayment;
    return { percentDown, downPayment, loanAmount: principal, monthlyPayment: monthlyMortgagePayment(principal, annualRatePercent, termYears) };
  });
}

export function estimateAppreciatedValue({ currentValue, annualAppreciationPercent, years }) {
  const periods = Math.max(0, Math.min(100, finite(years)));
  const annualRate = Math.max(-100, Math.min(100, finite(annualAppreciationPercent)));
  return nonnegative(currentValue) * Math.pow(1 + annualRate / 100, periods);
}

export function calculateGrossRentMultiplier({ propertyPrice, annualGrossRent }) {
  const rent = nonnegative(annualGrossRent);
  return rent ? nonnegative(propertyPrice) / rent : null;
}

export function calculateDebtServiceCoverage({ netOperatingIncome, annualDebtService }) {
  const debt = nonnegative(annualDebtService);
  return debt ? nonnegative(netOperatingIncome) / debt : null;
}

export function calculateCashOnCashReturn({ annualPreTaxCashFlow, cashInvested }) {
  const cash = nonnegative(cashInvested);
  return cash ? finite(annualPreTaxCashFlow) / cash * 100 : null;
}

export function calculateBreakEvenOccupancy({ monthlyFixedCosts, monthlyRent, monthlyVariableCosts = 0 }) {
  const rent = nonnegative(monthlyRent);
  if (!rent) return null;
  return (nonnegative(monthlyFixedCosts) + nonnegative(monthlyVariableCosts)) / rent * 100;
}

export function estimateRehabBudget({ baseBudget, contingencyPercent }) {
  const base = nonnegative(baseBudget);
  const reserve = base * percentage(contingencyPercent) / 100;
  return { base, contingency: reserve, total: base + reserve };
}

export function calculateOperatingExpenseRatio({ annualOperatingExpenses, annualEffectiveIncome }) {
  const income = nonnegative(annualEffectiveIncome);
  return income ? nonnegative(annualOperatingExpenses) / income * 100 : null;
}

export function estimateInvestorCashRequired({ purchasePrice, downPaymentPercent, closingCosts, initialRepairs, reserves }) {
  return nonnegative(purchasePrice) * percentage(downPaymentPercent) / 100 + nonnegative(closingCosts) + nonnegative(initialRepairs) + nonnegative(reserves);
}
