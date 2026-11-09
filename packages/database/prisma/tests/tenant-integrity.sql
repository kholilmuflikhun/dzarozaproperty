-- Integration checks for tenant-scoped composite foreign keys.
-- Uses an isolated transaction and rolls all fixtures back at the end.
BEGIN;

INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES
  ('tenant-a', 'Tenant A', 'tenant-a', NOW(), NOW()),
  ('tenant-b', 'Tenant B', 'tenant-b', NOW(), NOW());

INSERT INTO "Plan" ("id", "code", "name", "monthlyPrice", "yearlyPrice", "featureFlags", "createdAt", "updatedAt")
VALUES ('plan-test', 'TEST', 'Test Plan', 10000, 100000, '{}'::jsonb, NOW(), NOW());

INSERT INTO "Client" ("id", "organizationId", "name", "createdAt", "updatedAt")
VALUES
  ('client-a', 'tenant-a', 'Client A', NOW(), NOW()),
  ('client-b', 'tenant-b', 'Client B', NOW(), NOW());

INSERT INTO "Subscription" ("id", "organizationId", "planId", "billingCycle", "createdAt", "updatedAt")
VALUES
  ('subscription-a', 'tenant-a', 'plan-test', 'MONTHLY', NOW(), NOW()),
  ('subscription-b', 'tenant-b', 'plan-test', 'MONTHLY', NOW(), NOW());

INSERT INTO "License" ("id", "organizationId", "subscriptionId", "keyHash", "keyPrefix", "createdAt", "updatedAt")
VALUES ('license-a', 'tenant-a', 'subscription-a', 'hash-a', 'prefix-a', NOW(), NOW());

INSERT INTO "Project" ("id", "organizationId", "clientId", "code", "name", "createdAt", "updatedAt")
VALUES
  ('project-a', 'tenant-a', 'client-a', 'PA', 'Project A', NOW(), NOW()),
  ('project-b', 'tenant-b', 'client-b', 'PB', 'Project B', NOW(), NOW());

INSERT INTO "Invoice" ("id", "organizationId", "projectId", "number", "total", "createdAt")
VALUES
  ('invoice-a', 'tenant-a', 'project-a', 'IA', 10000, NOW()),
  ('invoice-b', 'tenant-b', 'project-b', 'IB', 10000, NOW());

DO $$
BEGIN
  BEGIN
    INSERT INTO "Lead" ("id", "organizationId", "clientId", "title", "contactName", "createdAt", "updatedAt")
    VALUES ('lead-invalid', 'tenant-a', 'client-b', 'Cross tenant lead', 'Test', NOW(), NOW());
    RAISE EXCEPTION 'Tenant isolation failure: Lead accepted a foreign Client';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "Project" ("id", "organizationId", "clientId", "code", "name", "createdAt", "updatedAt")
    VALUES ('project-invalid', 'tenant-a', 'client-b', 'PX', 'Cross tenant project', NOW(), NOW());
    RAISE EXCEPTION 'Tenant isolation failure: Project accepted a foreign Client';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "Quotation" ("id", "organizationId", "clientId", "projectId", "number", "subtotal", "total", "createdAt")
    VALUES ('quotation-invalid', 'tenant-a', 'client-b', NULL, 'QA', 10000, 10000, NOW());
    RAISE EXCEPTION 'Tenant isolation failure: Quotation accepted a foreign Client';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "Quotation" ("id", "organizationId", "clientId", "projectId", "number", "subtotal", "total", "createdAt")
    VALUES ('quotation-invalid-project', 'tenant-a', 'client-a', 'project-b', 'QB', 10000, 10000, NOW());
    RAISE EXCEPTION 'Tenant isolation failure: Quotation accepted a foreign Project';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "Invoice" ("id", "organizationId", "projectId", "number", "total", "createdAt")
    VALUES ('invoice-invalid', 'tenant-a', 'project-b', 'IX', 10000, NOW());
    RAISE EXCEPTION 'Tenant isolation failure: Invoice accepted a foreign Project';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "PaymentTransaction" ("id", "organizationId", "invoiceId", "provider", "amount", "createdAt")
    VALUES ('payment-invalid-invoice', 'tenant-a', 'invoice-b', 'TEST', 10000, NOW());
    RAISE EXCEPTION 'Tenant isolation failure: PaymentTransaction accepted a foreign Invoice';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "PaymentTransaction" ("id", "organizationId", "subscriptionId", "provider", "amount", "createdAt")
    VALUES ('payment-invalid-subscription', 'tenant-a', 'subscription-b', 'TEST', 10000, NOW());
    RAISE EXCEPTION 'Tenant isolation failure: PaymentTransaction accepted a foreign Subscription';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "Expense" ("id", "organizationId", "projectId", "category", "amount", "incurredAt", "createdAt")
    VALUES ('expense-invalid', 'tenant-a', 'project-b', 'TEST', 10000, NOW(), NOW());
    RAISE EXCEPTION 'Tenant isolation failure: Expense accepted a foreign Project';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "License" ("id", "organizationId", "subscriptionId", "keyHash", "keyPrefix", "createdAt", "updatedAt")
    VALUES ('license-invalid', 'tenant-a', 'subscription-b', 'hash-invalid', 'prefix-x', NOW(), NOW());
    RAISE EXCEPTION 'Tenant isolation failure: License accepted a foreign Subscription';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

ROLLBACK;
