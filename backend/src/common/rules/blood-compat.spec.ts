import { BloodGroup } from '../../database/enums';
import { canDonateTo, compatibleDonorGroups } from './blood-compat';

describe('compatibilité ABO/Rh (provisoire)', () => {
  it('O- donne à tout le monde', () => {
    for (const g of Object.values(BloodGroup)) expect(canDonateTo(BloodGroup.ONeg, g)).toBe(true);
  });

  it('AB+ ne donne qu\'à AB+', () => {
    expect(compatibleDonorGroups(BloodGroup.ABPos)).toHaveLength(8);
    for (const g of Object.values(BloodGroup)) {
      expect(canDonateTo(BloodGroup.ABPos, g)).toBe(g === BloodGroup.ABPos);
    }
  });

  it('A+ ne peut pas donner à O+ ni à A-', () => {
    expect(canDonateTo(BloodGroup.APos, BloodGroup.OPos)).toBe(false);
    expect(canDonateTo(BloodGroup.APos, BloodGroup.ANeg)).toBe(false);
  });

  it('un receveur O- n\'accepte que O-', () => {
    expect(compatibleDonorGroups(BloodGroup.ONeg)).toEqual([BloodGroup.ONeg]);
  });

  it('un receveur A+ accepte A+, A-, O+, O-', () => {
    expect(compatibleDonorGroups(BloodGroup.APos).sort()).toEqual(
      [BloodGroup.APos, BloodGroup.ANeg, BloodGroup.OPos, BloodGroup.ONeg].sort(),
    );
  });
});
