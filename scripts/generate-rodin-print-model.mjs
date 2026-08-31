import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

const API = 'https://api.hyper3d.com/api/v2'
const projectRoot = resolve(import.meta.dirname, '..')

async function loadLocalEnv() {
  const text = await readFile(resolve(projectRoot, '.env.local'), 'utf8')
  return Object.fromEntries(
    text.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
      }),
  )
}

const env = await loadLocalEnv()
const apiKey = env.HYPER3D_API_KEY
const imagePaths = process.argv.slice(2).map((path) => resolve(path))

if (!apiKey) {
  throw new Error('HYPER3D_API_KEY is empty in .env.local')
}
if (imagePaths.length < 1 || imagePaths.length > 5) {
  throw new Error('Pass one to five reference image paths.')
}

// Extreme High + micro geometry costs 1.0 credit according to the current
// Gen-2.5 documentation. No texture is requested for this white print sculpt.
if (env.RODIN_CONFIRM_SPEND !== 'YES') {
  console.log('Prepared Rodin Gen-2.5 Extreme High request.')
  console.log('Expected charge: 1.0 credit (confirm current UI/account pricing).')
  console.log('Set RODIN_CONFIRM_SPEND=YES in .env.local to submit it.')
  process.exit(0)
}

const prompt = `Museum-quality realistic young child statue for resin printing, matching all supplied views consistently. Natural child facial anatomy, eyelids, eye sockets, nose, lips, cheeks, chin and ears; dense connected tight curls; barefoot upright pose, arms relaxed at sides. Long layered traditional robe with thick real geometric folds, durable distressed hem, wrapped scarf and cloth belt. Massive natural rock pedestal with deliberate geological layers and cracks, flat bottom. Feet permanently fused to rock. One watertight closed manifold solid; outward normals; no holes, floating parts, internal shells or thin surfaces. Reinforce curls, fingers, toes, scarf and cloth ends. Preserve pose, age, proportions, costume and hairstyle. No accessories. White untextured printable sculpt.`

const form = new FormData()
for (const imagePath of imagePaths) {
  const bytes = await readFile(imagePath)
  const extension = extname(imagePath).toLowerCase()
  const mime = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'image/png'
  form.append('images', new Blob([bytes], { type: mime }), basename(imagePath))
}
form.append('prompt', prompt)
form.append('tier', 'Gen-2.5-Extreme-High')
form.append('mesh_mode', 'Raw')
form.append('quality_override', '2000000')
form.append('geometry_file_format', 'glb')
form.append('material', 'None')
form.append('TAPose', 'false')
form.append('preview_render', 'true')
form.append('is_symmetric', 'balanced')
form.append('is_micro', 'true')
form.append('geometry_instruct_mode', 'faithful')

const headers = { Authorization: `Bearer ${apiKey}` }
const generationResponse = await fetch(`${API}/rodin`, { method: 'POST', headers, body: form })
const generation = await generationResponse.json()
if (!generationResponse.ok || generation.error || !generation.uuid) {
  throw new Error(`Rodin submission failed: ${JSON.stringify(generation)}`)
}

console.log(`Submitted task ${generation.uuid}; consumed ${generation.consumed ?? 'unknown'} credits.`)
const startedAt = Date.now()
let delay = 5000
while (true) {
  if (Date.now() - startedAt > 30 * 60 * 1000) throw new Error('Rodin timed out after 30 minutes.')
  await new Promise((resolveDelay) => setTimeout(resolveDelay, delay))
  const statusResponse = await fetch(`${API}/status`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription_key: generation.jobs.subscription_key }),
  })
  const status = await statusResponse.json()
  const states = (status.jobs ?? []).map((job) => job.status)
  console.log(`Status: ${states.join(', ') || 'waiting'}`)
  if (states.includes('Failed')) throw new Error(`Rodin generation failed: ${JSON.stringify(status)}`)
  if (states.length && states.every((state) => state === 'Done')) break
  delay = Math.min(delay + 5000, 30000)
}

const downloadResponse = await fetch(`${API}/download`, {
  method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ task_uuid: generation.uuid }),
})
const downloads = await downloadResponse.json()
if (!downloadResponse.ok) throw new Error(`Download lookup failed: ${JSON.stringify(downloads)}`)

const files = downloads.list ?? downloads.files ?? downloads
const candidates = Array.isArray(files) ? files : Object.values(files).flat()
const modelEntry = candidates.find((entry) => {
  const url = typeof entry === 'string' ? entry : entry?.url
  return url?.toLowerCase().includes('.glb')
})
const modelUrl = typeof modelEntry === 'string' ? modelEntry : modelEntry?.url
if (!modelUrl) {
  await writeFile(resolve(projectRoot, 'rodin-download-response.json'), JSON.stringify(downloads, null, 2))
  throw new Error('No GLB URL found; response saved to rodin-download-response.json')
}

const modelResponse = await fetch(modelUrl)
if (!modelResponse.ok) throw new Error(`Model download failed: HTTP ${modelResponse.status}`)
await mkdir(resolve(projectRoot, 'public', 'models'), { recursive: true })
await writeFile(
  resolve(projectRoot, 'public', 'models', 'boy-rock-rodin.glb'),
  Buffer.from(await modelResponse.arrayBuffer()),
)
console.log('Saved public/models/boy-rock-rodin.glb')
