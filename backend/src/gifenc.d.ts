declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, options?: Record<string, unknown>): void
    finish(): void
    bytes(): Uint8Array
  }
  export function GIFEncoder(options?: Record<string, unknown>): GIFEncoderInstance
  export function quantize(rgba: ArrayLike<number>, maxColors: number, options?: Record<string, unknown>): number[][]
  export function applyPalette(rgba: ArrayLike<number>, palette: number[][], format?: string): Uint8Array
}
