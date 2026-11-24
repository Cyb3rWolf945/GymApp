const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const inToCm = (inches: number): number => inches * CM_PER_IN;
export const cmToIn = (cm: number): number => cm / CM_PER_IN;

export function ftInToCm(feet: number, inches = 0): number {
  return inToCm(feet * 12 + inches);
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  let totalIn = Math.round(cmToIn(cm));
  const feet = Math.floor(totalIn / 12);
  totalIn -= feet * 12;
  return { feet, inches: totalIn };
}
