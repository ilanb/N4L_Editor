package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"n4l-editor/models"
	"n4l-editor/services"
)

// Définition des structures pour la requête et la réponse
type ExpansionConeRequest struct {
	NodeID    string           `json:"nodeId"`
	Depth     int              `json:"depth"`
	GraphData models.GraphData `json:"graphData"`
}

type ExpansionConeResponse struct {
	NodeIDs []string      `json:"nodeIds"`
	Edges   []models.Edge `json:"edges"`
}

type FindClustersRequest struct {
	Terms     []string         `json:"terms"`
	GraphData models.GraphData `json:"graphData"`
}

type FindClustersResponse struct {
	Clusters map[string][]string `json:"clusters"`
	Paths    [][]string          `json:"paths"`
}

// GraphHandler gère les requêtes liées au graphe
type GraphHandler struct {
	parser        *services.N4LParser
	analyzer      *services.GraphAnalyzer
	ollamaService *services.OllamaService
}

type AnalyzeClustersRequest struct {
	Clusters  map[string][]string `json:"clusters"`
	GraphData models.GraphData    `json:"graphData"`
}

// NewGraphHandler crée une nouvelle instance
func NewGraphHandler(ollamaService *services.OllamaService) *GraphHandler {
	return &GraphHandler{
		parser:        services.NewN4LParser(),
		analyzer:      services.NewGraphAnalyzer(),
		ollamaService: ollamaService,
	}
}

// GetGraphData convertit les notes N4L en données de graphe
func (h *GraphHandler) GetGraphData(w http.ResponseWriter, r *http.Request) {
	var n4lNotes map[string][]string
	if err := json.NewDecoder(r.Body).Decode(&n4lNotes); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	graphData := h.parser.ParseN4LToGraph(n4lNotes)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(graphData)
}

// GetExpansionCone gère la requête pour le cône d'expansion
func (h *GraphHandler) GetExpansionCone(w http.ResponseWriter, r *http.Request) {
	var req ExpansionConeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données invalides: "+err.Error(), http.StatusBadRequest)
		return
	}

	nodeIDs, coneEdges := h.analyzer.GetExpansionCone(req.NodeID, req.Depth, req.GraphData)

	nodeIDSlice := make([]string, 0, len(nodeIDs))
	for id := range nodeIDs {
		nodeIDSlice = append(nodeIDSlice, id)
	}

	resp := ExpansionConeResponse{
		NodeIDs: nodeIDSlice,
		Edges:   coneEdges,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// FindClusters gère la recherche de clusters et de chemins
func (h *GraphHandler) FindClusters(w http.ResponseWriter, r *http.Request) {
	var req FindClustersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données de requête invalides", http.StatusBadRequest)
		return
	}

	// Nettoyer les termes de recherche
	var cleanTerms []string
	for _, term := range req.Terms {
		if t := strings.TrimSpace(term); t != "" {
			cleanTerms = append(cleanTerms, t)
		}
	}

	if len(cleanTerms) == 0 {
		http.Error(w, "Aucun terme de recherche fourni", http.StatusBadRequest)
		return
	}

	clusters, paths := h.analyzer.FindClustersAndPaths(cleanTerms, req.GraphData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(FindClustersResponse{
		Clusters: clusters,
		Paths:    paths,
	})
}

// FindAllPaths trouve tous les chemins dans le graphe
func (h *GraphHandler) FindAllPaths(w http.ResponseWriter, r *http.Request) {
	var notes map[string][]string
	if err := json.NewDecoder(r.Body).Decode(&notes); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	paths := h.analyzer.FindAllPaths(notes)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(paths)
}

// GetLayeredGraph retourne le graphe organisé en couches
func (h *GraphHandler) GetLayeredGraph(w http.ResponseWriter, r *http.Request) {
	var graphData models.GraphData
	if err := json.NewDecoder(r.Body).Decode(&graphData); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	layeredGraph := h.analyzer.GetLayeredGraph(graphData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(layeredGraph)
}

// AnalyzePath analyse un chemin spécifique
func (h *GraphHandler) AnalyzePath(w http.ResponseWriter, r *http.Request) {
	var req models.AnalyzePathRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données de chemin invalides", http.StatusBadRequest)
		return
	}

	analysis, err := h.ollamaService.AnalyzePath(req.Path, req.Notes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(analysis))
}

// AnalyzeClusters handles the request to analyze clusters with AI
func (h *GraphHandler) AnalyzeClusters(w http.ResponseWriter, r *http.Request) {
	var req AnalyzeClustersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données de requête invalides: "+err.Error(), http.StatusBadRequest)
		return
	}

	if len(req.Clusters) == 0 {
		http.Error(w, "Aucun cluster à analyser", http.StatusBadRequest)
		return
	}

	analysis, err := h.ollamaService.AnalyzeClusters(req.Clusters, req.GraphData)
	if err != nil {
		http.Error(w, "Erreur lors de l'analyse par l'IA: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(analysis))
}
