export const clamp = (v: number, min = 0, max = 1) =>
  v < min ? min : v > max ? max : v

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const sstep = (t: number) => t * t * (3 - 2 * t)

export const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a))

export const outQuint = (t: number) => 1 - Math.pow(1 - t, 5)

export const inOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const wrap = (v: number, n: number) => ((v % n) + n) % n

/** Point-in-convex-quad test for projected card corners (8 numbers: x0,y0,...,x3,y3). */
export const pointInQuad = (quad: number[], x: number, y: number) => {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const ax = quad[i * 2]
    const ay = quad[i * 2 + 1]
    const bx = quad[((i + 1) % 4) * 2]
    const by = quad[((i + 1) % 4) * 2 + 1]
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
    if (cross === 0) continue
    const s = cross > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}
