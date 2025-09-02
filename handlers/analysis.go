package handlers

import (
	"encoding/json"
	"net/http"

	"n4l-editor/models"
	"n4l-editor/services"
)

// AnalysisHandler gère les requêtes d'analyse
type AnalysisHandler struct {
	analyzer      *services.GraphAnalyzer
	ollamaService *services.OllamaService
}

// NewAnalysisHandler crée une nouvelle instance
func NewAnalysisHandler(ollamaService *services.OllamaService) *AnalysisHandler {
	return &AnalysisHandler{
		analyzer:      services.NewGraphAnalyzer(),
		ollamaService: ollamaService,
	}
}

// AnalyzeGraph analyse le graphe avec l'IA
func (h *AnalysisHandler) AnalyzeGraph(w http.ResponseWriter, r *http.Request) {
	var graphData models.GraphData
	if err := json.NewDecoder(r.Body).Decode(&graphData); err != nil {
		http.Error(w, "Données de graphe invalides", http.StatusBadRequest)
		return
	}

	analysis, err := h.ollamaService.AnalyzeGraph(graphData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(analysis))
}

// DetectTemporalPatterns détecte les patterns temporels
func (h *AnalysisHandler) DetectTemporalPatterns(w http.ResponseWriter, r *http.Request) {
	var n4lNotes map[string][]string
	if err := json.NewDecoder(r.Body).Decode(&n4lNotes); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	patterns := h.analyzer.DetectTemporalPatterns(n4lNotes)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(patterns)
}

// CheckConsistency vérifie la cohérence sémantique
func (h *AnalysisHandler) CheckConsistency(w http.ResponseWriter, r *http.Request) {
	var graphData models.GraphData
	if err := json.NewDecoder(r.Body).Decode(&graphData); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	inconsistencies := h.analyzer.CheckSemanticConsistency(graphData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(inconsistencies)
}

// GenerateQuestions génère des questions d'investigation
func (h *AnalysisHandler) GenerateQuestions(w http.ResponseWriter, r *http.Request) {
	var graphData models.GraphData
	if err := json.NewDecoder(r.Body).Decode(&graphData); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	questions := h.analyzer.GenerateInvestigationQuestions(graphData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(questions)
}
