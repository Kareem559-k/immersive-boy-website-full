import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { writeFile } from 'node:fs/promises'

globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`
      this.onloadend?.()
    })
  }
}

const scene = new THREE.Scene()
const boy = new THREE.Group()
boy.name = 'ReferenceBoy'
scene.add(boy)

const mat = (name, color, roughness = 0.82) => {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })
  material.name = name
  return material
}

const skin = mat('sun_warmed_skin', '#a96d4e', 0.72)
const skinLight = mat('skin_highlight', '#c48763', 0.76)
const hair = mat('curly_hair_dark', '#5a3a24', 0.94)
const hairLight = mat('sunlit_curls', '#9a7048', 0.92)
const coat = mat('dusty_coat', '#776856', 0.98)
const coatDark = mat('coat_shadows', '#4e4439', 0.98)
const scarf = mat('wrapped_scarf', '#5b5147', 0.99)
const scarfLight = mat('scarf_edges', '#7b6c5b', 0.99)
const sack = mat('woven_sack', '#a79578', 1)
const sackLight = mat('sunlit_sack', '#bcaa8b', 1)
const sackDark = mat('sack_folds', '#74654f', 1)
const eye = mat('eyes', '#241711', 0.35)
const eyeWhite = mat('eye_whites', '#ddd1bd', 0.7)
const lip = mat('lips', '#744638', 0.88)

function mesh(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], name = '') {
  const item = new THREE.Mesh(geometry, material)
  item.position.set(...position)
  item.scale.set(...scale)
  item.rotation.set(...rotation)
  item.name = name
  item.castShadow = true
  item.receiveShadow = true
  boy.add(item)
  return item
}

const sphere = new THREE.SphereGeometry(1, 24, 18)
const softSphere = new THREE.IcosahedronGeometry(1, 2)
const capsule = new THREE.CapsuleGeometry(.16, .62, 8, 16)
const torus = new THREE.TorusGeometry(.44, .105, 12, 32)

// Feet and legs
mesh(capsule, coatDark, [-.2, .48, 0], [.72, .82, .72], [0, 0, .02], 'left_leg')
mesh(capsule, coatDark, [.2, .48, 0], [.72, .82, .72], [0, 0, -.02], 'right_leg')
mesh(sphere, coatDark, [-.22, .13, .09], [.25, .13, .43], [0, 0, 0], 'left_boot')
mesh(sphere, coatDark, [.22, .13, .09], [.25, .13, .43], [0, 0, 0], 'right_boot')

// Long layered coat and belt
mesh(sphere, coat, [0, 1.15, 0], [.57, .88, .38], [0, 0, 0], 'coat_body')
mesh(new THREE.CylinderGeometry(.37, .54, 1.12, 20), coat, [0, .9, 0], [1, 1, 1], [0, 0, 0], 'coat_skirt')
mesh(new THREE.TorusGeometry(.46, .035, 8, 28), coatDark, [0, 1.05, .02], [1, .72, 1], [Math.PI / 2, 0, 0], 'cloth_belt')

// Head, cheeks, ears and facial planes
mesh(sphere, skin, [0, 2.26, .02], [.43, .52, .4], [0, 0, 0], 'head')
mesh(sphere, skinLight, [-.31, 2.2, .31], [.16, .14, .08], [0, 0, 0], 'left_cheek')
mesh(sphere, skinLight, [.31, 2.2, .31], [.16, .14, .08], [0, 0, 0], 'right_cheek')
mesh(sphere, skin, [-.43, 2.28, 0], [.1, .17, .08], [0, 0, 0], 'left_ear')
mesh(sphere, skin, [.43, 2.28, 0], [.1, .17, .08], [0, 0, 0], 'right_ear')
mesh(sphere, skinLight, [0, 2.23, .4], [.085, .13, .11], [0, 0, 0], 'nose')

// Eyes, brows and mouth
for (const side of [-1, 1]) {
  mesh(sphere, eyeWhite, [side * .17, 2.35, .365], [.105, .055, .035], [0, 0, 0], side < 0 ? 'left_eye_white' : 'right_eye_white')
  mesh(sphere, eye, [side * .17, 2.35, .397], [.044, .048, .024], [0, 0, 0], side < 0 ? 'left_eye' : 'right_eye')
  mesh(new THREE.CapsuleGeometry(.018, .13, 4, 8), hair, [side * .17, 2.46, .385], [1, 1, 1], [0, 0, Math.PI / 2 + side * .05], 'eyebrow')
}
mesh(new THREE.CapsuleGeometry(.018, .13, 4, 8), lip, [0, 2.08, .39], [1, 1, 1], [0, 0, Math.PI / 2], 'mouth')

// Dense irregular curls based on the reference silhouette.
const curlRows = [
  { y: 2.68, count: 9, radius: .38 },
  { y: 2.82, count: 8, radius: .32 },
  { y: 2.92, count: 6, radius: .24 },
]
let curlIndex = 0
for (const row of curlRows) {
  for (let i = 0; i < row.count; i += 1) {
    const angle = (i / row.count) * Math.PI * 2 + row.y
    const x = Math.cos(angle) * row.radius
    const z = Math.sin(angle) * row.radius * .72 - .02
    const size = .105 + ((i * 7 + curlIndex * 3) % 5) * .012
    mesh(softSphere, (i + curlIndex) % 3 === 0 ? hairLight : hair, [x, row.y + Math.sin(angle * 2) * .035, z], [size, size * .92, size], [angle, angle * .4, 0], `curl_${curlIndex++}`)
  }
}
for (let i = 0; i < 7; i += 1) {
  const x = -.29 + i * .095
  mesh(softSphere, i % 2 ? hair : hairLight, [x, 2.7 + Math.sin(i) * .035, .31], [.105, .09, .1], [i, 0, 0], `front_curl_${i}`)
}

// Layered scarf rings and hanging ends
mesh(torus, scarf, [0, 1.93, .01], [1.18, 1, 1], [Math.PI / 2, 0, .08], 'scarf_lower')
mesh(torus, scarfLight, [0, 2.02, .02], [1.08, .94, 1], [Math.PI / 2, .05, -.06], 'scarf_middle')
mesh(torus, scarf, [0, 2.1, .01], [.97, .88, 1], [Math.PI / 2, -.04, .04], 'scarf_upper')
mesh(new THREE.BoxGeometry(.25, .72, .08), scarf, [-.34, 1.62, .29], [1, 1, 1], [0, 0, -.12], 'scarf_tail')

// Large cloth bundle carried across the body.
mesh(softSphere, sack, [-.45, 1.18, .43], [.68, .72, .5], [0, 0, -.2], 'cloth_bundle')
mesh(softSphere, sackLight, [-.62, 1.45, .51], [.35, .25, .34], [0, 0, .1], 'bundle_top')
for (let i = 0; i < 5; i += 1) {
  mesh(new THREE.TorusGeometry(.42 - i * .035, .018, 5, 24, Math.PI * 1.25), sackDark, [-.48, 1.12 + i * .13, .72], [1, .7, 1], [0, 0, -.35], `sack_fold_${i}`)
}

// Arms hug the bundle; hands remain visible like the reference.
mesh(capsule, coat, [-.48, 1.45, .42], [.78, 1.05, .78], [0, 0, -.72], 'left_arm')
mesh(capsule, coat, [.43, 1.36, .4], [.78, 1.08, .78], [0, 0, .7], 'right_arm')
mesh(sphere, skin, [-.08, 1.2, .78], [.17, .12, .1], [0, 0, -.1], 'left_hand')
mesh(sphere, skin, [.2, 1.1, .72], [.18, .12, .1], [0, 0, .15], 'right_hand')

// Shoulder strap across the coat.
mesh(new THREE.TorusGeometry(.72, .035, 6, 32, Math.PI * 1.05), sackDark, [.02, 1.63, .05], [1, .72, 1], [1.58, .22, -.8], 'shoulder_strap')

boy.rotation.y = 0
boy.updateMatrixWorld(true)

const exporter = new GLTFExporter()
const result = await exporter.parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  truncateDrawRange: true,
})

await writeFile(new URL('../public/models/boy-reference.glb', import.meta.url), Buffer.from(result))
console.log('Created public/models/boy-reference.glb')
