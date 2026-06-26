import { listAllRequestsWithUsers, listModelProfiles } from "./db";
import { buildConsultationCalendarData, parseConsultationDateTime } from "./consultation-calendar";
import { getConsultationAvailability } from "./consultations";

const completedStatuses = new Set(["Completed", "Delivered", "Closed"]);
const cancelledStatuses = new Set(["Cancelled", "Declined"]);
const oneDayMs = 24 * 60 * 60 * 1000;

function parsePriceFloor(label) {
  const match = String(label || "").match(/\$([\d,]+)/);
  if (!match) {
    return 0;
  }

  return Number(match[1].replace(/,/g, ""));
}

function buildCountMap(items, key) {
  return items.reduce((map, item) => {
    const value = String(item[key] || "Unspecified");
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map());
}

function sortMapEntries(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

export async function buildManagerDashboardData() {
  const [requests, modelProfiles] = await Promise.all([
    listAllRequestsWithUsers(),
    listModelProfiles()
  ]);
  const now = Date.now();
  const uniqueClients = new Set(requests.map((request) => request.user_id).filter(Boolean)).size;
  const newRequests = requests.filter((request) => request.status === "New").length;
  const appointmentOnlyRequests = requests.filter(
    (request) => request.source === "Square Appointments"
  );
  const billableRequests = requests.filter(
    (request) => request.source !== "Square Appointments"
  );
  const completedRequests = requests.filter((request) =>
    completedStatuses.has(request.status)
  ).length;
  const cancelledRequests = requests.filter((request) =>
    cancelledStatuses.has(request.status)
  ).length;
  const activeRequests = requests.length - completedRequests - cancelledRequests;
  const consultationQueue = requests.filter((request) => {
    if (cancelledStatuses.has(request.status)) {
      return false;
    }

    const sortTime = parseConsultationDateTime(request.consultation_date, request.consultation_time)?.getTime();
    return sortTime && sortTime >= now;
  }).length;
  const receivablesFloor = billableRequests.reduce((sum, request) => sum + parsePriceFloor(request.budget), 0);
  const invoiceReadyCount = billableRequests.filter((request) => request.billing_name && request.billing_email).length;
  const paymentMethodCount = billableRequests.filter((request) => request.preferred_payment_method).length;
  const shippingReadyCount = requests.filter((request) => request.shipping_name && request.shipping_address).length;
  const billingFollowUpCount = billableRequests.filter(
    (request) => !request.billing_name || !request.billing_email || !request.preferred_payment_method
  ).length;

  const serviceBreakdown = sortMapEntries(buildCountMap(requests, "project_type")).slice(0, 6);
  const statusBreakdown = sortMapEntries(buildCountMap(requests, "status"));
  const invoiceStatusBreakdown = sortMapEntries(buildCountMap(requests, "invoice_status"));
  const paymentStatusBreakdown = sortMapEntries(buildCountMap(requests, "payment_status"));
  const fulfillmentStatusBreakdown = sortMapEntries(buildCountMap(requests, "fulfillment_status"));
  const consultationCalendar = buildConsultationCalendarData({
    availability: getConsultationAvailability(),
    requests,
    perspective: "manager"
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
      paymentReady: Boolean(request.billing_name && request.billing_email && request.preferred_payment_method),
      shippingReady: Boolean(request.shipping_name && request.shipping_address),
      budgetFloor: parsePriceFloor(request.budget)
    };
  });

  return {
    metrics: {
      totalRequests: requests.length,
      uniqueClients,
      newRequests,
      activeRequests,
      completedRequests,
      cancelledRequests,
      consultationQueue,
      receivablesFloor,
      invoiceReadyCount,
      paymentMethodCount,
      shippingReadyCount,
      billingFollowUpCount,
      appointmentOnlyRequests: appointmentOnlyRequests.length
    },
    serviceBreakdown,
    statusBreakdown,
    invoiceStatusBreakdown,
    paymentStatusBreakdown,
    fulfillmentStatusBreakdown,
    consultationCalendar,
    latestRequests,
    modelProfiles
  };
}
