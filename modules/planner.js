/* ==========================================================================
   AetherStudy — Study Planner & Task Manager Module
   ========================================================================== */

window.StudyApp = window.StudyApp || {};

window.StudyApp.planner = (function() {
  let tasks = [];
  let currentFilter = "all";

  // Operating Hours: 8:00 AM to 8:00 PM
  const plannerHours = [
    { val: "08:00", label: "08:00 AM" },
    { val: "09:00", label: "09:00 AM" },
    { val: "10:00", label: "10:00 AM" },
    { val: "11:00", label: "11:00 AM" },
    { val: "12:00", label: "12:00 PM" },
    { val: "13:00", label: "01:00 PM" },
    { val: "14:00", label: "02:00 PM" },
    { val: "15:00", label: "03:00 PM" },
    { val: "16:00", label: "04:00 PM" },
    { val: "17:00", label: "05:00 PM" },
    { val: "18:00", label: "06:00 PM" },
    { val: "19:00", label: "07:00 PM" },
    { val: "20:00", label: "08:00 PM" }
  ];

  function init() {
    loadTasks();
    setupEventListeners();
    populateTimeblockDropdown();
    renderHoursGrid();
    renderTaskList();
  }

  function loadTasks() {
    const saved = localStorage.getItem("aetherstudy_tasks");
    if (saved) {
      try {
        tasks = JSON.parse(saved);
      } catch (e) {
        tasks = [];
      }
    } else {
      // Seed data for beautiful presentation on first load
      tasks = [
        {
          id: "seed-1",
          title: "Revise Mitochondria structure",
          category: "Study",
          priority: "High",
          dueDate: new Date().toISOString().split("T")[0],
          timeblock: "09:00",
          description: "Read chapter 4 and draw diagrams.",
          status: "todo"
        },
        {
          id: "seed-2",
          title: "Implement Pomodoro SVG ring",
          category: "Coding",
          priority: "Medium",
          dueDate: new Date().toISOString().split("T")[0],
          timeblock: "11:00",
          description: "Review stroke-dashoffset transition formula.",
          status: "in_progress"
        },
        {
          id: "seed-3",
          title: "World History French Revolution cards",
          category: "Reading",
          priority: "Low",
          dueDate: new Date().toISOString().split("T")[0],
          timeblock: "",
          description: "Make at least 10 cards for Spaced Repetition.",
          status: "done"
        }
      ];
      saveTasks();
    }
  }

  function saveTasks() {
    localStorage.setItem("aetherstudy_tasks", JSON.stringify(tasks));
    // Trigger dependency syncs
    window.StudyApp.pomodoro?.syncTaskPicker();
  }

  function setupEventListeners() {
    // New Task Button
    const newTaskBtn = document.getElementById("new-task-btn");
    const taskModal = document.getElementById("task-modal");
    const closeBtn = document.getElementById("task-modal-close");
    const cancelBtn = document.getElementById("task-cancel-btn");
    const form = document.getElementById("task-form");

    if (newTaskBtn) {
      newTaskBtn.addEventListener("click", () => openTaskModal());
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => taskModal.classList.add("hidden"));
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => taskModal.classList.add("hidden"));
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        saveFormValue();
      });
    }

    // Filter Chips
    const filters = document.querySelectorAll(".filter-chip");
    filters.forEach(chip => {
      chip.addEventListener("click", (e) => {
        filters.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentFilter = chip.getAttribute("data-filter");
        renderTaskList();
      });
    });
  }

  function populateTimeblockDropdown() {
    const picker = document.getElementById("task-timeblock-input");
    if (!picker) return;

    // Reset dropdown
    picker.innerHTML = `<option value="">-- Don't schedule yet --</option>`;
    
    plannerHours.forEach(hour => {
      const option = document.createElement("option");
      option.value = hour.val;
      option.textContent = hour.label;
      picker.appendChild(option);
    });
  }

  function renderHoursGrid() {
    const container = document.getElementById("schedule-hours");
    if (!container) return;

    container.innerHTML = plannerHours.map(hour => {
      // Find task scheduled in this timeblock
      const taskInHour = tasks.find(t => t.timeblock === hour.val && t.status !== "done");

      let slotContent = `<span class="text-muted text-sm italic">Free Slot</span>`;
      if (taskInHour) {
        slotContent = `
          <div class="scheduled-task-pill priority-${taskInHour.priority}">
            <span class="scheduled-task-title" title="${taskInHour.title}">
              <span class="badge-priority-${taskInHour.priority} mr-2 text-xs" style="padding: 1px 4px; border-radius: 4px; font-weight: bold;">
                ${taskInHour.priority}
              </span>
              ${taskInHour.title}
            </span>
            <button class="unschedule-btn" data-task-id="${taskInHour.id}" title="Unschedule Task">
              <i data-lucide="x"></i>
            </button>
          </div>
        `;
      }

      return `
        <div class="schedule-hour-row">
          <div class="hour-label">${hour.label}</div>
          <div class="schedule-dropzone" data-hour="${hour.val}">
            ${slotContent}
          </div>
        </div>
      `;
    }).join("");

    lucide.createIcons();

    // Hook unschedule click actions
    container.querySelectorAll(".unschedule-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute("data-task-id");
        unscheduleTask(taskId);
      });
    });
  }

  function unscheduleTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.timeblock = "";
      saveTasks();
      renderHoursGrid();
      renderTaskList();
      window.StudyApp.notifications?.showToast("Task removed from daily schedule.", "info");
    }
  }

  function renderTaskList() {
    const container = document.getElementById("tasks-list");
    if (!container) return;

    // Filter
    let filtered = tasks;
    if (currentFilter === "todo") {
      filtered = tasks.filter(t => t.status === "todo");
    } else if (currentFilter === "in_progress") {
      filtered = tasks.filter(t => t.status === "in_progress");
    } else if (currentFilter === "done") {
      filtered = tasks.filter(t => t.status === "done");
    }

    // Sort: incomplete first, high priority first
    filtered.sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      
      const priorityWeight = { "High": 3, "Medium": 2, "Low": 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="text-muted text-sm text-center py-4">No tasks found in this section.</div>`;
      return;
    }

    container.innerHTML = filtered.map(task => {
      const isCompleted = task.status === "done";
      
      // Determine category icon class
      let catIcon = "book-open";
      if (task.category === "Coding") catIcon = "code";
      if (task.category === "Reading") catIcon = "book";
      if (task.category === "Language") catIcon = "languages";
      if (task.category === "Other") catIcon = "clipboard-list";

      // Scheduled marker
      const scheduledLabel = task.timeblock 
        ? plannerHours.find(h => h.val === task.timeblock)?.label 
        : "";

      return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" id="task-item-${task.id}">
          <div class="task-check-wrapper">
            <div class="task-checkbox ${isCompleted ? 'checked' : ''}" data-id="${task.id}" title="Toggle Complete">
              ${isCompleted ? '<i data-lucide="check"></i>' : ''}
            </div>
          </div>
          
          <div class="task-item-content">
            <div class="task-item-header">
              <span class="task-item-title">${task.title}</span>
              <span class="priority-badge badge-priority-${task.priority}">${task.priority}</span>
            </div>
            
            ${task.description ? `<p class="task-item-desc">${task.description}</p>` : ''}
            
            <div class="task-item-footer">
              <div class="task-meta-item" title="Category: ${task.category}">
                <i data-lucide="${catIcon}"></i>
                <span>${task.category}</span>
              </div>
              ${task.dueDate ? `
                <div class="task-meta-item" title="Due Date">
                  <i data-lucide="clock"></i>
                  <span>${task.dueDate}</span>
                </div>
              ` : ''}
              ${scheduledLabel ? `
                <div class="task-meta-item text-secondary" style="color: var(--accent-secondary);" title="Scheduled Block">
                  <i data-lucide="calendar-check"></i>
                  <span>${scheduledLabel}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="task-item-actions">
            ${!isCompleted ? `
              <button class="task-action-btn btn-focus" data-id="${task.id}" title="Focus on Task in Pomodoro">
                <i data-lucide="play-circle"></i>
              </button>
            ` : ''}
            <button class="task-action-btn btn-edit" data-id="${task.id}" title="Edit Task">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="task-action-btn btn-delete" data-id="${task.id}" title="Delete Task">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");

    lucide.createIcons();

    // Hook listeners
    container.querySelectorAll(".task-checkbox").forEach(box => {
      box.addEventListener("click", () => {
        const id = box.getAttribute("data-id");
        toggleComplete(id);
      });
    });

    container.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        deleteTask(id);
      });
    });

    container.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openTaskModal(id);
      });
    });

    container.querySelectorAll(".btn-focus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        focusTaskInPomodoro(id);
      });
    });
  }

  function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status === "done") {
      task.status = "todo";
      saveTasks();
      window.StudyApp.notifications?.showToast("Task marked as incomplete.", "info");
    } else {
      task.status = "done";
      saveTasks();
      // Award XP
      window.StudyApp.awardXP?.(20);
      window.StudyApp.notifications?.showToast("Task completed! +20 XP awarded.", "success");
    }

    renderTaskList();
    renderHoursGrid();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTaskList();
    renderHoursGrid();
    window.StudyApp.notifications?.showToast("Task deleted.", "info");
  }

  function openTaskModal(editId = null) {
    const modal = document.getElementById("task-modal");
    const titleEl = document.getElementById("task-modal-title");
    const form = document.getElementById("task-form");
    
    // Clear form
    form.reset();
    document.getElementById("task-id").value = "";

    if (editId) {
      const task = tasks.find(t => t.id === editId);
      if (task) {
        titleEl.textContent = "Edit Task";
        document.getElementById("task-id").value = task.id;
        document.getElementById("task-title-input").value = task.title;
        document.getElementById("task-category-input").value = task.category;
        document.getElementById("task-priority-input").value = task.priority;
        document.getElementById("task-duedate-input").value = task.dueDate || "";
        document.getElementById("task-timeblock-input").value = task.timeblock || "";
        document.getElementById("task-desc-input").value = task.description || "";
      }
    } else {
      titleEl.textContent = "Create New Task";
    }

    modal.classList.remove("hidden");
  }

  function saveFormValue() {
    const id = document.getElementById("task-id").value;
    const title = document.getElementById("task-title-input").value;
    const category = document.getElementById("task-category-input").value;
    const priority = document.getElementById("task-priority-input").value;
    const dueDate = document.getElementById("task-duedate-input").value;
    const timeblock = document.getElementById("task-timeblock-input").value;
    const description = document.getElementById("task-desc-input").value;

    // Check if timeblock is already occupied
    if (timeblock) {
      const occupied = tasks.find(t => t.timeblock === timeblock && t.id !== id && t.status !== "done");
      if (occupied) {
        window.StudyApp.notifications?.showToast(`This hour block is already occupied by: "${occupied.title}"`, "error");
        return;
      }
    }

    if (id) {
      // Edit
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.title = title;
        task.category = category;
        task.priority = priority;
        task.dueDate = dueDate;
        task.timeblock = timeblock;
        task.description = description;
        window.StudyApp.notifications?.showToast("Task updated.", "success");
      }
    } else {
      // Add
      const newTask = {
        id: "task-" + Date.now(),
        title,
        category,
        priority,
        dueDate,
        timeblock,
        description,
        status: "todo"
      };
      tasks.push(newTask);
      window.StudyApp.notifications?.showToast("Task created.", "success");
    }

    saveTasks();
    renderTaskList();
    renderHoursGrid();
    
    document.getElementById("task-modal").classList.add("hidden");
  }

  function focusTaskInPomodoro(id) {
    // Navigate tab
    const tabLink = document.querySelector(`.nav-link[data-tab="pomodoro"]`);
    if (tabLink) {
      tabLink.click();
    }
    
    // Select task in Pomodoro picker
    setTimeout(() => {
      const select = document.getElementById("pomodoro-task-picker");
      if (select) {
        select.value = id;
        // Trigger select change event programmatically
        select.dispatchEvent(new Event("change"));
      }
    }, 100);
  }

  function getActiveTasks() {
    return tasks.filter(t => t.status !== "done");
  }

  return {
    init,
    getActiveTasks,
    renderTaskList,
    renderHoursGrid
  };
})();
