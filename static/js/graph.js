// Module de gestion du graphe

export class GraphManager {
    constructor(app) {
        this.app = app;
        this.graph = null;
        this.currentViewMode = 'standard';
    }

    init() {
        this.setupGraphControls();
        this.setupSearchAndFilter();
        this.setupViewModes();
        this.setupFullscreen();
    }

    setupGraphControls() {
        const controlsHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                    <label class="font-semibold">Analyse du Graphe</label>
            <div class="flex items-center space-x-2 text-xs flex-wrap gap-y-2 mt-1">
                <div class="tooltip-container">
                    <button id="analyze-hubs" class="bg-yellow-500 text-white px-2 py-1 rounded-md">Hubs</button>
                    <span class="tooltip-text">Met en évidence les nœuds les plus connectés (hubs) du graphe.</span>
                </div>
                <div class="tooltip-container">
                    <button id="analyze-sources" class="bg-green-500 text-white px-2 py-1 rounded-md">Sources</button>
                    <span class="tooltip-text">Met en évidence les nœuds qui sont à l'origine des relations (sources).</span>
                </div>
                <div class="tooltip-container">
                    <button id="analyze-sinks" class="bg-red-500 text-white px-2 py-1 rounded-md">Sinks</button>
                    <span class="tooltip-text">Met en évidence les nœuds qui ne font que recevoir des relations (puits).</span>
                </div>
                <div class="tooltip-container">
                    <button id="analyze-reset" class="bg-gray-500 text-white px-2 py-1 rounded-md">Reset</button>
                    <span class="tooltip-text">Annule la mise en évidence et réinitialise la vue du graphe.</span>
                </div>
                <div class="tooltip-container">
                    <button id="ai-analyze-btn" class="bg-cyan-500 text-white px-2 py-1 rounded-md flex items-center">
                        Synthése IA
                    </button>
                    <span class="tooltip-text">Demande à l'IA de générer un résumé et une analyse complète du graphe actuel.</span>
                </div>
                <div class="tooltip-container">
                    <button id="generate-questions-btn" class="bg-emerald-500 text-white px-2 py-1 rounded-md text-xs flex items-center">
                        Questions
                    </button>
                    <span class="tooltip-text">Laisse l'IA analyser le graphe pour suggérer des questions d'investigation pertinentes.</span>
                </div>
            </div>
                    <div class="mt-2">
                        <label class="font-semibold text-xs">Visualisation</label>
                        <div class="flex items-center space-x-2 mt-1">
                            <div class="tooltip-container">
                                <button id="view-standard" class="bg-gray-500 text-white px-2 py-1 rounded-md text-xs">Standard</button>
                                <span class="tooltip-text">Affiche le graphe avec une disposition dynamique qui organise les nœuds pour minimiser les croisements de liens.</span>
                            </div>
                            <div class="tooltip-container">
                                <button id="view-density" class="bg-blue-500 text-white px-2 py-1 rounded-md text-xs">Densité</button>
                                <span class="tooltip-text">Visualisez les zones de forte et faible densité de votre graphe de connaissances.</span>
                            </div>
                            <div class="tooltip-container">
                                <button id="view-layered" class="bg-teal-500 text-white px-2 py-1 rounded-md text-xs">Couches</button>
                                <span class="tooltip-text">Organise les nœuds en couches sémantiques (Acteurs, Lieux...) pour une vue thématique.</span>
                            </div>
                            <div class="tooltip-container">
                                <button id="view-circular" class="bg-pink-500 text-white px-2 py-1 rounded-md text-xs">Circulaire</button>
                                <span class="tooltip-text">Dispose les nœuds en cercle, ce qui est utile pour visualiser les relations globales et les cycles.</span>
                            </div>
                            <div class="tooltip-container">
                                <button id="view-hierarchical" class="bg-amber-500 text-white px-2 py-1 rounded-md text-xs">Hiérarchique</button>
                                <span class="tooltip-text">Arrange le graphe en une structure arborescente pour montrer les dépendances et la hiérarchie.</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div>
                    <label class="font-semibold">Détecteur d'Histoires</label>
                    <div class="flex items-center space-x-2 mt-1">
                        <button id="discover-paths-btn" class="bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded-md text-xs w-full transition-colors">
                            Découvrir les histoires
                        </button>
                    </div>
                </div>
            
            <div class="flex items-center space-x-4 mt-2">
                <input type="text" id="search-node" placeholder="Rechercher un nœud..." class="p-1 border rounded-md text-xs w-40">
                <select id="context-filter" class="p-1 border rounded-md text-xs">
                    <option value="">Filtrer par contexte...</option>
                </select>
            </div>

            <div class="flex items-center space-x-2 mt-1">
                <input type="text" id="cluster-search-input" 
                        placeholder="Termes séparés par virgule..." 
                        class="p-1 border rounded-md text-xs flex-grow">
                
                <button id="cluster-search-btn" 
                        class="bg-purple-500 text-white px-4 py-2 rounded-md text-sm">
                    Rechercher Clusters
                </button>
                
                <button id="cluster-analyze-btn" 
                        class="bg-sky-500 text-white px-4 py-2 rounded-md text-sm hidden items-center">
                    Synthèse IA
                </button>
            </div>
        `;

        const controlsContainer = document.getElementById('graph-controls');
        if (controlsContainer) {
            controlsContainer.innerHTML = controlsHTML;
        }

        document.getElementById('discover-paths-btn')?.addEventListener('click', () => {
            if (this.app.history && this.app.history.showStoriesModal) {
                this.app.history.showStoriesModal();
            }
        });

        // Ajouter la légende des couches
        const legendHTML = `
            <div id="layer-legend" class="hidden absolute bottom-2 left-2 bg-white p-2 rounded shadow-lg text-xs">
                <h4 class="font-bold mb-2">Légende des Couches</h4>
                <div class="space-y-1">
                    <div class="flex items-center">
                        <span class="w-4 h-4 bg-blue-500 rounded-full mr-2"></span>
                        <span>Acteurs</span>
                    </div>
                    <div class="flex items-center">
                        <span class="w-4 h-4 bg-green-500 rounded mr-2"></span>
                        <span>Lieux</span>
                    </div>
                    <div class="flex items-center">
                        <span class="w-4 h-4 bg-yellow-500 transform rotate-45 mr-2"></span>
                        <span>èvénements</span>
                    </div>
                    <div class="flex items-center">
                        <span class="w-4 h-4 bg-red-500 triangle mr-2"></span>
                        <span>Preuves</span>
                    </div>
                    <div class="flex items-center">
                        <span class="w-4 h-4 bg-purple-500 rounded-sm mr-2"></span>
                        <span>Concepts</span>
                    </div>
                </div>
            </div>
        `;

        const graphView = document.getElementById('graph-view');
        if (graphView && !document.getElementById('layer-legend')) {
            graphView.insertAdjacentHTML('beforeend', legendHTML);
        }

        // Attacher les événements aprÃ¨s avoir créé les éléments
        setTimeout(() => {
            this.attachGraphControlEvents();
        }, 100);
    }

    attachGraphControlEvents() {
        const handlers = {
            'analyze-hubs': () => this.highlightHubs(),
            'analyze-sources': () => this.highlightSources(),
            'analyze-sinks': () => this.highlightSinks(),
            'analyze-reset': () => this.resetHighlight(),
            'ai-analyze-btn': () => this.analyzeWithAI(),
            'generate-questions-btn': () => this.generateQuestions(),
            'discover-paths-btn': () => this.discoverAllPaths(),
            'cluster-search-btn': () => this.findAndHighlightClusters(),
            'cluster-analyze-btn': () => this.analyzeClustersWithAI(),
            'view-standard': () => this.switchViewMode('standard'),
            'view-layered': () => this.switchViewMode('layered'),
            'view-circular': () => this.switchViewMode('circular'),
            'view-hierarchical': () => this.switchViewMode('hierarchical'),
            'view-density': () => this.app.density.toggleDensityView()
        };

        for (const [id, handler] of Object.entries(handlers)) {
            const element = document.getElementById(id);
            if (element) {
                element.onclick = handler;
            }
        }
    }

    setupSearchAndFilter() {
        const searchInput = document.getElementById('search-node');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchNode(e.target.value));
        }

        const contextFilter = document.getElementById('context-filter');
        if (contextFilter) {
            contextFilter.addEventListener('change', (e) => this.filterByContext(e.target.value));
        }
    }

    setupViewModes() {
        // Les boutons de vue sont déjà attachés dans attachGraphControlEvents
    }

    async update() {
        console.log("LOG: Updating graph...");
        try {
            const response = await fetch('/api/graph-data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.app.state.n4lNotes)
            });
            
            if (!response.ok) throw new Error(await response.text());
            
            this.app.state.allGraphData = await response.json();

            // Filtrer les nœuds et arêtes invalides avant de les utiliser
            const validNodes = this.app.state.allGraphData.nodes.filter(n => n.id && String(n.id).trim() !== '');
            const validEdges = this.app.state.allGraphData.edges.filter(e => e.from && String(e.from).trim() !== '' && e.to && String(e.to).trim() !== '');

            const nodes = new vis.DataSet(validNodes.map(n => ({
                ...n,
                color: this.getNodeColor(n)
            })));
            
            const edges = new vis.DataSet(validEdges.map((e, index) => ({
                ...e,
                id: `edge-${index}`, // ID unique basé sur l'index
                color: this.getEdgeColor(e.type),
                arrows: e.type === 'equivalence' ? 'to, from' : 'to'
            })));

            const options = this.getGraphOptions();

            if (this.graph) {
                if (this.currentViewMode === 'standard') {
                    this.graph.setOptions(options);
                }
                this.graph.setData({ nodes, edges });
            } else {
                this.graph = new vis.Network(
                    document.getElementById('graph-container'),
                    { nodes, edges },
                    options
                );
                
                // Gestion du clic droit
                this.graph.on("oncontext", (params) => this.handleGraphRightClick(params));
            }
        } catch (error) {
            console.error('LOG: Erreur graphe:', error);
        }
    }

    getGraphOptions() {
        return {
            nodes: {
                shape: 'box',
                font: { size: 14, color: '#333' },
                margin: 10,
                widthConstraint: { maximum: 150 }
            },
            edges: {
                font: {
                    align: 'horizontal',
                    size: 11,
                    strokeWidth: 3,
                    strokeColor: '#ffffff'
                },
                smooth: {
                    type: 'cubicBezier',
                    forceDirection: 'none',
                    roundness: 0.5
                }
            },
            physics: {
                enabled: true,
                solver: 'forceAtlas2Based',
                forceAtlas2Based: {
                    gravitationalConstant: -50,
                    centralGravity: 0.01,
                    springLength: 150,
                    springConstant: 0.08,
                    damping: 0.4,
                    avoidOverlap: 1
                },
                stabilization: {
                    enabled: true,
                    iterations: 100
                }
            },
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true
            }
        };
    }

    getNodeColor(node) {
        return {
            border: '#4f46e5',
            background: 'white',
            highlight: {
                border: '#ef4444',
                background: '#fecaca'
            }
        };
    }

    getEdgeColor(type) {
        switch(type) {
            case 'relation':
                return { color: '#3b82f6', highlight: '#1d4ed8' };
            case 'equivalence':
                return { color: '#22c55e', highlight: '#15803d' };
            case 'group':
                return { color: '#a855f7', highlight: '#7e22ce' };
            default:
                return { color: '#6b7280', highlight: '#374151' };
        }
    }

    handleGraphRightClick(params) {
        params.event.preventDefault();
        const nodeId = this.graph.getNodeAt(params.pointer.DOM);
        if (!nodeId) {
            document.getElementById('node-context-menu').classList.add('hidden');
            return;
        }
    
        const menu = document.getElementById('node-context-menu');
        menu.innerHTML = ''; // Vider le menu
    
        // --- Option 1: Cône d'expansion ---
        const coneOption = document.createElement('a');
        coneOption.textContent = "Explorer le cône d'expansion";
        coneOption.onclick = async () => {
            menu.classList.add('hidden');
            const result = await this.app.utils.showModal({
                title: "Profondeur d'exploration",
                text: "Entrez la profondeur du cône d'expansion :",
                prompt: true,
                inputType: 'number',
                inputValue: 2
            });
            if (result && result.text) {
                const depth = parseInt(result.text, 10);
                if (depth > 0) {
                    this.showExpansionCone(nodeId, depth);
                }
            }
        };
        menu.appendChild(coneOption);
    
        // --- Option 2: Réinitialiser la vue ---
        const resetOption = document.createElement('a');
        resetOption.textContent = "Réinitialiser la vue";
        resetOption.onclick = () => {
            menu.classList.add('hidden');
            this.resetHighlight();
        };
        menu.appendChild(resetOption);
    
        // --- Option 3: Reclassifier ---
        const reclassifyHeader = document.createElement('div');
        reclassifyHeader.className = 'px-4 py-2 text-xs text-gray-500 border-t mt-1';
        reclassifyHeader.textContent = `Reclassifier "${nodeId}" dans:`;
        menu.appendChild(reclassifyHeader);
    
        const contexts = ['Personnages', 'Lieux', 'Chronologie', 'Indices et Preuves', 'Relations'];
        contexts.forEach(context => {
            const link = document.createElement('a');
            link.textContent = context;
            link.onclick = () => {
                this.reclassifyNode(nodeId, context);
                menu.classList.add('hidden');
            };
            menu.appendChild(link);
        });
    
        menu.style.top = `${params.event.pageY}px`;
        menu.style.left = `${params.event.pageX}px`;
        menu.classList.remove('hidden');
    
        // Cacher le menu si on clique ailleurs
        document.body.onclick = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.body.onclick = null;
            }
        };
    }
    

    reclassifyNode(nodeLabel, newContext) {
        let noteFoundAndMoved = false;
        
        for (const oldContext in this.app.state.n4lNotes) {
            const notesToKeep = [];
            const notesToMove = [];
            
            this.app.state.n4lNotes[oldContext].forEach(note => {
                const nodeRegex = new RegExp(`\\b${this.escapeRegExp(nodeLabel)}\\b`);
                if (note.match(nodeRegex)) {
                    notesToMove.push(note);
                } else {
                    notesToKeep.push(note);
                }
            });

            if (notesToMove.length > 0) {
                this.app.state.n4lNotes[oldContext] = notesToKeep;
                if (!this.app.state.n4lNotes[newContext]) {
                    this.app.state.n4lNotes[newContext] = [];
                }
                this.app.state.n4lNotes[newContext].push(...notesToMove);
                noteFoundAndMoved = true;
            }
        }

        if (noteFoundAndMoved) {
            this.app.editor.renderStateToEditor();
            this.app.editor.syncToState(this.app.editor.getValue());
            document.getElementById('help-panel').innerHTML = 
                `✅ "${nodeLabel}" a été reclassifié dans le contexte "${newContext}".`;
        }
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    searchNode(query) {
        if (!this.graph) return;
        const lowerQuery = query.toLowerCase();
        const nodeIds = this.app.state.allGraphData.nodes
            .filter(n => n.label.toLowerCase().includes(lowerQuery))
            .map(n => n.id);
        
        this.graph.selectNodes(nodeIds);
        if (nodeIds.length > 0) {
            this.graph.focus(nodeIds[0], { scale: 1.2, animation: true });
        }
    }

    filterByContext(context) {
        if (!this.graph) return;
        
        const contextFilter = document.getElementById('context-filter');
        if (contextFilter) {
            contextFilter.value = context;
        }

        this.app.editor.renderContextsPanel();

        if (!context) {
            this.update(); // Just redraw the full graph
            return;
        }

        const filteredNodes = this.app.state.allGraphData.nodes.filter(n => n.context === context);
        const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredEdges = this.app.state.allGraphData.edges.filter(e => 
            filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to)
        );

        this.graph.setData({
            nodes: new vis.DataSet(filteredNodes.map(n => ({...n, color: this.getNodeColor(n)}))),
            edges: new vis.DataSet(filteredEdges.map((e, index) => ({
                ...e,
                id: `edge-filtered-${index}`,
                color: this.getEdgeColor(e.type),
                arrows: e.type === 'equivalence' ? 'to, from' : 'to'
            })))
        });
    }

    highlightHubs() {
        const degree = {};
        this.app.state.allGraphData.edges.forEach(edge => {
            degree[edge.from] = (degree[edge.from] || 0) + 1;
            degree[edge.to] = (degree[edge.to] || 0) + 1;
        });
        const hubs = Object.keys(degree).filter(id => degree[id] > 2);
        this.highlightNodes(hubs, '#f59e0b');
    }

    highlightSources() {
        const targets = new Set(this.app.state.allGraphData.edges.map(e => e.to));
        const sources = this.app.state.allGraphData.nodes
            .filter(n => !targets.has(n.id))
            .map(n => n.id);
        this.highlightNodes(sources, '#22c55e');
    }

    highlightSinks() {
        const sources = new Set(this.app.state.allGraphData.edges.map(e => e.from));
        const sinks = this.app.state.allGraphData.nodes
            .filter(n => !sources.has(n.id))
            .map(n => n.id);
        this.highlightNodes(sinks, '#ef4444');
    }

    highlightNodes(nodeIds, color = null) {
        if (!this.graph) return;
        
        const nodes = new vis.DataSet(this.app.state.allGraphData.nodes.map(n => {
            const isHighlighted = nodeIds.includes(n.id) || nodeIds.includes(n.label);
            return {
                ...n,
                color: color ? {
                    border: isHighlighted ? color : '#4f46e5',
                    background: isHighlighted ? color + '33' : 'white'
                } : {
                    border: isHighlighted ? '#dc2626' : '#4f46e5',
                    background: isHighlighted ? '#fecaca' : 'white'
                }
            };
        }));
        
        const edges = new vis.DataSet(this.app.state.allGraphData.edges.map((e, index) => ({
            ...e,
            id: `edge-${index}`,
            color: this.getEdgeColor(e.type),
            arrows: e.type === 'equivalence' ? 'to, from' : 'to'
        })));
        
        this.graph.setData({ nodes, edges });
        
        if (nodeIds.length > 0) {
            const firstNode = this.app.state.allGraphData.nodes.find(n => 
                nodeIds.includes(n.id) || nodeIds.includes(n.label)
            );
            if (firstNode) {
                this.graph.focus(firstNode.id, {
                    scale: 1.5,
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }
        }
    }

    resetHighlight() {
        this.filterByContext('');
        const pathsContainer = document.getElementById('paths-list-container');
        if (pathsContainer) {
            pathsContainer.innerHTML = '';
        }
        // AJOUTEZ CES LIGNES
        const analyzeBtn = document.getElementById('cluster-analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.classList.add('hidden');
        }
        this.app.state.currentClusters = null;
    }

    async analyzeWithAI() {
        if (this.app.state.allGraphData.nodes.length === 0) {
            await this.app.utils.showModal({
                title: 'Action impossible',
                text: 'Le graphe est vide. Ajoutez des relations avant de lancer l\'analyse.'
            });
            return;
        }

        const btn = document.getElementById('ai-analyze-btn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<div class="spinner"></div> Analyse...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/analyze-graph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.app.state.allGraphData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }
            
            const analysis = await response.text();
            await this.app.utils.showModal({
                title: 'Synthèse du Graphe par l\'IA',
                text: analysis,
                showSave: true
            });
            
        } catch (error) {
            console.error("Erreur Analyse IA:", error);
            await this.app.utils.showModal({
                title: 'Erreur Analyse IA',
                text: `Une erreur est survenue: ${error.message}`
            });
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }

    async generateQuestions() {
        console.log("LOG: Generating investigation questions");
        
        if (this.app.state.allGraphData.nodes.length === 0) {
            await this.app.utils.showModal({
                title: 'Graphe vide',
                text: 'Ajoutez des éléments au graphe pour générer des questions d\'investigation.'
            });
            return;
        }
        
        const btn = document.getElementById('generate-questions-btn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<div class="spinner"></div> Analyse...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.app.state.allGraphData)
            });
            
            if (!response.ok) {
                throw new Error(await response.text());
            }
            
            const questions = await response.json();
            console.log("LOG: Received questions:", questions);
            
            btn.innerHTML = originalContent;
            btn.disabled = false;
            
            await this.displayInvestigationQuestions(questions);
            
        } catch (error) {
            console.error("Erreur génération questions:", error);
            btn.innerHTML = originalContent;
            btn.disabled = false;
            
            await this.app.utils.showModal({
                title: 'Erreur',
                text: `Erreur lors de la génération des questions: ${error.message}`
            });
        }
    }

    async displayInvestigationQuestions(questions) {
        window.questionsData = [];
        
        if (!questions || questions.length === 0) {
            await this.app.utils.showModal({
                title: '✅ Enquête complète',
                text: 'Votre graphe semble complet ! Aucune question urgente détectée.',
                isHtml: true
            });
            return;
        }
        
        window.currentQuestions = questions;
        
        let htmlContent = '<div class="space-y-4 max-h-96 overflow-y-auto">';
        
        const grouped = {
            high: [],
            medium: [],
            low: []
        };
        
        questions.forEach((q, index) => {
            q.globalIndex = index;
            grouped[q.priority].push(q);
        });
        
        if (grouped.high.length > 0) {
            htmlContent += this.createQuestionSection('🔴 Questions Prioritaires', grouped.high, 'red');
        }
        
        if (grouped.medium.length > 0) {
            htmlContent += this.createQuestionSection('🟡 Questions Importantes', grouped.medium, 'yellow');
        }
        
        if (grouped.low.length > 0) {
            htmlContent += this.createQuestionSection('🟢 Questions Complémentaires', grouped.low, 'green');
        }
        
        htmlContent += '</div>';
        
        await this.app.utils.showModal({
            title: '❓ Questions d\'Investigation',
            text: htmlContent,
            isHtml: true
        });
    }

    createQuestionSection(title, questions, color) {
        let html = `<div class="mb-4">`;
        html += `<h3 class="font-semibold text-${color}-600 mb-2">${title}</h3>`;
        
        questions.forEach(q => {
            const qIndex = window.questionsData.length;
            window.questionsData.push(q);
            
            html += `<div class="border-l-4 border-${color}-400 bg-${color}-50 p-3 mb-2 rounded">`;
            html += `<div class="font-medium text-sm text-gray-800 mb-2">${q.question}</div>`;
            html += `<div class="text-xs text-gray-600 mb-1"><span class="font-semibold">Contexte:</span> ${q.context}</div>`;
            
            if (q.hint) {
                html += `<div class="text-xs text-gray-500 italic mb-2">💡 ${q.hint}</div>`;
            }
            
            if (q.nodes && q.nodes.length > 0) {
                html += '<div class="flex flex-wrap gap-1 mb-2">';
                q.nodes.forEach(node => {
                    html += `<span onclick="window.app.utils.closeModal(null); window.app.graph.highlightNodes(['${node}'])" 
                             class="bg-white px-2 py-1 rounded text-xs border cursor-pointer hover:bg-gray-100">${node}</span>`;
                });
                html += '</div>';
            }
            
            html += `<div class="flex gap-2 mt-2">
                <button onclick="window.app.investigation.investigateQuestion(window.questionsData[${qIndex}])" 
                        class="bg-${color}-500 hover:bg-${color}-600 text-white px-3 py-1 rounded text-xs">
                    Investiguer
                </button>
                <button onclick="window.app.investigation.skipQuestion(window.questionsData[${qIndex}])" 
                        class="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-xs">
                    Ignorer
                </button>
            </div>`;
            
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    }

    async discoverAllPaths() {
        console.log("LOG: Discovering all paths...");
        const btn = document.getElementById('discover-paths-btn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<div class="spinner"></div> Découverte...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/find-all-paths', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.app.state.n4lNotes)
            });
            
            if (!response.ok) throw new Error(await response.text());
            
            const paths = await response.json();
            window.discoveredPaths = paths;
            this.renderDiscoveredPaths(paths);
            
        } catch (error) {
            console.error('LOG: Erreur de découverte de chemins:', error);
            const container = document.getElementById('paths-list-container');
            if (container) {
                container.innerHTML = `<p class="text-red-500">Erreur lors de la découverte.</p>`;
            }
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }

    renderDiscoveredPaths(paths) {
        const container = document.getElementById('paths-list-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!paths || paths.length === 0) {
            container.innerHTML = '<p class="text-gray-500">Aucune histoire indirecte trouvée.</p>';
            return;
        }
        
        const pathList = document.createElement('ul');
        pathList.className = 'space-y-1';
        
        paths.forEach((path, index) => {
            const li = document.createElement('li');
            li.className = 'p-1 hover:bg-indigo-100 cursor-pointer rounded path-item';
            
            const pathText = document.createElement('span');
            pathText.textContent = path.join(' → ');
            li.appendChild(pathText);

            const analyzeBtn = document.createElement('button');
            analyzeBtn.innerHTML = `🧠`;
            analyzeBtn.className = 'analyze-btn text-xs ml-2';
            analyzeBtn.title = 'Analyser ce chemin avec l\'IA';
            
            analyzeBtn.onclick = (e) => {
                e.stopPropagation();
                this.analyzePath(path);
            };
            
            li.appendChild(analyzeBtn);
            li.onclick = () => this.highlightPath(path);
            
            pathList.appendChild(li);
        });
        
        container.appendChild(pathList);
    }

    async analyzePath(path) {
        console.log("LOG: Analyzing path:", path);
        
        try {
            await this.app.utils.showModal({
                title: 'Analyse IA en cours...',
                text: '<div class="spinner"></div> Veuillez patienter...',
                isHtml: true
            });
            
            const response = await fetch('/api/analyze-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({path: path, notes: this.app.state.n4lNotes})
            });
            
            if (!response.ok) throw new Error(await response.text());
            const analysis = await response.text();
            
            this.app.utils.closeModal(null);
            
            setTimeout(() => {
                this.app.utils.showModal({
                    title: 'Analyse Sémantique du Chemin',
                    text: analysis
                });
            }, 100);
            
        } catch (error) {
            this.app.utils.closeModal(null);
            setTimeout(() => {
                this.app.utils.showModal({
                    title: 'Erreur d\'Analyse',
                    text: error.message
                });
            }, 100);
        }
    }

    highlightPath(path) {
        const pathEdges = [];
        for (let i = 0; i < path.length - 1; i++) {
            pathEdges.push({ from: path[i], to: path[i+1] });
        }
        
        const nodes = new vis.DataSet(this.app.state.allGraphData.nodes.map(n => {
            const isHighlighted = path.includes(n.id);
            return {
                ...n,
                color: {
                    border: isHighlighted ? '#dc2626' : '#4f46e5',
                    background: isHighlighted ? '#fecaca' : 'white'
                }
            };
        }));
        
        const edges = new vis.DataSet(this.app.state.allGraphData.edges.map((e, index) => {
            const isHighlighted = pathEdges.some(pe => 
                (pe.from === e.from && pe.to === e.to) || 
                (pe.from === e.to && pe.to === e.from)
            );
            return {
                ...e,
                id: `edge-${index}`,
                color: isHighlighted ? '#dc2626' : this.getEdgeColor(e.type).color,
                width: isHighlighted ? 3 : 1,
                arrows: e.type === 'equivalence' ? 'to, from' : 'to'
            };
        }));
        
        this.graph.setData({ nodes, edges });
    }

    async switchViewMode(mode) {
        console.log(`LOG: Switching to ${mode} view mode`);
        this.currentViewMode = mode;
        
        ['standard', 'layered', 'circular', 'hierarchical'].forEach(m => {
            const btn = document.getElementById(`view-${m}`);
            if (btn) {
                if (m === mode) {
                    btn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
                } else {
                    btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
                }
            }
        });
        
        const legend = document.getElementById('layer-legend');
        if (legend) {
            legend.classList.toggle('hidden', mode !== 'layered');
        }
        
        switch(mode) {
            case 'standard':
                this.applyStandardView();
                break;
            case 'layered':
                await this.applyLayeredView();
                break;
            case 'circular':
                this.applyCircularView();
                break;
            case 'hierarchical':
                this.applyHierarchicalView();
                break;
        }
    }

    applyStandardView() {
        if (!this.graph) return;
        
        const options = this.getGraphOptions();
        this.graph.setOptions(options);
        
        const nodes = new vis.DataSet(this.app.state.allGraphData.nodes.map(n => ({
            ...n,
            color: this.getNodeColor(n),
            fixed: false,
            x: undefined,
            y: undefined
        })));
        
        const edges = new vis.DataSet(this.app.state.allGraphData.edges.map((e, index) => ({
            ...e,
            id: `edge-${index}`,
            color: this.getEdgeColor(e.type),
            arrows: e.type === 'equivalence' ? 'to, from' : 'to'
        })));
        
        this.graph.setData({ nodes, edges });
    }

    async applyLayeredView() {
        console.log("LOG: Applying layered view");
        
        if (this.app.state.allGraphData.nodes.length === 0) {
            document.getElementById('help-panel').innerHTML = 'Aucun nœud à visualiser en couches';
            return;
        }
        
        try {
            const response = await fetch('/api/layered-graph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.app.state.allGraphData)
            });
            
            if (!response.ok) throw new Error(await response.text());
            
            const layeredData = await response.json();
            this.displayLayeredGraph(layeredData);
            
        } catch (error) {
            console.error("Erreur vue en couches:", error);
            document.getElementById('help-panel').innerHTML = 'Erreur lors de la création de la vue en couches';
        }
    }

    displayLayeredGraph(layeredData) {
        if (!this.graph) return;
        
        const nodes = new vis.DataSet(layeredData.nodes.map(n => ({
            id: n.id,
            label: n.label,
            x: n.x,
            y: n.y,
            fixed: { x: true, y: true },
            color: {
                background: n.color + '33',
                border: n.color,
                highlight: {
                    background: n.color + '66',
                    border: n.color
                }
            },
            shape: n.shape,
            size: n.size,
            font: { color: '#333', size: 12 }
        })));
        
        const edges = new vis.DataSet(layeredData.edges.map((e, index) => ({
            ...e,
            id: `edge-${index}`,
            color: { color: '#999', highlight: '#333' },
            smooth: { type: 'continuous', roundness: 0.5 },
            arrows: e.type === 'equivalence' ? 'to, from' : 'to'
        })));
        
        const options = {
            physics: { enabled: false },
            nodes: { font: { size: 14, color: '#333' } },
            edges: {
                font: { size: 10, align: 'middle' },
                smooth: { enabled: true, type: 'continuous' }
            },
            interaction: { dragNodes: false, hover: true }
        };
        
        this.graph.setOptions(options);
        this.graph.setData({ nodes, edges });
        this.graph.fit();
    }

    applyCircularView() {
        if (!this.graph) return;
        
        const nodeCount = this.app.state.allGraphData.nodes.length;
        const angleStep = (2 * Math.PI) / nodeCount;
        const radius = Math.max(300, nodeCount * 20);
        
        const nodes = new vis.DataSet(this.app.state.allGraphData.nodes.map((n, i) => ({
            ...n,
            x: radius * Math.cos(i * angleStep),
            y: radius * Math.sin(i * angleStep),
            fixed: { x: true, y: true },
            color: this.getNodeColor(n)
        })));
        
        const edges = new vis.DataSet(this.app.state.allGraphData.edges.map((e, index) => ({
            ...e,
            id: `edge-${index}`,
            color: this.getEdgeColor(e.type),
            smooth: { type: 'curvedCW', roundness: 0.2 },
            arrows: e.type === 'equivalence' ? 'to, from' : 'to'
        })));
        
        const options = {
            physics: { enabled: false },
            nodes: { shape: 'dot', size: 20 }
        };
        
        this.graph.setOptions(options);
        this.graph.setData({ nodes, edges });
        this.graph.fit();
    }

    applyHierarchicalView() {
        if (!this.graph) return;
        
        const levels = this.calculateHierarchicalLevels();
        
        const nodes = new vis.DataSet(this.app.state.allGraphData.nodes.map(n => ({
            ...n,
            level: levels[n.id] || 0,
            color: this.getNodeColor(n)
        })));
        
        const edges = new vis.DataSet(this.app.state.allGraphData.edges.map((e, index) => ({
            ...e,
            id: `edge-${index}`,
            color: this.getEdgeColor(e.type),
            arrows: e.type === 'equivalence' ? 'to, from' : 'to'
        })));
        
        const options = {
            layout: {
                hierarchical: {
                    enabled: true,
                    direction: 'UD',
                    sortMethod: 'directed',
                    shakeTowards: 'roots',
                    levelSeparation: 200,
                    nodeSpacing: 150,
                    treeSpacing: 200
                }
            },
            physics: { enabled: false },
            edges: {
                smooth: {
                    type: 'cubicBezier',
                    forceDirection: 'vertical'
                }
            }
        };
        
        this.graph.setOptions(options);
        this.graph.setData({ nodes, edges });
        
        setTimeout(() => this.graph.fit(), 100);
    }

    calculateHierarchicalLevels() {
        const levels = {};
        const visited = new Set();
        const roots = this.app.state.allGraphData.nodes.filter(n => 
            !this.app.state.allGraphData.edges.some(e => e.to === n.id)
        );
        
        const queue = roots.map(r => ({ id: r.id, level: 0 }));
        
        while (queue.length > 0) {
            const { id, level } = queue.shift();
            
            if (visited.has(id)) continue;
            visited.add(id);
            levels[id] = level;
            
            this.app.state.allGraphData.edges.forEach(e => {
                if (e.from === id && !visited.has(e.to)) {
                    queue.push({ id: e.to, level: level + 1 });
                }
            });
        }
        
        this.app.state.allGraphData.nodes.forEach(n => {
            if (levels[n.id] === undefined) {
                levels[n.id] = 0;
            }
        });
        
        return levels;
    }

    async showExpansionCone(nodeId, depth) {
        try {
            const response = await fetch('/api/graph/expansion-cone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeId: nodeId,
                    depth: depth,
                    graphData: this.app.state.allGraphData
                })
            });
    
            if (!response.ok) {
                throw new Error(await response.text());
            }
    
            const cone = await response.json();
            const coneNodeIds = new Set(cone.nodeIds);
            
            const allEdges = this.app.state.allGraphData.edges;
            const coneEdgeIdSet = new Set();

            // Create a simple key for each edge in the cone for easy lookup
            const coneEdgeKeys = new Set(cone.edges.map(e => `${e.from}|${e.to}|${e.label}`));

            // Find the unique ID for each edge that is part of the cone
            allEdges.forEach((edge, index) => {
                const edgeKey = `${edge.from}|${edge.to}|${edge.label}`;
                if (coneEdgeKeys.has(edgeKey)) {
                    coneEdgeIdSet.add(`edge-${index}`);
                }
            });
    
            const nodes = new vis.DataSet(this.app.state.allGraphData.nodes.map(n => ({
                ...n,
                color: {
                    border: coneNodeIds.has(n.id) ? '#4f46e5' : '#d1d5db',
                    background: coneNodeIds.has(n.id) ? 'white' : '#f3f4f6'
                },
                font: { color: coneNodeIds.has(n.id) ? '#333' : '#9ca3af' }
            })));
    
            const edges = new vis.DataSet(allEdges.map((e, index) => {
                const edgeId = `edge-${index}`;
                const originalColor = this.getEdgeColor(e.type);
                return {
                    ...e,
                    id: edgeId,
                    color: coneEdgeIdSet.has(edgeId) ? originalColor.color : '#e5e7eb',
                    font: { color: coneEdgeIdSet.has(edgeId) ? '#333' : '#d1d5db' },
                    arrows: e.type === 'equivalence' ? 'to, from' : 'to'
                };
            }));
    
            this.graph.setData({ nodes, edges });
    
        } catch (error) {
            console.error("Erreur lors du calcul du cône d'expansion:", error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: `Impossible de calculer le cône: ${error.message}`
            });
        }
    }

    async findAndHighlightClusters() {
        const input = document.getElementById('cluster-search-input');
        const terms = input.value.split(',').map(t => t.trim()).filter(t => t);
    
        if (terms.length === 0) {
            this.app.utils.showModal({ title: 'Recherche vide', text: 'Veuillez entrer au moins un terme de recherche.' });
            return;
        }
    
        try {
            const response = await fetch('/api/find-clusters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    terms: terms,
                    graphData: this.app.state.allGraphData
                })
            });
    
            if (!response.ok) {
                throw new Error(await response.text());
            }
    
            const { clusters, paths } = await response.json();

            this.app.state.currentClusters = clusters; // Stocke les clusters
            const analyzeBtn = document.getElementById('cluster-analyze-btn');
            if (analyzeBtn && Object.keys(clusters).length > 0) {
                analyzeBtn.classList.remove('hidden'); // Affiche le bouton
            }
            
            // --- Logique de mise en évidence ---
            const clusterColors = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'];
            const allNodesInClusters = new Set();
            const nodeToClusterColor = {};
    
            Object.values(clusters).forEach((nodeIds, i) => {
                const color = clusterColors[i % clusterColors.length];
                nodeIds.forEach(nodeId => {
                    allNodesInClusters.add(nodeId);
                    nodeToClusterColor[nodeId] = color;
                });
            });
    
            const allNodesInPaths = new Set(paths.flat());
            const allEdgesInPaths = new Set();
            paths.forEach(path => {
                for (let i = 0; i < path.length - 1; i++) {
                    allEdgesInPaths.add(`${path[i]}-${path[i+1]}`);
                    allEdgesInPaths.add(`${path[i+1]}-${path[i]}`); // Pour les arêtes non dirigées
                }
            });

            // Mettre à jour les nœuds
            const nodes = new vis.DataSet(this.app.state.allGraphData.nodes.map(n => {
                let color = { border: '#e5e7eb', background: '#f9fafb', highlight: { border: '#d1d5db', background: '#f3f4f6' } };
                let font = { color: '#9ca3af' };

                if (allNodesInClusters.has(n.id)) {
                    color = { border: '#4b5563', background: nodeToClusterColor[n.id] };
                    font = { color: '#1f2937' };
                } else if (allNodesInPaths.has(n.id)) {
                    color = { border: '#6d28d9', background: '#f5f3ff' };
                    font = { color: '#374151' };
                }

                return { ...n, color, font };
            }));

            // Mettre à jour les arêtes
            const edges = new vis.DataSet(this.app.state.allGraphData.edges.map((e, index) => {
                const edgeKey1 = `${e.from}-${e.to}`;
                const edgeKey2 = `${e.to}-${e.from}`;
                let edgeColor = '#e5e7eb';
                let width = 1;

                if (allEdgesInPaths.has(edgeKey1) || allEdgesInPaths.has(edgeKey2)) {
                    edgeColor = '#8b5cf6';
                    width = 2.5;
                }

                return { ...e, id: `edge-${index}`, color: edgeColor, width };
            }));

            this.graph.setData({ nodes, edges });

        } catch (error) {
            console.error("Erreur lors de la recherche de clusters:", error);
            this.app.utils.showModal({ title: 'Erreur', text: `Impossible de trouver les clusters: ${error.message}` });
        }
    }

    async analyzeClustersWithAI() {
        if (!this.app.state.currentClusters || Object.keys(this.app.state.currentClusters).length === 0) {
            this.app.utils.showModal({ title: 'Aucun cluster', text: 'Veuillez d\'abord trouver des clusters avant de les analyser.' });
            return;
        }

        const btn = document.getElementById('cluster-analyze-btn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<div class="spinner"></div> Analyse...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/analyze-clusters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clusters: this.app.state.currentClusters,
                    graphData: this.app.state.allGraphData
                })
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const analysis = await response.text();

            // Remplace les \n par des <br> pour un meilleur affichage en HTML
            const formattedAnalysis = analysis.replace(/\n/g, '<br>');

            this.app.utils.showModal({
                title: 'Analyse IA des Clusters',
                text: `<div class="text-left">${formattedAnalysis}</div>`,
                isHtml: true
            });

        } catch (error) {
            console.error("Erreur lors de l'analyse des clusters par l'IA:", error);
            this.app.utils.showModal({ title: 'Erreur d\'analyse', text: `Une erreur est survenue: ${error.message}` });
        } finally {
            btn.innerHTML = `Synthèse IA`;
            btn.disabled = false;
        }
    }

    // Nouvelle méthode pour configurer le bouton plein écran
    setupFullscreen() {
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.onclick = () => this.toggleFullscreen();
        }
    }

    // Nouvelle méthode pour gérer le passage en plein écran
    toggleFullscreen() {
        document.body.classList.toggle('graph-fullscreen');
        const btn = document.getElementById('fullscreen-btn');
        const isFullscreen = document.body.classList.contains('graph-fullscreen');

        if (isFullscreen) {
            // Icône pour "Réduire" (flèches pointant vers l'intérieur)
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M14.707 5.293a1 1 0 010 1.414L11.414 10l3.293 3.293a1 1 0 01-1.414 1.414L10 11.414l-3.293 3.293a1 1 0 01-1.414-1.414L8.586 10 5.293 6.707a1 1 0 011.414-1.414L10 8.586l3.293-3.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            `;
            btn.title = "Quitter le plein écran";
        } else {
            // Icône pour "Agrandir" (flèches pointant vers l'extérieur)
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v5a1 1 0 002 0V5h4a1 1 0 100-2H3zm14 0a1 1 0 011 1v5a1 1 0 01-2 0V5h-4a1 1 0 010-2h5zM3 17a1 1 0 001-1v-4a1 1 0 00-2 0v5a1 1 0 001 1zm14 0a1 1 0 01-1 1h-5a1 1 0 010-2h4v-4a1 1 0 012 0v5z" clip-rule="evenodd" />
                            </svg>
            `;
            btn.title = "Passer en plein écran";
        }
        
        // Redimensionner le graphe après une courte pause pour laisser le temps au DOM de se mettre à jour
        setTimeout(() => {
            if (this.graph) {
                this.graph.fit();
            }
        }, 300);
    }

    highlightPath(nodeIds) {
        if (!this.cy) return;

        // Réinitialiser tous les styles
        this.cy.elements().removeClass('highlighted dimmed');
        
        // Trouver tous les éléments du chemin
        const pathNodes = this.cy.nodes().filter(node => nodeIds.includes(node.id()));
        const pathEdges = this.cy.edges().filter(edge => {
            const sourceId = edge.source().id();
            const targetId = edge.target().id();
            const sourceIndex = nodeIds.indexOf(sourceId);
            const targetIndex = nodeIds.indexOf(targetId);
            return sourceIndex !== -1 && targetIndex !== -1 && Math.abs(sourceIndex - targetIndex) === 1;
        });

        // Ajouter la classe highlighted aux éléments du chemin
        pathNodes.addClass('highlighted');
        pathEdges.addClass('highlighted');
        
        // Diminuer l'opacité des autres éléments
        this.cy.elements().not(pathNodes).not(pathEdges).addClass('dimmed');

        // Centrer la vue sur le chemin
        this.cy.fit(pathNodes, 50);
    }
}