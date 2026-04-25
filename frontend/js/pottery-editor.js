let scene, camera, renderer, potteryMesh, wheelMesh;
let controls;
let isWheelSpinning = false;
let wheelSpeed = 0.01;
let currentTool = 'pull';
let isMouseDown = false;
let mousePosition = { x: 0, y: 0 };
let raycaster, mouse;

const profilePoints = [];
const numProfilePoints = 32;

document.addEventListener('DOMContentLoaded', () => {
    initPotteryEditor();
    setupPotteryControls();
    animate();
});

function initPotteryEditor() {
    const canvas = document.getElementById('pottery-canvas');
    if (!canvas) return;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2d2d44);
    
    const rect = canvas.parentElement.getBoundingClientRect();
    camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 1000);
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 1, 0);
    
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true
    });
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI / 2;
    
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    const sideLight = new THREE.DirectionalLight(0xffa500, 0.3);
    sideLight.position.set(-5, 3, -5);
    scene.add(sideLight);
    
    createWheel();
    createInitialPottery();
    
    window.addEventListener('resize', onWindowResize);
}

function createWheel() {
    const wheelGeometry = new THREE.CylinderGeometry(2.5, 2.5, 0.3, 64);
    const wheelMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.8,
        metalness: 0.2
    });
    
    wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelMesh.position.y = 0.15;
    wheelMesh.receiveShadow = true;
    scene.add(wheelMesh);
    
    const rimGeometry = new THREE.TorusGeometry(2.5, 0.05, 16, 64);
    const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        roughness: 0.6,
        metalness: 0.3
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.y = 0.3;
    rim.rotation.x = Math.PI / 2;
    scene.add(rim);
}

function createInitialPottery() {
    profilePoints.length = 0;
    
    const initialHeight = 3;
    const initialRadius = 1.5;
    
    for (let i = 0; i < numProfilePoints; i++) {
        const t = i / (numProfilePoints - 1);
        const y = t * initialHeight;
        
        const radius = initialRadius * (1 - 0.3 * Math.sin(t * Math.PI) * (1 - t));
        
        profilePoints.push(new THREE.Vector2(radius, y));
    }
    
    updatePotteryMesh();
}

function updatePotteryMesh() {
    if (potteryMesh) {
        scene.remove(potteryMesh);
        potteryMesh.geometry.dispose();
        potteryMesh.material.dispose();
    }
    
    const shape = new THREE.Shape(profilePoints);
    
    const extrudeSettings = {
        steps: 1,
        depth: 0,
        bevelEnabled: false,
        extrudePath: undefined
    };
    
    const points = [];
    for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
    }
    const extrudePath = new THREE.CatmullRomCurve3(points);
    extrudePath.closed = true;
    
    const geometry = new THREE.ExtrudeGeometry(shape, {
        steps: 32,
        bevelEnabled: false,
        extrudePath: extrudePath
    });
    
    const material = new THREE.MeshStandardMaterial({
        color: 0x8b7355,
        roughness: 0.9,
        metalness: 0.05,
        side: THREE.DoubleSide
    });
    
    potteryMesh = new THREE.Mesh(geometry, material);
    potteryMesh.castShadow = true;
    potteryMesh.receiveShadow = true;
    potteryMesh.position.y = 0.3;
    
    scene.add(potteryMesh);
    
    appState.meshData = {
        profilePoints: profilePoints.map(p => ({ x: p.x, y: p.y }))
    };
}

function setupPotteryControls() {
    const startWheelBtn = document.getElementById('start-wheel');
    const stopWheelBtn = document.getElementById('stop-wheel');
    const resetBtn = document.getElementById('reset-pottery');
    const toolSelect = document.getElementById('pottery-tool');
    const speedSlider = document.getElementById('wheel-speed');
    const speedValue = document.getElementById('speed-value');
    const canvas = document.getElementById('pottery-canvas');
    
    if (startWheelBtn) {
        startWheelBtn.addEventListener('click', () => {
            isWheelSpinning = true;
        });
    }
    
    if (stopWheelBtn) {
        stopWheelBtn.addEventListener('click', () => {
            isWheelSpinning = false;
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            createInitialPottery();
        });
    }
    
    if (toolSelect) {
        toolSelect.addEventListener('change', (e) => {
            currentTool = e.target.value;
        });
    }
    
    if (speedSlider && speedValue) {
        speedSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            speedValue.textContent = `${value}%`;
            wheelSpeed = value / 5000;
        });
    }
    
    if (canvas) {
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);
        
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onMouseUp);
    }
}

function onMouseDown(e) {
    if (!potteryMesh) return;
    
    isMouseDown = true;
    updateMousePosition(e);
    
    if (isWheelSpinning) {
        applyToolEffect();
    }
}

function onMouseMove(e) {
    if (!potteryMesh) return;
    
    updateMousePosition(e);
    
    if (isMouseDown && isWheelSpinning) {
        applyToolEffect();
    }
}

function onMouseUp() {
    isMouseDown = false;
}

function onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
}

function onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
}

function updateMousePosition(e) {
    const canvas = document.getElementById('pottery-canvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function applyToolEffect() {
    if (!potteryMesh) return;
    
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObject(potteryMesh);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        
        const localPoint = potteryMesh.worldToLocal(point.clone());
        
        const radius = Math.sqrt(localPoint.x * localPoint.x + localPoint.z * localPoint.z);
        const y = localPoint.y;
        
        modifyProfile(y, radius);
    }
}

function modifyProfile(y, currentRadius) {
    const toolStrength = 0.05;
    const toolRadius = 0.5;
    
    let modified = false;
    
    for (let i = 0; i < profilePoints.length; i++) {
        const point = profilePoints[i];
        const distance = Math.abs(point.y - y);
        
        if (distance < toolRadius) {
            const influence = 1 - (distance / toolRadius);
            const effect = toolStrength * influence;
            
            switch (currentTool) {
                case 'pull':
                    point.x += effect;
                    break;
                case 'push':
                    point.x -= effect;
                    break;
                case 'pinch':
                    if (i > profilePoints.length * 0.7) {
                        point.x -= effect * 1.5;
                        point.y += effect * 0.5;
                    }
                    break;
                case 'smooth':
                    if (i > 0 && i < profilePoints.length - 1) {
                        const avgRadius = (profilePoints[i - 1].x + profilePoints[i + 1].x) / 2;
                        point.x += (avgRadius - point.x) * effect;
                    }
                    break;
            }
            
            point.x = Math.max(0.2, Math.min(3, point.x));
            
            modified = true;
        }
    }
    
    if (modified) {
        updatePotteryMesh();
    }
}

function onWindowResize() {
    const canvas = document.getElementById('pottery-canvas');
    if (!canvas) return;
    
    const rect = canvas.parentElement.getBoundingClientRect();
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (isWheelSpinning && potteryMesh) {
        potteryMesh.rotation.y += wheelSpeed;
        if (wheelMesh) {
            wheelMesh.rotation.y += wheelSpeed;
        }
    }
    
    if (controls) {
        controls.update();
    }
    
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}
