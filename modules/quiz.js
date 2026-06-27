/* ==========================================================================
   AetherStudy — Quiz Maker & Active Recall Scheduler Module
   ========================================================================== */

window.StudyApp = window.StudyApp || {};

window.StudyApp.quiz = (function() {
  let quizzes = [];
  let recallTimerId = null;
  let nextRecallTime = 0;
  
  // Current active runner state
  let runner = {
    quizId: "",
    questions: [],
    currentIndex: 0,
    answers: [],
    correctCount: 0
  };

  // Active recall popup state
  let activeRecallQuestion = null;
  let activeRecallSelectedOption = null;

  function init() {
    loadQuizzes();
    setupEventListeners();
    renderQuizList();
    scheduleNextRecall();
  }

  function loadQuizzes() {
    const saved = localStorage.getItem("aetherstudy_quizzes");
    if (saved) {
      try {
        quizzes = JSON.parse(saved);
      } catch (e) {
        quizzes = [];
      }
    } else {
      // Seed pre-loaded general quiz
      quizzes = [
        {
          id: "quiz-seed-1",
          title: "Biology & General Science Quiz",
          description: "Test basic focus recall on cell structures and physics constants.",
          questions: [
            {
              id: "q-1",
              text: "Which organelle is commonly known as the powerhouse of the cell?",
              type: "mcq",
              options: ["Nucleus", "Ribosome", "Mitochondria", "Lysosome"],
              correctIndex: 2
            },
            {
              id: "q-2",
              text: "What is the chemical symbol for Gold?",
              type: "text",
              answer: "Au"
            },
            {
              id: "q-3",
              text: "Approximately how long does it take for light from the Sun to reach Earth?",
              type: "mcq",
              options: ["8 seconds", "8 minutes", "8 hours", "8 days"],
              correctIndex: 1
            }
          ]
        }
      ];
      saveQuizzes();
    }
  }

  function saveQuizzes() {
    localStorage.setItem("aetherstudy_quizzes", JSON.stringify(quizzes));
    syncRecallPool();
  }

  function setupEventListeners() {
    // Quiz Creation Modals
    const createQuizBtn = document.getElementById("create-quiz-btn");
    const quizModal = document.getElementById("quiz-modal");
    const quizClose = document.getElementById("quiz-modal-close");
    const quizCancel = document.getElementById("quiz-cancel-btn");
    const quizForm = document.getElementById("quiz-form");

    if (createQuizBtn) {
      createQuizBtn.addEventListener("click", () => {
        quizForm.reset();
        quizModal.classList.remove("hidden");
      });
    }

    if (quizClose) quizClose.addEventListener("click", () => quizModal.classList.add("hidden"));
    if (quizCancel) quizCancel.addEventListener("click", () => quizModal.classList.add("hidden"));
    if (quizForm) {
      quizForm.addEventListener("submit", (e) => {
        e.preventDefault();
        saveQuizForm();
      });
    }

    // Question Creation Modals
    const qModal = document.getElementById("quiz-q-modal");
    const qClose = document.getElementById("quiz-q-modal-close");
    const qCancel = document.getElementById("quiz-q-cancel-btn");
    const qForm = document.getElementById("quiz-q-form");
    const qTypeSelect = document.getElementById("quiz-q-type");

    if (qClose) qClose.addEventListener("click", () => qModal.classList.add("hidden"));
    if (qCancel) qCancel.addEventListener("click", () => qModal.classList.add("hidden"));
    
    if (qTypeSelect) {
      qTypeSelect.addEventListener("change", (e) => {
        const mcqContainer = document.getElementById("mcq-options-container");
        const textContainer = document.getElementById("short-answer-container");
        
        if (e.target.value === "mcq") {
          mcqContainer.classList.remove("hidden");
          textContainer.classList.add("hidden");
          
          // Make mcq options required
          mcqContainer.querySelectorAll(".mcq-opt-input").forEach((opt, idx) => {
            if (idx < 2) opt.setAttribute("required", "required");
          });
          document.getElementById("quiz-q-answer").removeAttribute("required");
        } else {
          mcqContainer.classList.add("hidden");
          textContainer.classList.remove("hidden");
          
          mcqContainer.querySelectorAll(".mcq-opt-input").forEach(opt => opt.removeAttribute("required"));
          document.getElementById("quiz-q-answer").setAttribute("required", "required");
        }
      });
    }

    if (qForm) {
      qForm.addEventListener("submit", (e) => {
        e.preventDefault();
        saveQuestionForm();
      });
    }

    // Quiz Runner Closer
    const runClose = document.getElementById("run-quiz-close");
    if (runClose) {
      runClose.addEventListener("click", () => {
        const conf = confirm("Exit quiz now? Your progress will be lost.");
        if (conf) {
          document.getElementById("run-quiz-modal").classList.add("hidden");
        }
      });
    }

    // Active Recall Popups Event triggers
    const recallEnableToggle = document.getElementById("recall-enable-toggle");
    const recallSlider = document.getElementById("recall-interval-slider");
    const recallSliderVal = document.getElementById("recall-interval-val");

    if (recallEnableToggle) {
      recallEnableToggle.addEventListener("change", (e) => {
        const indicator = document.getElementById("recall-status-indicator");
        if (e.target.checked) {
          indicator.classList.remove("inactive");
          indicator.classList.add("indicator-active");
          indicator.querySelector(".status-text").textContent = "Recall Active";
          scheduleNextRecall();
          window.StudyApp.notifications?.showToast("Active Recall popup notifications enabled.", "info");
        } else {
          indicator.classList.add("inactive");
          indicator.classList.remove("indicator-active");
          indicator.querySelector(".status-text").textContent = "Recall Paused";
          clearTimeout(recallTimerId);
          recallTimerId = null;
          window.StudyApp.notifications?.showToast("Active Recall popup notifications disabled.", "info");
        }
      });
    }

    if (recallSlider) {
      recallSlider.addEventListener("input", (e) => {
        if (recallSliderVal) {
          const val = e.target.value;
          recallSliderVal.textContent = val === "1" ? "1 minute" : `${val} minutes`;
        }
      });
      recallSlider.addEventListener("change", () => {
        if (recallEnableToggle && recallEnableToggle.checked) {
          scheduleNextRecall();
        }
      });
    }

    // Recall Submission Modals
    const recallSubmit = document.getElementById("recall-submit-btn");
    const recallSkip = document.getElementById("recall-skip-btn");

    if (recallSubmit) {
      recallSubmit.addEventListener("click", () => evaluateActiveRecallAnswer());
    }

    if (recallSkip) {
      recallSkip.addEventListener("click", () => {
        document.getElementById("active-recall-modal").classList.add("hidden");
        window.StudyApp.notifications?.showToast("Recall prompt skipped.", "info");
        scheduleNextRecall();
      });
    }
  }

  function saveQuizForm() {
    const title = document.getElementById("quiz-title-input").value;
    const desc = document.getElementById("quiz-desc-input").value;

    const newQuiz = {
      id: "quiz-" + Date.now(),
      title,
      description: desc || "No description provided.",
      questions: []
    };

    quizzes.push(newQuiz);
    saveQuizzes();
    renderQuizList();
    
    document.getElementById("quiz-modal").classList.add("hidden");
    window.StudyApp.notifications?.showToast("Quiz bank created.", "success");
  }

  function saveQuestionForm() {
    const parentId = document.getElementById("quiz-q-parent-id").value;
    const qText = document.getElementById("quiz-q-text").value;
    const qType = document.getElementById("quiz-q-type").value;

    const quiz = quizzes.find(q => q.id === parentId);
    if (!quiz) return;

    let questionData = {
      id: "q-" + Date.now(),
      text: qText,
      type: qType
    };

    if (qType === "mcq") {
      const optionRows = document.querySelectorAll(".mcq-opt-input");
      let options = [];
      optionRows.forEach(input => {
        if (input.value.trim() !== "") {
          options.push(input.value.trim());
        }
      });

      if (options.length < 2) {
        window.StudyApp.notifications?.showToast("MCQ questions require at least 2 options.", "error");
        return;
      }

      const radioButtons = document.getElementsByName("correct-option");
      let correctIdx = 0;
      for (let i = 0; i < radioButtons.length; i++) {
        if (radioButtons[i].checked) {
          correctIdx = i;
          break;
        }
      }

      // Check if chosen radio index matches an actual input value
      if (correctIdx >= options.length) {
        window.StudyApp.notifications?.showToast("Correct answer option cannot be empty.", "error");
        return;
      }

      questionData.options = options;
      questionData.correctIndex = correctIdx;
    } else {
      const answerVal = document.getElementById("quiz-q-answer").value.trim();
      questionData.answer = answerVal;
    }

    quiz.questions.push(questionData);
    saveQuizzes();
    renderQuizList();

    document.getElementById("quiz-q-modal").classList.add("hidden");
    window.StudyApp.notifications?.showToast("Question added to quiz.", "success");
  }

  function renderQuizList() {
    const container = document.getElementById("quiz-list-container");
    if (!container) return;

    if (quizzes.length === 0) {
      container.innerHTML = `<div class="text-muted text-sm text-center py-4">No quizzes created yet. Make one to test your recall!</div>`;
      return;
    }

    container.innerHTML = quizzes.map(quiz => {
      const qCount = quiz.questions.length;
      return `
        <div class="quiz-bank-item">
          <div class="quiz-bank-info">
            <h4>${quiz.title}</h4>
            <p>${quiz.description}</p>
            <span class="text-xs text-muted" style="display:block; margin-top: 4px;">${qCount} Questions</span>
          </div>
          <div class="quiz-bank-actions">
            ${qCount > 0 ? `
              <button class="btn btn-success btn-sm btn-run-quiz" data-id="${quiz.id}" title="Take Quiz">
                <i data-lucide="play"></i> Take Test
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm btn-add-q" data-id="${quiz.id}" title="Add Question">
              <i data-lucide="plus"></i> Add Q
            </button>
            <button class="task-action-btn btn-delete btn-delete-quiz" data-id="${quiz.id}" title="Delete Quiz" style="padding: 8px;">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");

    lucide.createIcons();

    // Hook listeners
    container.querySelectorAll(".btn-delete-quiz").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        deleteQuiz(id);
      });
    });

    container.querySelectorAll(".btn-add-q").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openQuestionModal(id);
      });
    });

    container.querySelectorAll(".btn-run-quiz").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        startQuizRunner(id);
      });
    });
  }

  function deleteQuiz(id) {
    const confirmDel = confirm("Are you sure you want to delete this quiz bank and all its questions?");
    if (confirmDel) {
      quizzes = quizzes.filter(q => q.id !== id);
      saveQuizzes();
      renderQuizList();
      window.StudyApp.notifications?.showToast("Quiz bank deleted.", "info");
    }
  }

  function openQuestionModal(quizId) {
    const modal = document.getElementById("quiz-q-modal");
    const form = document.getElementById("quiz-q-form");
    form.reset();
    
    // Default show MCQ container
    document.getElementById("mcq-options-container").classList.remove("hidden");
    document.getElementById("short-answer-container").classList.add("hidden");
    document.getElementById("quiz-q-type").value = "mcq";

    document.getElementById("quiz-q-parent-id").value = quizId;
    modal.classList.remove("hidden");
  }

  /* ==========================================================================
     QUIZ TEST RUNNER ENGINE
     ========================================================================== */
  function startQuizRunner(quizId) {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz || quiz.questions.length === 0) return;

    runner.quizId = quizId;
    runner.questions = [...quiz.questions];
    
    // Shuffle questions for authentic practice recall
    runner.questions.sort(() => Math.random() - 0.5);
    
    runner.currentIndex = 0;
    runner.answers = [];
    runner.correctCount = 0;

    document.getElementById("run-quiz-title").textContent = quiz.title;
    document.getElementById("run-quiz-modal").classList.remove("hidden");

    renderRunnerQuestion();
  }

  function renderRunnerQuestion() {
    const container = document.getElementById("run-quiz-body");
    if (!container) return;

    const q = runner.questions[runner.currentIndex];
    const total = runner.questions.length;

    let optionsMarkup = "";
    if (q.type === "mcq") {
      optionsMarkup = `
        <div class="active-recall-options mt-3">
          ${q.options.map((opt, idx) => `
            <div class="active-recall-opt-row runner-opt" data-index="${idx}">
              <input type="radio" name="runner-q-opt" id="opt-${idx}" value="${idx}">
              <label for="opt-${idx}" class="active-recall-opt-text">${opt}</label>
            </div>
          `).join("")}
        </div>
      `;
    } else {
      optionsMarkup = `
        <div class="form-group mt-3">
          <input type="text" id="runner-text-answer" class="form-control" placeholder="Write correct answer here..." required autocomplete="off">
        </div>
      `;
    }

    container.innerHTML = `
      <div class="study-progress-wrapper" style="margin-bottom: 20px;">
        <div class="study-progress-text">Question ${runner.currentIndex + 1} of ${total}</div>
        <div class="study-progress-bar">
          <div class="study-progress-fill" style="width: ${((runner.currentIndex + 1) / total) * 100}%"></div>
        </div>
      </div>
      
      <p class="prompt-card-question" style="font-size:1.15rem; font-weight:600; margin-bottom: 16px;">${q.text}</p>
      
      ${optionsMarkup}
      
      <div class="modal-footer" style="margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--glass-border);">
        <button id="runner-next-btn" class="btn btn-primary">Submit Answer</button>
      </div>
    `;

    lucide.createIcons();

    // MCQ option row highlighting click bindings
    if (q.type === "mcq") {
      const rows = container.querySelectorAll(".runner-opt");
      rows.forEach(row => {
        row.addEventListener("click", () => {
          rows.forEach(r => r.classList.remove("selected"));
          row.classList.add("selected");
          row.querySelector("input").checked = true;
        });
      });
    }

    // Bind next button submit click
    document.getElementById("runner-next-btn").addEventListener("click", () => evaluateRunnerAnswer());
  }

  function evaluateRunnerAnswer() {
    const q = runner.questions[runner.currentIndex];
    let isCorrect = false;
    let userAnsLabel = "";

    if (q.type === "mcq") {
      const radios = document.getElementsByName("runner-q-opt");
      let selectedIdx = -1;
      for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
          selectedIdx = i;
          break;
        }
      }

      if (selectedIdx === -1) {
        window.StudyApp.notifications?.showToast("Please select an option.", "error");
        return;
      }

      isCorrect = (selectedIdx === q.correctIndex);
      userAnsLabel = q.options[selectedIdx];
    } else {
      const textVal = document.getElementById("runner-text-answer").value.trim();
      if (textVal === "") {
        window.StudyApp.notifications?.showToast("Please type an answer.", "error");
        return;
      }

      isCorrect = (textVal.toLowerCase() === q.answer.toLowerCase());
      userAnsLabel = textVal;
    }

    runner.answers.push({
      question: q.text,
      userAnswer: userAnsLabel,
      correctAnswer: q.type === "mcq" ? q.options[q.correctIndex] : q.answer,
      isCorrect: isCorrect
    });

    if (isCorrect) {
      runner.correctCount++;
      window.StudyApp.notifications?.showToast("Correct! Keep going.", "success");
    } else {
      window.StudyApp.notifications?.showToast("Incorrect answer.", "error");
    }

    // Move to next question or display scoreboard
    setTimeout(() => {
      runner.currentIndex++;
      if (runner.currentIndex < runner.questions.length) {
        renderRunnerQuestion();
      } else {
        renderQuizRunnerScoreboard();
      }
    }, 600);
  }

  function renderQuizRunnerScoreboard() {
    const container = document.getElementById("run-quiz-body");
    if (!container) return;

    const total = runner.questions.length;
    const scorePct = Math.round((runner.correctCount / total) * 100);
    const pass = scorePct >= 80;
    
    // Calculate XP: +3 XP per correct answer, +20 XP bonus if passed (>=80%)
    const pointsGained = (runner.correctCount * 3) + (pass ? 20 : 0);
    window.StudyApp.awardXP?.(pointsGained);

    container.innerHTML = `
      <div style="text-align: center; padding: 20px 0;">
        <i data-lucide="${pass ? 'award' : 'alert-circle'}" style="width: 64px; height: 64px; color: ${pass ? 'var(--accent-warning)' : 'var(--text-muted)'}; margin-bottom: 16px;"></i>
        <h3 style="font-size: 1.6rem; margin-bottom: 8px;">Quiz Completed!</h3>
        <p class="text-muted" style="margin-bottom: 24px;">You scored ${runner.correctCount} out of ${total} (${scorePct}%)</p>
        
        <div class="xp-banner glass-card" style="margin-bottom: 24px; text-align: left;">
          <div class="xp-banner-header">
            <i data-lucide="zap" class="xp-gold"></i>
            <h5>XP Rewards Received</h5>
          </div>
          <p class="text-sm">Correct answers (${runner.correctCount} x 3): <strong>+${runner.correctCount * 3} XP</strong></p>
          ${pass ? `<p class="text-sm">Pass Bonus (>80% score): <strong>+20 XP</strong></p>` : ''}
          <p class="text-sm" style="border-top:1px solid rgba(255,255,255,0.05); padding-top:6px; margin-top:6px; font-weight:bold; color:var(--accent-secondary);">
            Total gained: +${pointsGained} XP
          </p>
        </div>

        <div style="max-height: 200px; overflow-y: auto; text-align: left; padding: 12px; background: rgba(0,0,0,0.15); border-radius:10px; margin-bottom: 24px; border:1px solid var(--glass-border);">
          <h5 style="margin-bottom: 8px; font-weight:600;">Question Breakdown:</h5>
          ${runner.answers.map((ans, idx) => `
            <div style="margin-bottom: 8px; font-size: 0.8rem; line-height:1.4;">
              <strong>Q${idx + 1}: ${ans.question}</strong><br>
              Your Answer: <span style="color: ${ans.isCorrect ? 'var(--accent-success)' : 'var(--accent-danger)'}">${ans.userAnswer}</span> 
              ${!ans.isCorrect ? `<br><span class="text-muted">Correct: ${ans.correctAnswer}</span>` : ''}
            </div>
          `).join("")}
        </div>

        <button id="runner-done-btn" class="btn btn-primary" style="width: 100%;">Done</button>
      </div>
    `;

    lucide.createIcons();

    document.getElementById("runner-done-btn").addEventListener("click", () => {
      document.getElementById("run-quiz-modal").classList.add("hidden");
    });
  }

  /* ==========================================================================
     ACTIVE RECALL POPUP CONTROLLER
     ========================================================================== */
  let recallPool = [];

  function syncRecallPool() {
    recallPool = [];
    
    // 1. Fetch Quiz questions
    quizzes.forEach(quiz => {
      quiz.questions.forEach(q => {
        recallPool.push({
          id: q.id,
          text: q.text,
          type: q.type,
          options: q.options || null,
          correctIndex: q.correctIndex !== undefined ? q.correctIndex : null,
          answer: q.answer || null,
          sourceName: quiz.title
        });
      });
    });

    // 2. Fetch Flashcards (transforming flashcard front/back into recall short answers)
    const flashcards = window.StudyApp.flashcards?.getAllCardsPool() || [];
    flashcards.forEach(card => {
      recallPool.push({
        id: card.id,
        text: card.question,
        type: "text", // Treated as a short text response
        answer: card.answer,
        sourceName: `Flashcard Deck: ${card.deckTitle}`
      });
    });
  }

  function scheduleNextRecall() {
    if (recallTimerId) {
      clearTimeout(recallTimerId);
      recallTimerId = null;
    }

    const toggle = document.getElementById("recall-enable-toggle");
    if (!toggle || !toggle.checked) return;

    const intervalMinutes = parseInt(document.getElementById("recall-interval-slider").value) || 15;
    
    // Scale down: Convert minutes to milliseconds. 
    // Wait, for quick verification/testing, if interval is 1 min, let's schedule in 1 minute.
    const intervalMs = intervalMinutes * 60 * 1000;
    
    nextRecallTime = Date.now() + intervalMs;
    
    recallTimerId = setTimeout(() => {
      triggerActiveRecallPrompt();
    }, intervalMs);
  }

  function triggerActiveRecallPrompt() {
    syncRecallPool();
    
    const sourceSelect = document.getElementById("recall-source-select")?.value || "all";
    let filteredPool = recallPool;

    if (sourceSelect === "flashcards") {
      filteredPool = recallPool.filter(item => item.sourceName.includes("Flashcard"));
    } else if (sourceSelect === "quizzes") {
      filteredPool = recallPool.filter(item => !item.sourceName.includes("Flashcard"));
    }

    if (filteredPool.length === 0) {
      // Re-schedule and exit if pool is empty
      scheduleNextRecall();
      return;
    }

    // Pick random question
    const randomIndex = Math.floor(Math.random() * filteredPool.length);
    activeRecallQuestion = filteredPool[randomIndex];
    
    const modal = document.getElementById("active-recall-modal");
    const container = document.getElementById("active-recall-body");

    let optionsMarkup = "";
    if (activeRecallQuestion.type === "mcq") {
      optionsMarkup = `
        <div class="active-recall-options mt-3">
          ${activeRecallQuestion.options.map((opt, idx) => `
            <div class="active-recall-opt-row recall-opt" data-index="${idx}">
              <input type="radio" name="recall-q-opt" id="recall-opt-${idx}" value="${idx}">
              <label for="recall-opt-${idx}" class="active-recall-opt-text">${opt}</label>
            </div>
          `).join("")}
        </div>
      `;
    } else {
      optionsMarkup = `
        <div class="form-group mt-3">
          <input type="text" id="recall-text-answer" class="form-control" placeholder="Type answer here..." required autocomplete="off">
        </div>
      `;
    }

    container.innerHTML = `
      <div style="font-size:0.75rem; color:var(--accent-secondary); font-weight:bold; margin-bottom: 6px; text-transform:uppercase;">
        Source: ${activeRecallQuestion.sourceName}
      </div>
      <p class="prompt-card-question">${activeRecallQuestion.text}</p>
      ${optionsMarkup}
    `;

    lucide.createIcons();

    // MCQ option row highlight binds
    if (activeRecallQuestion.type === "mcq") {
      activeRecallSelectedOption = null;
      const rows = container.querySelectorAll(".recall-opt");
      rows.forEach(row => {
        row.addEventListener("click", () => {
          rows.forEach(r => r.classList.remove("selected"));
          row.classList.add("selected");
          row.querySelector("input").checked = true;
          activeRecallSelectedOption = parseInt(row.getAttribute("data-index"));
        });
      });
    }

    // Alert chime sound
    window.StudyApp.notifications?.playChime();

    // Show modal
    modal.classList.remove("hidden");
  }

  function evaluateActiveRecallAnswer() {
    if (!activeRecallQuestion) return;

    let isCorrect = false;
    let correctAnswerText = "";

    if (activeRecallQuestion.type === "mcq") {
      if (activeRecallSelectedOption === null) {
        window.StudyApp.notifications?.showToast("Please choose an answer option.", "error");
        return;
      }
      isCorrect = (activeRecallSelectedOption === activeRecallQuestion.correctIndex);
      correctAnswerText = activeRecallQuestion.options[activeRecallQuestion.correctIndex];
    } else {
      const textVal = document.getElementById("recall-text-answer")?.value.trim() || "";
      if (textVal === "") {
        window.StudyApp.notifications?.showToast("Please type an answer.", "error");
        return;
      }
      
      // Flashcards or Short Quizzes validation (containment or exact match)
      const targetAns = activeRecallQuestion.answer.toLowerCase();
      const userAns = textVal.toLowerCase();
      
      // Flexible matching for flashcard answer strings, exact matching for quizzes
      if (activeRecallQuestion.sourceName.includes("Flashcard")) {
        // Flashcard answers can be verbose, checking if keywords match or simple string containments
        isCorrect = targetAns.includes(userAns) || userAns.includes(targetAns) || (userAns.length > 3 && targetAns.includes(userAns.substring(0, 4)));
      } else {
        isCorrect = (userAns === targetAns);
      }
      correctAnswerText = activeRecallQuestion.answer;
    }

    document.getElementById("active-recall-modal").classList.add("hidden");

    if (isCorrect) {
      window.StudyApp.awardXP?.(15); // +15 XP for correct active recall
      window.StudyApp.notifications?.showToast("Active Recall successful! +15 XP.", "success");
    } else {
      // Alert correct answer
      alert(`Recall failed.\n\nQuestion: ${activeRecallQuestion.text}\n\nCorrect Answer: ${correctAnswerText}`);
      window.StudyApp.notifications?.showToast("Incorrect recall. Review cards later.", "error");
    }

    activeRecallQuestion = null;
    activeRecallSelectedOption = null;

    // Reschedule
    scheduleNextRecall();
  }

  return {
    init,
    syncRecallPool,
    scheduleNextRecall
  };
})();
