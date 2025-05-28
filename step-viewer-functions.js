// Script di supporto per step-viewer.html
// Aggiunge le funzioni mancanti per il visualizzatore STEP

// Centra la vista sul modello
function fitCameraToModel() {
    if (!model) return;
    
    // Calcola bounding box
    const boundingBox = new THREE.Box3().setFromObject(model);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calcola dimensione massima
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Posiziona la camera
    camera.position.set(
        center.x + maxDim * 1.5,
        center.y + maxDim * 1.5,
        center.z + maxDim * 1.5
    );
    
    // Punta al centro del modello
    controls.target.copy(center);
    controls.update();
}

// Resetta la vista
function resetView() {
    camera.position.set(10, 10, 10);
    controls.target.set(0, 0, 0);
    controls.update();
    document.getElementById('status-message').textContent = "View reset";
}

// Mostra/nasconde l'albero del modello
function toggleModelTree() {
    const modelTree = document.getElementById('model-tree');
    modelTree.classList.toggle('visible');
    
    const toggleTreeBtn = document.getElementById('toggle-tree-btn');
    
    if (modelTree.classList.contains('visible')) {
        toggleTreeBtn.textContent = "Hide Model Tree";
    } else {
        toggleTreeBtn.textContent = "Show Model Tree";
    }
}

// Popola l'albero del modello
function populateModelTree() {
    const modelTree = document.getElementById('model-tree');
    modelTree.innerHTML = '';
    
    if (!model) return;
    
    // Aggiungi il nodo principale
    const rootNode = document.createElement('div');
    rootNode.className = 'tree-node';
    rootNode.textContent = 'STEP Model';
    
    // Click handler per il nodo principale
    rootNode.addEventListener('click', () => {
        document.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        rootNode.classList.add('selected');
        
        // Focus sul modello completo
        fitCameraToModel();
    });
    
    modelTree.appendChild(rootNode);
    
    // Aggiungi i figli del modello all'albero
    if (model.children && model.children.length > 0) {
        model.children.forEach(child => {
            if (child.isMesh || child.isGroup || child.isLineSegments) {
                addNodeToTree(child, modelTree);
            }
        });
    }
}

// Funzione di supporto per populateModelTree
function addNodeToTree(object, parent) {
    // Crea un elemento per l'oggetto
    const nodeElem = document.createElement('div');
    nodeElem.className = 'tree-node';
    nodeElem.textContent = object.name || 'Unnamed Object';
    nodeElem.style.paddingLeft = '15px';
    
    // Aggiungi evento di click
    nodeElem.addEventListener('click', (e) => {
        e.stopPropagation(); // Previene bubbling
        
        // Deseleziona tutti i nodi
        document.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        
        // Seleziona questo nodo
        nodeElem.classList.add('selected');
        
        // Focus sull'oggetto
        const boundingBox = new THREE.Box3().setFromObject(object);
        const center = boundingBox.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        controls.update();
        
        document.getElementById('status-message').textContent = `Selezione: ${object.name || 'Unnamed Object'}`;
    });
    
    parent.appendChild(nodeElem);
    
    // Aggiungi i figli ricorsivamente
    if (object.children && object.children.length > 0) {
        object.children.forEach(child => {
            if (child.isMesh || child.isGroup || child.isLineSegments) {
                addNodeToTree(child, parent);
            }
        });
    }
}

// Mostra errori
function showError(message) {
    // Nascondi progresso
    document.getElementById('loading-progress').style.display = 'none';
    
    // Crea container per il messaggio di errore
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    
    // Aggiungi titolo e messaggio
    errorContainer.innerHTML = `
        <h4 style="color: #dc3545;">Errore</h4>
        <p>${message}</p>
        <div style="margin: 15px 0; padding: 10px; background-color: #f8d7da; border-radius: 4px;">
            <h5>Dettagli tecnici:</h5>
            <ul>
                <li><strong>Browser:</strong> ${navigator.userAgent}</li>
                <li><strong>Three.js:</strong> ${THREE.REVISION || 'Sconosciuta'}</li>
                <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            </ul>
            <p>Per ulteriori dettagli, controlla la console del browser per eventuali errori JavaScript.</p>
        </div>
        <button style="margin-top: 15px;">Riprova</button>
    `;
    
    // Aggiungi event listener al pulsante
    const retryButton = errorContainer.querySelector('button');
    retryButton.addEventListener('click', () => {
        window.location.reload();
    });
    
    // Nascondi spinner
    document.querySelector('.loading-spinner').style.display = 'none';
    
    // Aggiungi al DOM
    const loadingText = document.getElementById('loading-text');
    loadingText.innerHTML = '';
    loadingText.appendChild(errorContainer);
    
    // Aggiorna stato
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = 'Errore';
    statusMessage.style.color = '#dc3545';
    
    console.error('Errore:', message);
}

// Formatta dimensione file
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
