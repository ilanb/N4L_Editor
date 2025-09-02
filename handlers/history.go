package handlers

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"n4l-editor/models"
	"n4l-editor/services"
)

const historyFilePath = "versions_history.json"

// HistoryHandler gère l'historique et le versioning sémantique
type HistoryHandler struct {
	versions      []models.SemanticVersion
	analyzer      *services.GraphAnalyzer
	ollamaService *services.OllamaService
	mu            sync.Mutex
}

// NewHistoryHandler crée une nouvelle instance
func NewHistoryHandler(ollamaService *services.OllamaService) *HistoryHandler {
	h := &HistoryHandler{
		versions:      []models.SemanticVersion{},
		analyzer:      services.NewGraphAnalyzer(),
		ollamaService: ollamaService,
	}
	h.loadVersionsFromFile()
	return h
}

// --- Méthodes de persistance ---

func (h *HistoryHandler) loadVersionsFromFile() {
	h.mu.Lock()
	defer h.mu.Unlock()

	data, err := os.ReadFile(historyFilePath)
	if err != nil {
		// Le fichier n'existe pas encore, c'est normal au premier lancement
		return
	}
	json.Unmarshal(data, &h.versions)
}

func (h *HistoryHandler) saveVersionsToFile() {
	h.mu.Lock()
	defer h.mu.Unlock()

	data, _ := json.MarshalIndent(h.versions, "", "  ")
	os.WriteFile(historyFilePath, data, 0644)
}

// SaveVersion enregistre une nouvelle version sémantique
func (h *HistoryHandler) SaveVersion(w http.ResponseWriter, r *http.Request) {
	var req models.SaveVersionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	// Calculer le hash de la structure actuelle
	graphHash := h.calculateGraphHash(req.GraphData)

	// Détecter les changements significatifs
	changes := h.detectSemanticChanges(req.GraphData, req.PreviousGraphData)

	// Calculer le niveau de confiance
	confidence := h.calculateConfidence(req.GraphData)

	// Détecter les insights (moments eureka)
	insights := h.detectInsights(changes, req.GraphData)

	// Créer la nouvelle version
	version := models.SemanticVersion{
		ID:          fmt.Sprintf("v%d", len(h.versions)+1),
		Timestamp:   time.Now(),
		GraphHash:   graphHash,
		GraphData:   req.GraphData,
		Changes:     changes,
		Insights:    insights,
		Confidence:  confidence,
		Description: req.Description,
		Tags:        h.generateTags(changes, insights),
		Metrics:     h.calculateMetrics(req.GraphData),
	}

	h.versions = append(h.versions, version)
	h.saveVersionsToFile() // Sauvegarder après ajout

	// Détecter si c'est un moment eureka
	if h.isEurekaMoment(changes, insights) {
		version.IsEurekaMoment = true
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(version)
}

// DeleteVersion supprime une version spécifique
func (h *HistoryHandler) DeleteVersion(w http.ResponseWriter, r *http.Request) {
	var req models.DeleteVersionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	found := false
	var newVersions []models.SemanticVersion
	for _, v := range h.versions {
		if v.ID != req.VersionID {
			newVersions = append(newVersions, v)
		} else {
			found = true
		}
	}

	if !found {
		http.Error(w, "Version non trouvée", http.StatusNotFound)
		return
	}

	h.versions = newVersions
	h.saveVersionsToFile() // Sauvegarder après suppression

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"message": "Version %s supprimée"}`, req.VersionID)
}

// ClearHistory supprime tout l'historique
func (h *HistoryHandler) ClearHistory(w http.ResponseWriter, r *http.Request) {
	h.versions = []models.SemanticVersion{}
	h.saveVersionsToFile() // Sauvegarde la liste vide

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"message": "Historique effacé"}`)
}

// GetVersionHistory retourne l'historique complet
func (h *HistoryHandler) GetVersionHistory(w http.ResponseWriter, r *http.Request) {
	// Trier par timestamp décroissant
	sorted := make([]models.SemanticVersion, len(h.versions))
	copy(sorted, h.versions)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Timestamp.After(sorted[j].Timestamp)
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sorted)
}

// RestoreVersion restaure une version antérieure
func (h *HistoryHandler) RestoreVersion(w http.ResponseWriter, r *http.Request) {
	var req models.RestoreVersionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	// Trouver la version
	var targetVersion *models.SemanticVersion
	for _, v := range h.versions {
		if v.ID == req.VersionID {
			targetVersion = &v
			break
		}
	}

	if targetVersion == nil {
		http.Error(w, "Version non trouvée", http.StatusNotFound)
		return
	}

	// Créer une nouvelle version de restauration
	restoredVersion := models.SemanticVersion{
		ID:           fmt.Sprintf("v%d", len(h.versions)+1),
		Timestamp:    time.Now(),
		GraphData:    targetVersion.GraphData,
		Description:  fmt.Sprintf("Restauration de %s", targetVersion.ID),
		IsRestore:    true,
		RestoredFrom: targetVersion.ID,
	}

	h.versions = append(h.versions, restoredVersion)
	h.saveVersionsToFile() // Sauvegarder après restauration

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(restoredVersion)
}

// CompareVersions compare deux versions
func (h *HistoryHandler) CompareVersions(w http.ResponseWriter, r *http.Request) {
	var req models.CompareVersionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	var v1, v2 *models.SemanticVersion
	for _, v := range h.versions {
		if v.ID == req.Version1ID {
			v1 = &v
		}
		if v.ID == req.Version2ID {
			v2 = &v
		}
	}

	if v1 == nil || v2 == nil {
		http.Error(w, "Version(s) non trouvée(s)", http.StatusNotFound)
		return
	}

	comparison := models.VersionComparison{
		Version1:     *v1,
		Version2:     *v2,
		AddedNodes:   h.findAddedNodes(v1.GraphData, v2.GraphData),
		RemovedNodes: h.findRemovedNodes(v1.GraphData, v2.GraphData),
		AddedEdges:   h.findAddedEdges(v1.GraphData, v2.GraphData),
		RemovedEdges: h.findRemovedEdges(v1.GraphData, v2.GraphData),
		MetricsDelta: h.calculateMetricsDelta(v1.Metrics, v2.Metrics),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comparison)
}

// GetEvolutionTimeline génère une timeline de l'évolution
func (h *HistoryHandler) GetEvolutionTimeline(w http.ResponseWriter, r *http.Request) {
	timeline := []models.EvolutionEvent{}

	for i, version := range h.versions {
		event := models.EvolutionEvent{
			Timestamp:   version.Timestamp,
			VersionID:   version.ID,
			Type:        h.classifyEventType(version),
			Description: version.Description,
			Impact:      h.calculateImpact(version),
			Metrics:     version.Metrics,
		}

		if version.IsEurekaMoment {
			event.Type = "eureka"
			event.Insights = version.Insights
		}

		if i > 0 {
			event.DeltaFromPrevious = h.calculateDelta(h.versions[i-1], version)
		}

		timeline = append(timeline, event)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(timeline)
}

// --- Méthodes privées (inchangées) ---

func (h *HistoryHandler) calculateGraphHash(graph models.GraphData) string {
	data, _ := json.Marshal(graph)
	return fmt.Sprintf("%x", md5.Sum(data))
}

func (h *HistoryHandler) detectSemanticChanges(current, previous models.GraphData) []models.SemanticChange {
	changes := []models.SemanticChange{}

	// Détecter les nouveaux nœuds
	prevNodeMap := make(map[string]bool)
	for _, n := range previous.Nodes {
		prevNodeMap[n.ID] = true
	}

	for _, n := range current.Nodes {
		if !prevNodeMap[n.ID] {
			changes = append(changes, models.SemanticChange{
				Type:        "node_added",
				ElementID:   n.ID,
				Description: fmt.Sprintf("Ajout du concept '%s'", n.Label),
				Impact:      "low",
			})
		}
	}

	// Détecter les nouvelles relations
	prevEdgeMap := make(map[string]bool)
	for _, e := range previous.Edges {
		key := fmt.Sprintf("%s->%s", e.From, e.To)
		prevEdgeMap[key] = true
	}

	for _, e := range current.Edges {
		key := fmt.Sprintf("%s->%s", e.From, e.To)
		if !prevEdgeMap[key] {
			impact := "medium"
			if h.isCriticalConnection(e, current) {
				impact = "high"
			}

			changes = append(changes, models.SemanticChange{
				Type:        "edge_added",
				ElementID:   key,
				Description: fmt.Sprintf("Nouvelle relation: %s -> %s -> %s", e.From, e.Label, e.To),
				Impact:      impact,
			})
		}
	}

	// Détecter les changements structurels majeurs
	if h.detectStructuralChange(current, previous) {
		changes = append(changes, models.SemanticChange{
			Type:        "structural_change",
			Description: "Réorganisation majeure de la structure du graphe",
			Impact:      "high",
		})
	}

	return changes
}

func (h *HistoryHandler) calculateConfidence(graph models.GraphData) float64 {
	if len(graph.Nodes) == 0 {
		return 0.0
	}

	// Facteurs de confiance
	nodeCount := float64(len(graph.Nodes))
	edgeCount := float64(len(graph.Edges))

	// Ratio connexions/nœuds
	connectivityRatio := edgeCount / nodeCount

	// Nœuds orphelins
	orphans := 0
	connected := make(map[string]bool)
	for _, e := range graph.Edges {
		connected[e.From] = true
		connected[e.To] = true
	}
	for _, n := range graph.Nodes {
		if !connected[n.ID] {
			orphans++
		}
	}
	orphanPenalty := float64(orphans) / nodeCount

	// Calculer la confiance (0-1)
	confidence := (connectivityRatio / 3.0) // Normaliser sur une échelle
	confidence *= (1.0 - orphanPenalty*0.5)

	if confidence > 1.0 {
		confidence = 1.0
	}

	return confidence
}

func (h *HistoryHandler) detectInsights(changes []models.SemanticChange, graph models.GraphData) []string {
	insights := []string{}

	// Détection de cycles nouveaux
	highImpactChanges := 0
	for _, c := range changes {
		if c.Impact == "high" {
			highImpactChanges++
		}
	}

	if highImpactChanges >= 3 {
		insights = append(insights, "Connexions multiples établies - pattern émergent détecté")
	}

	// Détection de clusters nouveaux
	if len(changes) > 5 {
		insights = append(insights, "Expansion rapide du graphe - nouvelle zone de connaissance explorée")
	}

	// Détection de ponts conceptuels
	for _, c := range changes {
		if c.Type == "edge_added" && h.isBridgeConnection(c.ElementID, graph) {
			insights = append(insights, fmt.Sprintf("Pont conceptuel créé: %s", c.Description))
		}
	}

	return insights
}

func (h *HistoryHandler) isEurekaMoment(changes []models.SemanticChange, insights []string) bool {
	// Un moment eureka est détecté si :
	// - Il y a plus de 3 insights
	// - Ou plus de 5 changements à fort impact
	// - Ou un changement structurel majeur

	if len(insights) >= 3 {
		return true
	}

	highImpact := 0
	for _, c := range changes {
		if c.Impact == "high" {
			highImpact++
		}
		if c.Type == "structural_change" {
			return true
		}
	}

	return highImpact >= 5
}

func (h *HistoryHandler) generateTags(changes []models.SemanticChange, insights []string) []string {
	tags := []string{}

	// Tags basés sur les types de changements
	hasNodeAdditions := false
	hasEdgeAdditions := false
	hasStructuralChange := false

	for _, c := range changes {
		switch c.Type {
		case "node_added":
			hasNodeAdditions = true
		case "edge_added":
			hasEdgeAdditions = true
		case "structural_change":
			hasStructuralChange = true
		}
	}

	if hasNodeAdditions {
		tags = append(tags, "expansion")
	}
	if hasEdgeAdditions {
		tags = append(tags, "connexion")
	}
	if hasStructuralChange {
		tags = append(tags, "restructuration")
	}
	if len(insights) > 0 {
		tags = append(tags, "insight")
	}

	return tags
}

func (h *HistoryHandler) calculateMetrics(graph models.GraphData) models.GraphMetrics {
	nodeCount := len(graph.Nodes)
	edgeCount := len(graph.Edges)

	// Calculer la densité
	maxPossibleEdges := nodeCount * (nodeCount - 1)
	density := 0.0
	if maxPossibleEdges > 0 {
		density = float64(edgeCount) / float64(maxPossibleEdges)
	}

	// Calculer les composantes connexes
	components := h.countConnectedComponents(graph)

	// Calculer le degré moyen
	avgDegree := 0.0
	if nodeCount > 0 {
		avgDegree = float64(edgeCount*2) / float64(nodeCount)
	}

	return models.GraphMetrics{
		NodeCount:       nodeCount,
		EdgeCount:       edgeCount,
		Density:         density,
		Components:      components,
		AverageDegree:   avgDegree,
		OrphanNodes:     h.countOrphans(graph),
		MaxPathLength:   h.findMaxPathLength(graph),
		ClusteringCoeff: h.calculateClusteringCoefficient(graph),
	}
}

func (h *HistoryHandler) isCriticalConnection(edge models.Edge, graph models.GraphData) bool {
	// Une connexion est critique si elle connecte deux clusters précédemment séparés
	// ou si elle crée un cycle important

	// Simplification : vérifier si l'edge connecte des nœuds de contextes différents
	var fromContext, toContext string
	for _, n := range graph.Nodes {
		if n.ID == edge.From {
			fromContext = n.Context
		}
		if n.ID == edge.To {
			toContext = n.Context
		}
	}

	return fromContext != toContext && fromContext != "" && toContext != ""
}

func (h *HistoryHandler) detectStructuralChange(current, previous models.GraphData) bool {
	// Détecter si la structure globale a changé significativement

	prevComponents := h.countConnectedComponents(previous)
	currComponents := h.countConnectedComponents(current)

	// Changement majeur si le nombre de composantes change significativement
	if prevComponents-currComponents >= 2 || currComponents-prevComponents >= 2 {
		return true
	}

	// Ou si la densité change significativement
	prevMetrics := h.calculateMetrics(previous)
	currMetrics := h.calculateMetrics(current)

	densityChange := currMetrics.Density - prevMetrics.Density
	if densityChange > 0.3 || densityChange < -0.3 {
		return true
	}

	return false
}

func (h *HistoryHandler) isBridgeConnection(edgeID string, graph models.GraphData) bool {
	// Simplification : une connexion est un pont si elle relie des nœuds
	// qui n'avaient pas de chemin court entre eux
	return len(graph.Edges) > 10 && len(edgeID) > 0
}

func (h *HistoryHandler) countConnectedComponents(graph models.GraphData) int {
	if len(graph.Nodes) == 0 {
		return 0
	}

	visited := make(map[string]bool)
	components := 0

	var dfs func(nodeID string)
	dfs = func(nodeID string) {
		visited[nodeID] = true
		for _, edge := range graph.Edges {
			if edge.From == nodeID && !visited[edge.To] {
				dfs(edge.To)
			}
			if edge.To == nodeID && !visited[edge.From] {
				dfs(edge.From)
			}
		}
	}

	for _, node := range graph.Nodes {
		if !visited[node.ID] {
			components++
			dfs(node.ID)
		}
	}

	return components
}

func (h *HistoryHandler) countOrphans(graph models.GraphData) int {
	connected := make(map[string]bool)
	for _, edge := range graph.Edges {
		connected[edge.From] = true
		connected[edge.To] = true
	}

	orphans := 0
	for _, node := range graph.Nodes {
		if !connected[node.ID] {
			orphans++
		}
	}

	return orphans
}

func (h *HistoryHandler) findMaxPathLength(graph models.GraphData) int {
	// Simplification : retourner une estimation
	if len(graph.Edges) == 0 {
		return 0
	}
	return len(graph.Nodes) / 2
}

func (h *HistoryHandler) calculateClusteringCoefficient(graph models.GraphData) float64 {
	// Simplification : retourner une valeur estimée basée sur la densité
	// Ne PAS appeler calculateMetrics ici pour éviter la récursion infinie
	nodeCount := len(graph.Nodes)
	edgeCount := len(graph.Edges)

	if nodeCount <= 1 {
		return 0.0
	}

	maxPossibleEdges := nodeCount * (nodeCount - 1)
	density := 0.0
	if maxPossibleEdges > 0 {
		density = float64(edgeCount) / float64(maxPossibleEdges)
	}

	return density * 0.7
}

func (h *HistoryHandler) findAddedNodes(v1, v2 models.GraphData) []models.Node {
	v1Map := make(map[string]bool)
	for _, n := range v1.Nodes {
		v1Map[n.ID] = true
	}

	added := []models.Node{}
	for _, n := range v2.Nodes {
		if !v1Map[n.ID] {
			added = append(added, n)
		}
	}

	return added
}

func (h *HistoryHandler) findRemovedNodes(v1, v2 models.GraphData) []models.Node {
	return h.findAddedNodes(v2, v1)
}

func (h *HistoryHandler) findAddedEdges(v1, v2 models.GraphData) []models.Edge {
	v1Map := make(map[string]bool)
	for _, e := range v1.Edges {
		key := fmt.Sprintf("%s->%s", e.From, e.To)
		v1Map[key] = true
	}

	added := []models.Edge{}
	for _, e := range v2.Edges {
		key := fmt.Sprintf("%s->%s", e.From, e.To)
		if !v1Map[key] {
			added = append(added, e)
		}
	}

	return added
}

func (h *HistoryHandler) findRemovedEdges(v1, v2 models.GraphData) []models.Edge {
	return h.findAddedEdges(v2, v1)
}

func (h *HistoryHandler) calculateMetricsDelta(m1, m2 models.GraphMetrics) models.MetricsDelta {
	return models.MetricsDelta{
		NodeCountDelta:  m2.NodeCount - m1.NodeCount,
		EdgeCountDelta:  m2.EdgeCount - m1.EdgeCount,
		DensityDelta:    m2.Density - m1.Density,
		ComponentsDelta: m2.Components - m1.Components,
	}
}

func (h *HistoryHandler) classifyEventType(version models.SemanticVersion) string {
	if version.IsEurekaMoment {
		return "eureka"
	}
	if version.IsRestore {
		return "restore"
	}

	changeCount := len(version.Changes)
	if changeCount == 0 {
		return "checkpoint"
	} else if changeCount <= 3 {
		return "minor"
	} else if changeCount <= 10 {
		return "major"
	}

	return "massive"
}

func (h *HistoryHandler) calculateImpact(version models.SemanticVersion) string {
	highImpact := 0
	for _, c := range version.Changes {
		if c.Impact == "high" {
			highImpact++
		}
	}

	if highImpact >= 3 || version.IsEurekaMoment {
		return "high"
	} else if highImpact >= 1 || len(version.Changes) >= 5 {
		return "medium"
	}

	return "low"
}

func (h *HistoryHandler) calculateDelta(prev, curr models.SemanticVersion) models.VersionDelta {
	return models.VersionDelta{
		TimeElapsed:     curr.Timestamp.Sub(prev.Timestamp),
		ChangesCount:    len(curr.Changes),
		ConfidenceDelta: curr.Confidence - prev.Confidence,
	}
}
