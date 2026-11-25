import { describe, expect, it } from 'vitest';
import { ACCOUNT_MODAL_DELAY_MS, type AccountModalEvent, type AccountModalState, accountModalReducer, isOpen, stepOf } from './accountModal';

const run = (events: AccountModalEvent[], from: AccountModalState = 'waiting') => events.reduce(accountModalReducer, from);

describe('account modal, step 1 (account)', () => {
  it('starts closed, waiting for the progress list to be seen', () => {
    expect(run([])).toBe('waiting');
  });
  it('opens on the account step after the delay', () => {
    expect(run(['delay_passed'])).toBe('account');
  });
  it('the delay is about 1 to 1.5 seconds', () => {
    expect(ACCOUNT_MODAL_DELAY_MS).toBeGreaterThanOrEqual(1000);
    expect(ACCOUNT_MODAL_DELAY_MS).toBeLessThanOrEqual(1500);
  });
  it('can not be closed or reopened before it has opened', () => {
    expect(run(['dismiss'])).toBe('waiting');
    expect(run(['reopen'])).toBe('waiting');
    expect(run(['dismiss', 'reopen', 'delay_passed'])).toBe('account');
  });
  it('Escape / back closes it, the button reopens it on the same step', () => {
    expect(run(['delay_passed', 'dismiss'])).toBe('closed_account');
    expect(run(['delay_passed', 'dismiss', 'reopen'])).toBe('account');
    expect(run(['delay_passed', 'dismiss', 'reopen', 'dismiss'])).toBe('closed_account');
  });
  it('the delay timer firing again never reopens a closed modal', () => {
    expect(run(['delay_passed', 'dismiss', 'delay_passed'])).toBe('closed_account');
  });
  it('reopen while open changes nothing', () => {
    expect(run(['delay_passed', 'reopen'])).toBe('account');
  });
});

describe('account modal, step 2 (plan)', () => {
  it('moves to the plan step in place once the account exists', () => {
    expect(run(['delay_passed', 'signed_in'])).toBe('plan');
  });
  it('also moves on when the modal was closed (the sign-in finished in a redirect), or had not opened yet', () => {
    expect(run(['delay_passed', 'dismiss', 'signed_in'])).toBe('plan');
    expect(run(['signed_in'])).toBe('plan');
  });
  it('an account that already has a plan skips step 2', () => {
    expect(run(['delay_passed', 'signed_in_subscribed'])).toBe('done');
    expect(run(['signed_in_subscribed'])).toBe('done');
  });
  it('a second sign-in signal does nothing once past step 1', () => {
    expect(run(['delay_passed', 'signed_in', 'signed_in'])).toBe('plan');
    expect(run(['delay_passed', 'signed_in', 'signed_in_subscribed'])).toBe('plan');
    expect(run(['delay_passed', 'signed_in', 'skip', 'signed_in'])).toBe('done');
  });
  it('"See my plan first" finishes the flow', () => {
    expect(run(['delay_passed', 'signed_in', 'skip'])).toBe('done');
    expect(run(['delay_passed', 'signed_in', 'dismiss', 'skip'])).toBe('done');
  });
  it('skip does nothing on step 1', () => {
    expect(run(['delay_passed', 'skip'])).toBe('account');
    expect(run([], 'waiting')).toBe('waiting');
  });
  it('Escape / back closes step 2, and its button reopens step 2', () => {
    expect(run(['delay_passed', 'signed_in', 'dismiss'])).toBe('closed_plan');
    expect(run(['delay_passed', 'signed_in', 'dismiss', 'reopen'])).toBe('plan');
  });
  it('a cancelled checkout lands back on step 2', () => {
    expect(run(['checkout_cancelled'])).toBe('plan');
    expect(run(['delay_passed', 'signed_in', 'checkout_cancelled'])).toBe('plan');
    expect(run(['delay_passed', 'signed_in', 'dismiss', 'checkout_cancelled'])).toBe('plan');
    expect(run([], 'done')).toBe('done');
    expect(run(['checkout_cancelled'], 'done')).toBe('plan');
  });
  it('once done, nothing reopens it', () => {
    for (const e of ['delay_passed', 'dismiss', 'reopen', 'signed_in', 'signed_in_subscribed', 'skip'] as const) expect(run([e], 'done'), e).toBe('done');
  });
});

describe('helpers', () => {
  it('knows when the modal is on screen', () => {
    expect(isOpen('account')).toBe(true);
    expect(isOpen('plan')).toBe(true);
    for (const s of ['waiting', 'closed_account', 'closed_plan', 'done'] as const) expect(isOpen(s), s).toBe(false);
  });
  it('knows the step, for "1 of 2"', () => {
    expect(stepOf('account')).toBe(1);
    expect(stepOf('closed_account')).toBe(1);
    expect(stepOf('plan')).toBe(2);
    expect(stepOf('closed_plan')).toBe(2);
    expect(stepOf('waiting')).toBeNull();
    expect(stepOf('done')).toBeNull();
  });
});
