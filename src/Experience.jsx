import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'

const CARD_COUNT = 12
const ORBIT_STEP = (Math.PI * 2) / CARD_COUNT // 30°: one clean 360° orbit
const ORBIT_START = 0.08

const CARD_WIDTH = 3.35
const CARD_HEIGHT = 1.885

// Wider than V9 but still inside the camera. This keeps several cards readable at once.
const CARD_BASE_RADIUS = 6.55
const CARD_RADIUS_PITCH = 0.10
const ACTIVE_CARD_RADIUS = 6.20
const ACTIVE_CARD_Y = 2.34

// A true rising helix: every card advances around the character and climbs at
// the same time. Small waves keep the layout organic without breaking the line.
const CARD_HEIGHTS = [
  0.52, 0.82, 1.16, 1.58,
  1.95, 2.38, 2.82, 3.20,
  3.62, 3.94, 4.25, 4.56,
]

const CAMERA_MID_RADIUS = 11.85
const CAMERA_PAIR_SWING = 0.45 // subtle zoom only
const CAMERA_TRANSITION_PULSE = 0.08

const BOY_HEIGHT = 2.95
const BOY_POSITION = [0, 0.02, 0]
const ROCK_WIDTH = 4.15
const ROCK_POSITION = [0, -0.04, 0]
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
  const { scene } = useGLTF(assetUrl('models/boy.glb'))
  const model = useMemo(() => prepareModel(scene, 'height', BOY_HEIGHT), [scene])

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
  const { scene } = useGLTF(assetUrl('models/rock.glb'))
  const model = useMemo(() => prepareModel(scene, 'width', ROCK_WIDTH), [scene])

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
    const isPast = signedDistance < -0.28
    const isFuture = signedDistance > 0.28

    // Anti-stacking: background cards move sideways along the tangent, not just backward.
    const tangentDirection = Math.tanh(signedDistance * 1.28)
    const tangentAmount = (0.82 + Math.min(distance, 4) * 0.075) * (1 - focus)
    const tangentX = Math.cos(baseAngle) * tangentDirection * tangentAmount
    const tangentZ = -Math.sin(baseAngle) * tangentDirection * tangentAmount

    const activeX = Math.sin(baseAngle) * ACTIVE_CARD_RADIUS
    const activeZ = Math.cos(baseAngle) * ACTIVE_CARD_RADIUS

    // Scroll energy makes the card feel alive, like the reference site.
    const velocity = THREE.MathUtils.clamp(Math.abs(velocityRef.current), 0, 10)
    const breathe = Math.sin(state.clock.elapsedTime * 0.82 + index * 0.73) * 0.045 * focus
    const radialX = Math.sin(baseAngle) * breathe
    const radialZ = Math.cos(baseAngle) * breathe

    const targetX = THREE.MathUtils.lerp(baseX + tangentX, activeX, focus) + radialX
    const targetY = THREE.MathUtils.lerp(baseY, ACTIVE_CARD_Y, focus)
    const targetZ = THREE.MathUtils.lerp(baseZ + tangentZ, activeZ, focus) + radialZ

    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 7.1, delta)
    group.current.position.y = THREE.MathUtils.damp(
      group.current.position.y,
      targetY + Math.sin(state.clock.elapsedTime * 0.52 + index) * (0.018 + focus * 0.03),
      7.1,
      delta,
    )
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, targetZ, 7.1, delta)

    // Past cards are large enough to read as a trail. Future cards are quieter.
    const backgroundScale = isPast ? 0.70 : 0.61
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
    let baseOpacity = 0.10
    if (isPast) {
      baseOpacity = 0.26 + 0.20 * Math.exp(-distance * 0.24)
    } else if (isFuture) {
      baseOpacity = 0.09 + 0.10 * Math.exp(-distance * 0.42)
    }

    const opacityTarget =
      (baseOpacity + visualFocus * (0.995 - baseOpacity) + (hovered ? 0.10 : 0)) *
      (1 - endMix)

    material.current.opacity = THREE.MathUtils.damp(
      material.current.opacity,
      Math.min(1, opacityTarget),
      9.2,
      delta,
    )

    const trailBrightness = isPast ? 0.52 : 0.34
    const brightness = trailBrightness + visualFocus * (1 - trailBrightness)
    material.current.color.setRGB(brightness, brightness, brightness)
    material.current.emissive.set('#7bd3ff')
    material.current.emissiveIntensity = THREE.MathUtils.damp(
      material.current.emissiveIntensity,
      hovered ? 0.62 : visualFocus * 0.16,
      9,
      delta,
    )

    glowMaterial.current.opacity = THREE.MathUtils.damp(
      glowMaterial.current.opacity,
      (hovered ? 0.34 : focus * 0.07) * (1 - endMix),
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
      Math.sin(sweepProgress * Math.PI) * 0.52 * (1 - endMix)
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
    const count = 220
    const arr = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1)
      const angle = ORBIT_START + t * Math.PI * 2
      const indexFloat = t * (CARD_COUNT - 1)
      const a = Math.floor(indexFloat)
      const b = Math.min(CARD_COUNT - 1, a + 1)
      const local = indexFloat - a
      const y = THREE.MathUtils.lerp(CARD_HEIGHTS[a], CARD_HEIGHTS[b], local)
      const radius = CARD_BASE_RADIUS + indexFloat * CARD_RADIUS_PITCH + Math.sin(indexFloat * 1.3) * 0.16

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
      const radius =
        CARD_BASE_RADIUS +
        index * CARD_RADIUS_PITCH +
        Math.sin(index * 1.31) * 0.20
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
      <fog attach="fog" args={['#102d49', 10.6, 30]} />

      <ambientLight intensity={0.58} />
      <directionalLight position={[5, 8, 5]} intensity={3.5} color="#dff3ff" castShadow />
      <spotLight position={[-5, 5, -4]} intensity={18} angle={0.5} penumbra={1} color="#63bde9" />
      <pointLight position={[2, 3, 4]} intensity={7} distance={12} color="#c9ecff" />

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

useGLTF.preload(assetUrl('models/boy.glb'))
useGLTF.preload(assetUrl('models/rock.glb'))
