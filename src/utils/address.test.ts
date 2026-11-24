import { getChecksumAddress, isValidChecksumAddress, isValidQrlAddress } from "./address";

// The first cross-implementation checksum vector in go-qrllib.
const checksummed = "Qd5812F6Cf4a0f645aa620cd57319a0Ed649dd8f5519A9dde7770ae5b0E49e547985f35eB972A2a07041561aa39c65A3991478f9B1e6749e05277dcf58A9A8B72";

describe("QRL addresses", () => {
  it.each([checksummed, checksummed.toLowerCase(), checksummed.toUpperCase()])(
    "normalizes a valid address to the upstream checksum",
    (address) => {
      expect(isValidQrlAddress(address)).toBe(true);
      expect(getChecksumAddress(address)).toBe(checksummed);
    },
  );

  it("checks the canonical prefix and casing", () => {
    expect(isValidChecksumAddress(checksummed)).toBe(true);
    expect(isValidChecksumAddress(`q${checksummed.slice(1)}`)).toBe(false);
    expect(isValidChecksumAddress(`Q${checksummed.slice(1).toLowerCase()}`)).toBe(false);
  });

  it.each([
    checksummed.replace("2F6", "2f6"),
    checksummed.slice(0, -1),
    `${checksummed}0`,
    `Q${"a".repeat(40)}`,
    `0x${"a".repeat(40)}`,
    `Q${"z".repeat(128)}`,
  ])("rejects an invalid address", (address) => {
    expect(isValidQrlAddress(address)).toBe(false);
    expect(isValidChecksumAddress(address)).toBe(false);
    expect(() => getChecksumAddress(address)).toThrow("Invalid QRL address.");
  });
});
