/* ==========================================================================
   AetherStudy — Notifications & Audio Synthesizer Module
   ========================================================================== */

window.StudyApp = window.StudyApp || {};

window.StudyApp.notifications = (function() {
  let audioContext = null;
  let notificationLogs = [];

  // Initialize notifications state
  function init() {
    // Load logs from localStorage
    const savedLogs = localStorage.getItem("aetherstudy_notif_logs");
    if (savedLogs) {
      try {
        notificationLogs = JSON.parse(savedLogs);
      } catch (e) {
        notificationLogs = [];
      }
    }
    updateBadge();
    renderLogList();
  }

  // Lazy initialize AudioContext on user interaction to bypass browser policies
  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  }

  // Synthesize soft focus bell chime using Web Audio API oscillators
  function playBellChime() {
    // Check if sounds are globally enabled in settings
    const soundsEnabled = document.getElementById("setting-sound-toggle")?.checked ?? true;
    if (!soundsEnabled) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      // Chime frequency components (metallic bell tones)
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        // Stagger strikes slightly for rich texture
        const delay = idx * 0.05;
        
        // Envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15 / frequencies.length, now + delay + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + delay + 2.0); // 2 second decay
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(now + delay);
        osc.stop(now + delay + 2.5);
      });
    } catch (e) {
      console.warn("Failed to play bell audio: ", e);
    }
  }

  // Synthesize success chime (rising notes)
  function playSuccessChime() {
    const soundsEnabled = document.getElementById("setting-sound-toggle")?.checked ?? true;
    if (!soundsEnabled) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 -> E5 -> G5 -> C6
      const duration = 0.12;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + (idx * duration));
        
        gainNode.gain.setValueAtTime(0, now + (idx * duration));
        gainNode.gain.linearRampToValueAtTime(0.08, now + (idx * duration) + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + (idx * duration) + duration + 0.05);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(now + (idx * duration));
        osc.stop(now + (idx * duration) + duration + 0.1);
      });
    } catch (e) {
      console.warn("Failed to play success audio: ", e);
    }
  }

  // Synthesize incorrect answer tone (low buzz)
  function playFailureChime() {
    const soundsEnabled = document.getElementById("setting-sound-toggle")?.checked ?? true;
    if (!soundsEnabled) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // Low A
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.3); // Pitch bend down
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.06, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn("Failed to play failure audio: ", e);
    }
  }

  // Synthesize double beep alert
  function playBeepBeep() {
    const soundsEnabled = document.getElementById("setting-sound-toggle")?.checked ?? true;
    if (!soundsEnabled) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      [0, 0.25].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now + delay);
        
        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(0.1, now + delay + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.15);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(now + delay);
        osc.stop(now + delay + 0.2);
      });
    } catch (e) {
      console.warn("Failed to play beep audio: ", e);
    }
  }

  // Display sliding in toast notifications
  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    // Choose appropriate Lucide icon tag depending on status type
    let iconName = "info";
    if (type === "success") iconName = "check-circle";
    if (type === "error") iconName = "alert-circle";
    
    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    // Sound chime matching toast type
    if (type === "success") {
      playSuccessChime();
    } else if (type === "error") {
      playFailureChime();
    }

    // Auto-remove toast
    setTimeout(() => {
      toast.style.animation = "slideInRight 0.3s reverse forwards";
      toast.addEventListener("animationend", () => {
        toast.remove();
      });
    }, 3500);
  }

  // Request browser Notification API permission
  function requestNotificationPermission() {
    if (!("Notification" in window)) {
      showToast("This browser does not support desktop notifications.", "info");
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        showToast("Desktop notifications enabled successfully!", "success");
      } else {
        showToast("Desktop notifications permission denied.", "info");
      }
    });
  }

  // Trigger both synthesized audio and platform OS notifications
  function triggerSystemAlert(title, message) {
    // Play sound notification
    playBellChime();

    // Log notification in-app
    logNotification(title, message);

    // Push OS Notification if permitted
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: message,
          tag: "aetherstudy-timer",
          silent: true // sound handled programmatically
        });
      } catch (err) {
        console.warn("Native Notification failed to spawn: ", err);
      }
    }
  }

  // Log in-app notifications
  function logNotification(title, message) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const newLog = {
      title,
      message,
      time: timeStr,
      id: Date.now()
    };

    notificationLogs.unshift(newLog);
    
    // Keep max 50 items in log
    if (notificationLogs.length > 50) {
      notificationLogs.pop();
    }

    localStorage.setItem("aetherstudy_notif_logs", JSON.stringify(notificationLogs));
    
    updateBadge();
    renderLogList();
  }

  function updateBadge() {
    const badge = document.getElementById("notif-badge");
    if (!badge) return;

    if (notificationLogs.length > 0) {
      badge.textContent = notificationLogs.length;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  function renderLogList() {
    const list = document.getElementById("notif-hub-list");
    if (!list) return;

    if (notificationLogs.length === 0) {
      list.innerHTML = `<span class="no-notifs">No notifications yet today.</span>`;
      return;
    }

    list.innerHTML = notificationLogs.map((log) => `
      <div class="notif-log-item">
        <span class="notif-log-title">${log.title}</span>
        <span class="text-sm text-secondary">${log.message}</span>
        <span class="notif-log-time">${log.time}</span>
      </div>
    `).join("");
  }

  function clearLogs() {
    notificationLogs = [];
    localStorage.setItem("aetherstudy_notif_logs", JSON.stringify(notificationLogs));
    updateBadge();
    renderLogList();
    showToast("Notification logs cleared.", "info");
  }

  return {
    init,
    showToast,
    requestPermission: requestNotificationPermission,
    triggerAlert: triggerSystemAlert,
    playChime: playBellChime,
    playSuccess: playSuccessChime,
    playBeep: playBeepBeep,
    logNotification,
    clearLogs
  };
})();
