import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, dismissToast, fractionOf, progressFraction, pushToast, snapToStep, valueFromPosition, type ToastItem } from './logic';

describe('slider math', () => {
  it('snaps to the step and clamps', () => {
    expect(snapToStep(72.6, 40, 140, 0.5)).toBe(72.5);
    expect(snapToStep(500, 40, 140, 1)).toBe(140);
    expect(snapToStep(-5, 40, 140, 1)).toBe(40);
    expect(snapToStep(3, 5, 5, 1)).toBe(5);
  });
  it('maps a pointer position to a value', () => {
    expect(valueFromPosition(150, 300, 0, 10, 1)).toBe(5);
    expect(valueFromPosition(-20, 300, 0, 10, 1)).toBe(0);
    expect(valueFromPosition(999, 300, 0, 10, 1)).toBe(10);
    expect(valueFromPosition(10, 0, 0, 10, 1)).toBe(0);
  });
  it('gives the thumb fraction', () => {
    expect(fractionOf(5, 0, 10)).toBe(0.5);
    expect(fractionOf(15, 0, 10)).toBe(1);
    expect(fractionOf(1, 1, 1)).toBe(0);
  });
});

describe('progress and toasts', () => {
  it('progress is 0..1', () => {
    expect(progressFraction(3, 12)).toBe(0.25);
    expect(progressFraction(20, 12)).toBe(1);
    expect(progressFraction(1, 0)).toBe(0);
  });
  it('keeps the newest toasts and dismisses by id', () => {
    let list: ToastItem[] = [];
    for (let i = 1; i <= MAX_TOASTS + 2; i++) list = pushToast(list, { id: i, message: `m${i}`, tone: 'info' });
    expect(list.map((t) => t.id)).toEqual([3, 4, 5]);
    expect(dismissToast(list, 4).map((t) => t.id)).toEqual([3, 5]);
  });
});
