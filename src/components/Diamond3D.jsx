import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import './Diamond3D.css'

function Diamond3D({ orbit = false, size = 120 }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const animationIdRef = useRef(null)

  useEffect(() => {
    if (!mountRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      50,
      size / size,
      0.1,
      1000
    )
    camera.position.set(0, 0, 120)

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mountRef.current.appendChild(renderer.domElement)

    // Create diamond geometry (octahedron) - larger
    const geometry = new THREE.OctahedronGeometry(30, 0)
    
    // Create realistic diamond material
    const material = new THREE.MeshStandardMaterial({
      color: 0xbc881b,
      metalness: 0.95,
      roughness: 0.05,
      emissive: 0x4d3f1a,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.95,
    })

    // Main diamond
    const diamond = new THREE.Mesh(geometry, material)
    diamond.castShadow = true
    diamond.receiveShadow = true
    scene.add(diamond)

    // Orbit diamond (smaller)
    let orbitDiamond = null
    if (orbit) {
      const orbitGeometry = new THREE.OctahedronGeometry(15, 0)
      const orbitMaterial = new THREE.MeshStandardMaterial({
        color: 0xb47e11,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x3d2f0a,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.9,
      })
      orbitDiamond = new THREE.Mesh(orbitGeometry, orbitMaterial)
      orbitDiamond.castShadow = true
      orbitDiamond.position.x = 50
      scene.add(orbitDiamond)
    }

    // Ground plane for shadows
    const planeGeometry = new THREE.PlaneGeometry(200, 200)
    const planeMaterial = new THREE.ShadowMaterial({ 
      opacity: 0.3,
      color: 0x000000
    })
    const plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.rotation.x = -Math.PI / 2
    plane.position.y = -40
    plane.receiveShadow = true
    scene.add(plane)

    // Add realistic lights with shadows
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    // Main key light (bright golden)
    const keyLight = new THREE.DirectionalLight(0xfef1a2, 2)
    keyLight.position.set(60, 60, 60)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 2048
    keyLight.shadow.mapSize.height = 2048
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 200
    keyLight.shadow.camera.left = -50
    keyLight.shadow.camera.right = 50
    keyLight.shadow.camera.top = 50
    keyLight.shadow.camera.bottom = -50
    scene.add(keyLight)

    // Fill light (softer golden)
    const fillLight = new THREE.DirectionalLight(0xbc881b, 1.2)
    fillLight.position.set(-40, 30, 50)
    fillLight.castShadow = true
    scene.add(fillLight)

    // Rim light (backlight for sparkle)
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.5)
    rimLight.position.set(0, 0, -80)
    scene.add(rimLight)

    // Point lights for sparkle effect
    const pointLight1 = new THREE.PointLight(0xfef1a2, 2, 100)
    pointLight1.position.set(30, 30, 30)
    pointLight1.castShadow = true
    scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0xbc881b, 1.5, 100)
    pointLight2.position.set(-30, -30, 30)
    pointLight2.castShadow = true
    scene.add(pointLight2)

    // Spotlight for dramatic effect
    const spotLight = new THREE.SpotLight(0xffffff, 3, 100, Math.PI / 6, 0.5, 2)
    spotLight.position.set(0, 50, 50)
    spotLight.target.position.set(0, 0, 0)
    spotLight.castShadow = true
    scene.add(spotLight)
    scene.add(spotLight.target)

    // Animation
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)

      // Rotate main diamond smoothly around all axes
      diamond.rotation.x += 0.008
      diamond.rotation.y += 0.01
      diamond.rotation.z += 0.005

      // Rotate orbit diamond
      if (orbitDiamond) {
        orbitDiamond.rotation.x -= 0.012
        orbitDiamond.rotation.y -= 0.015
        // Orbit around main diamond
        const time = Date.now() * 0.001
        orbitDiamond.position.x = Math.cos(time) * 50
        orbitDiamond.position.z = Math.sin(time) * 50
        orbitDiamond.position.y = Math.sin(time * 0.5) * 10
      }

      // Animate point lights for sparkle
      const time = Date.now() * 0.001
      pointLight1.position.x = Math.sin(time) * 40
      pointLight1.position.y = Math.cos(time) * 40
      pointLight2.position.x = Math.cos(time) * -40
      pointLight2.position.y = Math.sin(time) * -40

      renderer.render(scene, camera)
    }
    animate()

    // Cleanup
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      planeGeometry.dispose()
      planeMaterial.dispose()
      if (orbitDiamond) {
        orbitDiamond.geometry.dispose()
        orbitDiamond.material.dispose()
      }
    }
  }, [size, orbit])

  return <div ref={mountRef} className="diamond-3d-wrapper" style={{ width: size, height: size }}></div>
}

export default Diamond3D

