const fontPreload = document.getElementById("jetbrains-font-preload");
if (fontPreload) fontPreload.rel = "stylesheet";

const topbar = document.getElementById("topbar");
const onScroll = () => {
  topbar.classList.toggle("scrolled", window.scrollY > 10);
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

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
