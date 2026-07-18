import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { IntroScreen } from "./IntroScreen";

interface MainMenuScreenProps {
  onStartGame: (selectedShip: {
    name: string;
    hullColor: string;
    maxSpeed: number;
    maxFuel: number;
    handling: number;
  }) => void;
  isMobile: boolean;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({ onStartGame, isMobile }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Scene & Atmosphere
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#020205", 0.00004);

    // 2. Camera
    const initialWidth = window.innerWidth || 800;
    const initialHeight = window.innerHeight || 600;
    const camera = new THREE.PerspectiveCamera(65, initialWidth / initialHeight, 0.1, 50000);

    // 3. Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (e) {
      console.warn("Could not initialize Main Menu WebGLRenderer with antialias, trying standard...", e);
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      } catch (err) {
        console.error("WebGL is unsupported or disabled for Main Menu:", err);
        return;
      }
    }

    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // 4. Lights Setup
    const ambientLight = new THREE.AmbientLight(0x131320);
    scene.add(ambientLight);

    const starColorHex = "#fff5e0"; // Soft warm white/yellow star
    const sunLight = new THREE.PointLight(new THREE.Color(starColorHex), 3.5, 25000, 0.35);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // 5. Sun and Corona Setup
    const sunRadius = 450;
    const sunGeom = new THREE.SphereGeometry(sunRadius, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(starColorHex) });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    scene.add(sunMesh);

    const coronaGeom = new THREE.SphereGeometry(sunRadius * 1.45, 16, 16);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(starColorHex),
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const corona = new THREE.Mesh(coronaGeom, coronaMat);
    scene.add(corona);

    // 6. Starfield Particle Grid (Replicating gameplay starfield)
    const starsCount = 4000;
    const starsGeometry = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(starsCount * 3);
    const starsColors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const r = 24000 + Math.random() * 16000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starsPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starsPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starsPositions[i * 3 + 2] = r * Math.cos(phi);

      const colorVal = Math.random();
      if (colorVal < 0.6) {
        starsColors[i * 3] = 1.0; starsColors[i * 3 + 1] = 1.0; starsColors[i * 3 + 2] = 1.0; // White
      } else if (colorVal < 0.85) {
        starsColors[i * 3] = 0.5; starsColors[i * 3 + 1] = 0.8; starsColors[i * 3 + 2] = 1.0; // Blue
      } else {
        starsColors[i * 3] = 1.0; starsColors[i * 3 + 1] = 0.7; starsColors[i * 3 + 2] = 0.4; // Amber
      }
    }
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starsPositions, 3));
    starsGeometry.setAttribute("color", new THREE.BufferAttribute(starsColors, 3));

    const starCanvas = document.createElement("canvas");
    starCanvas.width = 16;
    starCanvas.height = 16;
    const starCtx = starCanvas.getContext("2d");
    if (starCtx) {
      const grad = starCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      starCtx.fillStyle = grad;
      starCtx.fillRect(0, 0, 16, 16);
    }
    const starTexture = new THREE.CanvasTexture(starCanvas);

    const starsMaterial = new THREE.PointsMaterial({
      size: 40,
      map: starTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // 7. Accretion Swirling Nebulae clouds
    const nebulaGroup = new THREE.Group();
    const nebulaColors = [0x4c1d95, 0x1d4ed8, 0x9f1239, 0xca8a04];
    nebulaColors.forEach((color, idx) => {
      const geometry = new THREE.BoxGeometry(4500, 300, 4500);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.04,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const cloud = new THREE.Mesh(geometry, material);
      cloud.position.set(
        (idx - 1.5) * 8500 + (Math.random() - 0.5) * 3000,
        (Math.random() - 0.5) * 1500,
        (idx - 1.5) * 7000 + (Math.random() - 0.5) * 3000
      );
      cloud.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      nebulaGroup.add(cloud);
    });
    scene.add(nebulaGroup);

    // 8. Animation Loop
    let animationFrameId: number;

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const menuTime = now * 0.00003;
      const orbitRadius = 4500;

      // Base flying camera path
      const baseCamX = Math.cos(menuTime) * orbitRadius + 1500;
      const baseCamY = 250 + Math.sin(menuTime * 1.5) * 120;
      const baseCamZ = Math.sin(menuTime) * orbitRadius + 2000;

      // Weightless breathing hand-held camera float
      const breatheX = Math.sin(now * 0.00095) * 12.0;
      const breatheY = Math.cos(now * 0.00078) * 8.5;
      const breatheZ = Math.sin(now * 0.00115) * 12.0;

      camera.position.set(baseCamX + breatheX, baseCamY + breatheY, baseCamZ + breatheZ);

      // LookAt Sun (0, 100, 0) and dynamic point shifting
      const focalX = Math.sin(menuTime * 0.5) * 600;
      const focalY = 100 + Math.cos(menuTime) * 80;
      const focalZ = 1500 + Math.cos(menuTime * 0.5) * 800;
      camera.lookAt(new THREE.Vector3(focalX, focalY, focalZ));

      // Slowly rotate background nebulae
      nebulaGroup.rotation.y = menuTime * 0.45;
      starField.rotation.y = menuTime * 0.15;

      renderer.render(scene, camera);
    };

    animate();

    // 9. Fully Isolated Memory Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);

      if (mountRef.current) {
        mountRef.current.innerHTML = "";
      }

      scene.clear();
      renderer.dispose();

      // Dispose geometries & materials
      sunGeom.dispose();
      sunMat.dispose();
      coronaGeom.dispose();
      coronaMat.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
      starTexture.dispose();

      nebulaGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full bg-neutral-950 select-none z-40">
      {/* Menu Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0" id="menu_canvas" />
      
      {/* HTML Overlays */}
      <div className="absolute inset-0 z-10 w-full h-full">
        <IntroScreen onStartGame={onStartGame} isMobile={isMobile} />
      </div>
    </div>
  );
};
