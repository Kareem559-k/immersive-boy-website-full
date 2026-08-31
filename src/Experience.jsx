import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import * as THREE from 'three'

const CARD_COUNT = 12

// Twelve cards distributed around one clean 360° helix.
const ORBIT_STEP = (Math.PI * 2) / CARD_COUNT
const ORBIT_START = 0.12

const CARD_WIDTH = 2.35
const CARD_HEIGHT = 1.32

// MASTER SPACING: all background-card separation is multiplied by 2.
const SPACING_MULTIPLIER = 2

const CARD_BASE_RADIUS = 6.95
const CARD_RADIUS_PITCH = 0.10 * SPACING_MULTIPLIER
const ACTIVE_CARD_RADIUS = 6.30
const ACTIVE_CARD_Y = 2.34

// Local helix spacing around the active card.
// These three values are the important ×2 gaps.
const HELIX_VERTICAL_GAP = 0.20 * SPACING_MULTIPLIER
const HELIX_TANGENT_GAP = 0.72 * SPACING_MULTIPLIER
const HELIX_DEPTH_GAP = 0.11 * SPACING_MULTIPLIER

// At most: active + 2 previous + 1 next.
const PAST_VISIBLE_DISTANCE = 2.05
const FUTURE_VISIBLE_DISTANCE = 1.05
const VISIBILITY_FADE = 0.30

// Dust guide only: a clean global rising helix.
const CARD_HEIGHTS = Array.from(
  { length: CARD_COUNT },
  (_, index) => 0.52 + index * 0.72
)

const CAMERA_MID_RADIUS = 12.55
const CAMERA_PAIR_SWING = 0.45 // subtle zoom only
const CAMERA_TRANSITION_PULSE = 0.08

const BOY_HEIGHT = 2.95
// The supplied child STL includes a shallow circular print base. Lowering it
// into the rock hides that base while leaving the feet visibly planted on top.
const BOY_POSITION = [0, -0.16, 0]
const ROCK_WIDTH = 2.85
const ROCK_POSITION = [0, 0.015, 0]
const ROCK_ROTATION_Y = 0.15

const clamp01 = (value) => Math.min(1, Math.max(0, value))

function smoothstep01(value) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function easeInOut(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function sampleAngle(step) {
  const safe = Math.min(CARD_COUNT - 1, Math.max(0, step))
  const a = Math.floor(safe)
  const b = Math.min(CARD_COUNT - 1, a + 1)
  const t = easeInOut(safe - a)
  const from = ORBIT_START + a * ORBIT_STEP
  const to = ORBIT_START + b * ORBIT_STEP
  return THREE.MathUtils.lerp(from, to, t)
}

function shortestAngleLerp(from, to, t) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + delta * t
}

function prepareModel(scene, mode, targetSize) {
  const object = clone(scene)

  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      child.frustumCulled = false
    }
  })

  object.updateMatrixWorld(true)
  const firstBox = new THREE.Box3().setFromObject(object)
  const firstSize = firstBox.getSize(new THREE.Vector3())
  const dimension = mode === 'height' ? firstSize.y : firstSize.x
  const scale = dimension > 0 ? targetSize / dimension : 1

  object.scale.setScalar(scale)
  object.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())

  if (mode === 'height') {
    object.position.x -= center.x
    object.position.z -= center.z
    object.position.y -= box.min.y
  } else {
    object.position.x -= center.x
    object.position.z -= center.z
    object.position.y -= box.max.y
  }

  return object
}

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

function Boy() {
  const group = useRef()
  const geometry = useLoader(STLLoader, assetUrl('models/boy.stl'))
  const model = useMemo(() => {
    const source = new THREE.Mesh(
      geometry.clone(),
      new THREE.MeshStandardMaterial({
        color: '#ecebe7',
        roughness: 0.86,
        metalness: 0,
      }),
    )
    source.rotation.x = -Math.PI / 2
    source.updateMatrixWorld(true)
    return prepareModel(source, 'height', BOY_HEIGHT)
  }, [geometry])

  useFrame((state) => {
    if (!group.current) return

    group.current.position.y =
      BOY_POSITION[1] + Math.sin(state.clock.elapsedTime * 1.02) * 0.006

    group.current.rotation.z =
      Math.sin(state.clock.elapsedTime * 0.43) * 0.0022
  })

  return (
    <group ref={group} position={BOY_POSITION}>
      <primitive object={model} />
    </group>
  )
}

function Rock() {
  const geometry = useLoader(STLLoader, assetUrl('models/rockl.stl'))
  const model = useMemo(() => {
    const source = new THREE.Mesh(
      geometry.clone(),
      new THREE.MeshStandardMaterial({
        color: '#344d5c',
        roughness: 0.94,
        metalness: 0,
      }),
    )
    source.rotation.x = -Math.PI / 2
    source.updateMatrixWorld(true)
    return prepareModel(source, 'width', ROCK_WIDTH)
  }, [geometry])

  return (
    <group position={ROCK_POSITION} rotation={[0, ROCK_ROTATION_Y, 0]}>
      <primitive object={model} />
    </group>
  )
}

function makeCardTexture(index) {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 900
  const ctx = canvas.getContext('2d')

  const backgrounds = [
    ['#4b87ad', '#0b2941'],
    ['#32698f', '#081f34'],
    ['#608eaa', '#102b43'],
    ['#285979', '#071a2e'],
  ]

  const [first, second] = backgrounds[index % backgrounds.length]
  const gradient = ctx.createLinearGradient(0, 0, 1600, 900)
  gradient.addColorStop(0, first)
  gradient.addColorStop(1, second)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1600, 900)

  // faint editorial blocks: keeps the placeholder feeling designed, not empty
  for (let i = 0; i < 18; i += 1) {
    const x = 50 + ((i * 173 + index * 97) % 1450)
    const y = 80 + ((i * 109 + index * 67) % 720)
    const w = 80 + ((i * 47) % 240)
    const h = 30 + ((i * 31) % 120)
    ctx.fillStyle = `rgba(255,255,255,${0.025 + (i % 4) * 0.012})`
    ctx.fillRect(x, y, w, h)
  }

  ctx.fillStyle = 'rgba(2,12,24,.25)'
  ctx.fillRect(0, 0, 1600, 900)

  ctx.fillStyle = 'rgba(255,255,255,.95)'
  ctx.font = '700 104px Arial'
  ctx.fillText(String(index + 1).padStart(2, '0'), 70, 140)

  ctx.font = '700 34px Arial'
  ctx.fillStyle = 'rgba(255,255,255,.86)'
  ctx.fillText('VIDEO MEMORY', 72, 812)

  ctx.beginPath()
  ctx.arc(800, 450, 62, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,.82)'
  ctx.lineWidth = 5
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(785, 415)
  ctx.lineTo(785, 485)
  ctx.lineTo(840, 450)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,.84)'
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function makeLightSweepTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 8
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, 256, 0)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.34, 'rgba(204,240,255,.16)')
  gradient.addColorStop(0.5, 'rgba(238,250,255,1)')
  gradient.addColorStop(0.66, 'rgba(204,240,255,.16)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 8)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function Card({
  index,
  storyStepRef,
  velocityRef,
  endMixRef,
  onSelect,
  baseAngle,
  baseRadius,
  baseY,
}) {
  const group = useRef()
  const geometry = useRef()
  const material = useRef()
  const glowMaterial = useRef()
  const lightSweep = useRef()
  const lightSweepMaterial = useRef()
  const hoverMixRef = useRef(0)
  const [hovered, setHovered] = useState(false)
  const texture = useMemo(() => makeCardTexture(index), [index])
  const sweepTexture = useMemo(() => makeLightSweepTexture(), [])
  const basePositions = useRef(null)

  const baseX = Math.sin(baseAngle) * baseRadius
  const baseZ = Math.cos(baseAngle) * baseRadius
  const baseTilt = ((index % 5) - 2) * 0.025

  useEffect(() => {
    if (!geometry.current) return
    basePositions.current = Float32Array.from(geometry.current.attributes.position.array)
  }, [])

  useFrame((state, delta) => {
    if (
      !group.current || !material.current || !glowMaterial.current ||
      !lightSweep.current || !lightSweepMaterial.current
    ) return

    const step = storyStepRef.current
    const endMix = endMixRef.current
    const signedDistance = index - step
    const distance = Math.abs(signedDistance)

    // IMPORTANT: define these BEFORE the visibility block.
    // The previous version referenced isPast before initialization,
    // which stopped the card animation frame and left every card at opacity 0.
    const isPast = signedDistance < -0.28
    const isFuture = signedDistance > 0.28

    // Passed cards remain visible as a floating spiral trail in the background.
    // Future cards are still limited so the scene never becomes crowded.
    const pastTrailVisibility =
      signedDistance <= 0
        ? THREE.MathUtils.clamp(
            0.30 - Math.max(0, distance - 1) * 0.018,
            0.12,
            0.30
          )
        : 0

    const futureVisibility =
      signedDistance > 0
        ? 1 - smoothstep01(
            (distance - FUTURE_VISIBLE_DISTANCE) / VISIBILITY_FADE
          )
        : 0

    const activeVisibility =
      Math.exp(-distance * distance * 2.4)

    const visibleWindow = THREE.MathUtils.clamp(
      Math.max(
        activeVisibility,
        pastTrailVisibility,
        futureVisibility
      ),
      0,
      1
    )

    // Past cards stay alive in the scene; only far future cards are hidden.
    group.current.visible =
      isPast ||
      Math.abs(signedDistance) < 0.35 ||
      visibleWindow > 0.01 ||
      hovered

    // Hero focus is deliberately narrow. Background cards still remain visible as the spiral trail.
    // Keep the neighbours present so the eye can read the spiral as one
    // continuous ribbon, while the current card still owns the foreground.
    const focus = Math.exp(-distance * distance * 3.15)
    const visualFocus = hovered ? Math.max(focus, 0.98) : focus
    hoverMixRef.current = THREE.MathUtils.damp(
      hoverMixRef.current,
      hovered ? 1 : 0,
      hovered ? 8.5 : 6.2,
      delta,
    )
    const hoverMix = hoverMixRef.current

    // TRUE LOCAL HELIX.
    // Separation is ×2 in tangent, depth and vertical directions.
    const tangentDirection = Math.tanh(signedDistance * 1.35)
    const tangentAmount =
      HELIX_TANGENT_GAP *
      Math.min(distance, 2.4) *
      (1 - focus)

    const tangentX =
      Math.cos(baseAngle) *
      tangentDirection *
      tangentAmount

    const tangentZ =
      -Math.sin(baseAngle) *
      tangentDirection *
      tangentAmount

    // Every neighbouring card also moves farther outward in depth.
    const backgroundRadius =
      CARD_BASE_RADIUS +
      Math.min(distance, 2.4) * HELIX_DEPTH_GAP +
      (isPast ? Math.min(distance, 8) * 0.12 : 0)

    const helixX =
      Math.sin(baseAngle) * backgroundRadius +
      tangentX

    const helixZ =
      Math.cos(baseAngle) * backgroundRadius +
      tangentZ

    // Rising/falling helix around the currently active card.
    const helixY =
      ACTIVE_CARD_Y +
      signedDistance * HELIX_VERTICAL_GAP

    const activeX = Math.sin(baseAngle) * ACTIVE_CARD_RADIUS
    const activeZ = Math.cos(baseAngle) * ACTIVE_CARD_RADIUS

    // Scroll energy makes the card feel alive, like the reference site.
    const velocity = THREE.MathUtils.clamp(Math.abs(velocityRef.current), 0, 10)
    const breathe =
      Math.sin(state.clock.elapsedTime * 0.82 + index * 0.73) *
      0.045 *
      focus

    const radialX = Math.sin(baseAngle) * breathe
    const radialZ = Math.cos(baseAngle) * breathe

    const targetX =
      THREE.MathUtils.lerp(helixX, activeX, focus) +
      radialX

    const historyFloat =
      isPast
        ? Math.sin(
            state.clock.elapsedTime * 0.30 +
            index * 1.17
          ) * 0.10
        : 0

    // Every card you pass drops lower in the background,
    // producing a readable descending helix trail.
    const passedDrop =
      isPast
        ? Math.min(distance, 8) * 0.30
        : 0

    const targetY =
      THREE.MathUtils.lerp(
        helixY - passedDrop + historyFloat,
        ACTIVE_CARD_Y,
        focus
      )

    const targetZ =
      THREE.MathUtils.lerp(helixZ, activeZ, focus) +
      radialZ

    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 7.1, delta)
    group.current.position.y = THREE.MathUtils.damp(
      group.current.position.y,
      targetY + Math.sin(state.clock.elapsedTime * 0.52 + index) * (0.018 + focus * 0.03),
      7.1,
      delta,
    )
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, targetZ, 7.1, delta)

    // Past cards are large enough to read as a trail. Future cards are quieter.
    const backgroundScale = isPast ? 0.56 : 0.50
    const depthPulse = Math.min(velocity * 0.003, 0.045) * focus
    const targetScale = (backgroundScale + focus * (1 - backgroundScale) + depthPulse) * (hovered ? 1.055 : 1)
    const scale = THREE.MathUtils.damp(group.current.scale.x, targetScale, 7.2, delta)
    group.current.scale.setScalar(scale)

    // Gentle card animation: rotation + slight scroll-velocity kick.
    const yawKick = THREE.MathUtils.clamp(velocityRef.current * 0.0032, -0.035, 0.035)
    const heroYaw = baseAngle + Math.sin(state.clock.elapsedTime * 0.31 + index) * 0.012 * focus + yawKick * focus
    const heroTilt =
      THREE.MathUtils.lerp(baseTilt, 0, focus) +
      Math.sin(state.clock.elapsedTime * 0.59 + index * 0.8) * 0.009 * focus

    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, heroYaw, 7.0, delta)
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, heroTilt, 7.0, delta)

    // Stronger spiral trail than V9.
    let baseOpacity = 0.08

    if (isPast) {
      // Passed cards remain readable as the history spiral.
      baseOpacity =
        0.22 +
        0.10 * Math.exp(-distance * 0.24)
    } else if (isFuture) {
      baseOpacity =
        0.055 +
        0.09 * Math.exp(-distance * 0.48)
    }

    // Passed cards keep their own readable trail opacity.
    // Current/future cards still obey the visibility window.
    const opacityVisibility =
      isPast
        ? 1
        : visibleWindow

    const opacityTarget =
      (baseOpacity + visualFocus * (0.995 - baseOpacity) + (hovered ? 0.10 : 0)) *
      opacityVisibility *
      (1 - endMix)

    material.current.opacity = THREE.MathUtils.damp(
      material.current.opacity,
      Math.min(1, opacityTarget),
      9.2,
      delta,
    )

    const trailBrightness = isPast ? 0.56 : 0.34
    const brightness = trailBrightness + visualFocus * (1 - trailBrightness)
    material.current.color.setRGB(brightness, brightness, brightness)
    material.current.emissive.set('#7bd3ff')
    material.current.emissiveIntensity = THREE.MathUtils.damp(
      material.current.emissiveIntensity,
      hovered
        ? 0.62
        : isPast
          ? 0.055 + Math.exp(-distance * 0.35) * 0.045
          : visualFocus * 0.16,
      9,
      delta,
    )

    glowMaterial.current.opacity = THREE.MathUtils.damp(
      glowMaterial.current.opacity,
      (
        hovered
          ? 0.34
          : isPast
            ? 0.020 + Math.exp(-distance * 0.42) * 0.020
            : focus * 0.07
      ) * (isPast ? 1 : visibleWindow) * (1 - endMix),
      9,
      delta,
    )

    // A progressive reflection travels across the panel like light catching a
    // turning paper page. The panel stays still; only the soft highlight moves.
    const sweepProgress = smoothstep01(hoverMix)
    const sweepDirection = index % 2 === 0 ? sweepProgress : 1 - sweepProgress
    lightSweep.current.position.x = THREE.MathUtils.lerp(
      -CARD_WIDTH * 0.43,
      CARD_WIDTH * 0.43,
      sweepDirection,
    )
    lightSweep.current.rotation.z = (index % 2 === 0 ? -1 : 1) * 0.10
    lightSweepMaterial.current.opacity =
      Math.sin(sweepProgress * Math.PI) * 0.52 * visibleWindow * (1 - endMix)
    material.current.emissiveIntensity += hoverMix * 0.08

    // Curved / elastic panel deformation. This is subtle at rest and grows slightly with scroll speed.
    if (geometry.current && basePositions.current) {
      const position = geometry.current.attributes.position
      const base = basePositions.current
      const halfWidth = CARD_WIDTH / 2
      const bend = 0.055 + visualFocus * 0.045 + Math.min(velocity * 0.0045, 0.035)
      const ripple = Math.min(velocity * 0.0018, 0.016)

      for (let i = 0; i < position.count; i += 1) {
        const x = base[i * 3]
        const y = base[i * 3 + 1]
        const nx = x / halfWidth
        const z =
          -bend * nx * nx +
          Math.sin(nx * Math.PI + state.clock.elapsedTime * 1.3 + index) * ripple * (1 - Math.abs(nx) * 0.25) +
          y * yawKick * 0.012
        position.setZ(i, z)
      }
      position.needsUpdate = true
    }

    // Transparent sorting: the active / hovered card must visually win.
    const renderOrder = Math.round(20 + visualFocus * 100 + (isPast ? 4 : 0))
    group.current.traverse((child) => {
      if (child.isMesh) child.renderOrder = renderOrder
    })
  })

  return (
    <group
      ref={group}
      position={[baseX, baseY, baseZ]}
      rotation={[0, baseAngle, baseTilt]}
    >
      <mesh position={[0, 0, -0.035]} scale={[1.045, 1.075, 1]}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT, 24, 14]} />
        <meshBasicMaterial
          ref={glowMaterial}
          color="#79d4ff"
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        ref={lightSweep}
        position={[-CARD_WIDTH * 0.43, 0, 0.018]}
        raycast={() => null}
      >
        <planeGeometry args={[0.58, CARD_HEIGHT * 1.04]} />
        <meshBasicMaterial
          ref={lightSweepMaterial}
          color="#d9f4ff"
          map={sweepTexture}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'default'
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(index)
        }}
      >
        <planeGeometry ref={geometry} args={[CARD_WIDTH, CARD_HEIGHT, 24, 14]} />
        <meshStandardMaterial
          ref={material}
          map={texture}
          transparent
          opacity={0}
          roughness={0.86}
          metalness={0}
          emissive="#7bd3ff"
          emissiveIntensity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function HelixDust({ endMixRef }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const count = 300
    const arr = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1)
      const angle = ORBIT_START + t * ORBIT_STEP * (CARD_COUNT - 1)
      const indexFloat = t * (CARD_COUNT - 1)
      const a = Math.floor(indexFloat)
      const b = Math.min(CARD_COUNT - 1, a + 1)
      const local = indexFloat - a
      const y = THREE.MathUtils.lerp(CARD_HEIGHTS[a], CARD_HEIGHTS[b], local)
      const radius = CARD_BASE_RADIUS + indexFloat * 0.10 + Math.sin(indexFloat * 1.3) * 0.16

      arr[i * 3] = Math.sin(angle) * radius
      arr[i * 3 + 1] = y + Math.sin(i * 1.7) * 0.035
      arr[i * 3 + 2] = Math.cos(angle) * radius
    }

    return arr
  }, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.0018
    ref.current.material.opacity = 0.10 * (1 - endMixRef.current)
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#6dc9f5"
        size={0.022}
        transparent
        opacity={0.10}
        depthWrite={false}
      />
    </points>
  )
}

function AmbientParticles({ endMixRef }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const count = 420
    const array = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const radius = 4 + Math.random() * 13
      const angle = Math.random() * Math.PI * 2
      array[i * 3] = Math.sin(angle) * radius
      array[i * 3 + 1] = -2 + Math.random() * 8.5
      array[i * 3 + 2] = Math.cos(angle) * radius
    }

    return array
  }, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.0026
    ref.current.material.opacity = 0.15 + endMixRef.current * 0.035
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#a8e2ff"
        size={0.016}
        transparent
        opacity={0.15}
        depthWrite={false}
      />
    </points>
  )
}


function SpaceStars() {
  const fineRef = useRef()
  const brightRef = useRef()
  const clusterRef = useRef()

  const fineStars = useMemo(() => {
    // Much fewer than the reference photo, but still rich enough to feel like space.
    const count = 520
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const radius = 15 + Math.random() * 38
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] =
        radius * Math.sin(phi) * Math.cos(theta)

      positions[i * 3 + 1] =
        radius * Math.cos(phi)

      positions[i * 3 + 2] =
        radius * Math.sin(phi) * Math.sin(theta)
    }

    return positions
  }, [])

  const brightStars = useMemo(() => {
    const count = 55
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const radius = 14 + Math.random() * 32
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] =
        radius * Math.sin(phi) * Math.cos(theta)

      positions[i * 3 + 1] =
        radius * Math.cos(phi)

      positions[i * 3 + 2] =
        radius * Math.sin(phi) * Math.sin(theta)
    }

    return positions
  }, [])

  const clusterStars = useMemo(() => {
    // A subtle milky blue cluster, inspired by the reference image.
    const count = 120
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2
      const r = Math.pow(Math.random(), 1.7) * 5.2

      positions[i * 3] =
        -4.5 + Math.cos(a) * r * 1.8

      positions[i * 3 + 1] =
        5.0 + Math.sin(a) * r * 0.85

      positions[i * 3 + 2] =
        -23 + (Math.random() - 0.5) * 3.5
    }

    return positions
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    if (fineRef.current) {
      fineRef.current.rotation.y += delta * 0.0015
      fineRef.current.material.opacity =
        0.43 + Math.sin(t * 0.42) * 0.025
    }

    if (brightRef.current) {
      brightRef.current.rotation.y -= delta * 0.0008
      brightRef.current.material.opacity =
        0.70 + Math.sin(t * 0.82) * 0.07
    }

    if (clusterRef.current) {
      clusterRef.current.rotation.z =
        Math.sin(t * 0.035) * 0.012

      clusterRef.current.material.opacity =
        0.34 + Math.sin(t * 0.30) * 0.025
    }
  })

  return (
    <group>
      <points ref={fineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[fineStars, 3]}
          />
        </bufferGeometry>

        <pointsMaterial
          color="#c4ddff"
          size={0.032}
          sizeAttenuation
          transparent
          opacity={0.43}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points ref={brightRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[brightStars, 3]}
          />
        </bufferGeometry>

        <pointsMaterial
          color="#ffffff"
          size={0.078}
          sizeAttenuation
          transparent
          opacity={0.72}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points ref={clusterRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[clusterStars, 3]}
          />
        </bufferGeometry>

        <pointsMaterial
          color="#72b8ff"
          size={0.060}
          sizeAttenuation
          transparent
          opacity={0.34}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}


function BlueSpaceGlow() {
  return (
    <group>
      <mesh
        position={[-10, 6, -22]}
        scale={[12, 8, 1]}
      >
        <planeGeometry args={[1, 1]} />

        <meshBasicMaterial
          color="#0d5f9a"
          transparent
          opacity={0.030}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        position={[13, -4, -26]}
        scale={[15, 10, 1]}
      >
        <planeGeometry args={[1, 1]} />

        <meshBasicMaterial
          color="#136fa8"
          transparent
          opacity={0.045}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}


export default function Experience({
  progressRef,
  onSelectCard,
  entered,
  storyEnd = 0.91,
  finaleStart = 0.947,
}) {
  const hero = useRef()
  const storyStepRef = useRef(0)
  const previousStepRef = useRef(0)
  const velocityRef = useRef(0)
  const endMixRef = useRef(0)
  const cameraDesired = useMemo(() => new THREE.Vector3(), [])
  const cameraTarget = useMemo(() => new THREE.Vector3(), [])

  const layout = useMemo(() => {
    return Array.from({ length: CARD_COUNT }, (_, index) => {
      const angle = ORBIT_START + index * ORBIT_STEP
      // Keep the absolute orbit clean; the ×6 depth spacing is applied
      // dynamically around the currently active card.
      const radius =
        CARD_BASE_RADIUS +
        Math.sin(index * 1.31) * 0.14
      const y = CARD_HEIGHTS[index]
      return { angle, radius, y }
    })
  }, [])

  useFrame((state, delta) => {
    const compactViewport = state.size.width < 760

    if (!entered) {
      storyStepRef.current = 0
      previousStepRef.current = 0
      velocityRef.current = 0
      endMixRef.current = 0

      cameraDesired.set(0, 1.78, compactViewport ? 13.8 : 12.2)
      state.camera.position.lerp(cameraDesired, 1 - Math.exp(-delta * 3.8))
      state.camera.fov = THREE.MathUtils.damp(state.camera.fov, compactViewport ? 46 : 41, 6, delta)
      state.camera.updateProjectionMatrix()
      cameraTarget.set(0, 1.55, 0)
      state.camera.lookAt(cameraTarget)

      if (hero.current) {
        hero.current.rotation.y = THREE.MathUtils.damp(hero.current.rotation.y, 0, 4.5, delta)
        hero.current.scale.setScalar(THREE.MathUtils.damp(hero.current.scale.x, 1, 4.5, delta))
      }
      return
    }

    const pageProgress = clamp01(progressRef.current || 0)
    const storyProgress = clamp01(pageProgress / storyEnd)
    const rawStep = storyProgress * (CARD_COUNT - 1)

    // The scroll is already eased by Lenis. This second, lighter damping pass
    // gives the 3D scene weight while staying close to the user's gesture.
    storyStepRef.current = THREE.MathUtils.damp(
      storyStepRef.current,
      rawStep,
      3.15,
      delta,
    )

    const step = storyStepRef.current
    const rawVelocity = delta > 0 ? (step - previousStepRef.current) / delta : 0
    previousStepRef.current = step
    velocityRef.current = THREE.MathUtils.damp(velocityRef.current, rawVelocity, 6.4, delta)

    const endMix = smoothstep01((pageProgress - finaleStart) / (1 - finaleStart))
    endMixRef.current = THREE.MathUtils.damp(endMixRef.current, endMix, 3.8, delta)
    const finalMix = endMixRef.current

    // CAMERA: follows the 360° ring. Between cards it also rises/falls and banks.
    let cameraAngle = sampleAngle(step)
    const segmentPhase = step - Math.floor(step)
    const transitionPulse = Math.sin(segmentPhase * Math.PI)

    // Two cards IN, two cards OUT, repeated across the timeline.
    // 0 = far, 2 = near, 4 = far, 6 = near ...
    const pairWave = Math.cos(step * Math.PI / 2)

    let cameraRadius =
      CAMERA_MID_RADIUS +
      CAMERA_PAIR_SWING * pairWave -
      CAMERA_TRANSITION_PULSE * transitionPulse
    if (compactViewport) cameraRadius += 1.65

    // More human / less mechanical orbit: small lateral weave and vertical arc.
    cameraAngle += Math.sin(step * Math.PI / 2) * 0.075
    let cameraY =
      1.84 +
      Math.sin(cameraAngle * 1.42) * 0.27 +
      Math.sin(step * Math.PI) * 0.085 +
      transitionPulse * 0.08

    let targetY = 1.49 + Math.sin(cameraAngle * 1.18) * 0.06
    let desiredFov = 41 - (1 - pairWave) * 0.10 - transitionPulse * 0.06
    if (compactViewport) desiredFov += 4.5

    if (finalMix > 0.001) {
      // Complete the visual 360° and settle in front for the final portrait.
      cameraAngle = shortestAngleLerp(cameraAngle, Math.PI * 2, finalMix)
      cameraRadius = THREE.MathUtils.lerp(cameraRadius, 9.45, finalMix)
      cameraY = THREE.MathUtils.lerp(cameraY, 1.76, finalMix)
      targetY = THREE.MathUtils.lerp(targetY, 1.50, finalMix)
      desiredFov = THREE.MathUtils.lerp(desiredFov, 39.2, finalMix)
    }

    cameraDesired.set(
      Math.sin(cameraAngle) * cameraRadius,
      cameraY,
      Math.cos(cameraAngle) * cameraRadius,
    )

    state.camera.position.lerp(cameraDesired, 1 - Math.exp(-delta * 4.55))
    state.camera.fov = THREE.MathUtils.damp(state.camera.fov, desiredFov, 6.0, delta)
    state.camera.updateProjectionMatrix()

    cameraTarget.set(
      state.pointer.x * 0.085,
      targetY + state.pointer.y * 0.042,
      0,
    )
    state.camera.lookAt(cameraTarget)

    // Scroll speed creates a small film-camera bank.
    const bankTarget = THREE.MathUtils.clamp(-velocityRef.current * 0.008, -0.032, 0.032)
    state.camera.rotation.z += bankTarget * (1 - finalMix)

    if (hero.current) {
      // Character rotates against the camera orbit so different sides are clearly revealed.
      const heroTargetRotation = finalMix > 0.001
        ? THREE.MathUtils.lerp(-cameraAngle * 0.42, 0, finalMix)
        : -cameraAngle * 0.42

      hero.current.rotation.y = THREE.MathUtils.damp(
        hero.current.rotation.y,
        heroTargetRotation,
        3.25,
        delta,
      )

      const finalScale = THREE.MathUtils.lerp(1, 1.055, finalMix)
      const heroScale = THREE.MathUtils.damp(hero.current.scale.x, finalScale, 3.4, delta)
      hero.current.scale.setScalar(heroScale)
    }
  })

  return (
    <>
      <color attach="background" args={['#01050d']} />
      <fog attach="fog" args={['#061426', 17, 48]} />

      <BlueSpaceGlow />
      <SpaceStars />

      <ambientLight intensity={0.48} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={3.7}
        color="#dff4ff"
        castShadow
      />
      <spotLight
        position={[-5, 5, -4]}
        intensity={20}
        angle={0.5}
        penumbra={1}
        color="#3aaee9"
      />
      <pointLight
        position={[2, 3, 4]}
        intensity={8}
        distance={14}
        color="#bceaff"
      />

      <group ref={hero}>
        <Boy />
        <Rock />
      </group>

      {entered && (
        <group>
          {layout.map((item, index) => (
            <Card
              key={index}
              index={index}
              storyStepRef={storyStepRef}
              velocityRef={velocityRef}
              endMixRef={endMixRef}
              onSelect={onSelectCard}
              baseAngle={item.angle}
              baseRadius={item.radius}
              baseY={item.y}
            />
          ))}
          <HelixDust endMixRef={endMixRef} />
        </group>
      )}

      <AmbientParticles endMixRef={endMixRef} />

      <ContactShadows
        position={[0, -1.05, 0]}
        opacity={0.38}
        scale={8}
        blur={2.8}
        far={4}
      />
    </>
  )
}

useLoader.preload(STLLoader, assetUrl('models/boy.stl'))
useLoader.preload(STLLoader, assetUrl('models/rockl.stl'))
