// AJOUT : marque les routes accessibles à un compte hopital/crt dont l'établissement n'est pas encore validé.
import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVALIDATED_INSTITUTION = 'allowUnvalidatedInstitution';
export const AllowUnvalidatedInstitution = () => SetMetadata(ALLOW_UNVALIDATED_INSTITUTION, true);
