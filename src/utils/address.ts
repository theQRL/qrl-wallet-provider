import { shake256 } from "@noble/hashes/sha3";

import { assert } from "./assert";
import { bytesToHex } from "./bytes";

export type QrlAddress = `Q${string}`;

const ADDRESS_BYTES = 64;
const ADDRESS_PATTERN = /^q[0-9a-f]{128}$/iu;

function checksumBody(lowercaseBody: string): string {
  const checksum = bytesToHex(
    shake256(lowercaseBody, { dkLen: ADDRESS_BYTES }),
  ).slice(2);
  return Array.from(lowercaseBody, (character, index) =>
    parseInt(checksum[index], 16) >= 8 ? character.toUpperCase() : character,
  ).join("");
}

/** Check a QRL address, accepting uniform case or a valid mixed-case checksum. */
export function isValidQrlAddress(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const address = value.trim();
  if (!ADDRESS_PATTERN.test(address)) {
    return false;
  }

  const body = address.slice(1);
  const lowercase = body.toLowerCase();
  return (
    body === lowercase ||
    body === body.toUpperCase() ||
    body === checksumBody(lowercase)
  );
}

/** Return the canonical SHAKE-256 checksummed QRL address. */
export function getChecksumAddress(address: string): QrlAddress {
  assert(isValidQrlAddress(address), "Invalid QRL address.");
  return `Q${checksumBody(address.trim().slice(1).toLowerCase())}`;
}

/** Check that a QRL address uses the canonical prefix and checksum casing. */
export function isValidChecksumAddress(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const address = value.trim();
  return (
    address.startsWith("Q") &&
    ADDRESS_PATTERN.test(address) &&
    address.slice(1) === checksumBody(address.slice(1).toLowerCase())
  );
}
