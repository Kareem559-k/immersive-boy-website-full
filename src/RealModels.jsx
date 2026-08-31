import { useGLTF } from '@react-three/drei'

// Use these components after you place the final files in /public/models.
// Then replace <PlaceholderBoy /> and <Rock /> in Experience.jsx.

export function RealBoy(props) {
  const { scene } = useGLTF('/models/boy.glb')
  return <primitive object={scene} {...props} />
}

export function RealRock(props) {
  const { scene } = useGLTF('/models/rock.glb')
  return <primitive object={scene} {...props} />
}

useGLTF.preload('/models/boy.glb')
useGLTF.preload('/models/rock.glb')
