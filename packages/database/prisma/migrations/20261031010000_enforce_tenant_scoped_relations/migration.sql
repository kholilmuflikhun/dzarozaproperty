-- Enforce same-tenant references at the database layer.
-- A tenant-owned record can no longer point to a parent record from another organization.

CREATE UNIQUE INDEX "Subscription_organizationId_id_key" ON "Subscription"("organizationId", "id");
CREATE UNIQUE INDEX "Client_organizationId_id_key" ON "Client"("organizationId", "id");
CREATE UNIQUE INDEX "Project_organizationId_id_key" ON "Project"("organizationId", "id");
CREATE UNIQUE INDEX "Invoice_organizationId_id_key" ON "Invoice"("organizationId", "id");

ALTER TABLE "License" DROP CONSTRAINT "License_subscriptionId_fkey";
ALTER TABLE "License" ADD CONSTRAINT "License_organizationId_subscriptionId_fkey" FOREIGN KEY ("organizationId", "subscriptionId") REFERENCES "Subscription"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Lead" DROP CONSTRAINT "Lead_clientId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_clientId_fkey" FOREIGN KEY ("organizationId", "clientId") REFERENCES "Client"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Project" DROP CONSTRAINT "Project_clientId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_clientId_fkey" FOREIGN KEY ("organizationId", "clientId") REFERENCES "Client"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Quotation" DROP CONSTRAINT "Quotation_clientId_fkey";
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_organizationId_clientId_fkey" FOREIGN KEY ("organizationId", "clientId") REFERENCES "Client"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Quotation" DROP CONSTRAINT "Quotation_projectId_fkey";
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_organizationId_projectId_fkey" FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_projectId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_projectId_fkey" FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_invoiceId_fkey";
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_organizationId_invoiceId_fkey" FOREIGN KEY ("organizationId", "invoiceId") REFERENCES "Invoice"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_subscriptionId_fkey";
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_organizationId_subscriptionId_fkey" FOREIGN KEY ("organizationId", "subscriptionId") REFERENCES "Subscription"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT "Expense_projectId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_projectId_fkey" FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
