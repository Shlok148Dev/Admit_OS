'use client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sphere, Billboard, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useRef, useMemo, useState, Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { useTrendStore } from '@/store/trends'

// --- Utility: lat/lon to 3D point on unit sphere ---
function latLonToVec3(
  lat: number, lon: number, radius = 1
): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta),
  )
}

// --- Platform coordinates ---
const PLATFORM_COORDS: Record<string, [number, number]> = {
  reddit:      [37, -95],
  twitter:     [40, -74],
  discord:     [48,   2],
  hackernews:  [37, -122],
  tiktok:      [22,  114],
  youtube:     [37, -122],
  default:     [51,   0],
}

// --- Globe mesh with custom shader ---
function GlobeMesh() {
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vPosition;
      uniform float uTime;

      void main() {
        vec3 baseColor = vec3(0.02, 0.02, 0.08);

        // Grid lines
        float gridX = abs(sin(vUv.x * 80.0));
        float gridY = abs(sin(vUv.y * 40.0));
        float grid  = max(
          step(0.97, gridX),
          step(0.97, gridY)
        ) * 0.06;

        // Fresnel glow on edges
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
        vec3 glowColor = vec3(0.39, 0.4, 0.945);

        vec3 col = baseColor
          + grid * glowColor
          + fresnel * glowColor * 0.6;

        gl_FragColor = vec4(col, 0.95);
      }
    `,
    transparent: true,
    side: THREE.FrontSide,
  }), [])

  useFrame(({ clock }) => {
    if (material.uniforms.uTime)
      material.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  )
}

// --- Atmosphere ---
function Atmosphere() {
  return (
    <mesh scale={[1.05, 1.05, 1.05]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color="#6366f1"
        transparent
        opacity={0.04}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

// --- Trend Nodes ---
function TrendNodes() {
  const trends = useTrendStore(s => s.trends)

  return (
    <>
      {trends.map((trend, i) => {
        const platform = trend.platforms?.[0] ?? 'default'
        const [lat, lon] = PLATFORM_COORDS[platform] ?? PLATFORM_COORDS.default
        const pos = latLonToVec3(lat, lon, 1.01)

        const color =
          trend.status === 'emerging'
            ? '#10b981'
            : trend.status === 'trending'
            ? '#f59e0b'
            : '#ef4444'

        const baseSize = 0.012 + (trend.virality_score / 100) * 0.03

        return (
          <TrendNode
            key={trend.id}
            position={pos}
            color={color}
            size={baseSize}
            trend={trend}
            index={i}
          />
        )
      })}
    </>
  )
}

function TrendNode({ position, color, size, trend, index }: any) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const selectTrend = useTrendStore(s => s.selectTrend)

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime
    const pulse = 1 + Math.sin(t * 2 + index) * 0.25
    const target = hovered ? 2.2 : pulse
    meshRef.current.scale.setScalar(
      THREE.MathUtils.lerp(
        meshRef.current.scale.x, target, 0.1
      )
    )
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => selectTrend(trend.id)}
    >
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 2 : 0.8}
        transparent
        opacity={0.9}
      />
      {hovered && (
        <Html distanceFactor={8} center>
          <div style={{
            background: 'rgba(12,12,20,0.95)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: 12,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 600 }}>
              {trend.name}
            </div>
            <div style={{ color: '#94a3b8', marginTop: 2 }}>
              Virality: {trend.virality_score}
            </div>
          </div>
        </Html>
      )}
    </mesh>
  )
}

// --- Ambient particles ---
function Particles({ count = 300 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r = 1.5 + Math.random() * 1.5
      arr[i*3]   = r*Math.sin(phi)*Math.cos(theta)
      arr[i*3+1] = r*Math.cos(phi)
      arr[i*3+2] = r*Math.sin(phi)*Math.sin(theta)
    }
    return arr
  }, [count])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.008}
        color="#ffffff"
        transparent
        opacity={0.2}
        sizeAttenuation
      />
    </points>
  )
}

// --- Main export ---
export default function TrendGlobe({
  interactive = true,
  opacity = 1,
}: {
  interactive?: boolean
  opacity?: number
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        opacity,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.15} />
        <pointLight
          position={[5, 5, 5]}
          intensity={0.6}
          color="#6366f1"
        />
        <pointLight
          position={[-5, -3, -5]}
          intensity={0.3}
          color="#8b5cf6"
        />

        <Suspense fallback={null}>
          <GlobeMesh />
          <Atmosphere />
          <TrendNodes />
          <Particles />
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.4}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={(Math.PI * 2) / 3}
          enabled={interactive}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.15}
            luminanceSmoothing={0.9}
            intensity={1.2}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
