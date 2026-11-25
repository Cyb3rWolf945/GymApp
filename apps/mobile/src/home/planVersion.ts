// A tiny signal: "the plan changed on the server" (e.g. after "Update my plan").
// The plan data provider listens and reloads, so screens outside the tabs can refresh the tabs.
const listeners = new Set<() => void>();
export const onPlanChanged = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const notifyPlanChanged = (): void => listeners.forEach((fn) => fn());
