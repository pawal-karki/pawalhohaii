// Caching DOM elements to avoid repeated lookups
const elements = {
  audio: document.getElementById("audioPlayer"),
  loader: document.getElementById("preloader"),
  settingContainer: document.getElementById("setting-container"),
  visualToggle: document.getElementById("visualmodetogglebuttoncontainer"),
  soundToggle: document.getElementById("soundtogglebuttoncontainer"),
  switchSound: document.getElementById("switchforsound"),
  body: document.body,
  mobileMenu: document.getElementById("mobiletogglemenu"),
  burgerBar1: document.getElementById("burger-bar1"),
  burgerBar2: document.getElementById("burger-bar2"),
  burgerBar3: document.getElementById("burger-bar3"),
  backToTopButton: document.getElementById("backtotopbutton"),
  sections: document.querySelectorAll("section"),
  navLi: document.querySelectorAll(".navbar .navbar-tabs .navbar-tabs-ul li"),
  mobileNavLi: document.querySelectorAll(
    ".mobiletogglemenu .mobile-navbar-tabs-ul li"
  ),
  pupils: Array.from(document.getElementsByClassName("footer-pupil")),
};

// Preloader - Use event listener only when needed
if (elements.loader) {
  window.addEventListener(
    "load",
    () => {
      elements.loader.style.display = "none";
      document.querySelector(".hey")?.classList.add("popup");
    },
    { once: true }
  ); // Use once option to auto-remove listener after execution
}

// Settings toggle - Simplified
function settingToggle() {
  elements.settingContainer.classList.toggle("settingactivate");
  elements.visualToggle.classList.toggle("visualmodeshow");
  elements.soundToggle.classList.toggle("soundmodeshow");
}

// Audio control - Simplified
function playPause() {
  if (elements.switchSound.checked) {
    elements.audio.play();
  } else {
    elements.audio.pause();
  }
}

// Visual mode toggle - Using cached elements
function visualMode() {
  elements.body.classList.toggle("light-mode");
  document.querySelectorAll(".needtobeinvert").forEach((element) => {
    element.classList.toggle("invertapplied");
  });
}

// Mobile menu toggles - Using cached elements
function hamburgerMenu() {
  elements.body.classList.toggle("stopscrolling");
  elements.mobileMenu.classList.toggle("show-toggle-menu");
  elements.burgerBar1.classList.toggle("hamburger-animation1");
  elements.burgerBar2.classList.toggle("hamburger-animation2");
  elements.burgerBar3.classList.toggle("hamburger-animation3");
}

function hideMenuByLi() {
  elements.body.classList.toggle("stopscrolling");
  elements.mobileMenu.classList.remove("show-toggle-menu");
  elements.burgerBar1.classList.remove("hamburger-animation1");
  elements.burgerBar2.classList.remove("hamburger-animation2");
  elements.burgerBar3.classList.remove("hamburger-animation3");
}

// Scroll spy - Optimized with requestAnimationFrame
let isScrolling = false;
function handleScroll() {
  if (!isScrolling) {
    window.requestAnimationFrame(() => {
      let current = "";
      const scrollPosition = window.pageYOffset;

      elements.sections.forEach((section) => {
        const sectionTop = section.offsetTop;
        if (scrollPosition >= sectionTop - 200) {
          current = section.getAttribute("id");
        }
      });

      elements.mobileNavLi.forEach((li) => {
        li.classList.remove("activeThismobiletab");
        if (li.classList.contains(current)) {
          li.classList.add("activeThismobiletab");
        }
      });

      elements.navLi.forEach((li) => {
        li.classList.remove("activeThistab");
        if (li.classList.contains(current)) {
          li.classList.add("activeThistab");
        }
      });

      isScrolling = false;
    });
    isScrolling = true;
  }
}

// Back to top button
function scrollFunction() {
  if (document.documentElement.scrollTop > 400) {
    elements.backToTopButton.style.display = "block";
  } else {
    elements.backToTopButton.style.display = "none";
  }
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// Eye movement optimization
const pupilConfig = {
  startPoint: -10,
  rangeX: 20,
  rangeY: 15,
  mouseXStart: 0,
  mouseXEnd: window.innerWidth,
  mouseYEnd: window.innerHeight,
};

// Use throttle for mousemove events
let ticking = false;
function handleMouseMove(event) {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      const fracX =
        (event.clientX - pupilConfig.mouseXStart) /
        (pupilConfig.mouseXEnd - pupilConfig.mouseXStart);
      const fracY = event.clientY / pupilConfig.mouseYEnd;

      const pupilX = pupilConfig.startPoint + fracX * pupilConfig.rangeX;
      const pupilY = pupilConfig.startPoint + fracY * pupilConfig.rangeY;

      const transform = `translate(${pupilX}px, ${pupilY}px)`;

      elements.pupils.forEach((pupil) => {
        pupil.style.transform = transform;
      });

      ticking = false;
    });
    ticking = true;
  }
}

// Resize handler with debounce
let resizeTimeout;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    pupilConfig.mouseXEnd = window.innerWidth;
    pupilConfig.mouseYEnd = window.innerHeight;
  }, 250);
}

// Prevent context menu on images
document.addEventListener(
  "contextmenu",
  (e) => {
    if (e.target.nodeName === "IMG") {
      e.preventDefault();
    }
  },
  { passive: true }
);

// Event listeners - Add passive flag where possible
window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("scroll", scrollFunction, { passive: true });
window.addEventListener("mousemove", handleMouseMove, { passive: true });
window.addEventListener("resize", handleResize, { passive: true });

// Console signature
console.log(
  "%c Designed and Developed by Pawal Karki",
  "background-image: linear-gradient(90deg,#8000ff,#6bc5f8); color: white;font-weight:900;font-size:1rem; padding:20px;"
);
