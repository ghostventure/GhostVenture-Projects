function cleanIdentitySource(value = "") {
  return String(value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function buildOneId(source = "") {
  const cleanSource = cleanIdentitySource(source);
  return cleanSource ? `FOX-${cleanSource.slice(0, 12)}` : "";
}

export function resolveProfileOneId(profile = {}, authUser = null) {
  return (
    profile.oneId ||
    buildOneId(authUser?.uid || profile.uid || profile.email || profile.handle || profile.name)
  );
}
