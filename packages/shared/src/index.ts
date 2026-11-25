export const APP_NAME = 'Fuelift';

export function greet(name: string): string {
  return `Welcome, ${name}`;
}
export * from './catalog';
export * from './db';
export * from './ai/index.ts';
export * from './onboarding/index.ts';
export * from './calc/index.ts';
export * from './plan/index.ts';
