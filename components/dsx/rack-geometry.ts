import * as THREE from "three"

export type AssemblyView = "cutaway" | "enclosed" | "exploded"

export type RackPart = {
  id: string
  name: string
  status: "blocked" | "delayed" | "on-track" | "delivered"
}

export const partAnchors = new Map<string, THREE.Vector3>([
  ["compute-a", new THREE.Vector3(-3.45, 2.05, 1.06)],
  ["compute-b", new THREE.Vector3(-1.85, 1.45, 1.06)],
  ["fabric", new THREE.Vector3(-0.25, 2.6, 1.06)],
  ["storage", new THREE.Vector3(-0.25, 0.95, 1.06)],
  ["power", new THREE.Vector3(1.35, 1.65, 1.06)],
  ["cooling", new THREE.Vector3(3.1, 1.05, 1.06)],
  ["manifold", new THREE.Vector3(2.65, 2.9, 0.1)],
  ["optics", new THREE.Vector3(-1.6, 3.3, 0.65)],
  ["controls", new THREE.Vector3(4.55, 2.25, 0.15)],
  ["enclosure", new THREE.Vector3(2.5, 3.65, -1.65)],
])

export const partColors = {
  blocked: "#ff616d",
  delayed: "#ffbd61",
  "on-track": "#a9d876",
  delivered: "#6bcfc6",
} satisfies Record<RackPart["status"], string>

export type RackModel = {
  group: THREE.Group
  pickables: THREE.Object3D[]
  materialByPart: Map<string, THREE.MeshStandardMaterial[]>
  markers: Map<
    string,
    THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  >
  surfaceMaterials: THREE.MeshStandardMaterial[]
  setAppearance: (
    draft: boolean,
    selectedId: string | null,
    visibleIds?: readonly string[]
  ) => void
  setAssemblyView: (view: AssemblyView, immediate: boolean) => boolean
  stepAssembly: (alpha: number) => boolean
  dispose: () => void
}

export function createRackModel(): RackModel {
  const group = new THREE.Group()
  const pickables: THREE.Object3D[] = []
  const materialByPart = new Map<string, THREE.MeshStandardMaterial[]>()
  const markers = new Map<
    string,
    THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  >()
  const surfaceMaterials: THREE.MeshStandardMaterial[] = []
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const surfaces: {
    object: THREE.Mesh<THREE.BufferGeometry, THREE.Material>
    solid: THREE.Material
    partId: string
  }[] = []
  const structural = new THREE.MeshStandardMaterial({
    color: "#b7c3c8",
    metalness: 0.77,
    roughness: 0.36,
  })
  const black = new THREE.MeshStandardMaterial({
    color: "#111b29",
    metalness: 0.62,
    roughness: 0.4,
  })
  const chassis = new THREE.MeshStandardMaterial({
    color: "#3b4c60",
    metalness: 0.7,
    roughness: 0.35,
  })
  const green = new THREE.MeshStandardMaterial({
    color: "#a6cc61",
    emissive: "#6f9f33",
    emissiveIntensity: 0.5,
    roughness: 0.42,
  })
  const blue = new THREE.MeshStandardMaterial({
    color: "#44bcc6",
    metalness: 0.56,
    roughness: 0.25,
  })
  const amber = new THREE.MeshStandardMaterial({
    color: "#d9ad59",
    metalness: 0.4,
    roughness: 0.38,
  })
  const dark = new THREE.MeshStandardMaterial({
    color: "#070c13",
    roughness: 0.8,
  })
  for (const material of [
    structural,
    black,
    chassis,
    green,
    blue,
    amber,
    dark,
  ]) {
    materials.add(material)
    surfaceMaterials.push(material)
  }

  function partMaterial(id: string, color: string) {
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.57,
      roughness: 0.36,
    })
    materials.add(material)
    surfaceMaterials.push(material)
    const list = materialByPart.get(id) ?? []
    list.push(material)
    materialByPart.set(id, list)
    return material
  }

  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    partId?: string
  ) {
    geometries.add(geometry)
    materials.add(material)
    const object = new THREE.Mesh(geometry, material)
    object.position.set(x, y, z)
    object.castShadow = true
    object.receiveShadow = true
    if (partId) {
      object.name = partId
      pickables.push(object)
    }
    group.add(object)
    surfaces.push({ object, solid: material, partId: partId ?? "enclosure" })
    return object
  }

  function box(
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    partId?: string
  ) {
    const object = mesh(
      new THREE.BoxGeometry(width, height, depth),
      material,
      x,
      y,
      z,
      partId
    )
    object.castShadow = width > 0.2 && height > 0.1 && depth > 0.2
    return object
  }

  function pipe(
    points: THREE.Vector3[],
    material: THREE.Material,
    partId: string,
    radius = 0.047
  ) {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal")
    return mesh(
      new THREE.TubeGeometry(curve, 36, radius, 8, false),
      material,
      0,
      0,
      0,
      partId
    )
  }

  // A cutaway enclosure keeps every subsystem visible and independently selectable.
  const enclosure = partMaterial("enclosure", "#aebcc2")
  const shell = partMaterial("enclosure", "#e2e7e4")
  const lowerBand = partMaterial("enclosure", "#7ea943")
  box(10.1, 0.22, 3.45, 0.2, 0.05, 0, enclosure, "enclosure")
  box(9.8, 0.04, 3.12, 0.2, 0.18, 0, black, "enclosure")
  box(10.1, 0.16, 0.17, 0.2, 3.62, -1.65, structural, "enclosure")
  box(10.1, 0.12, 0.15, 0.2, 3.62, 1.64, structural, "enclosure")
  for (const x of [-4.8, 5.2]) {
    for (const z of [-1.65, 1.65])
      box(0.13, 3.6, 0.13, x, 1.84, z, structural, "enclosure")
    box(0.13, 0.13, 3.32, x, 3.62, 0, structural, "enclosure")
  }
  // The far half of the roof is retained; the near half is cut away.
  box(10.0, 0.05, 0.64, 0.2, 3.62, -1.28, enclosure, "enclosure")
  for (let i = 0; i < 24; i++)
    box(
      0.045,
      0.065,
      0.66,
      -4.6 + i * 0.415,
      3.67,
      -1.28,
      structural,
      "enclosure"
    )
  box(10.0, 2.82, 0.055, 0.2, 1.75, -1.57, shell, "enclosure")
  box(10.0, 0.62, 0.065, 0.2, 0.58, -1.61, lowerBand, "enclosure")
  for (let i = 0; i < 35; i++)
    box(
      0.035,
      2.75,
      0.06,
      -4.6 + i * 0.28,
      1.76,
      -1.515,
      structural,
      "enclosure"
    )
  // Repeated structural roof bays echo the modular enclosure in the reference video.
  for (const x of [-3.9, -2.3, -0.7, 0.9, 2.5, 4.1]) {
    box(0.055, 0.075, 2.6, x, 3.64, -0.18, structural, "enclosure")
    const diagonal = box(
      0.045,
      0.045,
      1.72,
      x + 0.48,
      3.66,
      -0.5,
      structural,
      "enclosure"
    )
    diagonal.rotation.y = 0.67
  }
  // Shallow front step and warning stripes make the container read as a physical unit.
  box(9.8, 0.1, 0.43, 0.2, 0.1, 1.9, structural, "enclosure")
  for (let i = 0; i < 22; i++)
    box(
      0.15,
      0.012,
      0.12,
      -4.45 + i * 0.43,
      0.158,
      1.93,
      i % 2 ? black : amber,
      "enclosure"
    )
  for (const x of [-4.1, 4.45]) box(0.8, 0.18, 2.6, x, -0.16, 0, black)

  function rackFrame(x: number, id: string, body: THREE.Material) {
    box(1.39, 3.12, 1.65, x, 1.75, -0.05, black, id)
    for (const dx of [-0.68, 0.68]) {
      box(0.065, 3.17, 0.12, x + dx, 1.74, 0.82, structural, id)
      for (let hole = 0; hole < 24; hole++)
        box(0.022, 0.035, 0.015, x + dx, 0.33 + hole * 0.12, 0.89, dark)
    }
    box(1.26, 0.14, 0.14, x, 3.32, 0.84, body, id)
    box(1.26, 0.09, 0.14, x, 0.21, 0.84, structural, id)
  }

  function tray(
    x: number,
    y: number,
    id: string,
    body: THREE.Material,
    greenBand: boolean
  ) {
    box(1.22, 0.205, 1.48, x, y, 0, body, id)
    box(1.19, 0.16, 0.035, x, y, 0.755, chassis, id)
    for (let vent = 0; vent < 13; vent++)
      box(0.022, 0.1, 0.017, x - 0.48 + vent * 0.065, y, 0.78, dark, id)
    box(0.04, 0.09, 0.02, x + 0.54, y, 0.79, green)
    box(0.04, 0.045, 0.035, x - 0.57, y, 0.8, structural, id)
    if (greenBand) box(0.51, 0.025, 0.03, x - 0.14, y - 0.075, 0.79, green, id)
  }

  for (const [id, x] of [
    ["compute-a", -3.45],
    ["compute-b", -1.85],
  ] satisfies [string, number][]) {
    const material = partMaterial(id, "#354457")
    rackFrame(x, id, material)
    for (let row = 0; row < 11; row++)
      tray(x, 0.45 + row * 0.25, id, material, row % 3 === 0)
    box(0.85, 0.07, 0.025, x, 3.32, 0.925, green, id)
  }

  // Restrained service cable loops show how the repeatable compute bays connect.
  for (const [id, x] of [
    ["compute-a", -3.45],
    ["compute-b", -1.85],
  ] satisfies [string, number][]) {
    for (let cable = 0; cable < 16; cable++) {
      const y = 0.58 + cable * 0.156
      pipe(
        [
          new THREE.Vector3(x - 0.3, y + 0.08, 0.8),
          new THREE.Vector3(x - 0.2, y - 0.1, 0.98),
          new THREE.Vector3(x + 0.36, y - 0.13, 1.0),
          new THREE.Vector3(x + 0.49, y + 0.09, 0.81),
        ],
        amber,
        id,
        0.014
      )
    }
  }

  const fabric = partMaterial("fabric", "#41596c")
  const storage = partMaterial("storage", "#3b495a")
  rackFrame(-0.25, "fabric", fabric)
  for (let row = 0; row < 5; row++) {
    const y = 2.12 + row * 0.22
    tray(-0.25, y, "fabric", fabric, false)
    for (let port = 0; port < 8; port++)
      box(
        0.07,
        0.055,
        0.035,
        -0.69 + port * 0.12,
        y + 0.025,
        0.81,
        port % 3 ? green : blue,
        "fabric"
      )
  }
  for (let row = 0; row < 6; row++) {
    const y = 0.42 + row * 0.245
    box(1.22, 0.205, 1.48, -0.25, y, 0, storage, "storage")
    for (let drive = 0; drive < 6; drive++) {
      box(0.16, 0.15, 0.04, -0.75 + drive * 0.2, y, 0.76, chassis, "storage")
      box(0.018, 0.048, 0.02, -0.7 + drive * 0.2, y, 0.8, green)
    }
  }

  const power = partMaterial("power", "#56606e")
  rackFrame(1.35, "power", power)
  for (let row = 0; row < 6; row++) {
    box(1.2, 0.39, 1.46, 1.35, 0.53 + row * 0.44, 0, power, "power")
    box(0.74, 0.21, 0.03, 1.19, 0.53 + row * 0.44, 0.76, black, "power")
    box(0.12, 0.12, 0.055, 1.79, 0.53 + row * 0.44, 0.8, amber, "power")
    for (let line = 0; line < 5; line++)
      box(
        0.56,
        0.015,
        0.02,
        1.16,
        0.46 + row * 0.44 + line * 0.035,
        0.79,
        structural,
        "power"
      )
  }
  box(1.0, 0.06, 0.03, 1.35, 3.32, 0.93, amber, "power")

  const cooling = partMaterial("cooling", "#546a78")
  box(1.55, 2.34, 1.65, 3.12, 1.4, -0.04, cooling, "cooling")
  box(1.4, 2.12, 0.045, 3.12, 1.4, 0.81, chassis, "cooling")
  for (const y of [0.83, 1.78]) {
    const fan = mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.06, 32),
      black,
      3.1,
      y,
      0.865,
      "cooling"
    )
    fan.rotation.x = Math.PI / 2
    const rim = mesh(
      new THREE.TorusGeometry(0.38, 0.024, 8, 32),
      structural,
      3.1,
      y,
      0.91,
      "cooling"
    )
    rim.rotation.z = Math.PI / 10
    for (let blade = 0; blade < 7; blade++) {
      const angle = (blade * Math.PI * 2) / 7
      const paddle = box(
        0.12,
        0.27,
        0.025,
        3.1 + Math.sin(angle) * 0.17,
        y + Math.cos(angle) * 0.17,
        0.91,
        cooling,
        "cooling"
      )
      paddle.rotation.z = -angle + 0.4
    }
    mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.1, 20),
      structural,
      3.1,
      y,
      0.96,
      "cooling"
    ).rotation.x = Math.PI / 2
  }
  box(0.8, 0.14, 0.06, 3.12, 2.41, 0.88, black, "cooling")
  box(0.48, 0.065, 0.07, 3.02, 2.41, 0.89, green, "cooling")

  const manifold = partMaterial("manifold", "#49a7b8")
  for (const [z, material] of [
    [-0.63, manifold],
    [-0.34, blue],
  ] satisfies [number, THREE.MeshStandardMaterial][]) {
    pipe(
      [
        new THREE.Vector3(-4.2, 2.98, z),
        new THREE.Vector3(0.3, 2.98, z),
        new THREE.Vector3(3.72, 2.98, z),
        new THREE.Vector3(3.9, 2.6, z),
        new THREE.Vector3(3.9, 0.48, z),
      ],
      material,
      "manifold",
      0.065
    )
    for (const x of [-3.45, -1.85, -0.25]) {
      pipe(
        [
          new THREE.Vector3(x, 2.98, z),
          new THREE.Vector3(x, 2.75, z),
          new THREE.Vector3(x + 0.48, 2.6, z),
          new THREE.Vector3(x + 0.48, 1.0, z),
        ],
        material,
        "manifold",
        0.03
      )
    }
  }
  pipe(
    [
      new THREE.Vector3(3.9, 2.7, -0.3),
      new THREE.Vector3(3.9, 2.95, 0.12),
      new THREE.Vector3(2.5, 2.95, 0.15),
      new THREE.Vector3(2.45, 2.45, 0.15),
    ],
    manifold,
    "manifold",
    0.065
  )
  for (const x of [2.6, 3.3]) {
    mesh(
      new THREE.TorusGeometry(0.12, 0.023, 8, 20),
      amber,
      x,
      2.97,
      0.24,
      "manifold"
    )
  }

  const optics = partMaterial("optics", "#c39955")
  box(6.4, 0.09, 0.42, -0.95, 3.26, 0.38, black, "optics")
  for (let cable = 0; cable < 7; cable++) {
    pipe(
      [
        new THREE.Vector3(-3.8, 3.32, 0.16 + cable * 0.055),
        new THREE.Vector3(-1.5, 3.32, 0.16 + cable * 0.055),
        new THREE.Vector3(-0.25, 3.32, 0.16 + cable * 0.055),
        new THREE.Vector3(0.1 + cable * 0.035, 2.9, 0.6),
      ],
      optics,
      "optics",
      0.017
    )
  }

  const controls = partMaterial("controls", "#5f7382")
  box(0.64, 1.2, 0.55, 4.48, 2.02, -0.02, controls, "controls")
  box(0.5, 0.38, 0.04, 4.48, 2.28, 0.28, black, "controls")
  box(0.41, 0.28, 0.03, 4.48, 2.28, 0.305, blue, "controls")
  for (let button = 0; button < 3; button++)
    box(
      0.075,
      0.075,
      0.045,
      4.3 + button * 0.18,
      1.94,
      0.29,
      button ? green : amber,
      "controls"
    )
  box(0.42, 0.24, 0.03, 4.48, 1.64, 0.29, black, "controls")
  pipe(
    [
      new THREE.Vector3(4.48, 1.4, 0),
      new THREE.Vector3(4.48, 0.8, 0),
      new THREE.Vector3(4.0, 0.4, 0),
    ],
    black,
    "controls",
    0.04
  )

  // The shell and dry-cooler deck are separate assembly layers, inspired by
  // the reference video. Their dimensions and internal layout are illustrative.
  type AssemblyPose = { position: THREE.Vector3; visible: boolean }
  const assemblyLayers: {
    object: THREE.Group
    poses: Record<AssemblyView, AssemblyPose>
    target: AssemblyPose
  }[] = []
  const hiddenPose = (x: number, y: number, z: number): AssemblyPose => ({
    position: new THREE.Vector3(x, y, z),
    visible: false,
  })
  const shownPose = (x: number, y: number, z: number): AssemblyPose => ({
    position: new THREE.Vector3(x, y, z),
    visible: true,
  })
  function finishLayer(
    firstSurface: number,
    cutaway: AssemblyPose,
    exploded: AssemblyPose
  ) {
    const layer = new THREE.Group()
    for (const { object } of surfaces.slice(firstSurface)) layer.add(object)
    layer.position.copy(cutaway.position)
    layer.visible = cutaway.visible
    group.add(layer)
    assemblyLayers.push({
      object: layer,
      poses: { cutaway, enclosed: shownPose(0, 0, 0), exploded },
      target: cutaway,
    })
  }

  // Two removable banks of service doors reveal the front rack aisle.
  for (const bank of [-1, 1]) {
    const firstSurface = surfaces.length
    for (let panel = 0; panel < 5; panel++) {
      const x = -4.3 + panel * 1.0 + (bank === 1 ? 5.0 : 0)
      box(0.97, 3.37, 0.075, x, 1.86, 1.72, shell, "enclosure")
      box(0.97, 0.68, 0.085, x, 0.51, 1.73, lowerBand, "enclosure")
      box(0.09, 0.045, 0.055, x + 0.27, 1.67, 1.79, chassis, "enclosure")
      for (const y of [0.96, 2.72])
        box(0.045, 0.14, 0.045, x - 0.41, y, 1.78, structural, "enclosure")
    }
    finishLayer(
      firstSurface,
      hiddenPose(bank * 0.9, -0.5, 2.25),
      shownPose(bank * 1.25, -0.38, 3.0)
    )
  }
  for (const side of [-1, 1]) {
    const firstSurface = surfaces.length
    const x = side === -1 ? -4.86 : 5.26
    box(0.075, 3.37, 3.37, x, 1.86, 0.02, shell, "enclosure")
    box(0.085, 0.68, 3.37, x, 0.51, 0.02, lowerBand, "enclosure")
    for (let vent = 0; vent < 7; vent++)
      box(
        0.025,
        0.035,
        1.55,
        x + side * 0.055,
        2.4 + vent * 0.105,
        0,
        chassis,
        "enclosure"
      )
    finishLayer(
      firstSurface,
      hiddenPose(side * 1.1, 0, 0),
      shownPose(side * 1.75, 0.2, -0.45)
    )
  }

  const deckStart = surfaces.length
  const coolerShell = partMaterial("cooling", "#dce5e4")
  box(10.15, 0.2, 3.43, 0.2, 3.87, 0, coolerShell, "cooling")
  for (const z of [-1.66, 1.66]) {
    box(10.15, 0.7, 0.09, 0.2, 4.3, z, coolerShell, "cooling")
    box(10.18, 0.08, 0.13, 0.2, 4.69, z, structural, "cooling")
    for (let bay = 0; bay < 9; bay++) {
      const x = -4.22 + bay * 1.1
      box(0.91, 0.43, 0.03, x, 4.3, z + Math.sign(z) * 0.06, black, "cooling")
      for (let louver = 0; louver < 5; louver++)
        box(
          0.91,
          0.026,
          0.035,
          x,
          4.13 + louver * 0.083,
          z + Math.sign(z) * 0.08,
          structural,
          "cooling"
        )
    }
  }
  for (const x of [-4.87, 5.27])
    box(0.09, 0.7, 3.4, x, 4.3, 0, coolerShell, "cooling")
  for (let bay = 0; bay < 6; bay++) {
    const x = -3.97 + bay * 1.67
    for (const z of [-0.79, 0.79]) {
      mesh(
        new THREE.CylinderGeometry(0.64, 0.64, 0.06, 32),
        dark,
        x,
        4.59,
        z,
        "cooling"
      )
      const ring = mesh(
        new THREE.TorusGeometry(0.64, 0.035, 8, 40),
        structural,
        x,
        4.66,
        z,
        "cooling"
      )
      ring.rotation.x = -Math.PI / 2
      for (let blade = 0; blade < 5; blade++) {
        const angle = (blade * Math.PI * 2) / 5
        const paddle = box(
          0.21,
          0.03,
          0.47,
          x + Math.sin(angle) * 0.28,
          4.65,
          z + Math.cos(angle) * 0.28,
          chassis,
          "cooling"
        )
        paddle.rotation.y = angle + 0.43
      }
      mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.075, 16),
        structural,
        x,
        4.69,
        z,
        "cooling"
      )
    }
    box(0.06, 0.06, 3.35, x - 0.8, 4.73, 0, structural, "cooling")
  }
  box(10.1, 0.06, 0.055, 0.2, 4.73, 0, structural, "cooling")
  finishLayer(deckStart, hiddenPose(0, 2.45, -0.5), shownPose(0, 2.45, -0.5))

  let assemblyMoving = false
  function stepAssembly(alpha: number) {
    assemblyMoving = false
    for (const layer of assemblyLayers) {
      layer.object.position.lerp(layer.target.position, alpha)
      if (layer.object.position.distanceTo(layer.target.position) < 0.004) {
        layer.object.position.copy(layer.target.position)
        layer.object.visible = layer.target.visible
      } else {
        assemblyMoving = true
      }
    }
    return assemblyMoving
  }

  const plaqueCanvas = document.createElement("canvas")
  plaqueCanvas.width = 768
  plaqueCanvas.height = 96
  const context = plaqueCanvas.getContext("2d")
  if (context) {
    context.fillStyle = "#1b2838"
    context.fillRect(0, 0, 768, 96)
    context.fillStyle = "#c2d9e4"
    context.font = "600 34px monospace"
    context.fillText("DSX / POD 01", 26, 46)
    context.fillStyle = "#8297a8"
    context.font = "17px monospace"
    context.fillText("COMPUTE  •  POWER  •  COOLING", 28, 76)
    const texture = new THREE.CanvasTexture(plaqueCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    textures.add(texture)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    box(3.2, 0.4, 0.025, -2.8, 0.05, 2.13, material, "enclosure")
  }

  for (const [id, position] of partAnchors) {
    const material = new THREE.MeshBasicMaterial({ color: "#a9d876" })
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 8),
      material
    )
    marker.position.copy(position)
    marker.name = id
    geometries.add(marker.geometry)
    materials.add(material)
    markers.set(id, marker)
    group.add(marker)
    pickables.push(marker)
  }

  // CAD-style edges deliberately omit small vents, LEDs and triangle diagonals.
  const outlines: THREE.Object3D[] = []
  const lineMaterials = new Map<string, THREE.LineBasicMaterial>()
  const draftSurface = new THREE.MeshBasicMaterial({
    color: "#d8e5f2",
    transparent: true,
    opacity: 0.075,
    depthWrite: false,
    toneMapped: false,
  })
  const ghostSurface = new THREE.MeshBasicMaterial({
    color: "#7c91a5",
    transparent: true,
    opacity: 0.045,
    depthWrite: false,
    toneMapped: false,
  })
  materials.add(draftSurface)
  materials.add(ghostSurface)
  for (const { object, partId } of surfaces) {
    const geometry = object.geometry
    let outlineGeometry: THREE.BufferGeometry
    let isPath = false
    if (geometry instanceof THREE.BoxGeometry) {
      const sizes = [
        geometry.parameters.width,
        geometry.parameters.height,
        geometry.parameters.depth,
      ].sort((a, b) => b - a)
      if (sizes[0] < 0.2 || sizes[1] < 0.08) continue
      outlineGeometry = new THREE.EdgesGeometry(geometry, 30)
    } else if (geometry instanceof THREE.TubeGeometry) {
      if (geometry.parameters.radius < 0.035) continue
      outlineGeometry = new THREE.BufferGeometry().setFromPoints(
        geometry.parameters.path.getPoints(45)
      )
      isPath = true
    } else if (geometry instanceof THREE.TorusGeometry) {
      const radius = geometry.parameters.radius
      const points = Array.from(
        { length: 49 },
        (_, i) =>
          new THREE.Vector3(
            Math.cos((i / 48) * Math.PI * 2) * radius,
            Math.sin((i / 48) * Math.PI * 2) * radius,
            0
          )
      )
      outlineGeometry = new THREE.BufferGeometry().setFromPoints(points)
      isPath = true
    } else {
      outlineGeometry = new THREE.EdgesGeometry(geometry, 30)
    }
    geometries.add(outlineGeometry)
    let material = lineMaterials.get(partId)
    if (!material) {
      material = new THREE.LineBasicMaterial({
        color: "#608abd",
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        toneMapped: false,
      })
      lineMaterials.set(partId, material)
      materials.add(material)
    }
    const outline = isPath
      ? new THREE.Line(outlineGeometry, material)
      : new THREE.LineSegments(outlineGeometry, material)
    // Local edges inherit the exact transform and visibility of their surface.
    outline.visible = false
    object.add(outline)
    outlines.push(outline)
  }

  return {
    group,
    pickables,
    materialByPart,
    markers,
    surfaceMaterials,
    setAppearance(draft, selectedId, visibleIds) {
      const visible = visibleIds ? new Set(visibleIds) : undefined
      for (const outline of outlines) outline.visible = draft
      for (const { object, solid, partId } of surfaces) {
        const matches = !visible || visible.has(partId)
        object.material = !matches ? ghostSurface : draft ? draftSurface : solid
        object.castShadow =
          !draft &&
          matches &&
          object.geometry instanceof THREE.BoxGeometry &&
          object.geometry.parameters.width > 0.2 &&
          object.geometry.parameters.height > 0.1 &&
          object.geometry.parameters.depth > 0.2
      }
      for (const [partId, material] of lineMaterials) {
        const matches = !visible || visible.has(partId)
        material.color.set(partId === selectedId ? "#2967af" : "#648bb9")
        material.opacity = !matches
          ? 0.055
          : partId === selectedId
            ? 0.85
            : selectedId
              ? 0.2
              : 0.38
      }
      for (const [id, marker] of markers)
        marker.visible = !visible || visible.has(id)
    },
    setAssemblyView(view, immediate) {
      for (const layer of assemblyLayers) {
        layer.target = layer.poses[view]
        if (layer.target.visible) layer.object.visible = true
      }
      return stepAssembly(immediate ? 1 : 0)
    },
    stepAssembly,
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      for (const texture of textures) texture.dispose()
    },
  }
}
