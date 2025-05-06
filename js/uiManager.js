/* File: js/uiManager.js */
/**
 * js/uiManager.js
 * -----------------
 * Manages the user interface, including DOM element references, UI updates,
 * view transitions, settings loading/saving/application, and event binding.
 * Handles feedback display, text rendering, hint visibility, paddle textures,
 * key mapping UI (primary and secondary), and manual mode UI.
 * - v1.0 - Initial Creation
 * - v1.1 - Added drag/drop for paddle textures, key mapping UI, manual mode UI.
 * - v1.1.1 - Added Forward Blur setting UI and logic.
 * - v1.2 - Fixed hint peek logic.
 * - v1.3 - Updated resetToDefaults to use combined defaults and not touch progress keys.
 * - v1.4 - Updated paddle mode toggle logic to reflect Checked=Manual.
 * - v1.5 - Added Reset Settings button listener integration.
 * - v1.6 - Improved Hint Peek logic (_handleGlobalKeyDown, _handleGlobalKeyUp, _applyHintVisibility).
 * - v1.7 - Refactored reset logic into handleResetSettings, called by listener.
 * - v1.8 - Added secondary keybinding inputs and logic.
 */
class UIManager {
    /**
     * Initializes the UIManager by getting references to key DOM elements.
     * Loads textures, settings (including key mappings and manual mode),
     * and binds drag/drop events.
     */
    constructor() {
        // Core Containers / Wrappers
        this.bodyElement = document.body;
        this.gameContainer = document.getElementById('game-container');
        this.displayArea = document.getElementById('display-area');
        this.gameUiWrapper = document.getElementById('game-ui-wrapper');
        this.playbackArea = document.getElementById('playback-area');
        this.sandboxArea = document.getElementById('sandbox-area');
        this.inputArea = document.getElementById('input-area');

        // Main Menu Elements
        this.mainMenuOverlay = document.getElementById('main-menu-overlay');
        this.startGameButton = document.getElementById('start-game-button');
        this.showSandboxButton = document.getElementById('show-sandbox-button');
        this.showPlaybackButton = document.getElementById('show-playback-button');
        this.showSettingsButton = document.getElementById('show-settings-button');

        // Game Mode Elements
        this.textDisplayWrapper = document.getElementById('text-display-wrapper');
        this.textDisplay = document.getElementById('text-display');
        this.targetPatternContainer = document.getElementById('target-pattern-container');
        this.targetPatternOuterWrapper = document.getElementById('target-pattern-outer-wrapper');
        this.toggleHintButton = document.getElementById('toggle-hint-button');
        this.userPatternContainer = document.getElementById('user-pattern-container');
        this.statsDisplay = document.getElementById('stats-display'); // Note: Currently hidden via CSS
        this.timerDisplay = document.getElementById('timer-display');
        this.wpmDisplay = document.getElementById('wpm-display');
        this.accuracyDisplay = document.getElementById('accuracy-display');
        this.grossWpmDisplay = document.getElementById('gross-wpm-display');

        // Input Area Elements (Paddles)
        this.ditButton = document.getElementById('dit-button');
        this.dahButton = document.getElementById('dah-button');
        this.ditPaddleLabel = this.ditButton?.querySelector('.paddle-label');
        this.dahPaddleLabel = this.dahButton?.querySelector('.paddle-label');
        this.ditPaddleSvg = this.ditButton?.querySelector('.paddle-svg');
        this.dahPaddleSvg = this.dahButton?.querySelector('.paddle-svg');

        // Volume Control Elements
        this.volumeControlArea = document.getElementById('volume-control-area');
        this.volumeSlider = document.getElementById('volume-slider');
        this.speakerIcon = document.getElementById('speaker-icon');
        this.speakerWave1 = document.getElementById('speaker-wave-1');
        this.speakerWave2 = document.getElementById('speaker-wave-2');
        this.speakerWave3 = document.getElementById('speaker-wave-3');

        // Playback Mode Elements
        this.playbackInput = document.getElementById('playback-input');
        this.playSentenceButton = document.getElementById('play-sentence-button');
        this.playbackMorseDisplay = document.getElementById('playback-morse-display');

        // Sandbox Mode Elements
        this.sandboxInput = document.getElementById('sandbox-input');
        this.startSandboxButton = document.getElementById('start-sandbox-button');
        this.sandboxMorsePreview = document.getElementById('sandbox-morse-preview');

        // Settings Modal Elements
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsCloseButton = document.getElementById('settings-close-button');
        this.wpmSlider = document.getElementById('wpm-slider');
        this.wpmValueDisplay = document.getElementById('wpm-value-display');
        this.frequencySlider = document.getElementById('frequency-slider');
        this.frequencyValueDisplay = document.getElementById('frequency-value-display');
        this.soundToggle = document.getElementById('sound-toggle');
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.resetSettingsButton = document.getElementById('reset-settings-button'); // NEW
        this.resetProgressButton = document.getElementById('reset-progress-button');
        // Key Mapping Inputs
        this.ditKeyInput = document.getElementById('dit-key-input');
        this.dahKeyInput = document.getElementById('dah-key-input');
        this.ditKeySecondaryInput = document.getElementById('dit-key-secondary-input');
        this.dahKeySecondaryInput = document.getElementById('dah-key-secondary-input');
        // Manual Mode Toggles
        this.ditManualModeToggle = document.getElementById('dit-manual-mode-toggle');
        this.dahManualModeToggle = document.getElementById('dah-manual-mode-toggle');
        this.forwardBlurToggle = document.getElementById('forward-blur-toggle'); // New: Forward Blur Toggle


        // Overlay Screens
        this.resultsScreen = document.getElementById('results-screen');
        this.levelSelectionScreen = document.getElementById('level-selection-screen');

        // Results Screen Elements
        this.resultsRatingContainer = document.getElementById('results-rating');
        this.resultsStatsContainer = document.getElementById('results-stats');
        this.resultsTime = document.getElementById('results-time');
        this.resultsNetWpm = document.getElementById('results-net-wpm');
        this.resultsGrossWpm = document.getElementById('results-gross-wpm');
        this.resultsAccuracy = document.getElementById('results-accuracy');
        this.levelUnlockMessage = document.getElementById('level-unlock-message');

        // Level Selection Screen Elements
        this.levelListContainer = document.getElementById('level-list');

        // Menu Navigation Buttons
        this.gameMenuButton = document.getElementById('game-menu-button');
        this.playbackMenuButton = document.getElementById('playback-menu-button');
        this.sandboxMenuButton = document.getElementById('sandbox-menu-button');
        this.resultsMenuButton = document.getElementById('results-menu-button');
        this.levelSelectMenuButton = document.getElementById('level-select-menu-button');

        // Internal State & Constants
        this.currentWpm = MorseConfig.ALL_SETTINGS_DEFAULTS.wpm;
        this.currentFrequency = MorseConfig.ALL_SETTINGS_DEFAULTS.frequency;
        this.currentVolume = MorseConfig.ALL_SETTINGS_DEFAULTS.volume;
        this.currentDitKey = MorseConfig.ALL_SETTINGS_DEFAULTS.ditKey;
        this.currentDahKey = MorseConfig.ALL_SETTINGS_DEFAULTS.dahKey;
        this.currentDitKeySecondary = MorseConfig.ALL_SETTINGS_DEFAULTS.ditKeySecondary;
        this.currentDahKeySecondary = MorseConfig.ALL_SETTINGS_DEFAULTS.dahKeySecondary;
        this.isSoundEnabled = MorseConfig.ALL_SETTINGS_DEFAULTS.soundEnabled;
        this.isDarkModeEnabled = MorseConfig.ALL_SETTINGS_DEFAULTS.darkMode;
        this.isHintVisible = MorseConfig.ALL_SETTINGS_DEFAULTS.hintVisible; // User's setting preference
        this.isDitManualMode = MorseConfig.ALL_SETTINGS_DEFAULTS.ditManual;
        this.isDahManualMode = MorseConfig.ALL_SETTINGS_DEFAULTS.dahManual;
        this.isForwardBlurEnabled = MorseConfig.ALL_SETTINGS_DEFAULTS.forwardBlur; // New: Forward Blur State
        this.isControlHeld = false; // For hint peek
        this.hintWasVisibleBeforePeek = false; // For hint peek restore
        this.keyInputCurrentlyListening = null; // 'dit', 'dah', 'ditSecondary', 'dahSecondary', or null

        // --- Separate Timeouts for feedback ---
        this._incorrectFlashTimeout = null; // Character flash
        this._incorrectPatternTimeout = null; // Pattern bg/fill flash (incorrect)
        this._correctFlashTimeout = null; // Pattern bg/fill flash (correct)
        this._hintPulseTimer = null; // Hint SVG pulse start delay

        // SVG Strings
        this.ditSvgString = `<svg class="pattern-dit" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="15" /></svg>`;
        this.dahSvgString = `<svg class="pattern-dah" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="30" height="10" rx="3"/></svg>`;

        // Paddle Texture URLs
        this.paddleTextures = { dit: null, dah: null };

        // Callbacks placeholder
        this.callbacks = {};

        // Initial Setup
        this._loadSettings(); // Load settings into internal variables first
        this._loadPaddleTextures();
        this._updateAllSettingsDisplays(); // Update UI based on loaded settings
        this._applyDarkMode(this.isDarkModeEnabled);
        this._applyHintVisibility(this.isHintVisible, false); // Apply initial hint state without pulse
        this._applyForwardBlurSetting(this.isForwardBlurEnabled); // Apply initial blur setting

        this._addGlobalEventListeners();
        this._addDragDropListeners();
        console.log("UIManager Initialized");
    }

    // --- UI View Management ---
    _hideAllViews() {
        this.gameUiWrapper?.classList.add('hidden');
        this.inputArea?.classList.add('hidden');
        this.playbackArea?.classList.add('hidden');
        this.sandboxArea?.classList.add('hidden');
        this.mainMenuOverlay?.classList.add('hidden');
        this.resultsScreen?.classList.add('hidden');
        this.levelSelectionScreen?.classList.add('hidden');
        this._stopHintPulse("View Change");
        this._updateDisplayAreaSizing(); // Update size after hiding/showing views
    }

    showMainMenu() {
        this._hideAllViews();
        this.mainMenuOverlay?.classList.remove('hidden');
        console.log("UI: Showing Main Menu");
    }

    showGameUI() {
         this._hideAllViews();
         this.gameUiWrapper?.classList.remove('hidden');
         this.inputArea?.classList.remove('hidden');
         // Apply visibility based on current setting (peek handled by event listeners)
         this._applyHintVisibility(this.isHintVisible, false);
         this.updatePaddleLabels('game'); // Set default game paddle labels
         console.log("UI: Showing Game/Sandbox Interface");
         this._updateDisplayAreaSizing();
    }

    showPlaybackUI() {
        this._hideAllViews();
        this.playbackArea?.classList.remove('hidden');
        this.setPlaybackButtonEnabled(true, 'Play Morse');
        this.updatePlaybackMorseDisplay("");
        if (this.playbackInput) this.playbackInput.value = '';
        console.log("UI: Showing Playback Interface");
        this._updateDisplayAreaSizing();
    }

    showSandboxUI() {
        this._hideAllViews();
        this.sandboxArea?.classList.remove('hidden');
        this.updateSandboxMorsePreview("");
        if (this.sandboxInput) {
            this.sandboxInput.value = '';
            this.sandboxInput.focus();
        }
        console.log("UI: Showing Sandbox Setup Interface");
        this._updateDisplayAreaSizing();
    }

    showLevelSelectionScreen(levelsWithStatus) {
        console.log("UI: Attempting to show Level Selection Screen...");
        this._hideAllViews();
        this.levelSelectionScreen?.classList.remove('hidden');

        if (!this.levelListContainer || !this.levelSelectionScreen) {
            console.error("Level selection container or screen element not found!");
            return;
        }
        console.log("UI: Level Selection Screen element found, populating list...");

        this.levelListContainer.innerHTML = ''; // Clear previous list
        levelsWithStatus.forEach(level => {
             const button = document.createElement('button');
             button.textContent = `Level ${level.id}: ${level.name}`;
             button.dataset.levelId = level.id;
             button.classList.add('level-button');
             if (level.isUnlocked) {
                 button.disabled = false;
                 button.classList.add(level.highScore ? 'completed' : 'unlocked');
                 const highScoreText = level.highScore
                      ? `${level.highScore.score.toFixed(1)} WPM, ${level.highScore.accuracy.toFixed(1)}%`
                      : 'No score yet';
                 button.title = `Status: ${level.highScore ? 'Completed' : 'Unlocked'}\nHigh Score: ${highScoreText}`;
             } else {
                 button.disabled = true;
                 button.classList.add('locked');
                 button.title = level.unlock_criteria
                     ? `Requires ${level.unlock_criteria.min_wpm} WPM & ${level.unlock_criteria.min_accuracy}% Accuracy on Level ${level.id - 1}`
                     : 'Locked';
             }
             this.levelListContainer.appendChild(button);
        });
        console.log("UI: Showing Level Selection Screen - List Populated.");
        this._updateDisplayAreaSizing();
    }

    hideLevelSelectionScreen() {
        this.levelSelectionScreen?.classList.add('hidden');
        console.log("UI: Hiding Level Selection Screen.");
    }

    /** Shows the results overlay and configures UI elements for results mode. */
    showResultsScreen(scores, unlockedLevelId, hasNextLevelOption, mode) {
        this._hideAllViews(); // Hide game UI etc.
        this.resultsScreen?.classList.remove('hidden'); // Show results overlay
        this.inputArea?.classList.remove('hidden'); // Keep paddles visible

        if (!this.resultsScreen) return;

        // Populate score details
        this.resultsTime.textContent = `Time: ${scores.elapsedTimeSeconds.toFixed(1)}s`;
        this.resultsNetWpm.textContent = `Net WPM: ${scores.netWpm.toFixed(1)}`;
        this.resultsGrossWpm.textContent = `Gross WPM: ${scores.grossWpm.toFixed(1)}`;
        this.resultsAccuracy.textContent = `Accuracy: ${scores.accuracy.toFixed(1)}%`;

        this.updateStarRating(scores.accuracy); // Update star display

        // Show level unlock message if applicable (Game Mode only)
        if (mode === AppMode.GAME) {
            this.levelUnlockMessage.textContent = unlockedLevelId ? `Congratulations! Level ${unlockedLevelId} unlocked!` : '';
            this.levelUnlockMessage.style.display = unlockedLevelId ? 'block' : 'block'; // Always block to maintain layout?
        } else { // Sandbox mode
            this.levelUnlockMessage.textContent = '';
            this.levelUnlockMessage.style.display = 'none';
        }

        // Update instructions with current primary key bindings
        this.updateResultsInstructionsKeyHints(this.currentDitKey, this.currentDahKey);

        // Update paddle labels for Retry/Next
        this.updatePaddleLabels('results', hasNextLevelOption, mode);
        console.log(`UI: Showing Results (Mode: ${mode})`);
        this._updateDisplayAreaSizing(); // Adjust layout if needed
    }

     /** Updates the key hint text in the results screen instructions. */
     updateResultsInstructionsKeyHints(ditKey, dahKey) {
         const instructionEl = this.resultsScreen?.querySelector('.results-instructions');
         if (instructionEl) {
             const keyDisplayDit = MorseConfig.getKeyDisplay(ditKey);
             const keyDisplayDah = MorseConfig.getKeyDisplay(dahKey);
             // Swapped labels: Dit=Retry, Dah=Next
             instructionEl.innerHTML = `Press <span class="key-hint">${keyDisplayDit}</span> (Retry) or <span class="key-hint">${keyDisplayDah}</span> (Next)`;
         }
     }


    /** Updates the star display based on score/accuracy. */
    updateStarRating(accuracy) {
        if (!this.resultsRatingContainer) return;
        const stars = this.resultsRatingContainer.querySelectorAll('.star');
        let filledStars = 0;
        if (accuracy >= 98) filledStars = 3;
        else if (accuracy >= 90) filledStars = 2;
        else if (accuracy >= 75) filledStars = 1;

        stars.forEach((star, index) => {
            star.classList.toggle('filled', index < filledStars);
            star.textContent = index < filledStars ? '★' : '☆';
        });
    }

    /** Adjusts display area height based on input area visibility */
    _updateDisplayAreaSizing() {
        const isInputHidden = this.inputArea?.classList.contains('hidden');
        this.bodyElement.classList.toggle('input-area-hidden', isInputHidden);
    }


    // --- Helper Functions ---
    _createPatternSvg(type) { return type === '.' ? this.ditSvgString : this.dahSvgString; }

    /** Updates the target (hint) pattern display. */
    updateTargetPatternDisplay(morseSequence) {
        if (!this.targetPatternContainer) return;
        this._stopHintPulse("Target Pattern Update");
        this.targetPatternContainer.innerHTML = ''; // Clear previous
        if (morseSequence) {
             morseSequence.split('').forEach(el => {
                 if (el === '.' || el === '-') this.targetPatternContainer.innerHTML += this._createPatternSvg(el);
             });
        }
        // Re-apply visibility state after updating content, considering peek
        this._applyHintVisibility(this.isHintVisible, false);
    }

    /** Updates the user input pattern display. */
    updateUserPatternDisplay(morseSequence) {
        if (!this.userPatternContainer) return;
        if (morseSequence) {
            this._stopHintPulse("User Input Started"); // Stop pulse if user types
        }
        this.userPatternContainer.innerHTML = ''; // Clear previous
        if (morseSequence) {
             morseSequence.split('').forEach(el => {
                 if (el === '.' || el === '-') this.userPatternContainer.innerHTML += this._createPatternSvg(el);
             });
        }
    }

    updatePlaybackMorseDisplay(formattedMorse) { if (this.playbackMorseDisplay) this.playbackMorseDisplay.textContent = formattedMorse || '\u00A0'; }
    updateSandboxMorsePreview(formattedMorse) { if (this.sandboxMorsePreview) this.sandboxMorsePreview.textContent = formattedMorse || '\u00A0'; }

    /**
     * Sets the visual state (default, correct, incorrect) for the pattern containers.
     * Applies 'correct-pattern' or 'incorrect-pattern' classes.
     * @param {'default' | 'correct' | 'incorrect'} state The feedback state.
     */
    setPatternDisplayState(state) {
        const userContainer = this.userPatternContainer;
        const targetContainer = this.targetPatternContainer; // Hint container

        if (!userContainer || !targetContainer) { // Ensure both exist for consistent feedback
            console.warn("Pattern display state requires both user and target containers.");
            return;
        }

        // --- Clear conflicting timeouts ---
        if (this._correctFlashTimeout) {
            clearTimeout(this._correctFlashTimeout); this._correctFlashTimeout = null;
        }
        if (this._incorrectPatternTimeout) {
            clearTimeout(this._incorrectPatternTimeout); this._incorrectPatternTimeout = null;
        }

        // --- Remove previous state classes ---
        userContainer.classList.remove('correct-pattern', 'incorrect-pattern');
        targetContainer.classList.remove('correct-pattern', 'incorrect-pattern');

        // --- Stop Hint Pulse if giving feedback ---
        if (state === 'correct' || state === 'incorrect') {
            this._stopHintPulse(`Feedback: ${state}`);
        }

        // --- Apply new state and set removal timer ---
        if (state === 'correct') {
            userContainer.classList.add('correct-pattern');
            targetContainer.classList.add('correct-pattern'); // Apply to hint as well

            const correctFlashDuration = MorseConfig.INCORRECT_FLASH_DURATION * 0.8; // Slightly shorter?

            this._correctFlashTimeout = setTimeout(() => {
                 userContainer.classList.remove('correct-pattern');
                 targetContainer.classList.remove('correct-pattern');
                 this._correctFlashTimeout = null;
                 // Restart pulse if hint is supposed to be visible and no user input yet and not peeking
                 if(this.isHintVisible && !this.isControlHeld && !window.morseGameState?.currentInputSequence) {
                    this._startHintPulseTimer();
                 }
            }, correctFlashDuration);

        } else if (state === 'incorrect') {
            userContainer.classList.add('incorrect-pattern');
            targetContainer.classList.add('incorrect-pattern'); // Apply to hint as well

            this._incorrectPatternTimeout = setTimeout(() => {
                userContainer.classList.remove('incorrect-pattern');
                targetContainer.classList.remove('incorrect-pattern');
                this._incorrectPatternTimeout = null;
                 // Restart pulse if hint is supposed to be visible and no user input yet and not peeking
                 if(this.isHintVisible && !this.isControlHeld && !window.morseGameState?.currentInputSequence) {
                    this._startHintPulseTimer();
                 }
            }, MorseConfig.INCORRECT_FLASH_DURATION);
        } else {
             // 'default' state - Ensure pulse starts if appropriate and not peeking
             if(this.isHintVisible && !this.isControlHeld && !window.morseGameState?.currentInputSequence) {
                this._startHintPulseTimer();
             }
        }
    }


    /** Renders the sentence text into the display area. */
    renderSentence(sentence) {
        if (!this.textDisplay || !this.textDisplayWrapper) return;
        this.textDisplay.innerHTML = ''; // Clear previous content
        // Reset styles potentially changed by _adjustTextDisplayFontSize
        this.textDisplay.style.fontSize = '';
        this.textDisplay.style.transform = 'translateX(0px)';
        this.textDisplayWrapper.scrollLeft = 0;

        if (sentence) {
            sentence.split('').forEach((char, index) => {
                const span = document.createElement('span');
                span.textContent = char;
                span.classList.add('char', 'pending');
                span.dataset.index = index;
                if (char === ' ') span.classList.add('space');
                this.textDisplay.appendChild(span);
            });
        }
        this.resetCharacterStyles(); // Ensure all start as pending
        this.updateUserPatternDisplay(""); // Clear user pattern
        this.setPatternDisplayState('default'); // Reset pattern feedback state
        this._adjustTextDisplayFontSize(); // Fit text vertically
        this.updateForwardBlurEffect(); // Apply initial blur effect
        this._stopHintPulse("New Sentence Rendered"); // Stop any previous pulse
    }

    /** Adjusts the font size of the text display to fit vertically. */
    _adjustTextDisplayFontSize() {
        const element = this.textDisplay;
        const container = this.textDisplayWrapper;
        if (!element || !container || !element.textContent) {
            if(element) element.style.fontSize = ''; // Reset if no content
            return;
        }

        element.style.fontSize = ''; // Reset before measurement
        let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const minFontSize = 10; // Minimum allowed font size
        let iterations = 0;
        const maxIterations = 100; // Prevent infinite loops

        // Reduce font size until text fits vertically
        while (element.scrollHeight > container.clientHeight && currentFontSize > minFontSize && iterations < maxIterations) {
            currentFontSize *= 0.95; // Decrease font size by 5%
            element.style.fontSize = `${currentFontSize}px`;
            iterations++;
        }
        if (iterations >= maxIterations) console.warn("Max font size adjustment iterations reached.");
    }

    /** Resets all character spans to the 'pending' state. */
    resetCharacterStyles() {
        this.textDisplay?.querySelectorAll('.char').forEach(span => {
            span.className = 'char pending'; // Base classes
            if (span.textContent === ' ') span.classList.add('space');
        });
    }

    /** Updates the visual state of a specific character span. */
    updateCharacterState(charIndex, state) {
        const charSpan = this.textDisplay?.querySelector(`.char[data-index="${charIndex}"]`);
        if (charSpan) {
            charSpan.classList.remove('pending', 'current', 'completed', 'incorrect');
            charSpan.classList.add(state); // Add the new state class

            // Special handling for 'incorrect' state (temporary flash)
            if (state === 'incorrect') {
                this._stopHintPulse("Character Incorrect"); // Stop hint pulse on error
                // Clear any previous incorrect flash timeout for this character
                if (this._incorrectFlashTimeout) clearTimeout(this._incorrectFlashTimeout);
                // Set a timer to remove the 'incorrect' class
                this._incorrectFlashTimeout = setTimeout(() => {
                    if (charSpan.classList.contains('incorrect')) {
                        charSpan.classList.remove('incorrect');
                        // Restore to 'current' if it's still the active character, otherwise 'pending'
                        const currentGameState = window.morseGameState; // Access global state
                        if (currentGameState && currentGameState.currentCharIndex === charIndex && currentGameState.isPlaying()) {
                            charSpan.classList.add('current');
                        } else {
                             charSpan.classList.add('pending');
                        }
                    }
                    this._incorrectFlashTimeout = null; // Clear timeout ID
                }, MorseConfig.INCORRECT_FLASH_DURATION);
            } else if (this._incorrectFlashTimeout && charSpan.classList.contains('incorrect')) {
                // If state changes away from incorrect before timeout, clear the timeout
                clearTimeout(this._incorrectFlashTimeout);
                this._incorrectFlashTimeout = null;
            }

            // If setting to 'current', center it horizontally
            if (state === 'current') {
                this._centerCurrentCharacterHorizontally(charSpan);
            } else if (state === 'completed') {
                this._stopHintPulse("Character Completed"); // Stop hint pulse on correct char
                this.updateForwardBlurEffect(); // Update blur as current index changes
            }
        }
    }


    /** Highlights the next character, updates the target pattern, clears user input, and handles hint pulse. */
    highlightCharacter(currentIdx, targetChar) {
        // Remove 'current' from previous character(s)
        this.textDisplay?.querySelectorAll('.char.current').forEach(prevSpan => {
            if (prevSpan.dataset.index != currentIdx) { // Avoid removing from the one we're about to set
                if (!prevSpan.classList.contains('incorrect') && !prevSpan.classList.contains('completed')) {
                    prevSpan.classList.remove('current');
                    prevSpan.classList.add('pending'); // Revert to pending if not incorrect/completed
                } else {
                    prevSpan.classList.remove('current'); // Just remove current if it was incorrect/completed
                }
            }
        });

        // Set the new character to 'current'
        this.updateCharacterState(currentIdx, 'current');

        // Update the target pattern display (hint)
        let morseSequence = null;
        if (window.morseDecoder) { // Access global decoder
            morseSequence = window.morseDecoder.encodeCharacter(targetChar);
        }
        this.updateTargetPatternDisplay(morseSequence ?? ""); // Show hint

        this.updateUserPatternDisplay(""); // Clear user input display
        this.setPatternDisplayState('default'); // Reset pattern feedback visuals

        this.updateForwardBlurEffect(); // Apply blur effect based on new position

        // Start hint pulse timer if hint is visible and there's a sequence to show
        // AND peek is not active
        if (this.isHintVisible && !this.isControlHeld && morseSequence) {
            this._startHintPulseTimer();
        } else {
            this._stopHintPulse("Highlight Character (no pulse condition)");
        }
    }

    /** Scrolls the text display wrapper horizontally to keep the current character centered. */
    _centerCurrentCharacterHorizontally(element) {
        const container = this.textDisplayWrapper;
        const textDisplay = this.textDisplay;
        if (!container || !element || !textDisplay) return;

        requestAnimationFrame(() => {
            // Re-query element in case DOM updated
            const currentElement = textDisplay.querySelector(`.char[data-index="${element.dataset.index}"]`);
            if (!currentElement) return;

            const containerRect = container.getBoundingClientRect();
            const elementRect = currentElement.getBoundingClientRect();

            // Calculate center points relative to viewport
            const containerCenter = containerRect.left + containerRect.width / 2;
            const elementCenter = elementRect.left + elementRect.width / 2;

            // Calculate desired scroll adjustment
            const scrollAdjustment = elementCenter - containerCenter;

            // Calculate target scroll position
            let targetScrollLeft = container.scrollLeft + scrollAdjustment;

            // Clamp scroll position within bounds
            const maxScrollLeft = container.scrollWidth - containerRect.width;
            targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

            // Apply smooth scroll if adjustment is significant
            if (Math.abs(container.scrollLeft - targetScrollLeft) > 1) {
                container.scrollTo({
                    left: targetScrollLeft,
                    behavior: 'smooth'
                });
            }
        });
    }

    // --- Stat Updates ---
    updateTimer(elapsedTimeMs) { const totalSeconds = Math.floor(elapsedTimeMs / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; const milliseconds = Math.floor((elapsedTimeMs % 1000) / 100); const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds)}`; if (this.timerDisplay) this.timerDisplay.textContent = `Time: ${formattedTime}`; }
    updateWpmDisplay(netWpm) { if(this.wpmDisplay) this.wpmDisplay.textContent = `Net WPM: ${netWpm.toFixed(0)}`; }
    updateAccuracyDisplay(accuracy) { if(this.accuracyDisplay) this.accuracyDisplay.textContent = `Accuracy: ${accuracy.toFixed(1)}%`; }
    updateGrossWpmDisplay(grossWpm) { if(this.grossWpmDisplay) this.grossWpmDisplay.textContent = `Gross WPM: ${grossWpm.toFixed(0)}`; }
    resetStatsDisplay() { this.updateTimer(0); this.updateWpmDisplay(0); this.updateAccuracyDisplay(100); this.updateGrossWpmDisplay(0); this.updateTargetPatternDisplay(""); this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); this._applyHintVisibility(this.isHintVisible, false); }

    // --- Settings UI Updates ---
    _updateWpmDisplay(wpm) { if(this.wpmValueDisplay) this.wpmValueDisplay.textContent = wpm; }
    _updateFrequencyDisplay(freq) { if(this.frequencyValueDisplay) this.frequencyValueDisplay.textContent = freq; }
    _updateVolumeSliderUI(volume) { if (this.volumeSlider) this.volumeSlider.value = volume; }
    _updateSpeakerIcon(volume) { const waves = [this.speakerWave1, this.speakerWave2, this.speakerWave3]; waves.forEach(wave => { if (wave) wave.style.display = 'none'; }); if (volume > 0.7 && this.speakerWave3) this.speakerWave3.style.display = 'inline'; if (volume > 0.3 && this.speakerWave2) this.speakerWave2.style.display = 'inline'; if (volume > 0 && this.speakerWave1) this.speakerWave1.style.display = 'inline'; }
    /** Updates the display value and placeholder for all four key mapping input fields. */
    _updateKeyMappingDisplay() {
        if (this.ditKeyInput) { this.ditKeyInput.value = MorseConfig.getKeyDisplay(this.currentDitKey); this.ditKeyInput.classList.remove('listening'); this.ditKeyInput.placeholder = "Click to set"; }
        if (this.dahKeyInput) { this.dahKeyInput.value = MorseConfig.getKeyDisplay(this.currentDahKey); this.dahKeyInput.classList.remove('listening'); this.dahKeyInput.placeholder = "Click to set"; }
        if (this.ditKeySecondaryInput) { this.ditKeySecondaryInput.value = MorseConfig.getKeyDisplay(this.currentDitKeySecondary); this.ditKeySecondaryInput.classList.remove('listening'); this.ditKeySecondaryInput.placeholder = "Click to set"; }
        if (this.dahKeySecondaryInput) { this.dahKeySecondaryInput.value = MorseConfig.getKeyDisplay(this.currentDahKeySecondary); this.dahKeySecondaryInput.classList.remove('listening'); this.dahKeySecondaryInput.placeholder = "Click to set"; }
        this.keyInputCurrentlyListening = null; // Reset listening state
    }
     /** Updates the manual mode toggle checkbox states (Checked=Manual). */
     _updateManualModeToggles() {
         if (this.ditManualModeToggle) this.ditManualModeToggle.checked = this.isDitManualMode; // checked = true = Manual
         if (this.dahManualModeToggle) this.dahManualModeToggle.checked = this.isDahManualMode; // checked = true = Manual
     }

     /** Updates all settings-related UI elements based on current internal state. */
     _updateAllSettingsDisplays() {
        // WPM
        this._updateWpmDisplay(this.currentWpm);
        if (this.wpmSlider) this.wpmSlider.value = this.currentWpm;
        // Frequency
        this._updateFrequencyDisplay(this.currentFrequency);
        if (this.frequencySlider) this.frequencySlider.value = this.currentFrequency;
        // Volume
        this._updateVolumeSliderUI(this.currentVolume);
        this._updateSpeakerIcon(this.currentVolume);
        // Sound Toggle
        if (this.soundToggle) this.soundToggle.checked = this.isSoundEnabled;
        // Dark Mode Toggle
        if (this.darkModeToggle) this.darkModeToggle.checked = this.isDarkModeEnabled;
        // Key Mapping Inputs
        this._updateKeyMappingDisplay(); // Now updates all four
        // Manual Mode Toggles
        this._updateManualModeToggles();
        if (this.forwardBlurToggle) this.forwardBlurToggle.checked = this.isForwardBlurEnabled; // New: Update blur toggle
     }


    // --- Settings Loading/Saving ---
    _saveSettings() {
         try {
             // Save only the settings keys, not progress keys
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM, this.currentWpm);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND, this.isSoundEnabled);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE, this.isDarkModeEnabled);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY, this.currentFrequency);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE, this.isHintVisible);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_VOLUME, this.currentVolume);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DIT_KEY, this.currentDitKey);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DAH_KEY, this.currentDahKey);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DIT_KEY_SECONDARY, this.currentDitKeySecondary);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DAH_KEY_SECONDARY, this.currentDahKeySecondary);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DIT_MANUAL, this.isDitManualMode);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DAH_MANUAL, this.isDahManualMode);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_FORWARD_BLUR, this.isForwardBlurEnabled); // New
             console.log("Settings Saved:", { wpm: this.currentWpm, sound: this.isSoundEnabled, dark: this.isDarkModeEnabled, freq: this.currentFrequency, hint: this.isHintVisible, volume: this.currentVolume, ditKey: this.currentDitKey, dahKey: this.currentDahKey, ditSec: this.currentDitKeySecondary, dahSec: this.currentDahKeySecondary, ditManual: this.isDitManualMode, dahManual: this.isDahManualMode });
         } catch (e) {
             console.error("Error saving settings:", e);
         }
     }

    _loadSettings() {
        try {
            // Load values or use defaults from MorseConfig.ALL_SETTINGS_DEFAULTS
            const defaults = MorseConfig.ALL_SETTINGS_DEFAULTS;
            const savedWpm = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM);
            const savedSound = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND);
            const savedDarkMode = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE);
            const savedFrequency = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY);
            const savedHintVisible = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE);
            const savedVolume = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_VOLUME);
            const savedDitKey = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DIT_KEY);
            const savedDahKey = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DAH_KEY);
            const savedDitKeySecondary = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DIT_KEY_SECONDARY);
            const savedDahKeySecondary = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DAH_KEY_SECONDARY);
            const savedDitManual = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DIT_MANUAL);
            const savedDahManual = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DAH_MANUAL);
            const savedForwardBlur = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_FORWARD_BLUR); // New

            this.currentWpm = savedWpm !== null ? parseInt(savedWpm, 10) : defaults.wpm;
            this.isSoundEnabled = savedSound !== null ? JSON.parse(savedSound) : defaults.soundEnabled;
            this.isDarkModeEnabled = savedDarkMode !== null ? JSON.parse(savedDarkMode) : defaults.darkMode;
            this.currentFrequency = savedFrequency !== null ? parseInt(savedFrequency, 10) : defaults.frequency;
            this.isHintVisible = savedHintVisible !== null ? JSON.parse(savedHintVisible) : defaults.hintVisible;
            this.currentVolume = savedVolume !== null ? parseFloat(savedVolume) : defaults.volume;
            // Use updated PADDLE_MODE_DEFAULTS from config.js
            this.isDitManualMode = savedDitManual !== null ? JSON.parse(savedDitManual) : MorseConfig.PADDLE_MODE_DEFAULTS.ditManual;
            this.isDahManualMode = savedDahManual !== null ? JSON.parse(savedDahManual) : MorseConfig.PADDLE_MODE_DEFAULTS.dahManual;
            this.isForwardBlurEnabled = savedForwardBlur !== null ? JSON.parse(savedForwardBlur) : defaults.forwardBlur; // New

            // Load primary keys
            this.currentDitKey = (savedDitKey && savedDitKey.trim() !== '') ? savedDitKey : defaults.ditKey;
            this.currentDahKey = (savedDahKey && savedDahKey.trim() !== '') ? savedDahKey : defaults.dahKey;
            // Load secondary keys
            this.currentDitKeySecondary = (savedDitKeySecondary && savedDitKeySecondary.trim() !== '') ? savedDitKeySecondary : defaults.ditKeySecondary;
            this.currentDahKeySecondary = (savedDahKeySecondary && savedDahKeySecondary.trim() !== '') ? savedDahKeySecondary : defaults.dahKeySecondary;

             // Validation: Check for duplicates across all four keys
            const allKeys = [this.currentDitKey, this.currentDahKey, this.currentDitKeySecondary, this.currentDahKeySecondary].map(k => k.toLowerCase());
            const keySet = new Set(allKeys);
            if (keySet.size < 4) {
                console.warn(`Duplicate key assignments detected during load (${allKeys.join(', ')}). Resetting conflicting keys to defaults.`);
                // Apply a simple reset: revert secondaries if they clash with primaries or each other
                // Check secondary dit clash
                if (allKeys[2] === allKeys[0] || allKeys[2] === allKeys[1]) {
                    this.currentDitKeySecondary = defaults.ditKeySecondary;
                    allKeys[2] = this.currentDitKeySecondary.toLowerCase(); // Update local array for next check
                    console.log("  - Resetting Secondary Dit Key.");
                }
                // Check secondary dah clash (against potentially reset secondary dit too)
                if (allKeys[3] === allKeys[0] || allKeys[3] === allKeys[1] || allKeys[3] === allKeys[2]) {
                     this.currentDahKeySecondary = defaults.dahKeySecondary;
                     console.log("  - Resetting Secondary Dah Key.");
                }
                // Note: This simplified reset might not cover all edge cases perfectly if defaults themselves clash.
            }

            // Clamp frequency and volume to valid ranges
            this.currentFrequency = Math.max(MorseConfig.AUDIO_MIN_FREQUENCY, Math.min(MorseConfig.AUDIO_MAX_FREQUENCY, this.currentFrequency));
            this.currentVolume = Math.max(0.0, Math.min(1.0, this.currentVolume));

            console.log("Settings Loaded:", { wpm: this.currentWpm, sound: this.isSoundEnabled, dark: this.isDarkModeEnabled, freq: this.currentFrequency, hint: this.isHintVisible, volume: this.currentVolume, ditKey: this.currentDitKey, dahKey: this.currentDahKey, ditSec: this.currentDitKeySecondary, dahSec: this.currentDahKeySecondary, ditManual: this.isDitManualMode, dahManual: this.isDahManualMode, forwardBlur: this.isForwardBlurEnabled }); // New
        } catch (e) {
            console.error("Error loading settings:", e);
            // Fallback to defaults on error
            const defaults = MorseConfig.ALL_SETTINGS_DEFAULTS;
            this.currentWpm = defaults.wpm;
            this.isSoundEnabled = defaults.soundEnabled;
            this.isDarkModeEnabled = defaults.darkMode;
            this.currentFrequency = defaults.frequency;
            this.isHintVisible = defaults.hintVisible;
            this.currentVolume = defaults.volume;
            this.currentDitKey = defaults.ditKey;
            this.currentDahKey = defaults.dahKey;
            this.currentDitKeySecondary = defaults.ditKeySecondary;
            this.currentDahKeySecondary = defaults.dahKeySecondary;
            this.isDitManualMode = defaults.ditManual;
            this.isDahManualMode = defaults.dahManual;
            this.isForwardBlurEnabled = defaults.forwardBlur; // New
        }
        // UI elements updated in constructor via _updateAllSettingsDisplays()
    }

    /** Visually resets the key mapping input fields based on current internal state. */
    resetKeyMappingInputs() {
        // Assumes this.currentDitKey etc. are already correctly set (e.g., by handleResetSettings)
        this._updateKeyMappingDisplay();
    }


    /** Resets all UI settings elements and internal state to their default values defined in MorseConfig. */
    handleResetSettings() {
        console.log("UIManager: Resetting settings to defaults...");
        // Reset internal state variables to defaults from the combined object
        const defaults = MorseConfig.ALL_SETTINGS_DEFAULTS;
        this.currentWpm = defaults.wpm;
        this.currentFrequency = defaults.frequency;
        this.currentVolume = defaults.volume;
        this.currentDitKey = defaults.ditKey;
        this.currentDahKey = defaults.dahKey;
        this.currentDitKeySecondary = defaults.ditKeySecondary;
        this.currentDahKeySecondary = defaults.dahKeySecondary;
        this.isSoundEnabled = defaults.soundEnabled;
        this.isDarkModeEnabled = defaults.darkMode;
        this.isHintVisible = defaults.hintVisible;
        this.isDitManualMode = defaults.ditManual;
        this.isDahManualMode = defaults.dahManual;
        this.isForwardBlurEnabled = defaults.forwardBlur; // New: Reset blur state

        // Update all associated UI Elements
        this._updateAllSettingsDisplays();

        // Apply visual changes for theme/hint
        this._applyForwardBlurSetting(this.isForwardBlurEnabled); // New: Apply blur setting
        this._applyDarkMode(this.isDarkModeEnabled);
        this._applyHintVisibility(this.isHintVisible, false); // Apply hint visibility without pulse
         // --- Reset Paddle Textures ---
        console.log("UIManager: Resetting paddle textures...");
        this.paddleTextures = { dit: null, dah: null }; // Reset internal state
         // Remove styles from DOM elements
        [this.ditButton, this.dahButton].forEach(button => {
            if (button) { button.style.backgroundImage = 'none'; button.classList.remove('has-texture'); }
        });
        localStorage.removeItem(MorseConfig.STORAGE_KEY_PADDLE_TEXTURES); // Remove from storage

        // Save the reset defaults back to storage
        this._saveSettings();

        // Explicitly notify main.js about potential changes from reset
        // This ensures other modules (AudioPlayer, InputHandler) get the reset values
        if (this.callbacks && this.callbacks.onResetSettings) {
            // Trigger a specific callback for settings reset, passing all settings
            this.callbacks.onResetSettings({
                wpm: this.currentWpm,
                frequency: this.currentFrequency,
                soundEnabled: this.isSoundEnabled,
                volume: this.currentVolume,
                ditKey: this.currentDitKey,
                dahKey: this.currentDahKey,
                ditKeySecondary: this.currentDitKeySecondary,
                dahKeySecondary: this.currentDahKeySecondary,
                ditManual: this.isDitManualMode,
                dahManual: this.isDahManualMode,
                darkMode: this.isDarkModeEnabled,
                hintVisible: this.isHintVisible,
                forwardBlur: this.isForwardBlurEnabled // New: Include blur in reset notification
            });
        } else {
             console.warn("UIManager: onResetSettings callback not defined in main.js");
        }
         console.log("UIManager: Settings reset to defaults and applied.");
         alert("Settings reset to defaults.");
    }


    // --- Paddle UI ---
    setButtonActive(buttonType, isActive) { const button = buttonType === 'dit' ? this.ditButton : this.dahButton; if (button) button.classList.toggle('active', isActive); }

    /** Updates paddle content for game vs results mode. */
    updatePaddleLabels(mode, hasNextLevel = false, gameMode = AppMode.GAME) {
        const buttons = [this.ditButton, this.dahButton];
        const labels = [this.ditPaddleLabel, this.dahPaddleLabel];

        if (!buttons[0] || !buttons[1] || !labels[0] || !labels[1]) return;

        if (mode === 'results') {
            // Shared Results Mode setup
            labels[0].textContent = "Retry"; // Dit = Retry
            buttons[0].disabled = false; // Retry always enabled
            buttons.forEach(btn => btn.classList.add('results-label-active'));

            // Mode-Specific Dah setup
            if (gameMode === AppMode.SANDBOX) {
                labels[1].textContent = "New Random"; // Dah = New Random in Sandbox
                buttons[1].disabled = false; // Always enabled in Sandbox results
            } else { // Game Mode
                labels[1].textContent = "Next";       // Dah = Next in Game Mode
                buttons[1].disabled = !hasNextLevel;  // Disable 'Next' if no next level/sentence unlocked
            }
        } else { // Game mode
            labels[0].textContent = ""; // Clear labels for game/sandbox
            labels[1].textContent = "";
            buttons[0].disabled = false;
            buttons[1].disabled = false;
            buttons.forEach(btn => btn.classList.remove('results-label-active'));
        }
    }

    // --- Playback/Sandbox UI ---
    setPlaybackButtonEnabled(enabled, text = 'Play Morse') { if (this.playSentenceButton) { this.playSentenceButton.disabled = !enabled; this.playSentenceButton.textContent = text; } }


    // --- Theme & Hint Visibility ---
    _applyDarkMode(enable) { this.bodyElement.classList.toggle('dark-mode', enable); }

    /** Visually applies the forward blur setting by toggling a body class. */
    _applyForwardBlurSetting(enable) {
        this.bodyElement?.classList.toggle('forward-blur-active', enable);
        this.updateForwardBlurEffect(); // Immediately update the effect on spans
    }

    /**
     * Updates the blur effect on upcoming characters based on the current index
     * and whether the blur setting is enabled.
     */
    updateForwardBlurEffect() {
        if (!this.textDisplay || !window.morseGameState) {
            return; // Need display and game state
        }

        const currentCharIndex = window.morseGameState.currentCharIndex;
        const spans = this.textDisplay.querySelectorAll('.char');

        // If setting is disabled, remove all blur classes
        if (!this.isForwardBlurEnabled) {
            spans.forEach(span => {
                span.className = span.className.replace(/\s?forward-blur-\d/g, '');
            });
            return;
        }

        // Apply blur based on distance
        spans.forEach(span => {
            // Remove any existing blur class first
            span.className = span.className.replace(/\s?forward-blur-\d/g, '');

            const spanIndex = parseInt(span.dataset.index, 10);
            // Ignore non-indexed, current, or past chars. Also ignore spaces.
            if (isNaN(spanIndex) || spanIndex <= currentCharIndex || span.classList.contains('space')) {
                return;
            }

            const distance = spanIndex - currentCharIndex;
            // Calculate blur level (e.g., increasing every 2 chars, max level 5)
            const MAX_BLUR_LEVEL = 5;
            const blurLevel = Math.min(MAX_BLUR_LEVEL, Math.ceil(distance / 2));

            if (blurLevel > 0) {
                span.classList.add(`forward-blur-${blurLevel}`);
            }
        });
    }

    /**
     * Applies the visual hint visibility state, respecting the peek state (isControlHeld).
     * @param {boolean} baseVisibility - The user's setting for hint visibility (this.isHintVisible).
     * @param {boolean} [startPulse=true] - Whether to potentially start the pulse animation timer.
     */
    _applyHintVisibility(baseVisibility, startPulse = true) {
        let effectiveVisibility = this.isControlHeld ? true : baseVisibility;

        // Apply the class to show/hide the hint container content
        this.targetPatternOuterWrapper?.classList.toggle('hint-hidden', !effectiveVisibility);

        // Update ARIA attribute based on the *setting* state (baseVisibility)
        this.toggleHintButton?.setAttribute('aria-pressed', String(baseVisibility));

        // Handle pulse starting/stopping
        if (effectiveVisibility) { // If hint is visually shown (due to setting or peek)
            if (this.isControlHeld) {
                this._stopHintPulse("Peek Active"); // Stop pulse during peek
            } else if (startPulse) {
                // Start timer only if setting is on, not peeking, container is rendered, and has content
                if (this.targetPatternContainer?.offsetParent !== null && this.targetPatternContainer?.innerHTML.trim() !== '') {
                    this._startHintPulseTimer();
                } else {
                    this._stopHintPulse("Hint Setting On (No Pulse - Container Hidden/Empty)");
                }
            } else {
                 this._stopHintPulse("Hint Setting On (No Initial Pulse Requested)");
            }
        } else { // Hint is visually hidden
            this._stopHintPulse("Hint Hidden");
        }
    }


    /** Starts the timer to add the pulsing animation class to hint SVGs. */
    _startHintPulseTimer() {
        this._stopHintPulse("Starting New Pulse Timer"); // Clear any existing timer/pulse
        const svgs = this.targetPatternContainer?.querySelectorAll('svg');

        // Conditions to pulse: SVGs exist, hint container is visually rendered, not hidden, and not peeking
        if (!svgs || svgs.length === 0 || this.targetPatternOuterWrapper?.classList.contains('hint-hidden') || this.isControlHeld) {
            return;
        }

        const pulseDelayMs = 2000; // Delay before starting pulse
        this._hintPulseTimer = setTimeout(() => {
            // Check conditions *again* when timer fires
            const currentSvgs = this.targetPatternContainer?.querySelectorAll('svg');
            if (currentSvgs && currentSvgs.length > 0 && !this.targetPatternOuterWrapper?.classList.contains('hint-hidden') && !this.isControlHeld) {
                currentSvgs.forEach(svg => svg.classList.add('hint-svg-pulse')); // Apply pulse class
            }
            this._hintPulseTimer = null; // Clear timer ID
        }, pulseDelayMs);
    }

    /** Clears the hint pulse timer and removes the pulsing animation class from SVGs. */
    _stopHintPulse(reason = "Unknown") {
        // Clear the scheduling timeout if it exists
        if (this._hintPulseTimer) {
            clearTimeout(this._hintPulseTimer);
            this._hintPulseTimer = null;
        }
        // Remove the pulse class from any currently pulsing SVGs
        const svgs = this.targetPatternContainer?.querySelectorAll('svg.hint-svg-pulse');
        if (svgs && svgs.length > 0) {
            svgs.forEach(svg => svg.classList.remove('hint-svg-pulse'));
        }
    }


    // --- Global Event Handling (Hint Peek, Volume Blur) ---

    /** Handles the global keydown event, primarily for hint peeking. */
     _handleGlobalKeyDown(event) {
        const targetElement = event.target;
        // Check against all 4 key mapping inputs
        const isKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput ||
                                     targetElement === this.ditKeySecondaryInput || targetElement === this.dahKeySecondaryInput;
        const isInputFocused = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA';
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');
        const isGameVisible = this.gameUiWrapper && !this.gameUiWrapper.classList.contains('hidden');

        // --- Conditions to IGNORE Ctrl key for peeking ---
        // Ignore if typing in inputs (except key map inputs), or settings modal open (unless key mapping input focused)
        if ((isInputFocused && !isKeyMapInputFocused) || (isSettingsOpen && !isKeyMapInputFocused) ) {
            return;
        }
        // Ignore if Ctrl is pressed while a key mapping input is *already* focused
        if (event.key === 'Control' && isKeyMapInputFocused) {
             return;
        }
        // Ignore if game UI is not visible
        if (!isGameVisible) {
             return;
        }
        // --- End Ignore Conditions ---


        // --- Handle hint peek (Ctrl press) ---
        if (event.key === 'Control' && !this.isControlHeld) {
            // console.log("Ctrl Pressed - Peeking Hint"); // Debug
            this.isControlHeld = true;
            // Store the actual setting state *before* overriding for peek
            this.hintWasVisibleBeforePeek = this.isHintVisible;
            // Force the hint to show visually, regardless of the setting state
            this._applyHintVisibility(true, false); // true = show, false = don't start pulse
        }
    }

    /** Handles the global keyup event, primarily for hint peeking. */
    _handleGlobalKeyUp(event) {
         // --- Handle hint peek (Ctrl release) ---
         if (event.key === 'Control') {
            if (this.isControlHeld) { // Only act if we were tracking the hold
                // console.log("Ctrl Released - Ending Hint Peek"); // Debug
                 this.isControlHeld = false; // Reset hold flag FIRST
                 // Restore the display based on the state *before* peek started
                 this._applyHintVisibility(this.hintWasVisibleBeforePeek, true); // Restore state, allow pulse if it was visible
            }
         }
    }


    /** Adds global event listeners needed by the UI manager. */
    _addGlobalEventListeners() {
        document.addEventListener('keydown', this._handleGlobalKeyDown.bind(this));
        document.addEventListener('keyup', this._handleGlobalKeyUp.bind(this));
        // Blur volume slider after interaction to prevent keyboard interference
        this.volumeSlider?.addEventListener('mouseup', () => this.volumeSlider.blur());
        this.volumeSlider?.addEventListener('touchend', () => this.volumeSlider.blur());
    }

    // --- Paddle Texture Drag and Drop ---
    _loadPaddleTextures() { try { const savedTextures = localStorage.getItem(MorseConfig.STORAGE_KEY_PADDLE_TEXTURES); if (savedTextures) { const parsedTextures = JSON.parse(savedTextures); if (parsedTextures.dit) { this._applyTexture(this.ditButton, parsedTextures.dit); this.paddleTextures.dit = parsedTextures.dit; } if (parsedTextures.dah) { this._applyTexture(this.dahButton, parsedTextures.dah); this.paddleTextures.dah = parsedTextures.dah; } } } catch (e) { console.error("Error loading paddle textures:", e); this.paddleTextures = { dit: null, dah: null }; } }
    _savePaddleTextures() { try { localStorage.setItem(MorseConfig.STORAGE_KEY_PADDLE_TEXTURES, JSON.stringify(this.paddleTextures)); } catch (e) { console.error("Error saving paddle textures:", e); } }
    _addDragDropListeners() { [this.ditButton, this.dahButton].forEach(paddle => { if (paddle) { paddle.addEventListener('dragover', this._handleDragOver.bind(this)); paddle.addEventListener('dragleave', this._handleDragLeave.bind(this)); paddle.addEventListener('drop', this._handleDrop.bind(this)); } }); }
    _handleDragOver(event) { event.preventDefault(); event.stopPropagation(); const paddle = event.currentTarget; if (paddle) { paddle.classList.add('drag-over'); event.dataTransfer.dropEffect = 'copy'; } }
    _handleDragLeave(event) { event.preventDefault(); event.stopPropagation(); const paddle = event.currentTarget; if (paddle) paddle.classList.remove('drag-over'); }
    _handleDrop(event) {
        event.preventDefault(); event.stopPropagation();
        const paddle = event.currentTarget; if (!paddle) return;
        paddle.classList.remove('drag-over');
        const paddleType = paddle.id === 'dit-button' ? 'dit' : 'dah';
        const dt = event.dataTransfer; const files = dt.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => { const imageDataUrl = e.target.result; this._applyTexture(paddle, imageDataUrl); this.paddleTextures[paddleType] = imageDataUrl; this._savePaddleTextures(); }; reader.readAsDataURL(file); } else { alert("Please drop an image file."); }
        } else {
            let imageUrl = dt.getData('text/uri-list') || dt.getData('URL');
            if (!imageUrl) { const htmlData = dt.getData('text/html'); if (htmlData) { const tempDiv = document.createElement('div'); tempDiv.innerHTML = htmlData; const imgElement = tempDiv.querySelector('img'); if (imgElement) imageUrl = imgElement.src; } }
            if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image'))) { this._applyTexture(paddle, imageUrl); this.paddleTextures[paddleType] = imageUrl; this._savePaddleTextures(); } else { alert("Could not get a valid image URL."); }
        }
    }
    _applyTexture(paddleElement, imageUrl) { if (!paddleElement) return; paddleElement.style.backgroundImage = `url('${imageUrl}')`; paddleElement.classList.add('has-texture'); }
    _removeTexture(paddleElement) { if (!paddleElement) return; paddleElement.style.backgroundImage = 'none'; paddleElement.classList.remove('has-texture'); const paddleType = paddleElement.id === 'dit-button' ? 'dit' : 'dah'; if (paddleType) { this.paddleTextures[paddleType] = null; this._savePaddleTextures(); } }
    // --- End Paddle Texture Drag and Drop ---

    // --- Key Mapping Event Handlers ---
    /** Handles focus event on any of the four key mapping input fields. */
    _handleKeyMappingInputFocus(event) {
        const inputElement = event.target;
        let type = null;
        switch (inputElement.id) {
            case 'dit-key-input':
                type = 'dit'; break;
            case 'dah-key-input':
                type = 'dah'; break;
            case 'dit-key-secondary-input':
                type = 'ditSecondary'; break;
            case 'dah-key-secondary-input':
                type = 'dahSecondary'; break;
            default: return; // Not a key input we handle
        }
        // Cancel any other listening input
        if (this.keyInputCurrentlyListening && this.keyInputCurrentlyListening !== type) {
            this._updateKeyMappingDisplay(); // Reset other input visually
        }
        // Set this one to listening state
        inputElement.value = "Listening...";
        inputElement.classList.add('listening');
        this.keyInputCurrentlyListening = type;
        console.log(`Key mapping: Listening for ${type} key...`);
    }

    /** Handles keydown event when a key mapping input field is focused. */
    _handleKeyMappingKeyDown(event) {
        if (!this.keyInputCurrentlyListening) return; // Only act if listening

        event.preventDefault(); event.stopPropagation(); // Stop default key actions

        const newKey = event.key;
        const type = this.keyInputCurrentlyListening; // e.g., 'dit', 'dah', 'ditSecondary', 'dahSecondary'
        let inputElement = null;
        switch (type) {
             case 'dit': inputElement = this.ditKeyInput; break;
             case 'dah': inputElement = this.dahKeyInput; break;
             case 'ditSecondary': inputElement = this.ditKeySecondaryInput; break;
             case 'dahSecondary': inputElement = this.dahKeySecondaryInput; break;
             default: return;
         }

        let isValid = true;
        let errorMessage = "";

        console.log(`Key mapping: Detected key "${newKey}" for ${type}`);

        // --- Validation v2 (Check against all 4) ---
        if (newKey.trim() === '') { isValid = false; errorMessage = "Key cannot be empty."; }
        // Prevent assigning modifier keys alone (unless it's the key itself, which is rare but technically possible)
        else if (['Control', 'Shift', 'Alt', 'Meta'].includes(newKey) && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
             isValid = false; errorMessage = "Cannot assign modifier keys alone.";
        }
        else {
             const newKeyLower = newKey.toLowerCase();
             // Get current assignments, converting to lowercase for comparison
             const assignments = {
                 dit: this.currentDitKey.toLowerCase(),
                 dah: this.currentDahKey.toLowerCase(),
                 ditSecondary: this.currentDitKeySecondary.toLowerCase(),
                 dahSecondary: this.currentDahKeySecondary.toLowerCase()
             };

             for (const otherType in assignments) {
                 // Check if the new key is assigned to any *other* type
                 if (otherType !== type && newKeyLower === assignments[otherType]) {
                     isValid = false;
                     // Provide a more specific error message
                     const otherTypeName = otherType.replace('Secondary', ' Secondary').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Format name e.g. "Dah Secondary"
                     errorMessage = `Key "${MorseConfig.getKeyDisplay(newKey)}" is already assigned to ${otherTypeName}.`;
                     break; // Exit loop on first conflict
                 }
             }
        }

        // --- Update or Reject ---
        if (isValid) {
            console.log(`Key mapping: Assigning "${newKey}" to ${type}.`);
            // Assign the new key based on the type we are listening for
            if (type === 'dit') this.currentDitKey = newKey;
            else if (type === 'dah') this.currentDahKey = newKey;
            else if (type === 'ditSecondary') this.currentDitKeySecondary = newKey;
            else if (type === 'dahSecondary') this.currentDahKeySecondary = newKey;

            this._saveSettings(); // Persist the new key
            this._updateKeyMappingDisplay(); // Update UI, resets listening state

            // Notify main.js about the change, passing all four keys
             if (this.callbacks && this.callbacks.onKeyMappingChange) {
                 // Pass all four keys to the callback
                 this.callbacks.onKeyMappingChange({
                     dit: this.currentDitKey, dah: this.currentDahKey,
                     ditSecondary: this.currentDitKeySecondary, dahSecondary: this.currentDahKeySecondary
                 });
             }

             if (inputElement) inputElement.blur(); // Remove focus after successful set

        } else {
            console.warn(`Key mapping: Invalid key "${newKey}" for ${type}. Reason: ${errorMessage}`);
            alert(`Invalid key: ${errorMessage}`);
            // Keep the input in listening state visually
            if (inputElement) inputElement.value = "Listening...";
        }
    }

    /** Handles blur event on key mapping inputs to cancel listening state. */
    _handleKeyMappingBlur(event) {
        // Determine which input was blurred
        let blurredType = null;
        switch (event.target.id) {
            case 'dit-key-input': blurredType = 'dit'; break;
            case 'dah-key-input': blurredType = 'dah'; break;
            case 'dit-key-secondary-input': blurredType = 'ditSecondary'; break;
            case 'dah-key-secondary-input': blurredType = 'dahSecondary'; break;
        }

        // If the blurred element is the one we were actively listening to, cancel.
        if (this.keyInputCurrentlyListening && this.keyInputCurrentlyListening === blurredType) {
            console.log("Key mapping: Blurred while listening, cancelling.");
            this._updateKeyMappingDisplay(); // Reverts display and resets listening state
        }
    }
    // --- End Key Mapping Event Handlers ---


    /** Binds all event listeners managed by the UIManager to their respective callbacks. */
    addEventListeners(callbacks) {
        this.callbacks = callbacks; // Store callbacks from main.js

        // Main Menu Buttons
        this.startGameButton?.addEventListener('click', callbacks.onShowLevelSelect);
        this.showSandboxButton?.addEventListener('click', callbacks.onShowSandbox);
        this.showPlaybackButton?.addEventListener('click', callbacks.onShowPlayback);
        // showSettingsButton click handled by Modal instance

        // Playback Screen
        this.playSentenceButton?.addEventListener('click', callbacks.onPlaySentence);
        this.playbackMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Sandbox Screen
        this.startSandboxButton?.addEventListener('click', callbacks.onStartSandbox);
        this.sandboxInput?.addEventListener('input', callbacks.onSandboxInputChange);
        this.sandboxMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Level Selection Screen
        this.levelListContainer?.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.classList.contains('level-button') && !e.target.disabled) {
                const levelId = parseInt(e.target.dataset.levelId, 10);
                if (callbacks.onLevelSelect) callbacks.onLevelSelect(levelId);
            }
        });
        this.levelSelectMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Results Screen Navigation
        this.resultsMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // --- Settings Modal Content Event Listeners ---
        // WPM Slider
        this.wpmSlider?.addEventListener('input', (e) => this._updateWpmDisplay(parseInt(e.target.value, 10)));
        this.wpmSlider?.addEventListener('change', (e) => { this.currentWpm = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onWpmChange) callbacks.onWpmChange(this.currentWpm); });
        // Frequency Slider
        this.frequencySlider?.addEventListener('input', (e) => this._updateFrequencyDisplay(parseInt(e.target.value, 10)));
        this.frequencySlider?.addEventListener('change', (e) => { this.currentFrequency = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onFrequencyChange) callbacks.onFrequencyChange(this.currentFrequency); });
        // Sound Toggle
        this.soundToggle?.addEventListener('change', (e) => { this.isSoundEnabled = e.target.checked; this._saveSettings(); if (callbacks.onSoundToggle) callbacks.onSoundToggle(this.isSoundEnabled); });
        // Dark Mode Toggle
        this.darkModeToggle?.addEventListener('change', (e) => { this.isDarkModeEnabled = e.target.checked; this._applyDarkMode(this.isDarkModeEnabled); this._saveSettings(); if (callbacks.onDarkModeToggle) callbacks.onDarkModeToggle(this.isDarkModeEnabled); });
        // Reset Settings Button (NEW) - Triggers internal handler which calls callback
        this.resetSettingsButton?.addEventListener('click', this.handleResetSettings.bind(this));
        // Reset Progress Button
        this.resetProgressButton?.addEventListener('click', () => { if (callbacks.onResetProgress) callbacks.onResetProgress(); });
        // Key Mapping Inputs (Primary and Secondary)
        this.ditKeyInput?.addEventListener('click', this._handleKeyMappingInputFocus.bind(this));
        this.dahKeyInput?.addEventListener('click', this._handleKeyMappingInputFocus.bind(this));
        this.ditKeySecondaryInput?.addEventListener('click', this._handleKeyMappingInputFocus.bind(this));
        this.dahKeySecondaryInput?.addEventListener('click', this._handleKeyMappingInputFocus.bind(this));
        this.ditKeyInput?.addEventListener('keydown', this._handleKeyMappingKeyDown.bind(this));
        this.dahKeyInput?.addEventListener('keydown', this._handleKeyMappingKeyDown.bind(this));
        this.ditKeySecondaryInput?.addEventListener('keydown', this._handleKeyMappingKeyDown.bind(this));
        this.dahKeySecondaryInput?.addEventListener('keydown', this._handleKeyMappingKeyDown.bind(this));
        this.ditKeyInput?.addEventListener('blur', this._handleKeyMappingBlur.bind(this)); // Handle blur to cancel listening
        this.dahKeyInput?.addEventListener('blur', this._handleKeyMappingBlur.bind(this));
        this.ditKeySecondaryInput?.addEventListener('blur', this._handleKeyMappingBlur.bind(this));
        this.dahKeySecondaryInput?.addEventListener('blur', this._handleKeyMappingBlur.bind(this));
        // Manual Mode Toggles (Ensure logic uses checked = true = Manual)
        this.ditManualModeToggle?.addEventListener('change', (e) => { this.isDitManualMode = e.target.checked; this._saveSettings(); if (callbacks.onManualModeChange) callbacks.onManualModeChange(this.getCurrentManualModeState()); });
        this.dahManualModeToggle?.addEventListener('change', (e) => { this.isDahManualMode = e.target.checked; this._saveSettings(); if (callbacks.onManualModeChange) callbacks.onManualModeChange(this.getCurrentManualModeState()); });
        // --- End Settings Modal Listeners ---
        // New: Forward Blur Toggle
        this.forwardBlurToggle?.addEventListener('change', (e) => { this.isForwardBlurEnabled = e.target.checked; this._applyForwardBlurSetting(this.isForwardBlurEnabled); this._saveSettings(); if (callbacks.onForwardBlurToggle) callbacks.onForwardBlurToggle(this.isForwardBlurEnabled); });

        // Volume Slider (Game UI)
         this.volumeSlider?.addEventListener('input', (e) => { const newVolume = parseFloat(e.target.value); this._updateSpeakerIcon(newVolume); if (callbacks.onVolumeChange) callbacks.onVolumeChange(newVolume, false); /* false = not final change */ });
         this.volumeSlider?.addEventListener('change', (e) => { const newVolume = parseFloat(e.target.value); this.currentVolume = newVolume; this._saveSettings(); if (callbacks.onVolumeChange) callbacks.onVolumeChange(this.currentVolume, true); /* true = final change */ });

        // Hint Toggle Button (Game UI)
        this.toggleHintButton?.addEventListener('click', () => {
            this.isHintVisible = !this.isHintVisible; // Toggle internal state
            this._saveSettings(); // Save the new state
            // Apply visibility change, respect peek state (applyHintVisibility handles this)
            this._applyHintVisibility(this.isHintVisible, true);
            if (callbacks.onHintToggle) callbacks.onHintToggle(this.isHintVisible); // Notify main.js
        });
        // Game Menu Button (Game UI)
        this.gameMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Window Resize Handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Adjust text display font size on resize
                this._adjustTextDisplayFontSize();
                // Recenter current character if game is active
                const currentSpan = this.textDisplay?.querySelector('.char.current');
                if (currentSpan) {
                    this._centerCurrentCharacterHorizontally(currentSpan);
                }
                 // Update layout sizing based on input area visibility
                 this._updateDisplayAreaSizing();
            }, 150); // Debounce resize events
        });

        console.log("UI Event Listeners Added.");
    }

    // --- Getters for Initial/Current State ---
    getInitialWpm() { return this.currentWpm; }
    getInitialSoundState() { return this.isSoundEnabled; }
    getInitialDarkModeState() { return this.isDarkModeEnabled; }
    getInitialFrequency() { return this.currentFrequency; }
    getInitialHintState() { return this.isHintVisible; }
    getInitialVolume() { return this.currentVolume; }
    getCurrentDitKey() { return this.currentDitKey; }
    getCurrentDahKey() { return this.currentDahKey; }
    getCurrentDitKeySecondary() { return this.currentDitKeySecondary; }
    getCurrentDahKeySecondary() { return this.currentDahKeySecondary; }
    getCurrentDitManualState() { return this.isDitManualMode; } // Checked = true = Manual
    getCurrentDahManualState() { return this.isDahManualMode; } // Checked = true = Manual
    getInitialForwardBlurState() { return this.isForwardBlurEnabled; } // New Getter
    getCurrentManualModeState() { return { ditManual: this.isDitManualMode, dahManual: this.isDahManualMode }; }
    getPlaybackSentence() { return this.playbackInput ? this.playbackInput.value : ""; }
    getSandboxSentence() { return this.sandboxInput ? this.sandboxInput.value : ""; }
}

// Ensure this runs after config.js
// Create the single instance after the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (!window.morseUIManager) {
        window.morseUIManager = new UIManager();
    } else {
        console.warn("UIManager instance already exists.");
    }
});

/*
// --- Usage Example --- (Conceptual)
// Assuming main.js initializes UI Manager:
// const uiManager = window.morseUIManager;
//
// uiManager.addEventListeners({
//   onWpmChange: (newWpm) => { console.log("WPM changed to:", newWpm); },
//   onResetSettings: (settings) => { console.log("Settings Reset:", settings); }, // Settings obj includes secondary keys
//   onKeyMappingChange: (mappings) => { console.log("Keys changed:", mappings); }, // Mappings obj includes secondary keys
//   onForwardBlurToggle: (enabled) => { console.log("Forward Blur Toggled:", enabled); }, // Example for new setting
//   // ... other callbacks
// });
//
// // To show the game interface:
// uiManager.showGameUI();
//
// // To render a sentence:
// uiManager.renderSentence("HELLO WORLD");
//
// // To highlight the first character:
// uiManager.highlightCharacter(0, 'H');
//
// // To update character state:
// uiManager.updateCharacterState(0, 'completed');
//
// // To show incorrect pattern feedback:
// uiManager.setPatternDisplayState('incorrect');
*/