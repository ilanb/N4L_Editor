// Module de gestion du mode investigation

export class InvestigationManager {
    constructor(app) {
        this.app = app;
        this.investigationMode = false;
        this.currentInvestigationStep = 'actors';
        this.investigationSteps = ['actors', 'locations', 'timeline', 'motives', 'evidence', 'connections', 'groups'];
        this.investigationQuestions = [];
        this.currentQuestionIndex = 0;
    }

    init() {
        // Attacher l'événement de fermeture
        const closeBtn = document.getElementById('close-investigation');
        if (closeBtn) {
            closeBtn.onclick = () => this.exitMode();
        }
    }

    toggleMode() {
        if (this.investigationMode) {
            this.exitMode();
        } else {
            this.enterMode();
        }
    }

    async enterMode() {
        console.log("LOG: Entering dynamic investigation mode");
        this.investigationMode = true;
        
        const btn = document.getElementById('action-investigation');
        btn.innerHTML = '<div class="spinner"></div> Génération...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.app.state.allGraphData)
            });
            
            if (!response.ok) throw new Error(await response.text());
            
            this.investigationQuestions = await response.json();
            window.investigationQuestions = this.investigationQuestions;
            this.currentQuestionIndex = 0;

            document.getElementById('investigation-panel').classList.remove('hidden');
            btn.classList.add('bg-green-600');
            btn.innerHTML = `Mode Enquête Actif`;

            if (this.investigationQuestions.length > 0) {
                this.displayNextQuestion();
            } else {
                document.getElementById('investigation-content').innerHTML = `
                    <div class="p-4 text-center">
                        <h4 class="font-semibold text-green-700">✅ Enquête Complète !</h4>
                        <p class="text-sm text-gray-600 mt-2">Votre graphe semble bien connecté. Aucune question évidente n'a été détectée.</p>
                    </div>`;
            }
        } catch (error) {
            console.error("Erreur Mode Enquête:", error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: `Impossible de démarrer le Mode Enquête : ${error.message}`
            });
            this.exitMode();
        } finally {
            btn.disabled = false;
        }
    }

    exitMode() {
        console.log("LOG: Exiting investigation mode");
        this.investigationMode = false;
        document.getElementById('investigation-panel').classList.add('hidden');
        
        const btn = document.getElementById('action-investigation');
        btn.classList.remove('bg-green-600');
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h2a1 1 0 100-2 2 2 0 00-2 2v11a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H6z" clip-rule="evenodd" />
            </svg>
            Mode Enquête Guidée
        `;
        document.getElementById('help-panel').innerHTML = 'Mode Enquête terminé.';
    }

    displayNextQuestion() {
        const container = document.getElementById('investigation-content');
        
        if (this.currentQuestionIndex >= this.investigationQuestions.length) {
            container.innerHTML = `
                <div class="p-4 text-center">
                    <h4 class="font-semibold text-green-700">🎉 Assistant Terminé !</h4>
                    <p class="text-sm text-gray-600 mt-2">Vous avez traité toutes les suggestions.</p>
                </div>`;
            setTimeout(() => this.exitMode(), 4000);
            return;
        }

        const q = this.investigationQuestions[this.currentQuestionIndex];
        container.innerHTML = `
            <div class="mb-2 text-sm text-gray-500">
                Suggestion ${this.currentQuestionIndex + 1} / ${this.investigationQuestions.length}
            </div>
            <div class="p-3 bg-indigo-50 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-2">${q.question}</h4>
                ${q.hint ? `<p class="text-xs text-gray-600 italic mb-2">💡 ${q.hint}</p>` : ''}
                <div class="flex flex-wrap gap-1 mb-3">
                    ${q.nodes.map(node => `
                        <span class="bg-white px-2 py-1 rounded text-xs border cursor-pointer hover:bg-gray-100" 
                              onclick="window.app.graph.highlightNodes(['${node}'])">${node}</span>
                    `).join('')}
                </div>
                <div class="flex gap-2 mt-2">
                    <button class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm" 
                            onclick="window.app.investigation.investigateQuestion(${this.currentQuestionIndex})">
                        Investiguer
                    </button>
                    <button class="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-sm" 
                            onclick="window.app.investigation.nextQuestion()">
                        Ignorer
                    </button>
                </div>
            </div>`;
    }

    async investigateQuestion(index = null) {
        const question = index !== null ? 
            this.investigationQuestions[index] : 
            this.investigationQuestions[this.currentQuestionIndex];
        
        console.log("LOG: Investigating question:", question);
        
        if (question.nodes && question.nodes.length > 0) {
            this.app.graph.highlightNodes(question.nodes);
        }
        
        switch(question.type) {
            case 'orphan':
                document.getElementById('help-panel').innerHTML = 
                    `<b>Connectez "${question.nodes[0]}" :</b> Faites glisser cet élément sur un autre pour créer une relation.`;
                break;
                
            case 'missing_link':
                document.getElementById('help-panel').innerHTML = 
                    `<b>Investigation:</b> ${question.question}`;
                if (question.nodes.length >= 2) {
                    await this.initiateRelationshipForNodes(question.nodes[0], question.nodes[1]);
                }
                break;
                
            default:
                console.log("LOG: Unknown question type:", question.type);
                document.getElementById('help-panel').innerHTML = 
                    `<b>Question:</b> ${question.question}`;
        }
        
        this.nextQuestion();
    }

    skipQuestion(question) {
        console.log("LOG: Skipping question:", question.question);
        document.getElementById('help-panel').innerHTML = 
            `Suggestion ignorée : ${question.question}`;
        this.nextQuestion();
    }

    nextQuestion() {
        this.currentQuestionIndex++;
        this.displayNextQuestion();
    }

    async initiateRelationshipForNodes(node1, node2) {
        // Trouver les indices des nœuds dans les listes
        const sourceNode = this.findNodeInLists(node1);
        const destNode = this.findNodeInLists(node2);
        
        if (sourceNode && destNode && sourceNode.index !== -1 && destNode.index !== -1) {
            await this.app.initiateRelationship(sourceNode, destNode);
        }
    }

    findNodeInLists(nodeName) {
        // Chercher dans les sujets
        const subjectIndex = this.app.state.subjects.indexOf(nodeName);
        if (subjectIndex !== -1) {
            return { type: 'subject', index: subjectIndex };
        }
        
        // Chercher dans les concepts
        const conceptIndex = this.app.state.concepts.findIndex(c => c.includes(nodeName));
        if (conceptIndex !== -1) {
            return { type: 'concept', index: conceptIndex };
        }
        
        return null;
    }

    async getContextualSuggestions() {
        if (!this.investigationMode) return;
        
        // Analyser le contexte actuel et suggérer des actions
        const orphans = this.app.state.allGraphData.nodes.filter(n => {
            const hasEdge = this.app.state.allGraphData.edges.some(e => 
                e.from === n.id || e.to === n.id
            );
            return !hasEdge;
        });
        
        if (orphans.length > 0) {
            const suggestion = `Connectez "${orphans[0].label}" aux autres éléments`;
            document.getElementById('help-panel').innerHTML = `💡 Suggestion: ${suggestion}`;
        }
    }

    async handleInvestigationStep(step) {
        const request = {
            step: step,
            graphData: this.app.state.allGraphData,
            currentData: this.app.state.n4lNotes
        };

        try {
            const response = await fetch('/api/investigation-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });
            
            if (!response.ok) throw new Error(await response.text());
            
            const stepData = await response.json();
            this.displayInvestigationStep(stepData);
            
        } catch (error) {
            console.error("Erreur étape investigation:", error);
            await this.app.utils.showModal({
                title: 'Erreur',
                text: `Erreur lors de l'étape d'investigation: ${error.message}`
            });
        }
    }

    displayInvestigationStep(stepData) {
        const container = document.getElementById('investigation-content');
        
        let html = `
            <div class="mb-3">
                <h4 class="font-semibold text-gray-800 mb-2">${stepData.question}</h4>
                ${stepData.tips ? `<p class="text-xs text-gray-600 italic mb-2">💡 ${stepData.tips}</p>` : ''}
            </div>
        `;
        
        if (stepData.suggestions && stepData.suggestions.length > 0) {
            html += '<div class="space-y-2 mb-3">';
            stepData.suggestions.forEach(suggestion => {
                html += `
                    <button class="w-full text-left bg-gray-100 hover:bg-gray-200 p-2 rounded text-sm" 
                            onclick="window.app.investigation.applySuggestion('${suggestion}', '${stepData.actionType}')">
                        ${suggestion}
                    </button>
                `;
            });
            html += '</div>';
        }
        
        if (stepData.nextStep) {
            html += `
                <button class="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded text-sm" 
                        onclick="window.app.investigation.handleInvestigationStep('${stepData.nextStep}')">
                    Suivant →
                </button>
            `;
        }
        
        container.innerHTML = html;
    }

    applySuggestion(suggestion, actionType) {
        console.log("LOG: Applying suggestion:", suggestion, "Type:", actionType);
        
        switch(actionType) {
            case 'subjects':
                // Ajouter comme nouveau sujet
                this.app.editor.addNote(`    ${suggestion}`);
                document.getElementById('help-panel').innerHTML = 
                    `<span class="text-green-600">✔ "${suggestion}" ajouté aux sujets</span>`;
                break;
                
            case 'relations':
                // Parser et créer une relation
                const relationMatch = suggestion.match(/(.+) -> (.+) -> (.+)/);
                if (relationMatch) {
                    this.app.editor.addNote(`    ${suggestion}`);
                    document.getElementById('help-panel').innerHTML = 
                        `<span class="text-green-600">✔ Relation créée</span>`;
                }
                break;
                
            case 'groups':
                // Créer un groupe
                this.app.editor.addNote(`    ${suggestion}`);
                document.getElementById('help-panel').innerHTML = 
                    `<span class="text-green-600">✔ Groupe créé</span>`;
                break;
        }
    }
}

// Rendre les fonctions accessibles globalement pour les événements onclick inline
window.investigateQuestion = function(question) {
    if (window.app && window.app.investigation) {
        window.app.investigation.investigateQuestion(question);
    }
};

window.skipQuestion = function(question) {
    if (window.app && window.app.investigation) {
        window.app.investigation.skipQuestion(question);
    }
};