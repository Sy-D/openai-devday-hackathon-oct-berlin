"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import {
  createRackModel,
  partAnchors,
  partColors,
  type RackPart,
  type AssemblyView,
} from "./rack-geometry"
import styles from "./rack-viewer.module.css"

type ViewerMode = "solid" | "wireframe" | "schematic"
type RackViewerProps = {
  parts: readonly RackPart[]
  selectedId: string | null
  onSelect: (id: string) => void
  mode: ViewerMode
  resetKey: number
  visibleIds?: readonly string[]
  assemblyView?: AssemblyView
}
type MarkerStyle = CSSProperties & { "--marker-color": string }
type SceneHandle = {
  setParts: (parts: readonly RackPart[]) => void
  focus: (id: string | null) => void
  setMode: (mode: ViewerMode) => void
  setVisibleIds: (ids: readonly string[] | undefined) => void
  setAssemblyView: (view: AssemblyView) => void
  reset: () => void
}

const schematicAnchors = new Map<string, [number, number]>([
  ["compute-a", [21.1, 47]],
  ["compute-b", [35.5, 62]],
  ["fabric", [50, 37]],
  ["storage", [50, 68]],
  ["power", [64.5, 52]],
  ["cooling", [79.5, 65]],
  ["manifold", [79.2, 26]],
  ["optics", [36, 21]],
  ["controls", [90.4, 43]],
  ["enclosure", [68, 13]],
])

const statusLabels = {
  blocked: "Delivery blocked",
  delayed: "Delivery delayed",
  "on-track": "On track",
  delivered: "Delivered",
} satisfies Record<RackPart["status"], string>

function positionSchematicMarkers(
  host: HTMLDivElement,
  markers: Map<string, HTMLButtonElement>
) {
  const scale = Math.min(host.clientWidth / 1040, host.clientHeight / 520)
  const offsetX = (host.clientWidth - 1040 * scale) / 2
  const offsetY = (host.clientHeight - 520 * scale) / 2
  for (const [id, button] of markers) {
    const position = schematicAnchors.get(id)
    if (!position) continue
    button.style.left = `${offsetX + (position[0] / 100) * 1040 * scale}px`
    button.style.top = `${offsetY + (position[1] / 100) * 520 * scale}px`
    button.style.visibility = "visible"
  }
}

function RackSchematic() {
  return (
    <svg className={styles.schematic} viewBox="0 0 1040 520" aria-hidden="true">
      <defs>
        <pattern
          id="rack-grid"
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <path d="M32 0H0V32" fill="none" stroke="#26374b" strokeWidth="0.5" />
        </pattern>
        <linearGradient id="rack-face" x2="0" y2="1">
          <stop stopColor="#33485e" />
          <stop offset="1" stopColor="#172538" />
        </linearGradient>
      </defs>
      <rect width="1040" height="520" fill="url(#rack-grid)" />
      <rect
        x="80"
        y="65"
        width="884"
        height="376"
        rx="5"
        fill="#111d2c"
        stroke="#637a8d"
        strokeWidth="4"
      />
      <path d="M80 86H964M80 420H964" stroke="#697e90" strokeWidth="7" />
      <path
        d="M110 132H879V386M110 144H858V386"
        fill="none"
        stroke="#40aebc"
        strokeWidth="5"
      />
      <path d="M160 107H708" stroke="#d8a65e" strokeWidth="8" />
      {[150, 300, 450, 600].map((x, index) => (
        <g key={x}>
          <rect
            x={x}
            y="156"
            width="130"
            height="245"
            rx="3"
            fill="url(#rack-face)"
            stroke="#708598"
            strokeWidth="2"
          />
          {Array.from({ length: 11 }, (_, row) => (
            <g key={row}>
              <rect
                x={x + 8}
                y={165 + row * 20}
                width="114"
                height="15"
                rx="1"
                fill="#202f42"
                stroke="#516478"
                strokeWidth="0.7"
              />
              <path
                d={`M${x + 17} ${172 + row * 20}h70`}
                stroke="#8998a4"
                strokeWidth="1"
              />
              <rect
                x={x + 108}
                y={170 + row * 20}
                width="4"
                height="5"
                fill={index === 3 ? "#e4ad5c" : "#a6cd67"}
              />
            </g>
          ))}
          <path
            d={`M${x + 8} 153h114`}
            stroke={index === 3 ? "#d99f52" : "#b1d776"}
            strokeWidth="4"
          />
        </g>
      ))}
      <rect
        x="756"
        y="178"
        width="135"
        height="222"
        rx="4"
        fill="url(#rack-face)"
        stroke="#8298a8"
        strokeWidth="2"
      />
      {[242, 335].map((y) => (
        <g key={y}>
          <circle
            cx="823"
            cy={y}
            r="37"
            fill="#0b1521"
            stroke="#6e879a"
            strokeWidth="3"
          />
          <circle cx="823" cy={y} r="10" fill="#728a9b" />
          {Array.from({ length: 7 }, (_, i) => (
            <path
              key={i}
              d={`M823 ${y - 10}q27 -23 15 -27l-12 22z`}
              fill="#5b7487"
              transform={`rotate(${(i * 360) / 7} 823 ${y})`}
            />
          ))}
        </g>
      ))}
      <rect
        x="914"
        y="182"
        width="47"
        height="98"
        rx="3"
        fill="#405c70"
        stroke="#9cb0bd"
      />
      <rect x="922" y="193" width="31" height="27" rx="2" fill="#63bdc9" />
      <path d="M923 242h29" stroke="#b6d876" strokeWidth="5" />
      <text
        x="96"
        y="465"
        fill="#91a8ba"
        fontSize="12"
        fontFamily="monospace"
        letterSpacing="3"
      >
        DSX POD 01 / FRONT ELEVATION
      </text>
      <text
        x="96"
        y="486"
        fill="#5d788d"
        fontSize="10"
        fontFamily="monospace"
        letterSpacing="1.5"
      >
        ILLUSTRATIVE GEOMETRY · NOT TO SCALE
      </text>
    </svg>
  )
}

export default function RackViewer({
  parts,
  selectedId,
  onSelect,
  mode,
  resetKey,
  visibleIds,
  assemblyView = "cutaway",
}: RackViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markerRefs = useRef(new Map<string, HTMLButtonElement>())
  const handleRef = useRef<SceneHandle | null>(null)
  const selectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const previousResetKey = useRef(resetKey)
  const isSchematic = mode === "schematic" || unavailable

  useEffect(() => {
    selectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const hostDataset = host.dataset
    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      })
    } catch {
      queueMicrotask(() => {
        if (!disposed) setUnavailable(true)
      })
      return () => {
        disposed = true
      }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setClearColor("#101b2a", 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.32
    renderer.shadowMap.enabled = host.clientWidth > 700
    renderer.shadowMap.type = THREE.PCFShadowMap
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    const model = createRackModel()
    scene.add(model.group)
    scene.add(new THREE.AmbientLight("#a4bbd2", 1.35))
    const hemisphere = new THREE.HemisphereLight("#dbedff", "#182635", 2.1)
    scene.add(hemisphere)
    const keyLight = new THREE.DirectionalLight("#f4f6ff", 3.6)
    keyLight.position.set(-2, 8, 7)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.left = -8
    keyLight.shadow.camera.right = 8
    keyLight.shadow.camera.top = 6
    keyLight.shadow.camera.bottom = -6
    keyLight.shadow.normalBias = 0.035
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight("#4b94bd", 2.2)
    rimLight.position.set(-4, 4, -5)
    scene.add(rimLight)
    const fillLight = new THREE.DirectionalLight("#bbd8b0", 1.5)
    fillLight.position.set(8, 4, 1)
    scene.add(fillLight)
    const floorGeometry = new THREE.PlaneGeometry(32, 24)
    const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.31 })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.265
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(26, 52, "#45596d", "#283e54")
    grid.position.y = -0.275
    grid.material.transparent = true
    grid.material.opacity = 0.45
    scene.add(grid)
    const draftingGrid = new THREE.GridHelper(26, 52, "#98b5d6", "#d0deec")
    draftingGrid.position.y = -0.275
    draftingGrid.material.transparent = true
    draftingGrid.material.opacity = 0.48
    draftingGrid.visible = false
    scene.add(draftingGrid)

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.09
    controls.minDistance = 3.5
    controls.maxDistance = 42
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minPolarAngle = Math.PI * 0.13
    controls.enablePan = true
    controls.screenSpacePanning = true
    controls.target.set(0.1, 1.6, 0)
    controls.zoomToCursor = true
    controls.listenToKeyEvents(canvas)
    let dirty = true
    let currentMode: ViewerMode = "solid"
    let selected: string | null = null
    let partStatuses: readonly RackPart[] = []
    let filteredIds: readonly string[] | undefined
    let frame = 0
    let sceneReady = false
    let currentAssembly: AssemblyView = "cutaway"
    let assemblyMoving = false
    function invalidate() {
      dirty = true
      if (sceneReady && frame === 0 && !disposed)
        frame = requestAnimationFrame(animate)
    }
    let width = 1
    let height = 1
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const targetPosition = new THREE.Vector3()
    const targetLook = new THREE.Vector3()
    let moving = false
    let overviewCamera = true
    const home = () => {
      overviewCamera = true
      const aspect = width / height
      const exploded = currentAssembly === "exploded"
      const enclosed = currentAssembly === "enclosed"
      const distance = exploded
        ? Math.max(24, 25.4 / aspect)
        : enclosed
          ? Math.max(17.6, 19.8 / aspect)
          : Math.max(15.8, 18.8 / aspect)
      const direction = new THREE.Vector3(
        0.54,
        exploded ? 0.42 : 0.34,
        0.77
      ).normalize()
      targetLook.set(
        0.1,
        exploded ? 2.9 : enclosed ? 2.3 : 1.55,
        exploded ? 0.8 : 0
      )
      targetPosition.copy(targetLook).addScaledVector(direction, distance)
      moving = true
      invalidate()
    }
    const focus = (id: string | null) => {
      selected = id
      model.setAppearance(currentMode === "wireframe", selected, filteredIds)
      for (const [partId, materials] of model.materialByPart) {
        for (const material of materials) {
          const status =
            partStatuses.find((part) => part.id === partId)?.status ??
            "on-track"
          material.emissive.set(partColors[status])
          material.emissiveIntensity =
            partId === id
              ? 0.24
              : status === "blocked"
                ? 0.055
                : status === "delayed"
                  ? 0.035
                  : 0
        }
      }
      const anchor = id ? partAnchors.get(id) : undefined
      if (!anchor) {
        home()
        return
      }
      overviewCamera = false
      targetLook.copy(anchor)
      const distance = id === "enclosure" ? 9 : 6.2
      const direction = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize()
      direction.y = Math.max(direction.y, 0.18)
      direction.z = Math.max(direction.z, 0.65)
      direction.normalize()
      targetPosition.copy(anchor).addScaledVector(direction, distance)
      moving = true
      invalidate()
    }
    const resize = () => {
      const previousAspect = width / height
      width = Math.max(1, host.clientWidth)
      height = Math.max(1, host.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      if (overviewCamera && Math.abs(previousAspect - camera.aspect) > 0.02)
        home()
      invalidate()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()
    home()
    camera.position.copy(targetPosition)
    controls.target.copy(targetLook)
    controls.update()
    moving = false
    const changed = () => {
      invalidate()
    }
    const interactionStarted = () => {
      overviewCamera = false
      moving = false
      invalidate()
    }
    controls.addEventListener("change", changed)
    controls.addEventListener("start", interactionStarted)

    const projected = new THREE.Vector3()
    function projectMarkers() {
      for (const [id, button] of markerRefs.current) {
        const anchor = partAnchors.get(id)
        if (!anchor) {
          button.style.visibility = "hidden"
          continue
        }
        projected.copy(anchor).project(camera)
        const x = (projected.x * 0.5 + 0.5) * width
        const y = (-projected.y * 0.5 + 0.5) * height
        const visible =
          projected.z > -1 &&
          projected.z < 1 &&
          x > 14 &&
          x < width - 14 &&
          y > 14 &&
          y < height - 14
        button.style.visibility = visible ? "visible" : "hidden"
        button.style.left = `${x}px`
        button.style.top = `${y}px`
        button.style.zIndex = selected === id ? "4" : "2"
      }
    }
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerDown = new THREE.Vector2()
    const down = (event: PointerEvent) => {
      pointerDown = new THREE.Vector2(event.clientX, event.clientY)
    }
    const up = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        pointerDown.distanceTo(
          new THREE.Vector2(event.clientX, event.clientY)
        ) > 6
      )
        return
      const bounds = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1
      )
      raycaster.setFromCamera(pointer, camera)
      const currentVisibleIds = filteredIds
      const pickables = model.pickables.filter((object) => {
        if (currentVisibleIds && !currentVisibleIds.includes(object.name))
          return false
        // Raycaster does not itself exclude invisible ancestors.
        let ancestor: THREE.Object3D | null = object
        while (ancestor) {
          if (!ancestor.visible) return false
          ancestor = ancestor.parent
        }
        return true
      })
      const hit = raycaster.intersectObjects(pickables, false)[0]
      if (hit && partAnchors.has(hit.object.name))
        selectRef.current(hit.object.name)
    }
    const contextLost = (event: Event) => {
      event.preventDefault()
      currentMode = "schematic"
      hostDataset.assemblyMoving = "false"
      setUnavailable(true)
    }
    const visibilityChanged = () => {
      if (!document.hidden) invalidate()
    }
    document.addEventListener("visibilitychange", visibilityChanged)
    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointerup", up)
    canvas.addEventListener("webglcontextlost", contextLost)
    handleRef.current = {
      setParts(nextParts) {
        partStatuses = nextParts
        for (const part of nextParts)
          model.markers
            .get(part.id)
            ?.material.color.set(partColors[part.status])
        for (const [partId, materials] of model.materialByPart) {
          const status =
            nextParts.find((part) => part.id === partId)?.status ?? "on-track"
          for (const material of materials) {
            material.emissive.set(partColors[status])
            material.emissiveIntensity =
              partId === selected
                ? 0.24
                : status === "blocked"
                  ? 0.055
                  : status === "delayed"
                    ? 0.035
                    : 0
          }
        }
        invalidate()
      },
      focus,
      setMode(nextMode) {
        currentMode = nextMode
        const draft = nextMode === "wireframe"
        model.setAppearance(draft, selected, filteredIds)
        grid.visible = !draft
        draftingGrid.visible = draft
        floor.visible = !draft
        invalidate()
      },
      setVisibleIds(ids) {
        filteredIds = ids
        model.setAppearance(currentMode === "wireframe", selected, filteredIds)
        invalidate()
      },
      setAssemblyView(nextAssembly) {
        if (currentAssembly === nextAssembly) return
        currentAssembly = nextAssembly
        hostDataset.assembly = nextAssembly
        assemblyMoving = model.setAssemblyView(nextAssembly, reducedMotion)
        if (!selected) home()
        hostDataset.assemblyMoving = String(assemblyMoving || moving)
        invalidate()
      },
      reset: home,
    }
    let previousFrameTime = 0
    function animate() {
      const now = performance.now()
      const elapsed = Math.min(
        0.15,
        previousFrameTime ? (now - previousFrameTime) / 1000 : 1 / 60
      )
      previousFrameTime = now
      const transitionStep = reducedMotion ? 1 : 1 - Math.exp(-elapsed * 8)
      frame = 0
      if (disposed || document.hidden || currentMode === "schematic") return
      if (moving) {
        camera.position.lerp(targetPosition, transitionStep)
        controls.target.lerp(targetLook, transitionStep)
        if (
          camera.position.distanceTo(targetPosition) < 0.02 &&
          controls.target.distanceTo(targetLook) < 0.02
        ) {
          camera.position.copy(targetPosition)
          controls.target.copy(targetLook)
          moving = false
        }
        dirty = true
      }
      if (assemblyMoving) {
        assemblyMoving = model.stepAssembly(transitionStep)
        dirty = true
      }
      const controlsMoving = controls.update()
      hostDataset.assemblyMoving = String(
        moving || assemblyMoving || controlsMoving
      )
      if (dirty) {
        renderer.render(scene, camera)
        projectMarkers()
        dirty = false
      }
      if (moving || assemblyMoving || controlsMoving) invalidate()
    }
    sceneReady = true
    frame = requestAnimationFrame(() => {
      if (disposed) return
      setReady(true)
      animate()
    })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      document.removeEventListener("visibilitychange", visibilityChanged)
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("webglcontextlost", contextLost)
      controls.removeEventListener("change", changed)
      controls.removeEventListener("start", interactionStarted)
      controls.dispose()
      model.dispose()
      floorGeometry.dispose()
      floorMaterial.dispose()
      grid.geometry.dispose()
      grid.material.dispose()
      draftingGrid.geometry.dispose()
      draftingGrid.material.dispose()
      keyLight.shadow.dispose()
      renderer.dispose()
      handleRef.current = null
    }
  }, [])

  useEffect(() => {
    handleRef.current?.setParts(parts)
  }, [parts])
  useEffect(() => {
    handleRef.current?.setAssemblyView(assemblyView)
  }, [assemblyView])
  useEffect(() => {
    handleRef.current?.focus(selectedId)
  }, [selectedId])
  useEffect(() => {
    handleRef.current?.setVisibleIds(visibleIds)
  }, [visibleIds])
  useEffect(() => {
    handleRef.current?.setMode(mode)
    const host = hostRef.current
    if (!host || (mode !== "schematic" && !unavailable)) return
    const markers = markerRefs.current
    const positionMarkers = () => positionSchematicMarkers(host, markers)
    positionMarkers()
    const observer = new ResizeObserver(positionMarkers)
    observer.observe(host)
    return () => observer.disconnect()
  }, [mode, unavailable, parts])
  useEffect(() => {
    if (previousResetKey.current !== resetKey) handleRef.current?.reset()
    previousResetKey.current = resetKey
  }, [resetKey])

  return (
    <div
      ref={hostRef}
      className={styles.viewer}
      data-testid="rack-viewer"
      data-renderer={unavailable ? "fallback" : ready ? "webgl" : "loading"}
      data-mode={mode}
      data-assembly={assemblyView}
      data-assembly-moving="false"
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        hidden={isSchematic}
        tabIndex={0}
        aria-label="Interactive DSX POD model. Drag to rotate, scroll to zoom, shift-drag or arrow keys to pan. Use component markers to inspect a part."
      />
      {isSchematic && <RackSchematic />}
      {!ready && !unavailable && (
        <div className={styles.loading} role="status">
          <span />
          Preparing the digital twin
        </div>
      )}
      <div className={styles.modelLabel}>
        <span className={styles.crosshair}>+</span>
        <span>
          POD 01
          <span>
            {mode === "wireframe" ? "TECHNICAL VIEW" : "INTEGRATION VIEW"}
          </span>
        </span>
      </div>
      <span className={styles.axis} aria-hidden="true">
        <b>Y</b>
        <i />
        <span>Z</span>
        <small>X</small>
      </span>
      <div
        className={styles.markers}
        aria-label="Component inspection markers"
        hidden={!ready && !unavailable}
      >
        {parts.map((part, index) => {
          const markerStyle: MarkerStyle = {
            "--marker-color": partColors[part.status],
          }
          return (
            <button
              key={part.id}
              ref={(button) => {
                if (button) markerRefs.current.set(part.id, button)
                else markerRefs.current.delete(part.id)
              }}
              className={styles.hotspot}
              hidden={visibleIds !== undefined && !visibleIds.includes(part.id)}
              style={markerStyle}
              data-status={part.status}
              data-selected={selectedId === part.id}
              aria-label={`Inspect ${part.name}: ${statusLabels[part.status]}`}
              aria-pressed={selectedId === part.id}
              onClick={() => onSelect(part.id)}
              title={`${part.name} · ${statusLabels[part.status]}`}
            >
              <span className={styles.dot}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.tooltip}>
                <strong>{part.name}</strong>
                <span>{statusLabels[part.status]}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className={styles.instructions}>
        {unavailable ? (
          <span>
            3D is unavailable on this device. All parts remain available in the
            2D view.
          </span>
        ) : mode === "schematic" ? (
          <>
            <span>FRONT ELEVATION</span>
            <i />
            <span>Select a numbered component to inspect</span>
          </>
        ) : (
          <>
            <span>DRAG TO ORBIT</span>
            <i />
            <span>SCROLL TO ZOOM</span>
            <i />
            <span>SHIFT + DRAG TO PAN</span>
          </>
        )}
      </div>
    </div>
  )
}
