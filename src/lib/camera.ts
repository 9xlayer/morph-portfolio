export type CameraParams = {
  camX: number
  camY: number
  dolly: number
  fov: number
  yaw: number
  roll: number
  size: number
  stepX: number
  stepY: number
  stepZ: number
  pushX: number
  pushY: number
  pushZ: number
}

export const CAMERA_DEFAULTS: CameraParams = {
  camX: 0.74,
  camY: 0.243,
  dolly: 0,
  fov: 87,
  yaw: -24,
  roll: 3,
  size: 0.51,
  stepX: 0.14,
  stepY: -0.138,
  stepZ: 15,
  pushX: 0.5,
  pushY: 0.4,
  pushZ: 0.3,
}

export const formatCameraReadout = (p: CameraParams) =>
  [
    `camera.position.set(${p.camX.toFixed(2)}, ${p.camY.toFixed(2)}, ${p.dolly});`,
    `camera.fov = ${Math.round(p.fov)};`,
    `canvas.rotation.set(0, ${p.yaw}deg, ${p.roll.toFixed(1)}deg);  size = ${p.size.toFixed(2)}vw`,
    `cascade.step = (${p.stepX.toFixed(3)}, ${p.stepY.toFixed(3)}, ${p.stepZ});`,
    `parallax = (${p.pushX.toFixed(2)}, ${p.pushY.toFixed(2)}, ${p.pushZ.toFixed(2)});`,
  ].join("\n")
