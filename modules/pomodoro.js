/* ==========================================================================
   AetherStudy — Focus Timer (Pomodoro) Module
   ========================================================================== */

window.StudyApp = window.StudyApp || {};

window.StudyApp.pomodoro = (function() {
  // Configurations & Defaults
  let config = {
    work: 25,  // minutes
    short: 5,  // minutes
    long: 15   // minutes
  };

  let state = {
    mode: "work", // work, short, long
    secondsRemaining: 0,
    totalSecondsForMode: 0,
    timerId: null,
    status: "stopped", // running, paused, stopped
    activeTaskId: ""
  };

  let stats = {
    sessionsCompleted: 0,
    minutesFocused: 0,
    lastUpdateDate: ""
  };

  const SVG_CIRCUMFERENCE = 534; // 2 * PI * r (85)

  function init() {
    loadConfig();
    loadStats();
    setupEventListeners();
    syncTaskPicker();
    resetTimerForMode();
    updateStatsDisplay();
  }

  function loadConfig() {
    const saved = localStorage.getItem("aetherstudy_timer_config");
    if (saved) {
      try {
        config = { ...config, ...JSON.parse(saved) };
      } catch (e) {}
    }
    
    // Set settings inputs
    const workInput = document.getElementById("setting-work-duration");
    const shortInput = document.getElementById("setting-short-duration");
    const longInput = document.getElementById("setting-long-duration");
    
    if (workInput) workInput.value = config.work;
    if (shortInput) shortInput.value = config.short;
    if (longInput) longInput.value = config.long;
  }

  function saveConfig(newConfig) {
    config = { ...config, ...newConfig };
    localStorage.setItem("aetherstudy_timer_config", JSON.stringify(config));
    if (state.status === "stopped") {
      resetTimerForMode();
    }
  }

  function loadStats() {
    const saved = localStorage.getItem("aetherstudy_timer_stats");
    const today = new Date().toDateString();
    
    if (saved) {
      try {
        stats = JSON.parse(saved);
        // Reset daily stats if it is a new day
        if (stats.lastUpdateDate !== today) {
          stats.sessionsCompleted = 0;
          stats.minutesFocused = 0;
          stats.lastUpdateDate = today;
          saveStats();
        }
      } catch (e) {}
    } else {
      stats.lastUpdateDate = today;
      saveStats();
    }
  }

  function saveStats() {
    localStorage.setItem("aetherstudy_timer_stats", JSON.stringify(stats));
  }

  function setupEventListeners() {
    // Mode Buttons
    const modeButtons = document.querySelectorAll(".timer-mode-btn");
    modeButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.status === "running") {
          const confirmSwitch = confirm("Focus session is currently running. Switch modes and discard progress?");
          if (!confirmSwitch) return;
        }
        
        modeButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        state.mode = btn.getAttribute("data-mode");
        stopTimer();
        resetTimerForMode();
      });
    });

    // Control Buttons
    const playBtn = document.getElementById("timer-play");
    const resetBtn = document.getElementById("timer-reset");
    const skipBtn = document.getElementById("timer-skip");

    if (playBtn) {
      playBtn.addEventListener("click", () => {
        if (state.status === "running") {
          pauseTimer();
        } else {
          startTimer();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const confirmReset = state.status === "running" ? confirm("Reset current session?") : true;
        if (confirmReset) {
          stopTimer();
          resetTimerForMode();
        }
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        const confirmSkip = state.status === "running" ? confirm("Skip current session?") : true;
        if (confirmSkip) {
          handleCycleComplete(true); // Complete prematurely
        }
      });
    }

    // Task Selector Linkage
    const taskPicker = document.getElementById("pomodoro-task-picker");
    if (taskPicker) {
      taskPicker.addEventListener("change", (e) => {
        state.activeTaskId = e.target.value;
        renderActiveTask();
      });
    }

    // Save timer settings trigger
    const saveTimersBtn = document.getElementById("save-timers-btn");
    if (saveTimersBtn) {
      saveTimersBtn.addEventListener("click", () => {
        const workVal = parseInt(document.getElementById("setting-work-duration").value) || 25;
        const shortVal = parseInt(document.getElementById("setting-short-duration").value) || 5;
        const longVal = parseInt(document.getElementById("setting-long-duration").value) || 15;
        
        saveConfig({ work: workVal, short: shortVal, long: longVal });
        window.StudyApp.notifications?.showToast("Timer durations updated.", "success");
      });
    }
  }

  function syncTaskPicker() {
    const picker = document.getElementById("pomodoro-task-picker");
    if (!picker) return;

    const currentVal = picker.value;
    
    // Fetch active tasks from planner
    const activeTasks = window.StudyApp.planner?.getActiveTasks() || [];
    
    picker.innerHTML = `<option value="">-- Select task from planner --</option>`;
    
    activeTasks.forEach(task => {
      const option = document.createElement("option");
      option.value = task.id;
      option.textContent = `[${task.priority}] ${task.title}`;
      picker.appendChild(option);
    });

    // Restore selected value if task is still active
    if (activeTasks.some(t => t.id === currentVal)) {
      picker.value = currentVal;
    } else {
      state.activeTaskId = "";
      renderActiveTask();
    }
  }

  function renderActiveTask() {
    const container = document.getElementById("focus-task-content");
    if (!container) return;

    if (!state.activeTaskId) {
      container.innerHTML = `<span class="no-task-placeholder">No active task selected. Pick one from the list!</span>`;
      return;
    }

    // Fetch active tasks
    const activeTasks = window.StudyApp.planner?.getActiveTasks() || [];
    const currentTask = activeTasks.find(t => t.id === state.activeTaskId);

    if (!currentTask) {
      state.activeTaskId = "";
      container.innerHTML = `<span class="no-task-placeholder">No active task selected. Pick one from the list!</span>`;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 4px 0;">
        <span class="active-task-label-tag">${currentTask.category}</span>
        <span style="font-weight: 600;">${currentTask.title}</span>
        <button id="pomo-task-complete-btn" class="task-action-btn" data-id="${currentTask.id}" title="Complete Task" style="color: var(--accent-success); margin-left: 10px;">
          <i data-lucide="check-circle" style="width: 18px; height: 18px;"></i>
        </button>
      </div>
    `;
    lucide.createIcons();

    // Attach quick task completion button listener
    const compBtn = document.getElementById("pomo-task-complete-btn");
    if (compBtn) {
      compBtn.addEventListener("click", () => {
        // Toggle task complete through planner module
        window.StudyApp.planner?.getActiveTasks(); // checks state
        
        // Find elements inside tasks list to invoke click on checkbox
        const plannerCheck = document.querySelector(`.task-checkbox[data-id="${currentTask.id}"]`);
        if (plannerCheck) {
          plannerCheck.click();
        } else {
          // Fallback if planner view is not mounted
          window.StudyApp.notifications?.showToast(`Task "${currentTask.title}" Completed!`, "success");
        }
        
        state.activeTaskId = "";
        syncTaskPicker();
      });
    }
  }

  function resetTimerForMode() {
    const minutes = config[state.mode] || 25;
    state.secondsRemaining = minutes * 60;
    state.totalSecondsForMode = minutes * 60;
    
    updateDisplay();
    updateProgressRing();
  }

  function updateDisplay() {
    const display = document.getElementById("timer-display");
    if (!display) return;

    const mins = Math.floor(state.secondsRemaining / 60);
    const secs = state.secondsRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    
    display.textContent = timeStr;
    
    // Reflect in browser tab title
    const modeLabel = state.mode === "work" ? "Focus" : "Break";
    document.title = `[${timeStr}] ${modeLabel} — AetherStudy`;
  }

  function updateProgressRing() {
    const circle = document.getElementById("timer-progress");
    if (!circle) return;

    if (state.totalSecondsForMode === 0) {
      circle.style.strokeDashoffset = 0;
      return;
    }

    const pct = state.secondsRemaining / state.totalSecondsForMode;
    const offset = SVG_CIRCUMFERENCE - (pct * SVG_CIRCUMFERENCE);
    circle.style.strokeDashoffset = offset;
  }

  function startTimer() {
    if (state.status === "running") return;

    state.status = "running";
    updatePlayButtonIcon();

    // Handle audio context wake up
    window.StudyApp.notifications?.playBeep(); 

    state.timerId = setInterval(() => {
      if (state.secondsRemaining > 0) {
        state.secondsRemaining--;
        updateDisplay();
        updateProgressRing();
      } else {
        handleCycleComplete();
      }
    }, 1000);
  }

  function pauseTimer() {
    if (state.status !== "running") return;
    
    clearInterval(state.timerId);
    state.timerId = null;
    state.status = "paused";
    updatePlayButtonIcon();
    
    window.StudyApp.notifications?.showToast("Focus session paused.", "info");
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    state.status = "stopped";
    updatePlayButtonIcon();
    document.title = "AetherStudy — Premium Planner & Focus Dashboard";
  }

  function updatePlayButtonIcon() {
    const playBtn = document.getElementById("timer-play");
    if (!playBtn) return;

    if (state.status === "running") {
      playBtn.innerHTML = `<i data-lucide="pause"></i>`;
      playBtn.title = "Pause Session";
    } else {
      playBtn.innerHTML = `<i data-lucide="play"></i>`;
      playBtn.title = "Start Session";
    }
    lucide.createIcons();
  }

  function handleCycleComplete(skipped = false) {
    stopTimer();
    
    let heading = "";
    let body = "";
    let xpGain = 0;

    if (state.mode === "work") {
      heading = "Focus Block Completed!";
      body = "Great job! Take a well-deserved short break.";
      xpGain = 15;
      
      // Update statistics
      if (!skipped) {
        stats.sessionsCompleted++;
        stats.minutesFocused += config.work;
        stats.lastUpdateDate = new Date().toDateString();
        saveStats();
        updateStatsDisplay();
      }

      // Auto-transition to short break
      state.mode = "short";
      setActiveModeTabUI("short");
    } else {
      heading = "Break Completed!";
      body = "Ready to get back to studying? Focus mode is up next.";
      xpGain = 5;

      // Auto-transition to work mode
      state.mode = "work";
      setActiveModeTabUI("work");
    }

    resetTimerForMode();

    if (!skipped) {
      // Award XP
      window.StudyApp.awardXP?.(xpGain);
      // Trigger alerts
      window.StudyApp.notifications?.triggerAlert(heading, `${body} (+${xpGain} XP)`);
    } else {
      window.StudyApp.notifications?.showToast("Focus cycle skipped.", "info");
    }
  }

  function setActiveModeTabUI(mode) {
    const modeButtons = document.querySelectorAll(".timer-mode-btn");
    modeButtons.forEach(btn => {
      if (btn.getAttribute("data-mode") === mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function updateStatsDisplay() {
    const sSessions = document.getElementById("stat-sessions-today");
    const sMinutes = document.getElementById("stat-minutes-today");

    if (sSessions) sSessions.textContent = stats.sessionsCompleted;
    if (sMinutes) sMinutes.textContent = stats.minutesFocused;
  }

  return {
    init,
    syncTaskPicker,
    saveConfig
  };
})();
