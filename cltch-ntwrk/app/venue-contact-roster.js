export const VENUE_CONTACT_ROSTER_STORAGE_PREFIX = 'cltch:venue-contact-roster:v1';
export const MAX_VENUE_CONTACTS = 12;
export const VENUE_CONTACT_ROLES = Object.freeze([
  'Venue manager',
  'Event coordinator',
  'Technical contact',
  'Accessibility contact',
  'Other'
]);

function storageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return `${VENUE_CONTACT_ROSTER_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;
}

function normalizeContact(contact) {
  const id = typeof contact?.id === 'string' ? contact.id.slice(0, 80) : '';
  const name = typeof contact?.name === 'string' ? contact.name.trim().slice(0, 80) : '';
  const role = VENUE_CONTACT_ROLES.includes(contact?.role) ? contact.role : '';
  const email = typeof contact?.email === 'string' ? contact.email.trim().slice(0, 254) : '';
  const phone = typeof contact?.phone === 'string' ? contact.phone.trim().slice(0, 30) : '';
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = !phone || /^[+()\d .-]{5,30}$/.test(phone);
  if (!id || !name || !role || (!email && !phone) || !emailValid || !phoneValid) return null;
  return { id, name, role, email, phone };
}

export function validateVenueContact(input) {
  if (!input || typeof input !== 'object') return { contact: null, error: 'Enter a name, choose a role, and provide an email address or phone number.' };
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const role = input.role;
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (!name || name.length > 80 || !VENUE_CONTACT_ROLES.includes(role)) {
    return { contact: null, error: 'Enter a contact name up to 80 characters and choose a role.' };
  }
  if (!email && !phone) return { contact: null, error: 'Add at least one contact method: email or phone.' };
  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { contact: null, error: 'Enter a valid email address up to 254 characters.' };
  }
  if (phone.length > 30 || (phone && !/^[+()\d .-]{5,30}$/.test(phone))) {
    return { contact: null, error: 'Enter a phone number using digits, spaces, +, parentheses, dots, or dashes.' };
  }
  return { contact: { name, role, email, phone }, error: '' };
}

function createId() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch {}
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readVenueContactRoster(storage, userId) {
  const key = storageKey(userId);
  if (!key || !storage) return { contacts: [], persistent: false, recovered: false };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { contacts: [], persistent: true, recovered: false };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.userId !== userId || !Array.isArray(saved.contacts)) {
      return { contacts: [], persistent: true, recovered: true };
    }
    const seen = new Set();
    const contacts = saved.contacts.slice(0, MAX_VENUE_CONTACTS).map(normalizeContact).filter((contact) => {
      if (!contact || seen.has(contact.id)) return false;
      seen.add(contact.id);
      return true;
    });
    return { contacts, persistent: true, recovered: contacts.length !== saved.contacts.length };
  } catch { return { contacts: [], persistent: false, recovered: true }; }
}

export function writeVenueContactRoster(storage, userId, contacts) {
  const key = storageKey(userId);
  if (!key || !storage || !Array.isArray(contacts) || contacts.length > MAX_VENUE_CONTACTS) return false;
  const bounded = contacts.map(normalizeContact);
  if (bounded.some((contact) => !contact) || new Set(bounded.map(({ id }) => id)).size !== bounded.length) return false;
  try {
    storage.setItem(key, JSON.stringify({ version: 1, userId, contacts: bounded }));
    return true;
  } catch { return false; }
}

export function clearVenueContactRoster(storage, userId) {
  const key = storageKey(userId);
  if (!key || !storage) return false;
  try { storage.removeItem(key); return true; } catch { return false; }
}

export function mountVenueContactRoster(container, { storage, userId, documentRef = globalThis.document, confirmRef = globalThis.confirm } = {}) {
  if (!container || !documentRef) return null;
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try { resolvedStorage = globalThis.localStorage; } catch { resolvedStorage = null; }
  }
  const loaded = readVenueContactRoster(resolvedStorage, userId);
  let contacts = [...loaded.contacts];
  let editingId = '';
  container.replaceChildren();

  const form = documentRef.createElement('form');
  form.noValidate = true;
  const nameLabel = documentRef.createElement('label');
  nameLabel.htmlFor = 'venueContactName';
  nameLabel.textContent = 'Contact name';
  const nameInput = documentRef.createElement('input');
  nameInput.id = 'venueContactName';
  nameInput.name = 'name';
  nameInput.type = 'text';
  nameInput.maxLength = 80;
  nameInput.required = true;
  nameLabel.append(nameInput);

  const roleLabel = documentRef.createElement('label');
  roleLabel.htmlFor = 'venueContactRole';
  roleLabel.textContent = 'Venue role';
  const roleSelect = documentRef.createElement('select');
  roleSelect.id = 'venueContactRole';
  roleSelect.name = 'role';
  const emptyRole = documentRef.createElement('option');
  emptyRole.value = '';
  emptyRole.textContent = 'Choose a role';
  roleSelect.append(emptyRole);
  VENUE_CONTACT_ROLES.forEach((role) => {
    const option = documentRef.createElement('option');
    option.value = role;
    option.textContent = role;
    roleSelect.append(option);
  });
  roleSelect.required = true;
  roleLabel.append(roleSelect);

  const emailLabel = documentRef.createElement('label');
  emailLabel.htmlFor = 'venueContactEmail';
  emailLabel.textContent = 'Email (optional if phone is provided)';
  const emailInput = documentRef.createElement('input');
  emailInput.id = 'venueContactEmail';
  emailInput.name = 'email';
  emailInput.type = 'email';
  emailInput.maxLength = 254;
  emailLabel.append(emailInput);

  const phoneLabel = documentRef.createElement('label');
  phoneLabel.htmlFor = 'venueContactPhone';
  phoneLabel.textContent = 'Phone (optional if email is provided)';
  const phoneInput = documentRef.createElement('input');
  phoneInput.id = 'venueContactPhone';
  phoneInput.name = 'phone';
  phoneInput.type = 'tel';
  phoneInput.maxLength = 30;
  phoneLabel.append(phoneInput);

  const submit = documentRef.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Add contact';
  const cancelEdit = documentRef.createElement('button');
  cancelEdit.type = 'button';
  cancelEdit.textContent = 'Cancel edit';
  cancelEdit.hidden = true;
  const formStatus = documentRef.createElement('p');
  formStatus.setAttribute('role', 'status');
  formStatus.setAttribute('aria-live', 'polite');
  form.append(nameLabel, roleLabel, emailLabel, phoneLabel, submit, cancelEdit, formStatus);

  const listHeading = documentRef.createElement('h2');
  listHeading.textContent = 'Saved venue contacts';
  const list = documentRef.createElement('div');
  const status = documentRef.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const clearAll = documentRef.createElement('button');
  clearAll.type = 'button';
  clearAll.textContent = 'Clear all saved contacts';
  clearAll.disabled = contacts.length === 0;
  container.append(form, listHeading, list, status, clearAll);

  function persistOrExplain(successMessage) {
    if (writeVenueContactRoster(resolvedStorage, userId, contacts)) {
      status.textContent = `${successMessage} Contacts are saved only in this browser for your host account.`;
    } else {
      status.textContent = `${successMessage} Browser storage is unavailable, so the current roster will be lost when this page closes.`;
    }
  }

  function resetForm() {
    editingId = '';
    nameInput.value = '';
    roleSelect.value = '';
    emailInput.value = '';
    phoneInput.value = '';
    submit.textContent = 'Add contact';
    cancelEdit.hidden = true;
  }

  function renderList() {
    list.replaceChildren();
    contacts.forEach((contact) => {
      const card = documentRef.createElement('article');
      const name = documentRef.createElement('h3');
      name.textContent = contact.name;
      const role = documentRef.createElement('p');
      role.textContent = contact.role;
      card.append(name, role);
      if (contact.email) {
        const email = documentRef.createElement('p');
        email.textContent = `Email: ${contact.email}`;
        card.append(email);
      }
      if (contact.phone) {
        const phone = documentRef.createElement('p');
        phone.textContent = `Phone: ${contact.phone}`;
        card.append(phone);
      }
      const edit = documentRef.createElement('button');
      edit.type = 'button';
      edit.textContent = `Edit ${contact.name}`;
      edit.addEventListener('click', () => {
        editingId = contact.id;
        nameInput.value = contact.name;
        roleSelect.value = contact.role;
        emailInput.value = contact.email;
        phoneInput.value = contact.phone;
        submit.textContent = 'Save contact';
        cancelEdit.hidden = false;
        nameInput.focus();
      });
      const remove = documentRef.createElement('button');
      remove.type = 'button';
      remove.textContent = `Remove ${contact.name}`;
      remove.addEventListener('click', () => {
        contacts = contacts.filter(({ id }) => id !== contact.id);
        if (editingId === contact.id) resetForm();
        renderList();
        persistOrExplain('Contact removed.');
      });
      card.append(edit, remove);
      list.append(card);
    });
    clearAll.disabled = contacts.length === 0;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validateVenueContact({ name: nameInput.value, role: roleSelect.value, email: emailInput.value, phone: phoneInput.value });
    if (!result.contact) {
      formStatus.textContent = result.error;
      return;
    }
    const existingIndex = editingId ? contacts.findIndex(({ id }) => id === editingId) : -1;
    if (existingIndex < 0 && contacts.length >= MAX_VENUE_CONTACTS) {
      formStatus.textContent = `This host roster is limited to ${MAX_VENUE_CONTACTS} contacts. Remove one before adding another.`;
      return;
    }
    const contact = { ...result.contact, id: existingIndex >= 0 ? editingId : createId() };
    if (existingIndex >= 0) contacts[existingIndex] = contact;
    else contacts = [...contacts, contact];
    resetForm();
    formStatus.textContent = '';
    renderList();
    persistOrExplain(existingIndex >= 0 ? 'Contact updated.' : 'Contact added.');
  });
  cancelEdit.addEventListener('click', resetForm);
  clearAll.addEventListener('click', () => {
    if (!contacts.length || typeof confirmRef !== 'function' || !confirmRef('Clear all venue contacts saved in this browser for this host account?')) return;
    contacts = [];
    resetForm();
    renderList();
    const cleared = clearVenueContactRoster(resolvedStorage, userId);
    status.textContent = cleared
      ? 'All saved venue contacts were cleared from this browser for your host account.'
      : 'The roster is empty for this page, but browser storage could not be cleared. Previously saved contacts may remain on this device.';
  });

  renderList();
  status.textContent = !loaded.persistent
    ? 'Browser storage is unavailable. New contacts will remain in memory only until this page closes.'
    : loaded.recovered
      ? 'Some saved records were invalid and have been omitted. This roster is private to this browser and host account.'
      : 'Contacts are saved only in this browser for your host account. They are not shared with performers and CLTCH does not notify them.';
  return { contacts, persistent: loaded.persistent, recovered: loaded.recovered };
}
