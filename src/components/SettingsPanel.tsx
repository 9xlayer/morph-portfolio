import { useMemo, useState, type MutableRefObject } from "react"
import { X } from "lucide-react"
import {
  CAMERA_DEFAULTS,
  formatCameraReadout,
  type CameraParams,
} from "../lib/camera"

type SliderDef = {
  key: keyof CameraParams
  label: string
  min: number
  max: number
  step: number
  digits: number
}

const GROUPS: { title: string; items: SliderDef[] }[] = [
  {
    title: "Camera",
    items: [
      { key: "camX", label: "Pos X", min: -0.4, max: 1.6, step: 0.01, digits: 2 },
      { key: "camY", label: "Pos Y", min: -0.6, max: 1.2, step: 0.01, digits: 2 },
      { key: "dolly", label: "Dolly", min: -700, max: 700, step: 10, digits: 0 },
      { key: "fov", label: "FOV", min: 40, max: 130, step: 1, digits: 0 },
    ],
  },
  {
    title: "Canvas",
    items: [
      { key: "yaw", label: "Yaw", min: -60, max: 10, step: 1, digits: 0 },
      { key: "roll", label: "Roll", min: -8, max: 16, step: 0.5, digits: 2 },
      { key: "size", label: "Size", min: 0.2, max: 1.1, step: 0.01, digits: 2 },
    ],
  },
  {
    title: "Cascade",
    items: [
      { key: "stepX", label: "Right", min: 0, max: 0.34, step: 0.005, digits: 3 },
      { key: "stepY", label: "Rise", min: -0.34, max: 0.04, step: 0.005, digits: 3 },
      { key: "stepZ", label: "Depth", min: 0, max: 320, step: 5, digits: 0 },
    ],
  },
  {
    title: "Cursor parallax",
    items: [
      { key: "pushX", label: "Push X", min: 0, max: 1.5, step: 0.05, digits: 2 },
      { key: "pushY", label: "Push Y", min: 0, max: 1.5, step: 0.05, digits: 2 },
      { key: "pushZ", label: "Float", min: 0, max: 1.5, step: 0.05, digits: 2 },
    ],
  },
]

type Props = {
  paramsRef: MutableRefObject<CameraParams>
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsPanel({ paramsRef, open, onOpenChange }: Props) {
  const [params, setParams] = useState<CameraParams>(() => ({ ...paramsRef.current }))
  const [copied, setCopied] = useState(false)

  const readout = useMemo(() => formatCameraReadout(params), [params])

  const setValue = (key: keyof CameraParams, value: number) => {
    const next = { ...paramsRef.current, [key]: value }
    paramsRef.current = next
    setParams(next)
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mo-settingsbtn"
        aria-expanded={false}
        aria-controls="mo-settings-panel"
        onClick={() => onOpenChange(true)}
      >
        <span className="mo-mark" aria-hidden>
          +
        </span>
        Settings
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="mo-settingsbtn"
        aria-expanded
        aria-controls="mo-settings-panel"
        onClick={() => onOpenChange(false)}
      >
        <span className="mo-mark" aria-hidden>
          +
        </span>
        Settings
      </button>
      <div id="mo-settings-panel" className="mo-settings">
        <div className="mo-settings-head">
          Camera settings
          <button
            type="button"
            className="mo-settings-close"
            aria-label="Close camera settings"
            onClick={() => onOpenChange(false)}
          >
            <X size={16} />
          </button>
        </div>
        <div className="mo-settings-body">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mo-group">{group.title}</div>
              {group.items.map((item) => (
                <label className="mo-slider" key={item.key}>
                  <span>{item.label}</span>
                  <input
                    type="range"
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    value={params[item.key]}
                    onChange={(e) => setValue(item.key, Number(e.target.value))}
                  />
                  <output>{params[item.key].toFixed(item.digits)}</output>
                </label>
              ))}
            </div>
          ))}
          <pre className="mo-readout">{readout}</pre>
          <div className="mo-settings-actions">
            <button
              type="button"
              className="mo-btn"
              onClick={() => {
                paramsRef.current = { ...CAMERA_DEFAULTS }
                setParams({ ...CAMERA_DEFAULTS })
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="mo-btn mo-btn-primary"
              onClick={() => {
                navigator.clipboard?.writeText(readout).then(
                  () => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1600)
                  },
                  () => setCopied(false),
                )
              }}
            >
              {copied ? "Copied" : "Copy values"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
