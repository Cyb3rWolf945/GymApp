/**
 * Press props for an SVG element, by platform. `react-native-svg` turns `onPress` into six responder props that, on the web,
 * end up on the DOM `<path>` where React drops them with a console warning (and the tap does nothing). On the web a region
 * gets a click handler and the keyboard (Tab to reach it, Enter or Space to press); on a phone, `onPress`.
 */
export type SvgPressProps = Record<string, unknown>;

export function pressableSvgProps(handler: (() => void) | undefined, os: string, focus?: { onFocus: (e: unknown) => void; onBlur: () => void }): SvgPressProps {
  if (!handler) return {};
  if (os !== 'web') return { onPress: handler };
  return {
    // `null`, not absent: react-native-svg's web build sets `onClick = onPress` unless `onPress` is null, which would erase this.
    onPress: null,
    onClick: handler,
    onKeyDown: (e: { key?: string; preventDefault?: () => void }) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault?.();
      handler();
    },
    tabIndex: 0,
    // Not `role="button"`: on the web react-native-svg turns that into a real <button> element inside the SVG.
    'aria-roledescription': 'button',
    style: { cursor: 'pointer', outline: 'none' },
    ...focus,
  };
}
