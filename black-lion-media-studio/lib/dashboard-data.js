import { getConsultationAvailability } from "./consultations";
import { buildConsultationCalendarData, parseConsultationDateTime } from "./consultation-calendar";
import { listMessages, listRequests, sanitizeUser } from "./db";
import { buildClientOnboarding } from "./onboarding";
import { findServiceByName, serviceCatalog } from "./services";

const completedStatuses = new Set(["Completed", "Delivered", "Closed"]);
const cancelledStatuses = new Set(["Cancelled", "Declined"]);
const oneDayMs = 24 * 60 * 60 * 1000;

function countFilled(values) {
  return values.filter((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    return Boolean(String(value || "").trim());
  }).length;
}

function parsePriceFloor(label) {
  const match = String(label || "").match(/\$([\d,]+)/);
  if (!match) {
    return 0;
  }

  return Number(match[1].replace(/,/g, ""));
}

function sortByDateAscending(items) {
  return [...items].sort((a, b) => {
    const aTime = a.sortTime || 0;
    const bTime = b.sortTime || 0;
    return aTime - bTime;
  });
}

function buildReadiness(user, requests, messages) {
  const profileFields = [
    user.fullName,
    user.email,
    user.company,
    user.phone,
    user.serviceInterest,
    user.userType,
    user.leadSource,
    user.preferredLanguage,
    user.preferredContactMethod,
    user.timezone,
    user.website,
    user.billingName,
    user.billingEmail,
    user.billingAddress,
    user.preferredPaymentMethod,
    user.budgetProfile,
    user.clientNotes,
    user.projectGoals
  ];
  const filledProfileFields = countFilled(profileFields);
  const profileFieldCount = profileFields.length;
  const profileCompletionPercent = Math.round((filledProfileFields / profileFieldCount) * 100);
  const billingReady = countFilled([
    user.billingName,
    user.billingEmail,
    user.billingAddress,
    user.preferredPaymentMethod
  ]);
  const contactReady = countFilled([user.email, user.phone, user.preferredContactMethod]);

  return {
    profileFieldCount,
    filledProfileFields,
    profileCompletionPercent,
    billingReadyScore: billingReady,
    billingReadyComplete: billingReady === 4,
    contactReadyScore: contactReady,
    contactReadyComplete: contactReady === 3,
    hasOrderHistory: requests.length > 0,
    hasMessageHistory: messages.length > 0
  };
}

function buildOrderInsights(requests) {
  const totalOrders = requests.length;
  const newOrders = requests.filter((request) => request.status === "New").length;
  const completedOrders = requests.filter((request) =>
    completedStatuses.has(request.status)
  ).length;
  const cancelledOrders = requests.filter((request) =>
    cancelledStatuses.has(request.status)
  ).length;
  const activeOrders = totalOrders - completedOrders - cancelledOrders;
  const uniqueServices = [...new Set(requests.map((request) => request.project_type))];
  const budgetFloors = requests.map((request) => parsePriceFloor(request.budget)).filter(Boolean);
  const estimatedBudgetFloor = budgetFloors.reduce((sum, amount) => sum + amount, 0);
  const averageBudgetFloor = budgetFloors.length
    ? Math.round(estimatedBudgetFloor / budgetFloors.length)
    : 0;
  const longestDetailLength = requests.reduce(
    (max, request) => Math.max(max, String(request.details || "").length),
    0
  );

  return {
    totalOrders,
    newOrders,
    activeOrders,
    completedOrders,
    cancelledOrders,
    uniqueServicesCount: uniqueServices.length,
    uniqueServices,
    estimatedBudgetFloor,
    averageBudgetFloor,
    longestDetailLength,
    latestOrderType: requests[0]?.project_type || "",
    latestOrderStatus: requests[0]?.status || "",
    latestOrderTimeline: requests[0]?.timeline || "",
    latestOrderBudget: requests[0]?.budget || ""
  };
}

function buildConsultationInsights(requests) {
  const availability = getConsultationAvailability();
  const openDayCount = availability.length;
  const openSlotCount = availability.reduce((sum, day) => sum + day.timeSlots.length, 0);
  const bookedConsultations = requests
    .map((request) => {
      const date = parseConsultationDateTime(
        request.consultation_date,
        request.consultation_time
      );

      return {
        projectType: request.project_type,
        consultationDate: request.consultation_date,
        consultationTime: request.consultation_time,
        sortTime: date?.getTime() || 0
      };
    })
    .filter((item) => item.consultationDate && item.consultationTime);

  const now = Date.now();
  const futureConsultations = sortByDateAscending(
    bookedConsultations.filter((item) => item.sortTime >= now)
  );
  const nextConsultation = futureConsultations[0] || null;

  return {
    openDayCount,
    openSlotCount,
    bookedConsultationCount: bookedConsultations.length,
    futureConsultationCount: futureConsultations.length,
    nextConsultationDate: nextConsultation?.consultationDate || "",
    nextConsultationTime: nextConsultation?.consultationTime || "",
    nextConsultationService: nextConsultation?.projectType || "",
    nextConsultationCountdownDays: nextConsultation
      ? Math.max(0, Math.ceil((nextConsultation.sortTime - now) / oneDayMs))
      : null
  };
}

function buildMessageInsights(messages) {
  const totalMessages = messages.length;
  const studioMessages = messages.filter((message) => message.sender_role === "studio").length;
  const clientMessages = messages.filter((message) => message.sender_role === "client").length;

  return {
    totalMessages,
    studioMessages,
    clientMessages,
    lastMessageSubject: messages[0]?.subject || "",
    lastMessageRole: messages[0]?.sender_role || "",
    lastMessageAt: messages[0]?.created_at || ""
  };
}

function buildServiceInsights(user, requests) {
  const preferredService =
    findServiceByName(user.serviceInterest) || findServiceByName(requests[0]?.project_type) || serviceCatalog[0];
  const recentServiceNames = [...new Set(requests.map((request) => request.project_type))];
  const recentServices = recentServiceNames
    .map((name) => findServiceByName(name))
    .filter(Boolean)
    .slice(0, 3);
  const recommendedServices = serviceCatalog
    .filter((service) => service.name !== preferredService?.name)
    .slice(0, 3);

  return {
    featuredServiceName: preferredService?.name || "",
    featuredServicePrice: preferredService?.priceLabel || "",
    featuredServiceTurnaround: preferredService?.turnaround || "",
    featuredServiceCoverage: preferredService?.coverage || "",
    recentServices,
    recommendedServices
  };
}

export async function buildDashboardData(user) {
  const [requests, messages] = await Promise.all([
    listRequests(user.id),
    listMessages(user.id)
  ]);

  const safeUser = sanitizeUser(user);
  const createdAt = safeUser.createdAt ? new Date(safeUser.createdAt) : null;
  const accountAgeDays =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / oneDayMs))
      : 0;

  const readiness = buildReadiness(safeUser, requests, messages);
  const orders = buildOrderInsights(requests);
  const consultations = buildConsultationInsights(requests);
  const consultationCalendar = buildConsultationCalendarData({
    availability: getConsultationAvailability(),
    requests,
    perspective: "client"
  });
  const messagesSummary = buildMessageInsights(messages);
  const services = buildServiceInsights(safeUser, requests);
  const onboarding = buildClientOnboarding({ user: safeUser, requests, messages });

  const activityFeed = [
    orders.latestOrderType
      ? {
          label: "Latest order",
          value: `${orders.latestOrderType} · ${orders.latestOrderStatus || "New"}`
        }
      : null,
    consultations.nextConsultationDate
      ? {
          label: "Next consultation",
          value: `${consultations.nextConsultationDate} at ${consultations.nextConsultationTime}`
        }
      : null,
    messagesSummary.lastMessageSubject
      ? {
          label: "Last message",
          value: messagesSummary.lastMessageSubject
        }
      : null
  ].filter(Boolean);

  return {
    user: safeUser,
    requests,
    messages: messages.slice(0, 5),
    metrics: {
      accountAgeDays,
      ...readiness,
      ...orders,
      ...consultations,
      ...messagesSummary,
      featuredServiceName: services.featuredServiceName,
      featuredServicePrice: services.featuredServicePrice,
      featuredServiceTurnaround: services.featuredServiceTurnaround
    },
    highlights: {
      profileStatus: readiness.profileCompletionPercent >= 75 ? "Strong" : "Needs attention",
      billingStatus: readiness.billingReadyComplete ? "Ready" : "Incomplete",
      consultationStatus: consultations.futureConsultationCount > 0 ? "Scheduled" : "Open",
      communicationStatus: messagesSummary.totalMessages > 0 ? "Active" : "Quiet"
    },
    activityFeed,
    consultationCalendar,
    onboarding,
    featuredService: {
      name: services.featuredServiceName,
      priceLabel: services.featuredServicePrice,
      turnaround: services.featuredServiceTurnaround,
      coverage: services.featuredServiceCoverage
    },
    relatedServices: services.recentServices.length
      ? services.recentServices
      : services.recommendedServices
  };
}
