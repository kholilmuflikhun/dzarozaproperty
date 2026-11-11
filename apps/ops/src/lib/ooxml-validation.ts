import { inflateRawSync } from "node:zlib";

const MAX_XML_ENTRY_BYTES = 4 * 1024 * 1024;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

type OoxmlKind = "docx" | "xlsx";

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function decodeXml(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function extractRequiredEntries(bytes: Uint8Array, requiredNames: string[]): Map<string, Uint8Array> | null {
  if (bytes.byteLength < 22) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.byteLength - 22 - 0xffff);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      const commentLength = view.getUint16(offset + 20, true);
      if (offset + 22 + commentLength === bytes.byteLength) {
        eocd = offset;
        break;
      }
    }
  }
  if (eocd < 0) return null;

  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const diskEntries = view.getUint16(eocd + 8, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (
    disk !== 0 || centralDisk !== 0 || diskEntries !== totalEntries
    || totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff
    || centralOffset + centralSize > eocd
  ) return null;

  const wanted = new Set(requiredNames);
  const extracted = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > centralOffset + centralSize || view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) return null;
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const expectedCrc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const recordEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (recordEnd > centralOffset + centralSize) return null;

    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    let name: string;
    try { name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes); } catch { return null; }

    if (wanted.has(name)) {
      if (
        extracted.has(name) || (flags & 0x0001) !== 0 || (flags & 0x0040) !== 0
        || ![0, 8].includes(method)
        || compressedSize === 0xffffffff || uncompressedSize > MAX_XML_ENTRY_BYTES
        || localOffset + 30 > centralOffset
        || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE
      ) return null;

      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > centralOffset || localNameLength !== nameLength) return null;
      const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength);
      if (localName.some((byte, i) => byte !== nameBytes[i])) return null;

      const compressed = bytes.subarray(dataStart, dataEnd);
      let expanded: Uint8Array;
      try {
        expanded = method === 0
          ? new Uint8Array(compressed)
          : new Uint8Array(inflateRawSync(compressed, { maxOutputLength: MAX_XML_ENTRY_BYTES }));
      } catch {
        return null;
      }
      if (expanded.byteLength !== uncompressedSize || crc32(expanded) !== expectedCrc) return null;
      extracted.set(name, expanded);
    }
    cursor = recordEnd;
  }
  if (cursor !== centralOffset + centralSize) return null;
  return requiredNames.every((name) => extracted.has(name)) ? extracted : null;
}

/**
 * Validates the minimum OOXML package structure and required XML parts.
 * This is structural validation, not malware scanning or full XML schema validation.
 */
export function hasValidOoxmlPackage(contentType: string, bytes: Uint8Array): boolean {
  const kind: OoxmlKind | null = contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ? "docx"
    : contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ? "xlsx"
      : null;
  if (!kind) return false;

  const mainPart = kind === "docx" ? "word/document.xml" : "xl/workbook.xml";
  const entries = extractRequiredEntries(bytes, ["[Content_Types].xml", mainPart]);
  if (!entries) return false;

  const contentTypes = decodeXml(entries.get("[Content_Types].xml")!);
  const mainXml = decodeXml(entries.get(mainPart)!);
  if (!contentTypes || !mainXml || !/<(?:[A-Za-z_][\w.-]*:)?Types\b/.test(contentTypes)) return false;

  const expectedType = kind === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
  const escapedPart = mainPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const override = new RegExp("<Override\\b(?=[^>]*\\bPartName=[\"']\\/" + escapedPart + "[\"'])(?=[^>]*\\bContentType=[\"']" + expectedType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\"'])[^>]*>", "i");
  if (!override.test(contentTypes)) return false;

  return kind === "docx"
    ? /<(?:[A-Za-z_][\w.-]*:)?document\b/.test(mainXml)
    : /<(?:[A-Za-z_][\w.-]*:)?workbook\b/.test(mainXml);
}
