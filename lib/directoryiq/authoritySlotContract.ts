export const AUTHORITY_SLOT_MIN = 1;
export const AUTHORITY_SLOT_MAX = 5;
export const AUTHORITY_SLOT_COUNT = AUTHORITY_SLOT_MAX - AUTHORITY_SLOT_MIN + 1;

export function isAuthoritySlotInRange(slot: number): boolean {
  return Number.isInteger(slot) && slot >= AUTHORITY_SLOT_MIN && slot <= AUTHORITY_SLOT_MAX;
}
