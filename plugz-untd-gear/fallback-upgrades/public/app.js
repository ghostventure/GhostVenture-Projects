const BAG_STORAGE_KEY = "plugz-storefront-bag-v1";
const bagStatus = document.querySelector("#bagStatus");
const bagTotal = document.querySelector("#bagTotal");
const bag = loadBag();

function loadBag() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(BAG_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => (
      item && typeof item.name === "string" && item.name.trim() &&
      Number.isSafeInteger(item.price) && item.price >= 0 &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99
    )).map(({ name, price, quantity }) => ({ name: name.trim(), price, quantity }));
  } catch {
    // Storage can be disabled or contain stale data; the bag still works for this page view.
    return [];
  }
}

function saveBag() {
  try {
    window.localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(bag));
  } catch {
    // Keep the in-memory bag usable when persistent storage is unavailable.
  }
}

function updateBag() {
  const count = bag.reduce((sum, item) => sum + item.quantity, 0);
  const total = bag.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (bagStatus) {
    bagStatus.textContent = count
      ? `${count} piece${count === 1 ? "" : "s"} staged for checkout preview.`
      : "No pieces in the bag yet.";
  }
  if (bagTotal) bagTotal.textContent = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  }).format(total);
  document.querySelectorAll('.header-link[href="#bag"]').forEach((link) => {
    link.setAttribute("aria-label", count ? `Bag, ${count} ${count === 1 ? "piece" : "pieces"}` : "Bag, empty");
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product]");
  if (!button) return;

  const name = (button.dataset.product || "").trim();
  const price = Number(button.dataset.price);
  if (!name || !Number.isSafeInteger(price) || price < 0) return;

  const existing = bag.find((item) => item.name === name && item.price === price);
  if (existing) {
    if (existing.quantity >= 99) return;
    existing.quantity += 1;
  } else {
    bag.push({ name, price, quantity: 1 });
  }

  saveBag();
  updateBag();
  const originalLabel = button.dataset.originalLabel || button.textContent;
  button.dataset.originalLabel = originalLabel;
  button.textContent = "Added to bag";
  window.setTimeout(() => {
    if (button.isConnected) button.textContent = originalLabel;
  }, 1200);
});

window.addEventListener("storage", (event) => {
  if (event.key !== BAG_STORAGE_KEY) return;
  const nextBag = loadBag();
  bag.splice(0, bag.length, ...nextBag);
  updateBag();
});

updateBag();
