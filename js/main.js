/* File: js/main.js */
/**
 * js/main.js
 * ----------
 * Entry point for the Dit-Dah-Dash application.
 * Initializes modules, sets up event listeners, manages UI view transitions,
 * handles settings changes (WPM, frequency, sound, dark mode, keys [primary & secondary], manual mode),
 * controls game logic flow, and manages the results screen actions.
 * Version History:
 * - v1.0 - Initial setup.
 * - v1.1 - Modified startSandboxPractice to use default sentence if input is empty.
 * - v1.2 (WebDevPro) - Modified startSandboxPractice to use random sentence from js/sandboxSentences.js.
 * - v1.3 - Updated settings initialization/application to include secondary keys.
 * - v1.4 - Added Forward Blur setting application.
 * - v1.5 - Ensure forward blur effect is updated on character changes.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Dit-Dah-Dash Initializing...");

    // --- Module Instances ---
    const uiManager = window.morseUIManager;
    if (!uiManager) {
        console.error("FATAL: UIManager failed to initialize. Cannot proceed.");
        alert("Error: UI failed to load. Please refresh.");
        return;
    }
    const gameState = window.morseGameState;
    const decoder = window.morseDecoder;
    const audioPlayer = window.morseAudioPlayer;
    const levelManager = window.morseLevelManager;
    const scoreCalculator = window.morseScoreCalculator;
    let inputHandler = null; // Initialized after initial settings are known
    let settingsModal = null;

    let gameTimerIntervalId = null;

    // --- Initialization ---
    /**
     * Initializes all application components, loads settings, and sets up listeners.
     */
    function initializeApp() {
        audioPlayer.initializeAudioContext(); // Attempt early init
        initializeSettingsModal();

        // Load settings via UIManager (happens in its constructor)
        // Get initial state AFTER UIManager loads them
        // getCurrentKeybindings() now returns all four keys
        const initialKeys = window.getCurrentKeybindings();
        const initialManualModes = {
            ditManual: uiManager.getCurrentDitManualState(),
            dahManual: uiManager.getCurrentDahManualState()
        };


        initializeInputHandler(initialKeys, initialManualModes); // Pass all four keys & modes
        applyInitialSettings();   // Apply other settings
        setupEventListeners();
        showMainMenu(); // Show main menu initially
        console.log("Dit-Dah-Dash Initialized.");
    }

    /**
     * Initializes the settings modal functionality using the Modal class.
     */
    function initializeSettingsModal() {
        if (settingsModal) return;
        const openButtonId = uiManager?.showSettingsButton?.id || 'show-settings-button';
        settingsModal = new Modal(
            'settings-modal',
            openButtonId,
            'settings-close-button',
            'settings-modal-header',
            handleShowSettings,
            handleHideSettings
        );
        console.log("Settings Modal initialized.");
    }

    /**
     * Applies initial settings loaded by UIManager to various modules.
     */
    function applyInitialSettings() {
        applyWpmSetting(uiManager.getInitialWpm());
        applyFrequencySetting(uiManager.getInitialFrequency());
        applySoundSetting(uiManager.getInitialSoundState());
        applyVolumeSetting(uiManager.getInitialVolume());
        applyManualModeSetting(uiManager.getCurrentManualModeState()); // Apply manual mode
        applyForwardBlurSetting(uiManager.getInitialForwardBlurState()); // Apply initial forward blur
        // Key mappings applied during InputHandler initialization using initialKeys
        // Dark mode & hint visibility applied by UIManager constructor
    }

    /**
     * Creates the InputHandler instance.
     * @param {object} initialKeys - Initial keybindings { dit, dah, ditSecondary, dahSecondary }.
     * @param {object} initialManualModes - Initial manual mode states { ditManual: boolean, dahManual: boolean }.
     */
    function initializeInputHandler(initialKeys, initialManualModes) {
        if (inputHandler) return;
        inputHandler = new InputHandler(
            gameState,
            decoder,
            audioPlayer,
            uiManager,
            { // Callbacks object
                onInput: handleInputHandlerInput,
                onCharacterDecode: handleCharacterDecode,
                onResultsInput: handleResultsInput
            },
            initialKeys, // Pass all four initial keys
            initialManualModes // Pass initial manual modes
        );
        console.log("InputHandler initialized.");
    }

    /**
     * Registers event listeners for UI interactions managed by UIManager.
     */
    function setupEventListeners() {
        uiManager.addEventListeners({
            // Navigation
            onShowLevelSelect: handleShowLevelSelect,
            onShowSandbox: handleShowSandboxInput,
            onShowPlayback: handleShowPlayback,
            onShowMainMenu: showMainMenu,
            // Settings Modal open/close handled by Modal instance

            // Actions
            onPlaySentence: playSentenceFromInput,
            onStartSandbox: startSandboxPractice, // Changed to trigger random sentence selection
            onSandboxInputChange: updateSandboxPreview, // Still useful for the preview box
            onLevelSelect: selectLevel,

            // Settings Value Changes (from UIManager elements)
            onWpmChange: applyWpmSetting,
            onFrequencyChange: applyFrequencySetting,
            onSoundToggle: applySoundSetting,
            onVolumeChange: applyVolumeSetting,
            onDarkModeToggle: applyDarkModeSetting,
            onHintToggle: applyHintSetting,
            onKeyMappingChange: handleKeyMappingChange, // Expects all four keys now
            onManualModeChange: handleManualModeChange, // Callback for manual mode changes
            onForwardBlurToggle: applyForwardBlurSetting, // New: Forward Blur callback
            onResetProgress: resetProgress, // Handles progress reset
            onResetSettings: handleSettingsResetNotification, // Handles notification *after* UIManager resets
        });

        // Prime audio context on first touch interaction for mobile compatibility
        const primeAudioContext = () => {
            console.log("Priming audio context via global touchstart...");
            audioPlayer.initializeAudioContext();
            document.body.removeEventListener('touchstart', primeAudioContext, { capture: true });
        };
        document.body.addEventListener('touchstart', primeAudioContext, { passive: true, capture: true });
    }

    // --- UI View Transitions & State Management ---

    /**
     * Resets state and displays the main menu.
     */
    function showMainMenu() {
        console.log("Navigating to Main Menu...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.MENU;
        gameState.currentMode = AppMode.MENU;
        uiManager.showMainMenu();
    }

    /**
     * Resets state (if needed) and displays the level selection screen.
     */
    function handleShowLevelSelect() {
        console.log("Navigating to Level Select...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        // Reset state only if coming from a non-game context or results
        if (gameState.currentMode !== AppMode.GAME || gameState.status === GameStatus.SHOWING_RESULTS) {
            gameState.reset();
        }
        gameState.status = GameStatus.LEVEL_SELECT;
        gameState.currentMode = AppMode.GAME;
        const levels = levelManager.getAllLevelsWithStatus();
        uiManager.showLevelSelectionScreen(levels);
    }

    /**
     * Resets state and displays the sandbox setup UI.
     */
    function handleShowSandboxInput() {
        console.log("Navigating to Sandbox Input...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.SANDBOX_INPUT;
        gameState.currentMode = AppMode.SANDBOX;
        uiManager.showSandboxUI();
        updateSandboxPreview(); // Update preview based on input (though input not used for start)
    }

    /**
     * Resets state and displays the sentence playback UI.
     */
    function handleShowPlayback() {
        console.log("Navigating to Playback...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.PLAYBACK_INPUT;
        gameState.currentMode = AppMode.PLAYBACK;
        uiManager.showPlaybackUI();
    }

    /**
     * Pauses game timer and updates state when settings modal is shown.
     */
    function handleShowSettings() {
        console.log("Navigating to Settings...");
        if (gameState.isPlaying() || gameState.status === GameStatus.READY) {
            stopGameUpdateTimer(); // Stop live stats update
            // Optional: Implement a proper pause state if needed
        }
        gameState.status = GameStatus.SETTINGS;
        gameState.currentMode = AppMode.SETTINGS;
        // Modal opening is handled by the Modal instance
    }

     /**
     * Updates state when settings modal is hidden, typically returning to the main menu.
     */
     function handleHideSettings() {
        console.log("Exiting Settings...");
        // Default return to main menu for simplicity. Could restore previous state if implemented.
        showMainMenu();
    }

    // --- Game/Sandbox Mode Logic ---

    /**
     * Starts a specific game level and sentence.
     * @param {number} levelId - The ID of the level.
     * @param {number} [sentenceIndex=0] - The index of the sentence within the level.
     */
    function startGameLevel(levelId, sentenceIndex = 0) {
        console.log(`Attempting to start Level ${levelId}, Sentence ${sentenceIndex + 1}`);
        const sentenceText = levelManager.getSpecificSentence(levelId, sentenceIndex);
        if (sentenceText === null) {
            console.error(`Cannot start level: Invalid levelId ${levelId} / sentenceIndex ${sentenceIndex}.`);
            showMainMenu(); return;
        }

        gameState.startLevelSentence(levelId, sentenceIndex, sentenceText);
        applyCurrentSettingsToModules(); // Apply WPM, Freq, Volume, Keys (all 4), Manual Modes
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay();

        const firstCharIndex = gameState.currentCharIndex;
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(firstCharIndex, firstChar);
            // uiManager.updateForwardBlurEffect(); // Apply blur after highlighting - highlightCharacter does this now
        } else if (sentenceText.trim().length === 0){
            console.warn("Starting level with empty or whitespace-only sentence.");
            gameState.status = GameStatus.FINISHED;
            handleSentenceFinished();
            return;
        } else {
             console.error("Could not get first character even though sentence is not empty.");
             uiManager.updateTargetPatternDisplay("");
        }

        stopGameUpdateTimer();
        console.log("Game ready.");
    }

    /**
     * Starts the Sandbox mode.
     * If the sandbox input field is empty, selects a random sentence from sandboxSentences.js.
     * Otherwise, uses the sentence provided by the user in the input field.
     */
    function startSandboxPractice() {
        let sentenceText = "ERROR NO SENTENCES LOADED"; // Default error sentence
        let randomSentenceSelected = false;

        const userInputSentence = uiManager.getSandboxSentence().trim().toUpperCase();

        if (userInputSentence) {
            // Use user's input sentence
            sentenceText = userInputSentence;
            console.log(`Using user-provided sandbox sentence: "${sentenceText}"`);
        } else if (typeof sandboxSentences !== 'undefined' && Array.isArray(sandboxSentences) && sandboxSentences.length > 0) {
            // User input is empty, select a random sentence
            const randomIndex = Math.floor(Math.random() * sandboxSentences.length);
            sentenceText = sandboxSentences[randomIndex].trim().toUpperCase(); // Use trimmed, uppercase version
            randomSentenceSelected = true;
            console.log(`Selected random sandbox sentence (${randomIndex + 1}/${sandboxSentences.length}): "${sentenceText}"`);
        } else {
            console.error("Sandbox sentences array ('sandboxSentences') is not defined, empty, or not an array. Using fallback sentence.");
            // Optionally, provide feedback to the user in the UI
            uiManager.updateSandboxMorsePreview("Error: Sentence list unavailable.");
        }

        // Ensure the chosen sentence (random or error fallback) is not empty
        if (!sentenceText || !sentenceText.trim()) {
            console.warn("Selected sentence (random or fallback) is empty or whitespace. Using generic fallback.");
            sentenceText = "SANDBOX FALLBACK"; // Final fallback
        }

        console.log(`Attempting to start Sandbox with: "${sentenceText}"`);

        gameState.startSandboxSentence(sentenceText);
        applyCurrentSettingsToModules(); // Apply WPM, Freq, Volume, Keys (all 4), Manual Modes
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText); // Render the chosen sentence
        uiManager.resetStatsDisplay();

        const firstCharIndex = gameState.currentCharIndex;
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(firstCharIndex, firstChar);
            // uiManager.updateForwardBlurEffect(); // Apply blur after highlighting - highlightCharacter does this now
        } else {
            // This should only happen if the final fallback sentence is somehow invalid
            console.error("Could not get first character for sandbox sentence.");
            gameState.status = GameStatus.FINISHED; // Treat as finished if unstartable
            handleSentenceFinished();
            return;
        }
        stopGameUpdateTimer();
        console.log("Sandbox ready.");
    }


    /**
     * Handles the selection of a level from the level list UI.
     * @param {number} levelId - The ID of the selected level.
     */
    function selectLevel(levelId) {
        console.log(`Level ${levelId} selected from list.`);
        if (gameState.status !== GameStatus.LEVEL_SELECT) {
            console.warn(`selectLevel called but status is not LEVEL_SELECT (${gameState.status})`);
            return;
        }
        if (levelManager.isLevelUnlocked(levelId)) {
            startGameLevel(levelId, 0);
        } else {
            console.warn(`Attempted to select locked level: ${levelId}`);
            // Optional: Show feedback to user that level is locked
        }
     }

    // --- Input Handling Callbacks (from InputHandler) ---

    /**
     * Callback executed when the InputHandler registers a dit or dah input during gameplay.
     * Starts the game timer if it's the first input.
     * @param {string} inputChar - '.' or '-'.
     */
    function handleInputHandlerInput(inputChar) {
        // Start timer on first input if ready
        if (gameState.status === GameStatus.READY && (gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            if (gameState.startTimer()) {
                 startGameUpdateTimer(); // Start updating live stats display
            }
        }
        // Input is added to gameState sequence by InputHandler itself
    }

    /**
     * Callback executed when the InputHandler determines a character decode should occur.
     * Decodes the sequence, compares to target, updates UI and game state accordingly.
     */
    function handleCharacterDecode() {
        // Guard against decoding in wrong state/mode
        if (gameState.status !== GameStatus.DECODING || !(gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            console.warn("handleCharacterDecode called in unexpected state/mode:", gameState.status, gameState.currentMode);
            if (gameState.status === GameStatus.DECODING) gameState.status = GameStatus.LISTENING; // Revert if stuck
            return;
        }

        const sequence = gameState.currentInputSequence;
        const targetChar = gameState.getTargetCharacter(); // Uppercase target

        // --- Clear Input Sequence AFTER getting it ---
        gameState.clearCurrentInput(); // This also clears the UI display and sets state to LISTENING

        // If sequence was empty (e.g., timeout without input), just reset state and re-display hint
        if (!sequence) {
            console.log("Decode triggered with empty sequence.");
            // gameState.clearCurrentInput already set state to LISTENING
            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? ""); // Re-display hint
                uiManager.updateForwardBlurEffect(); // Re-apply blur in case state was disrupted
            }
            uiManager.setPatternDisplayState('default'); // Ensure default pattern style
            return;
        }

        // --- Decode and Compare ---
        const decodedChar = decoder.decodeSequence(sequence); // Uppercase result or null

        if (decodedChar && targetChar && decodedChar === targetChar) {
            // --- CORRECT ---
            uiManager.updateCharacterState(gameState.currentCharIndex, 'completed'); // Mark char in sentence
            // NOTE: updateForwardBlurEffect is called within updateCharacterState when state is 'completed'
            uiManager.setPatternDisplayState('correct'); // Green flash patterns

            const moreChars = gameState.moveToNextCharacter(); // Advances index, resets state internally

            if (moreChars) {
                // Highlight the new target character and update hint
                const nextCharIndex = gameState.currentCharIndex;
                const nextCharRaw = gameState.getTargetCharacterRaw(); // Get raw char for highlight
                if (nextCharRaw !== null) {
                    uiManager.highlightCharacter(nextCharIndex, nextCharRaw); // Updates hint pattern & forward blur
                }
            } else {
                // --- SENTENCE FINISHED ---
                handleSentenceFinished(); // Stop timer, calculate scores, show results
            }
        } else {
            // --- INCORRECT ---
            gameState.registerIncorrectAttempt();
            uiManager.updateCharacterState(gameState.currentCharIndex, 'incorrect'); // Red flash char in sentence
            audioPlayer.playIncorrectSound(); // Play error sound
            uiManager.setPatternDisplayState('incorrect'); // Red flash patterns

            // Reset state to listening for the same character
            // gameState.clearCurrentInput already set state to LISTENING
            // Re-display hint for the current character
            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
                uiManager.updateForwardBlurEffect(); // Re-apply blur after incorrect attempt
            } else {
                uiManager.updateTargetPatternDisplay(""); // Clear hint if no target (shouldn't happen here)
            }
        }
    }


    /**
     * Handles the completion of a sentence (game or sandbox).
     * Stops timer, calculates scores, records progress (game mode), shows results screen.
     */
    function handleSentenceFinished() {
        // Prevent multiple calls if already showing results or back at menu
        if (gameState.status === GameStatus.SHOWING_RESULTS || gameState.status === GameStatus.MENU) return;

        // Ensure timer is stopped and state is FINISHED
        if (gameState.status !== GameStatus.FINISHED) {
            gameState.stopTimer(); // This sets status to FINISHED
        }
        // Double-check status as stopTimer might fail if never started
        if (gameState.status !== GameStatus.FINISHED) {
             console.warn("handleSentenceFinished: State was not FINISHED after stopping timer. Forcing FINISHED state.");
             gameState.status = GameStatus.FINISHED;
        }


        stopGameUpdateTimer(); // Stop any live stat updates

        const scores = scoreCalculator.calculateScores(gameState);

        let unlockedNextLevelId = null;
        let hasNextLevelOption = false;

        // Handle level progression and unlocks only in Game mode
        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null) {
            const unlockResult = levelManager.recordScoreAndCheckUnlocks(gameState.currentLevelId, scores);
            unlockedNextLevelId = unlockResult.unlockedNextLevelId;

            // Determine if a "Next" option should be available
            const nextSentenceDetails = levelManager.getNextSentence(gameState);
            hasNextLevelOption = nextSentenceDetails !== null && levelManager.isLevelUnlocked(nextSentenceDetails.levelId);
        } else {
            // Sandbox mode never unlocks levels or has a "next" level
            hasNextLevelOption = false;
        }

        uiManager.updateForwardBlurEffect(); // Clear blur on results screen
        uiManager.showResultsScreen(scores, unlockedNextLevelId, hasNextLevelOption, gameState.currentMode);
        // gameState.status is set to SHOWING_RESULTS *inside* showResultsScreen now (implicitly)
        // but we should explicitly set it here for consistency
        gameState.status = GameStatus.SHOWING_RESULTS;
        console.log(`${gameState.currentMode} sentence finished, showing results.`);
    }

    // --- Results Screen Input Handling ---

    /**
     * Callback executed when InputHandler registers input on the results screen.
     * @param {'dit' | 'dah'} type - The input type.
     */
    function handleResultsInput(type) {
        if (gameState.status !== GameStatus.SHOWING_RESULTS) return;

        if (type === 'dit') {
            // Dit always retries the last sentence (Game or Sandbox)
            retryLevel();
        } else if (type === 'dah') {
            // Dah behavior depends on the mode
            if (gameState.currentMode === AppMode.SANDBOX) {
                // In Sandbox mode, Dah starts a new random sentence
                console.log("Results Input: Starting new random Sandbox sentence.");
                startSandboxPractice();
            } else {
                // In Game mode, Dah attempts to go to the next level/sentence
                nextLevel(); // Attempt to go to next level/sentence
            }
        }
    }

    // --- Game Timer for Live Stats ---

    /**
     * Starts the interval timer to update the displayed stats (time) during gameplay.
     */
    function startGameUpdateTimer() {
        stopGameUpdateTimer(); // Ensure no duplicates
        gameTimerIntervalId = setInterval(() => {
            // Only update if actively playing (timer running, not paused/finished)
            if (gameState.isPlaying() && gameState.startTime > 0) {
                const elapsed = gameState.getCurrentElapsedTime();
                uiManager.updateTimer(elapsed);
            } else if (gameTimerIntervalId) {
                 // Stop if no longer in an active playing state
                 stopGameUpdateTimer();
            }
        }, 100); // Update ~10 times per second
    }

    /**
     * Clears the interval timer for live stat updates.
     */
    function stopGameUpdateTimer() {
        if (gameTimerIntervalId !== null) {
            clearInterval(gameTimerIntervalId);
            gameTimerIntervalId = null;
        }
    }

    // --- Settings Handlers ---

    /**
     * Applies the WPM setting to relevant modules.
     * @param {number} wpm - Words Per Minute.
     */
    function applyWpmSetting(wpm) {
        if (wpm > 0) {
            decoder.updateWpm(wpm);
            audioPlayer.updateWpm(wpm);
            if (inputHandler) inputHandler.updateWpm(wpm);
            console.log(`Setting Applied: WPM = ${wpm}`);
        }
    }

    /**
     * Applies the audio tone frequency setting.
     * @param {number} freq - Frequency in Hz.
     */
    function applyFrequencySetting(freq) {
        if (freq >= MorseConfig.AUDIO_MIN_FREQUENCY && freq <= MorseConfig.AUDIO_MAX_FREQUENCY) {
            audioPlayer.updateFrequency(freq);
            console.log(`Setting Applied: Frequency = ${freq} Hz`);
        }
    }

    /**
     * Applies the sound enabled/disabled setting.
     * @param {boolean} isEnabled - True to enable sound, false to disable.
     */
    function applySoundSetting(isEnabled) {
        audioPlayer.setSoundEnabled(isEnabled);
        console.log(`Setting Applied: Sound Enabled = ${isEnabled}`);
    }

    /**
     * Applies the master volume setting.
     * @param {number} level - Volume level (0.0 to 1.0).
     * @param {boolean} [isFinalChange=true] - Whether this is the final change event (e.g., slider release).
     */
    function applyVolumeSetting(level, isFinalChange = true) {
        const volumeLevel = parseFloat(level);
        if (!isNaN(volumeLevel) && volumeLevel >= 0 && volumeLevel <= 1) {
            audioPlayer.setVolume(volumeLevel);
            if (isFinalChange) { // Log only final change to avoid spam
                console.log(`Setting Applied: Volume = ${volumeLevel.toFixed(2)}`);
            }
        }
    }

    /**
     * Applies the dark mode setting (handled visually by UIManager).
     * @param {boolean} isEnabled - True for dark mode, false for light mode.
     */
    function applyDarkModeSetting(isEnabled) {
        console.log(`Setting Applied: Dark Mode = ${isEnabled}`);
        // UI class is toggled directly within UIManager's _applyDarkMode
    }

    /**
     * Applies the forward blur setting (handled visually by UIManager).
     * @param {boolean} isEnabled - True to enable the effect.
     */
    function applyForwardBlurSetting(isEnabled) {
        console.log(`Setting Applied: Forward Blur = ${isEnabled}`);
        // UI class/state is toggled directly within UIManager's _applyForwardBlurSetting
    }
    /**
     * Applies the hint visibility setting (handled visually by UIManager).
     * @param {boolean} isVisible - True to show hint by default, false to hide.
     */
    function applyHintSetting(isVisible) {
        console.log(`Setting Applied: Hint Visible = ${isVisible}`);
        // UI class/state is toggled directly within UIManager's _applyHintVisibility
    }

    /**
     * Handles changes to key mappings from the UIManager settings inputs.
     * Updates the InputHandler.
     * @param {object} newMappings - { dit, dah, ditSecondary, dahSecondary }.
     */
    function handleKeyMappingChange(newMappings) {
        if (inputHandler) {
            inputHandler.updateKeyMappings(newMappings); // Pass all four keys
            console.log(`Setting Applied: Key Mappings = Dit '${newMappings.dit}', Dah '${newMappings.dah}', Dit2 '${newMappings.ditSecondary}', Dah2 '${newMappings.dahSecondary}'`);
            // Update results screen instructions dynamically if visible
            if (gameState.status === GameStatus.SHOWING_RESULTS) {
                // Display only primary keys in the results hint
                uiManager.updateResultsInstructionsKeyHints(newMappings.dit, newMappings.dah);
            }
        } else {
            console.error("Cannot update key mappings: InputHandler not initialized.");
        }
    }

    /**
     * Handles changes to manual mode toggles from UIManager.
     * Applies the change to the input handler.
     * @param {object} newModes - { ditManual: boolean, dahManual: boolean }.
     */
    function handleManualModeChange(newModes) {
        applyManualModeSetting(newModes); // Applies the change to the input handler
    }

     /**
      * Applies manual mode settings to the InputHandler.
      * @param {object} manualModes - { ditManual: boolean, dahManual: boolean }.
      */
    function applyManualModeSetting(manualModes) {
        if (inputHandler) {
            inputHandler.updateManualMode(manualModes);
             console.log(`Setting Applied: Manual Mode = Dit ${manualModes.ditManual}, Dah ${manualModes.dahManual}`);
        } else {
             console.error("Cannot update manual mode: InputHandler not initialized.");
        }
    }

    /**
     * Callback executed after UIManager has reset settings to default.
     * Applies the reset defaults to all relevant modules.
     * @param {object} resetSettings - The object containing all default settings values (including secondary keys).
     */
     function handleSettingsResetNotification(resetSettings) {
        console.log("Main.js notified of settings reset. Applying defaults to modules...");
        applyWpmSetting(resetSettings.wpm);
        applyFrequencySetting(resetSettings.frequency);
        applySoundSetting(resetSettings.soundEnabled);
        applyVolumeSetting(resetSettings.volume);
        applyDarkModeSetting(resetSettings.darkMode);
        applyHintSetting(resetSettings.hintVisible);
        applyForwardBlurSetting(resetSettings.forwardBlur); // New: Apply blur reset
        // Pass all four reset keys to the handler
        handleKeyMappingChange({
            dit: resetSettings.ditKey, dah: resetSettings.dahKey,
            ditSecondary: resetSettings.ditKeySecondary, dahSecondary: resetSettings.dahKeySecondary
        });
        applyManualModeSetting({ ditManual: resetSettings.ditManual, dahManual: resetSettings.dahManual });
        console.log("Main.js: Applied reset settings to modules.");
    }


    /**
     * Ensures all modules (Decoder, AudioPlayer, InputHandler) have the latest settings
     * before starting a game or sandbox session. Reads current settings from UIManager/Config.
     */
    function applyCurrentSettingsToModules() {
        // Get current settings state
        const currentWpm = uiManager.getInitialWpm();
        const currentFreq = uiManager.getInitialFrequency();
        const soundEnabled = uiManager.getInitialSoundState();
        const currentVolume = uiManager.getInitialVolume();
        const isBlurEnabled = uiManager.getInitialForwardBlurState(); // New: Get blur state
        // Get all four keys using the updated function from config.js
        const currentKeys = window.getCurrentKeybindings();
         const currentManualModes = {
             ditManual: uiManager.getCurrentDitManualState(),
             dahManual: uiManager.getCurrentDahManualState()
         };

        // Ensure InputHandler is initialized (safety check)
        if (!inputHandler) {
            console.warn("InputHandler not initialized during applyCurrentSettingsToModules. Initializing now.");
            initializeInputHandler(currentKeys, currentManualModes);
        }

        // Apply settings to relevant modules
        applyWpmSetting(currentWpm);
        applyFrequencySetting(currentFreq);
        applySoundSetting(soundEnabled);
        applyVolumeSetting(currentVolume);
        applyForwardBlurSetting(isBlurEnabled); // New: Apply blur setting
        // Use specific handlers to ensure InputHandler gets updated with all keys
        handleKeyMappingChange(currentKeys);
        applyManualModeSetting(currentManualModes); // Apply manual mode

        // Ensure audio context is ready if sound is enabled
        if (soundEnabled) {
             const audioReady = audioPlayer.initializeAudioContext();
             if (!audioReady) {
                 console.warn("AudioContext could not be initialized/resumed before starting game/sandbox.");
                 // Optionally disable sound visually or show a warning?
             }
        }
        console.log("Applied current settings to modules before start.");
    }

    // --- Navigation/Action Helpers ---

    /**
     * Restarts the current level/sentence (Game mode) or the last sandbox sentence.
     */
    function retryLevel() {
        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null && gameState.currentSentenceIndex !== null) {
            console.log(`Retrying Level ${gameState.currentLevelId}, Sentence ${gameState.currentSentenceIndex + 1}`);
            // Restart the exact same sentence
            startGameLevel(gameState.currentLevelId, gameState.currentSentenceIndex);
        } else if (gameState.currentMode === AppMode.SANDBOX && gameState.currentSentence) {
            console.log("Retrying Sandbox sentence.");
            // Re-use the current sentence stored in gameState for retry
            // NOTE: This retains the *last used* sentence, not a new random one.
            // If a *new* random sentence is desired on retry, call startSandboxPractice() directly.
            const sentenceToRetry = gameState.currentSentence;
            gameState.startSandboxSentence(sentenceToRetry); // Re-init state with same sentence
            applyCurrentSettingsToModules();
            uiManager.showGameUI();
            uiManager.renderSentence(sentenceToRetry);
            uiManager.resetStatsDisplay();
            const firstCharIndex = gameState.currentCharIndex;
            const firstChar = gameState.getTargetCharacterRaw();
            if (firstChar !== null) uiManager.highlightCharacter(firstCharIndex, firstChar);
            uiManager.updateForwardBlurEffect(); // Ensure blur is updated on retry
            stopGameUpdateTimer();
            console.log("Sandbox retry ready.");

        } else {
            console.warn("Retry called in invalid state, returning to main menu.");
            showMainMenu();
        }
    }

    /**
     * Attempts to start the next sentence or level (Game mode only).
     * If no next level/sentence is available or unlocked, navigates to level select.
     */
    function nextLevel() {
        // NEXT only makes sense in GAME mode
        if (gameState.currentMode !== AppMode.GAME || gameState.currentLevelId === null) {
            console.warn("Next Level called outside Game mode or without level ID, returning to level select.");
            handleShowLevelSelect(); // Go back to level select if no logical next
            return;
        }

        const next = levelManager.getNextSentence(gameState);

        if (next && levelManager.isLevelUnlocked(next.levelId)) {
            console.log(`Moving to next: Level ${next.levelId}, Sentence ${next.sentenceIndex + 1}`);
            startGameLevel(next.levelId, next.sentenceIndex);
        } else {
            console.log("No next level/sentence available or unlocked, returning to level select.");
            handleShowLevelSelect(); // Go back to level select if no more levels
        }
    }

    /**
     * Resets game progress (high scores, unlocks) and restores settings to defaults.
     * Prompts the user for confirmation.
     */
    function resetProgress() {
        if (confirm("Reset all high scores and level progress? This cannot be undone.\n(Keybindings, WPM, and other settings will remain unchanged unless Reset Settings is used.)")) {
            levelManager.resetProgress();
            // Only reset progress, do NOT reset settings here. That's a separate button.
            alert("Progress reset.");
            // Navigate to level select after resetting progress
            handleShowLevelSelect();
        }
    }

    // --- Playback Mode Logic ---

    /**
     * Plays the Morse code audio for the sentence entered in the playback input field.
     */
    function playSentenceFromInput() {
        // If already playing, stop playback
        if (gameState.isAudioPlayingBack() || audioPlayer.isCurrentlyPlayingBack) {
            audioPlayer.stopPlayback(); // Stops playback and resets audio player state
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse');
            // Ensure game state reflects stopping
            if (gameState.status === GameStatus.PLAYING_BACK) {
                gameState.status = GameStatus.PLAYBACK_INPUT;
            }
            console.log("Playback stopped by user.");
            return;
        }

        const sentence = uiManager.getPlaybackSentence();
        if (!sentence || !sentence.trim()) {
            alert("Please enter a sentence to play.");
            return;
        }

        applyCurrentSettingsToModules(); // Ensure WPM is current for playback timing

        const morseSequence = decoder.encodeSentence(sentence);
        // Format for display (replace markers with spaces)
        const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' ');
        uiManager.updatePlaybackMorseDisplay(displayMorse);

        if (!morseSequence) {
            alert("Could not generate Morse code for the input sentence.");
            return;
        }

        uiManager.setPlaybackButtonEnabled(false, 'Stop Playback'); // Update button state

        // Start playback
        gameState.status = GameStatus.PLAYING_BACK; // Set state BEFORE starting playback
        audioPlayer.playMorseSequence(morseSequence, () => {
            // Completion callback from AudioPlayer
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse'); // Reset button state
            // Reset state only if it wasn't changed elsewhere (e.g., user navigated away)
            if (gameState.status === GameStatus.PLAYING_BACK) {
                 gameState.status = GameStatus.PLAYBACK_INPUT;
            }
            console.log("Playback complete.");
        });
    }

    // --- Sandbox Mode Logic ---

    /**
     * Updates the Morse code preview in the sandbox UI based on the input field content.
     * Note: This preview is informational; the input field content is NOT used to start practice.
     */
    /**
     * Updates the Morse code preview in the sandbox UI based on the input field content.
     * Note: This preview is informational; the input field content is NOT used to start practice.
     */
    function updateSandboxPreview() {
        const sentence = uiManager.getSandboxSentence(); // Get content from (now readonly) input
        if (sentence && sentence.trim()) {
            applyCurrentSettingsToModules(); // Ensure decoder uses current WPM for preview
            const morseSequence = decoder.encodeSentence(sentence);
            const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' ');
            uiManager.updateSandboxMorsePreview(displayMorse);
        } else {
            // Use placeholder text if input is empty
            uiManager.updateSandboxMorsePreview("Preview will show here if you type...");
        }
    }

    // --- App Initialization ---
    initializeApp(); // Start the application

}); // End DOMContentLoaded