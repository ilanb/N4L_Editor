// Module de gestion de l'éditeur N4L

export class EditorManager {
    constructor(app) {
        this.app = app;
        this.n4lEditor = null;
        this.isUpdatingFromSync = false;
        this.syncTimeout = null;
    }

    init() {
        // Initialiser CodeMirror
        this.n4lEditor = CodeMirror.fromTextArea(document.getElementById('n4l-editor'), {
            lineNumbers: true,
            mode: 'markdown',
            theme: 'material-darker'
        });

        // Écouteur pour la synchronisation
        this.n4lEditor.on('change', () => {
            if (this.isUpdatingFromSync) return;
            
            clearTimeout(this.syncTimeout);
            this.syncTimeout = setTimeout(() => {
                this.syncToState(this.n4lEditor.getValue());
            }, 750); // Debounce de 750ms
        });
    }

    updateContent(content) {
        this.isUpdatingFromSync = true;
        const scrollInfo = this.n4lEditor.getScrollInfo();
        this.n4lEditor.setValue(content);
        this.n4lEditor.scrollTo(scrollInfo.left, scrollInfo.top);
        setTimeout(() => this.isUpdatingFromSync = false, 50);
    }

    getValue() {
        return this.n4lEditor.getValue();
    }

    refresh() {
        if (this.n4lEditor) {
            this.n4lEditor.refresh();
        }
    }

    async syncToState(n4lContent) {
        console.log("LOG: Syncing editor content to application state...");
        try {
            const response = await fetch('/api/parse-n4l', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: n4lContent
            });
            
            if (!response.ok) throw new Error(await response.text());
            
            const data = await response.json();
            
            // Mettre à jour l'état de l'application
            this.app.state.subjects = data.subjects || [];
            this.app.state.n4lNotes = data.notes || {};
            
            // Rafraîchir les autres vues
            this.app.renderSubjects();
            await this.app.graph.update();
            this.updateContextFilter();
            this.renderContextsPanel();

        } catch (error) {
            console.error("Erreur de synchronisation:", error);
        }
    }

    renderStateToEditor() {
        let output = '';
        const sortedContexts = Object.keys(this.app.state.n4lNotes).sort();
        
        sortedContexts.forEach(context => {
            if (this.app.state.n4lNotes[context] && this.app.state.n4lNotes[context].length > 0) {
                if (context !== 'general' || 
                    (sortedContexts.length > 1 && 
                     this.app.state.n4lNotes[context].some(n => 
                        n.includes('->') || n.includes('<->') || n.includes('=>')))) {
                    output += `:: ${context} ::\n\n`;
                }
                this.app.state.n4lNotes[context].forEach(note => {
                    output += `    ${note}\n`;
                });
                output += '\n';
            }
        });
        
        this.updateContent(output || '# Votre fichier N4L apparaîtra ici...');
    }

    addNote(note) {
        const currentContent = this.n4lEditor.getValue();
        let newContent = currentContent.trimEnd();
        const currentContext = this.app.state.currentContext;

        // S'assurer qu'il y a un contexte
        if (!newContent.includes(`:: ${currentContext} ::`)) {
            newContent += `\n\n:: ${currentContext} ::\n`;
        }

        // Trouver la position du contexte actuel
        const contextRegex = new RegExp(`(:: ${currentContext} ::)`);
        const contextMatch = contextRegex.exec(newContent);
        
        if (contextMatch) {
            // Trouver la fin de la section du contexte actuel
            const afterContext = newContent.substring(contextMatch.index + contextMatch[0].length);
            const nextContextMatch = afterContext.match(/\n::[^:]+::/);
            
            let insertPosition;
            if (nextContextMatch) {
                // Il y a un autre contexte après, insérer avant
                insertPosition = contextMatch.index + contextMatch[0].length + nextContextMatch.index;
            } else {
                // C'est le dernier contexte, insérer à la fin
                insertPosition = newContent.length;
            }
            
            // Insérer la note
            const beforeInsert = newContent.substring(0, insertPosition);
            const afterInsert = newContent.substring(insertPosition);
            newContent = beforeInsert + `\n${note}` + afterInsert;
        } else {
            // Le contexte n'existe pas encore, l'ajouter
            newContent += `\n\n:: ${currentContext} ::\n\n${note}`;
        }

        this.updateContent(newContent + '\n');
    }

    updateContextFilter() {
        const contexts = new Set(Object.keys(this.app.state.n4lNotes));
        const contextFilter = document.getElementById('context-filter');
        
        if (contextFilter) {
            contextFilter.innerHTML = '<option value="">Tous les contextes</option>';
            contexts.forEach(c => {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c;
                contextFilter.appendChild(option);
            });
        }
    }

    renderContextsPanel() {
        const panel = document.getElementById('contexts-panel');
        if (!panel) return;
        
        panel.innerHTML = '';
        const contexts = ['Tous', ...Object.keys(this.app.state.n4lNotes)];

        contexts.forEach(context => {
            if (context === 'general' && contexts.length > 2 && 
                this.app.state.n4lNotes[context]?.length === 0) return;

            const btn = document.createElement('button');
            const isAll = context === 'Tous';
            const contextFilter = document.getElementById('context-filter');
            const isActive = isAll ? 
                (contextFilter && contextFilter.value === '') : 
                (contextFilter && contextFilter.value === context);

            btn.textContent = context;
            btn.className = `px-3 py-1 text-xs rounded-full border transition-colors ${
                isActive ? 
                'bg-indigo-600 text-white border-indigo-600' : 
                'bg-white hover:bg-indigo-50 text-gray-700'
            }`;
            btn.dataset.context = isAll ? '' : context;
            
            btn.onclick = () => {
                const newContext = isAll ? '' : context;
                // Mettre à jour le filtre du graphe
                this.app.graph.filterByContext(newContext);
                // Mettre à jour le contexte actuel
                this.app.state.currentContext = isAll ? 'general' : context;
                document.getElementById('context-input').value = this.app.state.currentContext;
                // Faire défiler l'éditeur jusqu'au contexte
                if (!isAll) {
                    this.scrollToContext(context);
                }
            };
            
            panel.appendChild(btn);
        });
    }

    /**
     * Fait défiler l'éditeur jusqu'à un contexte spécifique.
     * @param {string} contextName - Le nom du contexte à rechercher.
     */
    scrollToContext(contextName) {
        // Crée une expression régulière pour trouver ":: contexte ::" ou "::: contexte :::"
        // en début de ligne, insensible aux espaces.
        const query = new RegExp(`^:::\\s*${contextName}\\s*:::$|^::\\s*${contextName}\\s*::`);
        const doc = this.n4lEditor.getDoc();

        // Parcourt chaque ligne du document pour trouver une correspondance
        for (let i = 0; i < doc.lineCount(); i++) {
            const line = doc.getLine(i);
            if (query.test(line.trim())) {
                // Positionne le curseur au début de la ligne trouvée
                this.n4lEditor.setCursor({ line: i, ch: 0 });
                // Fait défiler la vue pour que la ligne soit visible
                this.n4lEditor.scrollIntoView({ line: i, ch: 0 }, 100); // Marge de 100px
                this.n4lEditor.focus();
                return; // Arrête la recherche après avoir trouvé la première correspondance
            }
        }
    }
}