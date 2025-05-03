/* Dit-Dah-Dash/js/main.js */
/* In file: js/main.js */
/**
 * js/main.js
 * ----------
 * Entry point for the Dit-Dah-Dash application.
 * Initializes modules, sets up event listeners, manages UI view transitions,
 * handles settings changes (WPM, frequency, sound, dark mode, keys, manual mode),
 * controls game logic flow, and manages the results screen actions.
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
    function initializeApp() {
        audioPlayer.initializeAudioContext(); // Attempt early init
        initializeSettingsModal();

        // Load settings via UIManager (happens in its constructor)
        // Get initial state AFTER UIManager loads them
        const initialKeys = {
            dit: uiManager.getCurrentDitKey(),
            dah: uiManager.getCurrentDahKey()
        };
        const initialManualModes = {
            ditManual: uiManager.getCurrentDitManualState(),
            dahManual: uiManager.getCurrentDahManualState()
        };


        initializeInputHandler(initialKeys, initialManualModes); // Pass keys & modes
        applyInitialSettings();   // Apply other settings
        setupEventListeners();
        showMainMenu(); // Show main menu initially
        console.log("Dit-Dah-Dash Initialized.");
    }

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

    function applyInitialSettings() {
        applyWpmSetting(uiManager.getInitialWpm());
        applyFrequencySetting(uiManager.getInitialFrequency());
        applySoundSetting(uiManager.getInitialSoundState());
        applyVolumeSetting(uiManager.getInitialVolume());
        applyManualModeSetting(uiManager.getCurrentManualModeState()); // Apply manual mode
        // Key mappings applied during InputHandler initialization
        // Dark mode & hint visibility applied by UIManager constructor
    }

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
            initialKeys, // Pass initial keys
            initialManualModes // Pass initial manual modes
        );
        console.log("InputHandler initialized.");
    }

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
            onStartSandbox: startSandboxPractice,
            onSandboxInputChange: updateSandboxPreview,
            onLevelSelect: selectLevel,

            // Settings Value Changes (from UIManager elements)
            onWpmChange: applyWpmSetting,
            onFrequencyChange: applyFrequencySetting,
            onSoundToggle: applySoundSetting,
            onVolumeChange: applyVolumeSetting,
            onDarkModeToggle: applyDarkModeSetting,
            onHintToggle: applyHintSetting,
            onKeyMappingChange: handleKeyMappingChange,
            onManualModeChange: handleManualModeChange, // Callback for manual mode changes
            onResetProgress: resetProgress,
        });

        const primeAudioContext = () => {
            console.log("Priming audio context via global touchstart...");
            audioPlayer.initializeAudioContext();
            document.body.removeEventListener('touchstart', primeAudioContext, { capture: true });
        };
        document.body.addEventListener('touchstart', primeAudioContext, { passive: true, capture: true });
    }

    // --- UI View Transitions & State Management ---
    function showMainMenu() {
        console.log("Navigating to Main Menu...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.MENU;
        gameState.currentMode = AppMode.MENU;
        uiManager.showMainMenu();
    }

    function handleShowLevelSelect() {
        console.log("Navigating to Level Select...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        if (gameState.currentMode !== AppMode.GAME && gameState.status !== GameStatus.SHOWING_RESULTS) {
            gameState.reset();
        }
        gameState.status = GameStatus.LEVEL_SELECT;
        gameState.currentMode = AppMode.GAME;
        const levels = levelManager.getAllLevelsWithStatus();
        uiManager.showLevelSelectionScreen(levels);
    }

    function handleShowSandboxInput() {
        console.log("Navigating to Sandbox Input...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.SANDBOX_INPUT;
        gameState.currentMode = AppMode.SANDBOX;
        uiManager.showSandboxUI();
        updateSandboxPreview();
    }

    function handleShowPlayback() {
        console.log("Navigating to Playback...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.PLAYBACK_INPUT;
        gameState.currentMode = AppMode.PLAYBACK;
        uiManager.showPlaybackUI();
    }

    function handleShowSettings() {
        console.log("Navigating to Settings...");
        if (gameState.isPlaying() || gameState.status === GameStatus.READY) {
            stopGameUpdateTimer();
        }
        // Store previous state before entering settings
        // This could be more robust, but for now, just assume returning to menu
        // gameState.previousStatus = gameState.status;
        // gameState.previousMode = gameState.currentMode;
        gameState.status = GameStatus.SETTINGS;
        gameState.currentMode = AppMode.SETTINGS;
        // Modal opening handled by Modal instance
    }

     function handleHideSettings() {
        console.log("Exiting Settings...");
        // Decide where to return based on previous state or simply default to menu
        // if (gameState.previousMode === AppMode.GAME && gameState.previousStatus === GameStatus.PAUSED) {
        //     // Resume game? Need pause state implemented
        // } else {
             showMainMenu(); // Default return
        // }
    }

    // --- Game/Sandbox Mode Logic ---
    function startGameLevel(levelId, sentenceIndex = 0) {
        console.log(`Attempting to start Level ${levelId}, Sentence ${sentenceIndex + 1}`);
        const sentenceText = levelManager.getSpecificSentence(levelId, sentenceIndex);
        if (sentenceText === null) {
            console.error(`Cannot start level: Invalid levelId ${levelId} / sentenceIndex ${sentenceIndex}.`);
            showMainMenu(); return;
        }

        gameState.startLevelSentence(levelId, sentenceIndex, sentenceText);
        applyCurrentSettingsToModules(); // Apply WPM, Freq, Volume, Keys, Manual Modes
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay();

        const firstCharIndex = gameState.currentCharIndex;
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(firstCharIndex, firstChar);
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

    function startSandboxPractice() {
        const sentenceText = uiManager.getSandboxSentence();
        if (!sentenceText || !sentenceText.trim()) { alert("Please enter a sentence."); return; }
        console.log(`Attempting to start Sandbox with: "${sentenceText}"`);

        gameState.startSandboxSentence(sentenceText);
        applyCurrentSettingsToModules(); // Apply WPM, Freq, Volume, Keys, Manual Modes
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay();

        const firstCharIndex = gameState.currentCharIndex;
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(firstCharIndex, firstChar);
        } else {
             console.warn("Starting sandbox with whitespace-only sentence.");
             gameState.status = GameStatus.FINISHED;
             handleSentenceFinished();
             return;
        }
        stopGameUpdateTimer();
        console.log("Sandbox ready.");
    }

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
        }
     }

    // --- Input Handling Callbacks (from InputHandler) ---
    function handleInputHandlerInput(inputChar) {
        // Start timer on first input if ready
        if (gameState.status === GameStatus.READY && (gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            if (gameState.startTimer()) {
                 startGameUpdateTimer();
            }
        }
        // Additional logic based on inputChar could go here if needed
    }

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
        gameState.clearCurrentInput(); // This also clears the UI display

        // If sequence was empty (e.g., timeout without input), just reset state
        if (!sequence) {
            console.log("Decode triggered with empty sequence.");
            gameState.status = GameStatus.LISTENING;
            if (targetChar !== null) {
                // Re-display hint for the current character
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            }
            uiManager.setPatternDisplayState('default'); // Ensure default pattern style
            return;
        }

        // --- Decode and Compare ---
        const decodedChar = decoder.decodeSequence(sequence); // Uppercase result or null

        if (decodedChar && targetChar && decodedChar === targetChar) {
            // --- CORRECT ---
            uiManager.updateCharacterState(gameState.currentCharIndex, 'completed'); // Mark char in sentence
            uiManager.setPatternDisplayState('correct'); // Green flash patterns

            const moreChars = gameState.moveToNextCharacter(); // Advances index, resets state to LISTENING or FINISHED

            if (moreChars) {
                // Highlight the new target character and update hint
                const nextCharIndex = gameState.currentCharIndex;
                const nextCharRaw = gameState.getTargetCharacterRaw(); // Get raw char for highlight
                if (nextCharRaw !== null) {
                    uiManager.highlightCharacter(nextCharIndex, nextCharRaw); // Updates hint pattern too
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
            gameState.status = GameStatus.LISTENING;

            // Re-display hint for the current character
            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            } else {
                uiManager.updateTargetPatternDisplay(""); // Clear hint if no target (shouldn't happen here)
            }
        }
    }


    function handleSentenceFinished() {
        // Prevent multiple calls
        if (gameState.status === GameStatus.SHOWING_RESULTS || gameState.status === GameStatus.MENU) return;

        // Ensure timer is stopped and state is FINISHED
        if (gameState.status !== GameStatus.FINISHED) gameState.stopTimer();
        if (gameState.status !== GameStatus.FINISHED) gameState.status = GameStatus.FINISHED;

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

        uiManager.showResultsScreen(scores, unlockedNextLevelId, hasNextLevelOption, gameState.currentMode);
        gameState.status = GameStatus.SHOWING_RESULTS; // Set final status
        console.log(`${gameState.currentMode} sentence finished, showing results.`);
    }

    // --- Results Screen Input Handling ---
    function handleResultsInput(type) {
        if (gameState.status !== GameStatus.SHOWING_RESULTS) return;

        // SWAPPED: Dah = Next, Dit = Retry
        if (type === 'dah') {
            nextLevel(); // Attempt to go to next level/sentence
        } else if (type === 'dit') {
            retryLevel(); // Retry current level/sentence
        }
    }

    // --- Game Timer for Live Stats ---
    function startGameUpdateTimer() {
        stopGameUpdateTimer();
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

    function stopGameUpdateTimer() {
        if (gameTimerIntervalId !== null) {
            clearInterval(gameTimerIntervalId);
            gameTimerIntervalId = null;
        }
    }

    // --- Settings Handlers ---
    function applyWpmSetting(wpm) {
        if (wpm > 0) {
            decoder.updateWpm(wpm);
            audioPlayer.updateWpm(wpm);
            if (inputHandler) inputHandler.updateWpm(wpm);
            console.log(`Setting Applied: WPM = ${wpm}`);
        }
    }

    function applyFrequencySetting(freq) {
        if (freq >= MorseConfig.AUDIO_MIN_FREQUENCY && freq <= MorseConfig.AUDIO_MAX_FREQUENCY) {
            audioPlayer.updateFrequency(freq);
            console.log(`Setting Applied: Frequency = ${freq} Hz`);
        }
    }

    function applySoundSetting(isEnabled) {
        audioPlayer.setSoundEnabled(isEnabled);
        console.log(`Setting Applied: Sound Enabled = ${isEnabled}`);
    }

    function applyVolumeSetting(level) {
        const volumeLevel = parseFloat(level);
        if (!isNaN(volumeLevel) && volumeLevel >= 0 && volumeLevel <= 1) {
            audioPlayer.setVolume(volumeLevel);
            console.log(`Setting Applied: Volume = ${volumeLevel.toFixed(2)}`);
        }
    }

    function applyDarkModeSetting(isEnabled) {
        console.log(`Setting Applied: Dark Mode = ${isEnabled}`);
        // UI class handled by UIManager directly via _applyDarkMode
    }

    function applyHintSetting(isVisible) {
        console.log(`Setting Applied: Hint Visible = ${isVisible}`);
        // UI class handled by UIManager directly via _applyHintVisibility
    }

    /** Handles changes to key mappings from the UIManager settings inputs. */
    function handleKeyMappingChange(newMappings) {
        if (inputHandler) {
            inputHandler.updateKeyMappings(newMappings);
            console.log(`Setting Applied: Key Mappings = Dit '${newMappings.dit}', Dah '${newMappings.dah}'`);
        } else {
            console.error("Cannot update key mappings: InputHandler not initialized.");
        }
        // Update results screen instructions dynamically if visible
        if (gameState.status === GameStatus.SHOWING_RESULTS) {
             uiManager.updateResultsInstructionsKeyHints(newMappings.dit, newMappings.dah);
        }
    }

    /** Handles changes to manual mode toggles from UIManager. */
    function handleManualModeChange(newModes) {
        applyManualModeSetting(newModes); // Applies the change to the input handler
    }

     /** Applies manual mode settings to the InputHandler. */
    function applyManualModeSetting(manualModes) {
        if (inputHandler) {
            inputHandler.updateManualMode(manualModes);
             console.log(`Setting Applied: Manual Mode = Dit ${manualModes.ditManual}, Dah ${manualModes.dahManual}`);
        } else {
             console.error("Cannot update manual mode: InputHandler not initialized.");
        }
    }


    /** Ensures modules have the latest settings from UI/Storage before starting game/sandbox. */
    function applyCurrentSettingsToModules() {
        // Get current settings state (likely from UIManager which holds loaded state)
        const currentWpm = uiManager.getInitialWpm();
        const currentFreq = uiManager.getInitialFrequency();
        const soundEnabled = uiManager.getInitialSoundState();
        const currentVolume = uiManager.getInitialVolume();
        const currentKeys = {
            dit: uiManager.getCurrentDitKey(),
            dah: uiManager.getCurrentDahKey()
        };
         const currentManualModes = {
             ditManual: uiManager.getCurrentDitManualState(),
             dahManual: uiManager.getCurrentDahManualState()
         };

        // Ensure InputHandler is initialized (safety check)
        if (!inputHandler) initializeInputHandler(currentKeys, currentManualModes);

        // Apply settings to relevant modules
        applyWpmSetting(currentWpm);
        applyFrequencySetting(currentFreq);
        applySoundSetting(soundEnabled);
        applyVolumeSetting(currentVolume);
        if (inputHandler) inputHandler.updateKeyMappings(currentKeys);
        if (inputHandler) inputHandler.updateManualMode(currentManualModes); // Apply manual mode

        // Ensure audio context is ready if sound is enabled
        if (soundEnabled) {
             audioPlayer.initializeAudioContext();
        }
    }

    // --- Navigation/Action Helpers ---
    function retryLevel() {
        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null && gameState.currentSentenceIndex !== null) {
            console.log(`Retrying Level ${gameState.currentLevelId}, Sentence ${gameState.currentSentenceIndex + 1}`);
            startGameLevel(gameState.currentLevelId, gameState.currentSentenceIndex);
        } else if (gameState.currentMode === AppMode.SANDBOX && gameState.currentSentence) {
            console.log("Retrying Sandbox sentence.");
            startSandboxPractice(); // Re-uses the current sentence stored in gameState
        } else {
            console.warn("Retry called in invalid state, returning to main menu.");
            showMainMenu();
        }
    }

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

    function resetProgress() {
        if (confirm("Reset all high scores and level progress? This cannot be undone.")) {
            levelManager.resetProgress();

            // Reset settings in UI Manager and apply them
            uiManager._loadSettings(); // Reloads defaults/cleared state from storage (which might include custom keys/modes)
            uiManager.resetToDefaults(); // Explicitly resets internal state AND UI to CONFIG defaults

            // Re-apply the now-default settings to all modules
            applyInitialSettings();

            // Close settings modal if open and navigate
            if (settingsModal && !settingsModal.modalElement.classList.contains('hidden')) {
                settingsModal.close(); // Should trigger handleHideSettings -> showMainMenu
                 setTimeout(handleShowLevelSelect, 50); // Navigate after modal close animation
            } else {
                 handleShowLevelSelect(); // Navigate directly if modal wasn't open
            }
            alert("Progress reset and settings restored to defaults.");
        }
    }

    // --- Playback Mode Logic ---
    function playSentenceFromInput() {
        if (gameState.isAudioPlayingBack()) {
            audioPlayer.stopPlayback(); // Stops playback and resets state
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse');
            return;
        }

        const sentence = uiManager.getPlaybackSentence();
        if (!sentence || !sentence.trim()) { alert("Please enter a sentence."); return; }

        applyCurrentSettingsToModules(); // Ensure WPM is current

        const morseSequence = decoder.encodeSentence(sentence);
        const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' ');
        uiManager.updatePlaybackMorseDisplay(displayMorse);

        if (!morseSequence) { alert("Could not generate Morse code."); return; }

        uiManager.setPlaybackButtonEnabled(false, 'Stop Playback'); // Update button state

        // Start playback
        audioPlayer.playMorseSequence(morseSequence, () => {
            // Completion callback
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse'); // Reset button state
            console.log("Playback complete.");
        });
    }

    // --- Sandbox Mode Logic ---
    function updateSandboxPreview() {
        const sentence = uiManager.getSandboxSentence();
        if (sentence && sentence.trim()) {
            applyCurrentSettingsToModules(); // Ensure decoder uses current WPM
            const morseSequence = decoder.encodeSentence(sentence);
            const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' ');
            uiManager.updateSandboxMorsePreview(displayMorse);
        } else {
            uiManager.updateSandboxMorsePreview(""); // Clear preview if input empty
        }
    }

    // --- App Initialization ---
    initializeApp();

}); // End DOMContentLoaded