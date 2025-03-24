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
  themeButton: document.querySelector(".theme-toggle"),
  soundButton: document.querySelector(".sound-toggle"),
};

// Preloader - Use event listener only when needed
if (elements.loader) {
  window.addEventListener(
    "load",
    () => {
      elements.loader.style.display = "none";
      document.querySelector(".hey")?.classList.add("popup");

      // Initialize buttons state based on saved preferences
      initializeToggleStates();
    },
    { once: true }
  ); // Use once option to auto-remove listener after execution
}

// Initialize toggle states based on stored preferences
function initializeToggleStates() {
  // Check for saved theme preference
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    elements.body.classList.add("light-mode");
    document.querySelectorAll(".needtobeinvert").forEach((element) => {
      element.classList.add("invertapplied");
    });
  }

  // Check for saved audio preference
  const audioEnabled = localStorage.getItem("audioEnabled");
  if (audioEnabled === "true") {
    elements.body.classList.add("sound-on");
    if (elements.switchSound) {
      elements.switchSound.checked = true;
    }
    playPause();
  }

  // Initialize mobile-friendly touch events
  initMobileControls();
}

// Add touch-specific handling for mobile devices
function initMobileControls() {
  // Get toggle buttons
  const themeBtn = document.querySelector(".theme-toggle");
  const soundBtn = document.querySelector(".sound-toggle");

  if (themeBtn && soundBtn) {
    // Add active state class for touch feedback
    ["touchstart", "mousedown"].forEach((eventType) => {
      themeBtn.addEventListener(
        eventType,
        () => {
          themeBtn.classList.add("touch-active");
        },
        { passive: true }
      );

      soundBtn.addEventListener(
        eventType,
        () => {
          soundBtn.classList.add("touch-active");
        },
        { passive: true }
      );
    });

    // Remove active state
    ["touchend", "touchcancel", "mouseup", "mouseleave"].forEach(
      (eventType) => {
        themeBtn.addEventListener(
          eventType,
          () => {
            themeBtn.classList.remove("touch-active");
            // Small delay to ensure the click event has time to fire
            setTimeout(() => themeBtn.blur(), 300);
          },
          { passive: true }
        );

        soundBtn.addEventListener(
          eventType,
          () => {
            soundBtn.classList.remove("touch-active");
            setTimeout(() => soundBtn.blur(), 300);
          },
          { passive: true }
        );
      }
    );
  }

  // Make sure hamburger menu doesn't interfere with toggles
  const hamburgerBtn = document.getElementById("hamburger-button");
  if (hamburgerBtn) {
    const togglesContainer = document.querySelector(".quick-toggles");

    hamburgerBtn.addEventListener(
      "click",
      (e) => {
        if (togglesContainer && togglesContainer.contains(e.target)) {
          e.stopPropagation();
        }
      },
      { passive: false }
    );
  }
}

// Settings toggle - Simplified and renamed to match HTML
function settingtoggle() {
  elements.settingContainer.classList.toggle("settingactivate");
  elements.visualToggle.classList.toggle("visualmodeshow");
  elements.soundToggle.classList.toggle("soundmodeshow");
}

// Audio control - Improved
function playPause() {
  const isPlaying = elements.body.classList.contains("sound-on");

  if (!isPlaying) {
    // Turn sound on
    elements.body.classList.add("sound-on");
    if (elements.switchSound) {
      elements.switchSound.checked = true;
    }
    elements.audio.play().catch((e) => {
      console.warn("Audio play failed:", e);
      // Handle autoplay restrictions
      if (e.name === "NotAllowedError") {
        // Visual feedback that sound couldn't be played
        elements.body.classList.remove("sound-on");
        if (elements.switchSound) {
          elements.switchSound.checked = false;
        }
        localStorage.setItem("audioEnabled", "false");
      }
    });
    localStorage.setItem("audioEnabled", "true");
  } else {
    // Turn sound off
    elements.body.classList.remove("sound-on");
    if (elements.switchSound) {
      elements.switchSound.checked = false;
    }
    elements.audio.pause();
    localStorage.setItem("audioEnabled", "false");
  }
}

// Visual mode toggle - Enhanced
function visualMode() {
  const isLightMode = elements.body.classList.contains("light-mode");

  if (!isLightMode) {
    // Switch to light mode
    elements.body.classList.add("light-mode");
    localStorage.setItem("theme", "light");
  } else {
    // Switch to dark mode
    elements.body.classList.remove("light-mode");
    localStorage.setItem("theme", "dark");
  }

  // Toggle inverted elements
  document.querySelectorAll(".needtobeinvert").forEach((element) => {
    element.classList.toggle("invertapplied");
  });

  // Update switch in settings panel if it exists
  if (document.getElementById("switchforvisualmode")) {
    document.getElementById("switchforvisualmode").checked = !isLightMode;
  }
}

// Mobile menu toggles - Using cached elements
function hamburgerMenu(event) {
  // Prevent interaction if the click was on toggle buttons
  const togglesContainer = document.querySelector(".quick-toggles");
  if (
    togglesContainer &&
    (event.target.closest(".quick-toggles") ||
      event.target.closest(".toggle-btn"))
  ) {
    return; // Don't toggle menu if clicking on toggle buttons
  }

  elements.body.classList.toggle("stopscrolling");
  elements.mobileMenu.classList.toggle("show-toggle-menu");
  elements.burgerBar1.classList.toggle("hamburger-animation1");
  elements.burgerBar2.classList.toggle("hamburger-animation2");
  elements.burgerBar3.classList.toggle("hamburger-animation3");
}

function hidemenubyli() {
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
