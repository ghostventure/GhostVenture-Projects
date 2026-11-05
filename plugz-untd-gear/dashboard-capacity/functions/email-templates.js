"use strict";

// Provider-neutral transactional email copy. These templates are deliberately
// not sent by this project yet; connect a verified delivery provider and call
// them from a server-side workflow only after sender-domain setup is complete.
const support = (name, ticketId) => ({
  subject: "Plugz received your request",
  text: `Hi ${name || "there"},\n\nYour Plugz support request${ticketId ? ` (${ticketId})` : ""} is in the review queue. We will reply through the contact details you supplied.\n\n— Plugz UNTD`,
});
const order = (orderId, status) => ({
  subject: `Plugz order update${orderId ? ` · ${orderId}` : ""}`,
  text: `Your order status is ${status || "recorded"}. Tracking and fulfillment updates are sent only after production checkout and fulfillment integration are enabled.\n\n— Plugz UNTD`,
});
const drop = () => ({ subject: "A new Plugz signal", text: "A new Plugz release is ready to view. This message should only be sent to customers who explicitly opted in.\n\n— Plugz UNTD" });

module.exports = { support, order, drop };
