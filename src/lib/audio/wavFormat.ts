/**
 * WAV fmt chunk parser.
 *
 * Reads the raw ArrayBuffer of an uploaded file and extracts the original
 * bit depth and sample format so the encoder can match it on export.
 *
 * Returns null for non-WAV files (MP3, M4A, etc.) or unrecognised formats —
 * callers should fall back to 16-bit PCM in that case.
 */

export type WavFormat = {
  bitDepth: number;
  isFloat: boolean;
  sampleRate: number;
};

const WAVE_FORMAT_PCM = 0x0001;
const WAVE_FORMAT_IEEE_FLOAT = 0x0003;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

function readFourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/**
 * Parse the WAV fmt chunk from a raw ArrayBuffer.
 *
 * Handles:
 *  - Standard PCM  (wFormatTag = 0x0001)
 *  - IEEE float    (wFormatTag = 0x0003)
 *  - Extensible    (wFormatTag = 0xFFFE) — common for 24-bit and 32-bit float
 *    WAV files produced by field recorders (Zoom, Tascam, Sony, etc.)
 *
 * Returns null if the buffer is not a valid RIFF/WAVE file, the fmt chunk
 * cannot be found, or the format tag is not one of the above.
 */
export function parseWavFormat(buf: ArrayBuffer): WavFormat | null {
  if (buf.byteLength < 44) return null;

  const view = new DataView(buf);

  // Must start with "RIFF" and have "WAVE" at offset 8
  if (readFourCC(view, 0) !== "RIFF") return null;
  if (readFourCC(view, 8) !== "WAVE") return null;

  // Scan for the "fmt " chunk starting after the RIFF/WAVE header (offset 12).
  // In practice "fmt " is always the first chunk, but we scan to be robust.
  let offset = 12;
  while (offset + 8 <= buf.byteLength) {
    const chunkId = readFourCC(view, offset);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      if (chunkSize < 16) return null; // malformed fmt chunk

      const formatTag = view.getUint16(offset + 8, true);
      const bitDepth = view.getUint16(offset + 22, true);
      const sampleRate = view.getUint32(offset + 12, true);

      if (formatTag === WAVE_FORMAT_PCM) {
        return { bitDepth, isFloat: false, sampleRate };
      }

      if (formatTag === WAVE_FORMAT_IEEE_FLOAT) {
        return { bitDepth, isFloat: true, sampleRate };
      }

      if (formatTag === WAVE_FORMAT_EXTENSIBLE) {
        // Extensible needs at least 40-byte fmt body to hold the SubFormat GUID
        if (chunkSize < 40) return null;

        // SubFormat GUID starts at offset + 32 (relative to chunk start).
        // Offsets within the fmt chunk body (chunk body starts at offset + 8):
        //   +0  formatTag        (2)
        //   +2  nChannels        (2)
        //   +4  nSamplesPerSec   (4)
        //   +8  nAvgBytesPerSec  (4)
        //   +12 nBlockAlign      (2)
        //   +14 wBitsPerSample   (2)
        //   +16 cbSize           (2)
        //   +18 wValidBitsPerSample (2)
        //   +20 dwChannelMask    (4)
        //   +24 SubFormat GUID   (16)  ← first 2 bytes = actual format code
        const subFormatTag = view.getUint16(offset + 8 + 24, true);

        if (subFormatTag === WAVE_FORMAT_PCM) {
          return { bitDepth, isFloat: false, sampleRate };
        }
        if (subFormatTag === WAVE_FORMAT_IEEE_FLOAT) {
          return { bitDepth, isFloat: true, sampleRate };
        }

        return null; // unknown extensible sub-format
      }

      return null; // unknown top-level format tag
    }

    // Advance past this chunk (chunks are padded to even byte boundaries)
    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  return null; // "fmt " chunk not found
}
