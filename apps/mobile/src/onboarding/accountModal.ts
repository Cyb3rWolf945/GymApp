// When the account modal on "Building your plan…" is open. Pure, so the rules are unit-tested.
//
//   waiting ──(delay passed)──▶ open ──(Escape / Android back)──▶ closed ──(button)──▶ open
//
// Tapping the backdrop never closes it (the sheet has no backdrop handler in this mode); only Escape or the back
// button do, and then a visible "Create my account" button brings it back.

/** Let people see the progress list before the modal opens (about 1 to 1.5 s). */
export const ACCOUNT_MODAL_DELAY_MS = 1200;

export type AccountModalState = 'waiting' | 'open' | 'closed';
export type AccountModalEvent = 'delay_passed' | 'dismiss' | 'reopen';

export function accountModalReducer(state: AccountModalState, event: AccountModalEvent): AccountModalState {
  switch (event) {
    case 'delay_passed':
      return state === 'waiting' ? 'open' : state; // opens once; never re-opens by itself after it was closed
    case 'dismiss':
      return state === 'open' ? 'closed' : state;
    case 'reopen':
      return state === 'closed' ? 'open' : state;
  }
}
