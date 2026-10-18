export function buildClientOnboarding({ user = {}, requests = [], messages = [] } = {}) {
  const hasProfileBasics = Boolean(user.fullName && user.email && user.phone && user.serviceInterest);
  const hasBillingBasics = Boolean(user.billingName && user.billingEmail && user.preferredPaymentMethod);
  const hasRequest = requests.length > 0;
  const hasMessage = messages.length > 0;
  const steps = [
    {
      id: "profile-basics",
      label: "01",
      title: "Complete profile basics",
      copy: "Add phone, service interest, and preferred contact details so follow-up is easier.",
      href: "/profile",
      actionLabel: "Update profile",
      complete: hasProfileBasics
    },
    {
      id: "first-request",
      label: "02",
      title: "Send the first request",
      copy: "Pick a service, add the budget range, and explain what you need in plain language.",
      href: "/dashboard#service-request",
      actionLabel: "Start request",
      complete: hasRequest
    },
    {
      id: "first-message",
      label: "03",
      title: "Open the conversation",
      copy: "Use messages for scheduling, billing, delivery, files, or follow-up questions.",
      href: "/messages",
      actionLabel: "Send message",
      complete: hasMessage
    },
    {
      id: "billing-ready",
      label: "04",
      title: "Prepare billing details",
      copy: "Add invoice contact and payment preference before deposits or invoices are needed.",
      href: "/profile#billing",
      actionLabel: "Review billing",
      complete: hasBillingBasics
    }
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const completionPercent = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find((step) => !step.complete) || steps[steps.length - 1];

  return {
    completedCount,
    completionPercent,
    totalCount: steps.length,
    nextStep,
    steps
  };
}
