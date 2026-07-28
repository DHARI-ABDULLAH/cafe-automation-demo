/* ==========================================================================
   Hayl — cup3d.js
   Interactive 3D coffee cup (Three.js r128, primitive geometry only).
   Falls back to the SVG illustration when WebGL is unavailable.
   ========================================================================== */

(function () {
  "use strict";

  var container = document.getElementById("cup3d");
  if (!container || typeof THREE === "undefined") return;

  var hero = document.querySelector(".hero");
  var wrap = container.closest(".cup3d-wrap");
  var heroVisual = container.closest(".hero-visual");

  var REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COARSE_POINTER = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  /* ---------- Helpers ---------- */

  function cssColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function hasWebGL() {
    try {
      var test = document.createElement("canvas");
      return !!(test.getContext("webgl") || test.getContext("experimental-webgl"));
    } catch (err) {
      return false;
    }
  }

  // Canvas sizes aligned with styles.css — balanced against the ~340px ticket.
  function canvasSize() {
    var w = window.innerWidth;
    if (w >= 600 && w <= 1024) return 300;
    if (w < 600) return 240;
    return 320;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /* ---------- WebGL fallback ---------- */

  if (!hasWebGL()) {
    if (wrap) wrap.classList.add("cup3d-fallback-only");
    return;
  }

  if (heroVisual) heroVisual.classList.add("cup3d-active");

  /* ---------- Scene setup ---------- */

  var size = canvasSize();
  var scene = new THREE.Scene();

  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  // ~20° downward view so the coffee surface and latte art are readable.
  camera.position.set(0.15, 2.55, 3.35);
  camera.lookAt(0, 0.95, 0);

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  /* ---------- Lighting ---------- */

  scene.add(new THREE.AmbientLight(0xfff8ee, 0.55));

  var keyLight = new THREE.DirectionalLight(0xffe8cc, 0.95);
  keyLight.position.set(-3.5, 6, 4);
  scene.add(keyLight);

  var rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
  rimLight.position.set(2, 4, -2);
  scene.add(rimLight);

  /* ---------- Materials (palette from CSS variables) ---------- */

  var greenHex = cssColor("--green") || "#16382b";
  var paperHex = cssColor("--paper") || cssColor("--cream") || "#faf4e8";
  var saffronHex = cssColor("--saffron") || "#e3a02f";

  var cupMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(greenHex),
    roughness: 0.62,
    metalness: 0.05,
  });

  var innerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(paperHex),
    roughness: 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  var saucerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(paperHex),
    roughness: 0.52,
    metalness: 0.01,
  });

  var bandMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(saffronHex),
    roughness: 0.4,
    metalness: 0.08,
  });

  var handleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(greenHex),
    roughness: 0.55,
    metalness: 0.05,
  });

  /* ---------- Latte art canvas texture ---------- */

  var latteCanvas = document.createElement("canvas");
  latteCanvas.width = 256;
  latteCanvas.height = 256;
  var latteCtx = latteCanvas.getContext("2d");
  var latteTexture = new THREE.CanvasTexture(latteCanvas);
  latteTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  var heartRotation = 0;

  function drawHeart(ctx, x, y, heartSize) {
    var topCurve = heartSize * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y + topCurve);
    ctx.bezierCurveTo(x, y, x - heartSize / 2, y, x - heartSize / 2, y + topCurve);
    ctx.bezierCurveTo(
      x - heartSize / 2,
      y + (heartSize + topCurve) / 2,
      x,
      y + (heartSize + topCurve) / 1.15,
      x,
      y + heartSize
    );
    ctx.bezierCurveTo(
      x,
      y + (heartSize + topCurve) / 1.15,
      x + heartSize / 2,
      y + (heartSize + topCurve) / 2,
      x + heartSize / 2,
      y + topCurve
    );
    ctx.bezierCurveTo(x + heartSize / 2, y, x, y, x, y + topCurve);
    ctx.closePath();
    ctx.fill();
  }

  // Redrawn each wobble frame so the heart shifts like liquid crema.
  function drawLatteArt(rotation) {
    var s = 256;
    latteCtx.clearRect(0, 0, s, s);

    var bg = latteCtx.createRadialGradient(s * 0.48, s * 0.44, 8, s * 0.5, s * 0.5, s * 0.52);
    bg.addColorStop(0, "#C4824A");
    bg.addColorStop(1, "#B0703C");
    latteCtx.fillStyle = bg;
    latteCtx.fillRect(0, 0, s, s);

    latteCtx.save();
    latteCtx.translate(s * 0.54, s * 0.44);
    latteCtx.rotate(rotation);
    latteCtx.shadowBlur = 16;
    latteCtx.shadowColor = "rgba(255,255,255,0.6)";
    latteCtx.fillStyle = "#F3E8D8";
    drawHeart(latteCtx, 0, 0, 42);
    latteCtx.restore();

    latteTexture.needsUpdate = true;
  }

  drawLatteArt(0);

  var coffeeMat = new THREE.MeshStandardMaterial({
    map: latteTexture,
    roughness: 0.28,
    metalness: 0.04,
  });

  /* ---------- "H" monogram decal texture ---------- */

  function createMonogramTexture() {
    var c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = saffronHex;
    ctx.font = "700 76px Fraunces, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", 64, 70);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- Cup model (primitives only — r128 safe) ---------- */

  var cupGroup = new THREE.Group();
  // Scale down so the ticket card remains the hero anchor.
  cupGroup.scale.set(0.65, 0.65, 0.65);

  var CUP_H = 1.65;
  var RIM_R = 1.05;
  var BASE_R = 0.82;
  var WALL = 0.09;
  var cupCenterY = 0.48;
  var rimY = cupCenterY + CUP_H / 2;

  // Saucer: site paper tone with a thin saffron ring at the rim edge.
  var saucer = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.52, 0.07, 48), saucerMat);
  saucer.position.y = -0.04;
  cupGroup.add(saucer);

  var saffronRing = new THREE.Mesh(new THREE.TorusGeometry(1.44, 0.028, 10, 48), bandMat);
  saffronRing.rotation.x = Math.PI / 2;
  saffronRing.position.y = 0.01;
  cupGroup.add(saffronRing);

  // Open-top outer wall (no cap — viewer sees inside).
  var outerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(RIM_R, BASE_R, CUP_H, 48, 1, true),
    cupMat
  );
  outerWall.position.y = cupCenterY;
  cupGroup.add(outerWall);

  // Cream inner wall so the cavity reads as hollow ceramic.
  var innerTop = RIM_R - WALL;
  var innerBase = BASE_R - WALL * 0.55;
  var innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(innerTop, innerBase, CUP_H - 0.06, 48, 1, true),
    innerMat
  );
  innerWall.position.y = cupCenterY - 0.02;
  cupGroup.add(innerWall);

  // Closed bottom inside the cup.
  var cupBottom = new THREE.Mesh(new THREE.CylinderGeometry(innerBase, innerBase, 0.05, 48), innerMat);
  cupBottom.position.y = cupCenterY - CUP_H / 2 + 0.04;
  cupGroup.add(cupBottom);

  // Rim lip — torus at the opening.
  var rimLip = new THREE.Mesh(new THREE.TorusGeometry(RIM_R - 0.02, 0.038, 10, 48), cupMat);
  rimLip.rotation.x = Math.PI / 2;
  rimLip.position.y = rimY;
  cupGroup.add(rimLip);

  // Saffron branding band.
  var band = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.86, 0.11, 48), bandMat);
  band.position.y = cupCenterY - 0.28;
  cupGroup.add(band);

  // Coffee surface ~2 mm below rim — glossy latte with canvas art.
  var coffee = new THREE.Mesh(new THREE.CylinderGeometry(innerTop - 0.04, innerTop - 0.04, 0.022, 48), coffeeMat);
  coffee.position.y = rimY - 0.05;
  cupGroup.add(coffee);

  // "H" monogram decal on the cup front.
  var monogram = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    new THREE.MeshStandardMaterial({
      map: createMonogramTexture(),
      transparent: true,
      roughness: 0.5,
      metalness: 0,
      depthWrite: false,
    })
  );
  monogram.position.set(0, cupCenterY - 0.22, 0.92);
  cupGroup.add(monogram);

  // Handle: torus on the side.
  var handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 24), handleMat);
  handle.rotation.y = Math.PI / 2;
  handle.position.set(1.06, cupCenterY + 0.05, 0);
  cupGroup.add(handle);

  scene.add(cupGroup);

  /* ---------- Steam sprites ---------- */

  var steamTexture = (function () {
    var c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  var steamParticles = [];

  function spawnSteam() {
    for (var i = 0; i < 3; i++) {
      var mat = new THREE.SpriteMaterial({
        map: steamTexture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      var sprite = new THREE.Sprite(mat);
      sprite.position.set(
        (Math.random() - 0.5) * 0.22,
        rimY + 0.18 + i * 0.07,
        (Math.random() - 0.5) * 0.15
      );
      sprite.scale.set(0.28, 0.28, 1);
      sprite.userData = {
        life: 0,
        maxLife: 1.6 + i * 0.15,
        delay: i * 0.12,
        riseSpeed: 0.55 + Math.random() * 0.2,
        drift: (Math.random() - 0.5) * 0.12,
      };
      steamParticles.push(sprite);
      cupGroup.add(sprite);
    }
  }

  function updateSteam(dt) {
    for (var i = steamParticles.length - 1; i >= 0; i--) {
      var p = steamParticles[i];
      var d = p.userData;
      d.life += dt;

      if (d.life < d.delay) continue;

      var t = (d.life - d.delay) / d.maxLife;
      p.position.y += d.riseSpeed * dt;
      p.position.x += d.drift * dt;
      p.material.opacity = Math.max(0, 0.6 * (1 - t));

      if (t >= 1) {
        cupGroup.remove(p);
        p.material.dispose();
        steamParticles.splice(i, 1);
      }
    }
  }

  /* ---------- Interaction state ---------- */

  var MAX_TILT = (15 * Math.PI) / 180;
  var targetTiltX = 0;
  var targetTiltZ = 0;
  var currentTiltX = 0;
  var currentTiltZ = 0;

  var idleAngle = 0;
  var floatOffset = 0;
  var floatPhase = 0;

  var wobbleTime = 0;
  var wobbleActive = false;
  var wobbleCooldown = 0;

  var gyroTiltX = 0;
  var gyroTiltZ = 0;
  var gyroEnabled = false;
  var touchTiltActive = false;

  var isVisible = true;
  var lastFrame = performance.now();

  /* ---------- Resize ---------- */

  function onResize() {
    size = canvasSize();
    container.style.width = size + "px";
    container.style.height = size + "px";
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  onResize();

  /* ---------- Tilt: mouse ---------- */

  if (hero && !COARSE_POINTER) {
    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      var nx = (e.clientX - rect.left) / rect.width - 0.5;
      var ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetTiltZ = nx * MAX_TILT * 2;
      targetTiltX = -ny * MAX_TILT * 2;
    });

    hero.addEventListener("mouseleave", function () {
      targetTiltX = 0;
      targetTiltZ = 0;
    });
  }

  /* ---------- Tilt: touch ---------- */

  if (hero) {
    hero.addEventListener(
      "touchmove",
      function (e) {
        if (!e.touches.length) return;
        touchTiltActive = true;
        var touch = e.touches[0];
        var rect = hero.getBoundingClientRect();
        var nx = (touch.clientX - rect.left) / rect.width - 0.5;
        var ny = (touch.clientY - rect.top) / rect.height - 0.5;
        targetTiltZ = nx * MAX_TILT * 2;
        targetTiltX = -ny * MAX_TILT * 2;
      },
      { passive: true }
    );

    hero.addEventListener("touchend", function () {
      touchTiltActive = false;
      if (!gyroEnabled) {
        targetTiltX = 0;
        targetTiltZ = 0;
      }
    });
  }

  /* ---------- Tilt: gyro ---------- */

  function onDeviceOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    gyroTiltZ = (e.gamma / 90) * MAX_TILT * 0.45;
    gyroTiltX = ((e.beta - 50) / 90) * MAX_TILT * 0.35;
  }

  function tryEnableGyro() {
    if (gyroEnabled || typeof DeviceOrientationEvent === "undefined") return;

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then(function (state) {
          if (state === "granted") {
            gyroEnabled = true;
            window.addEventListener("deviceorientation", onDeviceOrientation, true);
          }
        })
        .catch(function () {});
    } else {
      gyroEnabled = true;
      window.addEventListener("deviceorientation", onDeviceOrientation, true);
    }
  }

  /* ---------- Wobble + steam ---------- */

  function triggerWobble() {
    if (REDUCED_MOTION || wobbleCooldown > 0) return;
    wobbleActive = true;
    wobbleTime = 0;
    wobbleCooldown = 1.4;
    spawnSteam();
  }

  container.addEventListener("pointerdown", function () {
    tryEnableGyro();
    triggerWobble();
  });

  if (!COARSE_POINTER) {
    container.addEventListener("mouseenter", function () {
      triggerWobble();
    });
  }

  /* ---------- Pause when off-screen ---------- */

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    ).observe(container);
  }

  /* ---------- Animation loop ---------- */

  function animate(now) {
    requestAnimationFrame(animate);

    if (!isVisible) {
      lastFrame = now;
      return;
    }

    var dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (wobbleCooldown > 0) wobbleCooldown -= dt;

    if (!REDUCED_MOTION) {
      var useGyro = gyroEnabled && COARSE_POINTER && !touchTiltActive;
      var aimX = useGyro ? gyroTiltX : targetTiltX;
      var aimZ = useGyro ? gyroTiltZ : targetTiltZ;

      currentTiltX = lerp(currentTiltX, aimX, 0.08);
      currentTiltZ = lerp(currentTiltZ, aimZ, 0.08);

      idleAngle += 0.3 * dt;
      floatPhase += dt * 1.6;
      floatOffset = Math.sin(floatPhase) * 0.05;
    }

    var wobbleX = 0;
    var wobbleZ = 0;

    if (!REDUCED_MOTION && wobbleActive) {
      wobbleTime += dt;
      var decay = Math.exp(-wobbleTime * 4.5);
      wobbleX = Math.sin(wobbleTime * 22) * 0.07 * decay;
      wobbleZ = Math.cos(wobbleTime * 18) * 0.05 * decay;
      // Latte heart swirls slightly with the wobble — liquid feel.
      drawLatteArt(Math.sin(wobbleTime * 9) * 0.12);
      if (wobbleTime > 1.2) {
        wobbleActive = false;
        drawLatteArt(0);
      }
    }

    cupGroup.rotation.set(
      currentTiltX + wobbleX,
      REDUCED_MOTION ? 0 : idleAngle,
      currentTiltZ + wobbleZ
    );
    cupGroup.position.y = REDUCED_MOTION ? 0 : floatOffset;

    if (!REDUCED_MOTION) updateSteam(dt);
    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
})();
