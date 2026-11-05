-- Phase 4: tenant-scoped property portfolio and asset registry.
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL','APARTMENT','COMMERCIAL','INDUSTRIAL','MIXED_USE','LAND','OTHER');
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT','ACTIVE','INACTIVE','ARCHIVED');
CREATE TYPE "BuildingStatus" AS ENUM ('ACTIVE','INACTIVE','MAINTENANCE');
CREATE TYPE "PropertyUnitType" AS ENUM ('HOUSE','APARTMENT','SHOP','OFFICE','WAREHOUSE','PARKING','LAND','OTHER');
CREATE TYPE "PropertyUnitStatus" AS ENUM ('AVAILABLE','OCCUPIED','RESERVED','UNDER_MAINTENANCE','INACTIVE');
CREATE TYPE "PropertyAssetStatus" AS ENUM ('ACTIVE','IN_MAINTENANCE','RETIRED');

CREATE TABLE "Property" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "propertyType" "PropertyType" NOT NULL,
  "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "addressLine" TEXT,
  "village" TEXT,
  "district" TEXT,
  "city" TEXT,
  "province" TEXT,
  "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'Indonesia',
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "landArea" DECIMAL(14,2),
  "buildingArea" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Property_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Property_latitude_check" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
  CONSTRAINT "Property_longitude_check" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)),
  CONSTRAINT "Property_landArea_check" CHECK ("landArea" IS NULL OR "landArea" >= 0),
  CONSTRAINT "Property_buildingArea_check" CHECK ("buildingArea" IS NULL OR "buildingArea" >= 0)
);

CREATE TABLE "PropertyBuilding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "BuildingStatus" NOT NULL DEFAULT 'ACTIVE',
  "floors" INTEGER,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyBuilding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyBuilding_floors_check" CHECK ("floors" IS NULL OR "floors" >= 0)
);

CREATE TABLE "PropertyUnit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "buildingId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "unitType" "PropertyUnitType" NOT NULL,
  "status" "PropertyUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
  "floorLabel" TEXT,
  "area" DECIMAL(14,2),
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyUnit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyUnit_area_check" CHECK ("area" IS NULL OR "area" >= 0),
  CONSTRAINT "PropertyUnit_bedrooms_check" CHECK ("bedrooms" IS NULL OR "bedrooms" >= 0),
  CONSTRAINT "PropertyUnit_bathrooms_check" CHECK ("bathrooms" IS NULL OR "bathrooms" >= 0)
);

CREATE TABLE "PropertyAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "buildingId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" "PropertyAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "serialNumber" TEXT,
  "locationLabel" TEXT,
  "description" TEXT,
  "acquiredAt" TIMESTAMP(3),
  "purchaseCost" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyAsset_purchaseCost_check" CHECK ("purchaseCost" IS NULL OR "purchaseCost" >= 0)
);

CREATE UNIQUE INDEX "Property_organizationId_id_key" ON "Property"("organizationId","id");
CREATE UNIQUE INDEX "Property_organizationId_code_key" ON "Property"("organizationId","code");
CREATE INDEX "Property_organizationId_status_propertyType_idx" ON "Property"("organizationId","status","propertyType");
CREATE INDEX "Property_organizationId_city_idx" ON "Property"("organizationId","city");

CREATE UNIQUE INDEX "PropertyBuilding_organizationId_id_key" ON "PropertyBuilding"("organizationId","id");
CREATE UNIQUE INDEX "PropertyBuilding_organizationId_propertyId_id_key" ON "PropertyBuilding"("organizationId","propertyId","id");
CREATE UNIQUE INDEX "PropertyBuilding_organizationId_propertyId_code_key" ON "PropertyBuilding"("organizationId","propertyId","code");
CREATE INDEX "PropertyBuilding_organizationId_propertyId_status_idx" ON "PropertyBuilding"("organizationId","propertyId","status");

CREATE UNIQUE INDEX "PropertyUnit_organizationId_id_key" ON "PropertyUnit"("organizationId","id");
CREATE UNIQUE INDEX "PropertyUnit_organizationId_propertyId_code_key" ON "PropertyUnit"("organizationId","propertyId","code");
CREATE INDEX "PropertyUnit_organizationId_propertyId_status_idx" ON "PropertyUnit"("organizationId","propertyId","status");
CREATE INDEX "PropertyUnit_organizationId_buildingId_idx" ON "PropertyUnit"("organizationId","buildingId");

CREATE UNIQUE INDEX "PropertyAsset_organizationId_id_key" ON "PropertyAsset"("organizationId","id");
CREATE UNIQUE INDEX "PropertyAsset_organizationId_propertyId_code_key" ON "PropertyAsset"("organizationId","propertyId","code");
CREATE INDEX "PropertyAsset_organizationId_propertyId_status_idx" ON "PropertyAsset"("organizationId","propertyId","status");
CREATE INDEX "PropertyAsset_organizationId_buildingId_idx" ON "PropertyAsset"("organizationId","buildingId");

ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyBuilding" ADD CONSTRAINT "PropertyBuilding_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyBuilding" ADD CONSTRAINT "PropertyBuilding_organizationId_propertyId_fkey"
  FOREIGN KEY ("organizationId","propertyId") REFERENCES "Property"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_organizationId_propertyId_fkey"
  FOREIGN KEY ("organizationId","propertyId") REFERENCES "Property"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_organizationId_propertyId_buildingId_fkey"
  FOREIGN KEY ("organizationId","propertyId","buildingId") REFERENCES "PropertyBuilding"("organizationId","propertyId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PropertyAsset" ADD CONSTRAINT "PropertyAsset_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAsset" ADD CONSTRAINT "PropertyAsset_organizationId_propertyId_fkey"
  FOREIGN KEY ("organizationId","propertyId") REFERENCES "Property"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAsset" ADD CONSTRAINT "PropertyAsset_organizationId_propertyId_buildingId_fkey"
  FOREIGN KEY ("organizationId","propertyId","buildingId") REFERENCES "PropertyBuilding"("organizationId","propertyId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
