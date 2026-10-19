const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");

if (navToggle && nav) {
  const setNavOpen = (isOpen) => {
    nav.classList.toggle("open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    document.body.classList.toggle("locked", isOpen);
  };

  navToggle.addEventListener("click", () => {
    setNavOpen(navToggle.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setNavOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (navToggle.getAttribute("aria-expanded") === "true" &&
        !nav.contains(event.target) && !navToggle.contains(event.target)) {
      setNavOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
      setNavOpen(false);
      navToggle.focus();
    }
  });
}

const contactForm = document.querySelector("[data-contact-form]");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(contactForm);
    const name = form.get("name") || "Timmy user";
    const email = form.get("email") || "";
    const topic = form.get("topic") || "Support";
    const message = form.get("message") || "";
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Topic: ${topic}`,
      "",
      String(message),
    ].join("\n");
    const mailto = `mailto:webmaster@blacklionstudios.com?subject=${encodeURIComponent(`Timmy ${topic}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  });
}
