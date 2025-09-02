package services

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode"

	"n4l-editor/models"
)

// FindClustersAndPaths trouve les clusters de nœuds correspondant aux termes de recherche et les chemins les reliant
func (ga *GraphAnalyzer) FindClustersAndPaths(terms []string, graphData models.GraphData) (map[string][]string, [][]string) {
	matchingNodes := make(map[string]bool)
	for _, term := range terms {
		lowerTerm := strings.ToLower(term)
		for _, node := range graphData.Nodes {
			if strings.Contains(strings.ToLower(node.Label), lowerTerm) {
				matchingNodes[node.ID] = true
			}
		}
	}

	// 1. Identifier les clusters (groupes de nœuds connectés)
	clusters := make(map[string][]string)
	visited := make(map[string]bool)
	clusterIndex := 0
	for nodeID := range matchingNodes {
		if !visited[nodeID] {
			clusterID := fmt.Sprintf("cluster-%d", clusterIndex)
			var currentCluster []string
			ga.findConnectedComponent(nodeID, matchingNodes, graphData, visited, &currentCluster)
			if len(currentCluster) > 0 {
				clusters[clusterID] = currentCluster
				clusterIndex++
			}
		}
	}

	// 2. Trouver les chemins les plus courts entre les clusters
	var connectingPaths [][]string
	clusterKeys := make([]string, 0, len(clusters))
	for k := range clusters {
		clusterKeys = append(clusterKeys, k)
	}

	if len(clusterKeys) > 1 {
		adj := ga.buildAdjacencyListFromGraphData(graphData)
		for i := 0; i < len(clusterKeys); i++ {
			for j := i + 1; j < len(clusterKeys); j++ {
				shortestPath := ga.findShortestPathBetweenClusters(clusters[clusterKeys[i]], clusters[clusterKeys[j]], adj)
				if shortestPath != nil {
					connectingPaths = append(connectingPaths, shortestPath)
				}
			}
		}
	}

	return clusters, connectingPaths
}

// findConnectedComponent est une aide pour trouver un groupe de nœuds connectés (cluster) via DFS
func (ga *GraphAnalyzer) findConnectedComponent(startNode string, nodeSet map[string]bool, graphData models.GraphData, visited map[string]bool, component *[]string) {
	stack := []string{startNode}
	visited[startNode] = true

	for len(stack) > 0 {
		nodeID := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		if nodeSet[nodeID] {
			*component = append(*component, nodeID)
		}

		for _, edge := range graphData.Edges {
			var neighbor string
			if edge.From == nodeID {
				neighbor = edge.To
			} else if edge.To == nodeID {
				neighbor = edge.From
			}

			if neighbor != "" && !visited[neighbor] && nodeSet[neighbor] {
				visited[neighbor] = true
				stack = append(stack, neighbor)
			}
		}
	}
}

// buildAdjacencyListFromGraphData crée une liste d'adjacence à partir de GraphData
func (ga *GraphAnalyzer) buildAdjacencyListFromGraphData(graphData models.GraphData) map[string][]string {
	adj := make(map[string][]string)
	for _, edge := range graphData.Edges {
		adj[edge.From] = append(adj[edge.From], edge.To)
		adj[edge.To] = append(adj[edge.To], edge.From) // Pour un graphe non dirigé
	}
	return adj
}

// findShortestPathBetweenClusters trouve le chemin le plus court entre deux groupes de nœuds
func (ga *GraphAnalyzer) findShortestPathBetweenClusters(cluster1, cluster2 []string, adj map[string][]string) []string {
	var shortestPath []string

	for _, startNode := range cluster1 {
		for _, endNode := range cluster2 {
			path := ga.findPath(startNode, endNode, adj) // Utilise BFS, donc trouve le plus court chemin
			if path != nil {
				if shortestPath == nil || len(path) < len(shortestPath) {
					shortestPath = path
				}
			}
		}
	}
	return shortestPath
}

// GraphAnalyzer fournit des méthodes d'analyse de graphe
type GraphAnalyzer struct{}

// NewGraphAnalyzer crée une nouvelle instance de GraphAnalyzer
func NewGraphAnalyzer() *GraphAnalyzer {
	return &GraphAnalyzer{}
}

// GetExpansionCone calcule le cône d'expansion à partir d'un nœud donné
func (ga *GraphAnalyzer) GetExpansionCone(nodeID string, depth int, graphData models.GraphData) (map[string]bool, []models.Edge) {
	nodeIDsInCone := make(map[string]bool)
	var edgesInCone []models.Edge

	queue := []struct {
		ID    string
		Level int
	}{{ID: nodeID, Level: 0}}

	// visited keeps track of nodes we've processed to avoid infinite loops
	visited := make(map[string]bool)
	visited[nodeID] = true

	// First, find all nodes in the cone
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		nodeIDsInCone[current.ID] = true

		if current.Level >= depth {
			continue
		}

		for _, edge := range graphData.Edges {
			var neighbor string
			if edge.From == current.ID {
				neighbor = edge.To
			} else if edge.To == current.ID {
				neighbor = edge.From
			}

			if neighbor != "" && !visited[neighbor] {
				visited[neighbor] = true
				queue = append(queue, struct {
					ID    string
					Level int
				}{ID: neighbor, Level: current.Level + 1})
			}
		}
	}

	// Second, collect all edges that connect two nodes within the cone
	for _, edge := range graphData.Edges {
		if nodeIDsInCone[edge.From] && nodeIDsInCone[edge.To] {
			edgesInCone = append(edgesInCone, edge)
		}
	}

	return nodeIDsInCone, edgesInCone
}

// FindAllPaths trouve tous les chemins dans le graphe
func (ga *GraphAnalyzer) FindAllPaths(notes map[string][]string) [][]string {
	adj := ga.buildAdjacencyList(notes)
	allNodes := ga.extractAllNodes(adj)

	var allPaths [][]string
	nodesList := make([]string, 0, len(allNodes))
	for node := range allNodes {
		nodesList = append(nodesList, node)
	}

	// Trouver tous les chemins entre paires de nœuds
	for i := 0; i < len(nodesList); i++ {
		for j := i + 1; j < len(nodesList); j++ {
			startNode, endNode := nodesList[i], nodesList[j]

			if path := ga.findPath(startNode, endNode, adj); len(path) > 2 {
				allPaths = append(allPaths, path)
			}
		}
	}

	return allPaths
}

// DetectTemporalPatterns détecte les patterns temporels dans les notes
func (ga *GraphAnalyzer) DetectTemporalPatterns(notes map[string][]string) []models.TemporalPattern {
	temporalMarkers := map[string]string{
		"avant":     "précède",
		"après":     "suit",
		"puis":      "puis",
		"ensuite":   "ensuite",
		"pendant":   "pendant",
		"durant":    "durant",
		"alors que": "en parallèle de",
		"jusqu'à":   "jusqu'à",
		"depuis":    "depuis",
		"vers":      "vers",
		"à":         "à",
		"lorsque":   "au moment où",
		"quand":     "quand",
		"lendemain": "suit",
		"veille":    "précède",
		"soirée":    "pendant",
		"matin":     "au début de",
		"soir":      "à la fin de",
	}

	var patterns []models.TemporalPattern
	detectedPhrases := make(map[string]bool)

	// Analyser toutes les notes
	for _, notesList := range notes {
		for _, note := range notesList {
			cleanNote := strings.TrimSpace(note)
			lowerNote := strings.ToLower(cleanNote)

			for marker, relation := range temporalMarkers {
				if strings.Contains(lowerNote, marker) && !detectedPhrases[cleanNote] {
					detectedPhrases[cleanNote] = true
					suggestions := ga.analyzeTemporalContext(cleanNote, marker, relation)

					pattern := models.TemporalPattern{
						Pattern:     marker,
						Occurrences: []string{cleanNote},
						Suggestions: suggestions,
					}

					// Ajouter ou fusionner le pattern
					ga.mergeOrAddPattern(&patterns, pattern)
				}
			}
		}
	}

	// Détecter les heures et dates
	ga.detectTimeAndDatePatterns(notes, &patterns)

	return patterns
}

// CheckSemanticConsistency vérifie la cohérence sémantique du graphe
func (ga *GraphAnalyzer) CheckSemanticConsistency(graphData models.GraphData) []models.Inconsistency {
	var inconsistencies []models.Inconsistency

	// 1. Détecter les cycles temporels
	if cycles := ga.detectTemporalCycles(graphData); len(cycles) > 0 {
		inconsistencies = append(inconsistencies, cycles...)
	}

	// 2. Détecter les relations contradictoires
	if contradictions := ga.detectContradictoryRelations(graphData); len(contradictions) > 0 {
		inconsistencies = append(inconsistencies, contradictions...)
	}

	// 3. Détecter les équivalences incohérentes
	if incEquiv := ga.detectInconsistentEquivalences(graphData); len(incEquiv) > 0 {
		inconsistencies = append(inconsistencies, incEquiv...)
	}

	// 4. Détecter les nœuds orphelins suspects
	if orphans := ga.detectImportantOrphans(graphData); len(orphans) > 0 {
		inconsistencies = append(inconsistencies, orphans...)
	}

	// 5. Détecter les groupes incohérents
	if groups := ga.detectDisconnectedGroups(graphData); len(groups) > 0 {
		inconsistencies = append(inconsistencies, groups...)
	}

	return inconsistencies
}

// GenerateInvestigationQuestions génère des questions d'investigation
func (ga *GraphAnalyzer) GenerateInvestigationQuestions(graphData models.GraphData) []models.InvestigationQuestion {
	var questions []models.InvestigationQuestion

	// Analyser les nœuds orphelins
	orphans := ga.findOrphanNodes(graphData)
	for _, orphan := range orphans {
		importance := ga.calculateNodeImportance(orphan, graphData)
		if importance > 0.5 {
			questions = append(questions, models.InvestigationQuestion{
				Question: fmt.Sprintf("Comment '%s' est-il lié aux autres éléments ?", orphan),
				Type:     "orphan",
				Priority: ga.getPriorityFromImportance(importance),
				Context:  "Connexions manquantes",
				Nodes:    []string{orphan},
				Hint:     "Cet élément semble isolé. Cherchez des relations possibles.",
			})
		}
	}

	// Analyser les patterns incomplets
	patterns := ga.analyzeGraphPatterns(graphData)
	questions = append(questions, patterns...)

	// Analyser les clusters déconnectés
	clusters := ga.findDisconnectedClusters(graphData)
	for _, cluster := range clusters {
		if len(cluster) > 1 {
			questions = append(questions, models.InvestigationQuestion{
				Question: fmt.Sprintf("Quelle connexion existe entre ces groupes : %s ?", strings.Join(cluster[:2], " et ")),
				Type:     "missing_link",
				Priority: "medium",
				Context:  "Groupes isolés",
				Nodes:    cluster,
				Hint:     "Ces éléments forment des groupes séparés qui pourraient être liés.",
			})
		}
	}

	// Trier par priorité
	sort.Slice(questions, func(i, j int) bool {
		priorityOrder := map[string]int{"high": 0, "medium": 1, "low": 2}
		return priorityOrder[questions[i].Priority] < priorityOrder[questions[j].Priority]
	})

	if len(questions) > 10 {
		questions = questions[:10]
	}

	return questions
}

// GetLayeredGraph organise le graphe en couches
func (ga *GraphAnalyzer) GetLayeredGraph(graphData models.GraphData) models.LayeredGraph {
	layers := map[string]models.Layer{
		"actors": {
			Y:     0,
			Color: "#3b82f6",
			Label: "Acteurs",
		},
		"locations": {
			Y:     200,
			Color: "#10b981",
			Label: "Lieux",
		},
		"events": {
			Y:     400,
			Color: "#f59e0b",
			Label: "Événements",
		},
		"evidence": {
			Y:     600,
			Color: "#ef4444",
			Label: "Preuves",
		},
		"concepts": {
			Y:     800,
			Color: "#8b5cf6",
			Label: "Concepts",
		},
	}

	var layeredNodes []models.LayeredNode
	nodeLayerCount := make(map[string]int)

	for _, node := range graphData.Nodes {
		layer := ga.classifyNodeLayer(node.Label, node.Context)
		nodeLayerCount[layer]++

		xOffset := nodeLayerCount[layer] * 150

		layeredNode := models.LayeredNode{
			ID:      node.ID,
			Label:   node.Label,
			Context: node.Context,
			Layer:   layer,
			X:       float64(xOffset),
			Y:       float64(layers[layer].Y),
			Color:   layers[layer].Color,
			Shape:   ga.getNodeShape(layer),
			Size:    ga.calculateNodeSize(node, graphData.Edges),
		}

		layeredNodes = append(layeredNodes, layeredNode)
	}

	// Centrer chaque couche
	ga.centerLayers(&layeredNodes, nodeLayerCount)

	return models.LayeredGraph{
		Nodes:  layeredNodes,
		Edges:  graphData.Edges,
		Layers: layers,
	}
}

// GetTimelineEvents extrait les événements chronologiques
func (ga *GraphAnalyzer) GetTimelineEvents(notes map[string][]string) []models.TimelineEvent {
	var events []models.TimelineEvent
	eventMap := make(map[string]models.TimelineEvent)

	timeRegexes := map[string]int{
		`soirée`:    1,
		`22h`:       2,
		`lendemain`: 3,
	}

	for _, notesList := range notes {
		for _, note := range notesList {
			for pattern, order := range timeRegexes {
				re := regexp.MustCompile(pattern)
				if re.MatchString(note) {
					if _, exists := eventMap[note]; !exists {
						eventMap[note] = models.TimelineEvent{
							Order:       order,
							TimeHint:    pattern,
							Description: note,
						}
					}
				}
			}
		}
	}

	for _, event := range eventMap {
		events = append(events, event)
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].Order < events[j].Order
	})

	return events
}

// --- Méthodes privées ---

func (ga *GraphAnalyzer) buildAdjacencyList(notes map[string][]string) map[string][]string {
	adj := make(map[string][]string)
	relationRegex := regexp.MustCompile(`^(.*) -> (.*) -> (.*)$`)
	equivalenceRegex := regexp.MustCompile(`^(.*) <-> (.*)$`)
	groupRegex := regexp.MustCompile(`^(.*) => {(.*)}$`)

	for _, notesList := range notes {
		for _, note := range notesList {
			if matches := relationRegex.FindStringSubmatch(note); len(matches) == 4 {
				source, target := strings.TrimSpace(matches[1]), strings.TrimSpace(matches[3])
				adj[source] = append(adj[source], target)
				adj[target] = append(adj[target], source)
			} else if matches := equivalenceRegex.FindStringSubmatch(note); len(matches) == 3 {
				source, target := strings.TrimSpace(matches[1]), strings.TrimSpace(matches[2])
				adj[source] = append(adj[source], target)
				adj[target] = append(adj[target], source)
			} else if matches := groupRegex.FindStringSubmatch(note); len(matches) == 3 {
				parent := strings.TrimSpace(matches[1])
				children := strings.Split(matches[2], ";")
				for _, child := range children {
					childName := strings.TrimSpace(child)
					adj[parent] = append(adj[parent], childName)
					adj[childName] = append(adj[childName], parent)
				}
			}
		}
	}

	return adj
}

func (ga *GraphAnalyzer) extractAllNodes(adj map[string][]string) map[string]bool {
	allNodes := make(map[string]bool)
	for node := range adj {
		allNodes[node] = true
		for _, neighbor := range adj[node] {
			allNodes[neighbor] = true
		}
	}
	return allNodes
}

func (ga *GraphAnalyzer) findPath(start, end string, adj map[string][]string) []string {
	queue := [][]string{{start}}
	visited := make(map[string]bool)
	visited[start] = true

	for len(queue) > 0 {
		path := queue[0]
		queue = queue[1:]
		node := path[len(path)-1]

		if node == end {
			return path
		}

		for _, neighbor := range adj[node] {
			if !visited[neighbor] {
				visited[neighbor] = true
				newPath := make([]string, len(path))
				copy(newPath, path)
				newPath = append(newPath, neighbor)
				queue = append(queue, newPath)
			}
		}
	}

	return nil
}

func (ga *GraphAnalyzer) analyzeTemporalContext(text, marker, relation string) []string {
	var suggestions []string
	cleanText := strings.TrimSpace(text)
	relationRegex := regexp.MustCompile(`^(.*) -> (.*) -> (.*)$`)

	if matches := relationRegex.FindStringSubmatch(cleanText); len(matches) == 4 {
		source := strings.TrimSpace(matches[1])
		target := strings.TrimSpace(matches[3])
		suggestions = append(suggestions, fmt.Sprintf("%s -> %s -> %s", source, relation, target))
		suggestions = append(suggestions, fmt.Sprintf("Ajouter au contexte 'Chronologie': %s", cleanText))
		return suggestions
	}

	lowerText := strings.ToLower(text)
	markerIndex := strings.Index(lowerText, marker)

	if markerIndex > 0 {
		beforeMarker := text[:markerIndex]
		afterMarker := text[markerIndex+len(marker):]

		beforeWords := ga.extractSignificantWords(beforeMarker)
		afterWords := ga.extractSignificantWords(afterMarker)

		if len(beforeWords) > 0 && len(afterWords) > 0 {
			subject := beforeWords[len(beforeWords)-1]
			object := afterWords[0]
			suggestion := fmt.Sprintf("%s -> %s -> %s", subject, relation, object)
			suggestions = append(suggestions, suggestion)
		}
	}

	suggestions = append(suggestions, fmt.Sprintf("Annoter comme événement temporel avec '%s'", marker))
	suggestions = append(suggestions, fmt.Sprintf("Ajouter au contexte 'Chronologie': %s", text))

	return suggestions
}

func (ga *GraphAnalyzer) extractSignificantWords(text string) []string {
	var significant []string
	words := strings.Fields(text)
	commonWords := []string{"les", "une", "des", "dans", "sur", "avec", "pour", "par"}

	for _, word := range words {
		word = strings.Trim(word, ".,;:!?()[]{}\"'")
		if len(word) < 3 {
			continue
		}

		isCommon := false
		for _, common := range commonWords {
			if strings.ToLower(word) == common {
				isCommon = true
				break
			}
		}

		if !isCommon {
			significant = append(significant, word)
		}
	}

	return significant
}

func (ga *GraphAnalyzer) mergeOrAddPattern(patterns *[]models.TemporalPattern, newPattern models.TemporalPattern) {
	for i, p := range *patterns {
		if p.Pattern == newPattern.Pattern {
			(*patterns)[i].Occurrences = append((*patterns)[i].Occurrences, newPattern.Occurrences...)
			for _, sug := range newPattern.Suggestions {
				if !ga.contains((*patterns)[i].Suggestions, sug) {
					(*patterns)[i].Suggestions = append((*patterns)[i].Suggestions, sug)
				}
			}
			return
		}
	}
	*patterns = append(*patterns, newPattern)
}

func (ga *GraphAnalyzer) detectTimeAndDatePatterns(notes map[string][]string, patterns *[]models.TemporalPattern) {
	timeRegex := regexp.MustCompile(`(\d{1,2}h\d{0,2}|\d{1,2}:\d{2})`)
	dateRegex := regexp.MustCompile(`(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|lendemain|veille|matin|soir|soirée|midi|minuit)`)

	for _, notesList := range notes {
		for _, note := range notesList {
			cleanNote := strings.TrimSpace(note)

			// Détecter les heures
			if timeMatches := timeRegex.FindAllString(cleanNote, -1); len(timeMatches) > 0 {
				for _, timeMatch := range timeMatches {
					suggestions := []string{
						fmt.Sprintf("Créer un événement temporel à %s", timeMatch),
					}

					if subject := ExtractFirstSubject(cleanNote); subject != "" {
						suggestions = append(suggestions, fmt.Sprintf("%s -> se passe à -> %s", subject, timeMatch))
					}

					pattern := models.TemporalPattern{
						Pattern:     "heure",
						Occurrences: []string{cleanNote},
						Suggestions: suggestions,
					}
					ga.mergeOrAddPattern(patterns, pattern)
				}
			}

			// Détecter les dates
			if dateMatches := dateRegex.FindAllString(cleanNote, -1); len(dateMatches) > 0 {
				for _, dateMatch := range dateMatches {
					suggestions := []string{
						fmt.Sprintf("Marquer '%s' comme repère temporel", dateMatch),
					}

					if subject := ExtractFirstSubject(cleanNote); subject != "" {
						suggestions = append(suggestions, fmt.Sprintf("%s -> a lieu le -> %s", subject, dateMatch))
					}

					pattern := models.TemporalPattern{
						Pattern:     "date/moment",
						Occurrences: []string{cleanNote},
						Suggestions: suggestions,
					}
					ga.mergeOrAddPattern(patterns, pattern)
				}
			}
		}
	}
}

func (ga *GraphAnalyzer) detectTemporalCycles(graphData models.GraphData) []models.Inconsistency {
	var inconsistencies []models.Inconsistency
	temporalEdges := make(map[string][]models.Edge)

	for _, edge := range graphData.Edges {
		if edge.Type == "relation" {
			lowerLabel := strings.ToLower(edge.Label)
			if strings.Contains(lowerLabel, "précède") || strings.Contains(lowerLabel, "avant") ||
				strings.Contains(lowerLabel, "puis") || strings.Contains(lowerLabel, "ensuite") {
				temporalEdges[edge.From] = append(temporalEdges[edge.From], edge)
			}
		}
	}

	visited := make(map[string]bool)
	recStack := make(map[string]bool)

	var detectCycle func(node string, path []string) []string
	detectCycle = func(node string, path []string) []string {
		visited[node] = true
		recStack[node] = true
		path = append(path, node)

		for _, edge := range temporalEdges[node] {
			if !visited[edge.To] {
				if cycle := detectCycle(edge.To, path); cycle != nil {
					return cycle
				}
			} else if recStack[edge.To] {
				cycleStart := -1
				for i, n := range path {
					if n == edge.To {
						cycleStart = i
						break
					}
				}
				if cycleStart >= 0 {
					return append(path[cycleStart:], edge.To)
				}
			}
		}

		recStack[node] = false
		return nil
	}

	for node := range temporalEdges {
		if !visited[node] {
			if cycle := detectCycle(node, []string{}); cycle != nil {
				inconsistencies = append(inconsistencies, models.Inconsistency{
					Type:        "temporal_cycle",
					Description: fmt.Sprintf("Boucle temporelle détectée : %s", strings.Join(cycle, " → ")),
					Nodes:       cycle,
					Severity:    "error",
					Suggestion:  "Vérifiez l'ordre chronologique des événements. Un événement ne peut pas précéder et suivre le même élément.",
				})
				break
			}
		}
	}

	return inconsistencies
}

func (ga *GraphAnalyzer) detectContradictoryRelations(graphData models.GraphData) []models.Inconsistency {
	var inconsistencies []models.Inconsistency
	relationMap := make(map[string]map[string][]string)

	for _, edge := range graphData.Edges {
		if edge.Type == "relation" {
			if relationMap[edge.From] == nil {
				relationMap[edge.From] = make(map[string][]string)
			}
			relationMap[edge.From][edge.To] = append(relationMap[edge.From][edge.To], edge.Label)
		}
	}

	contradictoryPairs := map[string]string{
		"cause":     "empêche",
		"contient":  "exclut",
		"précède":   "suit",
		"identique": "différent",
		"ami":       "ennemi",
	}

	for from, targets := range relationMap {
		for to, labels := range targets {
			for i, label1 := range labels {
				for j, label2 := range labels {
					if i < j {
						l1Lower := strings.ToLower(label1)
						l2Lower := strings.ToLower(label2)

						for word1, word2 := range contradictoryPairs {
							if (strings.Contains(l1Lower, word1) && strings.Contains(l2Lower, word2)) ||
								(strings.Contains(l1Lower, word2) && strings.Contains(l2Lower, word1)) {
								inconsistencies = append(inconsistencies, models.Inconsistency{
									Type:        "contradictory_relations",
									Description: fmt.Sprintf("%s a des relations contradictoires avec %s : '%s' et '%s'", from, to, label1, label2),
									Nodes:       []string{from, to},
									Severity:    "warning",
									Suggestion:  "Clarifiez la nature de la relation entre ces éléments.",
								})
							}
						}
					}
				}
			}
		}
	}

	return inconsistencies
}

func (ga *GraphAnalyzer) detectInconsistentEquivalences(graphData models.GraphData) []models.Inconsistency {
	var inconsistencies []models.Inconsistency
	equivalenceGroups := make(map[string][]string)

	for _, edge := range graphData.Edges {
		if edge.Type == "equivalence" {
			found := false
			for key, group := range equivalenceGroups {
				if ga.contains(group, edge.From) || ga.contains(group, edge.To) {
					if !ga.contains(group, edge.From) {
						equivalenceGroups[key] = append(group, edge.From)
					}
					if !ga.contains(group, edge.To) {
						equivalenceGroups[key] = append(group, edge.To)
					}
					found = true
					break
				}
			}
			if !found {
				equivalenceGroups[edge.From] = []string{edge.From, edge.To}
			}
		}
	}

	for _, group := range equivalenceGroups {
		if len(group) > 1 {
			relationsPerNode := make(map[string]map[string]bool)
			for _, node := range group {
				relationsPerNode[node] = make(map[string]bool)
				for _, edge := range graphData.Edges {
					if edge.From == node && edge.Type == "relation" {
						relationsPerNode[node][edge.To+":"+edge.Label] = true
					}
				}
			}

			for i := 0; i < len(group)-1; i++ {
				for j := i + 1; j < len(group); j++ {
					node1, node2 := group[i], group[j]
					diff := 0
					for rel := range relationsPerNode[node1] {
						if !relationsPerNode[node2][rel] {
							diff++
						}
					}
					for rel := range relationsPerNode[node2] {
						if !relationsPerNode[node1][rel] {
							diff++
						}
					}

					if diff > 2 {
						inconsistencies = append(inconsistencies, models.Inconsistency{
							Type:        "inconsistent_equivalence",
							Description: fmt.Sprintf("%s et %s sont marqués comme équivalents mais ont des relations très différentes", node1, node2),
							Nodes:       []string{node1, node2},
							Severity:    "info",
							Suggestion:  "Vérifiez si ces éléments sont vraiment équivalents ou s'il s'agit d'une relation différente.",
						})
					}
				}
			}
		}
	}

	return inconsistencies
}

func (ga *GraphAnalyzer) detectImportantOrphans(graphData models.GraphData) []models.Inconsistency {
	var inconsistencies []models.Inconsistency
	connectedNodes := make(map[string]bool)

	for _, edge := range graphData.Edges {
		connectedNodes[edge.From] = true
		connectedNodes[edge.To] = true
	}

	for _, node := range graphData.Nodes {
		if !connectedNodes[node.ID] {
			if ga.isLikelyImportant(node.Label) {
				inconsistencies = append(inconsistencies, models.Inconsistency{
					Type:        "orphan_node",
					Description: fmt.Sprintf("'%s' semble important mais n'a aucune connexion", node.Label),
					Nodes:       []string{node.ID},
					Severity:    "info",
					Suggestion:  "Considérez ajouter des relations pour connecter cet élément au reste du graphe.",
				})
			}
		}
	}

	return inconsistencies
}

func (ga *GraphAnalyzer) detectDisconnectedGroups(graphData models.GraphData) []models.Inconsistency {
	var inconsistencies []models.Inconsistency

	for _, edge := range graphData.Edges {
		if edge.Type == "group" {
			groupMembers := []string{}
			for _, e := range graphData.Edges {
				if e.Type == "group" && e.From == edge.From {
					groupMembers = append(groupMembers, e.To)
				}
			}

			if len(groupMembers) > 2 {
				hasInternalRelations := false
				for _, m1 := range groupMembers {
					for _, m2 := range groupMembers {
						if m1 != m2 {
							for _, e := range graphData.Edges {
								if (e.From == m1 && e.To == m2) || (e.From == m2 && e.To == m1) {
									hasInternalRelations = true
									break
								}
							}
						}
					}
				}

				if !hasInternalRelations && len(groupMembers) > 3 {
					inconsistencies = append(inconsistencies, models.Inconsistency{
						Type:        "disconnected_group",
						Description: fmt.Sprintf("Le groupe '%s' contient des éléments sans relations entre eux", edge.From),
						Nodes:       append([]string{edge.From}, groupMembers...),
						Severity:    "info",
						Suggestion:  "Les membres d'un groupe devraient avoir des relations ou propriétés communes.",
					})
				}
			}
		}
	}

	return inconsistencies
}

func (ga *GraphAnalyzer) findOrphanNodes(graphData models.GraphData) []string {
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

func (ga *GraphAnalyzer) calculateNodeImportance(nodeID string, graphData models.GraphData) float64 {
	var node models.Node
	for _, n := range graphData.Nodes {
		if n.ID == nodeID {
			node = n
			break
		}
	}

	importance := 0.3 // Base

	if len(node.Label) > 0 && unicode.IsUpper(rune(node.Label[0])) {
		importance += 0.3
	}

	if len(node.Label) > 10 {
		importance += 0.2
	}

	if node.Context != "" && node.Context != "general" {
		importance += 0.2
	}

	return importance
}

func (ga *GraphAnalyzer) getPriorityFromImportance(importance float64) string {
	if importance > 0.7 {
		return "high"
	} else if importance > 0.5 {
		return "medium"
	}
	return "low"
}

func (ga *GraphAnalyzer) analyzeGraphPatterns(graphData models.GraphData) []models.InvestigationQuestion {
	var questions []models.InvestigationQuestion
	nodeTypes := ga.classifyNodesByConnections(graphData)

	for _, nodes := range nodeTypes {
		if len(nodes) > 0 {
			avgConnections := ga.calculateAverageConnections(nodes, graphData)

			for _, node := range nodes {
				connections := ga.countNodeConnections(node, graphData)
				if float64(connections) < avgConnections*0.5 {
					questions = append(questions, models.InvestigationQuestion{
						Question: fmt.Sprintf("Pourquoi '%s' a-t-il moins de connexions que les autres éléments similaires ?", node),
						Type:     "pattern",
						Priority: "medium",
						Context:  "Pattern incomplet",
						Nodes:    []string{node},
						Hint:     fmt.Sprintf("Cet élément a %d connexions alors que la moyenne est %.1f", connections, avgConnections),
					})
				}
			}
		}
	}

	return questions
}

func (ga *GraphAnalyzer) classifyNodesByConnections(graphData models.GraphData) map[string][]string {
	classified := make(map[string][]string)

	for _, node := range graphData.Nodes {
		pattern := ga.getConnectionPattern(node.ID, graphData)
		classified[pattern] = append(classified[pattern], node.ID)
	}

	return classified
}

func (ga *GraphAnalyzer) getConnectionPattern(nodeID string, graphData models.GraphData) string {
	inCount := 0
	outCount := 0

	for _, edge := range graphData.Edges {
		if edge.To == nodeID {
			inCount++
		}
		if edge.From == nodeID {
			outCount++
		}
	}

	if inCount > outCount*2 {
		return "receiver"
	} else if outCount > inCount*2 {
		return "emitter"
	} else if inCount+outCount > 5 {
		return "hub"
	} else if inCount+outCount == 0 {
		return "isolated"
	}
	return "standard"
}

func (ga *GraphAnalyzer) findDisconnectedClusters(graphData models.GraphData) [][]string {
	visited := make(map[string]bool)
	var clusters [][]string

	for _, node := range graphData.Nodes {
		if !visited[node.ID] {
			cluster := []string{}
			ga.dfs(node.ID, graphData, visited, &cluster)
			if len(cluster) > 0 {
				clusters = append(clusters, cluster)
			}
		}
	}

	return clusters
}

func (ga *GraphAnalyzer) dfs(nodeID string, graphData models.GraphData, visited map[string]bool, cluster *[]string) {
	visited[nodeID] = true
	*cluster = append(*cluster, nodeID)

	for _, edge := range graphData.Edges {
		if edge.From == nodeID && !visited[edge.To] {
			ga.dfs(edge.To, graphData, visited, cluster)
		}
		if edge.To == nodeID && !visited[edge.From] {
			ga.dfs(edge.From, graphData, visited, cluster)
		}
	}
}

func (ga *GraphAnalyzer) calculateAverageConnections(nodes []string, graphData models.GraphData) float64 {
	if len(nodes) == 0 {
		return 0
	}

	total := 0
	for _, node := range nodes {
		total += ga.countNodeConnections(node, graphData)
	}

	return float64(total) / float64(len(nodes))
}

func (ga *GraphAnalyzer) countNodeConnections(nodeID string, graphData models.GraphData) int {
	count := 0
	for _, edge := range graphData.Edges {
		if edge.From == nodeID || edge.To == nodeID {
			count++
		}
	}
	return count
}

func (ga *GraphAnalyzer) classifyNodeLayer(label, context string) string {
	lowerLabel := strings.ToLower(label)
	lowerContext := strings.ToLower(context)

	// Détecter les acteurs (personnes)
	if unicode.IsUpper(rune(label[0])) && !strings.Contains(lowerLabel, " ") {
		return "actors"
	}
	if strings.Contains(lowerContext, "personnage") || strings.Contains(lowerContext, "suspect") ||
		strings.Contains(lowerLabel, "victime") || strings.Contains(lowerLabel, "témoin") ||
		strings.Contains(lowerLabel, "enquêteur") || strings.Contains(lowerLabel, "detective") {
		return "actors"
	}

	// Détecter les lieux
	if strings.Contains(lowerContext, "lieu") || strings.Contains(lowerLabel, "scène") ||
		strings.Contains(lowerLabel, "maison") || strings.Contains(lowerLabel, "bureau") ||
		strings.Contains(lowerLabel, "bibliothèque") || strings.Contains(lowerLabel, "manoir") ||
		strings.Contains(lowerLabel, "jardin") || strings.Contains(lowerLabel, "rue") {
		return "locations"
	}

	// Détecter les événements
	if strings.Contains(lowerContext, "chronologie") || strings.Contains(lowerContext, "timeline") ||
		strings.Contains(lowerLabel, "arrivé") || strings.Contains(lowerLabel, "découvert") ||
		strings.Contains(lowerLabel, "rencontré") || strings.Contains(lowerLabel, "heure") ||
		strings.Contains(lowerLabel, "moment") || strings.Contains(lowerLabel, "avant") ||
		strings.Contains(lowerLabel, "après") {
		return "events"
	}

	// Détecter les preuves
	if strings.Contains(lowerContext, "preuve") || strings.Contains(lowerContext, "indice") ||
		strings.Contains(lowerLabel, "document") || strings.Contains(lowerLabel, "trace") ||
		strings.Contains(lowerLabel, "empreinte") || strings.Contains(lowerLabel, "tasse") ||
		strings.Contains(lowerLabel, "livre") || strings.Contains(lowerLabel, "lettre") {
		return "evidence"
	}

	// Par défaut, concepts
	return "concepts"
}

func (ga *GraphAnalyzer) getNodeShape(layer string) string {
	switch layer {
	case "actors":
		return "circle"
	case "locations":
		return "square"
	case "events":
		return "diamond"
	case "evidence":
		return "triangle"
	default:
		return "box"
	}
}

func (ga *GraphAnalyzer) calculateNodeSize(node models.Node, edges []models.Edge) int {
	connections := 0
	for _, edge := range edges {
		if edge.From == node.ID || edge.To == node.ID {
			connections++
		}
	}
	baseSize := 25
	return baseSize + (connections * 3)
}

func (ga *GraphAnalyzer) centerLayers(nodes *[]models.LayeredNode, nodeLayerCount map[string]int) {
	for layer, count := range nodeLayerCount {
		if count > 0 {
			totalWidth := count * 150
			startX := -totalWidth / 2

			currentCount := 0
			for i := range *nodes {
				if (*nodes)[i].Layer == layer {
					(*nodes)[i].X = float64(startX + currentCount*150)
					currentCount++
				}
			}
		}
	}
}

func (ga *GraphAnalyzer) isLikelyImportant(label string) bool {
	if len(label) < 3 {
		return false
	}

	if unicode.IsUpper(rune(label[0])) {
		return true
	}

	importantKeywords := []string{"principal", "important", "clé", "central", "critique", "essentiel"}
	lowerLabel := strings.ToLower(label)
	for _, keyword := range importantKeywords {
		if strings.Contains(lowerLabel, keyword) {
			return true
		}
	}

	return false
}

func (ga *GraphAnalyzer) contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
