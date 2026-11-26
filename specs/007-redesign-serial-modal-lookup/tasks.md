# Tasks: 007 — Redesign `#success-dialog` (Concept 1A) & `#lookup-result-container` (Concept 2A)

- [x] **T1**: Create Spec Kit documentation (`spec.md`, `plan.md`, `tasks.md`) under `specs/007-redesign-serial-modal-lookup/`.
- [x] **T2**: Update `json/i18n.js` (remove dead `modalFree*` keys, add 14 VI/EN keys with 100% parity).
- [x] **T3**: Redesign `#success-dialog` in `serial.html` to Concept 1A Split Checkout and bump `serial.js` cache bust.
- [x] **T4**: Upgrade `serial.js` (`escapeHtml`, `syncModalPaymentView`, `crypto_intl` modal support, lightbox `<dialog>` top-layer fix, remove `isFree`, Concept 2A 5-state `renderLookupResultCard` + email prefill fix).
- [x] **T5**: Update `styles.css` (fix Dark-mode `--sr-*` scoping for `.sr-modal`/`.sr-lightbox`/`.sr-toast`, style `.sr-modal-*`, `.sr-res-*`, `.sr-page .lookup-history-*` with Dark/Light parity and Animate UI rules).
- [x] **T6**: Run automated JS/i18n/CSS/DOM verification, inspect `git diff`, and sync `tasks.md` + `HANDOFF.md`.
