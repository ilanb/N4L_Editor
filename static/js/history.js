// Module de gestion de l'historique et du versioning sémantique

export class HistoryManager {
    constructor(app) {
        this.app = app;
        this.versions = [];
        this.currentVersionIndex = -1;
        this.previousGraphState = null;
        this.autoSaveInterval = null;
        this.changeBuffer = [];
        this.lastSaveTime = Date.now();
    }

    init() {
        this.setupUI();
        this.startAutoSave();
        this.loadVersionHistory();
    }

    setupUI() {
        // Ajouter le bouton d'historique dans la barre d'outils
        const historyBtn = document.createElement('button');
        historyBtn.id = 'history-btn';
        historyBtn.className = 'bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-3 rounded-md text-sm ml-2';
        historyBtn.innerHTML = `Historique`;
        historyBtn.onclick = () => this.showHistoryPanel();

        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.parentNode.insertBefore(historyBtn, downloadBtn);
        }

        // Créer le panneau d'historique
        this.createHistoryPanel();
        
        // Ajouter les indicateurs dans le panneau d'aide
        this.createStatusIndicators();
    }

    createHistoryPanel() {
        const panel = document.createElement('div');
        panel.id = 'history-panel';
        panel.className = 'hidden fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col';
        panel.innerHTML = `
            <div class="p-4 border-b flex justify-between items-center">
                <h2 class="text-xl font-bold">Historique Sémantique</h2>
                <button id="close-history" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            
            <div class="p-4 border-b bg-gray-50">
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div class="text-center">
                        <div id="confidence-meter" class="mb-1">
                            <div class="bg-gray-200 rounded-full h-2">
                                <div id="confidence-bar" class="bg-green-500 h-2 rounded-full transition-all" style="width: 0%"></div>
                            </div>
                        </div>
                        <span class="text-xs text-gray-600">Confiance: <span id="confidence-value">0%</span></span>
                    </div>
                    <div class="text-center">
                        <span class="text-2xl" id="version-count">0</span>
                        <div class="text-xs text-gray-600">Versions</div>
                    </div>
                </div>
                
                <div class="mt-3 flex gap-2">
                    <button id="save-version-btn" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs">
                        Sauvegarder Version
                    </button>
                    <button id="compare-versions-btn" class="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-1 px-2 rounded text-xs">
                        Comparer
                    </button>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto p-4">
                <div id="history-timeline" class="space-y-2"></div>
            </div>
            
            <div class="p-4 border-t bg-gray-50">
                <div id="eureka-indicator" class="hidden bg-yellow-100 border border-yellow-400 rounded p-2 mb-2">
                    <span class="text-yellow-800 font-semibold">💡 Moment Eureka Détecté!</span>
                </div>
                 <button id="clear-history-btn" class="w-full bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded text-xs mb-2">
                    Vider tout l'historique
                </button>
                <div class="text-xs text-gray-600">
                    <div>Sauvegarde auto: <span id="auto-save-status">Active</span></div>
                    <div>Dernière sauvegarde: <span id="last-save-time">-</span></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Attacher les événements
        document.getElementById('close-history').onclick = () => this.hideHistoryPanel();
        document.getElementById('save-version-btn').onclick = () => this.saveVersion();
        document.getElementById('compare-versions-btn').onclick = () => this.showComparisonDialog();
        document.getElementById('clear-history-btn').onclick = () => this.clearHistory(); // <-- NOUVEAU
    }

    createStatusIndicators() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'version-status';
        statusDiv.className = 'absolute top-2 right-2 bg-white rounded shadow p-2 text-xs';
        statusDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <span id="change-indicator" class="hidden text-orange-500">●</span>
                <span id="version-label">Non sauvegardé</span>
            </div>
        `;
        
        const graphView = document.getElementById('graph-view');
        if (graphView) {
            graphView.appendChild(statusDiv);
        }
    }

    startAutoSave() {
        // Sauvegarde automatique toutes les 5 minutes si des changements
        this.autoSaveInterval = setInterval(() => {
            if (this.hasSignificantChanges()) {
                this.saveVersion('Sauvegarde automatique', true);
            }
        }, 5 * 60 * 1000);
    }

    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    async loadVersionHistory() {
        try {
            const response = await fetch('/api/version-history');
            if (response.ok) {
                this.versions = await response.json();
                this.updateHistoryDisplay();
            }
        } catch (error) {
            console.error('Erreur chargement historique:', error);
        }
    }

    async saveVersion(description = '', isAuto = false) {
        if (!this.app.state.allGraphData || this.app.state.allGraphData.nodes.length === 0) {
            if (!isAuto) {
                await this.app.utils.showModal({
                    title: 'Graphe vide',
                    text: 'Aucune donnée à sauvegarder.'
                });
            }
            return;
        }

        // Demander une description si manuelle et pas fournie
        if (!isAuto && !description) {
            const result = await this.app.utils.showModal({
                title: 'Sauvegarder Version',
                text: 'Décrivez cette version (optionnel):',
                prompt: true
            });
            
            if (!result) return;
            description = result.text || `Version ${this.versions.length + 1}`;
        }

        try {
            const response = await fetch('/api/save-version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    graphData: this.app.state.allGraphData,
                    previousGraphData: this.previousGraphState || { nodes: [], edges: [] },
                    description: description
                })
            });

            if (response.ok) {
                const version = await response.json();
                this.versions.unshift(version);
                this.previousGraphState = JSON.parse(JSON.stringify(this.app.state.allGraphData));
                this.lastSaveTime = Date.now();
                
                this.updateHistoryDisplay();
                this.showSaveNotification(version);
                
                // Si moment eureka, notification spéciale
                if (version.isEurekaMoment) {
                    this.showEurekaNotification(version);
                }
                
                // Mettre à jour les métriques
                this.updateMetrics(version);
            }
        } catch (error) {
            console.error('Erreur sauvegarde version:', error);
            if (!isAuto) {
                await this.app.utils.showModal({
                    title: 'Erreur',
                    text: 'Impossible de sauvegarder la version.'
                });
            }
        }
    }
    
    // NOUVELLE MÉTHODE
    async deleteVersion(versionId) {
        const confirm = await this.app.utils.showModal({
            title: 'Supprimer la Version',
            text: `Êtes-vous sûr de vouloir supprimer la version ${versionId} ? Cette action est irréversible.`,
            confirm: true
        });

        if (!confirm) return;

        try {
            const response = await fetch('/api/delete-version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionId: versionId })
            });
            
            if (response.ok) {
                await this.loadVersionHistory(); // Recharger l'historique
            } else {
                 throw new Error(await response.text());
            }
        } catch (error) {
            console.error('Erreur suppression version:', error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: `Impossible de supprimer la version: ${error.message}`
            });
        }
    }

    // NOUVELLE MÉTHODE
    async clearHistory() {
        const confirm = await this.app.utils.showModal({
            title: 'Vider tout l\'historique',
            text: `Êtes-vous sûr de vouloir supprimer TOUTES les versions ? Cette action est irréversible.`,
            confirm: true,
        });

        if (!confirm) return;

        try {
            const response = await fetch('/api/clear-history', { method: 'POST' });
            if (response.ok) {
                this.versions = [];
                this.updateHistoryDisplay();
            } else {
                throw new Error(await response.text());
            }
        } catch (error) {
            console.error('Erreur vidage historique:', error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: `Impossible de vider l'historique: ${error.message}`
            });
        }
    }

    async restoreVersion(versionId) {
        const confirm = await this.app.utils.showModal({
            title: 'Restaurer Version',
            text: 'Êtes-vous sûr de vouloir restaurer cette version? Les changements actuels non sauvegardés seront perdus.',
            confirm: true
        });

        if (!confirm) return;

        try {
            const response = await fetch('/api/restore-version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionId: versionId })
            });

            if (response.ok) {
                const restoredVersion = await response.json();
                
                // Appliquer le graphe restauré
                this.app.state.allGraphData = restoredVersion.graphData;
                await this.app.graph.update();
                
                // Reconstruire l'éditeur N4L
                this.reconstructN4LFromGraph(restoredVersion.graphData);
                
                await this.app.utils.showModal({
                    title: 'Version Restaurée',
                    text: `Version ${versionId} restaurée avec succès.`
                });
                
                this.loadVersionHistory();
            }
        } catch (error) {
            console.error('Erreur restauration:', error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: 'Impossible de restaurer la version.'
            });
        }
    }

    async compareVersions(v1Id, v2Id) {
        try {
            const response = await fetch('/api/compare-versions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    version1Id: v1Id,
                    version2Id: v2Id
                })
            });

            if (response.ok) {
                const comparison = await response.json();
                this.displayComparison(comparison);
            }
        } catch (error) {
            console.error('Erreur comparaison:', error);
        }
    }

    updateHistoryDisplay() {
        const timeline = document.getElementById('history-timeline');
        if (!timeline) return;

        timeline.innerHTML = '';
        
        if (this.versions.length === 0) {
            timeline.innerHTML = `<div class="text-center text-gray-500 text-sm p-4">Aucune version sauvegardée.</div>`;
        }
        
        this.versions.forEach((version, index) => {
            const versionCard = document.createElement('div');
            versionCard.className = `border rounded-lg p-3 hover:bg-gray-50 transition-colors ${
                version.isEurekaMoment ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
            }`;
            
            const timeAgo = this.getTimeAgo(new Date(version.timestamp));
            const confidenceColor = this.getConfidenceColor(version.confidence);
            
            // Ajout de l'événement onclick pour la suppression
            versionCard.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-semibold text-sm">${version.id}</span>
                        ${version.isEurekaMoment ? '<span class="ml-2 text-yellow-600">💡</span>' : ''}
                        ${version.isRestore ? '<span class="ml-2 text-blue-600">↺</span>' : ''}
                    </div>
                    <span class="text-xs text-gray-500">${timeAgo}</span>
                </div>
                
                <div class="text-xs text-gray-700 mb-2">${version.description || 'Sans description'}</div>
                
                <div class="flex items-center justify-between text-xs">
                    <div class="flex gap-2">
                        <span class="bg-gray-100 px-2 py-1 rounded">📊 ${version.metrics.nodeCount}N / ${version.metrics.edgeCount}E</span>
                        <span class="bg-${confidenceColor}-100 text-${confidenceColor}-700 px-2 py-1 rounded">
                            ${Math.round(version.confidence * 100)}%
                        </span>
                    </div>
                    <div class="flex gap-1">
                        <button class="hover:bg-gray-200 p-1 rounded" onclick="window.app.history.restoreVersion('${version.id}')" title="Restaurer">↺</button>
                        <button class="hover:bg-gray-200 p-1 rounded" onclick="window.app.history.viewVersion('${version.id}')" title="Voir les détails">👁</button>
                        <button class="hover:bg-red-100 text-red-500 p-1 rounded" onclick="window.app.history.deleteVersion('${version.id}')" title="Supprimer">🗑️</button>
                    </div>
                </div>
                
                ${version.insights && version.insights.length > 0 ? `
                    <div class="mt-2 pt-2 border-t">
                        <div class="text-xs font-semibold mb-1">Insights:</div>
                        ${version.insights.map(i => `<div class="text-xs text-gray-600">• ${i}</div>`).join('')}
                    </div>
                ` : ''}
                
                ${version.tags && version.tags.length > 0 ? `
                    <div class="mt-2 flex flex-wrap gap-1">
                        ${version.tags.map(tag => `<span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">#${tag}</span>`).join('')}
                    </div>
                ` : ''}
            `;
            
            timeline.appendChild(versionCard);
        });
        
        // Mettre à jour le compteur
        document.getElementById('version-count').textContent = this.versions.length;
    }

    displayComparison(comparison) {
        const modalContent = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h3 class="font-semibold mb-2">${comparison.version1.id}</h3>
                    <div class="text-sm text-gray-600">${new Date(comparison.version1.timestamp).toLocaleString()}</div>
                </div>
                <div>
                    <h3 class="font-semibold mb-2">${comparison.version2.id}</h3>
                    <div class="text-sm text-gray-600">${new Date(comparison.version2.timestamp).toLocaleString()}</div>
                </div>
            </div>
            
            <div class="mt-4 space-y-3">
                <div class="border rounded p-2">
                    <div class="font-semibold text-sm mb-1 text-green-700">+ Ajouts</div>
                    <div class="text-xs">
                        <div>Nœuds: ${comparison.addedNodes.length}</div>
                        <div>Relations: ${comparison.addedEdges.length}</div>
                    </div>
                </div>
                
                <div class="border rounded p-2">
                    <div class="font-semibold text-sm mb-1 text-red-700">- Suppressions</div>
                    <div class="text-xs">
                        <div>Nœuds: ${comparison.removedNodes.length}</div>
                        <div>Relations: ${comparison.removedEdges.length}</div>
                    </div>
                </div>
                
                <div class="border rounded p-2">
                    <div class="font-semibold text-sm mb-1">Δ Métriques</div>
                    <div class="text-xs">
                        <div>Nœuds: ${comparison.metricsDelta.nodeCountDelta > 0 ? '+' : ''}${comparison.metricsDelta.nodeCountDelta}</div>
                        <div>Relations: ${comparison.metricsDelta.edgeCountDelta > 0 ? '+' : ''}${comparison.metricsDelta.edgeCountDelta}</div>
                        <div>Densité: ${comparison.metricsDelta.densityDelta > 0 ? '+' : ''}${comparison.metricsDelta.densityDelta.toFixed(3)}</div>
                    </div>
                </div>
            </div>
        `;
        
        this.app.utils.showModal({
            title: 'Comparaison de Versions',
            text: modalContent,
            isHtml: true
        });
    }

    showSaveNotification(version) {
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 left-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center';
        notification.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            Version ${version.id} sauvegardée
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    showEurekaNotification(version) {
        const eureka = document.getElementById('eureka-indicator');
        if (eureka) {
            eureka.classList.remove('hidden');
            setTimeout(() => eureka.classList.add('hidden'), 5000);
        }
        
        // Notification plus visible
        const notification = document.createElement('div');
        notification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-6 py-4 rounded-lg shadow-xl z-50';
        notification.innerHTML = `
            <div class="text-2xl font-bold mb-2">💡 Moment Eureka!</div>
            <div class="text-sm">${version.insights[0] || 'Connexion majeure établie'}</div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }

    updateMetrics(version) {
        // Mettre à jour la barre de confiance
        const confidenceBar = document.getElementById('confidence-bar');
        const confidenceValue = document.getElementById('confidence-value');
        
        if (confidenceBar && confidenceValue) {
            const percentage = Math.round(version.confidence * 100);
            confidenceBar.style.width = `${percentage}%`;
            confidenceValue.textContent = `${percentage}%`;
            
            // Changer la couleur selon le niveau
            confidenceBar.className = `h-2 rounded-full transition-all ${
                percentage > 70 ? 'bg-green-500' :
                percentage > 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`;
        }
        
        // Mettre à jour le temps de dernière sauvegarde
        document.getElementById('last-save-time').textContent = new Date().toLocaleTimeString();
    }

    hasSignificantChanges() {
        if (!this.previousGraphState) return true;
        
        const current = this.app.state.allGraphData;
        const prev = this.previousGraphState;
        
        // Vérifier s'il y a des changements significatifs
        const nodesDiff = Math.abs(current.nodes.length - prev.nodes.length);
        const edgesDiff = Math.abs(current.edges.length - prev.edges.length);
        
        return nodesDiff >= 3 || edgesDiff >= 5;
    }

    reconstructN4LFromGraph(graphData) {
        // Reconstruire le contenu N4L à partir du graphe
        let n4lContent = '';
        const contextGroups = {};
        
        // Grouper par contexte
        graphData.edges.forEach(edge => {
            const context = edge.context || 'general';
            if (!contextGroups[context]) {
                contextGroups[context] = [];
            }
            
            let note = '';
            switch(edge.type) {
                case 'relation':
                    note = `${edge.from} -> ${edge.label} -> ${edge.to}`;
                    break;
                case 'equivalence':
                    note = `${edge.from} <-> ${edge.to}`;
                    break;
                case 'group':
                    // Gérer les groupes (simplification)
                    note = `${edge.from} -> contient -> ${edge.to}`;
                    break;
            }
            
            if (note && !contextGroups[context].includes(note)) {
                contextGroups[context].push(note);
            }
        });
        
        // Construire le contenu N4L
        for (const context in contextGroups) {
            if (contextGroups[context].length > 0) {
                n4lContent += `:: ${context} ::\n\n`;
                contextGroups[context].forEach(note => {
                    n4lContent += `    ${note}\n`;
                });
                n4lContent += '\n';
            }
        }
        
        // Mettre à jour l'éditeur
        this.app.editor.updateContent(n4lContent);
    }

    showHistoryPanel() {
        document.getElementById('history-panel').classList.remove('hidden');
        this.loadVersionHistory();
    }

    hideHistoryPanel() {
        document.getElementById('history-panel').classList.add('hidden');
    }

    async showComparisonDialog() {
        if (this.versions.length < 2) {
            await this.app.utils.showModal({
                title: 'Comparaison impossible',
                text: 'Il faut au moins 2 versions pour comparer.'
            });
            return;
        }
        
        // Créer un dialogue de sélection
        const options = this.versions.map(v => 
            `<option value="${v.id}">${v.id} - ${v.description || 'Sans description'}</option>`
        ).join('');
        
        const modalContent = `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Version 1:</label>
                    <select id="compare-v1" class="w-full p-2 border rounded">
                        ${options}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Version 2:</label>
                    <select id="compare-v2" class="w-full p-2 border rounded">
                        ${options}
                    </select>
                </div>
            </div>
        `;
        
        const result = await this.app.utils.showModal({
            title: 'Comparer les Versions',
            text: modalContent,
            isHtml: true,
            confirm: true
        });
        
        if (result) {
            const v1 = document.getElementById('compare-v1').value;
            const v2 = document.getElementById('compare-v2').value;
            
            if (v1 !== v2) {
                this.compareVersions(v1, v2);
            }
        }
    }

    viewVersion(versionId) {
        const version = this.versions.find(v => v.id === versionId);
        if (!version) return;
        
        // Afficher les détails de la version
        const detailsHtml = `
            <div class="space-y-3">
                <div>
                    <span class="font-semibold">ID:</span> ${version.id}
                </div>
                <div>
                    <span class="font-semibold">Date:</span> ${new Date(version.timestamp).toLocaleString()}
                </div>
                <div>
                    <span class="font-semibold">Description:</span> ${version.description || 'Aucune'}
                </div>
                <div>
                    <span class="font-semibold">Confiance:</span> ${Math.round(version.confidence * 100)}%
                </div>
                
                <div class="border-t pt-3">
                    <div class="font-semibold mb-2">Métriques:</div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>Nœuds: ${version.metrics.nodeCount}</div>
                        <div>Relations: ${version.metrics.edgeCount}</div>
                        <div>Densité: ${version.metrics.density.toFixed(3)}</div>
                        <div>Composantes: ${version.metrics.components}</div>
                        <div>Degré moyen: ${version.metrics.averageDegree.toFixed(2)}</div>
                        <div>Orphelins: ${version.metrics.orphanNodes}</div>
                    </div>
                </div>
                
                ${version.changes && version.changes.length > 0 ? `
                    <div class="border-t pt-3">
                        <div class="font-semibold mb-2">Changements (${version.changes.length}):</div>
                        <div class="max-h-40 overflow-y-auto space-y-1">
                            ${version.changes.map(c => `
                                <div class="text-xs p-1 bg-gray-50 rounded">
                                    <span class="font-medium">${c.type}:</span> ${c.description}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${version.insights && version.insights.length > 0 ? `
                    <div class="border-t pt-3">
                        <div class="font-semibold mb-2">Insights:</div>
                        ${version.insights.map(i => `<div class="text-sm text-gray-700">• ${i}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        this.app.utils.showModal({
            title: `Détails de la Version ${version.id}`,
            text: detailsHtml,
            isHtml: true
        });
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        const intervals = {
            année: 31536000,
            mois: 2592000,
            semaine: 604800,
            jour: 86400,
            heure: 3600,
            minute: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `Il y a ${interval} ${unit}${interval > 1 ? 's' : ''}`;
            }
        }
        
        return 'À l\'instant';
    }

    getConfidenceColor(confidence) {
        if (confidence > 0.7) return 'green';
        if (confidence > 0.4) return 'yellow';
        return 'red';
    }

    // Méthode pour détecter les changements en temps réel
    trackChange(changeType, details) {
        this.changeBuffer.push({
            type: changeType,
            details: details,
            timestamp: Date.now()
        });
        
        // Afficher l'indicateur de changement
        const indicator = document.getElementById('change-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
        
        // Vérifier si c'est un changement significatif
        if (this.changeBuffer.length >= 5) {
            const label = document.getElementById('version-label');
            if (label) {
                label.textContent = 'Changements non sauvegardés';
                label.classList.add('text-orange-500');
            }
        }
    }

    // Intégration avec l'export
    async exportEvolutionReport() {
        try {
            const response = await fetch('/api/evolution-timeline');
            if (response.ok) {
                const timeline = await response.json();
                
                // Créer un rapport HTML
                let report = `
                    <html>
                    <head>
                        <title>Rapport d'Évolution - N4L</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            .event { margin: 20px 0; padding: 15px; border-left: 3px solid #4f46e5; }
                            .eureka { border-color: #f59e0b; background: #fef3c7; }
                            .high-impact { border-color: #ef4444; }
                            .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                        </style>
                    </head>
                    <body>
                        <h1>Rapport d'Évolution du Graphe de Connaissances</h1>
                        <p>Généré le ${new Date().toLocaleString()}</p>
                `;
                
                timeline.forEach(event => {
                    const eventClass = event.type === 'eureka' ? 'eureka' : 
                                       event.impact === 'high' ? 'high-impact' : '';
                    
                    report += `
                        <div class="event ${eventClass}">
                            <h3>${event.versionId} - ${new Date(event.timestamp).toLocaleString()}</h3>
                            <p>${event.description}</p>
                            <div class="metrics">
                                <div>Nœuds: ${event.metrics.nodeCount}</div>
                                <div>Relations: ${event.metrics.edgeCount}</div>
                                <div>Densité: ${event.metrics.density.toFixed(3)}</div>
                            </div>
                            ${event.insights ? `<div><strong>Insights:</strong> ${event.insights.join(', ')}</div>` : ''}
                        </div>
                    `;
                });
                
                report += '</body></html>';
                
                // Télécharger le rapport
                const blob = new Blob([report], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `evolution_report_${Date.now()}.html`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Erreur export rapport:', error);
        }
    }
}