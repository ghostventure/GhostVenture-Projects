export async function reauthenticateSensitiveUser(user, {
  action = "this account change",
  promptPassword,
  makePasswordCredential,
  reauthenticateWithCredential,
  makeGoogleProvider,
  reauthenticateWithPopup
} = {}) {
  const providers = new Set((user?.providerData || []).map((item) => item.providerId));
  if (providers.has("password")) {
    const password = await promptPassword?.(`Enter your account password to confirm ${action}.`);
    if (!password) throw new Error(`Your identity check was cancelled; ${action} were not saved.`);
    if (typeof reauthenticateWithCredential !== "function" || typeof makePasswordCredential !== "function") {
      throw new Error("Password reauthentication is unavailable in this browser.");
    }
    return reauthenticateWithCredential(user, makePasswordCredential(user.email, password));
  }
  if (providers.has("google.com")) {
    if (typeof reauthenticateWithPopup !== "function" || typeof makeGoogleProvider !== "function") {
      throw new Error("Google reauthentication is unavailable in this browser.");
    }
    return reauthenticateWithPopup(user, makeGoogleProvider());
  }
  throw new Error(`This sign-in provider cannot be rechecked in this browser; ${action} were not saved.`);
}
