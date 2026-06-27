/* ==========================================================================
   AetherStudy — Core Application Controller & State Orchestrator
   ========================================================================== */

window.StudyApp = window.StudyApp || {};

(function() {
  // Gamification Profile State
  let profile = {
    level: 1,
    xp: 0,
    streak: 0,
    lastActiveDate: ""
  };

  // Entry Point
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initProfile();
    initUIElements();
    initRouting();
    
    // Initialize Child Modules
    window.StudyApp.notifications?.init();
    window.StudyApp.planner?.init();
    window.StudyApp.pomodoro?.init();
    window.StudyApp.flashcards?.init();
    window.StudyApp.quiz?.init();

    // Initial icon render
    lucide.createIcons();
    
    // Welcoming toast
    setTimeout(() => {
      window.StudyApp.notifications?.showToast("Welcome back to AetherStudy!", "info");
    }, 800);
  });

  /* ==========================================================================
     GAMIFICATION SYSTEMS (XP, LEVELING, STREAK)
     ========================================================================== */
  function initProfile() {
    const saved = localStorage.getItem("aetherstudy_profile");
    const todayStr = new Date().toDateString();
    
    if (saved) {
      try {
        profile = { ...profile, ...JSON.parse(saved) };
      } catch (e) {}
    }

    // Calculate Streak
    if (profile.lastActiveDate) {
      const lastActive = new Date(profile.lastActiveDate);
      const today = new Date(todayStr);
      
      // Difference in days
      const diffTime = Math.abs(today - lastActive);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Active consecutive days - increment streak
        profile.streak++;
        localStorage.setItem("aetherstudy_profile", JSON.stringify(profile));
      } else if (diffDays > 1) {
        // Streak broken
        profile.streak = 1;
      }
    } else {
      // First sign-in
      profile.streak = 1;
    }

    profile.lastActiveDate = todayStr;
    saveProfile();
    updateProfileUI();
  }

  function saveProfile() {
    localStorage.setItem("aetherstudy_profile", JSON.stringify(profile));
  }

  function updateProfileUI() {
    const lvlText = document.getElementById("user-level");
    const xpText = document.getElementById("user-xp");
    const xpFill = document.getElementById("user-xp-fill");
    const streakText = document.getElementById("user-streak");

    if (lvlText) lvlText.textContent = profile.level;
    if (xpText) xpText.textContent = profile.xp;
    if (xpFill) {
      // 100 XP per level
      const pct = Math.min(100, Math.max(0, profile.xp));
      xpFill.style.width = `${pct}%`;
    }
    if (streakText) streakText.textContent = profile.streak;
  }

  // Global helper exposed to modules to award XP points
  window.StudyApp.awardXP = function(amount) {
    profile.xp += amount;
    
    // Level up logic (100 XP threshold per level)
    if (profile.xp >= 100) {
      profile.level += Math.floor(profile.xp / 100);
      profile.xp = profile.xp % 100;
      
      // Trigger level-up celebratory alert
      setTimeout(() => {
        window.StudyApp.notifications?.triggerAlert(
          "Level Up! 🌟", 
          `Congratulations! You have reached Study Level ${profile.level}. Keep up the amazing work!`
        );
      }, 1000);
    }
    
    saveProfile();
    updateProfileUI();
  };

  /* ==========================================================================
     THEME CONTROLLER
     ========================================================================== */
  function initTheme() {
    const root = document.documentElement;
    const themeBtn = document.getElementById("theme-toggle-btn");
    const themeIcon = document.getElementById("theme-icon");
    
    // Load setting
    const savedTheme = localStorage.getItem("aetherstudy_theme") || "dark";
    root.setAttribute("data-theme", savedTheme);
    
    updateThemeIcon(savedTheme);

    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const currentTheme = root.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        
        root.setAttribute("data-theme", newTheme);
        localStorage.setItem("aetherstudy_theme", newTheme);
        updateThemeIcon(newTheme);
        
        window.StudyApp.notifications?.showToast(`Theme switched to ${newTheme} mode.`, "info");
      });
    }
  }

  function updateThemeIcon(theme) {
    const themeIcon = document.getElementById("theme-icon");
    if (!themeIcon) return;

    if (theme === "dark") {
      themeIcon.setAttribute("data-lucide", "sun");
    } else {
      themeIcon.setAttribute("data-lucide", "moon");
    }
    lucide.createIcons();
  }

  /* ==========================================================================
     UI LAYOUT & STATIC CONTENT LOADERS
     ========================================================================== */
  function initUIElements() {
    // Header Greeting & Date
    const greetingEl = document.getElementById("greeting");
    const dateEl = document.getElementById("live-date");
    
    const now = new Date();
    
    // Greeting
    const hour = now.getHours();
    let greetText = "Hello, Scholar!";
    if (hour >= 5 && hour < 12) greetText = "Good morning, Scholar!";
    else if (hour >= 12 && hour < 17) greetText = "Good afternoon, Scholar!";
    else if (hour >= 17 || hour < 5) greetText = "Good evening, Scholar!";
    
    if (greetingEl) greetingEl.textContent = greetText;

    // Date Format
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (dateEl) dateEl.textContent = now.toLocaleDateString(undefined, options);

    // Notification Hub Drawer toggles
    const notifBtn = document.getElementById("notif-hub-btn");
    const notifDrawer = document.getElementById("notif-hub-drawer");
    const notifClose = document.getElementById("notif-hub-close");
    const notifClear = document.getElementById("clear-notif-log-btn");

    if (notifBtn && notifDrawer) {
      notifBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        notifDrawer.classList.toggle("hidden");
      });
    }

    if (notifClose && notifDrawer) {
      notifClose.addEventListener("click", () => {
        notifDrawer.classList.add("hidden");
      });
    }

    if (notifClear) {
      notifClear.addEventListener("click", () => {
        window.StudyApp.notifications?.clearLogs();
      });
    }

    // Close drawers/drawers on document click
    document.addEventListener("click", (e) => {
      if (notifDrawer && !notifDrawer.classList.contains("hidden")) {
        if (!notifDrawer.contains(e.target) && !notifBtn.contains(e.target)) {
          notifDrawer.classList.add("hidden");
        }
      }
    });

    // Request permissions button settings
    const reqPermBtn = document.getElementById("btn-request-notif-permission");
    if (reqPermBtn) {
      reqPermBtn.addEventListener("click", () => {
        window.StudyApp.notifications?.requestPermission();
      });
    }

    // Reset Data Workspace Button
    const resetDataBtn = document.getElementById("reset-data-btn");
    if (resetDataBtn) {
      resetDataBtn.addEventListener("click", () => {
        const doubleCheck = confirm("DANGER!\n\nThis will purge all tasks, decks, schedules, progress streaks, and levels. This cannot be undone.\n\nProceed with full wipe?");
        if (doubleCheck) {
          localStorage.clear();
          window.StudyApp.notifications?.showToast("Resetting workspace...", "info");
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      });
    }
  }

  /* ==========================================================================
     TAB ROUTING ENGINE (SPA LINKS)
     ========================================================================== */
  function initRouting() {
    const navLinks = document.querySelectorAll(".nav-link");
    const views = document.querySelectorAll(".tab-view");

    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        
        const tabTarget = link.getAttribute("data-tab");
        
        // Update URL hash
        window.location.hash = tabTarget;

        // Toggle nav class
        navLinks.forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        // Toggle active views
        views.forEach(view => {
          if (view.id === `view-${tabTarget}`) {
            view.classList.add("active-view");
          } else {
            view.classList.remove("active-view");
          }
        });

        // Trigger dynamic entry events for specific screens
        if (tabTarget === "pomodoro") {
          window.StudyApp.pomodoro?.syncTaskPicker();
        } else if (tabTarget === "planner") {
          window.StudyApp.planner?.renderTaskList();
          window.StudyApp.planner?.renderHoursGrid();
        } else if (tabTarget === "flashcards") {
          // Return to deck selection list
          document.getElementById("deck-study-container").classList.add("hidden");
          document.getElementById("deck-list-container").classList.remove("hidden");
          window.StudyApp.flashcards?.renderDecksGrid();
        } else if (tabTarget === "quiz") {
          window.StudyApp.quiz?.syncRecallPool();
        }
      });
    });

    // Check location hash on page mount for routing redirect
    const hash = window.location.hash.substring(1);
    if (hash) {
      const activeLink = document.querySelector(`.nav-link[data-tab="${hash}"]`);
      if (activeLink) {
        activeLink.click();
      }
    }
  }

})();
