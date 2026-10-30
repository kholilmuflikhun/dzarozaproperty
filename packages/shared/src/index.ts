export type BillingCycle="MONTHLY"|"YEARLY";
export type SubscriptionState="INCOMPLETE"|"TRIALING"|"ACTIVE"|"PAST_DUE"|"PAUSED"|"CANCELED"|"EXPIRED";
export type LicenseState="ACTIVE"|"SUSPENDED"|"REVOKED"|"EXPIRED";
export interface TenantContext{organizationId:string;userId:string;role:"OWNER"|"ADMIN"|"PROJECT_MANAGER"|"FINANCE"|"SALES"|"STAFF"|"CLIENT"}
export interface EntitlementSnapshot{planCode:string;subscriptionStatus:SubscriptionState;validUntil:string|null;features:Record<string,boolean>;limits:{users:number|null;projects:number|null;storageMb:number|null}}
