import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAffordablePurchasePrice,
  calculateCapRate,
  calculateDebtToIncome,
  calculateEquity,
  calculateMortgagePayment,
  calculateExtraPaymentSavings,
  calculatePointsBreakeven,
  calculateMonthlyEscrow,
  compareDownPayments,
  estimateAppreciatedValue,
  calculateGrossRentMultiplier,
  calculateDebtServiceCoverage,
  calculateCashOnCashReturn,
  calculateBreakEvenOccupancy,
  estimateRehabBudget,
  calculateOperatingExpenseRatio,
  estimateInvestorCashRequired,
  calculateGrossRentYield,
  calculateLoanToValue,
  calculatePricePerSquareFoot,
  calculateRentalCashFlow,
  compareRentAndOwn,
  estimateCashToClose,
  estimateMonthlyPmi,
  estimateRefinanceBreakEven,
  estimateSellerNet,
} from "../src/estatehat-financial-tools.js";

test("cash-to-close includes prepaid costs and subtracts credits", () => {
  assert.deepEqual(estimateCashToClose({ price: 400000, downPaymentPercent: 10, closingCosts: 8000, prepaidCosts: 1000, credits: 2500 }), { downPayment: 40000, costs: 9000, credits: 2500, total: 46500 });
});
test("seller net includes explicit deductions without inventing commission", () => {
  assert.deepEqual(estimateSellerNet({ salePrice: 500000, payoff: 200000, liens: 5000, commissionPercent: 2, platformFees: 725, repairCredits: 1000, otherCosts: 300 }), { gross: 500000, deductions: 217025, net: 282975, commission: 10000 });
});
test("debt-to-income safely handles missing income", () => {
  assert.equal(calculateDebtToIncome({ monthlyDebt: 1800, grossMonthlyIncome: 6000 }), 30);
  assert.equal(calculateDebtToIncome({ monthlyDebt: 1800, grossMonthlyIncome: 0 }), null);
});
test("loan-to-value safely handles missing property value", () => {
  assert.equal(calculateLoanToValue({ loanBalance: 320000, propertyValue: 400000 }), 80);
  assert.equal(calculateLoanToValue({ loanBalance: 10, propertyValue: 0 }), null);
});
test("PMI estimate uses entered premium rate only above 80 percent LTV", () => {
  assert.equal(estimateMonthlyPmi({ loanBalance: 320000, propertyValue: 400000, annualRatePercent: 0.6 }), 0);
  assert.equal(estimateMonthlyPmi({ loanBalance: 360000, propertyValue: 400000, annualRatePercent: 0.6 }), 180);
});
test("price per square foot rejects a zero-area denominator", () => {
  assert.equal(calculatePricePerSquareFoot({ price: 420000, squareFeet: 1400 }), 300);
  assert.equal(calculatePricePerSquareFoot({ price: 420000, squareFeet: 0 }), null);
});
test("gross rent yield annualizes the monthly rent", () => {
  assert.equal(calculateGrossRentYield({ monthlyRent: 2500, propertyValue: 300000 }), 10);
});
test("cap rate reports net operating income and value ratio", () => {
  assert.deepEqual(calculateCapRate({ annualRent: 36000, annualOperatingExpenses: 12000, propertyValue: 300000 }), { netOperatingIncome: 24000, capRate: 8 });
});
test("rental cash flow returns monthly and annual net", () => {
  assert.deepEqual(calculateRentalCashFlow({ monthlyRent: 2500, mortgagePayment: 1400, taxes: 300, insurance: 100, maintenance: 200 }), { income: 2500, expenses: 2000, monthly: 500, annual: 6000 });
});
test("refinance estimate marks non-saving scenarios as not recovered", () => {
  assert.deepEqual(estimateRefinanceBreakEven({ currentMonthlyPayment: 2400, newMonthlyPayment: 2200, closingCosts: 4000 }), { monthlySavings: 200, months: 20, recoversCosts: true });
  assert.equal(estimateRefinanceBreakEven({ currentMonthlyPayment: 2200, newMonthlyPayment: 2250, closingCosts: 4000 }).months, null);
});
test("purchase budget solves for monthly payment affordability", () => {
  assert.ok(calculateAffordablePurchasePrice({ monthlyBudget: 2800, annualRatePercent: 6.5, termYears: 30, downPaymentPercent: 20, monthlyTaxes: 300, monthlyInsurance: 100 }) > 300000);
  assert.equal(calculateAffordablePurchasePrice({ monthlyBudget: 300, annualRatePercent: 6, termYears: 30, downPaymentPercent: 100 }), 0);
});
test("rent-versus-own compares entered monthly cash costs", () => {
  assert.deepEqual(compareRentAndOwn({ monthlyRent: 2000, mortgagePayment: 1800, taxes: 300, insurance: 100 }), { rent: 2000, ownership: 2200, monthlyDifference: 200, annualDifference: 2400 });
});
test("equity snapshot includes net equity and LTV", () => {
  assert.deepEqual(calculateEquity({ propertyValue: 400000, loanBalance: 300000, sellingCosts: 20000 }), { grossEquity: 100000, estimatedNetEquity: 80000, loanToValuePercent: 75 });
});

test("mortgage payment separates principal and interest and handles zero interest", () => {
  const result = calculateMortgagePayment({ principal: 120000, annualRatePercent: 0, termYears: 10 });
  assert.equal(result.monthlyPrincipalAndInterest, 1000);
  assert.equal(result.totalInterest, 0);
  assert.equal(calculateMortgagePayment({ principal: 100000, annualRatePercent: 6, termYears: 30 }).monthlyPrincipalAndInterest > 0, true);
});

test("extra principal scenarios reduce term and interest", () => {
  const result = calculateExtraPaymentSavings({ principal: 250000, annualRatePercent: 6, termYears: 30, extraMonthly: 200 });
  assert.ok(result.monthsSaved > 0);
  assert.ok(result.interestSaved > 0);
});

test("points and escrow estimates report explicit break-even and monthly reserves", () => {
  assert.deepEqual(calculatePointsBreakeven({ loanAmount: 200000, pointsPercent: 1, monthlyPaymentSavings: 50 }), { cost: 2000, months: 40, recoversCost: true });
  assert.equal(calculatePointsBreakeven({ loanAmount: 200000, pointsPercent: 1, monthlyPaymentSavings: 0 }).months, null);
  assert.equal(calculateMonthlyEscrow({ annualPropertyTax: 3600, annualInsurance: 1200 }).monthlyReserve, 400);
});

test("down payment comparison returns unique scenarios with payment estimates", () => {
  const results = compareDownPayments({ price: 300000, annualRatePercent: 0, termYears: 30, downPaymentPercents: "10,20,20" });
  assert.equal(results.length, 2);
  assert.equal(results[0].loanAmount, 270000);
  assert.equal(results[1].monthlyPayment < results[0].monthlyPayment, true);
});

test("investment estimates cover appreciation, rent multiples, DSCR, and returns", () => {
  assert.ok(Math.abs(estimateAppreciatedValue({ currentValue: 100000, annualAppreciationPercent: 10, years: 2 }) - 121000) < 0.001);
  assert.equal(calculateGrossRentMultiplier({ propertyPrice: 240000, annualGrossRent: 24000 }), 10);
  assert.equal(calculateDebtServiceCoverage({ netOperatingIncome: 24000, annualDebtService: 20000 }), 1.2);
  assert.equal(calculateCashOnCashReturn({ annualPreTaxCashFlow: 6000, cashInvested: 50000 }), 12);
});

test("occupancy, rehab reserve, expense ratio, and investor cash estimates handle missing denominators", () => {
  assert.equal(calculateBreakEvenOccupancy({ monthlyFixedCosts: 1800, monthlyRent: 2000, monthlyVariableCosts: 200 }), 100);
  assert.equal(calculateBreakEvenOccupancy({ monthlyFixedCosts: 100, monthlyRent: 0 }), null);
  assert.deepEqual(estimateRehabBudget({ baseBudget: 20000, contingencyPercent: 10 }), { base: 20000, contingency: 2000, total: 22000 });
  assert.equal(calculateOperatingExpenseRatio({ annualOperatingExpenses: 10000, annualEffectiveIncome: 40000 }), 25);
  assert.equal(estimateInvestorCashRequired({ purchasePrice: 200000, downPaymentPercent: 25, closingCosts: 5000, initialRepairs: 3000, reserves: 7000 }), 65000);
});
