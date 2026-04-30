const fontPreload = document.getElementById("jetbrains-font-preload");

const navToggle = document.getElementById("nav-toggle");
const mobileMenu = document.getElementById("mobile-menu");
if (navToggle && mobileMenu) {
  const closeMenu = () => {
    mobileMenu.classList.remove("open");
    navToggle.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };
  navToggle.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.toggle("open");
    navToggle.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  });
  mobileMenu.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", closeMenu)
  );
}

const topbar = document.getElementById("topbar");
let scrollScheduled = false;
let lastScrolled = null;
const updateTopbar = () => {
  scrollScheduled = false;
  const shouldBeScrolled = window.scrollY > 10;
  if (shouldBeScrolled !== lastScrolled) {
    topbar.classList.toggle("scrolled", shouldBeScrolled);
    lastScrolled = shouldBeScrolled;
  }
};
const onScroll = () => {
  if (!scrollScheduled) {
    scrollScheduled = true;
    requestAnimationFrame(updateTopbar);
  }
};
window.addEventListener("scroll", onScroll, { passive: true });

requestAnimationFrame(() => {
  if (fontPreload) fontPreload.rel = "stylesheet";
  updateTopbar();
});

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
