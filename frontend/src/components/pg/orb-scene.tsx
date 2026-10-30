import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Free-floating 3D orb widget. Transparent canvas, no card, no background.
 * It fills its parent, so size/position the parent however you like.
 * Needs: npm i three && npm i -D @types/three
 */
type Props = { speed?: number; className?: string };

function envCanvas() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#eaf6ff"); gr.addColorStop(0.45, "#9cc4e8");
  gr.addColorStop(0.52, "#10131f"); gr.addColorStop(0.6, "#c9d4ee"); gr.addColorStop(1, "#8fb0dc");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#fff";
  const rects: [number, number, number, number][] = [
    [120, 80, 220, 60],
    [560, 60, 260, 50],
    [850, 110, 120, 80],
  ];
  rects.forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  g.fillStyle = "#0a0c16"; g.fillRect(380, 150, 90, 170); g.fillRect(0, 250, 1024, 22);
  g.fillStyle = "#6f8fb8"; g.fillRect(700, 200, 200, 120);
  return c;
}

function coinTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3b5a9a"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#cfe0ff"; g.lineWidth = 14; g.lineCap = "round";
  g.beginPath(); g.moveTo(128, 128);
  g.bezierCurveTo(150, 80, 215, 80, 215, 128); g.bezierCurveTo(215, 176, 150, 176, 128, 128);
  g.bezierCurveTo(106, 80, 41, 80, 41, 128); g.bezierCurveTo(41, 176, 106, 176, 128, 128);
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(20,35,70,.45)"); gr.addColorStop(1, "rgba(20,35,70,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * Generates a soft, cohesive periwinkle-lavender radial gradient texture
 * for the inner platform socket to match PoisonGuard's brand palette.
 */
function socketTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const rad = g.createRadialGradient(256, 256, 12, 256, 256, 256);
  // Soft periwinkle center blending to lavender and subtle sky rim
  rad.addColorStop(0, "rgba(125, 148, 223, 0.75)");
  rad.addColorStop(0.55, "rgba(141, 166, 244, 0.65)");
  rad.addColorStop(0.82, "rgba(169, 154, 246, 0.55)");
  rad.addColorStop(1, "rgba(207, 224, 251, 0.7)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function OrbScene({ speed = 1, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

    const envTex = new THREE.CanvasTexture(envCanvas());
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;

    // Balanced lighting: soft ambient + softened key light + gentle fill light
    scene.add(new THREE.AmbientLight(0xedf1ff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-4, 8, 5);
    scene.add(sun);
    const fillLight = new THREE.DirectionalLight(0xdbe4ff, 0.6);
    fillLight.position.set(5, -2, -2);
    scene.add(fillLight);

    const world = new THREE.Group(); world.rotation.y = -0.5; scene.add(world);

    // Floating socket plate (harmonized with PoisonGuard soft blue/lavender theme)
    const wellTex = socketTexture();
    const lav = new THREE.MeshStandardMaterial({
      color: 0xdde4f7,
      roughness: 0.45,
      metalness: 0.05,
      transparent: true,
      opacity: 0.72,
    });
    const glassRim = new THREE.MeshStandardMaterial({
      color: 0xc4d4f6,
      roughness: 0.36,
      metalness: 0.06,
      transparent: true,
      opacity: 0.65,
    });
    const wellRim = new THREE.MeshStandardMaterial({
      color: 0xa6b8f2,
      roughness: 0.34,
      metalness: 0.08,
      transparent: true,
      opacity: 0.72,
    });
    const wellMat = new THREE.MeshStandardMaterial({
      map: wellTex,
      roughness: 0.45,
      metalness: 0.06,
      transparent: true,
      opacity: 0.85,
    });

    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 64), lav);
    const well = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), wellMat);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.085, 16, 64), glassRim);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.11, 16, 64), wellRim);
    [disc, well, ring1, ring2].forEach((m) => { m.rotation.x = -Math.PI / 2; world.add(m); });
    disc.position.y = 0.02; well.position.y = 0.03; ring1.position.y = 0.055; ring2.position.y = 0.09;

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05; world.add(shadow);

    // Dark glassy steel ball with live reflection
    const steel = new THREE.MeshPhysicalMaterial({
      color: 0x3b434e, metalness: 1, roughness: 0.06, envMapIntensity: 1.6,
      clearcoat: 1, clearcoatRoughness: 0.02,
    });
    const orb = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), steel);
    orb.add(ball); world.add(orb);

    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCam = new THREE.CubeCamera(0.1, 60, cubeRT);
    scene.add(cubeCam);
    steel.envMap = cubeRT.texture;

    // Coin
    const coinFace = new THREE.MeshStandardMaterial({ map: coinTexture(), metalness: 0.8, roughness: 0.2 });
    const coinSide = new THREE.MeshStandardMaterial({ color: 0x9fb4d8, metalness: 1, roughness: 0.15 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.14, 64), [coinSide, coinFace, coinFace]);
    world.add(coin);

    let mx = 0, my = 0;
    const onMove = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    window.addEventListener("pointermove", onMove);

    const resize = () => {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();

    let visible = true;
    const io = new IntersectionObserver(([e]) => { if (e) visible = e.isIntersecting; }); io.observe(host);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    let raf = 0, frame = 0, camY = 4.8;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const t = still ? 0 : clock.getElapsedTime() * speed;

      // vertical drop into socket, small orbit that closes as it lands, spin on own axis
      const k = (Math.sin(t * 1.1) + 1) / 2, e = k * k * (3 - 2 * k);
      const ang = t * 1.2, R = 0.6 * e;
      orb.position.set(Math.cos(ang) * R, 1.05 + e * 2.2, Math.sin(ang) * R);
      orb.scale.set(1 + (1 - e) * 0.04, 1 - (1 - e) * 0.06, 1 + (1 - e) * 0.04);
      ball.rotation.y = t * 1.3; ball.rotation.x = t * 0.5;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 1 - e * 0.7;
      shadow.scale.setScalar(1 - e * 0.35);

      coin.position.set(0, 4.6 + Math.sin(t * 1.3) * 0.25, 0);
      coin.rotation.set(Math.PI / 2 + Math.sin(t * 0.8) * 0.5, t * 0.9, Math.sin(t * 0.6) * 0.4);

      world.rotation.y += (-0.5 + mx * 0.5 - world.rotation.y) * 0.05;
      camY += (4.8 - my * 0.8 - camY) * 0.05;
      cam.position.set(0, camY, 11.6); cam.lookAt(0, 2.7, 0);

      if ((frame++ & 1) === 0) {            // refresh live reflection every 2nd frame
        ball.visible = false; world.updateMatrixWorld(true);
        cubeCam.position.copy(ball.getWorldPosition(tmp));
        scene.background = envTex; cubeCam.update(renderer, scene); scene.background = null;
        ball.visible = true;
      }
      renderer.render(scene, cam);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      window.removeEventListener("pointermove", onMove);
      wellTex.dispose();
      renderer.dispose(); cubeRT.dispose(); pmrem.dispose();
      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [speed]);

  return <div ref={ref} className={className} style={{ width: "100%", height: "100%" }} aria-hidden />;
}
