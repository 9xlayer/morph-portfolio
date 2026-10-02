import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import type { Frame } from "../lib/frames"
import { CAMERA_DEFAULTS, type CameraParams } from "../lib/camera"
import {
  clamp,
  inOutCubic,
  lerp,
  outQuint,
  pointInQuad,
  seg,
  sstep,
  wrap,
} from "../lib/math"
import { SettingsPanel } from "./SettingsPanel"

const DEG = Math.PI / 180

type LabelMode = { mode: "idle" | "hover" | "open"; index: number }

type Engine = {
  posCur: number
  posTarget: number
  tiltX: number
  tiltY: number
  tiltTX: number
  tiltTY: number
  hover: number[]
  hoverTarget: number
  open: number[]
  opening: number
  clock: number
  introT: number
  last: number
  quads: number[][]
  onStage: boolean[]
  depth: number[]
  lift: number[]
  vis: number[]
  op: number[]
  boxW: number
  px: number
  py: number
  inside: boolean
  dragging: boolean
  dragY: number
  dragMoved: number
  locked: boolean
  prevOverflow: string
  prevPad: string
  stack: boolean
}

type Props = {
  frames: Frame[]
  caption: string
}

export function MorphGallery({ frames, caption }: Props) {
  const count = frames.length
  const sectionRef = useRef<HTMLElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const paramsRef = useRef<CameraParams>({ ...CAMERA_DEFAULTS })
  const labelRef = useRef<LabelMode>({ mode: "idle", index: -1 })
  const swapTimer = useRef<number | null>(null)

  const engineRef = useRef<Engine | null>(null)
  if (!engineRef.current) {
    engineRef.current = {
      posCur: 0,
      posTarget: 0,
      tiltX: 0,
      tiltY: 0,
      tiltTX: 0,
      tiltTY: 0,
      hover: Array(count).fill(0),
      hoverTarget: -1,
      open: Array(count).fill(0),
      opening: -1,
      clock: 0,
      introT: 0,
      last: 0,
      quads: Array.from({ length: count }, () => Array(8).fill(0)),
      onStage: Array(count).fill(false),
      depth: Array(count).fill(0),
      lift: Array(count).fill(-1),
      vis: Array(count).fill(-1),
      op: Array(count).fill(-1),
      boxW: 0,
      px: 0,
      py: 0,
      inside: false,
      dragging: false,
      dragY: 0,
      dragMoved: 0,
      locked: false,
      prevOverflow: "",
      prevPad: "",
      stack: false,
    }
  }

  const [label, setLabel] = useState<LabelMode>({ mode: "idle", index: -1 })
  const [swapping, setSwapping] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const setLabelMode = useCallback((mode: LabelMode["mode"], index: number) => {
    const cur = labelRef.current
    if (cur.mode === mode && cur.index === index) return
    labelRef.current = { mode, index }
    if (swapTimer.current) clearTimeout(swapTimer.current)
    setSwapping(true)
    swapTimer.current = window.setTimeout(
      () => {
        setLabel(labelRef.current)
        setSwapping(false)
      },
      mode === "open" ? 760 : 130,
    )
  }, [])

  const openFrame = useCallback((index: number) => {
    const eng = engineRef.current
    const el = sectionRef.current
    if (!eng || !el || eng.opening === index) return
    eng.opening = index
    el.dataset.open = "true"
  }, [])

  const closeFrame = useCallback(() => {
    const eng = engineRef.current
    const el = sectionRef.current
    if (!eng || !el || eng.opening < 0) return
    eng.opening = -1
    el.dataset.open = "false"
  }, [])

  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current)
    },
    [],
  )

  useEffect(() => {
    const section = sectionRef.current
    const scene = sceneRef.current
    const eng = engineRef.current
    if (!section || !scene || !eng) return

    const introDur = 0.62 + 0.095 * (count - 1) + 0.3
    let raf = 0
    let visible = true
    let w = section.clientWidth || window.innerWidth
    let h = section.clientHeight || window.innerHeight
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    let reduced = mq.matches

    const updateLayoutVars = () => {
      const tall = clamp((1.5 - w / h) / 1) > 0.5
      const card = w * (tall ? 0.88 : 0.54)
      const cx = w * (tall ? 0.5 : 0.665)
      const cy = h * (tall ? 0.33 : 0.5)
      const pad = Math.min(78, Math.max(20, 0.042 * w))
      section.style.setProperty(
        "--stackTop",
        `${(cy + card / 1.3 / 2 + 26).toFixed(1)}px`,
      )
      section.style.setProperty(
        "--labelMax",
        `${Math.max(190, cx - card / 2 - pad - 30).toFixed(1)}px`,
      )
    }
    updateLayoutVars()

    const insideBounds = (x: number, y: number) => {
      const r = section.getBoundingClientRect()
      return !(r.top > 2) && !(r.bottom < window.innerHeight - 2) && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    }

    const lockScroll = (on: boolean) => {
      if (on === eng.locked) return
      eng.locked = on
      const html = document.documentElement
      if (on) {
        eng.prevOverflow = html.style.overflow
        eng.prevPad = html.style.paddingRight
        const gap = window.innerWidth - html.clientWidth
        html.style.overflow = "hidden"
        if (gap > 0) html.style.paddingRight = `${gap}px`
      } else {
        html.style.overflow = eng.prevOverflow
        html.style.paddingRight = eng.prevPad
      }
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const cam = paramsRef.current
      const dt = eng.last ? Math.min(0.05, (now - eng.last) / 1000) : 0
      eng.last = now
      if (!visible || document.hidden) return

      if (!reduced) eng.clock += 0.006
      if (reduced) eng.introT = introDur + 1
      else eng.introT += dt

      const intro = reduced ? 1 : sstep(clamp(eng.introT / introDur))
      const introing = !reduced && eng.introT < introDur

      if (reduced) eng.posCur = eng.posTarget
      else {
        eng.posCur += (eng.posTarget - eng.posCur) * 0.1
        if (Math.abs(eng.posTarget - eng.posCur) < 1e-4) eng.posCur = eng.posTarget
      }

      if (Math.abs(eng.posTarget) > 6 * count) {
        const shift = Math.round(eng.posTarget / count) * count
        eng.posTarget -= shift
        eng.posCur -= shift
      }

      if (reduced) {
        eng.tiltX = 0
        eng.tiltY = 0
      } else {
        eng.tiltX += (eng.tiltTX - eng.tiltX) * 0.06
        eng.tiltY += (eng.tiltTY - eng.tiltY) * 0.06
      }

      const aspectBias = clamp((1.5 - w / h) / 1)
      const scaleX = 1 + 1.3 * aspectBias
      const stack = aspectBias > 0.5
      const size = cam.size * scaleX
      const stepX = cam.stepX * scaleX * (1 - 0.45 * aspectBias)
      const stepY = cam.stepY * (1 + 0.1 * aspectBias)
      if (stack !== eng.stack) {
        eng.stack = stack
        section.dataset.stack = String(stack)
      }

      let openAmt = 0
      let openIdx = -1
      for (let i = 0; i < count; i++) {
        const want = +(eng.opening === i)
        if (reduced) eng.open[i] = want
        else if (eng.open[i] !== want) {
          const speed = dt / (want === 1 ? 1.2 : 0.82)
          eng.open[i] =
            want === 1
              ? Math.min(1, eng.open[i] + speed)
              : Math.max(0, eng.open[i] - speed)
        }
        if (eng.open[i] > openAmt) {
          openAmt = eng.open[i]
          openIdx = i
        }
        const hoverWant = +(eng.hoverTarget === i)
        if (reduced) eng.hover[i] = hoverWant
        else eng.hover[i] += (hoverWant - eng.hover[i]) * 0.14
      }

      const openAlong =
        openIdx >= 0 ? wrap(openIdx - eng.posCur + 2.6, count) - 2.6 : 0
      const openEase = openAmt > 0 ? sstep(seg(openAmt, 0.05, 0.9)) : 0
      const fov = cam.fov + 5 * openEase + (1 - intro) * 7
      const persp = ((w / 2) / Math.tan((fov * DEG) / 2)) * scaleX
      const bobX = reduced ? 0 : Math.sin(eng.clock) * cam.pushZ * 0.012
      const bobY = reduced ? 0 : Math.cos(0.9 * eng.clock) * cam.pushZ * 0.009
      const originX =
        cam.camX +
        -0.07 * openEase +
        eng.tiltX * cam.pushX * 0.045 * (1 - openEase) +
        bobX +
        (1 - intro) * 0.055
      const originY =
        cam.camY +
        0.06 * openEase +
        eng.tiltY * cam.pushY * 0.035 * (1 - openEase) +
        bobY -
        (1 - intro) * 0.045

      scene.style.perspective = `${persp.toFixed(2)}px`
      scene.style.perspectiveOrigin = `${(100 * originX).toFixed(3)}% ${(100 * originY).toFixed(3)}%`

      const openZ = 0.34 * persp
      const proj = persp / (persp - openZ)
      const openScale = (stack ? 0.88 : 0.54) / proj
      const openCX =
        originX * w + (w * (stack ? 0.5 : 0.665) - originX * w) / proj
      const openCY =
        originY * h + (h * (stack ? 0.33 : 0.5) - originY * h) / proj
      const boxW = w * Math.max(size, openScale) * 1.02

      if (Math.abs(boxW - eng.boxW) >= 1) {
        eng.boxW = boxW
        const boxH = boxW / 1.3
        for (let i = 0; i < count; i++) {
          const card = cardsRef.current[i]
          if (!card) continue
          card.style.width = `${boxW.toFixed(2)}px`
          card.style.height = `${boxH.toFixed(2)}px`
          card.style.setProperty("--edgeT", `${(0.0075 * boxW).toFixed(2)}px`)
          card.style.setProperty("--edgeS", `${(0.014 * boxW).toFixed(2)}px`)
        }
      }

      const bw = eng.boxW
      const bh = bw / 1.3
      const yawDenom = Math.max(0.06, Math.abs(Math.sin(cam.yaw * DEG)))

      for (let i = 0; i < count; i++) {
        const card = cardsRef.current[i]
        if (!card) continue

        let along = wrap(i - eng.posCur + 2.6, count) - 2.6
        const o = eng.open[i]
        const isOpen = i === openIdx
        let push = 0
        if (openAmt > 0 && !isOpen) {
          const soft = 0.02 + 0.04 * Math.min(Math.abs(along - openAlong), 4)
          push = Math.pow(seg(openAmt, soft, Math.min(0.99, soft + 0.56)), 1.7)
          along += (along - openAlong >= 0 ? 1 : -1) * push * 6.4
        }

        const hover = eng.hover[i]
        let x = (0.208 + stepX * along) * w
        let y = (1.206 + stepY * along) * h
        let z = (-15 - cam.stepZ * along + 26 * hover) * scaleX + cam.dolly
        let yaw = cam.yaw
        let roll = cam.roll
        let cardSize = size
        let opacity = 1
        let reveal = 1

        if (introing) {
          const t = outQuint(
            clamp((eng.introT - 0.095 * clamp(along + 1.2, 0, count)) / 0.62),
          )
          y += (1 - t) * 96 * scaleX
          yaw -= (1 - t) * 26
          opacity = sstep(clamp(t / 0.3))
          reveal = clamp((t - 0.25) / 0.75)
        }

        let liftEase = 0
        if (isOpen && o > 0) {
          const e = sstep(seg(o, 0.1, 0.94))
          const rot = inOutCubic(seg(o, 0.22, 0.99))
          const bounce = Math.sin(seg(o, 0.66, 1) * Math.PI)
          liftEase = outQuint(seg(o, 0, 0.4))
          yaw = lerp(yaw, 0, rot)
          roll = lerp(roll, 0, rot)
          cardSize = lerp(size, openScale, e)
          x = lerp(x, openCX, e)
          y = lerp(y, openCY, e) - 0.05 * h * Math.sin(e * Math.PI)
          z = lerp(z, openZ, e) + 38 * bounce * scaleX
        }

        const yawR = yaw * DEG
        const rollR = roll * DEG
        const cosR = Math.cos(rollR)
        const sinR = Math.sin(rollR)
        const cosY = Math.cos(yawR)
        const sinY = Math.sin(yawR)
        const screenW = w * cardSize
        const screenH = screenW / 1.3
        const hx = screenW / 2
        const hy = screenH / 2
        const quad = eng.quads[i]
        let ok = true
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity

        for (let c = 0; c < 4; c++) {
          const lx = c === 0 || c === 3 ? -hx : hx
          const ly = c === 0 || c === 1 ? -hy : hy
          const rx = lx * cosR - ly * sinR
          const ry = lx * sinR + ly * cosR
          const depth = z - rx * sinY
          if (depth > persp - 24) {
            ok = false
            break
          }
          const a = persp / (persp - depth)
          const sx = originX * w + (x + rx * cosY - originX * w) * a
          const sy = originY * h + (y + ry - originY * h) * a
          quad[c * 2] = sx
          quad[c * 2 + 1] = sy
          if (sx < minX) minX = sx
          if (sx > maxX) maxX = sx
          if (sy < minY) minY = sy
          if (sy > maxY) maxY = sy
        }

        const onStage =
          ok && maxX > -12 && minX < w + 12 && maxY > -12 && minY < h + 12
        eng.onStage[i] = onStage
        eng.depth[i] = z
        const vis = onStage ? 1 : 0
        if (eng.vis[i] !== vis) {
          eng.vis[i] = vis
          card.style.visibility = onStage ? "visible" : "hidden"
        }
        if (!onStage) {
          if (eng.op[i] !== 0) {
            eng.op[i] = 0
            card.style.opacity = "0"
          }
          continue
        }

        card.style.transform = `translate3d(${(x - bw / 2).toFixed(2)}px, ${(y - bh / 2).toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${yaw.toFixed(3)}deg) rotateZ(${roll.toFixed(3)}deg) scale(${(screenW / bw).toFixed(5)})`

        const op = Math.round(opacity * 1000) / 1000
        if (eng.op[i] !== op) {
          eng.op[i] = op
          card.style.opacity = `${op}`
        }

        const shade =
          0.18 * clamp(along / 9) - 0.14 * hover + 0.62 * push
        const dark = clamp((shade + (1 - reveal) * 0.9) * (1 - liftEase), 0, 1)
        const edgeA = clamp(
          (Math.abs(sinY) / yawDenom) * (1 - 0.75 * clamp(shade, 0, 1)),
          0,
          1,
        )
        card.style.setProperty("--dark", dark.toFixed(3))
        card.style.setProperty("--edgeA", edgeA.toFixed(3))
        const lift = Math.round(100 * (o > 0 ? seg(o, 0.1, 0.6) : 0)) / 100
        if (eng.lift[i] !== lift) {
          eng.lift[i] = lift
          card.style.setProperty("--lift", `${lift}`)
        }
      }

      if (openAmt < 0.02 && eng.inside && !eng.dragging) {
        let hit = -1
        let best = -Infinity
        for (let i = 0; i < count; i++) {
          if (
            eng.onStage[i] &&
            pointInQuad(eng.quads[i], eng.px, eng.py) &&
            eng.depth[i] > best
          ) {
            best = eng.depth[i]
            hit = i
          }
        }
        if (hit !== eng.hoverTarget) {
          eng.hoverTarget = hit
          section.style.cursor = hit >= 0 ? "pointer" : ""
        }
      }

      if (eng.opening >= 0) setLabelMode("open", eng.opening)
      else if (openAmt > 0.02 && openIdx >= 0) setLabelMode("hover", openIdx)
      else if (eng.hoverTarget >= 0) setLabelMode("hover", eng.hoverTarget)
      else setLabelMode("idle", -1)
    }

    const onWheel = (e: WheelEvent) => {
      if (!insideBounds(e.clientX, e.clientY)) return
      e.preventDefault()
      if (eng.opening >= 0) {
        closeFrame()
        return
      }
      eng.posTarget += 0.0032 * e.deltaY
    }

    const onPointerMoveLock = (e: PointerEvent) => {
      if (e.pointerType === "mouse") lockScroll(insideBounds(e.clientX, e.clientY))
    }

    const onReduced = () => {
      reduced = mq.matches
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
      },
      { threshold: 0 },
    )
    const ro = new ResizeObserver(() => {
      w = section.clientWidth || window.innerWidth
      h = section.clientHeight || window.innerHeight
      eng.boxW = 0
      updateLayoutVars()
    })

    io.observe(section)
    ro.observe(section)
    mq.addEventListener("change", onReduced)
    window.addEventListener("wheel", onWheel, { passive: false, capture: true })
    window.addEventListener("pointermove", onPointerMoveLock, { passive: true })
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      mq.removeEventListener("change", onReduced)
      window.removeEventListener("wheel", onWheel, { capture: true })
      window.removeEventListener("pointermove", onPointerMoveLock)
      lockScroll(false)
    }
  }, [closeFrame, count, setLabelMode])

  const trackPointer = (e: ReactPointerEvent) => {
    const eng = engineRef.current
    const section = sectionRef.current
    if (!eng || !section) return
    const r = section.getBoundingClientRect()
    eng.px = e.clientX - r.left
    eng.py = e.clientY - r.top
    eng.inside = true
    eng.tiltTX = clamp((eng.px / Math.max(1, r.width)) * 2 - 1, -1, 1)
    eng.tiltTY = clamp((eng.py / Math.max(1, r.height)) * 2 - 1, -1, 1)
  }

  const clearPointer = () => {
    const eng = engineRef.current
    if (!eng) return
    eng.inside = false
    eng.dragging = false
    eng.hoverTarget = -1
    eng.tiltTX = 0
    eng.tiltTY = 0
    if (sectionRef.current) sectionRef.current.style.cursor = ""
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const eng = engineRef.current
    if (!eng) return
    trackPointer(e)
    eng.dragging = true
    eng.dragY = e.clientY
    eng.dragMoved = 0
    sectionRef.current?.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const eng = engineRef.current
    if (!eng) return
    trackPointer(e)
    if (!eng.dragging) return
    const dy = e.clientY - eng.dragY
    eng.dragY = e.clientY
    eng.dragMoved += Math.abs(dy)
    if (eng.opening < 0) eng.posTarget -= 0.011 * dy
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const eng = engineRef.current
    const section = sectionRef.current
    if (!eng || !section) return
    const wasDrag = eng.dragging
    const moved = eng.dragMoved
    eng.dragging = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (!wasDrag || moved > 6) return
    if (eng.opening >= 0) {
      closeFrame()
      return
    }
    const r = section.getBoundingClientRect()
    const lx = e.clientX - r.left
    const ly = e.clientY - r.top
    let hit = -1
    let best = -Infinity
    for (let i = 0; i < frames.length; i++) {
      if (
        eng.onStage[i] &&
        pointInQuad(eng.quads[i], lx, ly) &&
        eng.depth[i] > best
      ) {
        best = eng.depth[i]
        hit = i
      }
    }
    if (hit >= 0) openFrame(hit)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const eng = engineRef.current
    if (!eng) return
    if (e.key === "Escape") {
      if (eng.opening >= 0) {
        e.preventDefault()
        closeFrame()
      }
      return
    }
    const forward =
      e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown"
    const back =
      e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp"
    if (!forward && !back) return
    e.preventDefault()
    const dir = forward ? 1 : -1
    if (eng.opening >= 0) {
      eng.posTarget = Math.round(eng.posTarget) + dir
      openFrame(wrap(eng.opening + dir, frames.length))
      return
    }
    eng.posTarget = Math.round(eng.posTarget) + dir
  }

  const active = label.index >= 0 ? frames[label.index] : null
  const showWork = !!active && label.mode !== "idle"

  return (
    <section
      ref={sectionRef}
      className="mo"
      tabIndex={0}
      role="region"
      aria-label="Morph, a hang of photographic prints. Use the arrow keys to move along the line."
      data-open="false"
      data-stack="false"
      data-intro="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={clearPointer}
      onPointerLeave={clearPointer}
      onKeyDown={onKeyDown}
    >
      <div className="mo-grain" aria-hidden />
      <div className="mo-vignette" aria-hidden />
      <div className="mo-frame" aria-hidden />
      <div className="mo-scene" ref={sceneRef} aria-hidden>
        {frames.map((frame, i) => (
          <div
            className="mo-card"
            key={frame.id}
            ref={(el) => {
              cardsRef.current[i] = el
            }}
          >
            <img
              className="mo-img"
              src={frame.image}
              alt=""
              draggable={false}
              decoding="async"
              style={{ objectPosition: frame.focus }}
            />
            <div className="mo-veil" />
            <span className="mo-edge mo-edge-t" />
            <span className="mo-edge mo-edge-r" />
          </div>
        ))}
      </div>

      <div className="mo-titleblock">
        <h1 className="mo-title">MORPH</h1>
        <div className="mo-titlemeta">
          <span className="mo-rule" />
          <div className="mo-swap" data-out={swapping}>
            {showWork && active ? (
              <>
                <h2 className="mo-workname">{active.title}</h2>
                <div className="mo-workline">
                  {active.location} · {active.year}
                </div>
                {label.mode === "open" && (
                  <div className="mo-workline mo-workline-sub">
                    {active.camera} · {active.settings} · {active.series}
                  </div>
                )}
                <p className="mo-desc">{active.caption}</p>
                {label.mode === "open" && (
                  <button
                    type="button"
                    className="mo-close"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeFrame()
                    }}
                  >
                    Close
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="mo-desc">{caption}</p>
                <div className="mo-scroll">Scroll or drag to explore</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <SettingsPanel
          paramsRef={paramsRef}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </div>
    </section>
  )
}
