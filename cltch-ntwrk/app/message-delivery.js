export async function ensureMessageStored({ message, lookup, write }) {
  if (!message?.id || !message.senderId || !message.text || typeof lookup !== "function" || typeof write !== "function") {
    throw new Error("A complete message and storage handlers are required.");
  }
  const existing = await lookup(message.id);
  if (existing) {
    if (existing.senderId !== message.senderId || existing.text !== message.text) {
      throw new Error("The retry ID is already used by a different message.");
    }
    return { stored: true, duplicate: true };
  }
  await write(message.id);
  return { stored: true, duplicate: false };
}
