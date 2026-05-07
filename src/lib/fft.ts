/**
 * Cooley-Tukey radix-2 in-place FFT.
 */
export function fft(real: Float32Array, imag: Float32Array, n: number): void {
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let tmp = real[i];
      real[i] = real[j];
      real[j] = tmp;
      tmp = imag[i];
      imag[i] = imag[j];
      imag[j] = tmp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly passes
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = (-2 * Math.PI) / size;
    const wR = Math.cos(angle);
    const wI = Math.sin(angle);

    for (let i = 0; i < n; i += size) {
      let curR = 1,
        curI = 0;
      for (let k = 0; k < halfSize; k++) {
        const idx1 = i + k;
        const idx2 = i + k + halfSize;
        const tR = curR * real[idx2] - curI * imag[idx2];
        const tI = curR * imag[idx2] + curI * real[idx2];
        real[idx2] = real[idx1] - tR;
        imag[idx2] = imag[idx1] - tI;
        real[idx1] += tR;
        imag[idx1] += tI;
        const newCurR = curR * wR - curI * wI;
        curI = curR * wI + curI * wR;
        curR = newCurR;
      }
    }
  }
}
