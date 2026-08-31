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
const rock = new THREE.Group()
rock.name = 'DarkRuggedPedestal'
scene.add(rock)

const stone = new THREE.MeshStandardMaterial({
  name: 'charcoal_rough_stone',
  color: '#171918',
  roughness: 1,
  metalness: 0,
})
const stoneEdge = new THREE.MeshStandardMaterial({
  name: 'raised_stone_edges',
  color: '#272925',
  roughness: .96,
  metalness: 0,
})
const crevice = new THREE.MeshStandardMaterial({
  name: 'deep_crevices',
  color: '#090b0a',
  roughness: 1,
  metalness: 0,
})

function distortRockGeometry(geometry, phase = 0, plateau = true) {
  const position = geometry.attributes.position
  const vector = new THREE.Vector3()

  for (let index = 0; index < position.count; index += 1) {
    vector.fromBufferAttribute(position, index)
    const noise =
      Math.sin(vector.x * 7.7 + phase) * .09 +
      Math.sin(vector.y * 11.3 - phase * .8) * .055 +
      Math.cos(vector.z * 9.1 + phase * 1.4) * .075
    vector.multiplyScalar(1 + noise)
    vector.x *= 1.9
    vector.y *= .72
    vector.z *= 1.2

    // Broad, stable top for both bare feet while preserving broken edges.
    if (plateau && vector.y > .27) {
      vector.y = .31 + (vector.y - .27) * .045
    }
    if (vector.y < -.48) vector.y = -.48 + (vector.y + .48) * .12
    position.setXYZ(index, vector.x, vector.y, vector.z)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}

function addMesh(geometry, material, position, scale, rotation, name) {
  const item = new THREE.Mesh(geometry, material)
  item.name = name
  item.position.set(...position)
  item.scale.set(...scale)
  item.rotation.set(...rotation)
  item.castShadow = true
  item.receiveShadow = true
  rock.add(item)
}

const coreGeometry = distortRockGeometry(new THREE.IcosahedronGeometry(1, 5), .3, true)
addMesh(coreGeometry, stone, [0, 0, 0], [1, 1, 1], [0, .08, 0], 'main_rock_mass')

// Embedded angular plates make the silhouette read as a natural boulder.
const plates = [
  [-1.25, -.03, .63, .55, .32, .21, -.16, .2, -.12],
  [-.72, -.24, .91, .46, .24, .18, .13, -.34, .08],
  [.72, -.05, .9, .6, .28, .19, -.1, .28, .15],
  [1.3, -.2, .42, .42, .35, .24, .12, -.2, -.1],
  [-1.05, .02, -.65, .5, .3, .2, .16, .1, .2],
  [.95, -.08, -.72, .54, .27, .22, -.14, -.25, -.12],
]
plates.forEach(([x, y, z, sx, sy, sz, rx, ry, rz], index) => {
  const geometry = distortRockGeometry(new THREE.IcosahedronGeometry(1, 2), index + 2.1, false)
  addMesh(geometry, index % 2 ? stoneEdge : stone, [x, y, z], [sx, sy, sz], [rx, ry, rz], `stone_plate_${index}`)
})

// Dark recessed seams add depth without relying on an image texture.
for (let index = 0; index < 11; index += 1) {
  const angle = index * 2.399
  const radius = 1.05 + (index % 3) * .16
  const length = .24 + (index % 4) * .055
  const seam = new THREE.Mesh(new THREE.CapsuleGeometry(.018, length, 4, 7), crevice)
  seam.name = `rock_crevice_${index}`
  seam.position.set(Math.sin(angle) * radius, -.05 + Math.sin(index * 1.7) * .23, Math.cos(angle) * .72 + .64)
  seam.rotation.set(angle * .13, angle, angle * .37)
  seam.castShadow = true
  rock.add(seam)
}

rock.updateMatrixWorld(true)
const exporter = new GLTFExporter()
const result = await exporter.parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  truncateDrawRange: true,
})

await writeFile(new URL('../public/models/rock-reference.glb', import.meta.url), Buffer.from(result))
console.log('Created public/models/rock-reference.glb')
