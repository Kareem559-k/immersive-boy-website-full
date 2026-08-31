import { readFile, writeFile } from 'node:fs/promises'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'

const inputUrl = new URL('../public/models/boy.stl', import.meta.url)
const outputUrl = new URL('../public/models/boy-clean.stl', import.meta.url)
const input = await readFile(inputUrl)
const arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
const source = new STLLoader().parse(arrayBuffer)
const positions = source.attributes.position
const kept = []

// The supplied STL's circular manufacturing base occupies Z 0..0.072.
// The anatomical feet rise above this plane. Keeping any triangle whose
// centroid clears the base removes the disc while retaining the foot volume.
const BASE_TOP_Z = 0.072
let removedTriangles = 0

for (let index = 0; index < positions.count; index += 3) {
  const centroidZ = (
    positions.getZ(index) +
    positions.getZ(index + 1) +
    positions.getZ(index + 2)
  ) / 3

  if (centroidZ <= BASE_TOP_Z) {
    removedTriangles += 1
    continue
  }

  for (let corner = 0; corner < 3; corner += 1) {
    const vertex = index + corner
    kept.push(
      positions.getX(vertex),
      positions.getY(vertex),
      positions.getZ(vertex),
    )
  }
}

const cleanedGeometry = new THREE.BufferGeometry()
cleanedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3))
cleanedGeometry.computeVertexNormals()
cleanedGeometry.computeBoundingBox()

const mesh = new THREE.Mesh(cleanedGeometry, new THREE.MeshStandardMaterial())
mesh.name = 'ChildWithoutCircularBase'
const result = new STLExporter().parse(mesh, { binary: true })
await writeFile(outputUrl, Buffer.from(result.buffer))

console.log(`Removed ${removedTriangles} base triangles.`)
console.log(`Kept ${kept.length / 9} triangles in public/models/boy-clean.stl.`)
