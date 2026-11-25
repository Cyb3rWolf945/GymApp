import { useWindowDimensions } from 'react-native';
import { type Breakpoint, breakpointFor } from './tokens';

/**
 * The current breakpoint. Built on `useWindowDimensions`, so it updates when a web window is resized or a device
 * rotates, with no reload. The width-to-breakpoint mapping is the pure `breakpointFor` (unit-tested).
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return breakpointFor(width);
}
