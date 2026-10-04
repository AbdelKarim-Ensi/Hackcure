import { COMPATIBILITY } from './config';
import { BloodGroup } from './types';

/** Règle déterministe : le groupe du donneur peut-il être donné au groupe demandé ? */
export function isCompatible(
  donorGroup: BloodGroup,
  requestGroup: BloodGroup,
  exactMatchOnly = false,
): boolean {
  if (exactMatchOnly) return donorGroup === requestGroup;
  return COMPATIBILITY[donorGroup].includes(requestGroup);
}
