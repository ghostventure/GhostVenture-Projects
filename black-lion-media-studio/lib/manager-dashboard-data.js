import { listAllRequestsWithUsers, listModelProfiles } from "./db";
import { buildConsultationCalendarData, parseConsultationDateTime } from "./consultation-calendar";
import { getConsultationAvailability } from "./consultations";

const completedStatuses = new Set(["Completed", "Delivered", "Closed"]);
const cancelledStatuses = new Set(["Cancelled", "Declined"]);
const oneDayMs = 24 * 60 * 60 * 1000;
const followUpStatuses = new Set(["New", "Approved", "Awaiting Payment", "In Progress"]);
const priorityRank = new Map([
  ["Urgent", 4],
  ["High", 3],
  ["Standard", 2],
  ["Low", 1]
]);

function parsePriceFloor(label) {
  const match = String(label || "").match(/\$([\d,]+)/);
  if (!match) {
    return 0;
  }

  return Number(match[1].replace(/,/g, ""));
}

function sortMapEntries(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

function addCount(map, value) {
  const key = String(value || "Unspecified");
  map.set(key, (map.get(key) || 0) + 1);
}

function aggregateRequestMetrics(requests, now) {
  const uniqueClientIds = new Set();
  const serviceCounts = new Map();
  const statusCounts = new Map();
  const invoiceStatusCounts = new Map();
  const paymentStatusCounts = new Map();
  const fulfillmentStatusCounts = new Map();
  let newRequests = 0;
  let appointmentOnlyRequests = 0;
  let completedRequests = 0;
  let cancelledRequests = 0;
  let consultationQueue = 0;
  let receivablesFloor = 0;
  let invoiceReadyCount = 0;
  let paymentMethodCount = 0;
  let shippingReadyCount = 0;
  let billingFollowUpCount = 0;

  for (const request of requests) {
    if (request.user_id) uniqueClientIds.add(request.user_id);
    addCount(serviceCounts, request.project_type);
    addCount(statusCounts, request.status);
    addCount(invoiceStatusCounts, request.invoice_status);
    addCount(paymentStatusCounts, request.payment_status);
    addCount(fulfillmentStatusCounts, request.fulfillment_status);

    if (request.status === "New") newRequests += 1;
    if (completedStatuses.has(request.status)) completedRequests += 1;
    if (cancelledStatuses.has(request.status)) cancelledRequests += 1;
    if (request.shipping_ready) shippingReadyCount += 1;

    if (!cancelledStatuses.has(request.status)) {
      const consultationAt = parseConsultationDateTime(
        request.consultation_date,
        request.consultation_time
      )?.getTime();
      if (consultationAt && consultationAt >= now) consultationQueue += 1;
    }

    if (request.source === "Square Appointments") {
      appointmentOnlyRequests += 1;
      continue;
    }

    receivablesFloor += parsePriceFloor(request.budget);
    if (request.billing_contact_ready) invoiceReadyCount += 1;
    if (request.payment_method_ready) paymentMethodCount += 1;
    if (!request.billing_contact_ready || !request.payment_method_ready) {
      billingFollowUpCount += 1;
    }

  }

  return {
    uniqueClients: uniqueClientIds.size,
    newRequests,
    appointmentOnlyRequests,
    completedRequests,
    cancelledRequests,
    activeRequests: requests.length - completedRequests - cancelledRequests,
    consultationQueue,
    receivablesFloor,
    invoiceReadyCount,
    paymentMethodCount,
    shippingReadyCount,
    billingFollowUpCount,
    serviceBreakdown: sortMapEntries(serviceCounts).slice(0, 6),
    statusBreakdown: sortMapEntries(statusCounts),
    invoiceStatusBreakdown: sortMapEntries(invoiceStatusCounts),
    paymentStatusBreakdown: sortMapEntries(paymentStatusCounts),
    fulfillmentStatusBreakdown: sortMapEntries(fulfillmentStatusCounts)
  };
}

function latestTime(...values) {
  return values.reduce((latest, value) => {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) && time > latest ? time : latest;
  }, 0);
}

function needsBillingFollowUp(request) {
  if (request.source === "Square Appointments") {
    return false;
  }

  return !request.billing_contact_ready || !request.payment_method_ready;
}

function buildCustomerDatabase(requests) {
  const customers = new Map();

  for (const request of requests) {
    const customerKey = request.user_id || request.client_email || request.square_customer_id || request.id;
    const budgetFloor = parsePriceFloor(request.budget);
    const isInactive = completedStatuses.has(request.status) || cancelledStatuses.has(request.status);
    const paymentOpen = !["Paid", "Waived", "Not Required"].includes(request.payment_status || "");
    const invoiceOpen = !["Paid", "Waived", "Not Required", "Appointment-only"].includes(request.invoice_status || "");
    const requestActivityTime = latestTime(
      request.updated_at,
      request.last_manager_update_at,
      request.created_at
    );
    const existing = customers.get(customerKey) || {
      id: customerKey,
      clientId: request.user_id || "",
      name: request.client_name || "Unknown client",
      email: request.client_email || "",
      company: request.client_company || "",
      phone: request.client_phone || "",
      website: request.client_website || "",
      tier: request.client_tier || "Standard",
      type: request.client_type || "Individual",
      lifecycleStage: request.client_lifecycle_stage || "New Lead",
      leadSource: request.client_lead_source || "Website",
      requestCount: 0,
      activeRequestCount: 0,
      completedRequestCount: 0,
      cancelledRequestCount: 0,
      appointmentOnlyCount: 0,
      serviceTypes: [],
      openBudgetFloor: 0,
      totalBudgetFloor: 0,
      invoiceOpenCount: 0,
      paymentOpenCount: 0,
      billingFollowUpCount: 0,
      shippingReadyCount: 0,
      highestPriority: "Standard",
      nextConsultationAt: 0,
      nextConsultationLabel: "",
      latestActivityAt: 0,
      latestActivityLabel: "",
      latestRequestStatus: "",
      latestRequestType: ""
    };

    existing.requestCount += 1;
    existing.totalBudgetFloor += budgetFloor;
    if (request.source === "Square Appointments") existing.appointmentOnlyCount += 1;
    if (isInactive) {
      if (completedStatuses.has(request.status)) existing.completedRequestCount += 1;
      if (cancelledStatuses.has(request.status)) existing.cancelledRequestCount += 1;
    } else {
      existing.activeRequestCount += 1;
      existing.openBudgetFloor += budgetFloor;
    }
    if (invoiceOpen && !isInactive) existing.invoiceOpenCount += 1;
    if (paymentOpen && !isInactive) existing.paymentOpenCount += 1;
    if (needsBillingFollowUp(request) && !isInactive) existing.billingFollowUpCount += 1;
    if (request.shipping_ready) existing.shippingReadyCount += 1;
    if (request.project_type && !existing.serviceTypes.includes(request.project_type)) {
      existing.serviceTypes.push(request.project_type);
    }
    if ((priorityRank.get(request.internal_priority) || 0) > (priorityRank.get(existing.highestPriority) || 0)) {
      existing.highestPriority = request.internal_priority;
    }

    const consultationAt = parseConsultationDateTime(request.consultation_date, request.consultation_time)?.getTime() || 0;
    if (consultationAt >= Date.now() && (!existing.nextConsultationAt || consultationAt < existing.nextConsultationAt)) {
      existing.nextConsultationAt = consultationAt;
      existing.nextConsultationLabel = `${request.consultation_date} at ${request.consultation_time}`;
    }

    if (requestActivityTime >= existing.latestActivityAt) {
      existing.latestActivityAt = requestActivityTime;
      existing.latestActivityLabel = request.updated_at || request.last_manager_update_at || request.created_at || "";
      existing.latestRequestStatus = request.status || "";
      existing.latestRequestType = request.project_type || "";
    }

    customers.set(customerKey, existing);
  }

  return [...customers.values()]
    .map((customer) => {
      const followUpReasons = [
        customer.billingFollowUpCount ? "Billing details" : "",
        customer.paymentOpenCount ? "Payment" : "",
        customer.invoiceOpenCount ? "Invoice" : "",
        followUpStatuses.has(customer.latestRequestStatus) ? "Status follow-up" : ""
      ].filter(Boolean);

      return {
        ...customer,
        serviceTypes: customer.serviceTypes.slice(0, 5),
        followUpReasons,
        needsFollowUp: followUpReasons.length > 0,
        health:
          customer.billingFollowUpCount || customer.paymentOpenCount
            ? "Needs follow-up"
            : customer.activeRequestCount
              ? "Active"
              : customer.completedRequestCount
                ? "Stable"
                : "New",
        latestActivityAt: customer.latestActivityLabel,
        latestActivitySort: customer.latestActivityAt
      };
    })
    .sort((a, b) => {
      if (Number(b.needsFollowUp) !== Number(a.needsFollowUp)) {
        return Number(b.needsFollowUp) - Number(a.needsFollowUp);
      }

      if (b.openBudgetFloor !== a.openBudgetFloor) {
        return b.openBudgetFloor - a.openBudgetFloor;
      }

      return b.latestActivitySort - a.latestActivitySort;
    });
}

export async function buildManagerDashboardData() {
  const startedAt = performance.now();
  const [requests, modelProfiles] = await Promise.all([
    listAllRequestsWithUsers(),
    listModelProfiles()
  ]);
  const loadedAt = performance.now();
  const now = Date.now();
  const {
    serviceBreakdown,
    statusBreakdown,
    invoiceStatusBreakdown,
    paymentStatusBreakdown,
    fulfillmentStatusBreakdown,
    ...requestMetrics
  } = aggregateRequestMetrics(requests, now);
  const consultationCalendar = buildConsultationCalendarData({
    availability: getConsultationAvailability(),
    requests,
    perspective: "manager"
  });
  const customerRecords = buildCustomerDatabase(requests);
  const customerMetrics = customerRecords.reduce((summary, customer) => {
    summary.totalCustomerRecords += 1;
    if (customer.needsFollowUp) summary.customerFollowUpCount += 1;
    if (customer.activeRequestCount > 0) summary.activeCustomerCount += 1;
    summary.openCustomerRevenueFloor += customer.openBudgetFloor;
    return summary;
  }, {
    totalCustomerRecords: 0,
    customerFollowUpCount: 0,
    activeCustomerCount: 0,
    openCustomerRevenueFloor: 0
  });

  const latestRequests = requests.slice(0, 12).map((request) => {
    const consultationAt = parseConsultationDateTime(
      request.consultation_date,
      request.consultation_time
    );
    const daysUntilConsultation = consultationAt
      ? Math.max(0, Math.ceil((consultationAt.getTime() - now) / oneDayMs))
      : null;

    return {
      ...request,
      daysUntilConsultation,
      paymentReady: Boolean(request.billing_contact_ready && request.payment_method_ready),
      shippingReady: Boolean(request.shipping_ready),
      budgetFloor: parsePriceFloor(request.budget)
    };
  });

  const dashboardData = {
    metrics: {
      totalRequests: requests.length,
      ...requestMetrics,
      ...customerMetrics
    },
    serviceBreakdown,
    statusBreakdown,
    invoiceStatusBreakdown,
    paymentStatusBreakdown,
    fulfillmentStatusBreakdown,
    consultationCalendar,
    customerRecords: customerRecords.slice(0, 24),
    latestRequests,
    modelProfiles
  };

  console.info(JSON.stringify({
    event: "manager_dashboard_data_ready",
    requestCount: requests.length,
    clientCount: requestMetrics.uniqueClients,
    customerRecordCount: customerRecords.length,
    modelProfileCount: modelProfiles.length,
    loadMs: Math.round(loadedAt - startedAt),
    aggregateMs: Math.round(performance.now() - loadedAt),
    totalMs: Math.round(performance.now() - startedAt)
  }));

  return dashboardData;
}
