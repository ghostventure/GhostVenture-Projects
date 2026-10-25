import crypto from "node:crypto";
import { findServiceByName } from "./services";

const productionBaseUrl = "https://connect.squareup.com";
const sandboxBaseUrl = "https://connect.squareupsandbox.com";
const defaultApiVersion = "2026-01-22";
const squareInvoiceTimeoutMs = 30_000;

export class SquareBillingTimeoutError extends Error {
  constructor() {
    super("Square did not confirm the invoice operation in time. Check the invoice in Square before retrying.");
    this.name = "SquareBillingTimeoutError";
    this.code = "SQUARE_BILLING_TIMEOUT";
  }
}

function getSquareConfig() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = String(process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();

  if (!accessToken || !locationId) {
    throw new Error("Square billing is not configured. Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.");
  }

  return {
    accessToken,
    locationId,
    apiVersion: process.env.SQUARE_API_VERSION || defaultApiVersion,
    baseUrl: environment === "sandbox" ? sandboxBaseUrl : productionBaseUrl
  };
}

function buildIdempotencyKey(...parts) {
  return crypto
    .createHash("sha256")
    .update(parts.filter(Boolean).join(":"))
    .digest("hex")
    .slice(0, 45);
}

function splitName(fullName = "") {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { givenName: parts[0] || "Client", familyName: "" };
  }

  return {
    givenName: parts.slice(0, -1).join(" "),
    familyName: parts.at(-1)
  };
}

function getDueDate(daysFromNow = 7) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysFromNow);
  return dueDate.toISOString().slice(0, 10);
}

function getServiceInvoiceAmount(projectType) {
  const service = findServiceByName(projectType);
  if (!service?.invoiceAmountCents) {
    throw new Error("This service does not have a listed invoice price yet.");
  }

  return {
    service,
    amountCents: service.invoiceAmountCents
  };
}

function getRequestInvoiceAmount(requestRecord, service) {
  const depositAmountCents = Number(requestRecord.deposit_amount_cents || 0);
  if (Number.isInteger(depositAmountCents) && depositAmountCents > 0) {
    return {
      amountCents: depositAmountCents,
      label: "Required 50% deposit",
      description: `Required 50% deposit for the approved Service Estimation request. Estimated project total: ${
        Number(requestRecord.estimate_amount_cents || 0) > 0
          ? `$${Math.round(Number(requestRecord.estimate_amount_cents) / 100).toLocaleString("en-US")}`
          : service.priceLabel
      }.`
    };
  }

  const fallback = getServiceInvoiceAmount(requestRecord.project_type);
  return {
    amountCents: fallback.amountCents,
    label: "Listed starting price",
    description: `Invoice for ${service.name}. Listed starting price: ${service.priceLabel}.`
  };
}

async function squareRequest(path, body, signal) {
  const config = getSquareConfig();
  let response;
  let data;

  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": config.apiVersion
      },
      body: JSON.stringify(body),
      signal
    });
    data = await response.json();
  } catch (error) {
    if (signal.aborted) {
      throw new SquareBillingTimeoutError();
    }
    throw error;
  }

  if (!response.ok) {
    const message =
      data?.errors?.map((error) => error.detail || error.code).filter(Boolean).join(" ") ||
      "Square request failed.";
    throw new Error(message);
  }

  return data;
}

async function createSquareCustomer(requestRecord, signal) {
  if (requestRecord.square_customer_id) {
    return { id: String(requestRecord.square_customer_id) };
  }
  const { givenName, familyName } = splitName(
    requestRecord.billing_name || requestRecord.client_name
  );
  const emailAddress = requestRecord.billing_email || requestRecord.client_email;

  if (!emailAddress) {
    throw new Error("A billing email or account email is required before sending a Square invoice.");
  }

  const data = await squareRequest("/v2/customers", {
    idempotency_key: buildIdempotencyKey("customer", requestRecord.user_id, emailAddress),
    given_name: givenName,
    family_name: familyName,
    email_address: emailAddress,
    reference_id: requestRecord.user_id
  }, signal);

  return data.customer;
}

async function createSquareOrder({ requestRecord, customerId, amountCents, service, invoiceLabel, signal }) {
  const config = getSquareConfig();
  const data = await squareRequest("/v2/orders", {
    idempotency_key: buildIdempotencyKey("order", requestRecord.id, amountCents),
    order: {
      location_id: config.locationId,
      customer_id: customerId,
      reference_id: requestRecord.id,
      line_items: [
        {
          name: invoiceLabel ? `${service.name} - ${invoiceLabel}` : service.name,
          quantity: "1",
          note: requestRecord.details || requestRecord.timeline || service.description,
          base_price_money: {
            amount: amountCents,
            currency: "USD"
          }
        }
      ]
    }
  }, signal);

  return data.order;
}

async function createSquareInvoice({ requestRecord, customerId, orderId, amountCents, service, dueDate, invoiceDescription, signal }) {
  const config = getSquareConfig();
  const emailAddress = requestRecord.billing_email || requestRecord.client_email;
  const data = await squareRequest("/v2/invoices", {
    idempotency_key: buildIdempotencyKey("invoice", requestRecord.id, orderId),
    invoice: {
      location_id: config.locationId,
      order_id: orderId,
      primary_recipient: {
        customer_id: customerId,
        email_address: emailAddress
      },
      payment_requests: [
        {
          request_type: "BALANCE",
          due_date: dueDate,
          tipping_enabled: false,
          automatic_payment_source: "NONE"
        }
      ],
      delivery_method: "EMAIL",
      accepted_payment_methods: {
        card: true,
        square_gift_card: false,
        bank_account: false,
        buy_now_pay_later: false,
        cash_app_pay: false
      },
      title: `Black Lion Studios - ${service.name}`,
      description: invoiceDescription,
      sale_or_service_date: new Date().toISOString().slice(0, 10),
      store_payment_method_enabled: false
    }
  }, signal);

  return data.invoice;
}

async function publishSquareInvoice(invoiceId, version, requestId, signal) {
  const data = await squareRequest(`/v2/invoices/${invoiceId}/publish`, {
    version,
    idempotency_key: buildIdempotencyKey("publish", requestId, invoiceId, version)
  }, signal);

  return data.invoice;
}

export async function createPublishedInvoiceForRequest(requestRecord) {
  if (requestRecord.square_invoice_id) {
    throw new Error("This request already has a Square invoice attached.");
  }

  const dueDate = getDueDate(7);
  const { service } = getServiceInvoiceAmount(requestRecord.project_type);
  const invoiceAmount = getRequestInvoiceAmount(requestRecord, service);
  const signal = AbortSignal.timeout(squareInvoiceTimeoutMs);
  const customer = await createSquareCustomer(requestRecord, signal);
  const order = await createSquareOrder({
    requestRecord,
    customerId: customer.id,
    amountCents: invoiceAmount.amountCents,
    service,
    invoiceLabel: invoiceAmount.label,
    signal
  });
  const draftInvoice = await createSquareInvoice({
    requestRecord,
    customerId: customer.id,
    orderId: order.id,
    amountCents: invoiceAmount.amountCents,
    service,
    dueDate,
    invoiceDescription: invoiceAmount.description,
    signal
  });
  const publishedInvoice = await publishSquareInvoice(
    draftInvoice.id,
    draftInvoice.version,
    requestRecord.id,
    signal
  );

  return {
    squareCustomerId: customer.id,
    squareOrderId: order.id,
    squareInvoiceId: publishedInvoice.id,
    squareInvoiceVersion: publishedInvoice.version,
    squareInvoiceNumber: publishedInvoice.invoice_number || "",
    squareInvoiceUrl: publishedInvoice.public_url || "",
    invoiceAmountCents: invoiceAmount.amountCents,
    invoiceDueDate: dueDate,
    service
  };
}
