// AJOUT : T7.2 tests de la table d'audit
import { findAuditRule } from './audit-rules';

describe('audit rules', () => {
  it('audite la création de demande', () => {
    expect(findAuditRule('POST', '/requests')?.action).toBe('create');
  });
  it("audite la validation d'établissement", () => {
    expect(findAuditRule('patch', '/institutions/:id/validate')?.entity).toBe('institution');
  });
  it('ignore les routes non sensibles', () => {
    expect(findAuditRule('GET', '/requests/:id')).toBeUndefined();
  });
});
