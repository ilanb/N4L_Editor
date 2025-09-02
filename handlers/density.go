package handlers

import (
	"encoding/json"
	"math"
	"net/http"
	"sort"

	"n4l-editor/models"
	"n4l-editor/services"
)

// DensityHandler gère les analyses de densité conceptuelle
type DensityHandler struct {
	analyzer *services.GraphAnalyzer
}

// NewDensityHandler crée une nouvelle instance
func NewDensityHandler() *DensityHandler {
	return &DensityHandler{
		analyzer: services.NewGraphAnalyzer(),
	}
}

// GetDensityMap calcule la carte de densité du graphe
func (h *DensityHandler) GetDensityMap(w http.ResponseWriter, r *http.Request) {
	var graphData models.GraphData
	if err := json.NewDecoder(r.Body).Decode(&graphData); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	densityMap := h.calculateDensityMap(graphData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(densityMap)
}

// GetConceptualTerritories identifie les territoires conceptuels
func (h *DensityHandler) GetConceptualTerritories(w http.ResponseWriter, r *http.Request) {
	var graphData models.GraphData
	if err := json.NewDecoder(r.Body).Decode(&graphData); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	territories := h.identifyTerritories(graphData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(territories)
}

// GetExplorationSuggestions suggère où explorer
func (h *DensityHandler) GetExplorationSuggestions(w http.ResponseWriter, r *http.Request) {
	var graphData models.GraphData
	if err := json.NewDecoder(r.Body).Decode(&graphData); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	suggestions := h.generateExplorationSuggestions(graphData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suggestions)
}

// GetDensityMetrics calcule les métriques de densité globales
func (h *DensityHandler) GetDensityMetrics(w http.ResponseWriter, r *http.Request) {
	var graphData models.GraphData
	if err := json.NewDecoder(r.Body).Decode(&graphData); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	metrics := h.calculateDensityMetrics(graphData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// Méthodes privées

func (h *DensityHandler) calculateDensityMap(graph models.GraphData) models.DensityMap {
	densityMap := models.DensityMap{
		Zones:         []models.DensityZone{},
		HeatmapData:   []models.HeatmapPoint{},
		GlobalDensity: 0.0,
	}

	if len(graph.Nodes) == 0 {
		return densityMap
	}

	// Utiliser les positions réelles fournies, sinon assigner des positions par défaut
	nodePositions := graph.Positions
	if nodePositions == nil || len(nodePositions) == 0 {
		nodePositions = make(map[string]models.Position)
		gridSize := int(math.Ceil(math.Sqrt(float64(len(graph.Nodes)))))
		for i, node := range graph.Nodes {
			x := float64((i % gridSize) * 100)
			y := float64((i / gridSize) * 100)
			nodePositions[node.ID] = models.Position{X: x, Y: y}
		}
	}

	// Calculer le degré de chaque nœud
	nodeDegrees := make(map[string]int)
	for _, edge := range graph.Edges {
		nodeDegrees[edge.From]++
		nodeDegrees[edge.To]++
	}

	// Créer les zones de densité basées sur les clusters
	clusters := h.identifyClusters(graph)
	avgDensity := h.calculateAverageDensity(graph)

	for _, cluster := range clusters {
		if len(cluster) > 0 {
			zone := h.createDensityZone(cluster, graph, nodeDegrees, nodePositions, avgDensity)
			densityMap.Zones = append(densityMap.Zones, zone)
		}
	}

	// Créer les points de heatmap
	for _, node := range graph.Nodes {
		pos, exists := nodePositions[node.ID]
		if !exists {
			continue // Skip node if position is unknown
		}

		intensity := h.calculateNodeIntensity(node.ID, graph, nodeDegrees, nodePositions)

		point := models.HeatmapPoint{
			X:         pos.X,
			Y:         pos.Y,
			Intensity: intensity,
			NodeID:    node.ID,
			NodeLabel: node.Label,
		}

		densityMap.HeatmapData = append(densityMap.HeatmapData, point)
	}

	// Calculer la densité globale
	densityMap.GlobalDensity = h.calculateGlobalDensity(graph)

	// Identifier les zones vides
	densityMap.EmptyZones = h.findEmptyZones(graph, nodePositions)

	return densityMap
}

func (h *DensityHandler) identifyTerritories(graph models.GraphData) models.ConceptualTerritories {
	territories := models.ConceptualTerritories{
		Explored:   []models.Territory{},
		Unexplored: []models.Territory{},
		Frontier:   []models.Territory{},
	}

	clusters := h.identifyClusters(graph)
	avgDensity := h.calculateAverageDensity(graph)

	// Définir des seuils dynamiques
	exploredThreshold := math.Max(avgDensity*1.5, 0.2)
	unexploredThreshold := math.Min(avgDensity*0.7, 0.1)

	for i, cluster := range clusters {
		density := h.calculateClusterDensity(cluster, graph)
		connections := h.countExternalConnections(cluster, graph)

		territory := models.Territory{
			ID:          i,
			Nodes:       cluster,
			Density:     density,
			Size:        len(cluster),
			CentralNode: h.findCentralNode(cluster, graph),
		}

		// Classifier le territoire avec des seuils dynamiques
		if density > exploredThreshold {
			territory.Type = "explored"
			territory.Description = "Zone bien explorée avec de nombreuses connexions"
			territories.Explored = append(territories.Explored, territory)
		} else if density < unexploredThreshold && len(cluster) > 1 {
			territory.Type = "unexplored"
			territory.Description = "Territoire peu exploré nécessitant plus de connexions"
			territories.Unexplored = append(territories.Unexplored, territory)
		} else {
			territory.Type = "frontier"
			territory.Description = "Zone frontière avec potentiel d'expansion"
			territories.Frontier = append(territories.Frontier, territory)
		}

		territory.Metrics = models.TerritoryMetrics{
			InternalEdges: h.countInternalEdges(cluster, graph),
			ExternalEdges: connections,
			AverageDegree: h.calculateAverageDegree(cluster, graph),
			Centrality:    h.calculateCentrality(cluster, graph),
		}
	}

	// Identifier les nœuds isolés
	orphans := h.findOrphans(graph)
	for _, orphan := range orphans {
		territories.Unexplored = append(territories.Unexplored, models.Territory{
			ID:          len(territories.Unexplored) + 1000,
			Type:        "isolated",
			Nodes:       []string{orphan},
			Density:     0.0,
			Size:        1,
			Description: "Nœud isolé sans connexions",
			CentralNode: orphan,
		})
	}

	return territories
}

func (h *DensityHandler) generateExplorationSuggestions(graph models.GraphData) models.ExplorationSuggestions {
	suggestions := models.ExplorationSuggestions{
		PriorityConnections: []models.ConnectionSuggestion{},
		BridgeOpportunities: []models.BridgeSuggestion{},
		DensityBalancing:    []models.BalancingSuggestion{},
	}

	territories := h.identifyTerritories(graph)
	avgDensity := h.calculateAverageDensity(graph)

	// 1. Suggérer des connexions pour les zones peu denses
	for _, territory := range territories.Unexplored {
		if len(territory.Nodes) > 0 {
			nearbyNodes := h.findNearbyHighDensityNodes(territory.Nodes[0], graph)
			for _, target := range nearbyNodes {
				suggestions.PriorityConnections = append(suggestions.PriorityConnections,
					models.ConnectionSuggestion{
						From:     territory.Nodes[0],
						To:       target,
						Reason:   "Connecter zone isolée au réseau principal",
						Impact:   "high",
						Priority: 1,
					})
			}
		}
	}

	// 2. Identifier les ponts entre clusters
	allTerritories := append(append(territories.Explored, territories.Frontier...), territories.Unexplored...)
	for i, territory1 := range allTerritories {
		for j, territory2 := range allTerritories {
			if i < j && len(territory1.Nodes) > 0 && len(territory2.Nodes) > 0 {
				if !h.clustersConnected(territory1.Nodes, territory2.Nodes, graph) {
					suggestions.BridgeOpportunities = append(suggestions.BridgeOpportunities,
						models.BridgeSuggestion{
							Cluster1:       territory1.Nodes,
							Cluster2:       territory2.Nodes,
							SuggestedNode1: territory1.CentralNode,
							SuggestedNode2: territory2.CentralNode,
							Impact:         h.calculateBridgeImpact(territory1, territory2),
							Description:    "Créer un pont entre deux zones thématiques",
						})
				}
			}
		}
	}

	// 3. Suggestions pour équilibrer la densité
	for _, territory := range territories.Explored {
		if territory.Density > avgDensity*1.5 {
			suggestions.DensityBalancing = append(suggestions.DensityBalancing,
				models.BalancingSuggestion{
					Zone:           territory.Nodes,
					CurrentDensity: territory.Density,
					TargetDensity:  avgDensity,
					Action:         "distribute",
					Description:    "Zone surdense - envisager de créer des sous-groupes",
				})
		}
	}

	for _, territory := range territories.Unexplored {
		if territory.Density < avgDensity*0.5 && len(territory.Nodes) > 1 {
			suggestions.DensityBalancing = append(suggestions.DensityBalancing,
				models.BalancingSuggestion{
					Zone:           territory.Nodes,
					CurrentDensity: territory.Density,
					TargetDensity:  avgDensity,
					Action:         "densify",
					Description:    "Zone sous-dense - ajouter des connexions internes",
				})
		}
	}

	h.sortSuggestions(&suggestions)
	return suggestions
}

func (h *DensityHandler) calculateDensityMetrics(graph models.GraphData) models.DensityMetrics {
	metrics := models.DensityMetrics{}

	if len(graph.Nodes) == 0 {
		return metrics
	}

	metrics.GlobalDensity = h.calculateGlobalDensity(graph)
	metrics.AverageDegree = h.calculateGlobalAverageDegree(graph)
	metrics.ClusteringCoefficient = h.calculateGlobalClusteringCoefficient(graph)

	degreeDist := make(map[int]int)
	for _, node := range graph.Nodes {
		degree := h.getNodeDegree(node.ID, graph)
		degreeDist[degree]++
	}
	metrics.DegreeDistribution = degreeDist

	metrics.Hubs = h.identifyHubs(graph)
	metrics.Peripherals = h.identifyPeripherals(graph)

	territories := h.identifyTerritories(graph)
	metrics.HighDensityZones = len(territories.Explored)
	metrics.LowDensityZones = len(territories.Unexplored)
	metrics.FrontierZones = len(territories.Frontier)

	metrics.BalanceScore = h.calculateBalanceScore(graph, territories)
	metrics.Recommendations = h.generateMetricRecommendations(metrics, graph)

	return metrics
}

// Méthodes auxiliaires

func (h *DensityHandler) identifyClusters(graph models.GraphData) [][]string {
	visited := make(map[string]bool)
	var clusters [][]string

	for _, node := range graph.Nodes {
		if !visited[node.ID] {
			cluster := []string{}
			h.dfs(node.ID, graph, visited, &cluster)
			if len(cluster) > 0 {
				clusters = append(clusters, cluster)
			}
		}
	}
	return clusters
}

func (h *DensityHandler) dfs(nodeID string, graph models.GraphData, visited map[string]bool, cluster *[]string) {
	visited[nodeID] = true
	*cluster = append(*cluster, nodeID)

	for _, edge := range graph.Edges {
		if edge.From == nodeID && !visited[edge.To] {
			h.dfs(edge.To, graph, visited, cluster)
		}
		if edge.To == nodeID && !visited[edge.From] {
			h.dfs(edge.From, graph, visited, cluster)
		}
	}
}

func (h *DensityHandler) createDensityZone(cluster []string, graph models.GraphData, degrees map[string]int, positions map[string]models.Position, avgDensity float64) models.DensityZone {
	zone := models.DensityZone{
		Nodes: cluster,
	}

	var sumX, sumY float64
	validNodes := 0
	for _, nodeID := range cluster {
		if pos, ok := positions[nodeID]; ok {
			sumX += pos.X
			sumY += pos.Y
			validNodes++
		}
	}

	if validNodes == 0 {
		return zone
	}
	zone.CenterX = sumX / float64(validNodes)
	zone.CenterY = sumY / float64(validNodes)

	var maxDist float64
	for _, nodeID := range cluster {
		if pos, ok := positions[nodeID]; ok {
			dist := math.Sqrt(math.Pow(pos.X-zone.CenterX, 2) + math.Pow(pos.Y-zone.CenterY, 2))
			if dist > maxDist {
				maxDist = dist
			}
		}
	}
	zone.Radius = maxDist + 50

	zone.Density = h.calculateClusterDensity(cluster, graph)

	// Classification dynamique basée sur la densité moyenne
	if zone.Density > avgDensity*1.5 {
		zone.Type = "high"
		zone.Color = "#ef4444" // Rouge
	} else if zone.Density > avgDensity*0.7 {
		zone.Type = "medium"
		zone.Color = "#f59e0b" // Orange
	} else {
		zone.Type = "low"
		zone.Color = "#3b82f6" // Bleu
	}

	return zone
}

func (h *DensityHandler) calculateNodeIntensity(nodeID string, graph models.GraphData, degrees map[string]int, positions map[string]models.Position) float64 {
	intensity := float64(degrees[nodeID]) * 0.5
	neighbors := h.getNeighbors(nodeID, graph)
	for _, neighbor := range neighbors {
		intensity += float64(degrees[neighbor]) * 0.2
	}

	maxDegree := 0
	for _, d := range degrees {
		if d > maxDegree {
			maxDegree = d
		}
	}

	if maxDegree > 0 {
		intensity = intensity / float64(maxDegree*2)
	}

	return math.Min(intensity, 1.0)
}

func (h *DensityHandler) findEmptyZones(graph models.GraphData, positions map[string]models.Position) []models.EmptyZone {
	// Cette fonction reste une simplification et pourrait être améliorée
	var emptyZones []models.EmptyZone
	gridSize := 200.0
	occupied := make(map[string]bool)

	if len(positions) == 0 {
		return emptyZones
	}

	// Déterminer les limites du graphe
	minX, maxX, minY, maxY := math.MaxFloat64, -math.MaxFloat64, math.MaxFloat64, -math.MaxFloat64
	for _, pos := range positions {
		minX, maxX = math.Min(minX, pos.X), math.Max(maxX, pos.X)
		minY, maxY = math.Min(minY, pos.Y), math.Max(maxY, pos.Y)
	}

	for _, pos := range positions {
		gridX := int(math.Floor(pos.X / gridSize))
		gridY := int(math.Floor(pos.Y / gridSize))
		key := string(gridX) + "," + string(gridY)
		occupied[key] = true
	}

	startX, endX := int(math.Floor(minX/gridSize))-1, int(math.Ceil(maxX/gridSize))+1
	startY, endY := int(math.Floor(minY/gridSize))-1, int(math.Ceil(maxY/gridSize))+1

	for x := startX; x <= endX; x++ {
		for y := startY; y <= endY; y++ {
			key := string(x) + "," + string(y)
			if !occupied[key] {
				emptyZones = append(emptyZones, models.EmptyZone{
					X:      float64(x)*gridSize + gridSize/2,
					Y:      float64(y)*gridSize + gridSize/2,
					Radius: gridSize / 2,
				})
			}
		}
	}
	return emptyZones
}

func (h *DensityHandler) calculateClusterDensity(cluster []string, graph models.GraphData) float64 {
	if len(cluster) <= 1 {
		return 0.0
	}
	internalEdges := h.countInternalEdges(cluster, graph)
	maxPossible := len(cluster) * (len(cluster) - 1) / 2 // Pour graphe non dirigé
	if maxPossible == 0 {
		return 0.0
	}
	return float64(internalEdges) / float64(maxPossible)
}

func (h *DensityHandler) getNeighbors(nodeID string, graph models.GraphData) []string {
	neighborMap := make(map[string]bool)
	for _, edge := range graph.Edges {
		if edge.From == nodeID {
			neighborMap[edge.To] = true
		}
		if edge.To == nodeID {
			neighborMap[edge.From] = true
		}
	}
	neighbors := []string{}
	for neighbor := range neighborMap {
		neighbors = append(neighbors, neighbor)
	}
	return neighbors
}

func (h *DensityHandler) countExternalConnections(cluster []string, graph models.GraphData) int {
	clusterSet := make(map[string]bool)
	for _, node := range cluster {
		clusterSet[node] = true
	}

	count := 0
	for _, edge := range graph.Edges {
		fromInCluster := clusterSet[edge.From]
		toInCluster := clusterSet[edge.To]
		if fromInCluster != toInCluster {
			count++
		}
	}
	return count
}

func (h *DensityHandler) findCentralNode(cluster []string, graph models.GraphData) string {
	if len(cluster) == 0 {
		return ""
	}
	maxDegree := -1
	centralNode := cluster[0]
	for _, node := range cluster {
		degree := 0
		// On ne compte que les liens internes au cluster pour la centralité
		for _, edge := range graph.Edges {
			isInternal := false
			for _, n := range cluster {
				if edge.From == n || edge.To == n {
					isInternal = true
					break
				}
			}
			if isInternal && (edge.From == node || edge.To == node) {
				degree++
			}
		}
		if degree > maxDegree {
			maxDegree = degree
			centralNode = node
		}
	}
	return centralNode
}

func (h *DensityHandler) getNodeDegree(nodeID string, graph models.GraphData) int {
	degree := 0
	for _, edge := range graph.Edges {
		if edge.From == nodeID || edge.To == nodeID {
			degree++
		}
	}
	return degree
}

func (h *DensityHandler) findOrphans(graph models.GraphData) []string {
	connected := make(map[string]bool)
	for _, edge := range graph.Edges {
		connected[edge.From] = true
		connected[edge.To] = true
	}
	orphans := []string{}
	for _, node := range graph.Nodes {
		if !connected[node.ID] {
			orphans = append(orphans, node.ID)
		}
	}
	return orphans
}

func (h *DensityHandler) sortSuggestions(suggestions *models.ExplorationSuggestions) {
	sort.Slice(suggestions.PriorityConnections, func(i, j int) bool {
		return suggestions.PriorityConnections[i].Priority < suggestions.PriorityConnections[j].Priority
	})
	sort.Slice(suggestions.BridgeOpportunities, func(i, j int) bool {
		return suggestions.BridgeOpportunities[i].Impact > suggestions.BridgeOpportunities[j].Impact
	})
}

// Méthodes additionnelles pour les métriques

func (h *DensityHandler) calculateGlobalDensity(graph models.GraphData) float64 {
	n := len(graph.Nodes)
	if n <= 1 {
		return 0.0
	}
	maxEdges := n * (n - 1) / 2 // Graphe non dirigé
	if maxEdges == 0 {
		return 0.0
	}
	return float64(len(graph.Edges)) / float64(maxEdges)
}

func (h *DensityHandler) calculateGlobalAverageDegree(graph models.GraphData) float64 {
	if len(graph.Nodes) == 0 {
		return 0.0
	}
	return float64(len(graph.Edges)*2) / float64(len(graph.Nodes))
}

func (h *DensityHandler) calculateGlobalClusteringCoefficient(graph models.GraphData) float64 {
	// **IMPLÉMENTATION CORRIGÉE**
	totalCoeff := 0.0
	nodesWithDegreeTwoOrMore := 0

	// Créer une structure de données pour un accès rapide aux voisins
	adj := make(map[string]map[string]bool)
	for _, node := range graph.Nodes {
		adj[node.ID] = make(map[string]bool)
	}
	for _, edge := range graph.Edges {
		adj[edge.From][edge.To] = true
		adj[edge.To][edge.From] = true
	}

	for _, node := range graph.Nodes {
		neighbors := h.getNeighbors(node.ID, graph)
		degree := len(neighbors)

		if degree < 2 {
			continue
		}

		nodesWithDegreeTwoOrMore++
		triangles := 0
		// Compter les triangles
		for i := 0; i < len(neighbors); i++ {
			for j := i + 1; j < len(neighbors); j++ {
				u, v := neighbors[i], neighbors[j]
				if adj[u][v] {
					triangles++
				}
			}
		}

		// Coefficient de clustering local
		localCoeff := float64(2*triangles) / float64(degree*(degree-1))
		totalCoeff += localCoeff
	}

	if nodesWithDegreeTwoOrMore == 0 {
		return 0.0
	}

	return totalCoeff / float64(nodesWithDegreeTwoOrMore)
}

func (h *DensityHandler) identifyHubs(graph models.GraphData) []string {
	avgDegree := h.calculateGlobalAverageDegree(graph)
	hubs := []string{}
	for _, node := range graph.Nodes {
		if float64(h.getNodeDegree(node.ID, graph)) > avgDegree*1.5+1 { // Seuil un peu plus strict
			hubs = append(hubs, node.ID)
		}
	}
	return hubs
}

func (h *DensityHandler) identifyPeripherals(graph models.GraphData) []string {
	peripherals := []string{}
	for _, node := range graph.Nodes {
		if h.getNodeDegree(node.ID, graph) <= 1 {
			peripherals = append(peripherals, node.ID)
		}
	}
	return peripherals
}

func (h *DensityHandler) calculateBalanceScore(graph models.GraphData, territories models.ConceptualTerritories) float64 {
	sizes := []float64{}

	// On ne prend en compte que les vrais clusters (taille > 1)
	allTerritories := append(append(territories.Explored, territories.Frontier...), territories.Unexplored...)
	for _, t := range allTerritories {
		if t.Size > 1 {
			sizes = append(sizes, float64(t.Size))
		}
	}

	if len(sizes) < 2 {
		return 0.8 // Score élevé s'il n'y a pas assez de clusters à comparer
	}

	// Calcul du coefficient de variation (écart-type / moyenne)
	numClusters := float64(len(sizes))
	sum := 0.0
	for _, s := range sizes {
		sum += s
	}
	mean := sum / numClusters

	if mean == 0 {
		return 0.0
	}

	variance := 0.0
	for _, s := range sizes {
		variance += math.Pow(s-mean, 2)
	}
	variance /= numClusters
	stdDev := math.Sqrt(variance)

	coeffOfVariation := stdDev / mean

	// **NOUVELLE FORMULE DE SCORE**
	// Cette formule est plus robuste et ne tombe pas à 0 trop facilement.
	// Un coefficient de variation de 0 donne un score de 1 (parfait).
	// Un coefficient de 1 (écart-type = moyenne) donne un score de 0.5.
	score := 1.0 / (1.0 + coeffOfVariation)

	return score
}

func (h *DensityHandler) generateMetricRecommendations(metrics models.DensityMetrics, graph models.GraphData) []string {
	recommendations := []string{}
	nodeCount := len(graph.Nodes)

	if nodeCount == 0 {
		return recommendations
	}

	if metrics.GlobalDensity < 0.01 {
		recommendations = append(recommendations, "Le graphe est très peu dense. Ajoutez plus de connexions entre les concepts.")
	} else if metrics.GlobalDensity > 0.2 {
		recommendations = append(recommendations, "Le graphe est très dense. Envisagez de créer des sous-groupes ou des contextes pour clarifier.")
	}

	if len(metrics.Peripherals) > nodeCount/2 {
		recommendations = append(recommendations, "Plus de la moitié des nœuds sont périphériques ou isolés. Intégrez-les davantage au cœur du graphe.")
	}

	if metrics.BalanceScore < 0.4 {
		recommendations = append(recommendations, "Le graphe est déséquilibré, avec des zones de tailles très différentes. Essayez d'équilibrer les territoires.")
	}

	if metrics.LowDensityZones > metrics.HighDensityZones+metrics.FrontierZones {
		recommendations = append(recommendations, "Beaucoup de territoires sont inexplorés. Concentrez-vous sur le développement de ces zones.")
	}

	return recommendations
}

// Méthodes helper additionnelles

func (h *DensityHandler) countInternalEdges(cluster []string, graph models.GraphData) int {
	clusterSet := make(map[string]bool)
	for _, node := range cluster {
		clusterSet[node] = true
	}
	count := 0
	for _, edge := range graph.Edges {
		if clusterSet[edge.From] && clusterSet[edge.To] {
			count++
		}
	}
	return count
}

func (h *DensityHandler) calculateAverageDegree(cluster []string, graph models.GraphData) float64 {
	if len(cluster) == 0 {
		return 0.0
	}
	totalDegree := 0
	for _, node := range cluster {
		totalDegree += h.getNodeDegree(node, graph)
	}
	return float64(totalDegree) / float64(len(cluster))
}

func (h *DensityHandler) calculateCentrality(cluster []string, graph models.GraphData) float64 {
	external := h.countExternalConnections(cluster, graph)
	internal := h.countInternalEdges(cluster, graph)
	if internal+external == 0 {
		return 0.0
	}
	return float64(external) / float64(internal+external)
}

func (h *DensityHandler) findNearbyHighDensityNodes(nodeID string, graph models.GraphData) []string {
	candidates := []string{}
	avgDegree := h.calculateGlobalAverageDegree(graph)

	for _, node := range graph.Nodes {
		if node.ID != nodeID && float64(h.getNodeDegree(node.ID, graph)) > avgDegree*1.2 {
			candidates = append(candidates, node.ID)
			if len(candidates) >= 3 {
				break
			}
		}
	}
	return candidates
}

func (h *DensityHandler) clustersConnected(cluster1, cluster2 []string, graph models.GraphData) bool {
	set1 := make(map[string]bool)
	for _, n := range cluster1 {
		set1[n] = true
	}
	set2 := make(map[string]bool)
	for _, n := range cluster2 {
		set2[n] = true
	}
	for _, edge := range graph.Edges {
		if (set1[edge.From] && set2[edge.To]) || (set2[edge.From] && set1[edge.To]) {
			return true
		}
	}
	return false
}

func (h *DensityHandler) calculateBridgeImpact(t1, t2 models.Territory) float64 {
	sizeImpact := math.Log(float64(t1.Size*t2.Size + 1))
	densityImpact := (t1.Density + t2.Density) / 2.0
	impact := (sizeImpact * 0.4) + (densityImpact * 0.6)
	return math.Min(impact, 1.0)
}

func (h *DensityHandler) calculateAverageDensity(graph models.GraphData) float64 {
	clusters := h.identifyClusters(graph)
	if len(clusters) == 0 {
		return 0.0
	}
	totalDensity := 0.0
	for _, cluster := range clusters {
		if len(cluster) > 1 {
			totalDensity += h.calculateClusterDensity(cluster, graph)
		}
	}
	return totalDensity / float64(len(clusters))
}
