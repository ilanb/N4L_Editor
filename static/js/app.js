// Module principal de l'application N4L
import { EditorManager } from './editor.js';
import { GraphManager } from './graph.js';
import { InvestigationManager } from './investigation.js';
import { HistoryManager } from './history.js';
import { DensityManager } from './density.js';
import { SocraticManager } from './socratic.js';
import { DOM, State, Utils } from './utils.js';

class N4LApp {
    constructor() {
        this.state = new State();
        this.dom = new DOM();
        this.editor = new EditorManager(this);
        this.graph = new GraphManager(this);
        this.investigation = new InvestigationManager(this);
        this.history = new HistoryManager(this);
        this.density = new DensityManager(this);
        this.socratic = new SocraticManager(this);
        this.utils = new Utils();

        this.init();
    }

    init() {
        console.log("LOG: App initializing...");
        
        // Initialisation des vues
        this.setupUploadView();
        this.setupEditorView();
        this.setupActions();
        this.setupTabs();
        
        // Initialisation des managers
        this.editor.init();
        this.graph.init();
        this.investigation.init();
        this.history.init();
        this.density.init();
        this.socratic.init();

        console.log("LOG: App initialized successfully");
    }

    setupUploadView() {
        document.getElementById('import-txt-btn').onclick = () => {
            document.getElementById('file-upload-txt').click();
        };
        
        document.getElementById('import-n4l-btn').onclick = () => {
            document.getElementById('file-upload-n4l').click();
        };
        
        document.getElementById('file-upload-txt').addEventListener('change', (e) => {
            this.handleUpload(e, 'txt');
        });
        
        document.getElementById('file-upload-n4l').addEventListener('change', (e) => {
            this.handleUpload(e, 'n4l');
        });
    }

    setupEditorView() {
        // Drag & Drop
        this.setupDragAndDrop();
        
        // AI Actions
        document.getElementById('ai-extract-btn').onclick = () => {
            this.autoExtractSubjects();
        };
        
        // Context input
        document.getElementById('context-input').addEventListener('change', (e) => {
            this.state.currentContext = e.target.value.trim() || 'general';
        });
        
        // Download button
        document.getElementById('download-btn').onclick = () => {
            this.downloadN4LFile();
        };
    }

    setupActions() {
        // Créer les boutons d'action
        const actionButtons = document.getElementById('action-buttons');
        const actions = [
            { id: 'action-extract', label: 'Extraire Sujet', color: 'teal', tooltip: 'Permet de sélectionner manuellement un mot ou un nom à  l\'intérieur d\'une phrase.' },
            { id: 'action-group', label: 'Groupe', color: 'purple', tooltip: 'Groupe (=>) : Rassemble plusieurs concepts/sujets sous une idée principale.' },
            { id: 'action-new', label: 'Nouveau Sujet', color: 'gray', tooltip: 'Ajoute manuellement un nouveau sujet ou une nouvelle idée à  votre liste de sujets.' },
            { id: 'action-temporal', label: 'Patterns Temporels', color: 'orange', tooltip: 'Détecte automatiquement les marqueurs temporels et propose des relations chronologiques.' },
            { id: 'action-investigation', label: 'Mode Enquête Guidée', color: 'indigo', tooltip: 'Un assistant interactif qui vous guide étape par étape pour structurer votre enquête.', fullWidth: true },
            { id: 'check-consistency-btn', label: 'Vérifier Cohérence', color: 'purple', tooltip: 'Analyse le graphe pour détecter les contradictions ou incohérences potentielles.', fullWidth: true }
        ];

        actions.forEach(action => {
            const wrapper = document.createElement('div');
            wrapper.className = `tooltip-container ${action.fullWidth ? 'col-span-2' : ''}`;
            
            const button = document.createElement('button');
            button.id = action.id;
            button.className = `w-full bg-${action.color}-500 hover:bg-${action.color}-600 text-white p-2 rounded-md text-sm`;
            button.textContent = action.label;

            wrapper.appendChild(button);
            
            // Ajouter le tooltip
            const tooltipIcon = document.createElement('span');
            tooltipIcon.className = 'tooltip-icon';
            tooltipIcon.textContent = '?';
            wrapper.appendChild(tooltipIcon);
            
            const tooltipText = document.createElement('span');
            tooltipText.className = 'tooltip-text';
            tooltipText.innerHTML = `<b>${action.label}:</b> ${action.tooltip}`;
            wrapper.appendChild(tooltipText);
            
            actionButtons.appendChild(wrapper);
        });

        // Attacher les événements
        document.getElementById('action-extract').onclick = () => this.startAction('extractSubject');
        document.getElementById('action-group').onclick = () => this.startAction('group');
        document.getElementById('action-new').onclick = () => this.startAction('newConcept');
        document.getElementById('action-temporal').onclick = () => this.detectTemporalPatterns();
        document.getElementById('action-investigation').onclick = () => this.investigation.toggleMode();
        document.getElementById('check-consistency-btn').onclick = () => this.checkSemanticConsistency();
    }

    setupTabs() {
        document.getElementById('tab-n4l').onclick = () => this.switchTab('n4l');
        document.getElementById('tab-graph').onclick = () => this.switchTab('graph');
        document.getElementById('tab-timeline').onclick = () => this.switchTab('timeline');
    }

    setupDragAndDrop() {
        // Les handlers de drag & drop seront attachés dynamiquement aux éléments
        this.dragHandlers = {
            dragStart: (e) => {
                const type = e.target.dataset.type;
                const index = e.target.dataset.index;
                e.dataTransfer.setData('application/json', JSON.stringify({ type, index }));
                e.dataTransfer.effectAllowed = 'link';
            },
            dragOver: (e) => {
                e.preventDefault();
                e.target.classList.add('drop-target');
                e.dataTransfer.dropEffect = 'link';
            },
            dragLeave: (e) => {
                e.target.classList.remove('drop-target');
            },
            drop: async (e) => {
                e.preventDefault();
                e.target.classList.remove('drop-target');
                
                const sourceData = JSON.parse(e.dataTransfer.getData('application/json'));
                const destData = {
                    type: e.target.dataset.type,
                    index: parseInt(e.target.dataset.index)
                };

                if (sourceData.type === destData.type && sourceData.index == destData.index) {
                    return;
                }
                
                await this.initiateRelationship(sourceData, destData);
            }
        };
    }

    async handleUpload(e, type) {
        console.log(`LOG: Handling upload for type: ${type}`);
        const file = e.target.files[0];
        if (!file) return;
        
        this.state.fileName = file.name.replace(/\.[^/.]+$/, "");
        document.getElementById('file-name').textContent = file.name;
        
        try {
            let initialContent = '';
            if (type === 'txt') {
                const formData = new FormData();
                formData.append('textFile', file);
                const response = await fetch('/api/extract-concepts', { 
                    method: 'POST', 
                    body: formData 
                });
                if (!response.ok) throw new Error(await response.text());
                this.state.concepts = await response.json();
                initialContent = `# Fichier importé depuis ${file.name}\n\n:: general ::\n\n` + 
                    this.state.concepts.map(c => `    ${c}`).join('\n');
            } else {
                initialContent = await file.text();
            }

            this.editor.updateContent(initialContent);
            await this.editor.syncToState(initialContent);

            this.renderConcepts();
            document.getElementById('upload-view').classList.add('hidden');
            document.getElementById('editor-view').classList.remove('hidden');
            setTimeout(() => this.editor.refresh(), 10);

        } catch (error) {
            await this.utils.showModal({ 
                title: 'Erreur d\'importation', 
                text: `Une erreur est survenue: ${error.message}` 
            });
            document.getElementById('file-name').textContent = "Aucun fichier sélectionné";
        }
    }

    switchTab(tabName) {
        console.log(`LOG: Switching to tab: ${tabName}`);
        ['n4l', 'graph', 'timeline'].forEach(t => {
            document.getElementById(`${t}-view`).classList.add('hidden');
            const tabButton = document.getElementById(`tab-${t}`);
            if (tabButton) {
                tabButton.classList.remove('border-blue-500', 'text-blue-600');
                tabButton.classList.add('text-gray-500');
            }
        });
        
        document.getElementById(`${tabName}-view`).classList.remove('hidden');
        const activeTabButton = document.getElementById(`tab-${tabName}`);
        if (activeTabButton) {
            activeTabButton.classList.add('border-blue-500', 'text-blue-600');
            activeTabButton.classList.remove('text-gray-500');
        }

        if (tabName === 'n4l') {
            setTimeout(() => this.editor.refresh(), 10);
        } else if (tabName === 'graph') {
            this.graph.update();
        } else if (tabName === 'timeline') {
            this.updateTimeline();
        }
    }

    renderConcepts() {
        const conceptsList = document.getElementById('concepts-list');
        conceptsList.innerHTML = '';
        
        if (this.state.concepts.length === 0) {
            conceptsList.innerHTML = `<div class="text-center text-gray-500 text-sm p-4">Importer un .txt pour voir les phrases de base.</div>`;
            return;
        }

        this.state.concepts.forEach((concept, index) => {
            const item = document.createElement('div');
            item.className = 'concept-item p-2 border rounded-md cursor-pointer hover:bg-gray-100 text-sm';
            item.textContent = `[${index}] ${concept}`;
            item.dataset.index = index;
            item.dataset.type = 'concept';
            item.draggable = true;
            
            // Attacher les handlers de drag & drop
            item.addEventListener('dragstart', this.dragHandlers.dragStart);
            item.addEventListener('dragover', this.dragHandlers.dragOver);
            item.addEventListener('dragleave', this.dragHandlers.dragLeave);
            item.addEventListener('drop', this.dragHandlers.drop);
            
            item.onclick = () => this.handleItemClick('concept', index);
            
            if (this.state.selectedSource?.type === 'concept' && 
                this.state.selectedSource.index === index) {
                item.classList.add('selected-source');
            }
            if (this.state.selectedDest?.type === 'concept' && 
                this.state.selectedDest.index === index) {
                item.classList.add('selected-dest');
            }
            if (this.state.selectedChildren.some(c => c.type === 'concept' && c.index === index)) {
                item.classList.add('selected-child');
            }
            
            conceptsList.appendChild(item);
        });
    }

    renderSubjects() {
        const subjectsList = document.getElementById('subjects-list');
        subjectsList.innerHTML = '';
        
        this.state.subjects.forEach((subject, index) => {
            const item = document.createElement('div');
            item.className = 'subject-item p-2 border rounded-md cursor-pointer hover:bg-gray-200 text-sm bg-white';
            item.textContent = `[S${index}] ${subject}`;
            item.dataset.index = index;
            item.dataset.type = 'subject';
            item.draggable = true;
            
            // Attacher les handlers de drag & drop
            item.addEventListener('dragstart', this.dragHandlers.dragStart);
            item.addEventListener('dragover', this.dragHandlers.dragOver);
            item.addEventListener('dragleave', this.dragHandlers.dragLeave);
            item.addEventListener('drop', this.dragHandlers.drop);
            
            item.onclick = () => this.handleItemClick('subject', index);
            
            if (this.state.selectedSource?.type === 'subject' && 
                this.state.selectedSource.index === index) {
                item.classList.add('selected-source');
            }
            if (this.state.selectedDest?.type === 'subject' && 
                this.state.selectedDest.index === index) {
                item.classList.add('selected-dest');
            }
            if (this.state.selectedChildren.some(c => c.type === 'subject' && c.index === index)) {
                item.classList.add('selected-child');
            }
            
            subjectsList.appendChild(item);
        });
    }

    async startAction(action) {
        if (this.state.currentAction === 'group' && action === 'group') {
            await this.completeGroupAction();
            return;
        }
        
        this.resetSelection(false);
        this.state.currentAction = action;
        
        if (action === 'newConcept') {
            const result = await this.utils.showModal({
                title: "Nouveau Sujet",
                text: "Entrez le texte du nouveau sujet :",
                prompt: true
            });
            if (result && result.text) {
                this.editor.addNote(`    ${result.text}`);
            }
            this.resetSelection();
        } else {
            document.getElementById('help-panel').innerHTML = this.getInstructionsForAction(action);
        }
    }

    getInstructionsForAction(action, step = 1) {
        switch(action) {
            case 'extractSubject':
                return `<b>Extraction :</b> Sélectionnez une <span class="text-blue-500">phrase</span> pour en extraire un sujet.`;
            case 'group':
                return `<b>Groupe :</b> Sélectionnez un ou plusieurs <span class="text-purple-500">éléments ENFANTS</span>. Cliquez de nouveau sur le bouton 'Groupe' pour terminer.`;
            default:
                return 'Choisissez une action.';
        }
    }

    async handleItemClick(type, index) {
        if (this.state.currentAction === 'group') {
            const selection = { type, index };
            const childIndex = this.state.selectedChildren.findIndex(c => 
                c.type === type && c.index === index);
            
            if (childIndex > -1) {
                this.state.selectedChildren.splice(childIndex, 1);
            } else {
                this.state.selectedChildren.push(selection);
            }
            this.renderConcepts();
            this.renderSubjects();
        } else if (this.state.currentAction === 'extractSubject' && type === 'concept') {
            const result = await this.utils.showModal({
                title: "Extraire un Sujet",
                text: `Entrez le mot à  extraire de : "${this.state.concepts[index]}"`,
                prompt: true,
                inputValue: window.getSelection().toString()
            });
            if (result && result.text) {
                this.editor.addNote(`    ${this.state.concepts[index]} -> a pour sujet -> ${result.text}`);
                this.resetSelection();
            }
        }
    }

    async completeGroupAction() {
        if (this.state.selectedChildren.length === 0) {
            await this.utils.showModal({
                title: "Action annulée",
                text: "Aucun élément sélectionné."
            });
            this.resetSelection();
            return;
        }
        
        const result = await this.utils.showModal({
            title: "Parent du Groupe",
            text: "Entrez le texte du parent:",
            prompt: true
        });
        
        if (result && result.text) {
            // Sauvegarder l'état avant le changement
            this.history.previousGraphState = JSON.parse(JSON.stringify(this.state.allGraphData));
            
            const childrenTexts = this.state.selectedChildren.map(c => 
                c.type === 'concept' ? `"${this.state.concepts[c.index]}"` : this.state.subjects[c.index]
            );
            this.editor.addNote(`    ${result.text} => { ${childrenTexts.join('; ')} }`);
            
            // Tracker le changement
            this.history.trackChange('group_created', {
                parent: result.text,
                children: childrenTexts
            });
        }
        this.resetSelection();
    }

    async saveCurrentVersion() {
        await this.history.saveVersion();
    }

    resetSelection(fullRender = true) {
        this.state.currentAction = null;
        this.state.selectedSource = null;
        this.state.selectedDest = null;
        this.state.selectedChildren = [];
        document.getElementById('help-panel').innerHTML = 
            'Commencez par <strong>Extraire un Sujet</strong> ou utilisez l\'<strong>IA</strong>.';
        
        if (fullRender) {
            this.renderConcepts();
            this.renderSubjects();
        }
    }

    async initiateRelationship(source, dest) {
        const sourceText = source.type === 'concept' ? 
            `"${this.state.concepts[source.index]}"` : this.state.subjects[source.index];
        const destText = dest.type === 'concept' ? 
            `"${this.state.concepts[dest.index]}"` : this.state.subjects[dest.index];
        
        const result = await this.utils.showModal({
            title: "Créer une Relation",
            text: `Définir la relation entre <b>${sourceText}</b> et <b>${destText}</b>:`,
            prompt: true,
            showSuggestions: true,
            isHtml: true,
            showLearningHint: true,
            learningSubject: sourceText
        });

        if (result && result.text) {
            // Sauvegarder l'état avant le changement
            this.history.previousGraphState = JSON.parse(JSON.stringify(this.state.allGraphData));
            
            if (result.isLearningSubject) {
                this.editor.addNote(`    ${sourceText} -> ${result.text} -> ${destText}`);
            } else {
                this.editor.addNote(`    ${destText} -> est ${result.text} de -> ${sourceText}`);
            }
            
            // Tracker le changement
            this.history.trackChange('relation_added', {
                from: sourceText,
                to: destText,
                relation: result.text
            });
        }
        this.resetSelection();
    }

    async autoExtractSubjects() {
        const fullText = this.state.concepts.join('. ');
        if (fullText.trim() === '') {
            await this.utils.showModal({
                title: 'Action impossible',
                text: 'Aucun texte à  analyser. Veuillez importer un fichier .txt en premier.'
            });
            return;
        }
        
        const btn = document.getElementById('ai-extract-btn');
        btn.disabled = true;
        document.getElementById('help-panel').innerHTML = 
            '<div class="spinner"></div> Analyse IA en cours...';
        
        try {
            const response = await fetch('/api/auto-extract-subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: fullText
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }
            
            const suggestedSubjects = await response.json();
            if (suggestedSubjects.length === 0) {
                document.getElementById('help-panel').innerHTML = 
                    "L'IA n'a trouvé aucun sujet pertinent à  extraire.";
            } else {
                const newNotes = suggestedSubjects.map(s => 
                    `    # Sujet extrait par IA\n    ${s}\n`
                ).join('');
                this.editor.addNote(`\n\n:: Sujets IA ::\n\n${newNotes}`);
                document.getElementById('help-panel').innerHTML = 
                    `${suggestedSubjects.length} sujets suggérés par l'IA et ajoutés à  l'éditeur.`;
            }
        } catch (error) {
            console.error("Erreur IA:", error);
            await this.utils.showModal({
                title: 'Erreur IA',
                text: `Une erreur est survenue: ${error.message}`
            });
        } finally {
            btn.disabled = false;
        }
    }

    async detectTemporalPatterns() {
        console.log("LOG: Detecting temporal patterns...");
        const btn = document.getElementById('action-temporal');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<div class="spinner"></div> Analyse...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/detect-temporal-patterns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state.n4lNotes)
            });
            
            if (!response.ok) throw new Error(await response.text());
            
            const patterns = await response.json();
            
            btn.innerHTML = originalContent;
            btn.disabled = false;
            
            await this.displayTemporalPatterns(patterns);
            
        } catch (error) {
            console.error("Erreur détection temporelle:", error);
            btn.innerHTML = originalContent;
            btn.disabled = false;
            
            await this.utils.showModal({
                title: 'Erreur',
                text: `Erreur: ${error.message}`
            });
        }
    }

    async displayTemporalPatterns(patterns) {
        if (!patterns || patterns.length === 0) {
            await this.utils.showModal({
                title: 'Aucun pattern temporel détecté',
                text: 'Aucun marqueur temporel trouvé dans vos notes.'
            });
            return;
        }
        
        window.temporalSuggestions = [];
        
        let htmlContent = '<div class="space-y-4 max-h-96 overflow-y-auto">';
        
        patterns.forEach(pattern => {
            htmlContent += '<div class="border rounded-lg p-3 bg-orange-50 border-orange-400">';
            htmlContent += `<div class="font-semibold text-orange-800 mb-2">Pattern: ${pattern.pattern}</div>`;
            
            if (pattern.occurrences && pattern.occurrences.length > 0) {
                htmlContent += '<div class="mb-2"><div class="text-sm font-medium text-gray-700 mb-1">Occurrences trouvées:</div>';
                pattern.occurrences.forEach(occ => {
                    htmlContent += `<div class="text-xs bg-white p-2 rounded mb-1 border border-orange-200">${occ}</div>`;
                });
                htmlContent += '</div>';
            }
            
            if (pattern.suggestions && pattern.suggestions.length > 0) {
                htmlContent += '<div class="border-t pt-2"><div class="text-sm font-medium text-gray-700 mb-1">Suggestions:</div>';
                pattern.suggestions.forEach(suggestion => {
                    const idx = window.temporalSuggestions.length;
                    window.temporalSuggestions.push(suggestion);
                    htmlContent += `<div class="flex items-center justify-between bg-white p-2 rounded mb-1 border border-gray-200">`;
                    htmlContent += `<span class="text-xs text-gray-800">${suggestion}</span>`;
                    htmlContent += `<button onclick="window.app.applyTemporalSuggestion(${idx})" class="ml-2 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs">Appliquer</button>`;
                    htmlContent += '</div>';
                });
                htmlContent += '</div>';
            }
            htmlContent += '</div>';
        });
        
        htmlContent += '</div>';
        
        await this.utils.showModal({
            title: 'Patterns Temporels Détectés',
            text: htmlContent,
            isHtml: true
        });
    }

    applyTemporalSuggestion(idx) {
        let suggestionText = window.temporalSuggestions[idx];
        if (suggestionText) {
            document.getElementById('modal').classList.add('hidden');
            
            let targetContext = this.state.currentContext || 'general';
            
            if (suggestionText.includes("Ajouter au contexte 'Chronologie'")) {
                targetContext = 'Chronologie';
                const parts = suggestionText.split(':');
                if (parts.length > 1) {
                    suggestionText = parts[1].trim();
                }
            }
            
            if (suggestionText.includes("Marquer") && suggestionText.includes("comme repà¨re temporel")) {
                const match = suggestionText.match(/'([^']+)'/);
                if (match) {
                    suggestionText = `# Repà¨re temporel: ${match[1]}`;
                }
            }
            
            this.state.currentContext = targetContext;
            document.getElementById('context-input').value = targetContext;
            
            this.editor.addNote(`    ${suggestionText}`);
            document.getElementById('help-panel').innerHTML = 
                `<span class="text-green-600">âœ” Pattern temporel appliqué !</span>`;
        }
    }

    async checkSemanticConsistency() {
        console.log("LOG: Checking semantic consistency...");
        
        if (this.state.allGraphData.nodes.length === 0) {
            await this.utils.showModal({
                title: 'Graphe vide',
                text: 'Veuillez d\'abord créer des relations dans le graphe.'
            });
            return;
        }
        
        const btn = document.getElementById('check-consistency-btn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<div class="spinner"></div> Analyse...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/check-consistency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state.allGraphData)
            });
            
            if (!response.ok) throw new Error(await response.text());
            
            const inconsistencies = await response.json();
            await this.displayInconsistencies(inconsistencies);
            
        } catch (error) {
            console.error("Erreur vérification cohérence:", error);
            await this.utils.showModal({
                title: 'Erreur',
                text: `Erreur lors de la vérification: ${error.message}`
            });
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }

    async displayInconsistencies(inconsistencies) {
        if (!inconsistencies || inconsistencies.length === 0) {
            await this.utils.showModal({
                title: 'âœ… Graphe cohérent',
                text: 'Aucune incohérence détectée dans votre graphe de connaissances. Excellent travail !',
                isHtml: true
            });
            return;
        }
        
        // Créer le HTML pour afficher les incohérences
        let htmlContent = '<div class="space-y-4 max-h-96 overflow-y-auto">';
        
        const grouped = {
            error: [],
            warning: [],
            info: []
        };
        
        inconsistencies.forEach(inc => {
            grouped[inc.severity].push(inc);
        });
        
        if (grouped.error.length > 0) {
            htmlContent += this.createInconsistencySection('Erreurs critiques', grouped.error, 'red');
        }
        
        if (grouped.warning.length > 0) {
            htmlContent += this.createInconsistencySection('Avertissements', grouped.warning, 'yellow');
        }
        
        if (grouped.info.length > 0) {
            htmlContent += this.createInconsistencySection('Suggestions', grouped.info, 'blue');
        }
        
        htmlContent += '</div>';
        
        await this.utils.showModal({
            title: 'ðŸ” Analyse de Cohérence Sémantique',
            text: htmlContent,
            isHtml: true
        });
    }

    createInconsistencySection(title, items, color) {
        let html = `<div class="mb-4">`;
        html += `<h3 class="font-semibold text-${color}-600 mb-2">${title}</h3>`;
        
        items.forEach(item => {
            html += `<div class="border-l-4 border-${color}-400 bg-${color}-50 p-3 mb-2 rounded">`;
            html += `<div class="text-xs font-semibold text-gray-600 mb-1">${this.getInconsistencyTypeLabel(item.type)}</div>`;
            html += `<div class="text-sm text-gray-800 mb-2">${item.description}</div>`;
            
            if (item.nodes && item.nodes.length > 0) {
                html += '<div class="flex flex-wrap gap-1 mb-2">';
                item.nodes.forEach(node => {
                    html += `<span class="bg-white px-2 py-1 rounded text-xs border cursor-pointer hover:bg-gray-100" 
                             onclick="window.app.graph.highlightNodes(['${node}'])">${node}</span>`;
                });
                html += '</div>';
            }
            
            if (item.suggestion) {
                html += `<div class="text-xs text-gray-600 italic">ðŸ’¡ ${item.suggestion}</div>`;
            }
            
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    }

    getInconsistencyTypeLabel(type) {
        const labels = {
            'temporal_cycle': 'ðŸ”„ Boucle temporelle',
            'contradictory_relations': 'âš¡ Relations contradictoires',
            'inconsistent_equivalence': 'â‰  à‰quivalence incohérente',
            'orphan_node': 'ðŸï¸ NÅ“ud isolé',
            'disconnected_group': 'ðŸ“¦ Groupe déconnecté'
        };
        return labels[type] || type;
    }

    async updateTimeline() {
        console.log("LOG: Updating timeline with notes:", this.state.n4lNotes);
        try {
            const response = await fetch('/api/timeline-data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.state.n4lNotes)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const events = await response.json();
            console.log("LOG: Received timeline events:", events);
            
            // Vérifier que la vue timeline est visible
            const timelineView = document.getElementById('timeline-view');
            if (!timelineView) {
                console.error('LOG: Timeline view not found');
                return;
            }
            
            const container = document.getElementById('timeline-container');
            if (!container) {
                console.error('LOG: Timeline container not found');
                return;
            }
            
            // Vider le container
            container.innerHTML = '';
            console.log("LOG: Container cleared");
            
            if (!events || events.length === 0) {
                container.innerHTML = `<div class="text-center text-gray-500 p-8">Aucun événement chronologique détecté. Ajoutez des marqueurs temporels dans vos notes (ex: "22h", "lendemain", "soirée").</div>`;
                console.log("LOG: No events message displayed");
                return;
            }
            
            // Créer les éléments de timeline
            events.forEach((event, index) => {
                console.log(`LOG: Creating timeline item ${index}:`, event);
                
                const item = document.createElement('div');
                item.className = 'timeline-item pb-4';
                
                const timeElement = document.createElement('p');
                timeElement.className = 'font-semibold text-indigo-600';
                timeElement.textContent = event.timeHint || 'à‰vénement';
                
                const descElement = document.createElement('p');
                descElement.className = 'text-sm text-gray-700';
                descElement.textContent = event.description || '';
                
                item.appendChild(timeElement);
                item.appendChild(descElement);
                container.appendChild(item);
                
                console.log(`LOG: Timeline item ${index} added to container`);
            });
            
            console.log("LOG: Timeline update complete");
            
        } catch (error) {
            console.error('LOG: Erreur timeline:', error);
            const container = document.getElementById('timeline-container');
            if (container) {
                container.innerHTML = `<div class="text-center text-red-500 p-8">Erreur lors du chargement de la chronologie: ${error.message}</div>`;
            }
        }
    }

    async downloadN4LFile() {
        // Proposer de sauvegarder une version avant téléchargement
        const shouldSave = await this.utils.showModal({
            title: 'Sauvegarder avant téléchargement?',
            text: 'Voulez-vous créer une version sauvegardée avant de télécharger?',
            confirm: true
        });
        
        if (shouldSave) {
            await this.history.saveVersion('Version avant téléchargement');
        }
        
        const content = this.editor.getValue();
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.state.fileName}.n4l`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialiser l'application au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    window.app = new N4LApp();
    window.app.history = window.app.history;
    window.app.density = window.app.density;
});