import { describe, expect, it, vi } from 'vitest';
import { pressableSvgProps } from './pressableSvg';

describe('pressableSvgProps', () => {
  it('web: click and keyboard, never onPress (which would put responder props on the DOM)', () => {
    const handler = vi.fn();
    const p = pressableSvgProps(handler, 'web') as { onClick: () => void; onKeyDown: (e: { key: string; preventDefault: () => void }) => void; tabIndex: number; onPress?: unknown; role?: string };
    expect(p.onPress).toBeNull(); // null (not absent) keeps react-native-svg from adding responder props and from overwriting onClick
    expect(p.tabIndex).toBe(0);
    expect(p.role).toBeUndefined(); // react-native-svg would render a <button> inside the SVG
    p.onClick();
    expect(handler).toHaveBeenCalledTimes(1);
    for (const key of ['Enter', ' ']) {
      const preventDefault = vi.fn();
      p.onKeyDown({ key, preventDefault });
      expect(preventDefault).toHaveBeenCalled();
    }
    expect(handler).toHaveBeenCalledTimes(3);
    p.onKeyDown({ key: 'a', preventDefault: vi.fn() });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it.each(['ios', 'android'])('%s: onPress only', (os) => {
    const handler = vi.fn();
    const p = pressableSvgProps(handler, os);
    expect(Object.keys(p)).toEqual(['onPress']);
    expect(p.onPress).toBe(handler);
  });

  it('no handler: no props at all, on any platform', () => {
    expect(pressableSvgProps(undefined, 'web')).toEqual({});
    expect(pressableSvgProps(undefined, 'ios')).toEqual({});
  });
});
