const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("locked", isOpen);
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
