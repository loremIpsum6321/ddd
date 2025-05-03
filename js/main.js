/* Dit-Dah-Dash/js/main.js */
/* In file: js/main.js */
/**
 * js/main.js
 * ----------
 * Entry point for the Dit-Dah-Dash application.
 * Initializes modules, sets up event listeners, manages UI view transitions,
 * handles settings changes (WPM, frequency, sound, dark mode, keys, manual mode),
 * controls game logic flow, and manages the results screen actions.
 * UPDATE: Added handler for Reset Settings button.
 * UPDATE: Updated reset functions and confirmation messages.
 * UPDATE: Ensured initial settings load reflects paddle mode defaults.
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
            ditManual: uiManager.getCurrentDitManualState(), // Gets initial state (likely false/Auto now)
            dahManual: uiManager.getCurrentDahManualState() // Gets initial state (likely false/Auto now)
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
        // Apply settings based on values loaded/defaulted by UIManager
        applyWpmSetting(uiManager.getInitialWpm());
        applyFrequencySetting(uiManager.getInitialFrequency());
        applySoundSetting(uiManager.getInitialSoundState());
        applyVolumeSetting(uiManager.getInitialVolume());
        applyManualModeSetting(uiManager.getCurrentManualModeState()); // Apply initial manual mode state
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
            onResetSettings: resetSettingsOnly, // NEW: Connect Reset Settings button
            onResetProgress: resetAllProgress, // Existing Reset Progress button
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