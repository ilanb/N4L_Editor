package handlers

import (
	"encoding/json"
	"fmt"
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

// AnalyzeExpansionCone analyse le cône d'expansion avec l'IA
func (h *GraphHandler) AnalyzeExpansionCone(w http.ResponseWriter, r *http.Request) {
	fmt.Println("DEBUG: AnalyzeExpansionCone appelée")

	var req struct {
		CentralNode string        `json:"centralNode"`
		Nodes       []models.Node `json:"nodes"`
		Links       []models.Edge `json:"links"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("DEBUG: Erreur décodage JSON: %v\n", err)
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	fmt.Printf("DEBUG: Analyse demandée pour nœud: %s, %d nodes, %d links\n",
		req.CentralNode, len(req.Nodes), len(req.Links))

	// Construire le prompt pour l'analyse
	var prompt strings.Builder
	prompt.WriteString("Analyse le cône d'expansion suivant d'un graphe de connaissances.\n\n")
	prompt.WriteString("NŒUD CENTRAL: " + req.CentralNode + "\n\n")

	prompt.WriteString("NŒUDS CONNECTÉS:\n")
	for _, node := range req.Nodes {
		prompt.WriteString("- " + node.ID + "\n")
	}

	prompt.WriteString("\nRELATIONS:\n")
	for _, link := range req.Links {
		prompt.WriteString(fmt.Sprintf("- %s → %s (type: %s)\n", link.From, link.To, link.Type))
	}

	prompt.WriteString("\nFournis une analyse détaillée de ce cône d'expansion en identifiant:\n")
	prompt.WriteString("1. Les patterns et structures principales\n")
	prompt.WriteString("2. Les clusters thématiques\n")
	prompt.WriteString("3. Les nœuds pivots ou points de convergence\n")
	prompt.WriteString("4. Les chemins de connaissance significatifs\n")
	prompt.WriteString("5. Les insights sur l'organisation de l'information\n")
	prompt.WriteString("6. Les recommandations pour l'exploration future\n")
	prompt.WriteString("\nFormat ta réponse en markdown avec des sections claires.")

	fmt.Println("DEBUG: Appel à Ollama...")

	// Appeler Ollama pour l'analyse
	analysis, err := h.ollamaService.Generate(prompt.String(), "")
	if err != nil {
		fmt.Printf("DEBUG: Erreur Ollama: %v\n", err)
		http.Error(w, fmt.Sprintf("Erreur lors de l'analyse: %v", err), http.StatusInternalServerError)
		return
	}

	fmt.Printf("DEBUG: Analyse reçue, longueur: %d caractères\n", len(analysis))

	// Retourner l'analyse
	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{
		"analysis": analysis,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		fmt.Printf("DEBUG: Erreur encodage réponse: %v\n", err)
	}

	fmt.Println("DEBUG: Réponse envoyée avec succès")
}
