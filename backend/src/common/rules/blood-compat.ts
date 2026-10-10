// T4.5 : compatibilité ABO/Rh PROVISOIRE (globules rouges, don de sang total).
// À remplacer par getCompatibleGroups de M2 (T9/T12) une fois la spécification validée avec le CNTS.
import { BloodGroup } from '../../database/enums';

/** Groupes receveurs que chaque groupe donneur peut servir. */
const CAN_DONATE_TO: Readonly<Record<BloodGroup, readonly BloodGroup[]>> = {
  [BloodGroup.ONeg]: Object.values(BloodGroup),
  [BloodGroup.OPos]: [BloodGroup.OPos, BloodGroup.APos, BloodGroup.BPos, BloodGroup.ABPos],
  [BloodGroup.ANeg]: [BloodGroup.ANeg, BloodGroup.APos, BloodGroup.ABNeg, BloodGroup.ABPos],
  [BloodGroup.APos]: [BloodGroup.APos, BloodGroup.ABPos],
  [BloodGroup.BNeg]: [BloodGroup.BNeg, BloodGroup.BPos, BloodGroup.ABNeg, BloodGroup.ABPos],
  [BloodGroup.BPos]: [BloodGroup.BPos, BloodGroup.ABPos],
  [BloodGroup.ABNeg]: [BloodGroup.ABNeg, BloodGroup.ABPos],
  [BloodGroup.ABPos]: [BloodGroup.ABPos],
};

export function canDonateTo(donor: BloodGroup, recipient: BloodGroup): boolean {
  return CAN_DONATE_TO[donor].includes(recipient);
}

/** Groupes de donneurs compatibles avec le groupe demandé. */
export function compatibleDonorGroups(requested: BloodGroup): BloodGroup[] {
  return Object.values(BloodGroup).filter((g) => canDonateTo(g, requested));
}
