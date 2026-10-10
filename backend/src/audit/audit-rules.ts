// AJOUT : T7.2 actions sensibles auditées (méthode + chemin de route Express)
export interface AuditRule {
  method: string;
  path: string;
  action: string;
  entity: string;
}

export const AUDIT_RULES: AuditRule[] = [
  { method: 'POST', path: '/requests', action: 'create', entity: 'blood_request' },
  { method: 'PATCH', path: '/institutions/:id/validate', action: 'validate', entity: 'institution' },
  // T14 : décision de l'admin sur une demande en_revue
  { method: 'PATCH', path: '/requests/:id/review', action: 'review', entity: 'blood_request' },
  // R4/F1.5 : accès aux données de santé
  { method: 'POST', path: '/donors/:id/eligibility-form', action: 'submit_health_form', entity: 'eligibility_form' },
  // T7.4 : droit à l'effacement (route ajoutée au commit T7.4, sans effet d'ici là)
  { method: 'DELETE', path: '/donors/me', action: 'erase', entity: 'donor' },
];

export function findAuditRule(method: string, routePath: string): AuditRule | undefined {
  return AUDIT_RULES.find((r) => r.method === method.toUpperCase() && r.path === routePath);
}
