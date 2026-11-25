import { describe, expect, it } from 'vitest';
import { ACCOUNT_MODAL_DELAY_MS, type AccountModalEvent, type AccountModalState, accountModalReducer } from './accountModal';

const run = (events: AccountModalEvent[], from: AccountModalState = 'waiting') => events.reduce(accountModalReducer, from);

describe('account modal', () => {
  it('starts closed, waiting for the progress list to be seen', () => {
    expect(run([])).toBe('waiting');
  });
  it('opens after the delay', () => {
    expect(run(['delay_passed'])).toBe('open');
  });
  it('the delay is about 1 to 1.5 seconds', () => {
    expect(ACCOUNT_MODAL_DELAY_MS).toBeGreaterThanOrEqual(1000);
    expect(ACCOUNT_MODAL_DELAY_MS).toBeLessThanOrEqual(1500);
  });
  it('can not be closed or reopened before it has opened', () => {
    expect(run(['dismiss'])).toBe('waiting');
    expect(run(['reopen'])).toBe('waiting');
    expect(run(['dismiss', 'reopen', 'delay_passed'])).toBe('open');
  });
  it('Escape / back closes it, the button reopens it', () => {
    expect(run(['delay_passed', 'dismiss'])).toBe('closed');
    expect(run(['delay_passed', 'dismiss', 'reopen'])).toBe('open');
    expect(run(['delay_passed', 'dismiss', 'reopen', 'dismiss'])).toBe('closed');
  });
  it('the delay timer firing again never reopens a closed modal', () => {
    expect(run(['delay_passed', 'dismiss', 'delay_passed'])).toBe('closed');
  });
  it('reopen while open changes nothing', () => {
    expect(run(['delay_passed', 'reopen'])).toBe('open');
  });
});
