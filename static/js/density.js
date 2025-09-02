// Module de gestion de la vue densité conceptuelle

export class DensityManager {
    constructor(app) {
        this.app = app;
        this.densityData = null;
        this.territories = null;
        this.heatmapLayer = null;
        this.currentView = 'standard';
        this.densityOverlay = null;
        this.explorationMode = false;
    }

    init() {
        this.setupUI();
        this.setupCanvas();
    }

    setupUI() {
        // Créer le panneau de densité
        this.createDensityPanel();
        
        // Ajouter l'overlay pour la heatmap
        this.createDensityOverlay();
    }

    setupCanvas() {
        // Créer un canvas pour la heatmap
        const graphContainer = document.getElementById('graph-container');
        if (!graphContainer) {
            console.error('Graph container not found');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'density-canvas';
        canvas.className = 'absolute top-0 left-0 pointer-events-none hidden';
        canvas.style.zIndex = '10';
        canvas.style.position = 'absolute';
        graphContainer.appendChild(canvas);
        console.log('Canvas créé et ajouté');
    }

    createDensityPanel() {
        const panel = document.createElement('div');
        panel.id = 'density-panel';
        panel.className = 'hidden absolute top-2 left-2 bg-white rounded-lg shadow-lg p-4 z-20 w-80';
        panel.innerHTML = `
            <div class="mb-4">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-lg mb-2 flex items-center">
                        Vue Densité Conceptuelle
                    </h3>
                    <button id="close-density-panel" class="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
                </div>
                <div class="text-xs text-gray-600 mb-3">
                    Visualisez les zones de forte et faible densité de votre graphe de connaissances.
                </div>
            </div>

            <div class="space-y-3">
                <!-- Métriques globales -->
                <div class="border rounded-lg p-3 bg-gray-50">
                    <h4 class="font-semibold text-sm mb-2">Métriques Globales</h4>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="flex items-center">
                            <span class="text-gray-600 mr-1">Densité:</span>
                            <span id="global-density" class="font-bold">0%</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-gray-600 mr-1">Équilibre:</span>
                            <span id="balance-score" class="font-bold">0%</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-gray-600 mr-1">Hubs:</span>
                            <span id="hub-count" class="font-bold">0</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-gray-600 mr-1">Isolés:</span>
                            <span id="peripheral-count" class="font-bold">0</span>
                        </div>
                    </div>
                </div>

                <!-- Territoires -->
                <div class="border rounded-lg p-3">
                    <h4 class="font-semibold text-sm mb-2">Territoires Conceptuels</h4>
                    <div class="space-y-2">
                        <div class="flex items-center justify-between text-xs">
                            <span class="flex items-center">
                                <span class="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                                Zones Explorées
                            </span>
                            <span id="explored-count" class="font-bold">0</span>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                            <span class="flex items-center">
                                <span class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                                Zones Frontières
                            </span>
                            <span id="frontier-count" class="font-bold">0</span>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                            <span class="flex items-center">
                                <span class="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                                Zones Inexplorées
                            </span>
                            <span id="unexplored-count" class="font-bold">0</span>
                        </div>
                    </div>
                </div>

                <!-- Options de visualisation -->
                <div class="border rounded-lg p-3">
                    <h4 class="font-semibold text-sm mb-2">Options de Visualisation</h4>
                    <div class="space-y-2">
                        <label class="flex items-center text-xs relative group cursor-pointer">
                            <input type="checkbox" id="show-heatmap" class="mr-2">
                            <span>Afficher la heatmap</span>
                            <div class="hidden group-hover:block absolute left-0 bottom-full mb-1 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50">
                                Visualise la densité des connexions sous forme de carte de chaleur. Les zones rouges indiquent une forte concentration de liens, les zones bleues une faible densité.
                            </div>
                        </label>
                        
                        <label class="flex items-center text-xs relative group cursor-pointer">
                            <input type="checkbox" id="show-territories" class="mr-2">
                            <span>Afficher les territoires</span>
                            <div class="hidden group-hover:block absolute left-0 bottom-full mb-1 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50">
                                Affiche des badges sur les territoires conceptuels : zones explorées (E), frontières (F) et zones inexplorées (U) avec leur nombre de nœuds.
                            </div>
                        </label>
                        
                        <label class="flex items-center text-xs relative group cursor-pointer">
                            <input type="checkbox" id="show-empty-zones" class="mr-2">
                            <span>Zones vides</span>
                            <div class="hidden group-hover:block absolute left-0 bottom-full mb-1 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50">
                                Met en évidence les espaces vides dans votre graphe où de nouvelles connexions pourraient être créées pour équilibrer la structure.
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-2">
                    <button id="explore-suggestions-btn" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-xs">
                        Explorer Suggestions
                    </button>
                    <button id="balance-density-btn" class="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded text-xs">
                        Équilibrer
                    </button>
                </div>

                <!-- Recommandations -->
                <div id="density-recommendations" class="hidden border rounded-lg p-3 bg-yellow-50 border-yellow-300">
                    <h4 class="font-semibold text-sm mb-2 text-yellow-800">Recommandations</h4>
                    <ul id="recommendations-list" class="text-xs text-yellow-700 space-y-1"></ul>
                </div>
            </div>
        `;

        const graphView = document.getElementById('graph-view');
        if (graphView) {
            graphView.appendChild(panel);
        }

        // Attacher les événements
        setTimeout(() => {
            const heatmapCheckbox = document.getElementById('show-heatmap');
            const territoriesCheckbox = document.getElementById('show-territories');
            const emptyZonesCheckbox = document.getElementById('show-empty-zones');
            
            if (heatmapCheckbox) {
                heatmapCheckbox.onchange = (e) => {
                    console.log('Heatmap checkbox changed:', e.target.checked);
                    this.toggleHeatmap(e.target.checked);
                };
            }
            
            if (territoriesCheckbox) {
                territoriesCheckbox.onchange = (e) => {
                    console.log('Territories checkbox changed:', e.target.checked);
                    this.toggleTerritories(e.target.checked);
                };
            }
            
            if (emptyZonesCheckbox) {
                emptyZonesCheckbox.onchange = (e) => {
                    console.log('Empty zones checkbox changed:', e.target.checked);
                    this.toggleEmptyZones(e.target.checked);
                };
            }
            
            const exploreSuggestionsBtn = document.getElementById('explore-suggestions-btn');
            if (exploreSuggestionsBtn) {
                exploreSuggestionsBtn.onclick = () => this.exploreSuggestions();
            }
            
            const balanceDensityBtn = document.getElementById('balance-density-btn');
            if (balanceDensityBtn) {
                balanceDensityBtn.onclick = () => this.balanceDensity();
            }
            
            const closeDensityPanel = document.getElementById('close-density-panel');
            if (closeDensityPanel) {
                closeDensityPanel.onclick = () => this.toggleDensityView();
            }
        }, 100);
    }

    createDensityOverlay() {
        const graphContainer = document.getElementById('graph-container');
        if (!graphContainer) {
            console.error('Graph container not found for overlay');
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'density-overlay';
        overlay.className = 'absolute top-0 left-0 w-full h-full pointer-events-none';
        overlay.style.position = 'absolute';
        overlay.style.zIndex = '5';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';

        overlay.style.pointerEvents = 'none'; // S'assurer que l'overlay ne bloque pas les interactions
        overlay.style.display = 'none'; // Caché par défaut
        
        graphContainer.appendChild(overlay);
        this.densityOverlay = overlay;
        console.log('Overlay créé et ajouté');
    }

    async toggleDensityView() {
        if (this.currentView === 'density') {
            // Retourner à la vue standard
            this.hideDensityView();
            this.currentView = 'standard';
            const densityBtn = document.getElementById('view-density');
            if (densityBtn) {
                densityBtn.classList.remove('ring-2', 'ring-offset-2', 'ring-purple-500');
            }
            
            // Réactiver la vue standard du graphe
            if (this.app.graph && this.app.graph.applyStandardView) {
                this.app.graph.applyStandardView();
            }
        } else {
            // Activer la vue densité
            await this.showDensityView();
            this.currentView = 'density';
            const densityBtn = document.getElementById('view-density');
            if (densityBtn) {
                densityBtn.classList.add('ring-2', 'ring-offset-2', 'ring-purple-500');
            }
        }
    }

    async showDensityView() {
        console.log("Activating density view");
        
        // Afficher le panneau
        const panel = document.getElementById('density-panel');
        if (panel) {
            panel.classList.remove('hidden');
        }
        
        // Charger les données de densité
        await this.loadDensityData();
        
        // Afficher la visualisation
        this.renderDensityVisualization();
        
        // Mettre à jour le graphe avec les couleurs de densité
        this.updateGraphWithDensity();
    }

    hideDensityView() {
        console.log("Deactivating density view");
        
        // Cacher le panneau
        const panel = document.getElementById('density-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
        
        // Cacher les overlays
        if (this.densityOverlay) {
            this.densityOverlay.classList.add('hidden');
            this.densityOverlay.innerHTML = '';
        }
        
        // Cacher le canvas
        const canvas = document.getElementById('density-canvas');
        if (canvas) {
            canvas.classList.add('hidden');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        
        // Réinitialiser l'état
        this.currentView = 'standard';
    }

    async loadDensityData() {
        try {
            console.log('Loading density data...');
            
            // Récupérer les positions actuelles des nœuds du graphe
            let graphDataWithPositions = this.app.state.allGraphData;
            if (this.app.graph && this.app.graph.graph) {
                const positions = this.app.graph.graph.getPositions();
                console.log('Positions récupérées:', Object.keys(positions).length);
                graphDataWithPositions = {
                    ...this.app.state.allGraphData,
                    positions: positions
                };
            }
            
            // Charger la carte de densité
            const densityResponse = await fetch('/api/density-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(graphDataWithPositions)
            });
            
            if (densityResponse.ok) {
                this.densityData = await densityResponse.json();
                console.log('Density data loaded:', this.densityData);
                console.log('Density data structure:', JSON.stringify(Object.keys(this.densityData)));
            }
            
            // Charger les territoires
            const territoriesResponse = await fetch('/api/conceptual-territories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(graphDataWithPositions)
            });
            
            if (territoriesResponse.ok) {
                this.territories = await territoriesResponse.json();
                console.log('Territories loaded:', this.territories);
            }
            
            // Charger les métriques
            const metricsResponse = await fetch('/api/density-metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(graphDataWithPositions)
            });
            
            if (metricsResponse.ok) {
                const metrics = await metricsResponse.json();
                console.log('Metrics loaded:', metrics);
                this.updateMetricsDisplay(metrics);
            }
            
        } catch (error) {
            console.error('Erreur chargement densité:', error);
        }
    }

    renderDensityVisualization() {
        if (!this.densityData) {
            console.warn('No density data available');
            return;
        }
        console.log('Rendering density visualization');
        this.renderDensityOverlays();
    }

renderDensityOverlays() {
    console.log('renderDensityOverlays called');
    
    if (!this.densityData) {
        console.warn('Missing density data');
        return;
    }
    
    const showHeatmap = document.getElementById('show-heatmap')?.checked || false;
    const showTerritories = document.getElementById('show-territories')?.checked || false;
    const showEmptyZones = document.getElementById('show-empty-zones')?.checked || false;
    
    console.log('Visualization states:', { showHeatmap, showTerritories, showEmptyZones });
    
    // Nettoyer les anciennes visualisations
    ['territory-badges', 'density-grid'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    
    // Gérer le canvas de la heatmap
    const canvas = document.getElementById('density-canvas');
    if (showHeatmap) {
        console.log('Activating heatmap...');
        // Afficher la vraie heatmap sur le canvas
        this.drawHeatmap();
    } else {
        // Cacher et nettoyer le canvas
        if (canvas) {
            canvas.classList.add('hidden');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }
    
    if (showTerritories) {
        console.log('Showing territory badges...');
        this.showTerritoryBadges();
    }
    
    if (showEmptyZones) {
        console.log('Creating density grid...');
        this.createDensityGrid();
    }
    
    // Si aucune case n'est cochée, restaurer les couleurs normales
    if (!showHeatmap && !showTerritories && !showEmptyZones) {
        this.updateGraphWithDensity();
    }
}

    drawHeatmap() {
    let canvas = document.getElementById('density-canvas');
    
    // Si le canvas n'existe pas, le recréer
    if (!canvas) {
        console.log('Canvas not found, recreating it...');
        const graphContainer = document.getElementById('graph-container');
        if (!graphContainer) {
            console.error('Graph container not found');
            return;
        }
        
        canvas = document.createElement('canvas');
        canvas.id = 'density-canvas';
        canvas.className = 'absolute top-0 left-0 pointer-events-none';
        canvas.style.zIndex = '10';
        canvas.style.position = 'absolute';
        graphContainer.appendChild(canvas);
        console.log('Canvas recreated');
    }
    
    if (!this.densityData || !this.densityData.heatmapData) {
        console.warn('No heatmap data available');
        return;
    }
    
    const container = document.getElementById('graph-container');
    if (!container) {
        console.error('Graph container not found');
        return;
    }
    
    const network = this.app.graph?.graph;
    if (!network) {
        console.error('Network not available');
        return;
    }
    
    // Rendre le canvas visible
    canvas.classList.remove('hidden');
    canvas.style.display = 'block';
    
    // Définir les dimensions
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    console.log(`Drawing ${this.densityData.heatmapData.length} heatmap points on canvas`);
    
    // Dessiner chaque point de la heatmap
    let pointsDrawn = 0;
    this.densityData.heatmapData.forEach(point => {
        const nodeId = point.nodeId || point.nodeID;
        const nodePositions = network.getPositions([nodeId]);
        
        if (!nodePositions || !nodePositions[nodeId]) {
            return;
        }
        
        const domPos = network.canvasToDOM(nodePositions[nodeId]);
        const x = domPos.x;
        const y = domPos.y;
        
        // Rayon plus grand pour meilleure visibilité
        const radius = 100;
        
        // Créer le gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        
        const intensity = point.intensity || 0.5;
        
        // Couleurs plus visibles avec forte opacité
        if (intensity > 0.7) {
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
            gradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        } else if (intensity > 0.3) {
            gradient.addColorStop(0, 'rgba(255, 165, 0, 0.8)');
            gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(0, 100, 255, 0.1)');
            gradient.addColorStop(0.5, 'rgba(0, 100, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        pointsDrawn++;
    });
    
    console.log(`Heatmap drawn with ${pointsDrawn} points`);
}

    drawTerritory(territory, color, label) {
        if (!this.app.graph?.graph) {
            console.warn('Graph not available for drawing territory');
            return;
        }
        
        const network = this.app.graph.graph;
        
        if (!territory.nodes || territory.nodes.length === 0) {
            console.warn('Territory has no nodes');
            return;
        }
        
        const positions = network.getPositions(territory.nodes);
        
        if (!positions || Object.keys(positions).length === 0) {
            console.warn('No positions found for territory nodes');
            return;
        }
        
        // Calculer le centre et le rayon
        let sumX = 0, sumY = 0;
        let count = 0;
        
        for (const nodeId in positions) {
            sumX += positions[nodeId].x;
            sumY += positions[nodeId].y;
            count++;
        }
        
        if (count === 0) return;
        
        const centerX = sumX / count;
        const centerY = sumY / count;
        
        // Calculer le rayon
        let maxDist = 0;
        for (const nodeId in positions) {
            const dist = Math.sqrt(
                Math.pow(positions[nodeId].x - centerX, 2) + 
                Math.pow(positions[nodeId].y - centerY, 2)
            );
            maxDist = Math.max(maxDist, dist);
        }

        // Si le rayon est 0 ou trop petit, utiliser une valeur par défaut
        if (maxDist < 50) {
            maxDist = 50;
        }
        
        const domPos = network.canvasToDOM({x: centerX, y: centerY});
        
        // Créer un élément pour le territoire
        const territoryEl = document.createElement('div');
        territoryEl.className = 'absolute rounded-full opacity-20 pointer-events-none';
        territoryEl.style.position = 'absolute';
        territoryEl.style.backgroundColor = color;
        territoryEl.style.width = `${maxDist * 2}px`;
        territoryEl.style.height = `${maxDist * 2}px`;
        territoryEl.style.left = `${domPos.x - maxDist}px`;
        territoryEl.style.top = `${domPos.y - maxDist}px`;

        console.log('Territory position:', { 
            domPos, 
            maxDist, 
            left: domPos.x - maxDist, 
            top: domPos.y - maxDist 
        });
        
        // Ajouter une étiquette
        const labelEl = document.createElement('div');
        labelEl.className = 'absolute text-xs font-bold pointer-events-none';
        labelEl.style.position = 'absolute';
        labelEl.style.color = color;
        labelEl.style.left = `${domPos.x - 50}px`;
        labelEl.style.top = `${domPos.y - 10}px`;
        labelEl.style.width = '100px';
        labelEl.style.textAlign = 'center';
        labelEl.textContent = `${label} (${territory.size || count} nœuds)`;
        
        this.densityOverlay.appendChild(territoryEl);
        this.densityOverlay.appendChild(labelEl);
        
        console.log(`Territory drawn: ${label}`);
    }

    drawEmptyZones() {
        if (!this.densityData.emptyZones || this.densityData.emptyZones.length === 0) {
            console.warn('No empty zones to draw');
            return;
        }
        
        const network = this.app.graph?.graph;
        if (!network) {
            console.error('Network not available for empty zones');
            return;
        }
        
        console.log(`Drawing ${this.densityData.emptyZones.length} empty zones`);
        
        this.densityData.emptyZones.forEach((zone, index) => {
            // Vérifier que la zone a des coordonnées valides
            if (zone.x === undefined || zone.y === undefined) {
                console.warn(`Empty zone ${index} has invalid coordinates`);
                return;
            }
            
            const domPos = network.canvasToDOM({x: zone.x || 0, y: zone.y || 0});
            
            console.log('Empty zone position:', { 
                zone, 
                domPos, 
                left: domPos.x - (zone.radius || 50), 
                top: domPos.y - (zone.radius || 50) 
            });
            
            const emptyEl = document.createElement('div');
            emptyEl.className = 'absolute rounded-full border-2 border-dashed border-gray-400 opacity-50';
            emptyEl.style.position = 'absolute';
            emptyEl.style.width = `${(zone.radius || 50) * 2}px`;
            emptyEl.style.height = `${(zone.radius || 50) * 2}px`;
            emptyEl.style.left = `${domPos.x - (zone.radius || 50)}px`;
            emptyEl.style.top = `${domPos.y - (zone.radius || 50)}px`;
            
            const plusEl = document.createElement('div');
            plusEl.className = 'absolute text-gray-400 text-2xl font-bold';
            plusEl.style.position = 'absolute';
            plusEl.style.left = '50%';
            plusEl.style.top = '50%';
            plusEl.style.transform = 'translate(-50%, -50%)';
            plusEl.textContent = '+';
            
            emptyEl.appendChild(plusEl);
            this.densityOverlay.appendChild(emptyEl);
            
            console.log(`Empty zone ${index} drawn`);
        });
    }

    updateGraphWithDensity() {
        if (!this.app.graph?.graph || !this.densityData) {
            console.warn('Cannot update graph colors: missing data');
            return;
        }
        
        const nodes = new vis.DataSet();
        
        this.app.state.allGraphData.nodes.forEach(node => {
            const heatmapPoint = this.densityData.heatmapData?.find(p => p.nodeId === node.id);
            
            let color;
            if (heatmapPoint) {
                if (heatmapPoint.intensity > 0.7) {
                    color = { background: '#fecaca', border: '#ef4444' };
                } else if (heatmapPoint.intensity > 0.3) {
                    color = { background: '#fed7aa', border: '#f59e0b' };
                } else {
                    color = { background: '#dbeafe', border: '#3b82f6' };
                }
            } else {
                color = { background: '#f3f4f6', border: '#6b7280' };
            }
            
            nodes.add({
                id: node.id,
                label: node.label,
                color: color,
                borderWidth: 2
            });
        });
        
        this.app.graph.graph.body.data.nodes.update(nodes.get());
        console.log('Graph colors updated');
    }

    // Ajouter ces trois méthodes après updateGraphWithDensity()

highlightNodesByDensity() {
    if (!this.app.graph?.graph || !this.densityData) return;
    
    const network = this.app.graph.graph;
    const nodes = [];
    
    this.app.state.allGraphData.nodes.forEach(node => {
        const heatmapPoint = this.densityData.heatmapData?.find(p => 
            (p.nodeId || p.nodeID) === node.id
        );
        
        let borderWidth = 2;
        let shadowColor = null;
        let shadow = false;
        let color = null;
        
        if (heatmapPoint) {
            if (heatmapPoint.intensity > 0.7) {
                // Zone chaude - rouge
                borderWidth = 5;
                shadowColor = '#ef4444';
                shadow = true;
                color = { background: '#fecaca', border: '#ef4444' };
            } else if (heatmapPoint.intensity > 0.3) {
                // Zone tiède - orange
                borderWidth = 4;
                shadowColor = '#f59e0b';
                shadow = true;
                color = { background: '#fed7aa', border: '#f59e0b' };
            } else {
                // Zone froide - bleu
                borderWidth = 3;
                shadowColor = '#3b82f6';
                shadow = true;
                color = { background: '#dbeafe', border: '#3b82f6' };
            }
        } else {
            // Nœud sans données - gris
            color = { background: '#f3f4f6', border: '#6b7280' };
        }
        
        nodes.push({
            id: node.id,
            borderWidth: borderWidth,
            shadow: shadow,
            shadowColor: shadowColor,
            shadowSize: 20,  // Augmenté pour plus de visibilité
            shadowX: 0,
            shadowY: 0,
            color: color     // Ajout de la couleur de fond aussi
        });
    });
    
    network.body.data.nodes.update(nodes);
    console.log('Nodes highlighted by density with colors and shadows');
}

showTerritoryBadges() {
    if (!this.territories || !this.app.graph?.graph) return;
    
    const network = this.app.graph.graph;
    const container = document.getElementById('graph-container');
    
    let badgeContainer = document.getElementById('territory-badges');
    if (!badgeContainer) {
        badgeContainer = document.createElement('div');
        badgeContainer.id = 'territory-badges';
        badgeContainer.className = 'absolute top-0 left-0 w-full h-full pointer-events-none';
        badgeContainer.style.zIndex = '15';
        container.appendChild(badgeContainer);
    } else {
        badgeContainer.innerHTML = '';
    }
    
    const createBadge = (territory, type, color) => {
        if (!territory.nodes || territory.nodes.length === 0) return;
        
        const centralNode = territory.centralNode || territory.nodes[0];
        const positions = network.getPositions([centralNode]);
        
        if (!positions[centralNode]) return;
        
        const domPos = network.canvasToDOM(positions[centralNode]);
        
        const badge = document.createElement('div');
        badge.className = 'absolute transform -translate-x-1/2';
        badge.style.left = `${domPos.x}px`;
        badge.style.top = `${domPos.y - 30}px`;
        badge.innerHTML = `
            <div class="bg-white rounded-full px-2 py-1 shadow-lg border-2" style="border-color: ${color}">
                <span class="text-xs font-bold" style="color: ${color}">${type}: ${territory.size}</span>
            </div>
        `;
        
        badgeContainer.appendChild(badge);
    };
    
    this.territories.explored?.forEach(t => createBadge(t, 'E', '#ef4444'));
    this.territories.frontier?.forEach(t => createBadge(t, 'F', '#f59e0b'));
    this.territories.unexplored?.forEach(t => createBadge(t, 'U', '#3b82f6'));
    
    console.log('Territory badges displayed');
}

createDensityGrid() {
    if (!this.densityData || !this.app.graph?.graph) return;
    
    const network = this.app.graph.graph;
    const container = document.getElementById('graph-container');
    
    let gridContainer = document.getElementById('density-grid');
    if (!gridContainer) {
        gridContainer = document.createElement('div');
        gridContainer.id = 'density-grid';
        gridContainer.className = 'absolute top-0 left-0 w-full h-full pointer-events-none';
        gridContainer.style.zIndex = '3';
        container.appendChild(gridContainer);
    } else {
        gridContainer.innerHTML = '';
    }
    
    // Calculer les limites manuellement à partir des positions des nœuds
    const positions = network.getPositions();
    if (!positions || Object.keys(positions).length === 0) {
        console.warn('No node positions available');
        return;
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const nodeId in positions) {
        const pos = positions[nodeId];
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
    }
    
    // Ajouter une marge
    const margin = 100;
    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;
    
    const gridSize = 150; // Taille des cellules
    let cellCount = 0;
    
    for (let x = minX; x <= maxX; x += gridSize) {
        for (let y = minY; y <= maxY; y += gridSize) {
            let localIntensity = 0;
            let count = 0;
            
            // Calculer l'intensité locale basée sur les nœuds proches
            this.densityData.heatmapData.forEach(point => {
                const nodeId = point.nodeId || point.nodeID;
                if (positions[nodeId]) {
                    const dist = Math.sqrt(
                        Math.pow(positions[nodeId].x - x, 2) + 
                        Math.pow(positions[nodeId].y - y, 2)
                    );
                    if (dist < gridSize * 1.5) { // Zone d'influence plus large
                        localIntensity += point.intensity || 0;
                        count++;
                    }
                }
            });
            
            if (count > 0) {
                localIntensity /= count;
                const domPos = network.canvasToDOM({x, y});
                
                const cell = document.createElement('div');
                cell.className = 'absolute rounded-lg'; // Coins arrondis
                cell.style.left = `${domPos.x - gridSize/2}px`;
                cell.style.top = `${domPos.y - gridSize/2}px`;
                cell.style.width = `${gridSize}px`;
                cell.style.height = `${gridSize}px`;
                
                // Couleurs avec gradient selon l'intensité
                if (localIntensity > 0.7) {
                    cell.style.background = `radial-gradient(circle, rgba(239, 68, 68, ${0.3 * localIntensity}), rgba(239, 68, 68, 0.1))`;
                } else if (localIntensity > 0.3) {
                    cell.style.background = `radial-gradient(circle, rgba(245, 158, 11, ${0.3 * localIntensity}), rgba(245, 158, 11, 0.1))`;
                } else {
                    cell.style.background = `radial-gradient(circle, rgba(59, 130, 246, ${0.3 * localIntensity}), rgba(59, 130, 246, 0.1))`;
                }
                
                gridContainer.appendChild(cell);
                cellCount++;
            }
        }
    }
    
    console.log(`Density grid created with ${cellCount} cells`);
}

    updateMetricsDisplay(metrics) {
        // Mettre à jour les métriques affichées
        const density = metrics.globalDensity || 0;
        let densityText = `${Math.round(density * 100)}%`;
        if (density > 0 && density < 0.01) {
            densityText = '< 1%';
        }
        
        const globalDensityEl = document.getElementById('global-density');
        if (globalDensityEl) globalDensityEl.textContent = densityText;
        
        const balanceScoreEl = document.getElementById('balance-score');
        if (balanceScoreEl) balanceScoreEl.textContent = `${Math.round((metrics.balanceScore || 0) * 100)}%`;
        
        const hubCountEl = document.getElementById('hub-count');
        if (hubCountEl) hubCountEl.textContent = metrics.hubs ? metrics.hubs.length : 0;
        
        const peripheralCountEl = document.getElementById('peripheral-count');
        if (peripheralCountEl) peripheralCountEl.textContent = metrics.peripherals ? metrics.peripherals.length : 0;
        
        // Mettre à jour les compteurs de territoires
        if (this.territories) {
            const exploredCountEl = document.getElementById('explored-count');
            if (exploredCountEl) exploredCountEl.textContent = this.territories.explored?.length || 0;
            
            const frontierCountEl = document.getElementById('frontier-count');
            if (frontierCountEl) frontierCountEl.textContent = this.territories.frontier?.length || 0;
            
            const unexploredCountEl = document.getElementById('unexplored-count');
            if (unexploredCountEl) unexploredCountEl.textContent = this.territories.unexplored?.length || 0;
        }
        
        // Afficher les recommandations
        if (metrics.recommendations && metrics.recommendations.length > 0) {
            const recDiv = document.getElementById('density-recommendations');
            const recList = document.getElementById('recommendations-list');
            
            if (recDiv && recList) {
                recDiv.classList.remove('hidden');
                recList.innerHTML = '';
                
                metrics.recommendations.forEach(rec => {
                    const li = document.createElement('li');
                    li.textContent = `• ${rec}`;
                    recList.appendChild(li);
                });
            }
        }
    }

    toggleHeatmap(show) {
        console.log('Toggle heatmap:', show);
        this.renderDensityOverlays();
    }

    toggleTerritories(show) {
        console.log('Toggle territories:', show);
        this.renderDensityOverlays();
    }

    toggleEmptyZones(show) {
        console.log('Toggle empty zones:', show);
        this.renderDensityOverlays();
    }

    async exploreSuggestions() {
        try {
            let graphDataWithPositions = this.app.state.allGraphData;
            if (this.app.graph && this.app.graph.graph) {
                const positions = this.app.graph.graph.getPositions();
                graphDataWithPositions = {
                    ...this.app.state.allGraphData,
                    positions: positions
                };
            }

            const response = await fetch('/api/exploration-suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(graphDataWithPositions)
            });
            
            if (!response.ok) return;
            
            const suggestions = await response.json();
            this.displaySuggestions(suggestions);
            
        } catch (error) {
            console.error('Erreur exploration:', error);
        }
    }

    displaySuggestions(suggestions) {
        let html = '<div class="space-y-4 max-h-96 overflow-y-auto">';
        
        // Connexions prioritaires
        if (suggestions.priorityConnections && suggestions.priorityConnections.length > 0) {
            html += '<div class="border rounded-lg p-3">';
            html += '<h4 class="font-semibold text-sm mb-2">🔗 Connexions Prioritaires</h4>';
            
            suggestions.priorityConnections.slice(0, 5).forEach((conn, idx) => {
                html += `
                    <div class="flex items-center justify-between bg-gray-50 p-2 rounded mb-1">
                        <span class="text-xs">
                            <span class="font-medium">${conn.from}</span> → 
                            <span class="font-medium">${conn.to}</span>
                        </span>
                        <button onclick="window.app.density.applySuggestion('connection', ${idx})" 
                                class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs">
                            Connecter
                        </button>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">${conn.reason}</div>
                `;
            });
            html += '</div>';
        }
        
        // Opportunités de ponts
        if (suggestions.bridgeOpportunities && suggestions.bridgeOpportunities.length > 0) {
            html += '<div class="border rounded-lg p-3">';
            html += '<h4 class="font-semibold text-sm mb-2">🌉 Ponts Conceptuels</h4>';
            
            suggestions.bridgeOpportunities.slice(0, 3).forEach((bridge, idx) => {
                html += `
                    <div class="bg-yellow-50 p-2 rounded mb-2">
                        <div class="text-xs font-medium mb-1">
                            Connecter deux zones (impact: ${Math.round(bridge.impact * 100)}%)
                        </div>
                        <div class="text-xs text-gray-600 mb-1">${bridge.description}</div>
                        <button onclick="window.app.density.applySuggestion('bridge', ${idx})" 
                                class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs">
                            Créer le pont
                        </button>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Équilibrage de densité
        if (suggestions.densityBalancing && suggestions.densityBalancing.length > 0) {
            html += '<div class="border rounded-lg p-3">';
            html += '<h4 class="font-semibold text-sm mb-2">⚖️ Équilibrage de Densité</h4>';
            
            suggestions.densityBalancing.slice(0, 3).forEach((balance, idx) => {
                const actionColor = balance.action === 'densify' ? 'green' : 'purple';
                const actionText = balance.action === 'densify' ? 'Densifier' : 'Distribuer';
                
                html += `
                    <div class="bg-gray-50 p-2 rounded mb-2">
                        <div class="text-xs">
                            <span class="font-medium">Zone:</span> ${balance.zone.length} nœuds
                        </div>
                        <div class="text-xs">
                            <span class="font-medium">Densité:</span> 
                            ${Math.round(balance.currentDensity * 100)}% → 
                            ${Math.round(balance.targetDensity * 100)}%
                        </div>
                        <div class="text-xs text-gray-600 mb-1">${balance.description}</div>
                        <button onclick="window.app.density.applySuggestion('balance', ${idx})" 
                                class="bg-${actionColor}-500 hover:bg-${actionColor}-600 text-white px-2 py-1 rounded text-xs">
                            ${actionText}
                        </button>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        // Stocker les suggestions pour les appliquer
        window.currentSuggestions = suggestions;
        
        this.app.utils.showModal({
            title: '💡 Suggestions d\'Exploration',
            text: html,
            isHtml: true
        });
    }

    async applySuggestion(type, index) {
        if (!window.currentSuggestions) return;
        
        switch(type) {
            case 'connection':
                const conn = window.currentSuggestions.priorityConnections[index];
                if (conn) {
                    await this.createConnection(conn.from, conn.to, conn.reason);
                }
                break;
                
            case 'bridge':
                const bridge = window.currentSuggestions.bridgeOpportunities[index];
                if (bridge) {
                    await this.createBridge(bridge.suggestedNode1, bridge.suggestedNode2);
                }
                break;
                
            case 'balance':
                const balance = window.currentSuggestions.densityBalancing[index];
                if (balance) {
                    await this.balanceZone(balance);
                }
                break;
        }
        
        // Fermer le modal et rafraîchir
        this.app.utils.closeModal(null);
        await this.loadDensityData();
        this.renderDensityVisualization();
    }

    async createConnection(from, to, reason) {
        // Proposer une relation
        const result = await this.app.utils.showModal({
            title: 'Créer une Connexion',
            text: `Connecter <b>${from}</b> et <b>${to}</b><br><small>${reason}</small>`,
            prompt: true,
            inputValue: 'est lié à',
            isHtml: true
        });
        
        if (result && result.text) {
            this.app.editor.addNote(`    ${from} -> ${result.text} -> ${to}`);
            
            // Notification
            this.showNotification('Connexion créée', 'success');
        }
    }

    async createBridge(node1, node2) {
        const result = await this.app.utils.showModal({
            title: 'Créer un Pont Conceptuel',
            text: `Ce pont connectera deux zones distinctes via <b>${node1}</b> et <b>${node2}</b>`,
            prompt: true,
            inputValue: 'pont vers',
            isHtml: true
        });
        
        if (result && result.text) {
            this.app.editor.addNote(`    ${node1} -> ${result.text} -> ${node2}`);
            this.showNotification('Pont conceptuel créé', 'success');
        }
    }

    async balanceZone(balance) {
        if (balance.action === 'densify') {
            // Suggérer des connexions internes
            await this.densifyZone(balance.zone);
        } else {
            // Suggérer la distribution vers d'autres zones
            await this.distributeZone(balance.zone);
        }
    }

    async densifyZone(nodes) {
        if (nodes.length < 2) {
            this.showNotification('Zone trop petite pour densifier', 'warning');
            return;
        }
        
        // Proposer de connecter les premiers nœuds
        const result = await this.app.utils.showModal({
            title: 'Densifier la Zone',
            text: `Ajouter des connexions entre : <b>${nodes[0]}</b> et <b>${nodes[1]}</b>`,
            prompt: true,
            inputValue: 'interagit avec',
            isHtml: true
        });
        
        if (result && result.text) {
            this.app.editor.addNote(`    ${nodes[0]} -> ${result.text} -> ${nodes[1]}`);
            this.showNotification('Zone densifiée', 'success');
        }
    }

    async distributeZone(nodes) {
        // Créer des sous-groupes
        const result = await this.app.utils.showModal({
            title: 'Distribuer la Zone',
            text: `Cette zone est trop dense. Créer un sous-groupe pour mieux organiser?`,
            prompt: true,
            inputValue: 'Sous-groupe',
            isHtml: true
        });
        
        if (result && result.text) {
            const halfNodes = nodes.slice(0, Math.floor(nodes.length / 2));
            this.app.editor.addNote(`    ${result.text} => { ${halfNodes.join('; ')} }`);
            this.showNotification('Zone distribuée', 'success');
        }
    }

    async balanceDensity() {
        try {
            // Récupérer les positions pour l'équilibrage
            let graphDataWithPositions = this.app.state.allGraphData;
            if (this.app.graph.graph) {
                const positions = this.app.graph.graph.getPositions();
                graphDataWithPositions = {
                    ...this.app.state.allGraphData,
                    positions: positions
                };
            }

            const response = await fetch('/api/exploration-suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(graphDataWithPositions)
            });
            
            if (!response.ok) return;
            
            const suggestions = await response.json();
            
            // Appliquer automatiquement les suggestions d'équilibrage
            let applied = 0;
            
            for (const balance of suggestions.densityBalancing) {
                if (applied >= 3) break; // Limiter à 3 changements automatiques
                
                if (balance.action === 'densify' && balance.zone.length >= 2) {
                    // Ajouter une connexion simple
                    this.app.editor.addNote(`    ${balance.zone[0]} -> est associé à -> ${balance.zone[1]}`);
                    applied++;
                }
            }
            
            if (applied > 0) {
                this.showNotification(`${applied} ajustements appliqués`, 'success');
                
                // Rafraîchir la vue
                setTimeout(async () => {
                    await this.loadDensityData();
                    this.renderDensityVisualization();
                }, 500);
            } else {
                this.showNotification('Le graphe est déjà équilibré', 'info');
            }
            
        } catch (error) {
            console.error('Erreur équilibrage:', error);
            this.showNotification('Erreur lors de l\'équilibrage', 'error');
        }
    }

    showSuggestions() {
        // Afficher des indicateurs visuels sur le graphe
        if (!this.app.graph.graph || !window.currentSuggestions) return;
        
        const suggestions = window.currentSuggestions;
        
        // Mettre en évidence les connexions suggérées
        if (suggestions.priorityConnections) {
            suggestions.priorityConnections.forEach(conn => {
                // Créer une ligne pointillée entre les nœuds
                this.drawSuggestedConnection(conn.from, conn.to);
            });
        }
    }

    hideSuggestions() {
        // Retirer les indicateurs visuels
        const suggestedLines = document.querySelectorAll('.suggested-connection');
        suggestedLines.forEach(line => line.remove());
    }

    drawSuggestedConnection(from, to) {
        if (!this.app.graph.graph) return;
        
        const network = this.app.graph.graph;
        const positions = network.getPositions([from, to]);
        
        if (!positions[from] || !positions[to]) return;
        
        const fromPos = network.canvasToDOM(positions[from]);
        const toPos = network.canvasToDOM(positions[to]);
        
        // Créer une ligne SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.className = 'suggested-connection absolute pointer-events-none';
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.zIndex = '15';
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromPos.x);
        line.setAttribute('y1', fromPos.y);
        line.setAttribute('x2', toPos.x);
        line.setAttribute('y2', toPos.y);
        line.setAttribute('stroke', '#10b981');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '5,5');
        line.setAttribute('opacity', '0.6');
        
        svg.appendChild(line);
        
        const container = document.getElementById('graph-container');
        if (container) {
            container.appendChild(svg);
        }
    }

    // Méthode pour exporter la carte de densité
    async exportDensityReport() {
        if (!this.densityData || !this.territories) {
            this.showNotification('Aucune donnée de densité à exporter', 'warning');
            return;
        }
        
        let report = `
            <html>
            <head>
                <title>Rapport de Densité Conceptuelle</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .territory { margin: 20px 0; padding: 15px; border-radius: 8px; }
                    .explored { background: #fee2e2; }
                    .frontier { background: #fef3c7; }
                    .unexplored { background: #dbeafe; }
                    .metric { display: inline-block; margin: 5px 10px; }
                </style>
            </head>
            <body>
                <h1>Carte de Densité Conceptuelle</h1>
                <p>Généré le ${new Date().toLocaleString()}</p>
                
                <h2>Métriques Globales</h2>
                <div>
                    <span class="metric">Densité globale: ${Math.round(this.densityData.globalDensity * 100)}%</span>
                </div>
                
                <h2>Territoires Explorés (${this.territories.explored.length})</h2>
        `;
        
        this.territories.explored.forEach(t => {
            report += `
                <div class="territory explored">
                    <h3>${t.centralNode}</h3>
                    <p>${t.description}</p>
                    <p>Densité: ${Math.round(t.density * 100)}% | Taille: ${t.size} nœuds</p>
                </div>
            `;
        });
        
        report += `<h2>Zones Frontières (${this.territories.frontier.length})</h2>`;
        
        this.territories.frontier.forEach(t => {
            report += `
                <div class="territory frontier">
                    <h3>${t.centralNode}</h3>
                    <p>${t.description}</p>
                    <p>Densité: ${Math.round(t.density * 100)}% | Taille: ${t.size} nœuds</p>
                </div>
            `;
        });
        
        report += `<h2>Territoires Inexplorés (${this.territories.unexplored.length})</h2>`;
        
        this.territories.unexplored.forEach(t => {
            report += `
                <div class="territory unexplored">
                    <h3>${t.centralNode || 'Zone ' + t.id}</h3>
                    <p>${t.description}</p>
                    <p>Taille: ${t.size} nœuds</p>
                </div>
            `;
        });
        
        report += '</body></html>';
        
        // Télécharger le rapport
        const blob = new Blob([report], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `density_report_${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Rapport exporté', 'success');
    }

    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-4 py-2 rounded shadow-lg z-50`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }


}