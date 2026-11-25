// The account modal on "Building your plan…" (E-42, with the plan step of E-62). Pure, so the rules are unit-tested.
//
//   waiting ──(delay passed)──▶ account ──(signed in)──▶ plan ──(skip / checkout started)──▶ done
//                                  │  ▲                  │  ▲
//                          (Escape / back)  (button)  (Escape / back)  (button)
//                                  ▼  │                  ▼  │
//                             closed_account         closed_plan
//
// Tapping the backdrop never closes it (the sheet has no backdrop handler in this mode); only Escape or the back
// button do, and then a visible button ("Create my account" or "Choose a plan") brings it back on the same step.
// Someone who already has a plan skips step 2. A cancelled Stripe Checkout lands back on step 2.

/** Let people see the progress list before the modal opens (about 1 to 1.5 s). */
export const ACCOUNT_MODAL_DELAY_MS = 1200;

export type AccountModalState = 'waiting' | 'account' | 'plan' | 'closed_account' | 'closed_plan' | 'done';
export type AccountModalEvent =
  | 'delay_passed'
  | 'dismiss'
  | 'reopen'
  /** The account now exists and has no subscription: show the plans. */
  | 'signed_in'
  /** The account exists and already has an active plan: nothing to choose. */
  | 'signed_in_subscribed'
  /** "See my plan first". */
  | 'skip'
  /** Back from Stripe Checkout without paying. */
  | 'checkout_cancelled';

/** The states in which the modal is on screen. */
export const isOpen = (s: AccountModalState): boolean => s === 'account' || s === 'plan';
/** The step a state belongs to, for the "1 of 2" indicator (null once finished or before it starts). */
export const stepOf = (s: AccountModalState): 1 | 2 | null => (s === 'account' || s === 'closed_account' ? 1 : s === 'plan' || s === 'closed_plan' ? 2 : null);

const BEFORE_PLAN: readonly AccountModalState[] = ['waiting', 'account', 'closed_account'];

export function accountModalReducer(state: AccountModalState, event: AccountModalEvent): AccountModalState {
  switch (event) {
    case 'delay_passed':
      return state === 'waiting' ? 'account' : state; // opens once; never re-opens by itself after it was closed
    case 'dismiss':
      return state === 'account' ? 'closed_account' : state === 'plan' ? 'closed_plan' : state;
    case 'reopen':
      return state === 'closed_account' ? 'account' : state === 'closed_plan' ? 'plan' : state;
    case 'signed_in':
      return BEFORE_PLAN.includes(state) ? 'plan' : state; // in place: a session appearing later (second tab) changes nothing
    case 'signed_in_subscribed':
      return BEFORE_PLAN.includes(state) ? 'done' : state;
    case 'skip':
      return state === 'plan' || state === 'closed_plan' ? 'done' : state;
    case 'checkout_cancelled':
      return 'plan'; // whatever the modal was doing, the person is back from Stripe and picks again
  }
}
