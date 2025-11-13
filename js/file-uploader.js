// File Uploader per AFC - Versione completamente riprogettata
// Gestisce l'upload di file multipli con nomenclatura automatica e switch tra file

window.FileUploader = (function() {
    const uploadedFiles = new Map(); // Map con key=index, value={file, settings}
    let currentFileIndex = null;
    let isModalOpen = false;
    let globalSettings = null; // Impostazioni globali per Project Name, Version e Product Type

    // Mappatura Product Type -> Type automatico
    const productTypeMapping = {
        'subwoofer': 'SW',
        'woofer': 'WF',
        'midrange': 'MR',
        'tweeter': 'TW',
        'box': 'BOX',
        'coaxial': 'WF+TW'
    };

    function showModal() {
        if (isModalOpen) return;
        
        const modal = document.getElementById('fileUploaderModal');
        const container = document.getElementById('uploaderContainer');
        
        // Ottieni il nome del progetto dalla pagina
        const projectModelNumber = document.getElementById('project-model-number')?.textContent || '';
        
        // Inizializza impostazioni globali
        globalSettings = {
            projectName: projectModelNumber,
            version: '1',
            productType: 'subwoofer'
        };
        
        // Genera il contenuto del modal
        container.innerHTML = generateModalContent();
        
        // Mostra il modal
        modal.style.display = 'block';
        isModalOpen = true;
        
        // Inizializza i componenti
        initializeUploader();
    }

    function closeModal() {
        const modal = document.getElementById('fileUploaderModal');
        modal.style.display = 'none';
        isModalOpen = false;
        
        // Reset del sistema
        uploadedFiles.clear();
        currentFileIndex = null;
        globalSettings = null;
    }

    function generateModalContent() {
        return `
            <div>
                <!-- Header con Project Name, Version e Product Type -->
                <div class="modal-header" style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #007bff;">
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; align-items: end;">
                        <div>
                            <label style="display: block; margin-bottom: 5px; color: #007bff; font-weight: 700; font-size: 13px;">Project Model Name (项目型号名称)</label>
                            <input type="text" id="globalProjectName" placeholder="e.g. 4NEO" style="width: 100%; padding: 10px; border: 2px solid #007bff; border-radius: 4px; font-size: 16px; font-weight: 600; background: white; box-sizing: border-box;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 5px; color: #007bff; font-weight: 700; font-size: 13px;">Version (版本)</label>
                            <input type="text" id="globalVersion" value="1" placeholder="1, 2, 3..." style="width: 100%; padding: 10px; border: 2px solid #007bff; border-radius: 4px; font-size: 16px; font-weight: 600; background: white; box-sizing: border-box;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 5px; color: #007bff; font-weight: 700; font-size: 13px;">Product Type (产品类型)</label>
                            <select id="globalProductType" style="width: 100%; padding: 10px; border: 2px solid #007bff; border-radius: 4px; font-size: 14px; font-weight: 600; background: white; box-sizing: border-box;">
                                <option value="subwoofer">Subwoofer (低音炮)</option>
                                <option value="woofer">Woofer (低音单元)</option>
                                <option value="midrange">Midrange (中音单元)</option>
                                <option value="tweeter">Tweeter (高音单元)</option>
                                <option value="box">Box (音箱)</option>
                                <option value="coaxial">Coaxial/Component Crossover (同轴/分频器)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Area Upload Files -->
                <div id="uploadArea" class="upload-area">
                    <div class="upload-area-icon">📤</div>
                    <div class="upload-area-text">Click to upload files (点击上传文件)</div>
                    <input type="file" id="mainFileInput" multiple style="display: none;">
                    <div id="fileList" style="margin-top: 15px; display: none;"></div>
                </div>

                <!-- Editor per file selezionato -->
                <div id="fileEditor" style="display: none;">
                    ${generateEditorForm()}
                </div>

                <div class="description-section" style="margin-top: 15px;">
                    <label for="historyDescriptionInput" style="display: block; margin-bottom: 5px; color: #333; font-weight: 600; font-size: 11px;">Entry Description (历史条目描述):</label>
                    <textarea id="historyDescriptionInput" rows="3" placeholder="Enter description for history entry (输入历史条目描述)..." style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; resize: vertical; box-sizing: border-box;"></textarea>
                </div>

                <div class="assigned-to-section" style="margin-top: 15px;">
                    <label for="assignedToSelect" style="display: block; margin-bottom: 5px; color: #333; font-weight: 600; font-size: 11px;">Assigned To (分配给):</label>
                    <select id="assignedToSelect" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; background: white; box-sizing: border-box;">
                        <option value="">Select user (选择用户)...</option>
                    </select>
                </div>

                <div class="modal-actions">
                    <button id="downloadBtn" disabled>
                        Upload & Create Entry (上传并创建条目)
                    </button>
                    <button id="resetBtn">
                        Clear All (清除全部)
                    </button>
                </div>
            </div>
        `;
    }

    function generateEditorForm() {
        const labelStyle = 'display: block; margin-bottom: 5px; color: #333; font-weight: 600; font-size: 11px;';
        const inputStyle = 'width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; background: white; box-sizing: border-box;';
        
        return `
            <input type="hidden" id="productTypeCode" value="SW">

            <!-- Campi dinamici -->
            <div id="dynamicFields">
                <!-- Box Description (solo per box) -->
                <div id="boxSection" style="display: none; margin-bottom: 10px;">
                    <label style="${labelStyle}">Box Desc (容量+形状)</label>
                    <input type="text" id="boxDescription" placeholder="38L SQUARE BOX" style="${inputStyle}">
                </div>

                <!-- Campi per F0 -->
                <div id="impedanceSection" style="display: none; margin-bottom: 10px;">
                    <label style="${labelStyle}">Weight (Optional) (重量)</label>
                    <input type="text" id="impedanceWeight" placeholder="e.g. 45gr" style="${inputStyle}">
                </div>

                <!-- Campi per TS -->
                <div id="tsFieldsSection" style="display: none;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div>
                            <label style="${labelStyle}">Weight (重量)</label>
                            <input type="text" id="tsWeight" placeholder="e.g. 52g" style="${inputStyle}">
                        </div>
                        <div>
                            <label style="${labelStyle}">Connection Type (连接类型)</label>
                            <select id="connectionType" style="${inputStyle}">
                                <option value="Sigle">Sigle - Single (单)</option>
                                <option value="Series">Series (串联)</option>
                                <option value="Parallel">Parallel (并联)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Campo Speaker Connected (solo per coaxial) -->
                <div id="speakerConnectedSection" style="display: none; margin-bottom: 10px;">
                    <label style="${labelStyle}">Speaker Connected (连接的扬声器)</label>
                    <select id="speakerConnected" style="${inputStyle}">
                        <option value="TW">TW - Tweeter only (仅高音)</option>
                        <option value="MR">MR - Midrange only (仅中音)</option>
                        <option value="WF">WF - Woofer only (仅低音)</option>
                        <option value="2way-in">2way in phase - WF+TW (二分频同相)</option>
                        <option value="2way-out">2way out of phase - WF+TW reversed (二分频反相)</option>
                        <option value="3way-in">3way in phase - WF+MR+TW (三分频同相)</option>
                        <option value="3way-out">3way out of phase - WF+MR+TW reversed (三分频反相)</option>
                    </select>
                </div>

                <!-- Microphone Position e Location -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div id="microphonePositionSection">
                        <label style="${labelStyle}">Microphone Position (麦克风位置)</label>
                        <select id="microphonePosition" style="${inputStyle}">
                            <option value="PRT">PRT - 1mm to port (距倒相管1毫米)</option>
                            <option value="DP">DP - 1mm to dust cap (距防尘帽1毫米)</option>
                            <option value="30cm">30cm - 30cm to dust cap (距防尘帽30厘米)</option>
                        </select>
                    </div>
                    <div>
                        <label style="${labelStyle}">Measurement Location (测量位置)</label>
                        <select id="measurementLocation" style="${inputStyle}">
                            <option value="TR">TR - Test room (测试室)</option>
                            <option value="LR">LR - Listen room (听音室)</option>
                            <option value="SB">SB - Subwoofer box (低音炮箱体)</option>
                        </select>
                    </div>
                </div>

                <!-- Note in file name -->
                <div style="margin-bottom: 10px;">
                    <label style="${labelStyle}">Note in file name (Optional) (文件名注释-可选)</label>
                    <input type="text" id="generalDescription" placeholder="Optional additional info for filename (文件名可选附加信息)" style="${inputStyle}">
                </div>
            </div>

        `;
    }

    function initializeUploader() {
        // Popola campi globali
        if (globalSettings) {
            document.getElementById('globalProjectName').value = globalSettings.projectName;
            document.getElementById('globalVersion').value = globalSettings.version;
            document.getElementById('globalProductType').value = globalSettings.productType;
        }
        
        // Popola la dropdown utenti
        populateUsersDropdown();
        
        // Upload area eventi
        const uploadArea = document.getElementById('uploadArea');
        const mainFileInput = document.getElementById('mainFileInput');
        
        uploadArea.addEventListener('click', (e) => {
            if (uploadedFiles.size === 0 || 
                e.target.classList.contains('upload-area-icon') || 
                e.target.classList.contains('upload-area-text')) {
                mainFileInput.click();
            }
        });
        
        mainFileInput.addEventListener('change', handleMultipleFilesUpload);
        
        // Event listeners campi globali
        document.getElementById('globalProjectName').addEventListener('input', updateAllFileNames);
        document.getElementById('globalVersion').addEventListener('input', updateAllFileNames);
        document.getElementById('globalProductType').addEventListener('change', () => {
            // Converti files TS a RES se product type diventa box o coaxial
            const newProductType = document.getElementById('globalProductType').value;
            if (newProductType === 'box' || newProductType === 'coaxial') {
                uploadedFiles.forEach((data) => {
                    if (data.settings.measurementTypes === 'TS') {
                        data.settings.measurementTypes = 'RES';
                    }
                });
            }
            
            updateAllFileNames();
            displayFileList(); // Aggiorna la lista per mostrare le nuove opzioni
            
            // Aggiorna anche i campi del file corrente se c'è
            if (currentFileIndex !== null) {
                updateVisibleSections();
            }
        });
        
        // Event listeners pulsanti
        document.getElementById('downloadBtn').addEventListener('click', uploadAndCreateEntry);
        document.getElementById('resetBtn').addEventListener('click', resetAll);
    }

    function handleMultipleFilesUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        // Aggiungi i file alla mappa
        for (let i = 0; i < files.length; i++) {
            const fileIndex = uploadedFiles.size;
            uploadedFiles.set(fileIndex, {
                file: files[i],
                settings: getDefaultSettings()
            });
        }

        // Seleziona automaticamente il primo file PRIMA di displayFileList
        // così la riga apparirà correttamente evidenziata
        if (currentFileIndex === null && uploadedFiles.size > 0) {
            selectFile(0);
            // Usa setTimeout per assicurare che il DOM sia completamente renderizzato
            setTimeout(() => {
                updateVisibleSections();
            }, 50);
        } else {
            // Se c'erano già file, aggiorna solo la lista
            displayFileList();
            updateButtons();
        }
    }

    function getDefaultSettings() {
        // Imposta measurementLocation in base al product type corrente
        const productType = document.getElementById('globalProductType')?.value || 'subwoofer';
        const defaultLocation = (productType === 'subwoofer') ? 'SB' : 'TR';
        
        return {
            measurementTypes: 'RES',
            boxDescription: '',
            generalDescription: '',
            impedanceWeight: '',
            connectionType: 'Sigle',
            tsWeight: '',
            microphonePosition: 'DP',
            measurementLocation: defaultLocation,
            speakerConnected: 'TW'
        };
    }

    function displayFileList() {
        const fileList = document.getElementById('fileList');
        const uploadAreaText = document.querySelector('.upload-area-text');
        const uploadAreaIcon = document.querySelector('.upload-area-icon');
        const uploadArea = document.getElementById('uploadArea');
        
        if (uploadedFiles.size === 0) {
            fileList.style.display = 'none';
            uploadAreaText.style.display = 'block';
            uploadAreaIcon.style.display = 'block';
            uploadArea.style.cursor = 'pointer';
            return;
        }

        uploadAreaText.style.display = 'none';
        uploadAreaIcon.style.display = 'none';
        fileList.style.display = 'block';
        uploadArea.style.cursor = 'pointer';
        
        let html = '<div style="text-align: left; max-height: 250px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 6px;">';
        
        // Aggiungi pulsante per aggiungere file in cima alla lista
        html += `
            <div onclick="event.stopPropagation(); document.getElementById('mainFileInput').click();" style="display: flex; align-items: center; justify-content: center; padding: 8px; margin-bottom: 10px; background: #007bff; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                ➕ Add more files (添加更多文件)
            </div>
        `;
        
        uploadedFiles.forEach((data, index) => {
            const isActive = index === currentFileIndex;
            const measurementType = data.settings.measurementTypes || 'RES';
            const productType = document.getElementById('globalProductType')?.value || 'subwoofer';
            
            // Opzioni measurement type - escludi TS se product type = box o coaxial
            let measurementOptions = `
                <option value="RES" ${measurementType === 'RES' ? 'selected' : ''}>RES - Frequency response (频率响应)</option>
                <option value="F0" ${measurementType === 'F0' ? 'selected' : ''}>F0 - Impedance (阻抗)</option>
            `;
            if (productType !== 'box' && productType !== 'coaxial') {
                measurementOptions += `<option value="TS" ${measurementType === 'TS' ? 'selected' : ''}>TS - Parameters (TS参数)</option>`;
            }
            
            // Genera il nome per questo file specifico
            const generatedName = data.generatedName ? data.generatedName.replace(/\.[^/.]+$/, '') : 'Not generated yet';
            
            html += `
                <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 10px; align-items: center; padding: 8px; margin: 5px 0; background: ${isActive ? '#e7f3ff' : '#fff'}; border: 1px solid ${isActive ? '#007bff' : '#ddd'}; border-radius: 4px;">
                    <div onclick="event.stopPropagation(); window.FileUploader.selectFile(${index});" style="cursor: pointer; overflow: hidden;">
                        <span style="font-size: 11px; font-weight: 400; color: #666;">📎 ${data.file.name}</span>
                        <span style="font-size: 11px; font-weight: 400; color: #999; margin: 0 8px;">→</span>
                        <span style="font-size: 12px; font-weight: 600; color: #007bff;">${generatedName}</span>
                    </div>
                    <select onchange="event.stopPropagation(); window.FileUploader.updateFileMeasurementType(${index}, this.value);" style="padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 10px; background: white;">
                        ${measurementOptions}
                    </select>
                    <button onclick="event.stopPropagation(); window.FileUploader.removeFile(${index});" style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 4px 8px; font-size: 10px; cursor: pointer;">
                        ❌
                    </button>
                </div>
            `;
        });
        html += '</div>';
        fileList.innerHTML = html;
    }

    function updateFileMeasurementType(index, newType) {
        const fileData = uploadedFiles.get(index);
        if (!fileData) return;
        
        fileData.settings.measurementTypes = newType;
        
        // Se questo è il file corrente, aggiorna anche l'editor
        if (index === currentFileIndex) {
            updateVisibleSections();
        }
        
        // Rigenera il nome del file
        const savedIndex = currentFileIndex;
        currentFileIndex = index;
        loadFileSettings(fileData.settings);
        updateGeneratedFileName();
        saveCurrentFileSettings();
        currentFileIndex = savedIndex;
        
        // Ricarica le impostazioni del file corrente se diverso
        if (currentFileIndex !== null && currentFileIndex !== index) {
            const currentFileData = uploadedFiles.get(currentFileIndex);
            if (currentFileData) {
                loadFileSettings(currentFileData.settings);
            }
        }
        
        displayFileList();
        updateButtons();
    }

    function selectFile(index) {
        // Salva le impostazioni del file corrente prima di cambiare
        if (currentFileIndex !== null) {
            saveCurrentFileSettings();
        }

        currentFileIndex = index;
        const fileData = uploadedFiles.get(index);
        
        if (!fileData) return;

        // Mostra l'editor
        const fileEditor = document.getElementById('fileEditor');
        if (fileEditor) {
            fileEditor.style.display = 'block';
        }
        
        // Mostra il nome del file (elemento potrebbe non esistere nel HTML)
        const currentFileNameEl = document.getElementById('currentFileName');
        if (currentFileNameEl) {
            currentFileNameEl.textContent = fileData.file.name;
        }
        
        // Carica le impostazioni del file selezionato
        loadFileSettings(fileData.settings);
        
        // Setup eventi se non già fatto
        setupEditorEvents();
        
        // Aggiorna la visualizzazione della lista
        displayFileList();
        
        // Aggiorna le sezioni visibili
        updateVisibleSections();
    }

    function saveCurrentFileSettings() {
        const fileData = uploadedFiles.get(currentFileIndex);
        if (!fileData) return;

        fileData.settings = {
            measurementTypes: fileData.settings.measurementTypes, // Mantieni il measurement type già impostato
            boxDescription: document.getElementById('boxDescription')?.value || '',
            generalDescription: document.getElementById('generalDescription')?.value || '',
            impedanceWeight: document.getElementById('impedanceWeight')?.value || '',
            connectionType: document.getElementById('connectionType')?.value || 'Sigle',
            tsWeight: document.getElementById('tsWeight')?.value || '',
            microphonePosition: document.getElementById('microphonePosition')?.value || '',
            measurementLocation: document.getElementById('measurementLocation').value,
            speakerConnected: document.getElementById('speakerConnected')?.value || 'TW'
        };
    }

    function loadFileSettings(settings) {
        // Non caricare measurementTypes qui perché è nella lista file
        
        if (document.getElementById('boxDescription')) {
            document.getElementById('boxDescription').value = settings.boxDescription || '';
        }
        if (document.getElementById('generalDescription')) {
            document.getElementById('generalDescription').value = settings.generalDescription || '';
        }
        if (document.getElementById('impedanceWeight')) {
            document.getElementById('impedanceWeight').value = settings.impedanceWeight || '';
        }
        if (document.getElementById('connectionType')) {
            document.getElementById('connectionType').value = settings.connectionType || 'Sigle';
        }
        if (document.getElementById('tsWeight')) {
            document.getElementById('tsWeight').value = settings.tsWeight || '';
        }
        if (document.getElementById('microphonePosition')) {
            document.getElementById('microphonePosition').value = settings.microphonePosition || '';
        }
        if (document.getElementById('speakerConnected')) {
            document.getElementById('speakerConnected').value = settings.speakerConnected || 'TW';
        }
        
        // Carica measurementLocation solo se non è vuoto nei settings
        // altrimenti lascia il valore che updateVisibleSections() ha già impostato
        const locationSelect = document.getElementById('measurementLocation');
        if (locationSelect && settings.measurementLocation) {
            locationSelect.value = settings.measurementLocation;
        }
        
        updateGeneratedFileName();
    }

    let eventsSetup = false;
    function setupEditorEvents() {
        if (eventsSetup) return;
        eventsSetup = true;

        const changeElements = [
            'boxDescription', 'generalDescription',
            'impedanceWeight', 'connectionType', 'tsWeight', 
            'microphonePosition', 'measurementLocation', 'speakerConnected'
        ];
        
        changeElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener('change', updateGeneratedFileName);
                element.addEventListener('input', updateGeneratedFileName);
            }
        });
    }

    function updateVisibleSections() {
        const productType = document.getElementById('globalProductType').value;
        const fileData = uploadedFiles.get(currentFileIndex);
        if (!fileData) return;
        
        const measurementType = fileData.settings.measurementTypes;
        
        // Aggiorna il campo Type nascosto in base al Product Type
        const typeCode = productTypeMapping[productType];
        document.getElementById('productTypeCode').value = typeCode;
        
        // Nascondi tutte le sezioni prima
        document.getElementById('boxSection').style.display = 'none';
        document.getElementById('impedanceSection').style.display = 'none';
        document.getElementById('tsFieldsSection').style.display = 'none';
        document.getElementById('speakerConnectedSection').style.display = 'none';
        
        const microphonePositionSection = document.getElementById('microphonePositionSection');
        const microphonePosition = document.getElementById('microphonePosition');
        const locationSelect = document.getElementById('measurementLocation');
        
        // Mostra boxSection solo se product type = box
        if (productType === 'box') {
            document.getElementById('boxSection').style.display = 'block';
        }
        
        // Mostra speakerConnectedSection solo se product type = coaxial
        if (productType === 'coaxial') {
            document.getElementById('speakerConnectedSection').style.display = 'block';
        }
        
        // Logica basata su Measurement Type
        if (measurementType === 'RES') {
            // Mostra Microphone Position
            microphonePositionSection.style.display = 'block';
            
            // Logica basata su Product Type
            if (productType === 'subwoofer') {
                // Subwoofer + RES: Position=DP o 30cm, Location=SB
                microphonePosition.innerHTML = `
                    <option value="DP">DP - 1mm to dust cap (距防尘帽1毫米)</option>
                    <option value="30cm">30cm - 30cm to dust cap (距防尘帽30厘米)</option>
                `;
                // Mantieni il valore corrente se esiste, altrimenti usa DP
                const currentMicValue = microphonePosition.value;
                microphonePosition.value = (currentMicValue === 'DP' || currentMicValue === '30cm') ? currentMicValue : 'DP';
                
                locationSelect.innerHTML = `
                    <option value="SB">SB - Subwoofer box (低音炮箱体)</option>
                `;
                locationSelect.value = 'SB';
                
                // Aggiorna anche le impostazioni del file corrente
                if (currentFileIndex !== null) {
                    const fileData = uploadedFiles.get(currentFileIndex);
                    if (fileData) {
                        fileData.settings.measurementLocation = 'SB';
                    }
                }
            } else if (productType === 'box') {
                // Box + RES: Position=tutti, Location=TR o LR
                microphonePosition.innerHTML = `
                    <option value="PRT">PRT - 1mm to port (距倒相管1毫米)</option>
                    <option value="DP">DP - 1mm to dust cap (距防尘帽1毫米)</option>
                    <option value="30cm">30cm - 30cm to dust cap (距防尘帽30厘米)</option>
                `;
                
                locationSelect.innerHTML = `
                    <option value="TR">TR - Test room (测试室)</option>
                    <option value="LR">LR - Listen room (听音室)</option>
                `;
                locationSelect.value = 'TR';
            } else {
                // Altri + RES: Position=DP o 30cm, Location=TR o LR
                microphonePosition.innerHTML = `
                    <option value="DP">DP - 1mm to dust cap (距防尘帽1毫米)</option>
                    <option value="30cm">30cm - 30cm to dust cap (距防尘帽30厘米)</option>
                `;
                microphonePosition.value = 'DP';
                
                locationSelect.innerHTML = `
                    <option value="TR">TR - Test room (测试室)</option>
                    <option value="LR">LR - Listen room (听音室)</option>
                `;
                locationSelect.value = 'TR';
            }
        } else if (measurementType === 'F0') {
            // F0: Nascondi Microphone Position, Location=TR o LR
            microphonePositionSection.style.display = 'none';
            document.getElementById('impedanceSection').style.display = 'block';
            
            locationSelect.innerHTML = `
                <option value="TR">TR - Test room (测试室)</option>
                <option value="LR">LR - Listen room (听音室)</option>
            `;
            locationSelect.value = 'TR';
        } else if (measurementType === 'TS') {
            // TS: Nascondi Microphone Position, Location=TR o LR
            microphonePositionSection.style.display = 'none';
            document.getElementById('tsFieldsSection').style.display = 'block';
            
            locationSelect.innerHTML = `
                <option value="TR">TR - Test room (测试室)</option>
                <option value="LR">LR - Listen room (听音室)</option>
            `;
            locationSelect.value = 'TR';
        }
        
        updateGeneratedFileName();
    }

    function updateGeneratedFileName() {
        const projectName = document.getElementById('globalProjectName').value.trim().toUpperCase();
        if (!projectName) {
            return;
        }

        const version = document.getElementById('globalVersion').value.trim();
        const productType = document.getElementById('globalProductType').value;
        
        // Per coaxial, il Type code è dinamico basato su Speaker Connected
        let typeCode;
        if (productType === 'coaxial') {
            const speakerConnected = document.getElementById('speakerConnected')?.value || 'TW';
            typeCode = speakerConnected;
        } else {
            typeCode = productTypeMapping[productType];
        }
        
        // Prendi measurement type dai settings del file corrente
        const fileData = uploadedFiles.get(currentFileIndex);
        if (!fileData) {
            return;
        }
        const measurementTypes = fileData.settings.measurementTypes;
        const generalDescription = document.getElementById('generalDescription').value.trim().toUpperCase();
        
        let filename = `${projectName}-V${version}`;
        
        // Aggiungi la descrizione generale se presente
        if (generalDescription) {
            filename += `-${generalDescription}`;
        }

        // Per Box, aggiungi la descrizione specifica se presente
        if (productType === 'box') {
            const boxDesc = document.getElementById('boxDescription').value.trim().toUpperCase();
            if (boxDesc) {
                filename += `-${boxDesc}`;
            }
        }

        // Aggiungi Type code
        filename += `-${typeCode}`;
        
        // Aggiungi Measurement Type
        filename += `-${measurementTypes}`;
        
        // Aggiungi Position e Location
        const microphonePosition = document.getElementById('microphonePosition');
        const position = microphonePosition && microphonePosition.offsetParent !== null ? microphonePosition.value : '';
        const location = document.getElementById('measurementLocation').value;
        filename += `-${position}-${location}`;
        
        // Aggiungi campi specifici per Measurement Type F0
        if (measurementTypes === 'F0') {
            const impWeight = document.getElementById('impedanceWeight')?.value.trim();
            if (impWeight) {
                filename += `-${impWeight}`;
            }
        } 
        // Aggiungi campi specifici per Measurement Type TS
        else if (measurementTypes === 'TS') {
            const connType = document.getElementById('connectionType')?.value;
            const tsWeight = document.getElementById('tsWeight')?.value.trim();
            if (connType) {
                filename += `-${connType}`;
            }
            if (tsWeight) {
                filename += `-${tsWeight}`;
            }
        }

        // Salva il filename generato nelle impostazioni del file corrente
        if (currentFileIndex !== null) {
            const fileData = uploadedFiles.get(currentFileIndex);
            if (fileData) {
                const extension = fileData.file.name.split('.').pop();
                fileData.generatedName = filename + '.' + extension;
            }
        }
        
        updateButtons();
        
        // Aggiorna la visualizzazione della lista per mostrare il nome generato
        displayFileList();
    }

    function updateAllFileNames() {
        // Aggiorna il nome generato per tutti i file
        if (uploadedFiles.size === 0) return;
        
        // Salva il file corrente
        const savedIndex = currentFileIndex;
        
        // Passa attraverso tutti i file e rigenera i nomi
        uploadedFiles.forEach((data, index) => {
            currentFileIndex = index;
            loadFileSettings(data.settings);
            updateGeneratedFileName();
            saveCurrentFileSettings();
        });
        
        // Ripristina il file corrente
        currentFileIndex = savedIndex;
        if (currentFileIndex !== null) {
            const fileData = uploadedFiles.get(currentFileIndex);
            if (fileData) {
                loadFileSettings(fileData.settings);
            }
        }
        
        displayFileList();
        updateButtons();
    }

    function updateButtons() {
        const downloadBtn = document.getElementById('downloadBtn');
        let readyFiles = 0;
        
        uploadedFiles.forEach(data => {
            if (data.file && data.generatedName) {
                readyFiles++;
            }
        });
        
        if (downloadBtn) {
            downloadBtn.disabled = readyFiles === 0;
        }
    }

    function populateUsersDropdown() {
        const select = document.getElementById('assignedToSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Select user (选择用户)...</option>';

        if (window.teamMembers && Array.isArray(window.teamMembers)) {
            window.teamMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name || member.username || `User ${member.id}`;
                select.appendChild(option);
            });
        }
    }

    async function uploadAndCreateEntry() {
        const assignedTo = document.getElementById('assignedToSelect').value;
        if (!assignedTo) {
            alert('Please select a user to assign the files to.');
            return;
        }

        // Verifica che sia stata inserita una descrizione
        const userDescription = document.getElementById('historyDescriptionInput').value.trim();
        if (!userDescription) {
            alert('Please enter a description for this history entry.');
            document.getElementById('historyDescriptionInput').focus();
            return;
        }

        // Salva le impostazioni del file corrente
        if (currentFileIndex !== null) {
            saveCurrentFileSettings();
            updateGeneratedFileName();
        }

        let validFiles = 0;
        uploadedFiles.forEach(data => {
            if (data.file && data.generatedName) {
                validFiles++;
            }
        });

        if (validFiles === 0) {
            alert('No files ready for upload.');
            return;
        }

        try {
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Processing... (处理中...)';

            const formData = new FormData();
            let fileList = [];

            uploadedFiles.forEach(data => {
                if (data.file && data.generatedName) {
                    formData.append('files', data.file, data.generatedName);
                    fileList.push(data.generatedName);
                }
            });

            // Usa la descrizione inserita dall'utente
            const description = userDescription;
            
            // Prima crea la history entry per ottenere l'historyId
            const currentDate = new Date().toISOString().split('T')[0];
            
            // Trova il nome utente dall'ID
            const selectedUser = window.teamMembers.find(member => member.id == assignedTo);
            const userName = selectedUser ? (selectedUser.name || selectedUser.username) : '';
            
            if (!userName) {
                throw new Error('User name not found');
            }

            const historyEntry = {
                projectId: window.projectId,
                date: currentDate,
                phase: null,
                description: description,
                assignedTo: userName,
                status: 'In Progress'
            };

            const historyResponse = await fetch(`/api/projects/${window.projectId}/history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(historyEntry)
            });

            if (!historyResponse.ok) {
                throw new Error('Failed to create history entry');
            }

            const historyResult = await historyResponse.json();
            const historyId = historyResult.id;
            
            // Ora carica i file con l'historyId
            formData.append('historyId', historyId);
            
            const uploadResponse = await fetch(`/api/projects/${window.projectId}/files`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Upload failed');
            }

            const uploadResult = await uploadResponse.json();
            console.log('Upload result:', uploadResult);

            showMessage(`✓ ${validFiles} files uploaded successfully!`);

            if (window.ProjectHistory && typeof window.ProjectHistory.fetchProjectHistory === 'function') {
                await window.ProjectHistory.fetchProjectHistory(window.projectId);
            }

            closeModal();

        } catch (error) {
            console.error('Errore durante l\'upload:', error);
            alert(`An error occurred: ${error.message}`);
            
            const downloadBtn = document.getElementById('downloadBtn');
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.textContent = 'Upload & Create Entry (上传并创建条目)';
            }
        }
    }

    function resetAll() {
        if (confirm('Are you sure you want to clear all files? (确定要清除所有文件吗？)')) {
            uploadedFiles.clear();
            currentFileIndex = null;
            eventsSetup = false;
            globalSettings = {
                projectName: '',
                version: '1',
                productType: 'subwoofer'
            };
            
            const fileList = document.getElementById('fileList');
            const fileEditor = document.getElementById('fileEditor');
            const uploadAreaText = document.querySelector('.upload-area-text');
            const uploadAreaIcon = document.querySelector('.upload-area-icon');
            
            fileList.style.display = 'none';
            fileEditor.style.display = 'none';
            uploadAreaText.style.display = 'block';
            uploadAreaIcon.style.display = 'block';
            
            document.getElementById('mainFileInput').value = '';
            updateButtons();
            
            showMessage('✓ All cleared (已清除全部)');
        }
    }

    function showMessage(message) {
        const msgEl = document.createElement('div');
        msgEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
        `;
        msgEl.textContent = message;
        document.body.appendChild(msgEl);

        setTimeout(() => {
            if (document.body.contains(msgEl)) {
                document.body.removeChild(msgEl);
            }
        }, 3000);
    }

    function removeFile(index) {
        uploadedFiles.delete(index);
        
        // Se il file rimosso era quello corrente, seleziona un altro
        if (currentFileIndex === index) {
            currentFileIndex = null;
            if (uploadedFiles.size > 0) {
                // Seleziona il primo file disponibile
                const firstKey = uploadedFiles.keys().next().value;
                selectFile(firstKey);
            } else {
                // Nessun file, nascondi l'editor
                const fileEditor = document.getElementById('fileEditor');
                fileEditor.style.display = 'none';
            }
        }
        
        displayFileList();
        updateButtons();
    }

    // API pubblica
    return {
        showModal: showModal,
        closeModal: closeModal,
        selectFile: selectFile,
        removeFile: removeFile,
        updateFileMeasurementType: updateFileMeasurementType
    };
})();
