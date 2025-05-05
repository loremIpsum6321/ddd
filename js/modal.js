/* File: js/modal.js */
/**
 * Purpose: Handles basic modal functionality including showing, hiding,
 * and simple drag-and-drop for the modal window.
 *
 * Version History:
 * - v1.0 - Initial creation.
 * - v1.1 - Refines drag start logic for smoother interaction.
 * - v1.2 - Fixes mobile close button issue by adding touchend listener.
 * - v1.3 - Fixes centering issue by adjusting initial positioning logic.
 * - v1.4 - Addresses position jumping and double-grab issues during drag start.
 * - v1.5 - Further refinement of drag start logic to prevent initial jump.
 * - v1.6 - Uses requestAnimationFrame in dragStart and disables CSS transitions during drag.
 */

class Modal {
    /**
     * Initializes the Modal instance.
     * @param {string} modalId - The ID of the modal container element.
     * @param {string} openButtonId - The ID of the button that opens the modal.
     * @param {string} closeButtonId - The ID of the button that closes the modal.
     * @param {string} headerId - The ID of the modal header element (for dragging).
     * @param {function} [onOpen] - Optional callback when modal opens.
     * @param {function} [onClose] - Optional callback when modal closes.
     */
    constructor(modalId, openButtonId, closeButtonId, headerId, onOpen, onClose) {
        this.modalElement = document.getElementById(modalId);
        this.openButton = document.getElementById(openButtonId);
        this.closeButton = document.getElementById(closeButtonId);
        this.headerElement = document.getElementById(headerId);
        this.onOpen = onOpen;
        this.onClose = onClose;

        this.isDragging = false;
        // Store initial offset from top-left corner of modal to mouse pointer
        this.offsetX = 0;
        this.offsetY = 0;

        this.closeHandler = this.close.bind(this); // Bind close method once
        if (!this.modalElement || !this.openButton || !this.closeButton || !this.headerElement) {
            console.error("Modal initialization failed: One or more elements not found.");
            return;
        }

        this._bindEvents();
        // Initial position is set on open()
    }

    /**
     * Binds necessary event listeners for opening, closing, and dragging.
     * @private
     */
    _bindEvents() {
        this.openButton.addEventListener('click', this.open.bind(this));

        // Use bound handler for both click and touchend on close button
        this.closeButton.addEventListener('click', this.closeHandler);
        this.closeButton.addEventListener('touchend', this.closeHandler);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modalElement.classList.contains('hidden')) {
                this.close();
            }
        });

        // Drag events
        this.headerElement.addEventListener('mousedown', this._dragStart.bind(this));
        document.addEventListener('mousemove', this._drag.bind(this));
        document.addEventListener('mouseup', this._dragEnd.bind(this));
        this.modalElement.addEventListener('mousedown', (e) => {
             if (e.target !== this.headerElement && !this.headerElement.contains(e.target)) {
                 e.stopPropagation();
             }
        });

        // Touch events
        this.headerElement.addEventListener('touchstart', this._dragStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this._drag.bind(this), { passive: false });
        document.addEventListener('touchend', this._dragEnd.bind(this));
    }

     /**
     * Sets the initial position (centered).
     * Forces centering using transform, clearing absolute pixel positions.
     * @private
     */
     _setInitialPosition() {
         // Ensure any previous pixel positions are cleared
         this.modalElement.style.left = '50%';
         this.modalElement.style.top = '50%';
         this.modalElement.style.transform = 'translate(-50%, -50%)';
     }

    /**
     * Opens the modal.
     */
    open() {
        this.modalElement.classList.remove('hidden');
        // Set position immediately after removing 'hidden'
        this._setInitialPosition();
        if (this.onOpen) {
            this.onOpen();
        }
        console.log("Modal opened");
    }

    /**
     * Closes the modal.
     */
    close() {
        if (this.modalElement.classList.contains('hidden')) {
            return;
        }
        this.modalElement.classList.add('hidden');
        if (this.onClose) {
            this.onClose();
        }
        console.log("Modal closed");
    }

    /**
     * Handles the start of a drag operation (mousedown/touchstart).
     * @param {Event} e - The event object.
     * @private
     */
    _dragStart(e) {
        // Ensure drag starts only on the header itself
        if (!(e.target === this.headerElement || this.headerElement.contains(e.target))) {
            return;
        }

        this.isDragging = true;
        this.modalElement.style.cursor = 'grabbing';
        this.headerElement.style.cursor = 'grabbing';
        // Prevent text selection during drag
        this.modalElement.style.userSelect = 'none';
        this.modalElement.style.webkitUserSelect = 'none';

        // Add dragging class to disable CSS transitions via CSS rule
        this.modalElement.classList.add('is-dragging');

        // Store initial pointer coordinates (relative to document)
        let initialPointerX_page, initialPointerY_page;
        if (e.type === "touchstart") {
            if (e.touches.length !== 1) { this._dragEnd(e); return; }
            initialPointerX_page = e.touches[0].pageX;
            initialPointerY_page = e.touches[0].pageY;
            // We will preventDefault inside rAF if drag truly starts
        } else { // Mouse event
            initialPointerX_page = e.pageX;
            initialPointerY_page = e.pageY;
        }

        // Defer position calculation and style application to the next animation frame
        // This allows the browser to settle rendering after initial centering styles
        requestAnimationFrame(() => {
            // Double-check if still dragging when the frame callback executes
            if (!this.isDragging) return;

            // --- Inside requestAnimationFrame ---
            // 1. Get visual position + scroll offset = absolute document position
            const rect = this.modalElement.getBoundingClientRect();
            const currentAbsoluteX = rect.left + window.scrollX;
            const currentAbsoluteY = rect.top + window.scrollY;

            // 2. Calculate offset based on initial PAGE coordinates captured before rAF
            this.offsetX = initialPointerX_page - currentAbsoluteX;
            this.offsetY = initialPointerY_page - currentAbsoluteY;

            // 3. Remove transform
            this.modalElement.style.transform = '';

            // 4. Set position explicitly using the calculated absolute pixel values
            this.modalElement.style.left = `${currentAbsoluteX}px`;
            this.modalElement.style.top = `${currentAbsoluteY}px`;

            // Prevent default scroll/actions *only if* drag really started and we got into rAF
            if (e.type === "touchstart") {
               e.preventDefault();
            }
            // --- End Inside requestAnimationFrame ---
        });
    }


    /**
     * Handles the drag movement (mousemove/touchmove).
     * @param {Event} e - The event object.
     * @private
     */
    _drag(e) {
        if (!this.isDragging) return;

        // Use Page coordinates for calculating the new position
        let pointerX_page, pointerY_page;

        if (e.type === "touchmove") {
             if (e.touches.length !== 1) { this._dragEnd(e); return; }
             pointerX_page = e.touches[0].pageX;
             pointerY_page = e.touches[0].pageY;
             // preventDefault is handled in dragStart's rAF for touch
        } else { // Mouse event
             pointerX_page = e.pageX;
             pointerY_page = e.pageY;
             e.preventDefault(); // Prevent text selection during mouse drag
        }

        // Calculate the new top-left corner position in document coordinates.
        // New absolute position = current pointer page coordinates minus the initial offset.
        let newX = pointerX_page - this.offsetX;
        let newY = pointerY_page - this.offsetY;


        // Boundary check relative to document size
        const modalWidth = this.modalElement.offsetWidth;
        const modalHeight = this.modalElement.offsetHeight;
        const minX = 0;
        const minY = 0;
        // Ensure we check against the larger of scroll size or window size for max bounds
        const maxX = Math.max(document.documentElement.scrollWidth, window.innerWidth) - modalWidth;
        const maxY = Math.max(document.documentElement.scrollHeight, window.innerHeight) - modalHeight;

        // Clamp position within boundaries
        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));

        this._setPosition(newX, newY);
    }


    /**
     * Handles the end of a drag operation (mouseup/touchend).
     * @param {Event} e - The event object.
     * @private
     */
    _dragEnd(e) {
        if (this.isDragging) {
             this.isDragging = false;
             this.modalElement.classList.remove('is-dragging'); // Remove class
             this.modalElement.style.cursor = ''; // Reset cursor
             this.headerElement.style.cursor = 'move'; // Reset header cursor
             // Re-enable text selection if needed
             this.modalElement.style.userSelect = '';
             this.modalElement.style.webkitUserSelect = '';
         }
    }

    /**
     * Sets the position of the modal element using left/top styles.
     * @param {number} xPos - The target X coordinate (px).
     * @param {number} yPos - The target Y coordinate (px).
     * @private
     */
    _setPosition(xPos, yPos) {
        this.modalElement.style.left = `${xPos}px`;
        this.modalElement.style.top = `${yPos}px`;
    }
}

/*
// --- Usage Example ---
// Assuming index.html has elements with IDs:
// 'my-modal', 'open-modal-btn', 'close-modal-btn', 'my-modal-header'
//
// In main.js or another script:
//
// function handleModalOpen() { console.log('Modal is opening!'); }
// function handleModalClose() { console.log('Modal is closing!'); }
//
// const myModalInstance = new Modal(
//     'my-modal',           // ID of the modal container
//     'open-modal-btn',     // ID of the button that opens the modal
//     'close-modal-btn',    // ID of the button that closes the modal
//     'my-modal-header',    // ID of the header element used for dragging
//     handleModalOpen,      // Optional callback function on open
//     handleModalClose      // Optional callback function on close
// );
//
// // The Modal constructor automatically binds the open button.
// // The close button and ESC key are also handled internally.
// // Dragging is handled by interactions with the header element.
*/