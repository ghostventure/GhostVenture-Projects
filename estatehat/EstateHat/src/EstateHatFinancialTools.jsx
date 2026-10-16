"use client";

import { useEffect, useState } from "react";
import { deleteFinanceScenario, exportFinanceScenarios, filterFinanceScenarios, importFinanceScenarios, renameFinanceScenario, saveFinanceScenario } from "./estatehat-finance-scenarios.js";
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
} from "./estatehat-financial-tools.js";

const tools = [
  { id: "cash-to-close", title: "Cash to Close", description: "Estimate down payment, closing costs, prepaid items, and credits.", fields: { price: ["Purchase price", 425000], downPaymentPercent: ["Down payment %", 20], closingCosts: ["Closing costs", 9000], prepaidCosts: ["Prepaid costs", 2600], credits: ["Credits", 1500] }, calculate: estimateCashToClose, output: (r) => [["Down payment", money(r.downPayment)], ["Costs", money(r.costs)], ["Credits", money(r.credits)], ["Estimated cash to close", money(r.total)]] },
  { id: "seller-net", title: "Seller Net Proceeds", description: "Subtract payoff, liens, commissions, platform fees, credits, and other costs.", fields: { salePrice: ["Sale price", 500000], payoff: ["Loan payoff", 280000], liens: ["Liens", 0], commissionPercent: ["Commission %", 0], platformFees: ["Platform fees", 725], repairCredits: ["Repair credits", 0], otherCosts: ["Other costs", 1800] }, calculate: estimateSellerNet, output: (r) => [["Gross sale price", money(r.gross)], ["Estimated commission", money(r.commission)], ["Total deductions", money(r.deductions)], ["Estimated net", money(r.net)]] },
  { id: "dti", title: "Debt to Income", description: "Compare monthly debt payments with gross monthly income.", fields: { monthlyDebt: ["Monthly debt", 1800], grossMonthlyIncome: ["Gross monthly income", 8500] }, calculate: calculateDebtToIncome, output: (r) => [["Debt to income", percent(r)]] },
  { id: "ltv", title: "Loan to Value", description: "Estimate the loan balance as a share of property value.", fields: { loanBalance: ["Loan balance", 340000], propertyValue: ["Property value", 425000] }, calculate: calculateLoanToValue, output: (r) => [["Loan to value", percent(r)], ["Equity share", percent(r === null ? null : 100 - r)]] },
  { id: "pmi", title: "PMI Estimate", description: "Illustrative monthly premium using your entered annual rate; lender quotes vary.", fields: { loanBalance: ["Loan balance", 390000], annualRatePercent: ["Annual premium rate %", 0.5], propertyValue: ["Property value", 425000] }, calculate: estimateMonthlyPmi, output: (r) => [["Estimated monthly PMI", money(r)], ["PMI estimate", r === 0 ? "LTV at or below 80%" : "LTV above 80%"]] },
  { id: "price-per-area", title: "Price per Square Foot", description: "Compare property prices using the area you provide.", fields: { price: ["Price", 425000], squareFeet: ["Square feet", 1800] }, calculate: calculatePricePerSquareFoot, output: (r) => [["Price per square foot", money(r)]] },
  { id: "rent-yield", title: "Gross Rental Yield", description: "Annualize monthly rent and divide by property value before expenses.", fields: { monthlyRent: ["Monthly rent", 2400], propertyValue: ["Property value", 350000] }, calculate: calculateGrossRentYield, output: (r) => [["Gross annual rent yield", percent(r)]] },
  { id: "cap-rate", title: "Capitalization Rate", description: "Estimate NOI and cap rate from annual rent and operating expenses.", fields: { annualRent: ["Annual rent", 28800], annualOperatingExpenses: ["Annual operating expenses", 8500], propertyValue: ["Property value", 350000] }, calculate: calculateCapRate, output: (r) => [["Net operating income", money(r.netOperatingIncome)], ["Estimated cap rate", percent(r.capRate)]] },
  { id: "rental-cash-flow", title: "Rental Cash Flow", description: "Compare rent with monthly financing and operating costs.", fields: { monthlyRent: ["Monthly rent", 2400], mortgagePayment: ["Mortgage payment", 1550], taxes: ["Monthly taxes", 320], insurance: ["Monthly insurance", 95], hoa: ["Monthly HOA", 0], maintenance: ["Maintenance reserve", 150], vacancy: ["Vacancy reserve", 120], management: ["Management costs", 190] }, calculate: calculateRentalCashFlow, output: (r) => [["Monthly income", money(r.income)], ["Monthly costs", money(r.expenses)], ["Monthly cash flow", money(r.monthly)], ["Annual cash flow", money(r.annual)]] },
  { id: "refinance", title: "Refinance Break Even", description: "Estimate months to recover closing costs from payment savings.", fields: { currentMonthlyPayment: ["Current payment", 2450], newMonthlyPayment: ["New payment", 2220], closingCosts: ["Refinance closing costs", 4200] }, calculate: estimateRefinanceBreakEven, output: (r) => [["Monthly savings", money(r.monthlySavings)], ["Break-even", r.months === null ? "No payment savings" : `${r.months.toFixed(1)} months`]] },
  { id: "affordability", title: "Purchase Budget", description: "Solve an approximate loan size from a monthly housing budget.", fields: { monthlyBudget: ["Monthly housing budget", 2800], annualRatePercent: ["Annual rate %", 6.5], termYears: ["Loan term in years", 30], downPaymentPercent: ["Down payment %", 20], monthlyTaxes: ["Monthly property taxes", 350], monthlyInsurance: ["Monthly insurance", 125], monthlyHoa: ["Monthly HOA", 0] }, calculate: calculateAffordablePurchasePrice, output: (r) => [["Estimated purchase price", money(r)]] },
  { id: "rent-own", title: "Rent vs. Own Costs", description: "Compare monthly rent with the entered monthly ownership costs.", fields: { monthlyRent: ["Monthly rent", 2100], mortgagePayment: ["Mortgage payment", 2200], taxes: ["Monthly taxes", 350], insurance: ["Monthly insurance", 125], hoa: ["Monthly HOA", 0], maintenance: ["Monthly maintenance", 180] }, calculate: compareRentAndOwn, output: (r) => [["Rent", money(r.rent)], ["Ownership costs", money(r.ownership)], ["Monthly own minus rent", money(r.monthlyDifference)], ["Annual difference", money(r.annualDifference)]] },
  { id: "equity", title: "Equity Snapshot", description: "Estimate gross equity and equity after entered selling costs.", fields: { propertyValue: ["Property value", 425000], loanBalance: ["Loan balance", 320000], sellingCosts: ["Estimated selling costs", 18000] }, calculate: calculateEquity, output: (r) => [["Gross equity", money(r.grossEquity)], ["After estimated selling costs", money(r.estimatedNetEquity)], ["Loan to value", percent(r.loanToValuePercent)]] },
  { id: "mortgage-payment", title: "Mortgage Payment", description: "Estimate principal and interest only for a fixed-rate loan.", fields: { principal: ["Loan principal", 340000], annualRatePercent: ["Annual rate %", 6.5], termYears: ["Term years", 30] }, calculate: calculateMortgagePayment, output: (r) => [["Monthly principal & interest", money(r.monthlyPrincipalAndInterest)], ["Total interest", money(r.totalInterest)], ["Payments", r.payments]] },
  { id: "extra-principal", title: "Extra Principal Impact", description: "Estimate payoff time and interest when paying extra each month.", fields: { principal: ["Loan principal", 340000], annualRatePercent: ["Annual rate %", 6.5], termYears: ["Term years", 30], extraMonthly: ["Extra monthly principal", 150] }, calculate: calculateExtraPaymentSavings, output: (r) => [["Months saved", r.monthsSaved], ["Interest saved", money(r.interestSaved)]] },
  { id: "points", title: "Discount Points Break Even", description: "Compare upfront point cost to a lender-provided payment savings estimate.", fields: { loanAmount: ["Loan amount", 340000], pointsPercent: ["Points %", 1], monthlyPaymentSavings: ["Monthly savings", 65] }, calculate: calculatePointsBreakeven, output: (r) => [["Upfront point cost", money(r.cost)], ["Break-even", r.months === null ? "Enter payment savings" : `${r.months.toFixed(1)} months`]] },
  { id: "escrow", title: "Monthly Escrow Reserve", description: "Convert annual tax, insurance, and other bills into a monthly reserve estimate.", fields: { annualPropertyTax: ["Annual property tax", 4200], annualInsurance: ["Annual insurance", 1500], annualOther: ["Other annual bills", 0] }, calculate: calculateMonthlyEscrow, output: (r) => [["Monthly tax", money(r.monthlyTax)], ["Monthly insurance", money(r.monthlyInsurance)], ["Monthly reserve", money(r.monthlyReserve)]] },
  { id: "down-payment-options", title: "Down Payment Scenarios", description: "Compare user-selected down payment amounts and principal-and-interest payments.", fields: { price: ["Purchase price", 425000], annualRatePercent: ["Annual rate %", 6.5], termYears: ["Term years", 30], downPaymentPercents: ["Percent options, comma separated", "5,10,15,20"] }, calculate: compareDownPayments, output: (r) => r.map((item) => [`${item.percentDown}% down (${money(item.downPayment)})`, `${money(item.monthlyPayment)} / month`]) },
  { id: "appreciation", title: "Value Growth Scenario", description: "Project a value scenario using an entered annual growth assumption; not a valuation.", fields: { currentValue: ["Current value", 425000], annualAppreciationPercent: ["Annual change %", 3], years: ["Years", 5] }, calculate: estimateAppreciatedValue, output: (r) => [["Illustrative future value", money(r)]] },
  { id: "grm", title: "Gross Rent Multiplier", description: "Divide a purchase price by annual gross rent before expenses.", fields: { propertyPrice: ["Property price", 350000], annualGrossRent: ["Annual gross rent", 28800] }, calculate: calculateGrossRentMultiplier, output: (r) => [["Gross rent multiplier", r === null ? "Enter annual rent" : `${r.toFixed(2)}x`]] },
  { id: "dscr", title: "Debt Service Coverage", description: "Compare entered NOI to annual debt service; lender thresholds vary.", fields: { netOperatingIncome: ["Annual NOI", 22000], annualDebtService: ["Annual debt service", 18000] }, calculate: calculateDebtServiceCoverage, output: (r) => [["DSCR", r === null ? "Enter debt service" : `${r.toFixed(2)}x`]] },
  { id: "cash-on-cash", title: "Cash on Cash Return", description: "Compare annual pre-tax cash flow to total cash invested.", fields: { annualPreTaxCashFlow: ["Annual pre-tax cash flow", 6000], cashInvested: ["Cash invested", 85000] }, calculate: calculateCashOnCashReturn, output: (r) => [["Cash on cash return", percent(r)]] },
  { id: "occupancy", title: "Break Even Occupancy", description: "Estimate the rent collection share needed to cover entered monthly costs.", fields: { monthlyFixedCosts: ["Monthly fixed costs", 1800], monthlyRent: ["Potential monthly rent", 2400], monthlyVariableCosts: ["Monthly variable costs", 200] }, calculate: calculateBreakEvenOccupancy, output: (r) => [["Break even occupancy", percent(r)]] },
  { id: "rehab-budget", title: "Rehab Contingency", description: "Add an entered contingency to a renovation budget estimate.", fields: { baseBudget: ["Base work budget", 25000], contingencyPercent: ["Contingency %", 15] }, calculate: estimateRehabBudget, output: (r) => [["Contingency reserve", money(r.contingency)], ["Budget with reserve", money(r.total)]] },
  { id: "expense-ratio", title: "Operating Expense Ratio", description: "Compare operating expenses to effective income using your figures.", fields: { annualOperatingExpenses: ["Annual operating expenses", 9000], annualEffectiveIncome: ["Annual effective income", 28800] }, calculate: calculateOperatingExpenseRatio, output: (r) => [["Operating expense ratio", percent(r)]] },
  { id: "investor-cash", title: "Investor Cash Required", description: "Add down payment, closing costs, initial repairs, and reserves.", fields: { purchasePrice: ["Purchase price", 350000], downPaymentPercent: ["Down payment %", 25], closingCosts: ["Closing costs", 9000], initialRepairs: ["Initial repairs", 12000], reserves: ["Cash reserves", 8000] }, calculate: estimateInvestorCashRequired, output: (r) => [["Estimated investor cash", money(r)]] },
];

function money(value) {
  if (value === null || !Number.isFinite(Number(value))) return "Enter valid non-zero inputs";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function percent(value) {
  if (value === null || !Number.isFinite(Number(value))) return "Enter a non-zero value";
  return `${Number(value).toFixed(1)}%`;
}

export default function EstateHatFinancialTools({ userKey = "guest" }) {
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const scenarioStorageKey = `estatehat-finance-scenarios-v1-${safeUserKey}`;
  const [values, setValues] = useState(() => Object.fromEntries(tools.map((tool) => [tool.id, Object.fromEntries(Object.entries(tool.fields).map(([key, [, initial]]) => [key, initial]))])));
  const [scenarios, setScenarios] = useState(() => {
    if (typeof window === "undefined") return [];
    try { const data = JSON.parse(window.localStorage.getItem(scenarioStorageKey) || "[]"); return importFinanceScenarios(JSON.stringify({ schemaVersion: 1, scenarios: data })); } catch { return []; }
  });
  const [scenarioQuery, setScenarioQuery] = useState("");
  const [scenarioToolFilter, setScenarioToolFilter] = useState("all");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState([]);
  const [scenarioNotice, setScenarioNotice] = useState("");
  useEffect(() => { try { localStorage.setItem(scenarioStorageKey, JSON.stringify(scenarios)); } catch { setScenarioNotice("Browser storage is unavailable; download a backup to keep these scenarios."); } }, [scenarioStorageKey, scenarios]);

  function saveScenario(tool, inputs) {
    try { setScenarios((current) => saveFinanceScenario(current, { toolId: tool.id, title: `${tool.title} · ${new Date().toLocaleDateString()}`, inputs })); setScenarioNotice("Calculation inputs saved in this browser."); }
    catch (error) { setScenarioNotice(error.message); }
  }

  function downloadBackup() {
    const url = URL.createObjectURL(new Blob([exportFinanceScenarios(scenarios)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "estatehat-financial-scenarios.json"; link.click(); URL.revokeObjectURL(url);
    setScenarioNotice("Scenario backup downloaded.");
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 500_000) throw new Error("Scenario backup must be under 500 KB.");
      const imported = importFinanceScenarios(await file.text());
      if (scenarios.length && !window.confirm(`Replace ${scenarios.length} saved scenarios with ${imported.length} backup scenarios?`)) { setScenarioNotice("Restore cancelled; saved scenarios were kept."); return; }
      setScenarios(imported); setScenarioNotice(`Restored ${imported.length} saved scenarios.`);
    } catch (error) { setScenarioNotice(error.message); }
    event.target.value = "";
  }

  const visibleScenarios = filterFinanceScenarios(scenarios, { query: scenarioQuery, toolId: scenarioToolFilter });
  const selectedScenarios = scenarios.filter((item) => selectedScenarioIds.includes(item.id));
  return (
    <section aria-labelledby="estatehat-financial-tools-title" style={{ marginTop: 32 }}>
      <div style={{ maxWidth: 780, marginBottom: 16 }}>
        <h2 id="estatehat-financial-tools-title" style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 30, color: "var(--s-dark)", margin: "0 0 6px" }}>Property &amp; Deal Toolkit</h2>
        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, lineHeight: 1.6, color: "var(--s-muted)", margin: 0 }}>Twenty-six editable estimates for planning conversations. Save scenarios locally in this browser; they are not synced. Results use only the values you enter, are not lender quotes or financial advice, and exclude costs you do not include.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 14 }}>
        {tools.map((tool) => {
          const result = tool.calculate(values[tool.id]);
          return <article key={tool.id} style={{ minWidth: 0, background: "var(--s-card)", border: "1px solid var(--s-border)", borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: "0 0 4px", color: "var(--s-dark)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15 }}>{tool.title}</h3>
            <p style={{ margin: "0 0 12px", color: "var(--s-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, lineHeight: 1.5 }}>{tool.description}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
              {Object.entries(tool.fields).map(([key, [label]]) => <label key={key} style={{ color: "var(--s-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 700 }}>
                {label}
                <input aria-label={`${tool.title}: ${label}`} type={key === "downPaymentPercents" ? "text" : "number"} inputMode={key === "downPaymentPercents" ? "text" : "decimal"} min="0" step="any" value={values[tool.id][key]} onChange={(event) => setValues((current) => ({ ...current, [tool.id]: { ...current[tool.id], [key]: event.target.value } }))} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4, padding: "8px 9px", border: "1px solid var(--s-border)", borderRadius: 7, background: "var(--s-input-bg)", color: "var(--s-dark)", fontSize: 12 }} />
              </label>)}
            </div>
            <dl style={{ display: "grid", gap: 5, margin: "14px 0 0", paddingTop: 10, borderTop: "1px solid var(--s-border)" }}>
              {tool.output(result).map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11 }}><dt style={{ color: "var(--s-muted)" }}>{label}</dt><dd style={{ margin: 0, color: "var(--s-dark)", fontWeight: 800, textAlign: "right" }}>{value}</dd></div>)}
            </dl>
            <button type="button" onClick={() => saveScenario(tool, values[tool.id])} style={{ marginTop: 10, border: "1px solid var(--s-border)", borderRadius: 7, padding: "7px 10px", background: "var(--s-surface)", color: "var(--s-dark)", fontWeight: 800, cursor: "pointer" }}>Save scenario</button>
          </article>;
        })}
      </div>
      <section aria-label="Saved financial scenarios" style={{ marginTop: 22, background: "var(--s-card)", border: "1px solid var(--s-border)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--s-dark)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16 }}>Saved scenarios</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <input aria-label="Search saved scenarios" value={scenarioQuery} onChange={(event) => setScenarioQuery(event.target.value)} placeholder="Search scenario name or input" style={{ flex: "1 1 200px", padding: 8, border: "1px solid var(--s-border)", borderRadius: 7 }} />
          <select aria-label="Filter scenarios by calculator" value={scenarioToolFilter} onChange={(event) => setScenarioToolFilter(event.target.value)} style={{ padding: 8, border: "1px solid var(--s-border)", borderRadius: 7 }}><option value="all">All calculators</option>{tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.title}</option>)}</select>
          <button type="button" onClick={downloadBackup} disabled={!scenarios.length}>Download backup</button>
          <label style={{ padding: 7, border: "1px solid var(--s-border)", borderRadius: 7, cursor: "pointer" }}>Restore backup<input aria-label="Restore scenario backup" type="file" accept="application/json,.json" onChange={restoreBackup} style={{ maxWidth: 150, display: "block" }} /></label>
        </div>
        {scenarioNotice && <p role="status" aria-live="polite" style={{ color: "var(--s-muted)", fontSize: 12 }}>{scenarioNotice}</p>}
        {selectedScenarios.length === 2 && <div style={{ padding: 10, marginBottom: 8, background: "var(--s-surface)", borderRadius: 8 }}><strong>Scenario comparison</strong>{Array.from(new Set(selectedScenarios.flatMap((item) => Object.keys(item.inputs)))).map((key) => <div key={key} style={{ display: "flex", gap: 12, fontSize: 12, marginTop: 4 }}><span style={{ minWidth: 120 }}>{key}</span>{selectedScenarios.map((item) => <span key={item.id}>{item.inputs[key] ?? "—"}</span>)}</div>)}</div>}
        {visibleScenarios.map((scenario) => <article key={scenario.id} style={{ borderTop: "1px solid var(--s-border)", padding: "9px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input aria-label={`Compare ${scenario.title}`} type="checkbox" checked={selectedScenarioIds.includes(scenario.id)} disabled={!selectedScenarioIds.includes(scenario.id) && selectedScenarioIds.length >= 2} onChange={() => setSelectedScenarioIds((current) => current.includes(scenario.id) ? current.filter((id) => id !== scenario.id) : [...current, scenario.id])} />
          <strong style={{ flex: "1 1 150px", color: "var(--s-dark)" }}>{scenario.title}</strong><span style={{ color: "var(--s-muted)", fontSize: 11 }}>{tools.find((tool) => tool.id === scenario.toolId)?.title || scenario.toolId}</span>
          <button type="button" onClick={() => { const name = window.prompt("Rename scenario", scenario.title); if (name) { try { setScenarios((current) => renameFinanceScenario(current, scenario.id, name)); } catch (error) { setScenarioNotice(error.message); } } }}>Rename</button>
          <button type="button" onClick={() => { setScenarios((current) => deleteFinanceScenario(current, scenario.id)); setSelectedScenarioIds((current) => current.filter((id) => id !== scenario.id)); }}>Delete</button>
        </article>)}
        {!visibleScenarios.length && <p style={{ color: "var(--s-muted)", fontSize: 12 }}>{scenarios.length ? "No saved scenarios match." : "No financial scenarios saved yet."}</p>}
      </section>
    </section>
  );
}
