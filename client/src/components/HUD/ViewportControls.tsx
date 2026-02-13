import { useCallback } from 'react'
import { useStore } from '../../store'

const ZOOM_STEP = 0.8 // multiplier per click (< 1 = zoom in, > 1 = zoom out)

export function ViewportControls() {
  const autoPanEnabled = useStore((s) => s.autoPanEnabled)
  const toggleAutoPan = useStore((s) => s.toggleAutoPan)
  const orbitControlsRef = useStore((s) => s.orbitControlsRef)

  const zoom = useCallback(
    (direction: 'in' | 'out') => {
      const controls = orbitControlsRef?.current
      if (!controls) return

      const camera = controls.object
      if (!camera) return

      // Compute direction vector from camera to target
      const offset = camera.position.clone().sub(controls.target)
      const factor = direction === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP

      // Scale the offset (clamp to OrbitControls min/max distance)
      const newLength = offset.length() * factor
      const clamped = Math.max(
        controls.minDistance || 8,
        Math.min(controls.maxDistance || 100, newLength),
      )
      offset.setLength(clamped)

      camera.position.copy(controls.target).add(offset)
      controls.update()
    },
    [orbitControlsRef],
  )

  return (
    <div className="lcars-viewport-controls" aria-label="Viewport controls">
      <button
        type="button"
        className={
          autoPanEnabled
            ? 'lcars-vc-btn lcars-vc-btn-active'
            : 'lcars-vc-btn'
        }
        onClick={toggleAutoPan}
        title={autoPanEnabled ? 'Disable auto-pan' : 'Enable auto-pan'}
        aria-label={autoPanEnabled ? 'Disable auto-pan' : 'Enable auto-pan'}
      >
        <span className="lcars-vc-icon">TRK</span>
        <span className="lcars-vc-label">
          {autoPanEnabled ? 'AUTO' : 'MAN'}
        </span>
      </button>

      <button
        type="button"
        className="lcars-vc-btn"
        onClick={() => zoom('in')}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <span className="lcars-vc-icon">+</span>
        <span className="lcars-vc-label">MAG</span>
      </button>

      <button
        type="button"
        className="lcars-vc-btn"
        onClick={() => zoom('out')}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <span className="lcars-vc-icon">&ndash;</span>
        <span className="lcars-vc-label">MAG</span>
      </button>
    </div>
  )
}
