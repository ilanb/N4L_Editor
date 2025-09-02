package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"unicode"

	"n4l-editor/models"
)

// InvestigationHandler gère le mode enquête
type InvestigationHandler struct {
	steps map[string]models.InvestigationStep
}

// NewInvestigationHandler crée une nouvelle instance
func NewInvestigationHandler() *InvestigationHandler {
	return &InvestigationHandler{
		steps: initInvestigationSteps(),
	}
}

// HandleInvestigationMode gère les requêtes du mode enquête
func (h *InvestigationHandler) HandleInvestigationMode(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Step        string              `json:"step"`
		GraphData   models.GraphData    `json:"graphData"`
		CurrentData map[string][]string `json:"currentData"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	// Analyser l'état actuel du graphe pour suggestions contextuelles
	contextualSuggestions := h.getContextualSuggestions(request.Step, request.GraphData, request.CurrentData)

	step, exists := h.steps[request.Step]
	if !exists {
		step = h.steps["actors"] // Commencer par le début
	}

	// Ajouter les suggestions contextuelles
	if len(contextualSuggestions) > 0 {
		step.Suggestions = append(contextualSuggestions, step.Suggestions...)
	}

	// Analyser la progression
	progress := h.analyzeProgress(request.GraphData)
	step = h.adjustStepBasedOnProgress(step, progress, request.Step)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(step)
}

func initInvestigationSteps() map[string]models.InvestigationStep {
	return map[string]models.InvestigationStep{
		"actors": {
			Question:    "Qui sont les acteurs principaux de votre enquête ?",
			Suggestions: []string{"Victime", "Suspect", "Témoin", "Enquêteur", "Expert"},
			ActionType:  "subjects",
			NextStep:    "locations",
			Tips:        "Identifiez toutes les personnes impliquées, même indirectement.",
		},
		"locations": {
			Question:    "Quels sont les lieux importants ?",
			Suggestions: []string{"Scène de crime", "Domicile", "Lieu de travail", "Lieu public"},
			ActionType:  "subjects",
			NextStep:    "timeline",
			Tips:        "Notez tous les endroits mentionnés, ils peuvent révéler des connexions.",
		},
		"timeline": {
			Question:    "Quelle est la chronologie des événements ?",
			Suggestions: []string{"avant -> précède -> après", "pendant -> simultané -> pendant", "cause -> entraîne -> conséquence"},
			ActionType:  "relations",
			NextStep:    "motives",
			Tips:        "Établissez l'ordre temporel pour comprendre la séquence causale.",
		},
		"motives": {
			Question:    "Quels sont les mobiles identifiés ?",
			Suggestions: []string{"Argent", "Vengeance", "Jalousie", "Protection", "Secret"},
			ActionType:  "subjects",
			NextStep:    "evidence",
			Tips:        "Un mobile fort peut révéler le coupable.",
		},
		"evidence": {
			Question:    "Quelles preuves sont disponibles ?",
			Suggestions: []string{"Preuve physique", "Témoignage", "Document", "Enregistrement", "Trace numérique"},
			ActionType:  "subjects",
			NextStep:    "connections",
			Tips:        "Cataloguez toutes les preuves, même celles qui semblent insignifiantes.",
		},
		"connections": {
			Question:    "Comment relier les éléments entre eux ?",
			Suggestions: []string{"possède", "a rencontré", "connaît", "travaille avec", "est lié à"},
			ActionType:  "relations",
			NextStep:    "groups",
			Tips:        "Cherchez les patterns et les connexions cachées.",
		},
		"groups": {
			Question:    "Comment regrouper les éléments similaires ?",
			Suggestions: []string{"Suspects => {}", "Preuves => {}", "Lieux visités => {}", "Alibis => {}"},
			ActionType:  "groups",
			NextStep:    "complete",
			Tips:        "Organisez vos découvertes en catégories logiques.",
		},
	}
}

func (h *InvestigationHandler) getContextualSuggestions(step string, graphData models.GraphData, currentData map[string][]string) []string {
	var suggestions []string

	if step == "actors" {
		// Détecter les noms propres dans les données existantes
		for _, notes := range currentData {
			for _, note := range notes {
				words := strings.Fields(note)
				for _, word := range words {
					if len(word) > 2 && unicode.IsUpper(rune(word[0])) {
						if !contains(suggestions, word) {
							suggestions = append(suggestions, word)
						}
					}
				}
			}
		}
	} else if step == "connections" {
		// Suggérer des connexions basées sur les nœuds orphelins
		orphans := h.findOrphanNodes(graphData)
		for _, orphan := range orphans {
			suggestion := "Connecter '" + orphan + "' au graphe"
			suggestions = append(suggestions, suggestion)
		}
	}

	return suggestions
}

func (h *InvestigationHandler) analyzeProgress(graphData models.GraphData) models.InvestigationProgress {
	progress := models.InvestigationProgress{
		RelationsCount: len(graphData.Edges),
	}

	// Compter les types de nœuds
	for _, node := range graphData.Nodes {
		label := strings.ToLower(node.Label)
		if strings.Contains(label, "suspect") || strings.Contains(label, "victime") ||
			strings.Contains(label, "témoin") || unicode.IsUpper(rune(node.Label[0])) {
			progress.ActorsCount++
		}
		if strings.Contains(label, "lieu") || strings.Contains(label, "scène") ||
			strings.Contains(label, "maison") || strings.Contains(label, "bureau") {
			progress.LocationsCount++
		}
		if strings.Contains(label, "preuve") || strings.Contains(label, "indice") ||
			strings.Contains(label, "document") || strings.Contains(label, "trace") {
			progress.EvidenceCount++
		}
	}

	// Compter les nœuds isolés
	connected := make(map[string]bool)
	for _, edge := range graphData.Edges {
		connected[edge.From] = true
		connected[edge.To] = true
	}
	for _, node := range graphData.Nodes {
		if !connected[node.ID] {
			progress.IsolatedNodes++
		}
	}

	return progress
}

func (h *InvestigationHandler) adjustStepBasedOnProgress(step models.InvestigationStep, progress models.InvestigationProgress, currentStep string) models.InvestigationStep {
	if progress.ActorsCount < 2 && currentStep != "actors" {
		step.Tips = "⚠️ Conseil: Ajoutez plus d'acteurs pour enrichir votre enquête. " + step.Tips
	}
	if progress.IsolatedNodes > 3 {
		step.Tips = "⚠️ Attention: Vous avez plusieurs éléments isolés. Pensez à les connecter. " + step.Tips
	}
	return step
}

func (h *InvestigationHandler) findOrphanNodes(graphData models.GraphData) []string {
	connected := make(map[string]bool)
	for _, edge := range graphData.Edges {
		connected[edge.From] = true
		connected[edge.To] = true
	}

	var orphans []string
	for _, node := range graphData.Nodes {
		if !connected[node.ID] {
			orphans = append(orphans, node.ID)
		}
	}
	return orphans
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
