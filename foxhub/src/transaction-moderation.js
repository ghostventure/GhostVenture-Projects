import { getContactTrustTier, getTrustRestrictionLine, getTrustTierMeta, getTrustTransactionPolicy } from "./rules.js";

function parseAmount(raw) {
  const normalized = String(raw || "").replace(/[^0-9.-]/g, "");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function resolveContactFromThread(state, thread) {
  if (!thread) return null;
  return (
    state.contacts.find((contact) => contact.id === thread.id) ||
    state.contacts.find((contact) => contact.name === thread.name) ||
    null
  );
}

function resolveUserRecord(state, contact) {
  if (!contact) return null;
  return state.userRecords.find((record) => record.contactId === contact.id) || null;
}

function recentWalletVelocity(state) {
  const now = Date.now();
  return state.walletEvents.filter((event) => {
    if (!(event.id > 1000000000000)) return false;
    return now - event.id <= 10 * 60 * 1000;
  }).length;
}

function buildReason(code, severity, message, basis) {
  return { code, severity, message, basis };
}

function pickOutcomeLabel(status) {
  if (status === "block") return "Blocked before money moved";
  if (status === "review") return "Held for moderator review";
  return "Allowed";
}

function pickRecommendedAction(status) {
  if (status === "block") return "Stop the flow, show the reason, and require operator intervention before retry.";
  if (status === "review") return "Hold the action, route it to manual review, and keep funds from moving until cleared.";
  return "Allow the action and keep monitoring velocity and counterparties.";
}

export function evaluateTransactionAction({ actionType, amount, state, selectedThread }) {
  const reasons = [];
  const normalizedAmount = parseAmount(amount);
  const contact = resolveContactFromThread(state, selectedThread);
  const userRecord = resolveUserRecord(state, contact);
  const velocityCount = recentWalletVelocity(state);
  const trustTier = getContactTrustTier(contact || {});
  const trustMeta = getTrustTierMeta(trustTier);
  const trustPolicy = getTrustTransactionPolicy(trustTier);

  if (!state?.authenticated) {
    reasons.push(
      buildReason(
        "auth_required",
        "block",
        "FoxHub blocked the transaction because the wallet only runs for authenticated users.",
        "Internal access control"
      )
    );
  }

  if (state?.profile?.accessState === "waitlist") {
    reasons.push(
      buildReason(
        "access_waitlist",
        "block",
        "FoxHub blocked the transaction because this account is still in access review.",
        "Internal access control"
      )
    );
  }

  if (!state?.profile?.name || !state?.profile?.handle || !state?.profile?.city) {
    reasons.push(
      buildReason(
        "profile_incomplete",
        "block",
        "FoxHub blocked the transaction because the identity profile is incomplete.",
        "Internal identity requirement"
      )
    );
  }

  if (normalizedAmount <= 0) {
    reasons.push(
      buildReason(
        "invalid_amount",
        "block",
        "FoxHub blocked the transaction because the amount is invalid.",
        "Internal transaction validation"
      )
    );
  }

  if (normalizedAmount >= 2000) {
    reasons.push(
      buildReason(
        "sar_threshold_review",
        "review",
        "FoxHub held the transaction for review because suspicious money transmission activity at or above $2,000 can require escalation.",
        "FinCEN MSB SAR guidance"
      )
    );
  }

  if (velocityCount >= 3) {
    reasons.push(
      buildReason(
        "rapid_velocity",
        "review",
        "FoxHub held the transaction because multiple wallet actions hit in a short window.",
        "Internal fraud velocity control"
      )
    );
  }

  if (actionType === "send" && selectedThread?.type !== "direct") {
    reasons.push(
      buildReason(
        "p2p_context_mismatch",
        "review",
        "FoxHub held the transfer because peer-to-peer payments should originate from a direct thread.",
        "Internal payment context control"
      )
    );
  }

  if ((actionType === "send" || actionType === "merchant" || actionType === "qr-pay") && !contact) {
    reasons.push(
      buildReason(
        "counterparty_unresolved",
        "review",
        "FoxHub held the payment because it could not resolve a verified counterparty from the active context.",
        "Internal counterparty verification control"
      )
    );
  }

  if ((actionType === "send" || actionType === "merchant" || actionType === "qr-pay") && contact?.trust === "open") {
    reasons.push(
      buildReason(
        "counterparty_low_trust",
        "review",
        "FoxHub held the payment because the counterparty relationship is not yet in a trusted state.",
        "Internal counterparty trust control"
      )
    );
  }

  if (actionType === "merchant") {
    if (contact && contact.accountType !== "merchant") {
      reasons.push(
        buildReason(
          "merchant_context_mismatch",
          "review",
          "FoxHub held the merchant payment because the active thread is not a verified merchant relationship.",
          "FTC mobile payment scam prevention pattern"
        )
      );
    }

    if (contact?.walletState === "review" || userRecord?.riskState === "review") {
      reasons.push(
        buildReason(
          "merchant_under_review",
          "block",
          "FoxHub blocked the merchant payment because the merchant wallet or risk profile is under review.",
          "Internal merchant risk control"
        )
      );
    }

    if (userRecord?.verification?.merchant === "pending" || userRecord?.verification?.payout === "blocked pending docs") {
      reasons.push(
        buildReason(
          "merchant_docs_pending",
          "block",
          "FoxHub blocked the merchant payment because merchant verification or payout documentation is still pending.",
          "Internal merchant verification control"
        )
      );
    }
  }

  if (contact && (actionType === "send" || actionType === "merchant" || actionType === "qr-pay")) {
    const transactionRule = trustPolicy[actionType];
    if (transactionRule === "block") {
      reasons.push(
        buildReason(
          "trust_tier_block",
          "block",
          `FoxHub blocked the transaction because ${contact.name} is rated ${trustTier} for trust. ${getTrustRestrictionLine(trustTier)}`,
          `Peer trust tier ${trustTier} (${trustMeta.label})`
        )
      );
    }

    if ((transactionRule === "review" || transactionRule === "review_over_limit") && normalizedAmount > trustPolicy.maxPeerAmount) {
      reasons.push(
        buildReason(
          "trust_tier_limit_review",
          "review",
          `FoxHub held the transaction because ${contact.name} is rated ${trustTier} and payments over $${trustPolicy.maxPeerAmount} require review.`,
          `Peer trust tier ${trustTier} (${trustMeta.label})`
        )
      );
    } else if (transactionRule === "review") {
      reasons.push(
        buildReason(
          "trust_tier_review",
          "review",
          `FoxHub held the transaction because ${contact.name} is rated ${trustTier} for trust and this action requires review.`,
          `Peer trust tier ${trustTier} (${trustMeta.label})`
        )
      );
    }
  }

  if (actionType === "cashout" && state?.profile?.accessState !== "active") {
    reasons.push(
      buildReason(
        "cashout_access_restricted",
        "block",
        "FoxHub blocked the cash-out because only fully active accounts can initiate payouts.",
        "Internal payout control"
      )
    );
  }

  const status = reasons.some((reason) => reason.severity === "block")
    ? "block"
    : reasons.some((reason) => reason.severity === "review")
      ? "review"
      : "allow";

  return {
    status,
    normalizedAmount,
    reasons,
    contact,
    userRecord
  };
}

export function buildModerationCase({ actionType, amount, state, selectedThread, evaluation }) {
  const labelMap = {
    send: "P2P transfer",
    add: "Wallet top-up",
    cashout: "Cash-out",
    merchant: "Merchant payment",
    utility: "Utility bill payment",
    "qr-pay": "QR merchant payment"
  };

  return {
    id: `mod-${Date.now()}`,
    actionType,
    title: labelMap[actionType] || "Wallet action",
    amount: amount || "",
    status: evaluation.status,
    outcomeLabel: pickOutcomeLabel(evaluation.status),
    recommendedAction: pickRecommendedAction(evaluation.status),
    threadName: selectedThread?.name || "No active thread",
    contactName: evaluation.contact?.name || "",
    trustTier: evaluation.contact ? getContactTrustTier(evaluation.contact) : "",
    detail: evaluation.reasons.map((reason) => reason.message).join(" "),
    basis: evaluation.reasons.map((reason) => reason.basis).join(" | "),
    reasonCodes: evaluation.reasons.map((reason) => reason.code),
    createdAtLabel: new Date().toLocaleString()
  };
}
