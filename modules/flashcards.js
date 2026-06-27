/* ==========================================================================
   AetherStudy — Spaced-Repetition Flashcards Module
   ========================================================================== */

window.StudyApp = window.StudyApp || {};

window.StudyApp.flashcards = (function() {
  let decks = [];
  let activeDeckId = "";
  let activeCardIndex = 0;

  function init() {
    loadDecks();
    setupEventListeners();
    renderDecksGrid();
  }

  function loadDecks() {
    const saved = localStorage.getItem("aetherstudy_decks");
    if (saved) {
      try {
        decks = JSON.parse(saved);
      } catch (e) {
        decks = [];
      }
    } else {
      // Seed pre-loaded deck
      decks = [
        {
          id: "deck-seed-1",
          title: "Cognitive Science & Memory Tips",
          description: "Core concepts of spaced repetition, active recall, and study hacks.",
          cards: [
            {
              id: "card-1",
              front: "What is Active Recall?",
              back: "Retrieving information from memory by testing yourself, which strengthens neural connections, rather than passively re-reading.",
              mastered: false
            },
            {
              id: "card-2",
              front: "Explain Spaced Repetition.",
              back: "Reviewing information at increasing intervals (e.g. 1 day, 3 days, 7 days) to exploit the psychological spacing effect.",
              mastered: false
            },
            {
              id: "card-3",
              front: "How do you earn Level XP in AetherStudy?",
              back: "Finish Pomodoro focus sessions (+15 XP), check off planner tasks (+20 XP), and answer active recall popups (+15 XP).",
              mastered: false
            }
          ]
        }
      ];
      saveDecks();
    }
  }

  function saveDecks() {
    localStorage.setItem("aetherstudy_decks", JSON.stringify(decks));
    // Dynamic refresh pool in Quiz module
    window.StudyApp.quiz?.syncRecallPool();
  }

  function setupEventListeners() {
    // Deck creation modal controls
    const createDeckBtn = document.getElementById("create-deck-btn");
    const deckModal = document.getElementById("deck-modal");
    const deckCloseBtn = document.getElementById("deck-modal-close");
    const deckCancelBtn = document.getElementById("deck-cancel-btn");
    const deckForm = document.getElementById("deck-form");

    if (createDeckBtn) {
      createDeckBtn.addEventListener("click", () => {
        deckForm.reset();
        deckModal.classList.remove("hidden");
      });
    }

    if (deckCloseBtn) {
      deckCloseBtn.addEventListener("click", () => deckModal.classList.add("hidden"));
    }
    
    if (deckCancelBtn) {
      deckCancelBtn.addEventListener("click", () => deckModal.classList.add("hidden"));
    }

    if (deckForm) {
      deckForm.addEventListener("submit", (e) => {
        e.preventDefault();
        saveDeckForm();
      });
    }

    // Card creation modal controls
    const addCardBtn = document.getElementById("add-card-to-deck-btn");
    const cardModal = document.getElementById("card-modal");
    const cardCloseBtn = document.getElementById("card-modal-close");
    const cardCancelBtn = document.getElementById("card-cancel-btn");
    const cardForm = document.getElementById("card-form");

    if (addCardBtn) {
      addCardBtn.addEventListener("click", () => {
        cardForm.reset();
        document.getElementById("card-deck-id").value = activeDeckId;
        cardModal.classList.remove("hidden");
      });
    }

    if (cardCloseBtn) {
      cardCloseBtn.addEventListener("click", () => cardModal.classList.add("hidden"));
    }
    
    if (cardCancelBtn) {
      cardCancelBtn.addEventListener("click", () => cardModal.classList.add("hidden"));
    }

    if (cardForm) {
      cardForm.addEventListener("submit", (e) => {
        e.preventDefault();
        saveCardForm();
      });
    }

    // Study card session events
    const cardContainer = document.getElementById("study-card-container");
    if (cardContainer) {
      cardContainer.addEventListener("click", () => {
        cardContainer.classList.toggle("flipped");
        window.StudyApp.notifications?.playBeep(); // dynamic feedback
      });
    }

    // Back to decks list
    const backBtn = document.getElementById("study-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        document.getElementById("deck-study-container").classList.add("hidden");
        document.getElementById("deck-list-container").classList.remove("hidden");
        renderDecksGrid();
      });
    }

    // Navigation buttons
    const prevBtn = document.getElementById("study-prev-btn");
    const nextBtn = document.getElementById("study-next-btn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => changeCard(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => changeCard(1));
    }

    // Grade Buttons
    const gradeHard = document.getElementById("grade-hard-btn");
    const gradeEasy = document.getElementById("grade-easy-btn");

    if (gradeHard) {
      gradeHard.addEventListener("click", () => handleGradeCard(false));
    }
    if (gradeEasy) {
      gradeEasy.addEventListener("click", () => handleGradeCard(true));
    }
  }

  function saveDeckForm() {
    const title = document.getElementById("deck-title-input").value;
    const desc = document.getElementById("deck-desc-input").value;

    const newDeck = {
      id: "deck-" + Date.now(),
      title,
      description: desc || "No description provided.",
      cards: []
    };

    decks.push(newDeck);
    saveDecks();
    renderDecksGrid();
    
    document.getElementById("deck-modal").classList.add("hidden");
    window.StudyApp.notifications?.showToast("Flashcard deck created.", "success");
  }

  function saveCardForm() {
    const deckId = document.getElementById("card-deck-id").value;
    const front = document.getElementById("card-front-input").value;
    const back = document.getElementById("card-back-input").value;

    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      const newCard = {
        id: "card-" + Date.now(),
        front,
        back,
        mastered: false
      };
      deck.cards.push(newCard);
      saveDecks();
      
      document.getElementById("card-modal").classList.add("hidden");
      window.StudyApp.notifications?.showToast("Card added to deck.", "success");
      
      // If currently studying that deck, refresh study display
      if (activeDeckId === deckId) {
        startStudyDeck(deckId);
      }
    }
  }

  function renderDecksGrid() {
    const grid = document.getElementById("decks-grid");
    if (!grid) return;

    if (decks.length === 0) {
      grid.innerHTML = `<div class="text-muted text-sm text-center py-4 w-100" style="grid-column: span 3;">No decks created yet. Add one to get started!</div>`;
      return;
    }

    grid.innerHTML = decks.map(deck => {
      const total = deck.cards.length;
      const mastered = deck.cards.filter(c => c.mastered).length;
      const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

      return `
        <div class="deck-card glass-card" data-id="${deck.id}">
          <div class="deck-card-top">
            <h4>${deck.title}</h4>
            <p>${deck.description}</p>
          </div>
          <div class="deck-card-bottom">
            <div class="deck-card-count" title="Cards count">
              <i data-lucide="copy"></i>
              <span>${total} cards (${masteryPct}% mastered)</span>
            </div>
            <button class="deck-delete-btn" data-id="${deck.id}" title="Delete Deck">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");

    lucide.createIcons();

    // Attach listeners
    grid.querySelectorAll(".deck-card").forEach(card => {
      card.addEventListener("click", (e) => {
        // Prevent click if clicking delete button
        if (e.target.closest(".deck-delete-btn")) return;
        const id = card.getAttribute("data-id");
        startStudyDeck(id);
      });
    });

    grid.querySelectorAll(".deck-delete-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        deleteDeck(id);
      });
    });
  }

  function deleteDeck(id) {
    const confirmDelete = confirm("Are you sure you want to delete this deck and all its flashcards?");
    if (confirmDelete) {
      decks = decks.filter(d => d.id !== id);
      saveDecks();
      renderDecksGrid();
      window.StudyApp.notifications?.showToast("Flashcard deck deleted.", "info");
    }
  }

  function startStudyDeck(deckId) {
    activeDeckId = deckId;
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;

    // Reset controls
    activeCardIndex = 0;
    
    // UI Panels toggle
    document.getElementById("deck-list-container").classList.add("hidden");
    const studyPanel = document.getElementById("deck-study-container");
    studyPanel.classList.remove("hidden");
    
    document.getElementById("study-deck-title").textContent = deck.title;
    
    renderActiveCard();
  }

  function renderActiveCard() {
    const deck = decks.find(d => d.id === activeDeckId);
    if (!deck) return;

    const total = deck.cards.length;
    
    const studyIdx = document.getElementById("study-current-idx");
    const studyTotal = document.getElementById("study-total-cards");
    const progressFill = document.getElementById("study-progress-fill");
    const cardContainer = document.getElementById("study-card-container");
    const frontText = document.getElementById("card-front-text");
    const backText = document.getElementById("card-back-text");

    // Clear flip class
    cardContainer.classList.remove("flipped");

    if (total === 0) {
      studyIdx.textContent = "0";
      studyTotal.textContent = "0";
      progressFill.style.width = "0%";
      frontText.textContent = "Deck is empty! Add flashcards first.";
      backText.textContent = "Click the 'Add Card' button in the top right to start compiling terms.";
      
      document.querySelector(".study-controls").classList.add("hidden");
      return;
    }

    document.querySelector(".study-controls").classList.remove("hidden");

    studyIdx.textContent = (activeCardIndex + 1).toString();
    studyTotal.textContent = total.toString();
    
    const progressPct = ((activeCardIndex + 1) / total) * 100;
    progressFill.style.width = `${progressPct}%`;

    const card = deck.cards[activeCardIndex];
    frontText.textContent = card.front;
    
    let backContent = card.back;
    if (card.mastered) {
      backContent += " ✅ [Mastered]";
    }
    backText.textContent = backContent;
  }

  function changeCard(dir) {
    const deck = decks.find(d => d.id === activeDeckId);
    if (!deck) return;

    const total = deck.cards.length;
    if (total === 0) return;

    activeCardIndex += dir;
    
    // Bounds wrapping loop
    if (activeCardIndex >= total) activeCardIndex = 0;
    if (activeCardIndex < 0) activeCardIndex = total - 1;

    // Slide animation trigger
    const inner = document.getElementById("study-card-inner");
    if (inner) {
      inner.style.transform = "scale(0.95) opacity(0.8)";
      inner.style.transition = "transform 0.1s ease";
      
      setTimeout(() => {
        renderActiveCard();
        inner.style.transform = "";
        inner.style.transition = "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
      }, 100);
    } else {
      renderActiveCard();
    }
  }

  function handleGradeCard(isEasy) {
    const deck = decks.find(d => d.id === activeDeckId);
    if (!deck || deck.cards.length === 0) return;

    const card = deck.cards[activeCardIndex];
    
    if (isEasy) {
      if (!card.mastered) {
        card.mastered = true;
        saveDecks();
        window.StudyApp.awardXP?.(5); // +5 XP per mastered card
        window.StudyApp.notifications?.showToast("Card mastered! +5 XP.", "success");
      } else {
        window.StudyApp.notifications?.showToast("Card already mastered.", "info");
      }
    } else {
      if (card.mastered) {
        card.mastered = false;
        saveDecks();
        window.StudyApp.notifications?.showToast("Card flagged for re-study.", "info");
      } else {
        window.StudyApp.notifications?.showToast("Review flagged.", "info");
      }
    }

    // Go to next card automatically after short delay
    setTimeout(() => {
      changeCard(1);
    }, 400);
  }

  function getAllCardsPool() {
    let pool = [];
    decks.forEach(deck => {
      deck.cards.forEach(card => {
        pool.push({
          id: card.id,
          question: card.front,
          answer: card.back,
          type: 'flashcard',
          deckTitle: deck.title
        });
      });
    });
    return pool;
  }

  return {
    init,
    getAllCardsPool,
    startStudyDeck,
    renderDecksGrid
  };
})();
