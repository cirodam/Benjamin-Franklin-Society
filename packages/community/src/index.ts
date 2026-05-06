// @ecf/community — entry point
// Bank interactions must go through HTTP client — never import @ecf/bank directly

export { CommunityDb } from "./CommunityDb.js";
export { Person } from "./person/Person.js";
export type { PersonCredential, LanguageProficiency } from "./person/Person.js";
export { PersonLoader } from "./person/PersonLoader.js";
export { PersonService } from "./person/PersonService.js";
export type { PersonPatch } from "./person/PersonService.js";

export { CommunityRole } from "./common/CommunityRole.js";
export { CommunityRoleLoader } from "./common/domain/CommunityRoleLoader.js";
export { FunctionalUnit } from "./common/domain/FunctionalUnit.js";
export { FunctionalDomain } from "./common/domain/FunctionalDomain.js";
export { FunctionalUnitLoader } from "./common/domain/FunctionalUnitLoader.js";
export { FunctionalDomainLoader } from "./common/domain/FunctionalDomainLoader.js";
export { UnitTemplateRegistry } from "./common/domain/UnitTemplateRegistry.js";

export { LeaderPool } from "./governance/LeaderPool.js";
export { LeaderPoolLoader } from "./governance/LeaderPoolLoader.js";
export { VoteThreshold } from "./governance/Constitution.js";
export type { ConstitutionAmendment, ConstitutionalParameter, ConstitutionMetadata, ActionAuthority, GovernanceBody } from "./governance/Constitution.js";
export { ConstitutionLoader } from "./governance/ConstitutionLoader.js";
export { DocumentLoader } from "./governance/DocumentLoader.js";

export { CentralBank } from "./domains/central_bank/CentralBank.js";
export { CentralBankLoader } from "./domains/central_bank/CentralBankLoader.js";
export type { CentralBankRecord } from "./domains/central_bank/CentralBankLoader.js";

export { SocialInsuranceMember } from "./domains/social_insurance/SocialInsuranceMember.js";
export { SocialInsuranceMemberLoader } from "./domains/social_insurance/SocialInsuranceMemberLoader.js";
export { SocialInsuranceBank } from "./domains/social_insurance/SocialInsuranceBank.js";
export { SocialInsuranceBankLoader } from "./domains/social_insurance/SocialInsuranceBankLoader.js";
export type { SocialInsuranceBankRecord } from "./domains/social_insurance/SocialInsuranceBankLoader.js";

export { PaymentTokenService } from "./PaymentTokenService.js";

export { Shift } from "./shift/Shift.js";
export { ShiftLoader } from "./shift/ShiftLoader.js";
export { ShiftService } from "./shift/ShiftService.js";

