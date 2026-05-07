import { FunctionalDomain } from "@ecf/core";

/**
 * Base class for all federation-level functional domains.
 *
 * Federation domains represent institutional mandates at the inter-community
 * level (e.g. Insurance, Reinsurance, Standards). Unlike community domains,
 * federation domains manage specific institutional entities directly rather
 * than template-instantiated units.
 */
export abstract class FederationFunctionalDomain extends FunctionalDomain {}
