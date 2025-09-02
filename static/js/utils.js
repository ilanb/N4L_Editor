// Module utilitaire pour l'application N4L

export class State {
    constructor() {
        this.concepts = [];
        this.subjects = [];
        this.n4lNotes = {};
        this.allGraphData = { nodes: [], edges: [] };
        this.currentContext = 'general';
        this.currentAction = null;
        this.selectedSource = null;
        this.selectedDest = null;
        this.selectedChildren = [];
        this.fileName = 'notes';
        this.investigationMode = false;
        this.currentViewMode = 'standard';
    }
}

export class DOM {
    constructor() {
        this.uploadView = document.getElementById('upload-view');
        this.editorView = document.getElementById('editor-view');
        this.conceptsList = document.getElementById('concepts-list');
        this.subjectsList = document.getElementById('subjects-list');
        this.contextInput = document.getElementById('context-input');
        this.helpPanel = document.getElementById('help-panel');
        this.graphContainer = document.getElementById('graph-container');
        this.n4lView = document.getElementById('n4l-view');
        this.graphView = document.getElementById('graph-view');
        this.timelineView = document.getElementById('timeline-view');
        this.modal = document.getElementById('modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalText = document.getElementById('modal-text');
        this.modalInput = document.getElementById('modal-input');
        this.modalOk = document.getElementById('modal-ok');
        this.modalCancel = document.getElementById('modal-cancel');
        this.relationSuggestions = document.getElementById('relation-suggestions');
    }
}

export class Utils {
    constructor() {
        this.modalResolve = null;
        this.relationTypes = {
            "➡️ Causalité / Séquence (leadsto)": ["cause", "mène à", "précède", "ensuite", "affecte", "provoque"],
            "📦 Appartenance / Contenu (contains)": ["contient", "fait partie de", "est un exemple de", "a pour membre", "utilise"],
            "🔍 Description / Propriété (properties)": ["a pour propriété", "est", "signifie", "a pour rôle", "exprime"],
            "🤝 Similarité / Proximité (near)": ["est similaire à", "ressemble à", "est associé à", "est proche de"]
        };
    }

    showModal(config) {
        const dom = new DOM();
        
        dom.modalTitle.textContent = config.title;
        
        if (config.isHtml) {
            dom.modalText.innerHTML = config.text;
        } else {
            dom.modalText.innerHTML = config.text ? config.text.replace(/\n/g, '<br>') : '';
        }
        
        dom.modalInput.value = config.inputValue || '';
        dom.modalInput.style.display = config.prompt ? 'block' : 'none';
        dom.modalOk.style.display = config.prompt || config.confirm ? 'block' : 'none';
        dom.modalCancel.textContent = config.prompt || config.confirm ? 'Annuler' : 'Fermer';
        
        const saveBtn = document.getElementById('modal-save-analysis');
        if (saveBtn) {
            saveBtn.style.display = config.showSave ? 'block' : 'none';
        }

        dom.relationSuggestions.innerHTML = '';
        if (config.showSuggestions) {
            for (const category in this.relationTypes) {
                const categoryDiv = document.createElement('div');
                categoryDiv.innerHTML = `<h4 class="font-semibold mt-2 text-sm">${category}</h4>`;
                const btnGroup = document.createElement('div');
                btnGroup.className = 'flex flex-wrap gap-2 mt-1';
                
                this.relationTypes[category].forEach(suggestion => {
                    const btn = document.createElement('button');
                    btn.textContent = suggestion;
                    btn.className = 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-1 px-2 rounded-full';
                    btn.onclick = () => { dom.modalInput.value = suggestion; };
                    btnGroup.appendChild(btn);
                });
                
                categoryDiv.appendChild(btnGroup);
                dom.relationSuggestions.appendChild(categoryDiv);
            }
        }

        // Gestion du learning hint
        const learningContainer = document.getElementById('learning-hint-container');
        if (config.showLearningHint) {
            document.getElementById('learning-subject').textContent = config.learningSubject;
            document.getElementById('learning-hint-checkbox').checked = false;
            learningContainer.classList.remove('hidden');
            learningContainer.classList.add('flex');
        } else {
            learningContainer.classList.add('hidden');
            learningContainer.classList.remove('flex');
        }

        dom.modal.classList.remove('hidden');
        
        return new Promise(resolve => {
            this.modalResolve = resolve;
            dom.modalOk.onclick = () => {
                const isLearningChecked = document.getElementById('learning-hint-checkbox').checked;
                this.closeModal({
                    text: dom.modalInput.value,
                    isLearningSubject: config.showLearningHint ? isLearningChecked : false
                });
            };
            dom.modalCancel.onclick = () => this.closeModal(null);
        });
    }

    closeModal(value) {
        const dom = new DOM();
        dom.modal.classList.add('hidden');
        if (this.modalResolve) {
            this.modalResolve(value);
            this.modalResolve = null;
        }
    }

    extractFirstSubject(note) {
        const parts = note.split(' ');
        for (const part of parts) {
            const cleaned = part.replace(/["']/g, '');
            if (cleaned.length > 2 && !cleaned.includes('->') && !cleaned.includes('<->')) {
                return cleaned;
            }
        }
        return '';
    }

    contains(array, item) {
        return array.includes(item);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}