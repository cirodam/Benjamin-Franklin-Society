// @ecf/community — entry point
// Bank interactions must go through HTTP client — never import @ecf/bank directly

export { CommunityDb } from "./CommunityDb.js";
export { Person } from "./person/Person.js";
export type { PersonCredential, LanguageProficiency } from "./person/Person.js";
export { PersonLoader } from "./person/PersonLoader.js";
export { PersonService } from "./person/PersonService.js";
export type { PersonPatch } from "./person/PersonService.js";

export { FunctionalRole } from "@ecf/core";
export { FunctionalRoleLoader } from "./common/domain/FunctionalRoleLoader.js";
export { FunctionalUnit } from "@ecf/core";
export { FunctionalDomain } from "@ecf/core";
export { FunctionalUnitLoader } from "./common/domain/FunctionalUnitLoader.js";
export { FunctionalDomainLoader } from "./common/domain/FunctionalDomainLoader.js";
export { UnitTemplateRegistry } from "./common/domain/UnitTemplateRegistry.js";

export { LeaderPool } from "@ecf/core";
export { LeaderPoolLoader } from "./governance/LeaderPoolLoader.js";
export { DocumentLoader } from "./governance/DocumentLoader.js";
export { CommunityIdentityStore } from "./CommunityIdentityStore.js";

export { CentralBank } from "./domains/CentralBank.js";
export { CentralBankLoader } from "./domains/CentralBankLoader.js";
export type { CentralBankRecord } from "./domains/CentralBankLoader.js";

export { SocialInsuranceMember } from "./domains/SocialInsuranceMember.js";
export { SocialInsuranceMemberLoader } from "./domains/SocialInsuranceMemberLoader.js";
export { SocialInsuranceBank } from "./domains/SocialInsuranceBank.js";
export { SocialInsuranceBankLoader } from "./domains/SocialInsuranceBankLoader.js";
export type { SocialInsuranceBankRecord } from "./domains/SocialInsuranceBankLoader.js";

export { PaymentTokenService } from "./PaymentTokenService.js";

export { Shift } from "@ecf/core";
export { ShiftLoader } from "./shift/ShiftLoader.js";
export { ShiftService } from "@ecf/core";

