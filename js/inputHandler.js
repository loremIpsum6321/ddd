/* Dit-Dah-Dash/js/inputHandler.js */
/* In file: js/inputHandler.js */
/**
 * js/inputHandler.js
 * ------------------
 * Handles user input from main Dit/Dah paddles (touch/mouse/keyboard).
 * Implements automatic repetition and Iambic B keying for 'auto' mode.
 * Implements direct Morse element generation for 'manual' mode.
 * Triggers discrete audio tones for each generated Morse element.
 * Handles results screen input.
 * Uses dynamically configurable keybindings (primary and secondary) and paddle modes.
 * v1.0 - Initial creation.
 * v1.1 - Updated paddle mode logic to align with Checked=Manual=true.
 * v1.2 - Minor refactoring of state checks for clarity.
 * v1.3 - Added support for secondary keybindings and refactored key state management.
 */

class InputHandler {
    /**
     * @constructor
     * @param {GameState} gameState - Central game state manager.
     * @param {MorseDecoder} decoder - Handles Morse decoding/timing.
     * @param {AudioPlayer} audioPlayer - Handles audio generation.
     * @param {UIManager} uiManager - Handles DOM updates and button feedback.
     * @param {object} callbacks - Functions for input events.
     * @param {function} callbacks.onInput - Callback for dit/dah during gameplay/sandbox (auto mode).
     * @param {function} callbacks.onCharacterDecode - Callback for character decode attempt in gameplay/sandbox (manual/auto).
     * @param {function} callbacks.onResultsInput - Callback for dit/dah on results screen.
     * @param {object} initialKeyMappings - Initial keybindings { dit, dah, ditSecondary, dahSecondary }
     * @param {object} initialManualModes - Initial manual mode states { ditManual: boolean, dahManual: boolean }
     */
    constructor(gameState, decoder, audioPlayer, uiManager, callbacks, initialKeyMappings, initialManualModes) {
        this.gameState = gameState;
        this.decoder = decoder;
        this.audioPlayer = audioPlayer;
        this.uiManager = uiManager;
        this.callbacks = callbacks; // { onInput, onCharacterDecode, onResultsInput }

        // DOM Elements
        this.ditButton = document.getElementById('dit-button');
        this.dahButton = document.getElementById('dah-button');
        this.playbackInput = document.getElementById('playback-input');
        this.sandboxInput = document.getElementById('sandbox-input');
        this.settingsModal = document.getElementById('settings-modal');
        this.ditKeyInput = document.getElementById('dit-key-input'); // Settings input
        this.ditKeySecondaryInput = document.getElementById('dit-key-secondary-input'); // Settings input
        this.dahKeyInput = document.getElementById('dah-key-input'); // Settings input
        this.dahKeySecondaryInput = document.getElementById('dah-key-secondary-input'); // Settings input

        // Key Mappings (Initialized with defaults or loaded settings - now includes secondaries)
        const defaultKeys = MorseConfig.KEYBINDING_DEFAULTS;
        this.keyMappings = {
            dit: initialKeyMappings?.dit || defaultKeys.dit,
            dah: initialKeyMappings?.dah || defaultKeys.dah,
            ditSecondary: initialKeyMappings?.ditSecondary || defaultKeys.ditSecondary,
            dahSecondary: initialKeyMappings?.dahSecondary || defaultKeys.dahSecondary
        };


        // Manual Mode State (true = Manual, false = Auto)
        this.isDitManual = initialManualModes?.ditManual ?? MorseConfig.PADDLE_MODE_DEFAULTS.ditManual;
        this.isDahManual = initialManualModes?.dahManual ?? MorseConfig.PADDLE_MODE_DEFAULTS.dahManual;

        // Input State
        this.ditPressed = false;      // Mouse/Touch state for dit
        this.dahPressed = false;      // Mouse/Touch state for dah
        // NEW: Keyboard state tracking per key assignment
        this.keyState = {
            ditPrimary: false,
            ditSecondary: false,
            dahPrimary: false,
            dahSecondary: false
        };

        // Auto Mode State
        this.pressStartTime = { dit: 0, dah: 0 };
        this.lastInputTypeGenerated = null; // Used by auto mode
        this.lastEmitTime = 0; // Used by auto mode
        this.queuedInput = null; // Used by auto mode queue
        this.repeatOrIambicTimerId = null; // Used by auto mode

        // Track active touch identifiers
        this.activeTouchIds = { dit: null, dah: null };

        // Timing
        this.wpm = MorseConfig.DEFAULT_WPM;
        this.ditDuration = 0;
        this.dahDuration = 0;
        this.intraCharGap = 0;

        // Bind event listeners
        this._bindEvents();
        this.updateWpm(uiManager.getInitialWpm());

        // Set the audio player callback (used by auto mode)
        this.audioPlayer.setOnToneEndCallback(this.handleToneEnd.bind(this));
        console.log("InputHandler Initialized with keys:", this.keyMappings, "and manual modes:", { dit: this.isDitManual, dah: this.isDahManual });
    }

    /** Updates the key mappings used by the input handler. */
    updateKeyMappings(newKeyMappings) {
        if (newKeyMappings && newKeyMappings.dit && newKeyMappings.dah && newKeyMappings.ditSecondary && newKeyMappings.dahSecondary) {
             const dit = newKeyMappings.dit.trim();
             const dah = newKeyMappings.dah.trim();
             const ditSec = newKeyMappings.ditSecondary.trim();
             const dahSec = newKeyMappings.dahSecondary.trim();

             // Basic validation: ensure keys are not empty and no duplicates
             const allKeys = [dit, dah, ditSec, dahSec].map(k => k.toLowerCase());
             const keySet = new Set(allKeys);

             if (dit && dah && ditSec && dahSec && keySet.size === 4) {
                 this.keyMappings.dit = dit;
                 this.keyMappings.dah = dah;
                 this.keyMappings.ditSecondary = ditSec;
                 this.keyMappings.dahSecondary = dahSec;
                 console.log("InputHandler Key Mappings Updated:", this.keyMappings);
             } else {
                 console.warn("InputHandler: Invalid key mapping update ignored. Keys must be non-empty and unique.", newKeyMappings);
             }
        } else {
             console.warn("InputHandler: Invalid key mapping object received.", newKeyMappings);
        }
    }

    /**
     * Updates the manual mode settings used by the input handler.
     * @param {object} newModes - Object with { ditManual: boolean, dahManual: boolean }
     */
    updateManualMode(newModes) {
        if (newModes && typeof newModes.ditManual === 'boolean' && typeof newModes.dahManual === 'boolean') {
            const changed = this.isDitManual !== newModes.ditManual || this.isDahManual !== newModes.dahManual;
            this.isDitManual = newModes.ditManual;
            this.isDahManual = newModes.dahManual;
            console.log("InputHandler Manual Modes Updated:", { dit: this.isDitManual, dah: this.isDahManual });
            // If modes changed while a paddle was active, might need state reset
            if (changed) {
                this._clearRepeatOrIambicTimer();
                this.queuedInput = null;
                this.audioPlayer.stopInputTone(); // Stop any ongoing tone if mode changed
                this._processInputStateChange(); // Re-evaluate state based on new modes
            }
        } else {
            console.warn("InputHandler: Invalid manual mode object received.", newModes);
        }
    }

    /** Updates WPM and recalculates timing values. */
    updateWpm(newWpm) {
        if (newWpm <= 0) return;
        this.wpm = newWpm;
        const baseDit = 1200 / this.wpm;
        this.ditDuration = baseDit;
        this.dahDuration = baseDit * MorseConfig.DAH_DURATION_UNITS;
        this.intraCharGap = baseDit * MorseConfig.INTRA_CHARACTER_GAP_UNITS;
        this.audioPlayer.updateWpm(newWpm);
        this.decoder.updateWpm(newWpm);
    }

    /** Central handler for press events (touch, mouse, key). */
    _press(type, method, specificKey = null) { // specificKey indicates which keyboard key caused the press
        const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                   (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;
        const isPaddleManual = (type === 'dit' && this.isDitManual) || (type === 'dah' && this.isDahManual);

        // Initialize audio context if needed
        if (isGameInputContext || isResultsContext) {
             this.audioPlayer.initializeAudioContext();
        }

        // --- State Tracking (Set pressed flag regardless of mode) ---
        let paddleAlreadyActive = false;
        let stateChanged = false;

        if (type === 'dit') {
             // Check if ANY input for the Dit paddle is already active
            paddleAlreadyActive = this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary;
            if ((method === 'touch' || method === 'mouse') && !this.ditPressed) { this.ditPressed = true; stateChanged = true; }
            else if (method === 'key') {
                 if (specificKey === 'ditPrimary' && !this.keyState.ditPrimary) { this.keyState.ditPrimary = true; stateChanged = true; }
                 else if (specificKey === 'ditSecondary' && !this.keyState.ditSecondary) { this.keyState.ditSecondary = true; stateChanged = true; }
             }
        } else { // dah
            // Check if ANY input for the Dah paddle is already active
            paddleAlreadyActive = this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary;
            if ((method === 'touch' || method === 'mouse') && !this.dahPressed) { this.dahPressed = true; stateChanged = true; }
            else if (method === 'key') {
                 if (specificKey === 'dahPrimary' && !this.keyState.dahPrimary) { this.keyState.dahPrimary = true; stateChanged = true; }
                 else if (specificKey === 'dahSecondary' && !this.keyState.dahSecondary) { this.keyState.dahSecondary = true; stateChanged = true; }
             }
        }

        // Only proceed if state actually changed (prevent repeat events from re-triggering)
        if (!stateChanged) return;

        // Update UI active state if *any* input for this paddle is active
        const isCurrentlyActive = (type === 'dit') ? (this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary)
                                                  : (this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary);


        // --- Logic triggered only by the FIRST press for a given paddle type ---
        if (!paddleAlreadyActive) {
            // Put code here that should only run when going from inactive to active for the paddle
            console.log(`${type} paddle ACTIVATED via ${method} ${specificKey || ''}`);

            // Update UI button state
            this.uiManager.setButtonActive(type, isCurrentlyActive);

            // --- Mode-Specific Logic (Only for FIRST activation) ---
            if (isResultsContext) {
                 // Results screen always behaves the same (manual-like)
                 console.log(`Results Action Triggered by: ${type}`);
                 this.audioPlayer.playInputTone(type); // Play tone immediately
                 if (this.callbacks.onResultsInput) this.callbacks.onResultsInput(type); // Trigger action immediately

            } else if (isGameInputContext && isPaddleManual) {
                 // --- MANUAL MODE ---
                 // Cancel any pending decode from other modes
                 this.decoder.cancelScheduledDecode();
                 // Stop any ongoing auto-mode tone (from other paddle?)
                 this.audioPlayer.stopInputTone();
                 // Clear auto mode queue
                 this.queuedInput = null;

                 // Emit Morse element and play sound immediately
                 const morseChar = (type === 'dit') ? '.' : '-';
                 this._emitInputToSequence(morseChar); // Adds to sequence, updates UI
                 this.audioPlayer.playInputTone(type); // Play tone

                 // Start game timer if needed
                 if (this.gameState.status === GameStatus.READY) {
                     if (this.gameState.startTimer()) {
                        // Optional: startGameUpdateTimer(); // If needed for manual mode UI updates
                     }
                 }
                 // Ensure state reflects typing
                 if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
                     this.gameState.status = GameStatus.TYPING; // Set to typing
                 }


            } else if (isGameInputContext && !isPaddleManual) {
                 // --- AUTO MODE ---
                 // Check for audio busy / queueing (specific to auto mode)
                 if (this.audioPlayer.inputToneNode) {
                     if (this.queuedInput === null) {
                         this.queuedInput = type;
                     }
                     // Return here for auto mode if audio is busy
                     return; // Don't proceed to state change if audio busy
                 }

                 // Standard Auto Mode Press Processing
                 const now = performance.now();
                 this.pressStartTime[type] = now;
                 this.decoder.cancelScheduledDecode(); // Cancel pending decode if starting new auto sequence
                 this._processInputStateChange(); // Trigger iambic/repeat logic

            } else {
                // Not in a valid context for game input
            }

        } else {
            console.log(`${type} paddle ALREADY ACTIVE, additional press via ${method} ${specificKey || ''}`);
             // If already active, don't re-trigger core logic, but DO update UI.
            this.uiManager.setButtonActive(type, isCurrentlyActive);
            return; // Don't proceed further if paddle was already active
        }

    }


    /** Central handler for release events (touch, mouse, key). */
    _release(type, method, specificKey = null) { // specificKey indicates which keyboard key caused the release
        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                              (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;
        const isPaddleManual = (type === 'dit' && this.isDitManual) || (type === 'dah' && this.isDahManual);


        // --- State Tracking (Set pressed flag regardless of mode) ---
        let stateChanged = false;
        let otherKeyStillPressed = false; // Check if *other* inputs for this paddle type remain active

        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && this.ditPressed) { this.ditPressed = false; stateChanged = true; }
            else if (method === 'key') {
                 if (specificKey === 'ditPrimary' && this.keyState.ditPrimary) { this.keyState.ditPrimary = false; stateChanged = true; }
                 else if (specificKey === 'ditSecondary' && this.keyState.ditSecondary) { this.keyState.ditSecondary = false; stateChanged = true; }
             }
             // Check if the *other* dit key (or touch/mouse) is still pressed
            otherKeyStillPressed = this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary;

        } else { // dah
            if ((method === 'touch' || method === 'mouse') && this.dahPressed) { this.dahPressed = false; stateChanged = true; }
            else if (method === 'key') {
                 if (specificKey === 'dahPrimary' && this.keyState.dahPrimary) { this.keyState.dahPrimary = false; stateChanged = true; }
                 else if (specificKey === 'dahSecondary' && this.keyState.dahSecondary) { this.keyState.dahSecondary = false; stateChanged = true; }
             }
             // Check if the *other* dah key (or touch/mouse) is still pressed
            otherKeyStillPressed = this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary;
        }

        if (!stateChanged) return; // Ignore if state didn't change

        // Update UI based on whether *any* input for the paddle is still active
        const isPaddleStillActive = (type === 'dit') ? (this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary)
                                                   : (this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary);

        // --- Logic triggered only when the LAST input for a paddle type is released ---
        if (!otherKeyStillPressed) {
            // Put code here that should only run when the paddle goes from active to inactive
             console.log(`${type} paddle DEACTIVATED (last input released via ${method} ${specificKey || ''})`);

             // Update UI button state
             this.uiManager.setButtonActive(type, isPaddleStillActive);

             // --- Mode-Specific Logic (Only when paddle becomes inactive) ---
             if (isResultsContext) {
                 // No action needed on release for results screen

             } else if (isGameContext && isPaddleManual) {
                 // --- MANUAL MODE ---
                 // Manual paddle fully released. Schedule decode if NO paddles (of any type) are active anymore.
                 const isAnyDitActive = this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary;
                 const isAnyDahActive = this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary;

                 if (!isAnyDitActive && !isAnyDahActive) {
                     // Schedule decode only if NO paddles are active
                      if (this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                          this._scheduleDecodeAfterDelay();
                      } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                         // If sequence empty, just revert to listening
                         this.gameState.status = GameStatus.LISTENING;
                      }
                 }

             } else if (isGameContext && !isPaddleManual) {
                 // --- AUTO MODE ---
                 // Handle potential queue processing if applicable (audio became free on release)
                 if (this.queuedInput !== null && !this.audioPlayer.inputToneNode) {
                     this.handleToneEnd(); // Process queue if audio free
                 }
                  // Trigger standard auto mode state processing
                  this._processInputStateChange();
             } else {
                 // Not in a valid context
             }

        } else {
             console.log(`${type} paddle still active, only one input released via ${method} ${specificKey || ''}`);
             // If other inputs still pressed, don't run core release logic, but DO update UI.
             this.uiManager.setButtonActive(type, isPaddleStillActive);
             return; // Don't proceed further if other inputs for the paddle are still active
        }

    }


    /** Binds touch, mouse and keyboard event listeners. */
    _bindEvents() {
        // Touch Events
        this.ditButton.addEventListener('touchstart', (e) => this._handleTouchStart(e, 'dit'), { passive: false, capture: true });
        this.dahButton.addEventListener('touchstart', (e) => this._handleTouchStart(e, 'dah'), { passive: false, capture: true });
        document.addEventListener('touchend', this._handleTouchEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this._handleTouchEnd.bind(this), { passive: false });

        // Mouse Events
        this.ditButton.addEventListener('mousedown', (e) => this._handleMousePressStart(e, 'dit'));
        this.dahButton.addEventListener('mousedown', (e) => this._handleMousePressStart(e, 'dah'));
        document.addEventListener('mouseup', this._handleMousePressEnd.bind(this));

        // Prevent Context Menu & Drag
        [this.ditButton, this.dahButton].forEach(button => {
            button.addEventListener('contextmenu', e => e.preventDefault());
            button.addEventListener('dragstart', e => e.preventDefault());
        });

        // Keyboard Events
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
    }

    // --- Event Handlers ---

    _handleKeyDown(event) {
        const targetElement = event.target;
        const isKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput ||
                                    targetElement === this.ditKeySecondaryInput || targetElement === this.dahKeySecondaryInput;
        const isOtherInputFocused = !isKeyMapInputFocused && (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA');
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');

        // Ignore if focus is on other inputs, or settings modal (unless key mapping input)
        if (isOtherInputFocused || (isSettingsOpen && !isKeyMapInputFocused)) return;
        if (isKeyMapInputFocused) return; // Let UIManager handle key mapping capture

        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;
        const pressedKey = event.key.toLowerCase(); // Always compare lowercase
        let keyType = null;
        let paddleType = null;

        // Map the pressed key to its specific type and paddle
        if (pressedKey === this.keyMappings.dit.toLowerCase()) { keyType = 'ditPrimary'; paddleType = 'dit'; }
        else if (pressedKey === this.keyMappings.dah.toLowerCase()) { keyType = 'dahPrimary'; paddleType = 'dah'; }
        else if (pressedKey === this.keyMappings.ditSecondary.toLowerCase()) { keyType = 'ditSecondary'; paddleType = 'dit'; }
        else if (pressedKey === this.keyMappings.dahSecondary.toLowerCase()) { keyType = 'dahSecondary'; paddleType = 'dah'; }


        if ((isGameContext || isResultsContext) && keyType) {
            event.preventDefault();
            if (!event.repeat) {
                this._press(paddleType, 'key', keyType);
            }
        }
    }


    _handleKeyUp(event) {
        // Reuse logic from keyDown to check for input focus etc.
        const targetElement = event.target;
        const isKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput ||
                                    targetElement === this.ditKeySecondaryInput || targetElement === this.dahKeySecondaryInput;
        const isOtherInputFocused = !isKeyMapInputFocused && (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA');
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');

        // Ignore if focus is on other inputs, or settings modal (unless key mapping input)
        if (isOtherInputFocused || (isSettingsOpen && !isKeyMapInputFocused)) return;
        if (isKeyMapInputFocused) return; // Let UIManager handle key mapping capture

        const releasedKey = event.key.toLowerCase(); // Always compare lowercase
        let keyType = null;
        let paddleType = null;

        // Map the released key to its specific type and paddle
        if (releasedKey === this.keyMappings.dit.toLowerCase()) { keyType = 'ditPrimary'; paddleType = 'dit'; }
        else if (releasedKey === this.keyMappings.dah.toLowerCase()) { keyType = 'dahPrimary'; paddleType = 'dah'; }
        else if (releasedKey === this.keyMappings.ditSecondary.toLowerCase()) { keyType = 'ditSecondary'; paddleType = 'dit'; }
        else if (releasedKey === this.keyMappings.dahSecondary.toLowerCase()) { keyType = 'dahSecondary'; paddleType = 'dah'; }

        if (keyType) { event.preventDefault(); this._release(paddleType, 'key', keyType); }

    }

    _handleMousePressStart(event, type) { if (event.button !== 0) return; event.preventDefault(); this._press(type, 'mouse'); }
    _handleMousePressEnd(event) { if (event.button !== 0) return; if (this.ditPressed) this._release('dit', 'mouse'); if (this.dahPressed) this._release('dah', 'mouse'); }
    _handleTouchStart(event, type) { event.preventDefault(); if (type === 'dit' && this.activeTouchIds.dit !== null) return; if (type === 'dah' && this.activeTouchIds.dah !== null) return; const touch = event.changedTouches[0]; if (type === 'dit') this.activeTouchIds.dit = touch.identifier; if (type === 'dah') this.activeTouchIds.dah = touch.identifier; this._press(type, 'touch'); }
    _handleTouchEnd(event) { for (let i = 0; i < event.changedTouches.length; i++) { const touch = event.changedTouches[i]; const endedId = touch.identifier; if (this.activeTouchIds.dit === endedId) { this.activeTouchIds.dit = null; this._release('dit', 'touch'); } else if (this.activeTouchIds.dah === endedId) { this.activeTouchIds.dah = null; this._release('dah', 'touch'); } } }


    /** Central logic to determine input mode (AUTO gameplay/sandbox only) and manage timers/state. */
    _processInputStateChange() {
         // --- THIS FUNCTION IS NOW ONLY FOR AUTO MODE ---
         const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                    (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);

         // Check which paddles are active *and* set to AUTO mode
         const isDitActive = this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary;
         const isDahActive = this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary;
         const isDitAutoActive = isDitActive && !this.isDitManual;
         const isDahAutoActive = isDahActive && !this.isDahManual;

         // --- Exit Conditions ---
         // 1. Not in game context
         // 2. No AUTO paddles are currently active
         if (!isGameInputContext || (!isDitAutoActive && !isDahAutoActive)) {
            this._clearRepeatOrIambicTimer();
            this.lastEmitTime = 0;
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;

            // Schedule decode if NO paddles (manual or auto) are active anymore
             // (Check *all* paddle activity, not just auto)
             const isAnyDitActive = this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary;
             const isAnyDahActive = this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary;
             if (!isAnyDitActive && !isAnyDahActive) {
                 if (this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                    this._scheduleDecodeAfterDelay();
                 } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                     this.gameState.status = GameStatus.LISTENING;
                 }
            }
            return;
         }

         // --- Auto Mode Logic Continues ---
         this._clearRepeatOrIambicTimer(); // Clear any existing timer before setting new one

         // If an auto paddle is pressed while decoding, switch back to typing
         if ((isDitAutoActive || isDahAutoActive) && this.gameState.status === GameStatus.DECODING) {
             this.decoder.cancelScheduledDecode();
             this.gameState.status = GameStatus.TYPING;
         }

        if (isDitAutoActive && isDahAutoActive) {
            // --- Iambic Auto Mode ---
            this.gameState.isIambicHandling = true;
            // If just started Iambic, determine lead paddle based on press time
            if (this.gameState.iambicState === null) {
                const pressTimeDit = this.pressStartTime.dit || 0;
                const pressTimeDah = this.pressStartTime.dah || 0;
                // Set initial state based on which was pressed *last* (higher time)
                this.gameState.iambicState = (pressTimeDah > pressTimeDit) ? 'dah' : 'dit';
            }
            this._triggerRepeatOrIambicOutput();

        } else if (isDitAutoActive) {
            // --- Dit Auto Mode Only ---
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = 'dit';
            this._triggerRepeatOrIambicOutput();

        } else if (isDahAutoActive) {
            // --- Dah Auto Mode Only ---
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = 'dah';
            this._triggerRepeatOrIambicOutput();

        } else {
             // Fallback: Should have been caught by the initial check
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
             // Check if decode should be scheduled if no auto paddles active
             // Check *all* paddle activity
             const isAnyDitActive = this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary;
             const isAnyDahActive = this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary;
             if (!isAnyDitActive && !isAnyDahActive) { // Only schedule if NO paddles active
                 if (this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                     // Schedule decode only if audio isn't busy and no queue
                     if (this.queuedInput === null && !this.audioPlayer.inputToneNode) {
                         this._scheduleDecodeAfterDelay();
                     }
                 } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                     this.gameState.status = GameStatus.LISTENING;
                 }
             }
        }
    }

    /** Handles adding a Morse element ('.' or '-') to the game state sequence. Common for Manual & Auto. */
    _emitInputToSequence(morseChar) {
        // Guard against emitting outside relevant states
        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
             console.warn(`_emitInputToSequence called in invalid state: ${this.gameState.status}`);
             return; // Don't emit if not in a playing state
        }

        // Start timer if this is the first input
        if (this.gameState.status === GameStatus.READY) {
            if (this.gameState.startTimer()) {
                // Optional: startGameUpdateTimer();
            }
            // Move to TYPING state immediately after starting timer
            this.gameState.status = GameStatus.TYPING;
        }

        this.gameState.addInput(morseChar);
        this.uiManager.updateUserPatternDisplay(this.gameState.currentInputSequence);

        // Call the onInput callback (used by main for potential immediate feedback/checks)
        if (this.callbacks.onInput) {
            this.callbacks.onInput(morseChar);
        }
    }


    /** Triggers the next output in an Auto-Repeat or Iambic sequence. (AUTO MODE ONLY) */
    _triggerRepeatOrIambicOutput() {
        // --- THIS FUNCTION IS NOW ONLY FOR AUTO MODE ---
        this._clearRepeatOrIambicTimer(); // Ensure no duplicates running

        // --- Pre-checks ---
        // 1. Ensure we are in a state where auto input is expected
        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
            this.lastEmitTime = 0;
            this._processInputStateChange(); // Re-evaluate state if context changed
            return;
        }

        // 2. Determine which element to send ('dit' or 'dah') based on iambic/repeat state
        const elementToSend = this.gameState.iambicState;
        if (!elementToSend) { // If state is somehow null, re-evaluate
             this._processInputStateChange(); return;
        }

        // 3. Check if the required auto paddle(s) are still active
        const isDitAutoActive = (this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary) && !this.isDitManual;
        const isDahAutoActive = (this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary) && !this.isDahManual;
        const requiredPaddlesActive =
            (this.gameState.isIambicHandling && isDitAutoActive && isDahAutoActive) ||
            (!this.gameState.isIambicHandling && elementToSend === 'dit' && isDitAutoActive) ||
            (!this.gameState.isIambicHandling && elementToSend === 'dah' && isDahAutoActive);

        if (!requiredPaddlesActive) {
            this._processInputStateChange(); // Re-evaluate if paddles were released
            return;
        }

        // --- Timing Check ---
        const now = performance.now();
        const timeSinceLastEmit = now - this.lastEmitTime;
        const lastElementDurationMs = (this.lastInputTypeGenerated === 'dit' ? this.ditDuration : (this.lastInputTypeGenerated === 'dah' ? this.dahDuration : 0));
        const requiredTimeMs = lastElementDurationMs + this.intraCharGap;

        // If not enough time passed, schedule retry and exit
        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTimeMs) {
            const remainingTimeMs = requiredTimeMs - timeSinceLastEmit;
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, remainingTimeMs));
            return;
        }

        // --- Audio Check ---
        // If audio is busy, queue the element and exit
        if (this.audioPlayer.inputToneNode) {
             if (this.queuedInput === null) {
                 this.queuedInput = elementToSend;
             }
             return;
         }

         // --- Emit and Play ---
         const morseChar = (elementToSend === 'dit') ? '.' : '-';
         this._emitInputToSequence(morseChar); // Add to sequence, update UI, start timer if needed
         this.audioPlayer.playInputTone(elementToSend); // Play the tone
         this.lastInputTypeGenerated = elementToSend;
         this.lastEmitTime = performance.now(); // Record time AFTER playing

         // --- Schedule Next Element ---
         const currentElementDurationMs = (elementToSend === 'dit' ? this.ditDuration : this.dahDuration);
         const delayForNextMs = currentElementDurationMs + this.intraCharGap;

         // Toggle state for next element in Iambic sequence
         if (this.gameState.isIambicHandling) {
             this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit';
         }
         // else (repeat mode), iambicState remains the same

         // Check if required paddles are *still* active AFTER emitting
         const stillDitAutoActive = (this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary) && !this.isDitManual;
         const stillDahAutoActive = (this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary) && !this.isDahManual;
         const shouldContinue =
               (this.gameState.isIambicHandling && stillDitAutoActive && stillDahAutoActive) ||
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dit' && stillDitAutoActive) ||
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dah' && stillDahAutoActive);

         if (shouldContinue) {
            // Schedule the next trigger
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, delayForNextMs));
         } else {
            // If required paddles released, re-evaluate state (might schedule decode)
             this._processInputStateChange();
         }
    }

    /** Callback function triggered by AudioPlayer when an input tone finishes playing naturally. */
    handleToneEnd() {
         let processedQueueItem = false;

         // --- Queue Processing (Auto Mode) ---
         if (this.queuedInput !== null) {
             const typeToProcess = this.queuedInput;
             const isProcessingPaddleManual = (typeToProcess === 'dit' && this.isDitManual) || (typeToProcess === 'dah' && this.isDahManual);

             // Only process queue if the queued item was for an AUTO paddle
             if (!isProcessingPaddleManual) {
                 this.queuedInput = null; // Clear queue item

                 // Re-check if the corresponding AUTO paddle is still active before playing from queue
                 const isDitAutoActive = (this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary) && !this.isDitManual;
                 const isDahAutoActive = (this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary) && !this.isDahManual;
                 const canPlayFromQueue = (typeToProcess === 'dit' && isDitAutoActive) || (typeToProcess === 'dah' && isDahAutoActive);

                 if (canPlayFromQueue) {
                     const morseChar = (typeToProcess === 'dit') ? '.' : '-';
                     this._emitInputToSequence(morseChar); // Add to sequence, update UI
                     this.audioPlayer.playInputTone(typeToProcess); // Play tone
                     processedQueueItem = true;
                     this.lastInputTypeGenerated = typeToProcess; // Track for auto mode timing
                     this.lastEmitTime = performance.now(); // Update for auto mode timing

                     // Ensure typing state if playing
                     if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
                         if (this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) {
                             this.gameState.status = GameStatus.TYPING;
                         }
                     }
                 } else {
                    // If paddle released before queued item played, just discard
                 }
             } else {
                  // If the queued item was for a manual paddle, just clear it
                  this.queuedInput = null;
             }
         }

         // --- Post-Tone State Evaluation (use timeout for stability) ---
         setTimeout(() => {
             // If we just played something from the queue, the next step (repeat/iambic/decode)
             // should be scheduled from _triggerRepeatOrIambicOutput or _processInputStateChange.
             // So, trigger a state re-evaluation.
             if (processedQueueItem) {
                 this._processInputStateChange(); // Check if repeat/iambic should continue
             } else {
                 // If no queue was processed, check if paddles are released and schedule decode
                 // Check *all* paddle activity
                 const isAnyDitActive = this.ditPressed || this.keyState.ditPrimary || this.keyState.ditSecondary;
                 const isAnyDahActive = this.dahPressed || this.keyState.dahPrimary || this.keyState.dahSecondary;

                 if (!isAnyDitActive && !isAnyDahActive) { // If NO paddles are active
                     if (this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                         // And there's a sequence, schedule decode
                         this._scheduleDecodeAfterDelay();
                     } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                         // If typing but sequence empty, revert to listening
                         this.gameState.status = GameStatus.LISTENING;
                     }
                 }
                 // If an auto paddle is still active, let its timer handle the next step
                 // If a manual paddle is still active, do nothing here (release handles it)
             }
         }, 1); // Small delay
     }


    /** Schedules the character decode function after the inter-character gap timeout. */
     _scheduleDecodeAfterDelay() {
        this.decoder.cancelScheduledDecode(); // Clear any existing timer

         // Check if decoding is appropriate in the current state
         const canSchedule = (
             this.gameState.currentInputSequence && // Must have a sequence to decode
             (this.gameState.status === GameStatus.TYPING) && // Must be in typing state
             (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
             !this.audioPlayer.inputToneNode && // Ensure audio is not playing
             this.queuedInput === null // Ensure queue is empty
         );

         if (!canSchedule) {
             // If can't schedule but were typing with no sequence, go back to listening
             if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             return; // Don't schedule if conditions not met
         }

         // Set state to DECODING and schedule the callback
         this.gameState.status = GameStatus.DECODING;

         this.decoder.scheduleDecode(() => {
             // Check status *again* when callback executes
             if (this.gameState.status === GameStatus.DECODING &&
                 (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX))
             {
                 // Execute the main decode logic via callback
                 if (this.callbacks.onCharacterDecode) {
                     this.callbacks.onCharacterDecode();
                 } else {
                      console.error("onCharacterDecode callback is missing!");
                      // Fallback: If decode couldn't happen, revert state
                      if(this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
                 }
             } else {
                 // If status changed before decode fired (e.g., new input started), revert if still decoding
                 if(this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
             }
             // Reset iambic state after any decode attempt/callback completion
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
         });
     }

    /** Clears the single iambic/repeat generation timer (AUTO MODE ONLY). */
    _clearRepeatOrIambicTimer() {
        if (this.repeatOrIambicTimerId) {
            clearTimeout(this.repeatOrIambicTimerId);
            this.repeatOrIambicTimerId = null;
        }
    }
}

/*
// --- Usage Example --- (Conceptual)
// Assuming main.js initializes InputHandler:
// const inputHandler = new InputHandler(gameState, decoder, audioPlayer, uiManager, callbacks, initialKeys, initialModes);
//
// // To update key mappings:
// inputHandler.updateKeyMappings({ dit: 'e', dah: 'i', ditSecondary: 'u', dahSecondary: 'o' });
//
// // To update manual mode:
// inputHandler.updateManualMode({ ditManual: true, dahManual: false });
//
// // Event listeners (_bindEvents) handle the rest automatically.
// // Keyboard events now check against primary and secondary keys.
// // Press/Release logic ensures actions trigger only on first down / last up per paddle type.
*/