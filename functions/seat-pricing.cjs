'use strict'

const PLAN_CENTS = Object.freeze({ silver: 5900, gold: 12900, black: 29900 })
const CYLINDER_MONTHLY_CAP_CENTS = 49900
const MINIMUM_SEAT_CENTS = 1499

function normalizeTier(value) {
  const tier = String(value || '').toLowerCase()
  if (!Object.hasOwn(PLAN_CENTS, tier)) throw new Error('Choose Silver, Gold, or Black.')
  return tier
}

function seatPriceCents(tierValue, seatNumber) {
  const tier = normalizeTier(tierValue)
  const seat = Math.max(1, Math.floor(Number(seatNumber) || 1))
  if (seat === 1) return PLAN_CENTS[tier]
  let previous = PLAN_CENTS[tier]
  for (let position = 2; position <= seat; position += 1) {
    previous = Math.max(MINIMUM_SEAT_CENTS, Math.floor(previous / 200) * 100)
  }
  return previous
}

function monthlyTotalCents(tierValue, users) {
  const count = Math.max(1, Math.floor(Number(users) || 1))
  let total = PLAN_CENTS[normalizeTier(tierValue)]
  for (let seat = 2; seat <= count; seat += 1) total += seatPriceCents(tierValue, seat)
  return total
}

function cappedMonthlyTotalCents(tierValue, users) {
  return Math.min(monthlyTotalCents(tierValue, users), CYLINDER_MONTHLY_CAP_CENTS)
}

function marginalSeatCents(tierValue, seatNumber, alreadyChargedSeatCents = 0) {
  const remaining = Math.max(0, CYLINDER_MONTHLY_CAP_CENTS - PLAN_CENTS[normalizeTier(tierValue)] - Math.max(0, Number(alreadyChargedSeatCents) || 0))
  return Math.min(seatPriceCents(tierValue, seatNumber), remaining)
}

function cylinderCrossoverUsers(tierValue, cylinderMonthlyCents = CYLINDER_MONTHLY_CAP_CENTS) {
  for (let users = 2; users <= 1000; users += 1) {
    if (monthlyTotalCents(tierValue, users) > cylinderMonthlyCents) return users
  }
  return 1000
}

module.exports = {
  PLAN_CENTS,
  CYLINDER_MONTHLY_CAP_CENTS,
  MINIMUM_SEAT_CENTS,
  normalizeTier,
  seatPriceCents,
  monthlyTotalCents,
  cappedMonthlyTotalCents,
  marginalSeatCents,
  cylinderCrossoverUsers,
}
