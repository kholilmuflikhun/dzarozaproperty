import { describe, expect, it } from "vitest";
import { hasValidOoxmlPackage } from "./ooxml-validation";

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): number[] { return [value & 0xff, (value >>> 8) & 0xff]; }
function u32(value: number): number[] { return [...u16(value & 0xffff), ...u16(value >>> 16)]; }
function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function makeStoredZip(entries: Array<[string, string]>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const [name, value] of entries) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(value);
    const crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0),
      ...nameBytes, ...data,
    ]);
    localParts.push(local);
    centralParts.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0),
      ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(localOffset), ...nameBytes,
    ]));
    localOffset += local.length;
  }
  const central = concat(centralParts);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(central.length), ...u32(localOffset), ...u16(0),
  ]);
  return concat([...localParts, central, end]);
}

const docxEntries: Array<[string, string]> = [
  ["[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
  ["word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'],
];
const xlsxEntries: Array<[string, string]> = [
  ["[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'],
  ["xl/workbook.xml", '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>'],
];

describe("OOXML package validation", () => {
  it("accepts a structurally valid DOCX package", () => {
    expect(hasValidOoxmlPackage(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      makeStoredZip(docxEntries),
    )).toBe(true);
  });

  it("accepts a structurally valid XLSX package", () => {
    expect(hasValidOoxmlPackage(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      makeStoredZip(xlsxEntries),
    )).toBe(true);
  });

  it("rejects a ZIP container missing the required OOXML document part", () => {
    expect(hasValidOoxmlPackage(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      makeStoredZip([docxEntries[0]]),
    )).toBe(false);
  });

  it("rejects a mismatched package content type and a non-ZIP payload", () => {
    expect(hasValidOoxmlPackage(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      makeStoredZip(xlsxEntries),
    )).toBe(false);
    expect(hasValidOoxmlPackage(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      encoder.encode("PK fake archive"),
    )).toBe(false);
  });

  it("rejects a corrupted required entry checksum", () => {
    const archive = makeStoredZip(docxEntries);
    archive[40] ^= 0xff;
    expect(hasValidOoxmlPackage(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      archive,
    )).toBe(false);
  });
});
