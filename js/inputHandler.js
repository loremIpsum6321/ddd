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
 * Uses dynamically configurable keybindings and paddle modes.
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
     * @param {function} callbacks.onCharacterDecode - Callback for character decode attempt in gameplay/sandbox (auto mode).
     * @param {function} callbacks.onResultsInput - Callback for dit/dah on results screen.
     * @param {object} initialKeyMappings - Initial keybindings { dit: 'key', dah: 'key' }
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
        this.dahKeyInput = document.getElementById('dah-key-input'); // Settings input

        // Key Mappings (Initialized with defaults or loaded settings)
        this.keyMappings = {
            dit: initialKeyMappings?.dit || MorseConfig.KEYBINDING_DEFAULTS.dit,
            dah: initialKeyMappings?.dah || MorseConfig.KEYBINDING_DEFAULTS.dah
        };

        // Manual Mode State
        this.isDitManual = initialManualModes?.ditManual ?? MorseConfig.PADDLE_MODE_DEFAULTS.ditManual;
        this.isDahManual = initialManualModes?.dahManual ?? MorseConfig.PADDLE_MODE_DEFAULTS.dahManual;

        // Input State
        this.ditPressed = false;      // Mouse/Touch state for dit
        this.dahPressed = false;      // Mouse/Touch state for dah
        this.ditKeyPressed = false;   // Keyboard state for dit
        this.dahKeyPressed = false;   // Keyboard state for dah

        // Auto Mode State
        this.pressStartTime = { dit: 0, dah: 0 };
        this.lastInputTypeGenerated = null; // Used by auto mode
        this.lastEmitTime = 0; // Used by auto mode
        this.queuedInput = null; // Used by auto mode (and manual?)
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
    updateKeyMappings(newMappings) {
        if (newMappings && newMappings.dit && newMappings.dah) {
             const newDit = newMappings.dit.trim();
             const newDah = newMappings.dah.trim();
             if (newDit && newDah && newDit !== newDah) {
                 this.keyMappings.dit = newDit;
                 this.keyMappings.dah = newDah;
                 console.log("InputHandler Key Mappings Updated:", this.keyMappings);
             } else {
                 console.warn("InputHandler: Invalid key mapping update ignored.", newMappings);
             }
        } else {
             console.warn("InputHandler: Invalid key mapping object received.", newMappings);
        }
    }

    /** Updates the manual mode settings used by the input handler. */
    updateManualMode(newModes) {
        if (newModes && typeof newModes.ditManual === 'boolean' && typeof newModes.dahManual === 'boolean') {
            this.isDitManual = newModes.ditManual;
            this.isDahManual = newModes.dahManual;
            console.log("InputHandler Manual Modes Updated:", { dit: this.isDitManual, dah: this.isDahManual });
            // Reset auto mode state if switching modes while active? Maybe not necessary.
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
    _press(type, method) {
        const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                   (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;
        const isManual = (type === 'dit' && this.isDitManual) || (type === 'dah' && this.isDahManual);

        // Initialize audio context if needed
        if (isGameInputContext || isResultsContext) {
             this.audioPlayer.initializeAudioContext();
        }

        // --- State Tracking (Set pressed flag regardless of mode) ---
        let stateChanged = false;
        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && !this.ditPressed) { this.ditPressed = true; stateChanged = true; }
            else if (method === 'key' && !this.ditKeyPressed) { this.ditKeyPressed = true; stateChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && !this.dahPressed) { this.dahPressed = true; stateChanged = true; }
            else if (method === 'key' && !this.dahKeyPressed) { this.dahKeyPressed = true; stateChanged = true; }
        }

        // Only proceed if state actually changed (prevent repeat events from re-triggering)
        if (!stateChanged) return;

        // Update UI active state
        const isCurrentlyActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);
        this.uiManager.setButtonActive(type, isCurrentlyActive);

        // --- Mode-Specific Logic ---
        if (isResultsContext) {
             // Results screen always behaves the same (manual-like)
             console.log(`Results Action Triggered by: ${type}`);
             this.audioPlayer.playInputTone(type); // Play tone immediately
             if (this.callbacks.onResultsInput) this.callbacks.onResultsInput(type); // Trigger action immediately

        } else if (isGameInputContext && isManual) {
             // --- MANUAL MODE ---
             // Cancel any pending decode from auto mode (just in case)
             this.decoder.cancelScheduledDecode();
             // Stop any ongoing auto-mode tone
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
                     // Optional: Start a simplified timer update if needed for manual mode?
                     // startGameUpdateTimer(); // Assuming this exists in main.js
                 }
             }
             // Ensure state reflects typing
             if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
                 this.gameState.status = GameStatus.TYPING; // Set to typing
             }


        } else if (isGameInputContext && !isManual) {
             // --- AUTO MODE ---
             // Check for audio busy / queueing (specific to auto mode)
             if (this.audioPlayer.inputToneNode) {
                 if (this.queuedInput === null) {
                     this.queuedInput = type;
                     // console.log(`Auto Audio busy on press, queued: ${type}`);
                 } else {
                     // console.log(`Auto Audio busy on press, queue full. Ignored: ${type}`);
                 }
                 // Return here for auto mode if audio is busy
                 return;
             }

             // Standard Auto Mode Press Processing
             const now = performance.now();
             this.pressStartTime[type] = now;
             this.decoder.cancelScheduledDecode();
             this._processInputStateChange(); // Trigger iambic/repeat logic

        } else {
            // Not in a valid context for game input
        }
    }


    /** Central handler for release events (touch, mouse, key). */
    _release(type, method) {
        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                              (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;
        const isManual = (type === 'dit' && this.isDitManual) || (type === 'dah' && this.isDahManual);

        // --- State Tracking (Set pressed flag regardless of mode) ---
        let stateChanged = false;
        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && this.ditPressed) { this.ditPressed = false; stateChanged = true; }
            else if (method === 'key' && this.ditKeyPressed) { this.ditKeyPressed = false; stateChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && this.dahPressed) { this.dahPressed = false; stateChanged = true; }
            else if (method === 'key' && this.dahKeyPressed) { this.dahKeyPressed = false; stateChanged = true; }
        }

        if (!stateChanged) return; // Ignore if state didn't change

        // Update UI active state
        const isStillActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);
        this.uiManager.setButtonActive(type, isStillActive);

        // --- Mode-Specific Logic ---
        if (isResultsContext) {
            // No action needed on release for results screen

        } else if (isGameContext && isManual) {
            // --- MANUAL MODE ---
            // Stop the tone if it was playing *for this specific paddle*
            // Note: AudioPlayer handles its own tone stopping generally, but maybe force here?
            // Let's assume tone plays for its duration naturally unless interrupted by another press.
            // The main thing is to schedule the decode attempt.

            // If BOTH paddles are manual and neither is pressed, schedule decode
            const otherType = (type === 'dit') ? 'dah' : 'dit';
            const isOtherManual = (otherType === 'dit' && this.isDitManual) || (otherType === 'dah' && this.isDahManual);
            const isOtherActive = (otherType === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);

            if (!isStillActive && isManual && (!isOtherActive || !isOtherManual)) {
                // Schedule decode only if this paddle (manual) is released AND
                // the other paddle is either not active OR not manual
                // This prevents decode if switching between two manual paddles rapidly.
                // Let's refine: Schedule decode if NO paddles are active OR if the only active paddle is AUTO.
                 const isDitPaddleActive = this.ditPressed || this.ditKeyPressed;
                 const isDahPaddleActive = this.dahPressed || this.dahKeyPressed;
                 const shouldSchedule = (!isDitPaddleActive && !isDahPaddleActive) || // No paddles active
                                       (isDitPaddleActive && !this.isDitManual && !isDahPaddleActive) || // Only Dit active and it's Auto
                                       (isDahPaddleActive && !this.isDahManual && !isDitPaddleActive); // Only Dah active and it's Auto

                 if (shouldSchedule && this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                     this._scheduleDecodeAfterDelay();
                 } else if (shouldSchedule && this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                    this.gameState.status = GameStatus.LISTENING;
                 }
            }

        } else if (isGameContext && !isManual) {
            // --- AUTO MODE ---
            // Handle potential queue processing if applicable
            if (this.queuedInput !== null && !this.audioPlayer.inputToneNode) {
                // console.log("Auto Release detected queue processing opportunity.");
                this.handleToneEnd(); // Process queue if audio free
            }
             // Trigger standard auto mode state processing
             this._processInputStateChange();
        } else {
            // Not in a valid context
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
        const isKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput;
        const isOtherInputFocused = !isKeyMapInputFocused && (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA');
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');

        if (isOtherInputFocused || (isSettingsOpen && !isKeyMapInputFocused)) return;
        if (isKeyMapInputFocused) return; // Let UIManager handle key mapping

        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        const pressedKey = event.key;
        const isDitKey = pressedKey.toLowerCase() === this.keyMappings.dit.toLowerCase();
        const isDahKey = pressedKey.toLowerCase() === this.keyMappings.dah.toLowerCase();


        if ((isGameContext || isResultsContext) && (isDitKey || isDahKey)) {
            event.preventDefault();
            if (!event.repeat) {
                if (isDitKey) this._press('dit', 'key');
                else if (isDahKey) this._press('dah', 'key');
            }
        }
    }


    _handleKeyUp(event) {
        const targetElement = event.target;
        const isKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput;
        const isOtherInputFocused = !isKeyMapInputFocused && (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA');
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');

        if (isOtherInputFocused || (isSettingsOpen && !isKeyMapInputFocused)) return;
        if (isKeyMapInputFocused) return; // Let UIManager handle key mapping

        const releasedKey = event.key;
        const isDitKey = releasedKey.toLowerCase() === this.keyMappings.dit.toLowerCase();
        const isDahKey = releasedKey.toLowerCase() === this.keyMappings.dah.toLowerCase();

        if (isDitKey) { event.preventDefault(); this._release('dit', 'key'); }
        else if (isDahKey) { event.preventDefault(); this._release('dah', 'key'); }
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

         // If either paddle is manual, this logic shouldn't run fully, but check which paddles are active *for auto mode*.
         const isDitAutoActive = (this.ditPressed || this.ditKeyPressed) && !this.isDitManual;
         const isDahAutoActive = (this.dahPressed || this.dahKeyPressed) && !this.isDahManual;

         // If not in game context OR if *no* auto paddles are active, cleanup and exit.
         if (!isGameInputContext || (!isDitAutoActive && !isDahAutoActive)) {
            this._clearRepeatOrIambicTimer();
            this.lastEmitTime = 0;
            // Don't reset queue here, might be needed by manual release? Reconsider.
            // this.queuedInput = null;
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
            // If no paddles active *at all* and we were typing, schedule decode
            const isDitActive = this.ditPressed || this.ditKeyPressed;
            const isDahActive = this.dahPressed || this.dahKeyPressed;
            if (!isDitActive && !isDahActive) {
                 if (this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                    this._scheduleDecodeAfterDelay();
                 } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                     this.gameState.status = GameStatus.LISTENING;
                 }
            }
            return;
         }

        // --- Auto Mode Logic Continues ---
        this._clearRepeatOrIambicTimer();

         if ((isDitAutoActive || isDahAutoActive) && this.gameState.status === GameStatus.DECODING) {
             this.decoder.cancelScheduledDecode();
             this.gameState.status = GameStatus.TYPING;
         }

        if (isDitAutoActive && isDahAutoActive) {
            // --- Iambic Auto Mode ---
            this.gameState.isIambicHandling = true;
            if (this.gameState.iambicState === null) {
                // Determine lead paddle based on press time *only if both are auto*
                const pressTimeDit = this.pressStartTime.dit || 0;
                const pressTimeDah = this.pressStartTime.dah || 0;
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
             // Should have been caught by the initial check, but as fallback:
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
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

    /** Handles adding a Morse element ('.' or '-') to the game state sequence. Common for Manual & Auto. */
    _emitInputToSequence(morseChar) {
        // Guard against emitting outside relevant states
        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
             console.warn(`_emitInputToSequence called in invalid state: ${this.gameState.status}`);
             return; // Don't emit if not in a playing state
        }

        this.gameState.addInput(morseChar);
        this.uiManager.updateUserPatternDisplay(this.gameState.currentInputSequence);

        // Call the onInput callback *only for auto mode* as per original design?
        // Let's call it for both for consistency, main.js can decide what to do.
        if (this.callbacks.onInput) {
            this.callbacks.onInput(morseChar);
        }
    }


    /** Triggers the next output in an Auto-Repeat or Iambic sequence. (AUTO MODE ONLY) */
    _triggerRepeatOrIambicOutput() {
        // --- THIS FUNCTION IS NOW ONLY FOR AUTO MODE ---
        this._clearRepeatOrIambicTimer();

        const isDitAutoActive = (this.ditPressed || this.ditKeyPressed) && !this.isDitManual;
        const isDahAutoActive = (this.dahPressed || this.dahKeyPressed) && !this.isDahManual;
        const elementToSend = this.gameState.iambicState; // Should be 'dit' or 'dah' if auto is active

        // Exit if not in playing state or no auto element determined
        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) || !elementToSend) {
             this.lastEmitTime = 0; return;
        }

        // Exit if the required auto paddle(s) are no longer active
        if (this.gameState.isIambicHandling && (!isDitAutoActive || !isDahAutoActive)) { this._processInputStateChange(); return; }
        if (!this.gameState.isIambicHandling && elementToSend === 'dit' && !isDitAutoActive) { this._processInputStateChange(); return; }
        if (!this.gameState.isIambicHandling && elementToSend === 'dah' && !isDahAutoActive) { this._processInputStateChange(); return; }

        // --- Timing Check ---
        const now = performance.now();
        const timeSinceLastEmit = now - this.lastEmitTime;
        const lastElementDurationMs = (this.lastInputTypeGenerated === 'dit' ? this.ditDuration : (this.lastInputTypeGenerated === 'dah' ? this.dahDuration : 0));
        const requiredTimeMs = lastElementDurationMs + this.intraCharGap;

        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTimeMs) {
            const remainingTimeMs = requiredTimeMs - timeSinceLastEmit;
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, remainingTimeMs));
            return;
        }

        // --- Audio Check ---
        if (this.audioPlayer.inputToneNode) {
             if (this.queuedInput === null) {
                 this.queuedInput = elementToSend;
                 // console.log(`Auto Audio busy, queued: ${elementToSend}`);
             } // else { console.log(`Auto Audio busy, queue full. Dropped: ${elementToSend}`); }
             return; // Return if audio busy
         }

         // --- Emit and Play ---
         const morseChar = (elementToSend === 'dit') ? '.' : '-';
         this._emitInputToSequence(morseChar); // Add to sequence, update UI
         this.audioPlayer.playInputTone(elementToSend); // Play the tone
         this.lastInputTypeGenerated = elementToSend;
         this.lastEmitTime = performance.now();

         // --- Schedule Next Element ---
         const currentElementDurationMs = (elementToSend === 'dit' ? this.ditDuration : this.dahDuration);
         const delayForNextMs = currentElementDurationMs + this.intraCharGap;

         // Toggle state for Iambic
         if (this.gameState.isIambicHandling) {
             this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit';
         }

         // Check if the required auto paddle(s) are *still* active
         const stillDitAutoActive = (this.ditPressed || this.ditKeyPressed) && !this.isDitManual;
         const stillDahAutoActive = (this.dahPressed || this.dahKeyPressed) && !this.isDahManual;
         const shouldContinue =
               (this.gameState.isIambicHandling && stillDitAutoActive && stillDahAutoActive) ||
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dit' && stillDitAutoActive) ||
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dah' && stillDahAutoActive);

         if (shouldContinue) {
            // Schedule the next trigger
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, delayForNextMs));
         } else {
            // If required paddles released, re-evaluate state
             this._processInputStateChange();
         }
    }

    /** Callback function triggered by AudioPlayer when an input tone finishes playing naturally. (AUTO MODE primarily) */
    handleToneEnd() {
        // --- THIS FUNCTION IS NOW MOSTLY RELEVANT FOR AUTO MODE QUEUE ---
         let processedQueueItem = false;
         let emittedType = null;

         // --- Queue Processing (Auto Mode) ---
         if (this.queuedInput !== null) {
             const typeToProcess = this.queuedInput;
             const isProcessingDitManual = (typeToProcess === 'dit' && this.isDitManual);
             const isProcessingDahManual = (typeToProcess === 'dah' && this.isDahManual);

             // Only process queue if the paddle is in AUTO mode
             if (!isProcessingDitManual && !isProcessingDahManual) {
                 this.queuedInput = null; // Clear queue item
                 // console.log(`Auto Processing queued input: ${typeToProcess}`);

                 const morseChar = (typeToProcess === 'dit') ? '.' : '-';
                 this._emitInputToSequence(morseChar); // Add to sequence, update UI
                 this.audioPlayer.playInputTone(typeToProcess); // Play tone
                 processedQueueItem = true;
                 emittedType = typeToProcess;

                 // Ensure typing state if playing
                 if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
                     if (this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) {
                         this.gameState.status = GameStatus.TYPING;
                     }
                 }
                 this.lastInputTypeGenerated = emittedType; // Track for auto mode timing
                 this.lastEmitTime = performance.now(); // Update for auto mode timing
             } else {
                  // If the queued item was for a manual paddle, just clear it, don't process via auto logic
                  console.log(`Manual item '${typeToProcess}' cleared from queue on tone end.`);
                  this.queuedInput = null;
             }
         }

         // --- Post-Tone State Evaluation ---
         // Use timeout to allow release events to potentially fire first
         setTimeout(() => {
             const isDitActive = this.ditPressed || this.ditKeyPressed;
             const isDahActive = this.dahPressed || this.dahKeyPressed;
             const isDitAutoActive = isDitActive && !this.isDitManual;
             const isDahAutoActive = isDahActive && !this.isDahManual;

             if (isDitAutoActive || isDahAutoActive) {
                  // If an auto paddle is still active, let auto mode logic handle it
                  this._processInputStateChange();
             } else if (!isDitActive && !isDahActive) {
                 // If NO paddles are active (manual or auto)
                 if (this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                     // And there's a sequence, schedule decode
                     this._scheduleDecodeAfterDelay();
                 } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                     // If typing but sequence empty, revert to listening
                     this.gameState.status = GameStatus.LISTENING;
                 }
                 // If a manual paddle is active but no auto, do nothing here (release handles it)
             }
         }, 1); // Small delay
     }


    /** Schedules the character decode function after the inter-character gap timeout. (Used by Manual & Auto release/toneEnd) */
     _scheduleDecodeAfterDelay() {
        this.decoder.cancelScheduledDecode(); // Clear any existing timer

         // Check if decoding is appropriate in the current state
         const canSchedule = (
             this.gameState.currentInputSequence &&
             (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.LISTENING) && // Can schedule if listening and sequence exists (e.g., manual input)
             (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)
         );

         if (!canSchedule) {
             // If can't schedule but were typing with no sequence, go back to listening
             if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             return; // Don't schedule if conditions not met
         }

         // Set state to DECODING and schedule the callback
         // console.log(`Scheduling decode for sequence: '${this.gameState.currentInputSequence}'`);
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
                 // If status changed before decode fired, just revert state if still decoding
                 // console.log(`Decode callback skipped. Status: ${this.gameState.status}, Mode: ${this.gameState.currentMode}`);
                 if(this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
             }
             // Reset iambic state after any decode attempt/callback
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