package main

import (
	"fmt"
	"log"
	"net/http"

	"n4l-editor/handlers"
	"n4l-editor/services"
)

const (
	// Configuration
	port         = ":8080"
	ollamaAPIURL = "http://localhost:11434/api/generate"
)

func main() {
	// Initialiser les services
	ollamaService := services.NewOllamaService(ollamaAPIURL)

	// Initialiser les handlers
	conceptsHandler := handlers.NewConceptsHandler(ollamaService)
	graphHandler := handlers.NewGraphHandler(ollamaService)
	analysisHandler := handlers.NewAnalysisHandler(ollamaService)
	timelineHandler := handlers.NewTimelineHandler()
	investigationHandler := handlers.NewInvestigationHandler()
	historyHandler := handlers.NewHistoryHandler(ollamaService)
	densityHandler := handlers.NewDensityHandler()
	socraticHandler := handlers.NewSocraticHandler(ollamaService)

	// Routes API
	setupAPIRoutes(conceptsHandler, graphHandler, analysisHandler, timelineHandler, investigationHandler, historyHandler, densityHandler, socraticHandler)

	// Routes pour les fichiers statiques
	setupStaticRoutes()

	// Démarrer le serveur
	fmt.Printf("Serveur démarré. Accédez à l'application sur http://localhost%s\n", port)
	log.Fatal(http.ListenAndServe(port, nil))
}

func setupAPIRoutes(
	concepts *handlers.ConceptsHandler,
	graph *handlers.GraphHandler,
	analysis *handlers.AnalysisHandler,
	timeline *handlers.TimelineHandler,
	investigation *handlers.InvestigationHandler,
	history *handlers.HistoryHandler,
	density *handlers.DensityHandler,
	socratic *handlers.SocraticHandler,

) {
	// Concepts et parsing
	http.HandleFunc("/api/extract-concepts", concepts.ExtractConcepts)
	http.HandleFunc("/api/auto-extract-subjects", concepts.AutoExtractSubjects)
	http.HandleFunc("/api/parse-n4l", concepts.ParseN4L)
	http.HandleFunc("/api/generate-n4l-from-text", concepts.GenerateN4LFromText)

	// Graphe
	http.HandleFunc("/api/graph-data", graph.GetGraphData)
	http.HandleFunc("/api/find-all-paths", graph.FindAllPaths)
	http.HandleFunc("/api/layered-graph", graph.GetLayeredGraph)
	http.HandleFunc("/api/analyze-path", graph.AnalyzePath)
	http.HandleFunc("/api/graph/expansion-cone", graph.GetExpansionCone)
	http.HandleFunc("/api/analyze-expansion-cone", graph.AnalyzeExpansionCone)
	http.HandleFunc("/api/find-clusters", graph.FindClusters)
	http.HandleFunc("/api/analyze-clusters", graph.AnalyzeClusters)

	// Analyse
	http.HandleFunc("/api/analyze-graph", analysis.AnalyzeGraph)
	http.HandleFunc("/api/detect-temporal-patterns", analysis.DetectTemporalPatterns)
	http.HandleFunc("/api/check-consistency", analysis.CheckConsistency)
	http.HandleFunc("/api/generate-questions", analysis.GenerateQuestions)

	// Timeline
	http.HandleFunc("/api/timeline-data", timeline.GetTimelineData)

	// Investigation
	http.HandleFunc("/api/investigation-mode", investigation.HandleInvestigationMode)

	// Versioning sémantique
	http.HandleFunc("/api/save-version", history.SaveVersion)
	http.HandleFunc("/api/version-history", history.GetVersionHistory)
	http.HandleFunc("/api/restore-version", history.RestoreVersion)
	http.HandleFunc("/api/compare-versions", history.CompareVersions)
	http.HandleFunc("/api/evolution-timeline", history.GetEvolutionTimeline)
	http.HandleFunc("/api/delete-version", history.DeleteVersion)
	http.HandleFunc("/api/clear-history", history.ClearHistory)

	// Vue densité conceptuelle
	http.HandleFunc("/api/density-map", density.GetDensityMap)
	http.HandleFunc("/api/conceptual-territories", density.GetConceptualTerritories)
	http.HandleFunc("/api/exploration-suggestions", density.GetExplorationSuggestions)
	http.HandleFunc("/api/density-metrics", density.GetDensityMetrics)

	// Mode Socratique
	http.HandleFunc("/api/start-socratic", socratic.StartSocraticSession)
	http.HandleFunc("/api/process-socratic-answer", socratic.ProcessSocraticAnswer)
	http.HandleFunc("/api/socratic-summary", socratic.GetSocraticSummary)
	http.HandleFunc("/api/socratic-history", socratic.GetSocraticHistory)
	http.HandleFunc("/api/save-socratic-session", socratic.SaveSocraticSession)
	http.HandleFunc("/api/load-socratic-session", socratic.LoadSocraticSession)
	http.HandleFunc("/api/socratic-suggestions", socratic.GetQuestionSuggestions)
	http.HandleFunc("/api/analyze-socratic-response", socratic.AnalyzeResponse)
}

func setupStaticRoutes() {
	// Servir les fichiers statiques
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	// Page principale
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "static/index.html")
	})
}
