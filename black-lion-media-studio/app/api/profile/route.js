import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema,
  requireAuthenticatedUser
} from "../../../lib/api-helpers";
import { findUserById, findUserByUsername, sanitizeUser, updateUserProfile } from "../../../lib/db";
import { enforceWriteRateLimit } from "../../../lib/rate-limit";
import { parseWithSchema, profileSchema } from "../../../lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "profile")
  );
  if (mutation.error) {
    return mutation.error;
  }

  const auth = await requireAuthenticatedUser(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = await parseJsonWithSchema(request, profileSchema, parseWithSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const {
    fullName,
    username,
    company,
    phone,
    serviceInterest,
    userType,
    leadSource,
    preferredLanguage,
    pronouns,
    website,
    instagram,
    tiktok,
    youtube,
    merchInterest,
    preferredContactMethod,
    notificationOptIn,
    marketingOptIn,
    timezone,
    clientNotes,
    projectGoals,
    referralSource,
    accessibilityNotes,
    billingName,
    billingEmail,
    billingAddress,
    preferredPaymentMethod,
    budgetProfile,
    shippingName,
    shippingAddress,
    shippingCity,
    shippingRegion,
    shippingPostalCode,
    shippingCountry,
    taxId,
    profileFields
  } = parsed.data;

  if (username) {
    const usernameUser = await findUserByUsername(username);
    if (usernameUser && usernameUser.id !== auth.session.user.id) {
      return jsonError("That username is already taken. Choose another username.", 409);
    }
  }

  await updateUserProfile({
    userId: auth.session.user.id,
    fullName,
    username,
    company,
    phone,
    serviceInterest,
    userType,
    leadSource,
    preferredLanguage,
    pronouns,
    website,
    instagram,
    tiktok,
    youtube,
    merchInterest,
    preferredContactMethod,
    notificationOptIn,
    marketingOptIn,
    timezone,
    clientNotes,
    projectGoals,
    referralSource,
    accessibilityNotes,
    billingName,
    billingEmail,
    billingAddress,
    preferredPaymentMethod,
    budgetProfile,
    shippingName,
    shippingAddress,
    shippingCity,
    shippingRegion,
    shippingPostalCode,
    shippingCountry,
    taxId,
    profileFields
  });

  const updatedUser = await findUserById(auth.session.user.id);

  return jsonOk({
    user: sanitizeUser(updatedUser)
  });
}
