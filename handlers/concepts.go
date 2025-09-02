package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"n4l-editor/services"
	"n4l-editor/utils"
)

// ConceptsHandler gère les requêtes liées aux concepts
type ConceptsHandler struct {
	ollamaService *services.OllamaService
	parser        *services.N4LParser
}

// NewConceptsHandler crée une nouvelle instance
func NewConceptsHandler(ollamaService *services.OllamaService) *ConceptsHandler {
	return &ConceptsHandler{
		ollamaService: ollamaService,
		parser:        services.NewN4LParser(),
	}
}

// ExtractConcepts extrait les concepts d'un fichier texte
func (h *ConceptsHandler) ExtractConcepts(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}

	file, _, err := r.FormFile("textFile")
	if err != nil {
		http.Error(w, "Erreur lors de la lecture du fichier", http.StatusBadRequest)
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Erreur lors de la lecture du contenu du fichier", http.StatusInternalServerError)
		return
	}

	concepts := utils.ExtractSentences(string(content))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(concepts)
}

// AutoExtractSubjects utilise l'IA pour extraire automatiquement les sujets
func (h *ConceptsHandler) AutoExtractSubjects(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Impossible de lire le corps de la requête", http.StatusInternalServerError)
		return
	}
	defer r.Body.Close()

	subjects, err := h.ollamaService.ExtractSubjectsWithAI(string(body))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subjects)
}

// ParseN4L parse un fichier N4L
func (h *ConceptsHandler) ParseN4L(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Erreur de lecture du corps de la requête", http.StatusInternalServerError)
		return
	}

	parsedData := h.parser.ParseN4L(string(body))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(parsedData)
}

// GenerateN4LFromText utilise l'IA pour convertir un texte brut en format N4L.
func (h *ConceptsHandler) GenerateN4LFromText(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("textFile")
	if err != nil {
		http.Error(w, "Erreur lors de la lecture du fichier", http.StatusBadRequest)
		return
	}
	defer file.Close()

	textContent, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Impossible de lire le contenu du fichier", http.StatusInternalServerError)
		return
	}

	prompt := buildN4LParsingPrompt(string(textContent))

	// CORRECTION : Passer une chaîne vide "" pour le format, car nous voulons du texte brut.
	// Le modèle utilisé sera celui par défaut défini dans ollama.go ("gpt-oss:20b").
	generatedN4L, err := h.ollamaService.Generate(prompt, "")
	if err != nil {
		http.Error(w, fmt.Sprintf("Erreur du service IA: %v", err), http.StatusInternalServerError)
		return
	}

	// Nettoyer la sortie de l'IA pour enlever les blocs de code markdown
	cleanedN4L := strings.TrimPrefix(generatedN4L, "```n4l")
	cleanedN4L = strings.TrimSuffix(cleanedN4L, "```")
	cleanedN4L = strings.TrimSpace(cleanedN4L)

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(cleanedN4L))
}

func buildN4LParsingPrompt(text string) string {
	return fmt.Sprintf(`
Tu es un expert en analyse de renseignements et en structuration de données N4L (Notes for Loading). Ta mission est de convertir le texte brut suivant en un fichier N4L richement structuré et densément interconnecté.

**PHILOSOPHIE N4L :**
N4L est un langage de prise de notes conçu pour créer des graphes de connaissances. L'objectif est de transformer des informations linéaires en un réseau de relations sémantiques explorable et analysable.

**SYNTAXES ET RÈGLES DU LANGAGE N4L :**

# 1. STRUCTURE HIÉRARCHIQUE

## Titres et métadonnées
- Commence par un titre descriptif : '- titre du document'
- Ajoute des métadonnées en en-tête avec '#' pour les commentaires
- Exemple :
  '''
  - Affaire Victor Moreau
  # Fichier créé le 30/08/2025
  # Dernière mise à jour: 01/09/2025
  '''

## Contextes et sections
- Contexte principal : ':: Nom du Contexte ::'
- Sous-contexte : '::: Nom du Sous-Contexte :::'
- Contextes multiples pour le même bloc : ':: contexte1 | contexte2 | contexte3 ::'
- Les contextes organisent l'information comme des chapitres thématiques

# 2. SYNTAXES DE RELATIONS

## Relations simples (parenthèses)
'Sujet (relation) Objet'
Exemples :
- 'Victor Moreau (âge) 67 ans'
- 'Jean (suspect de) meurtre'
- 'hypothalamus (role) key nexus between body and brain'

## Relations directionnelles (flèches)
'Sujet -> type_relation -> Objet'
Exemples :
- 'Jean -> doit de l'argent à -> Casino'
- 'Victor -> a modifié -> testament'
- 'Start (next) Find Door (next) Open Door'

## Équivalences et synonymes
- Équivalence simple : 'A <-> B'
- Équivalence avec (=) : 'A (=) B'
- Synonyme/alias : 'A (same as) B' ou 'A (alias) B'
- Négation : 'A (!eq) B' pour bloquer une équivalence

## Groupements
'Parent => { Enfant1; Enfant2; Enfant3 }'
Exemples :
- 'Suspects => { Jean; Elodie; Madame Chen }'
- 'alpha waves (freq) 5-15 Hz'
- 'Indices => { Tasse; Livre; Boue }'

# 3. CONTINUITÉ ET RÉFÉRENCES

## Guillemets pour continuation
Utilise '"' en début de ligne pour continuer le sujet précédent :
'''
Victor Moreau (âge) 67 ans
    "         (profession) Antiquaire renommé
    "         (domicile) Manoir rue de Varenne
    "         (fortune) 12 millions d'euros
'''

## Variables et références
- Définir une variable : '@nom variable_content'
- Référencer : '$nom.1' (première occurrence)
- Référence au précédent : '$PREV.1' (élément précédent)
- Exemples :
  '@goal "améliorer l'enquête"'
  'N4L (used for) $goal.1'

## Annotations spéciales
- Concepts importants : '>"concept"'
- Symboles personnalisés : '%terme' pour marquer l'importance
- Exemples :
  '>"inverse path tracing problem"'
  '%reasoning goes back to 350 BC'

# 4. MÉTADONNÉES ET ANNOTATIONS

## Types d'annotations
- '(note)' : Remarque explicative
- '(e.g.)' ou '(ex)' : Exemple
- '(i.e.)' : C'est-à-dire
- '(cf)' : Comparer avec
- '(url)' : Lien web
- '(img)' : Image
- '(NB)' : Nota bene
- '(remark)' : Observation
- '(prop)' : Propriété
- '(def)' ou '(defined)' : Définition

Exemples :
'''
place cells (role) spacetime encoding
    "       (note) critical for navigation
    "       (url) "https://example.com/research"
'''

# 5. CHRONOLOGIE ET TEMPORALITÉ

## Timeline structurée
Encadre les événements temporels :
'''
+:: _timeline_ ::

27/08/2025 14h00 -> Jean visite Victor -> Discussion houleuse
27/08/2025 14h30 -> Jean quitte manoir -> Claque la porte
29/08/2025 20h30 -> Heure estimée décès -> Selon médecin légiste

-:: _timeline_ ::
'''

## Séquences d'actions
Pour les processus ordonnés :
'''
+:: _sequence_ ::

étape 1 (then) étape 2 (then) étape 3
étape 3 (leads to) résultat final

-:: _sequence_ ::
'''

# 6. PATTERNS AVANCÉS

## Structures conditionnelles
- 'A (if condition) B'
- 'A (next if yes) B'
- 'A (next if no) C'

## Relations multiples sur une ligne
'source, target (relation commune) destination'

## Négations et exclusions
- 'A (cannot) B'
- 'A (can't be similar to) B'
- 'A (!contains) B'

## Relations complexes avec contexte
'A (relation dans contexte X) B'
Exemple : 'Jean (alibi pour 19h-22h) Cinéma UGC'

# 7. ORGANISATION RECOMMANDÉE

Structure suggérée pour une enquête :
1. :: Métadonnées ::
2. :: Personnages :: avec ::: Victime :::, ::: Suspects :::, ::: Témoins :::
3. :: Lieux :: avec descriptions détaillées
4. :: Chronologie :: avec timeline
5. :: Preuves :: avec ::: Physiques :::, ::: Documentaires :::, ::: Numériques :::
6. :: Relations :: liens entre entités
7. :: Hypothèses :: théories et analyses
8. :: Patterns :: motifs récurrents
9. :: Actions :: prochaines étapes

# 8. BONNES PRATIQUES

- Densifie les relations : chaque entité importante devrait avoir 3-5 propriétés minimum
- Crée des connexions croisées entre contextes différents
- Utilise des relations bidirectionnelles quand pertinent
- Ajoute des métadonnées temporelles quand disponibles
- Inclus des notes explicatives avec (note) pour clarifier les ambiguïtés
- Groupe les éléments similaires pour faciliter l'analyse
- Utilise les contextes imbriqués pour organiser hiérarchiquement

**EXEMPLES DE PATTERNS RICHES :**

'''
:: Personnage complexe ::

Jean Moreau (âge) 35 ans
    "       (profession) Sans emploi fixe
    "       (relation) Neveu de Victor Moreau
    "       (mobile) Héritage de 8 millions
    "       (historique) Dettes de jeu importantes
    "       (alibi déclaré) Cinéma UGC Bercy 19h-22h
    "       (dernière visite) 27/08/2025
    "       (tension avec) Victor depuis 2023
    "       (véhicule) BMW série 3 noire AB-123-CD

Jean -> doit -> 150.000€ -> Casino Deauville
Jean -> fréquente -> Bar Le Diplomate
Jean -> a appelé -> Victor (à 18h45 le 29/08)
'''

**TA MISSION :**

Analyse le texte et produis un fichier N4L qui :
1. Extrait TOUTES les entités (personnes, lieux, objets, concepts)
2. Identifie TOUTES leurs propriétés et attributs
3. Établit des relations riches et multiples entre entités
4. Organise chronologiquement les événements
5. Structure l'information en contextes logiques et imbriqués
6. Ajoute des métadonnées et annotations pertinentes
7. Crée des groupements pour les éléments similaires
8. Utilise les syntaxes avancées quand approprié

Le graphe résultant doit être dense, interconnecté et faciliter l'exploration des données.

**TEXTE À ANALYSER :**
---
%s
---

**RÉPONSE ATTENDUE :**
Produis uniquement le contenu du fichier N4L complet, commençant par le titre et les métadonnées. N'ajoute aucune explication externe.
`, text)
}
