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

// Monochrome sculpt materials. Tiny value changes preserve readable details
// while keeping the whole character suitable for a white maquette render.
const skin = mat('white_skin_sculpt', '#e7e5df', 0.74)
const skinLight = mat('white_skin_highlight', '#f2f0ea', 0.74)
const hair = mat('white_curly_hair', '#d9d7d1', 0.92)
const hairLight = mat('white_curl_highlight', '#eeece6', 0.9)
const coat = mat('white_woven_robe', '#dedcd5', 0.98)
const coatDark = mat('white_robe_folds', '#cac8c2', 0.98)
const scarf = mat('white_wrapped_scarf', '#d5d3cd', 0.99)
const scarfLight = mat('white_scarf_edges', '#ebe9e3', 0.99)
const eye = mat('sculpted_eye_depth', '#aaa9a5', 0.72)
const eyeWhite = mat('white_eye_sculpt', '#edebe5', 0.72)
const lip = mat('sculpted_lip_depth', '#c2c0ba', 0.88)

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

// Bare lower legs and feet, matching the turnaround sheet.
mesh(capsule, skin, [-.2, .35, 0], [.6, .68, .6], [0, 0, .02], 'left_lower_leg')
mesh(capsule, skin, [.2, .35, 0], [.6, .68, .6], [0, 0, -.02], 'right_lower_leg')
mesh(sphere, skin, [-.21, .105, .12], [.19, .11, .36], [0, 0, 0], 'left_bare_foot')
mesh(sphere, skin, [.21, .105, .12], [.19, .11, .36], [0, 0, 0], 'right_bare_foot')
for (const side of [-1, 1]) {
  for (let toe = 0; toe < 5; toe += 1) {
    mesh(sphere, skinLight, [side * (.11 + toe * .047), .105, .435 - Math.abs(toe - 2) * .012], [.035, .03, .055], [0, 0, 0], `${side < 0 ? 'left' : 'right'}_toe_${toe}`)
  }
}

// Long layered coat and belt
mesh(sphere, coat, [0, 1.42, 0], [.55, .67, .36], [0, 0, 0], 'robe_body')
mesh(new THREE.CylinderGeometry(.36, .55, 1.45, 28), coat, [0, .79, 0], [1, 1, 1], [0, 0, 0], 'long_robe_skirt')
mesh(new THREE.TorusGeometry(.45, .045, 10, 34), coatDark, [0, 1.25, .02], [1, .72, 1], [Math.PI / 2, 0, 0], 'wrapped_cloth_belt')
mesh(new THREE.TorusGeometry(.47, .026, 8, 30), coat, [0, 1.19, .01], [1, .72, 1], [Math.PI / 2, 0, 0], 'second_belt_wrap')

// Vertical cloth folds and irregular hem fringe make the white sculpt readable.
for (let fold = 0; fold < 9; fold += 1) {
  const angle = (fold / 9) * Math.PI * 2
  mesh(new THREE.CapsuleGeometry(.012, .9, 4, 6), coatDark, [Math.sin(angle) * .46, .79, Math.cos(angle) * .28], [.8, 1, .8], [0, angle, 0], `robe_fold_${fold}`)
}
for (let fringe = 0; fringe < 18; fringe += 1) {
  const angle = (fringe / 18) * Math.PI * 2
  const length = .07 + (fringe % 4) * .018
  mesh(new THREE.CapsuleGeometry(.009, length, 3, 5), coat, [Math.sin(angle) * .53, .055, Math.cos(angle) * .31], [1, 1, 1], [0, 0, (fringe % 3 - 1) * .14], `hem_fringe_${fringe}`)
}

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
    mesh(new THREE.TorusGeometry(size * .55, size * .19, 6, 14), hairLight, [x, row.y + Math.sin(angle * 2) * .035, z + size * .65], [1, 1, 1], [angle * .3, angle, angle * .7], `curl_loop_${curlIndex}`)
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
mesh(new THREE.BoxGeometry(.2, .74, .07), scarfLight, [.34, 1.59, .27], [1, 1, 1], [0, 0, .1], 'second_scarf_tail')

// Relaxed wide sleeves and hands at the sides, as in the sculpt sheet.
const sleeveGeometry = new THREE.CylinderGeometry(.25, .18, .92, 20)
mesh(sleeveGeometry, coat, [-.54, 1.35, .01], [1, 1, .82], [0, 0, -.06], 'left_wide_sleeve')
mesh(sleeveGeometry, coat, [.54, 1.35, .01], [1, 1, .82], [0, 0, .06], 'right_wide_sleeve')
mesh(new THREE.TorusGeometry(.2, .022, 7, 24), coatDark, [-.57, .92, .01], [1, .72, 1], [Math.PI / 2, 0, 0], 'left_cuff')
mesh(new THREE.TorusGeometry(.2, .022, 7, 24), coatDark, [.57, .92, .01], [1, .72, 1], [Math.PI / 2, 0, 0], 'right_cuff')
mesh(sphere, skin, [-.57, .76, .025], [.13, .22, .105], [0, 0, 0], 'left_hand')
mesh(sphere, skin, [.57, .76, .025], [.13, .22, .105], [0, 0, 0], 'right_hand')

// Cross-body cloth seam visible in the front view.
mesh(new THREE.CapsuleGeometry(.018, .72, 4, 8), coatDark, [-.03, 1.55, .35], [1, 1, 1], [0, 0, -.72], 'cross_body_seam')

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
