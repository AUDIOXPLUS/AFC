// File aggiuntivo di supporto per funzioni mancanti

// Funzione per inizializzare il visualizzatore Three.js
function initViewer() {
    // Inizializza la scena Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    
    // Aggiungi illuminazione
    const ambientLight = new THREE.AmbientLight(0x404040, 0.7);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);
    
    // Configurazione camera
    const container = document.getElementById('viewer-container');
    const aspect = container.clientWidth / container.clientHeight;
    
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('viewer-canvas'), 
        antialias: true 
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Controlli camera
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    
    // Aggiungi una griglia per il riferimento
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);
    
    // Aggiungi gli assi per il riferimento
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    
    // Gestione resize
    window.addEventListener('resize', onWindowResize);
    
    // Funzione di animazione
    animate();
}

// Funzione di animazione per il rendering continuo
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    
    // Aggiorna le coordinate della camera
    const pos = camera.position;
    const coordinatesDisplay = document.getElementById('coordinates');
    coordinatesDisplay.textContent = `Pos: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
}

// Gestione del resize della finestra
function onWindowResize() {
    const container = document.getElementById('viewer-container');
    const aspect = container.clientWidth / container.clientHeight;
    
    if (camera.isPerspectiveCamera) {
        camera.aspect = aspect;
    } else {
        // Camera ortografica
        const frustumSize = 20;
        camera.left = -frustumSize * aspect / 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = -frustumSize / 2;
    }
    
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Funzione per attivare/disattivare la visualizzazione wireframe
function toggleWireframe() {
    wireframeMode = !wireframeMode;
    
    if (model) {
        model.traverse(child => {
            if (child.isMesh) {
                child.material.wireframe = wireframeMode;
            }
        });
    }
    
    // Aggiorna UI
    const wireframeBtn = document.getElementById('wireframe-btn');
    const statusMessage = document.getElementById('status-message');
    
    if (wireframeMode) {
        wireframeBtn.textContent = "Solid Mode";
        statusMessage.textContent = "Wireframe mode enabled";
    } else {
        wireframeBtn.textContent = "Wireframe Mode";
        statusMessage.textContent = "Solid mode enabled";
    }
}

// Funzione per attivare/disattivare la vista ortografica
function toggleOrthographic() {
    orthographicMode = !orthographicMode;
    
    const container = document.getElementById('viewer-container');
    const aspect = container.clientWidth / container.clientHeight;
    const currentPos = camera.position.clone();
    const currentTarget = controls.target.clone();
    
    if (orthographicMode) {
        // Passa a camera ortografica
        const frustumSize = 20;
        camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2, frustumSize * aspect / 2,
            frustumSize / 2, -frustumSize / 2,
            0.1, 1000
        );
        document.getElementById('ortho-btn').textContent = "Perspective View";
        document.getElementById('status-message').textContent = "Orthographic view enabled";
    } else {
        // Passa a camera prospettica
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        document.getElementById('ortho-btn').textContent = "Orthographic View";
        document.getElementById('status-message').textContent = "Perspective view enabled";
    }
    
    // Ripristina posizione e target
    camera.position.copy(currentPos);
    camera.lookAt(currentTarget);
    
    // Ricrea i controlli con la nuova camera
    controls.dispose();
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.target.copy(currentTarget);
    
    camera.updateProjectionMatrix();
}
