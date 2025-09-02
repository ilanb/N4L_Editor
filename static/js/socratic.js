// Module de gestion du mode Socratique

export class SocraticManager {
    constructor(app) {
        this.app = app;
        this.currentSession = null;
        this.isActive = false;
        this.dialogHistory = [];
        this.currentMode = 'exploration'; // exploration, clarification, challenge, synthesis
    }

    init() {
        this.setupUI();
        this.setupKeyboardShortcuts();
    }

    setupUI() {
        // Ajouter le bouton Socratique dans la barre d'outils
        this.createSocraticButton();
        
        // Créer le dialogue Socratique
        this.createSocraticDialog();
        
        // Créer le panneau de progression
        this.createProgressPanel();
    }

    createSocraticButton() {
        const btn = document.createElement('button');
        btn.id = 'socratic-btn';
        btn.className = 'bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-3 rounded-md text-sm ml-2';
        btn.innerHTML = `Socratique`;
        btn.onclick = () => this.toggleSocraticMode();

        const tooltipText = document.createElement('span');
        tooltipText.className = 'tooltip-text';
        tooltipText.textContent = 'Lance un dialogue guidé par des questions pour explorer un sujet en profondeur.';
        
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn?.parentNode) {
            downloadBtn.parentNode.insertBefore(btn, downloadBtn);
        }
    }

    createSocraticDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'socratic-dialog';
        dialog.className = 'hidden fixed inset-0 flex items-center justify-center';
        dialog.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <!-- Header -->
                <div class="p-4 border-b flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold text-gray-900">Dialogue Socratique</h2>
                        <p class="text-sm text-gray-500 mt-1">Explorons vos idées ensemble à travers des questions.</p>
                    </div>
                    <button id="close-socratic" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <!-- Mode selector -->
                <div class="px-4 py-2 border-b">
                    <div class="flex gap-4">
                        <button class="mode-btn text-sm font-medium text-gray-600 hover:text-gray-900 pb-1" data-mode="exploration">Exploration</button>
                        <button class="mode-btn text-sm font-medium text-gray-600 hover:text-gray-900 pb-1" data-mode="clarification">Clarification</button>
                        <button class="mode-btn text-sm font-medium text-gray-600 hover:text-gray-900 pb-1" data-mode="challenge">Défi</button>
                        <button class="mode-btn text-sm font-medium text-gray-600 hover:text-gray-900 pb-1" data-mode="synthesis">Synthèse</button>
                    </div>
                </div>

                <!-- Conversation area -->
                <div id="socratic-conversation" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                    <!-- Messages will appear here -->
                </div>

                <!-- Input area -->
                <div class="p-4 border-t bg-white">
                    <div id="current-question" class="mb-3 p-3 border border-gray-200 rounded-lg">
                        <div class="font-medium text-gray-800 mb-2" id="question-text">
                            Prêt à commencer ? Quel sujet souhaitez-vous explorer ?
                        </div>
                        <div id="question-hints" class="text-xs text-gray-500 italic"></div>
                    </div>
                    
                    <div class="flex gap-3">
                        <textarea 
                            id="socratic-answer" 
                            class="flex-1 p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            rows="2"
                            placeholder="Votre réponse..."
                        ></textarea>
                        <div class="flex flex-col gap-2">
                            <button id="submit-answer" class="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-4 py-2 rounded-md h-full">
                                Répondre
                            </button>
                            <button id="skip-question" class="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm">
                                Passer
                            </button>
                        </div>
                    </div>

                    <!-- Quick actions -->
                    <div class="mt-3 flex gap-4">
                        <button class="quick-action text-xs text-gray-500 hover:text-gray-800 hover:underline">Je ne sais pas</button>
                        <button class="quick-action text-xs text-gray-500 hover:text-gray-800 hover:underline">Pouvez-vous reformuler ?</button>
                        <button class="quick-action text-xs text-gray-500 hover:text-gray-800 hover:underline">Donnez-moi un exemple</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Attacher les événements
        document.getElementById('close-socratic').onclick = () => this.closeSocraticDialog();
        document.getElementById('submit-answer').onclick = () => this.submitAnswer();
        document.getElementById('skip-question').onclick = () => this.skipQuestion();

        // Mode buttons
        dialog.querySelectorAll('.mode-btn').forEach(btn => {
            btn.onclick = (e) => this.switchMode(e.currentTarget.dataset.mode);
        });

        // Quick actions
        dialog.querySelectorAll('.quick-action').forEach(btn => {
            btn.onclick = (e) => {
                document.getElementById('socratic-answer').value = e.currentTarget.textContent;
            };
        });

        // Enter to submit (Shift+Enter for new line)
        document.getElementById('socratic-answer').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitAnswer();
            }
        });

        this.switchMode('exploration'); // Set initial active mode style
    }

    createProgressPanel() {
        const panel = document.createElement('div');
        panel.id = 'socratic-progress';
        panel.className = 'hidden fixed bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 w-64 border';
        panel.innerHTML = `
            <h4 class="font-semibold text-sm mb-2 text-gray-800">Progression</h4>
            <div class="space-y-2">
                <div class="flex justify-between text-xs text-gray-600"><span>Questions:</span><span id="progress-questions">0</span></div>
                <div class="flex justify-between text-xs text-gray-600"><span>Profondeur:</span><span id="progress-depth">0</span></div>
                <div class="flex justify-between text-xs text-gray-600"><span>Insights:</span><span id="progress-insights">0</span></div>
                <div class="flex justify-between text-xs text-gray-600"><span>Phase:</span><span id="progress-phase" class="font-medium text-gray-800">...</span></div>
                <div class="mt-2"><div class="bg-gray-200 rounded-full h-2"><div id="progress-bar" class="bg-indigo-600 h-2 rounded-full" style="width: 0%"></div></div></div>
            </div>
            <button id="show-summary" class="mt-3 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs py-1 rounded border">Voir le résumé</button>
        `;
        document.body.appendChild(panel);
        document.getElementById('show-summary').onclick = () => this.showSummary();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;
            
            // Ctrl/Cmd + Enter pour soumettre
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.submitAnswer();
            }
            
            // Escape pour fermer
            if (e.key === 'Escape') {
                this.closeSocraticDialog();
            }
        });
    }

    async toggleSocraticMode() {
        if (this.isActive) {
            this.closeSocraticDialog();
        } else {
            await this.startSocraticSession();
        }
    }

    async startSocraticSession() {
        // Demander le sujet si pas de nœud sélectionné
        let topic = '';
        const selectedNodes = this.app.graph.graph?.getSelectedNodes();
        if (selectedNodes && selectedNodes.length > 0) {
            const node = this.app.state.allGraphData.nodes.find(n => n.id === selectedNodes[0]);
            if (node) {
                topic = node.label;
            }
        }

        if (!topic) {
            const result = await this.app.utils.showModal({
                title: 'Sujet du Dialogue Socratique',
                text: 'Quel sujet souhaitez-vous explorer en profondeur ?',
                prompt: true,
                inputValue: ''
            });
            
            if (!result || !result.text) return;
            topic = result.text;
        }

        try {
            const response = await fetch('/api/start-socratic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topic,
                    context: this.app.state.currentContext,
                    graphData: this.app.state.allGraphData,
                    mode: this.currentMode
                })
            });

            if (!response.ok) throw new Error('Erreur démarrage session');

            const data = await response.json();
            this.currentSession = data;
            
            // Afficher le dialogue
            this.showSocraticDialog();
            
            // Afficher la première question
            this.displayQuestion(data.question);
            
            // Mettre à jour la progression
            this.updateProgress(data.progress);
            
            // Activer le mode
            this.isActive = true;
            document.getElementById('socratic-btn').classList.add('bg-green-600');
            
        } catch (error) {
            console.error('Erreur Socratique:', error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: 'Impossible de démarrer la session socratique.'
            });
        }
    }

    showSocraticDialog() {
        document.getElementById('socratic-dialog').classList.remove('hidden');
        document.getElementById('socratic-progress').classList.remove('hidden');
        
        // Réinitialiser la conversation
        document.getElementById('socratic-conversation').innerHTML = '';
        document.getElementById('socratic-answer').value = '';
        
        // Focus sur le champ de réponse
        setTimeout(() => {
            document.getElementById('socratic-answer').focus();
        }, 100);
    }

    closeSocraticDialog() {
        document.getElementById('socratic-dialog').classList.add('hidden');
        document.getElementById('socratic-progress').classList.add('hidden');
        
        this.isActive = false;
        document.getElementById('socratic-btn').classList.remove('bg-green-600');
        
        // Si session en cours, proposer de sauvegarder les insights
        if (this.currentSession && this.dialogHistory.length > 2) {
            this.offerToSaveInsights();
        }
    }

    displayQuestion(question) {
        // Afficher la question
        document.getElementById('question-text').textContent = question.text;
        
        // Afficher les indices si disponibles
        const hintsEl = document.getElementById('question-hints');
        if (question.hints && question.hints.length > 0) {
            hintsEl.innerHTML = question.hints.map(h => `💡 ${h}`).join('<br>');
            hintsEl.classList.remove('hidden');
        } else {
            hintsEl.classList.add('hidden');
        }
        
        // Ajouter à l'historique de conversation
        this.addToConversation('socratic', question.text, question.type);
        
        // Vider le champ de réponse
        document.getElementById('socratic-answer').value = '';
        document.getElementById('socratic-answer').focus();
    }

    addToConversation(sender, message, type = '') {
        const conversation = document.getElementById('socratic-conversation');
        
        const messageEl = document.createElement('div');
        messageEl.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        
        const bubbleClass = sender === 'user' ? 
            'bg-blue-100 text-blue-900' : 
            'bg-gray-100 text-gray-900';
        
        let icon = '';
        if (sender === 'socratic') {
            switch(type) {
                case 'exploration': icon = '🔍'; break;
                case 'clarification': icon = '💡'; break;
                case 'challenge': icon = '⚡'; break;
                case 'synthesis': icon = '🎯'; break;
                default: icon = '🤔';
            }
        }
        
        messageEl.innerHTML = `
            <div class="${bubbleClass} rounded-lg px-4 py-2 max-w-md">
                ${icon ? `<span class="mr-2">${icon}</span>` : ''}
                <span>${message}</span>
            </div>
        `;
        
        conversation.appendChild(messageEl);
        
        // Scroll vers le bas
        conversation.scrollTop = conversation.scrollHeight;
        
        // Ajouter à l'historique
        this.dialogHistory.push({ sender, message, type, time: new Date() });
    }

    async submitAnswer() {
        const answer = document.getElementById('socratic-answer').value.trim();
        if (!answer) return;
        
        // Afficher la réponse de l'utilisateur
        this.addToConversation('user', answer);
        
        // Désactiver le bouton pendant le traitement
        const submitBtn = document.getElementById('submit-answer');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Analyse...';
        
        try {
            const response = await fetch('/api/process-socratic-answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.currentSession.sessionId,
                    answer: answer
                })
            });

            if (!response.ok) throw new Error('Erreur traitement réponse');

            const data = await response.json();
            
            // Afficher les insights
            if (data.insights && data.insights.length > 0) {
                this.displayInsights(data.insights);
            }
            
            // Afficher les suggestions
            if (data.suggestions && data.suggestions.length > 0) {
                this.displaySuggestions(data.suggestions);
            }
            
            // Mettre à jour la progression
            this.updateProgress(data.progress);
            
            // Vérifier si la session est terminée
            if (data.isComplete) {
                this.completeSession();
            } else {
                // Afficher la prochaine question
                this.displayQuestion(data.question);
            }
            
        } catch (error) {
            console.error('Erreur soumission:', error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: 'Impossible de traiter votre réponse.'
            });
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Répondre';
        }
    }

    skipQuestion() {
        this.submitAnswer('Je préfère passer à la question suivante.');
    }

    displayInsights(insights) {
        const insightEl = document.createElement('div');
        insightEl.className = 'my-2 p-2 bg-yellow-50 border-l-4 border-yellow-400 text-sm';
        insightEl.innerHTML = `
            <div class="font-medium text-yellow-800 mb-1">💡 Insights détectés:</div>
            ${insights.map(i => `<div class="text-yellow-700">• ${i}</div>`).join('')}
        `;
        
        document.getElementById('socratic-conversation').appendChild(insightEl);
    }

    displaySuggestions(suggestions) {
        if (suggestions.length === 0) return;
        
        const suggestionEl = document.createElement('div');
        suggestionEl.className = 'my-2 p-2 bg-green-50 border-l-4 border-green-400 text-sm';
        suggestionEl.innerHTML = `
            <div class="font-medium text-green-800 mb-1">🔗 Connexions suggérées:</div>
            ${suggestions.map((s, idx) => `
                <div class="flex items-center justify-between mb-1">
                    <span class="text-green-700">• ${s.from} → ${s.suggestedRelation || 'lié à'} → ${s.to}</span>
                    <button onclick="window.app.socratic.applySuggestion(${idx})" 
                            class="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-0.5 rounded">
                        Ajouter
                    </button>
                </div>
            `).join('')}
        `;
        
        document.getElementById('socratic-conversation').appendChild(suggestionEl);
        
        // Stocker les suggestions
        window.currentSocraticSuggestions = suggestions;
    }

    applySuggestion(index) {
        const suggestion = window.currentSocraticSuggestions[index];
        if (!suggestion) return;
        
        // Ajouter la connexion à l'éditeur
        this.app.editor.addNote(`    ${suggestion.from} -> ${suggestion.suggestedRelation || 'lié à'} -> ${suggestion.to}`);
        
        // Notification
        this.showNotification('Connexion ajoutée', 'success');
    }

    updateProgress(progress) {
        document.getElementById('progress-questions').textContent = progress.questionsAsked;
        document.getElementById('progress-depth').textContent = progress.currentDepth;
        document.getElementById('progress-insights').textContent = progress.insightsGained;
        document.getElementById('progress-phase').textContent = progress.phase;
        
        // Mettre à jour la barre de progression
        document.getElementById('progress-bar').style.width = `${progress.completionScore}%`;
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // Mettre à jour l'UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        // Si session en cours, informer le serveur du changement
        if (this.currentSession) {
            // Le prochain cycle de questions utilisera le nouveau mode
            this.showNotification(`Mode changé : ${this.getModeLabel(mode)}`, 'info');
        }
    }

    getModeLabel(mode) {
        const labels = {
            'exploration': '🔍 Exploration',
            'clarification': '💡 Clarification',
            'challenge': '⚡ Défi',
            'synthesis': '🎯 Synthèse'
        };
        return labels[mode] || mode;
    }

    async completeSession() {
        // Afficher un message de fin
        const completionEl = document.createElement('div');
        completionEl.className = 'my-4 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200';
        completionEl.innerHTML = `
            <div class="text-lg font-semibold text-indigo-800 mb-2">
                🎉 Session Terminée !
            </div>
            <div class="text-sm text-indigo-700">
                Vous avez exploré le sujet en profondeur. Voulez-vous voir le résumé ?
            </div>
            <button onclick="window.app.socratic.showSummary()" 
                    class="mt-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded text-sm">
                Voir le Résumé
            </button>
        `;
        
        document.getElementById('socratic-conversation').appendChild(completionEl);
    }

    async showSummary() {
        if (!this.currentSession) return;
        
        try {
            const response = await fetch(`/api/socratic-summary?session_id=${this.currentSession.sessionId}`);
            if (!response.ok) throw new Error('Erreur chargement résumé');
            
            const summary = await response.json();
            
            // Créer la modal de résumé
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto">
                    <div class="p-6">
                        <h2 class="text-2xl font-bold mb-4">📊 Résumé de la Session Socratique</h2>
                        
                        <!-- Statistiques -->
                        <div class="grid grid-cols-4 gap-4 mb-6">
                            <div class="bg-blue-50 p-3 rounded">
                                <div class="text-2xl font-bold text-blue-600">${summary.stats.questionsAsked}</div>
                                <div class="text-xs text-gray-600">Questions</div>
                            </div>
                            <div class="bg-green-50 p-3 rounded">
                                <div class="text-2xl font-bold text-green-600">${summary.stats.insightsGained}</div>
                                <div class="text-xs text-gray-600">Insights</div>
                            </div>
                            <div class="bg-purple-50 p-3 rounded">
                                <div class="text-2xl font-bold text-purple-600">${summary.stats.connectionsFound}</div>
                                <div class="text-xs text-gray-600">Connexions</div>
                            </div>
                            <div class="bg-yellow-50 p-3 rounded">
                                <div class="text-2xl font-bold text-yellow-600">${summary.stats.duration}</div>
                                <div class="text-xs text-gray-600">Minutes</div>
                            </div>
                        </div>
                        
                        <!-- Insights clés -->
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold mb-3">💡 Insights Clés</h3>
                            <div class="space-y-2">
                                ${summary.keyInsights.map(insight => `
                                    <div class="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                                        <div class="font-medium">${insight.title}</div>
                                        <div class="text-sm text-gray-700 mt-1">${insight.description}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Connexions découvertes -->
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold mb-3">🔗 Connexions Découvertes</h3>
                            <div class="space-y-2">
                                ${summary.connections.map(conn => `
                                    <div class="flex items-center justify-between bg-green-50 p-2 rounded">
                                        <span class="text-sm">
                                            <strong>${conn.from}</strong> 
                                            <span class="mx-2">→</span>
                                            <em>${conn.relation}</em>
                                            <span class="mx-2">→</span>
                                            <strong>${conn.to}</strong>
                                        </span>
                                        <button onclick="window.app.socratic.addConnectionToGraph('${conn.from}', '${conn.to}', '${conn.relation}')"
                                                class="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">
                                            Ajouter au graphe
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Prochaines étapes suggérées -->
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold mb-3">🚀 Prochaines Étapes Suggérées</h3>
                            <ul class="space-y-1">
                                ${summary.nextSteps.map(step => `
                                    <li class="flex items-start">
                                        <span class="text-green-500 mr-2">✓</span>
                                        <span class="text-sm">${step}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        
                        <!-- Actions -->
                        <div class="flex justify-between mt-6 pt-4 border-t">
                            <div class="flex gap-2">
                                <button onclick="window.app.socratic.exportSummary()" 
                                        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                                    📥 Exporter
                                </button>
                                <button onclick="window.app.socratic.saveAsNote()" 
                                        class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                                    📝 Sauver comme Note
                                </button>
                            </div>
                            <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                    class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Stocker le résumé pour export
            this.currentSummary = summary;
            
        } catch (error) {
            console.error('Erreur résumé:', error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: 'Impossible de charger le résumé de la session.'
            });
        }
    }

    async offerToSaveInsights() {
        const result = await this.app.utils.showModal({
            title: 'Sauvegarder les Insights ?',
            text: 'Voulez-vous sauvegarder les insights de cette session socratique ?',
            confirm: true
        });
        
        if (result) {
            await this.saveAsNote();
        }
    }

    async saveAsNote() {
        if (!this.currentSession || !this.dialogHistory.length) return;
        
        try {
            // Créer une note formatée
            const noteContent = this.formatSessionAsNote();
            
            // Ajouter à l'éditeur
            this.app.editor.addNote(noteContent);
            
            // Notification
            this.showNotification('Session sauvegardée comme note', 'success');
            
        } catch (error) {
            console.error('Erreur sauvegarde note:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        }
    }

    formatSessionAsNote() {
        const now = new Date().toLocaleString();
        let note = `# Session Socratique - ${now}\n\n`;
        note += `## Sujet : ${this.currentSession.topic}\n\n`;
        
        // Ajouter le dialogue
        note += `## Dialogue\n\n`;
        this.dialogHistory.forEach(entry => {
            if (entry.sender === 'socratic') {
                note += `**Q:** ${entry.message}\n\n`;
            } else {
                note += `**R:** ${entry.message}\n\n`;
            }
        });
        
        // Ajouter les insights si disponibles
        if (this.currentSummary) {
            note += `## Insights Clés\n\n`;
            this.currentSummary.keyInsights.forEach(insight => {
                note += `- **${insight.title}:** ${insight.description}\n`;
            });
            
            note += `\n## Connexions Découvertes\n\n`;
            this.currentSummary.connections.forEach(conn => {
                note += `    ${conn.from} -> ${conn.relation} -> ${conn.to}\n`;
            });
        }
        
        return note;
    }

    async exportSummary() {
        if (!this.currentSummary) return;
        
        try {
            const formats = {
                markdown: this.exportAsMarkdown.bind(this),
                json: this.exportAsJSON.bind(this),
                pdf: this.exportAsPDF.bind(this)
            };
            
            const result = await this.app.utils.showModal({
                title: 'Format d\'export',
                text: 'Choisissez le format d\'export :',
                buttons: ['Markdown', 'JSON', 'PDF', 'Annuler']
            });
            
            if (result && result !== 'Annuler') {
                const format = result.toLowerCase();
                if (formats[format]) {
                    await formats[format]();
                }
            }
            
        } catch (error) {
            console.error('Erreur export:', error);
            this.showNotification('Erreur lors de l\'export', 'error');
        }
    }

    exportAsMarkdown() {
        const content = this.formatSessionAsNote();
        this.downloadFile('session-socratique.md', content, 'text/markdown');
    }

    exportAsJSON() {
        const data = {
            session: this.currentSession,
            dialogue: this.dialogHistory,
            summary: this.currentSummary
        };
        
        const content = JSON.stringify(data, null, 2);
        this.downloadFile('session-socratique.json', content, 'application/json');
    }

    async exportAsPDF() {
        // Nécessite une bibliothèque PDF (comme jsPDF)
        // Pour l'instant, on exporte en HTML
        const html = this.generateHTMLReport();
        this.downloadFile('session-socratique.html', html, 'text/html');
    }

    generateHTMLReport() {
        const now = new Date().toLocaleString();
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Session Socratique - ${now}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                h1 { color: #4F46E5; }
                h2 { color: #6B7280; margin-top: 30px; }
                .insight { background: #FEF3C7; padding: 10px; margin: 10px 0; border-left: 4px solid #F59E0B; }
                .connection { background: #D1FAE5; padding: 8px; margin: 5px 0; }
                .question { font-weight: bold; color: #1F2937; }
                .answer { margin-left: 20px; color: #4B5563; }
                .stats { display: flex; gap: 20px; margin: 20px 0; }
                .stat { background: #F3F4F6; padding: 10px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>Session Socratique</h1>
            <p>Date : ${now}</p>
            <p>Sujet : ${this.currentSession?.topic}</p>
            
            <div class="stats">
                <div class="stat">Questions : ${this.currentSummary?.stats.questionsAsked}</div>
                <div class="stat">Insights : ${this.currentSummary?.stats.insightsGained}</div>
                <div class="stat">Durée : ${this.currentSummary?.stats.duration} min</div>
            </div>
            
            <h2>Dialogue</h2>
            ${this.dialogHistory.map(entry => 
                entry.sender === 'socratic' ? 
                `<p class="question">Q: ${entry.message}</p>` :
                `<p class="answer">R: ${entry.message}</p>`
            ).join('')}
            
            <h2>Insights Clés</h2>
            ${this.currentSummary?.keyInsights.map(insight => 
                `<div class="insight"><strong>${insight.title}:</strong> ${insight.description}</div>`
            ).join('') || ''}
            
            <h2>Connexions Découvertes</h2>
            ${this.currentSummary?.connections.map(conn => 
                `<div class="connection">${conn.from} → ${conn.relation} → ${conn.to}</div>`
            ).join('') || ''}
        </body>
        </html>
        `;
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    addConnectionToGraph(from, to, relation) {
        // Ajouter la connexion au graphe
        this.app.graph.addConnection(from, to, relation);
        
        // Ajouter aussi dans l'éditeur
        this.app.editor.addNote(`    ${from} -> ${relation} -> ${to}`);
        
        // Notification
        this.showNotification('Connexion ajoutée au graphe', 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = {
            'success': 'bg-green-500',
            'error': 'bg-red-500',
            'info': 'bg-blue-500',
            'warning': 'bg-yellow-500'
        };
        
        notification.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Méthode pour nettoyer les ressources
    cleanup() {
        // Fermer la session si active
        if (this.isActive) {
            this.closeSocraticDialog();
        }
        
        // Supprimer les éléments DOM
        ['socratic-dialog', 'socratic-progress', 'socratic-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        
        // Réinitialiser l'état
        this.currentSession = null;
        this.dialogHistory = [];
        this.currentSummary = null;
    }
}