import { expect, test, describe } from "vitest";
import { parseWavFormat } from "./wavFormat";

// ---------------------------------------------------------------------------
// Helpers — build minimal WAV ArrayBuffers for testing
// ---------------------------------------------------------------------------

/**
 * Build a standard WAV header (44 bytes, fmt chunk size = 16).
 * Used for PCM (formatTag=1) and IEEE float (formatTag=3).
 */
function makeStandardWav(formatTag: number, bitDepth: number): ArrayBuffer {
  const buf = new ArrayBuffer(44);
  const view = new DataView(buf);

  // RIFF chunk
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, 36, true); // chunk size (file size - 8)
  view.setUint8(8, 0x57);  // W
  view.setUint8(9, 0x41);  // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E

  // fmt chunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // (space)
  view.setUint32(16, 16, true);          // fmt chunk size
  view.setUint16(20, formatTag, true);   // wFormatTag
  view.setUint16(22, 1, true);           // nChannels
  view.setUint32(24, 44100, true);       // nSamplesPerSec
  view.setUint32(28, 44100 * (bitDepth / 8), true); // nAvgBytesPerSec
  view.setUint16(32, bitDepth / 8, true); // nBlockAlign
  view.setUint16(34, bitDepth, true);    // wBitsPerSample

  // data chunk (empty)
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  view.setUint32(40, 0, true); // data chunk size

  return buf;
}

/**
 * Build a WAVE_FORMAT_EXTENSIBLE WAV header (68 bytes, fmt chunk size = 40).
 * Used for multi-channel or >16-bit files from field recorders.
 * subFormatTag: 1 = PCM, 3 = IEEE float
 */
function makeExtensibleWav(bitDepth: number, subFormatTag: number): ArrayBuffer {
  const buf = new ArrayBuffer(68);
  const view = new DataView(buf);

  // RIFF chunk
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, 60, true); // chunk size
  view.setUint8(8, 0x57);  // W
  view.setUint8(9, 0x41);  // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E

  // fmt chunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // (space)
  view.setUint32(16, 40, true);          // fmt chunk size = 40 for extensible
  view.setUint16(20, 0xfffe, true);      // wFormatTag = WAVE_FORMAT_EXTENSIBLE
  view.setUint16(22, 1, true);           // nChannels
  view.setUint32(24, 48000, true);       // nSamplesPerSec
  view.setUint32(28, 48000 * (bitDepth / 8), true); // nAvgBytesPerSec
  view.setUint16(32, bitDepth / 8, true); // nBlockAlign
  view.setUint16(34, bitDepth, true);    // wBitsPerSample
  view.setUint16(36, 22, true);          // cbSize = 22 (size of extension)
  view.setUint16(38, bitDepth, true);    // wValidBitsPerSample
  view.setUint32(40, 0, true);           // dwChannelMask (0 = default)
  // SubFormat GUID (16 bytes starting at offset 44)
  // First 2 bytes are the actual format code
  view.setUint16(44, subFormatTag, true);
  // Remaining 14 bytes are the standard KSDATAFORMAT_SUBTYPE suffix
  // {00000000-0000-0010-8000-00AA00389B71} — standard GUID suffix
  view.setUint8(46, 0x00);
  view.setUint8(47, 0x00);
  view.setUint8(48, 0x00);
  view.setUint8(49, 0x00);
  view.setUint8(50, 0x10);
  view.setUint8(51, 0x00);
  view.setUint8(52, 0x80);
  view.setUint8(53, 0x00);
  view.setUint8(54, 0x00);
  view.setUint8(55, 0xaa);
  view.setUint8(56, 0x00);
  view.setUint8(57, 0x38);
  view.setUint8(58, 0x9b);
  view.setUint8(59, 0x71);

  // data chunk (empty)
  view.setUint8(60, 0x64); // d
  view.setUint8(61, 0x61); // a
  view.setUint8(62, 0x74); // t
  view.setUint8(63, 0x61); // a
  view.setUint32(64, 0, true);

  return buf;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseWavFormat — standard PCM / float", () => {
  test("returns { bitDepth: 16, isFloat: false } for 16-bit PCM WAV", () => {
    const buf = makeStandardWav(1, 16);
    expect(parseWavFormat(buf)).toEqual({ bitDepth: 16, isFloat: false });
  });

  test("returns { bitDepth: 24, isFloat: false } for 24-bit PCM WAV", () => {
    const buf = makeStandardWav(1, 24);
    expect(parseWavFormat(buf)).toEqual({ bitDepth: 24, isFloat: false });
  });

  test("returns { bitDepth: 32, isFloat: false } for 32-bit integer PCM WAV", () => {
    const buf = makeStandardWav(1, 32);
    expect(parseWavFormat(buf)).toEqual({ bitDepth: 32, isFloat: false });
  });

  test("returns { bitDepth: 32, isFloat: true } for 32-bit IEEE float WAV", () => {
    const buf = makeStandardWav(3, 32);
    expect(parseWavFormat(buf)).toEqual({ bitDepth: 32, isFloat: true });
  });
});

describe("parseWavFormat — WAVE_FORMAT_EXTENSIBLE", () => {
  test("returns { bitDepth: 24, isFloat: false } for extensible 24-bit PCM WAV", () => {
    const buf = makeExtensibleWav(24, 1);
    expect(parseWavFormat(buf)).toEqual({ bitDepth: 24, isFloat: false });
  });

  test("returns { bitDepth: 32, isFloat: true } for extensible 32-bit float WAV", () => {
    const buf = makeExtensibleWav(32, 3);
    expect(parseWavFormat(buf)).toEqual({ bitDepth: 32, isFloat: true });
  });

  test("returns { bitDepth: 32, isFloat: false } for extensible 32-bit PCM WAV", () => {
    const buf = makeExtensibleWav(32, 1);
    expect(parseWavFormat(buf)).toEqual({ bitDepth: 32, isFloat: false });
  });
});

describe("parseWavFormat — null / fallback cases", () => {
  test("returns null for a buffer that is too short", () => {
    const buf = new ArrayBuffer(10);
    expect(parseWavFormat(buf)).toBeNull();
  });

  test("returns null when RIFF signature is missing (e.g. MP3 bytes)", () => {
    const buf = new ArrayBuffer(64);
    const view = new DataView(buf);
    // MP3 sync word
    view.setUint8(0, 0xff);
    view.setUint8(1, 0xfb);
    view.setUint8(2, 0x90);
    view.setUint8(3, 0x00);
    expect(parseWavFormat(buf)).toBeNull();
  });

  test("returns null when WAVE signature is missing", () => {
    const buf = makeStandardWav(1, 16);
    const view = new DataView(buf);
    // Overwrite "WAVE" with garbage
    view.setUint8(8, 0x00);
    view.setUint8(9, 0x00);
    view.setUint8(10, 0x00);
    view.setUint8(11, 0x00);
    expect(parseWavFormat(buf)).toBeNull();
  });

  test("returns null for an unknown format tag", () => {
    // formatTag 6 = A-law, not supported
    const buf = makeStandardWav(6, 8);
    expect(parseWavFormat(buf)).toBeNull();
  });

  test("returns null for extensible format with unknown sub-format", () => {
    // subFormatTag 6 = A-law extensible, not supported
    const buf = makeExtensibleWav(8, 6);
    expect(parseWavFormat(buf)).toBeNull();
  });
});
