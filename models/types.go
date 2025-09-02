package models

import "time"

// OllamaRequest représente une requête vers l'API Ollama
type OllamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
	Format string `json:"format,omitempty"`
}

// OllamaResponse représente la réponse de l'API Ollama
type OllamaResponse struct {
	Response string `json:"response"`
}

// GraphData contient les nœuds et arêtes du graphe
type GraphData struct {
	Nodes     []Node              `json:"nodes"`
	Edges     []Edge              `json:"edges"`
	Positions map[string]Position `json:"positions,omitempty"`
}

// Node représente un nœud dans le graphe
type Node struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Context string `json:"context"`
}

// Edge représente une arête dans le graphe
type Edge struct {
	ID      string `json:"id"`
	From    string `json:"from"`
	To      string `json:"to"`
	Label   string `json:"label"`
	Type    string `json:"type"` // "relation", "equivalence", "group"
	Context string `json:"context"`
}

// ParsedN4L contient les données parsées d'un fichier N4L
type ParsedN4L struct {
	Subjects []string            `json:"subjects"`
	Notes    map[string][]string `json:"notes"`
}

// TimelineEvent représente un événement chronologique
type TimelineEvent struct {
	Order       int    `json:"order"`
	TimeHint    string `json:"timeHint"`
	Description string `json:"description"`
}

// AnalyzePathRequest pour l'analyse de chemins
type AnalyzePathRequest struct {
	Path  []string            `json:"path"`
	Notes map[string][]string `json:"notes"`
}

// InvestigationQuestion représente une question d'investigation
type InvestigationQuestion struct {
	Question string   `json:"question"`
	Type     string   `json:"type"`
	Priority string   `json:"priority"`
	Context  string   `json:"context"`
	Nodes    []string `json:"nodes"`
	Hint     string   `json:"hint"`
}

// InvestigationStep représente une étape du mode enquête
type InvestigationStep struct {
	Question    string   `json:"question"`
	Suggestions []string `json:"suggestions"`
	ActionType  string   `json:"actionType"` // "subjects", "relations", "groups"
	NextStep    string   `json:"nextStep"`
	Tips        string   `json:"tips"`
}

// InvestigationProgress suit le progrès de l'enquête
type InvestigationProgress struct {
	ActorsCount    int
	LocationsCount int
	EvidenceCount  int
	RelationsCount int
	IsolatedNodes  int
}

// TemporalPattern représente un pattern temporel détecté
type TemporalPattern struct {
	Pattern     string   `json:"pattern"`
	Occurrences []string `json:"occurrences"`
	Suggestions []string `json:"suggestions"`
}

// Inconsistency représente une incohérence détectée
type Inconsistency struct {
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Nodes       []string `json:"nodes"`
	Severity    string   `json:"severity"` // "error", "warning", "info"
	Suggestion  string   `json:"suggestion"`
}

// LayeredNode pour la vue en couches
type LayeredNode struct {
	ID      string  `json:"id"`
	Label   string  `json:"label"`
	Context string  `json:"context"`
	Layer   string  `json:"layer"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	Color   string  `json:"color"`
	Shape   string  `json:"shape"`
	Size    int     `json:"size"`
}

// LayeredGraph représente un graphe organisé en couches
type LayeredGraph struct {
	Nodes  []LayeredNode    `json:"nodes"`
	Edges  []Edge           `json:"edges"`
	Layers map[string]Layer `json:"layers"`
}

// Layer représente une couche dans le graphe
type Layer struct {
	Y     int    `json:"y"`
	Color string `json:"color"`
	Label string `json:"label"`
}

// ========== TYPES POUR LE VERSIONING SÉMANTIQUE ==========

// SemanticVersion représente une version sémantique du graphe
type SemanticVersion struct {
	ID             string           `json:"id"`
	Timestamp      time.Time        `json:"timestamp"`
	GraphHash      string           `json:"graphHash"`
	GraphData      GraphData        `json:"graphData"`
	Changes        []SemanticChange `json:"changes"`
	Insights       []string         `json:"insights"`
	Confidence     float64          `json:"confidence"`
	Description    string           `json:"description"`
	Tags           []string         `json:"tags"`
	Metrics        GraphMetrics     `json:"metrics"`
	IsEurekaMoment bool             `json:"isEurekaMoment"`
	IsRestore      bool             `json:"isRestore"`
	RestoredFrom   string           `json:"restoredFrom,omitempty"`
}

// SemanticChange représente un changement sémantique
type SemanticChange struct {
	Type        string `json:"type"` // node_added, edge_added, node_removed, edge_removed, structural_change
	ElementID   string `json:"elementId,omitempty"`
	Description string `json:"description"`
	Impact      string `json:"impact"` // low, medium, high
}

// GraphMetrics contient des métriques sur l'état du graphe
type GraphMetrics struct {
	NodeCount       int     `json:"nodeCount"`
	EdgeCount       int     `json:"edgeCount"`
	Density         float64 `json:"density"`
	Components      int     `json:"components"`
	AverageDegree   float64 `json:"averageDegree"`
	OrphanNodes     int     `json:"orphanNodes"`
	MaxPathLength   int     `json:"maxPathLength"`
	ClusteringCoeff float64 `json:"clusteringCoeff"`
}

// SaveVersionRequest est la structure pour une requête de sauvegarde de version
type SaveVersionRequest struct {
	GraphData         GraphData `json:"graphData"`
	PreviousGraphData GraphData `json:"previousGraphData"`
	Description       string    `json:"description"`
}

// RestoreVersionRequest est la structure pour une requête de restauration
type RestoreVersionRequest struct {
	VersionID string `json:"versionId"`
}

// CompareVersionsRequest est la structure pour comparer deux versions
type CompareVersionsRequest struct {
	Version1ID string `json:"version1Id"`
	Version2ID string `json:"version2Id"`
}

// DeleteVersionRequest est la structure pour une requête de suppression de version
type DeleteVersionRequest struct {
	VersionID string `json:"versionId"`
}

// VersionComparison résultat de comparaison
type VersionComparison struct {
	Version1     SemanticVersion `json:"version1"`
	Version2     SemanticVersion `json:"version2"`
	AddedNodes   []Node          `json:"addedNodes"`
	RemovedNodes []Node          `json:"removedNodes"`
	AddedEdges   []Edge          `json:"addedEdges"`
	RemovedEdges []Edge          `json:"removedEdges"`
	MetricsDelta MetricsDelta    `json:"metricsDelta"`
}

// MetricsDelta différence entre métriques
type MetricsDelta struct {
	NodeCountDelta  int     `json:"nodeCountDelta"`
	EdgeCountDelta  int     `json:"edgeCountDelta"`
	DensityDelta    float64 `json:"densityDelta"`
	ComponentsDelta int     `json:"componentsDelta"`
}

// EvolutionEvent événement dans la timeline d'évolution
type EvolutionEvent struct {
	Timestamp         time.Time    `json:"timestamp"`
	VersionID         string       `json:"versionId"`
	Type              string       `json:"type"` // minor, major, massive, eureka, restore, checkpoint
	Description       string       `json:"description"`
	Impact            string       `json:"impact"`
	Metrics           GraphMetrics `json:"metrics"`
	Insights          []string     `json:"insights,omitempty"`
	DeltaFromPrevious VersionDelta `json:"deltaFromPrevious,omitempty"`
}

// VersionDelta différence entre versions
type VersionDelta struct {
	TimeElapsed     time.Duration `json:"timeElapsed"`
	ChangesCount    int           `json:"changesCount"`
	ConfidenceDelta float64       `json:"confidenceDelta"`
}

// DensityMap représente la carte de densité du graphe
type DensityMap struct {
	Zones         []DensityZone  `json:"zones"`
	HeatmapData   []HeatmapPoint `json:"heatmapData"`
	GlobalDensity float64        `json:"globalDensity"`
	EmptyZones    []EmptyZone    `json:"emptyZones"`
}

// DensityZone représente une zone de densité
type DensityZone struct {
	Nodes   []string `json:"nodes"`
	CenterX float64  `json:"centerX"`
	CenterY float64  `json:"centerY"`
	Radius  float64  `json:"radius"`
	Density float64  `json:"density"`
	Type    string   `json:"type"` // "high", "medium", "low"
	Color   string   `json:"color"`
}

// HeatmapPoint représente un point dans la heatmap
type HeatmapPoint struct {
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Intensity float64 `json:"intensity"`
	NodeID    string  `json:"nodeId"`
	NodeLabel string  `json:"nodeLabel"`
}

// EmptyZone représente une zone vide (territoire inexploré)
type EmptyZone struct {
	X                 float64  `json:"x"`
	Y                 float64  `json:"y"`
	Radius            float64  `json:"radius"`
	SuggestedConcepts []string `json:"suggestedConcepts"`
}

// ConceptualTerritories représente les territoires conceptuels
type ConceptualTerritories struct {
	Explored   []Territory `json:"explored"`
	Unexplored []Territory `json:"unexplored"`
	Frontier   []Territory `json:"frontier"`
}

// Territory représente un territoire conceptuel
type Territory struct {
	ID          int              `json:"id"`
	Type        string           `json:"type"`
	Nodes       []string         `json:"nodes"`
	Density     float64          `json:"density"`
	Size        int              `json:"size"`
	Description string           `json:"description"`
	CentralNode string           `json:"centralNode"`
	Metrics     TerritoryMetrics `json:"metrics"`
}

// TerritoryMetrics métriques d'un territoire
type TerritoryMetrics struct {
	InternalEdges int     `json:"internalEdges"`
	ExternalEdges int     `json:"externalEdges"`
	AverageDegree float64 `json:"averageDegree"`
	Centrality    float64 `json:"centrality"`
}

// ExplorationSuggestions suggestions d'exploration
type ExplorationSuggestions struct {
	PriorityConnections []ConnectionSuggestion `json:"priorityConnections"`
	BridgeOpportunities []BridgeSuggestion     `json:"bridgeOpportunities"`
	DensityBalancing    []BalancingSuggestion  `json:"densityBalancing"`
}

// ConnectionSuggestion suggestion de connexion
type ConnectionSuggestion struct {
	From              string `json:"from"`
	To                string `json:"to"`
	Reason            string `json:"reason"`
	Impact            string `json:"impact"`
	Priority          int    `json:"priority,omitempty"`
	SuggestedRelation string `json:"suggestedRelation,omitempty"`
}

// BridgeSuggestion suggestion de pont entre clusters
type BridgeSuggestion struct {
	Cluster1       []string `json:"cluster1"`
	Cluster2       []string `json:"cluster2"`
	SuggestedNode1 string   `json:"suggestedNode1"`
	SuggestedNode2 string   `json:"suggestedNode2"`
	Impact         float64  `json:"impact"`
	Description    string   `json:"description"`
}

// BalancingSuggestion suggestion d'équilibrage de densité
type BalancingSuggestion struct {
	Zone           []string `json:"zone"`
	CurrentDensity float64  `json:"currentDensity"`
	TargetDensity  float64  `json:"targetDensity"`
	Action         string   `json:"action"` // "densify" ou "distribute"
	Description    string   `json:"description"`
}

// DensityMetrics métriques de densité globales
type DensityMetrics struct {
	GlobalDensity         float64     `json:"globalDensity"`
	AverageDegree         float64     `json:"averageDegree"`
	ClusteringCoefficient float64     `json:"clusteringCoefficient"`
	DegreeDistribution    map[int]int `json:"degreeDistribution"`
	Hubs                  []string    `json:"hubs"`
	Peripherals           []string    `json:"peripherals"`
	HighDensityZones      int         `json:"highDensityZones"`
	LowDensityZones       int         `json:"lowDensityZones"`
	FrontierZones         int         `json:"frontierZones"`
	BalanceScore          float64     `json:"balanceScore"`
	Recommendations       []string    `json:"recommendations"`
}

// Position représente une position 2D
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// SocraticSession représente une session de questionnement socratique
type SocraticSession struct {
	ID                   string             `json:"id"`
	StartTime            time.Time          `json:"startTime"`
	Topic                string             `json:"topic"`
	Context              string             `json:"context"`
	GraphData            GraphData          `json:"graphData"`
	Questions            []SocraticQuestion `json:"questions"`
	CurrentQuestionIndex int                `json:"currentQuestionIndex"`
	CurrentFocus         string             `json:"currentFocus"`
	Insights             []string           `json:"insights"`
	Depth                int                `json:"depth"`
	Mode                 string             `json:"mode"` // exploration, clarification, challenge, synthesis
	IsComplete           bool               `json:"isComplete"`
}

// SocraticQuestion représente une question socratique
type SocraticQuestion struct {
	ID           string    `json:"id"`
	Text         string    `json:"text"`
	Type         string    `json:"type"` // exploration, clarification, challenge, synthesis
	Category     string    `json:"category"`
	Hints        []string  `json:"hints,omitempty"`
	Answer       string    `json:"answer,omitempty"`
	QuestionTime time.Time `json:"questionTime"`
	AnswerTime   time.Time `json:"answerTime,omitempty"`
	Depth        int       `json:"depth"`
	IsFinal      bool      `json:"isFinal"`
}

// StartSocraticRequest pour démarrer une session
type StartSocraticRequest struct {
	Topic     string    `json:"topic"`
	Context   string    `json:"context,omitempty"`
	GraphData GraphData `json:"graphData"`
	Mode      string    `json:"mode"` // exploration, clarification, challenge, synthesis
}

// SocraticAnswerRequest pour soumettre une réponse
type SocraticAnswerRequest struct {
	SessionID string `json:"sessionId"`
	Answer    string `json:"answer"`
}

// SocraticResponse réponse du système socratique
type SocraticResponse struct {
	SessionID   string                 `json:"sessionId"`
	Question    SocraticQuestion       `json:"question"`
	Insights    []string               `json:"insights,omitempty"`
	Suggestions []ConnectionSuggestion `json:"suggestions,omitempty"`
	Progress    SocraticProgress       `json:"progress"`
	IsComplete  bool                   `json:"isComplete"`
}

// SocraticProgress progression de la session
type SocraticProgress struct {
	QuestionsAsked   int    `json:"questionsAsked"`
	CurrentDepth     int    `json:"currentDepth"`
	InsightsGained   int    `json:"insightsGained"`
	ConceptsExplored int    `json:"conceptsExplored"`
	CompletionScore  int    `json:"completionScore"` // 0-100
	Phase            string `json:"phase"`           // exploration, approfondissement, clarification, synthèse
}

// SocraticSummary résumé de la session
type SocraticSummary struct {
	SessionID             string                 `json:"sessionId"`
	Topic                 string                 `json:"topic"`
	Duration              time.Duration          `json:"duration"`
	TotalQuestions        int                    `json:"totalQuestions"`
	MaxDepthReached       int                    `json:"maxDepthReached"`
	KeyConcepts           []string               `json:"keyConcepts"`
	KeyInsights           []string               `json:"keyInsights"`
	DiscoveredConnections []ConnectionSuggestion `json:"discoveredConnections"`
	SuggestedFollowUp     []string               `json:"suggestedFollowUp"`
	QualityScore          int                    `json:"qualityScore"` // 0-100
}

// QuestionTemplates templates de questions par catégorie
type QuestionTemplates struct {
	Exploration   []string `json:"exploration"`
	Clarification []string `json:"clarification"`
	Challenge     []string `json:"challenge"`
	Synthesis     []string `json:"synthesis"`
}
