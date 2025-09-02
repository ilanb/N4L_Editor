package handlers

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"n4l-editor/models"
	"n4l-editor/services"
)

const sessionDir = "sessions"

// SocraticHandler gère le mode de questionnement socratique
type SocraticHandler struct {
	ollamaService *services.OllamaService
	analyzer      *services.GraphAnalyzer
	sessions      map[string]*models.SocraticSession // Active sessions
}

// NewSocraticHandler crée une nouvelle instance
func NewSocraticHandler(ollamaService *services.OllamaService) *SocraticHandler {
	// Create directory for saved sessions if it doesn't exist
	if _, err := os.Stat(sessionDir); os.IsNotExist(err) {
		os.Mkdir(sessionDir, 0755)
	}

	return &SocraticHandler{
		ollamaService: ollamaService,
		analyzer:      services.NewGraphAnalyzer(),
		sessions:      make(map[string]*models.SocraticSession),
	}
}

// StartSocraticSession démarre une nouvelle session socratique
func (h *SocraticHandler) StartSocraticSession(w http.ResponseWriter, r *http.Request) {
	var req models.StartSocraticRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	sessionID := fmt.Sprintf("socratic_%d", time.Now().UnixNano())
	session := &models.SocraticSession{
		ID:        sessionID,
		StartTime: time.Now(),
		Topic:     req.Topic,
		Context:   req.Context,
		GraphData: req.GraphData,
		Questions: []models.SocraticQuestion{},
		Insights:  []string{},
		Depth:     0,
		Mode:      req.Mode,
	}

	session.CurrentFocus = h.identifyFocusArea(req.GraphData, req.Topic)
	firstQuestion := h.generateQuestion(session, nil)
	session.Questions = append(session.Questions, firstQuestion)
	session.CurrentQuestionIndex = 0
	h.sessions[sessionID] = session

	response := models.SocraticResponse{
		SessionID: sessionID,
		Question:  firstQuestion,
		Progress:  h.calculateProgress(session),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ProcessSocraticAnswer traite une réponse et génère la question suivante
func (h *SocraticHandler) ProcessSocraticAnswer(w http.ResponseWriter, r *http.Request) {
	var req models.SocraticAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}

	session, exists := h.sessions[req.SessionID]
	if !exists {
		http.Error(w, "Session active non trouvée", http.StatusNotFound)
		return
	}

	if session.CurrentQuestionIndex < len(session.Questions) {
		session.Questions[session.CurrentQuestionIndex].Answer = req.Answer
		session.Questions[session.CurrentQuestionIndex].AnswerTime = time.Now()
	}

	insights := h.analyzeAnswer(req.Answer, session)
	session.Insights = append(session.Insights, insights...)

	if h.shouldDeepenInquiry(req.Answer, session) {
		session.Depth++
	} else if session.Depth > 0 {
		session.Depth--
		session.CurrentFocus = h.identifyNewFocus(session)
	}

	var nextQuestion models.SocraticQuestion
	if len(session.Questions) >= 15 || h.shouldConclude(session) {
		nextQuestion = h.generateSynthesisQuestion(session)
		session.IsComplete = true
	} else {
		lastQuestion := &session.Questions[session.CurrentQuestionIndex]
		nextQuestion = h.generateQuestion(session, lastQuestion)
	}

	session.Questions = append(session.Questions, nextQuestion)
	session.CurrentQuestionIndex++

	suggestions := h.generateConnectionSuggestions(session)

	response := models.SocraticResponse{
		SessionID:   req.SessionID,
		Question:    nextQuestion,
		Insights:    insights,
		Suggestions: suggestions,
		Progress:    h.calculateProgress(session),
		IsComplete:  session.IsComplete,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetSocraticSummary génère un résumé de la session
func (h *SocraticHandler) GetSocraticSummary(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	session, exists := h.sessions[sessionID]
	if !exists {
		http.Error(w, "Session non trouvée", http.StatusNotFound)
		return
	}
	summary := h.generateSessionSummary(session)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

// GetSocraticHistory récupère l'historique d'une session
func (h *SocraticHandler) GetSocraticHistory(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	session, exists := h.sessions[sessionID]
	if !exists {
		http.Error(w, "Session non trouvée", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session.Questions)
}

// SaveSocraticSession sauvegarde l'état actuel d'une session dans un fichier
func (h *SocraticHandler) SaveSocraticSession(w http.ResponseWriter, r *http.Request) {
	var session models.SocraticSession
	if err := json.NewDecoder(r.Body).Decode(&session); err != nil {
		http.Error(w, "Données de session invalides", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(sessionDir, fmt.Sprintf("%s.json", session.ID))
	fileData, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		http.Error(w, "Erreur lors de la sérialisation de la session", http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(filePath, fileData, 0644); err != nil {
		http.Error(w, "Impossible de sauvegarder le fichier de session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "success",
		"sessionId": session.ID,
	})
}

// LoadSocraticSession charge une session sauvegardée depuis un fichier
func (h *SocraticHandler) LoadSocraticSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "ID de session manquant", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(sessionDir, fmt.Sprintf("%s.json", sessionID))
	fileData, err := os.ReadFile(filePath)
	if err != nil {
		http.Error(w, "Session sauvegardée non trouvée", http.StatusNotFound)
		return
	}

	var session models.SocraticSession
	if err := json.Unmarshal(fileData, &session); err != nil {
		http.Error(w, "Impossible de lire le fichier de session", http.StatusInternalServerError)
		return
	}

	// Make it the active session
	h.sessions[session.ID] = &session

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

// GetQuestionSuggestions génère des suggestions de questions avec l'IA
func (h *SocraticHandler) GetQuestionSuggestions(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	session, exists := h.sessions[sessionID]
	if !exists {
		http.Error(w, "Session non trouvée", http.StatusNotFound)
		return
	}

	// Build context from last 2 Q&As
	conversationContext := ""
	startIndex := len(session.Questions) - 3
	if startIndex < 0 {
		startIndex = 0
	}
	for i := startIndex; i < len(session.Questions)-1; i++ {
		q := session.Questions[i]
		conversationContext += fmt.Sprintf("Q: %s\nA: %s\n\n", q.Text, q.Answer)
	}

	prompt := fmt.Sprintf(
		`Basé sur cette conversation à propos de "%s":\n%s\nSuggère 3 questions socratiques pertinentes pour continuer l'exploration. Réponds uniquement avec un tableau JSON de chaînes de caractères. Exemple : ["Question 1?", "Question 2?", "Question 3?"]`,
		session.Topic,
		conversationContext,
	)

	ollamaResp, err := h.ollamaService.Generate(prompt, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var suggestions []string
	// The response might be a markdown block, so we clean it
	cleanedResp := strings.Trim(ollamaResp, " `\n\r")
	cleanedResp = strings.TrimPrefix(cleanedResp, "json")

	if err := json.Unmarshal([]byte(cleanedResp), &suggestions); err != nil {
		http.Error(w, fmt.Sprintf("Erreur de parsing des suggestions de l'IA: %v, Réponse: %s", err, cleanedResp), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suggestions)
}

// AnalyzeResponse analyse une réponse avec l'IA
func (h *SocraticHandler) AnalyzeResponse(w http.ResponseWriter, r *http.Request) {
	var req models.SocraticAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Données invalides", http.StatusBadRequest)
		return
	}
	session, exists := h.sessions[req.SessionID]
	if !exists {
		http.Error(w, "Session non trouvée", http.StatusNotFound)
		return
	}

	prompt := fmt.Sprintf(
		`Analyse en profondeur cette réponse dans le contexte d'un dialogue socratique sur "%s":\n\nRéponse: "%s"\n\nIdentifie les concepts clés, les hypothèses sous-jacentes, et les contradictions ou tensions potentielles. Réponds uniquement avec un objet JSON avec les clés "concepts", "assumptions", "contradictions".`,
		session.Topic,
		req.Answer,
	)

	ollamaResp, err := h.ollamaService.Generate(prompt, "json")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(ollamaResp))
}

// ===================================================================
// METHODES PRIVEES (UNCHANGED)
// ===================================================================

// ... (toutes les méthodes privées de generateQuestion à getQuestionTemplates restent ici)

func (h *SocraticHandler) generateQuestion(session *models.SocraticSession, lastQuestion *models.SocraticQuestion) models.SocraticQuestion {
	question := models.SocraticQuestion{
		ID:           fmt.Sprintf("q_%d", len(session.Questions)),
		QuestionTime: time.Now(),
		Depth:        session.Depth,
	}

	// Sélectionner le type de question basé sur le mode et la profondeur
	switch session.Mode {
	case "exploration":
		question = h.generateExplorationQuestion(session, lastQuestion)
	case "clarification":
		question = h.generateClarificationQuestion(session, lastQuestion)
	case "challenge":
		question = h.generateChallengeQuestion(session, lastQuestion)
	case "synthesis":
		question = h.generateSynthesisQuestion(session)
	default:
		question = h.generateAdaptiveQuestion(session, lastQuestion)
	}

	return question
}

func (h *SocraticHandler) generateExplorationQuestion(session *models.SocraticSession, lastQ *models.SocraticQuestion) models.SocraticQuestion {
	templates := []string{
		"Qu'est-ce qui vous amène à penser que %s ?",
		"Pouvez-vous m'en dire plus sur %s ?",
		"Comment %s est-il relié à %s dans votre compréhension ?",
		"Quels aspects de %s n'avez-vous pas encore explorés ?",
		"Si vous deviez expliquer %s à quelqu'un qui n'y connaît rien, par où commenceriez-vous ?",
		"Qu'est-ce qui rend %s important dans ce contexte ?",
		"Y a-t-il des connexions entre %s et d'autres concepts que vous n'avez pas encore identifiées ?",
	}

	// Choisir un template aléatoire
	template := templates[rand.Intn(len(templates))]

	// Remplir avec le contexte
	focus := session.CurrentFocus
	if focus == "" {
		focus = session.Topic
	}

	questionText := strings.Replace(template, "%s", focus, 1)

	// Si deux %s, ajouter un concept connexe
	if strings.Contains(questionText, "%s") {
		relatedConcept := h.findRelatedConcept(focus, session.GraphData)
		questionText = strings.Replace(questionText, "%s", relatedConcept, 1)
	}

	hints := []string{
		"Pensez aux relations de cause à effet",
		"Considérez les différentes perspectives",
		"N'hésitez pas à mentionner des détails qui semblent mineurs",
	}

	return models.SocraticQuestion{
		ID:           fmt.Sprintf("q_%d", len(session.Questions)),
		Text:         questionText,
		Type:         "exploration",
		Category:     "discovery",
		Hints:        hints,
		QuestionTime: time.Now(),
		Depth:        session.Depth,
	}
}

func (h *SocraticHandler) generateClarificationQuestion(session *models.SocraticSession, lastQ *models.SocraticQuestion) models.SocraticQuestion {
	templates := []string{
		"Que voulez-vous dire exactement par '%s' ?",
		"Pouvez-vous donner un exemple concret de %s ?",
		"Comment distinguez-vous %s de %s ?",
		"Quelle est la différence essentielle entre %s et ce que vous avez mentionné précédemment ?",
		"Si %s est vrai, qu'est-ce que cela implique nécessairement ?",
		"Comment savez-vous que %s ?",
		"Sur quoi vous basez-vous pour affirmer que %s ?",
	}

	// Extraire un concept clé de la dernière réponse si disponible
	keyTerm := session.CurrentFocus
	if lastQ != nil && lastQ.Answer != "" {
		keyTerm = h.extractKeyTerm(lastQ.Answer)
	}

	template := templates[rand.Intn(len(templates))]
	questionText := strings.Replace(template, "%s", keyTerm, -1)

	return models.SocraticQuestion{
		ID:           fmt.Sprintf("q_%d", len(session.Questions)),
		Text:         questionText,
		Type:         "clarification",
		Category:     "definition",
		QuestionTime: time.Now(),
		Depth:        session.Depth,
	}
}

func (h *SocraticHandler) generateChallengeQuestion(session *models.SocraticSession, lastQ *models.SocraticQuestion) models.SocraticQuestion {
	templates := []string{
		"Et si le contraire de %s était vrai, qu'est-ce que cela changerait ?",
		"Quelles sont les limites de cette approche concernant %s ?",
		"Existe-t-il des cas où %s ne s'applique pas ?",
		"Comment quelqu'un pourrait-il argumenter contre %s ?",
		"Quelles hypothèses faites-vous implicitement à propos de %s ?",
		"Y a-t-il des contradictions potentielles dans votre raisonnement sur %s ?",
		"Quelles preuves contrediraient votre position sur %s ?",
	}

	focus := session.CurrentFocus
	template := templates[rand.Intn(len(templates))]
	questionText := strings.Replace(template, "%s", focus, -1)

	return models.SocraticQuestion{
		ID:           fmt.Sprintf("q_%d", len(session.Questions)),
		Text:         questionText,
		Type:         "challenge",
		Category:     "critical",
		QuestionTime: time.Now(),
		Depth:        session.Depth,
		Hints: []string{
			"Il n'y a pas de mauvaise réponse",
			"Considérez les cas extrêmes",
			"Pensez aux exceptions",
		},
	}
}

func (h *SocraticHandler) generateSynthesisQuestion(session *models.SocraticSession) models.SocraticQuestion {
	templates := []string{
		"En résumé, quelle est la relation la plus importante que vous avez découverte ?",
		"Si vous deviez retenir une seule chose de cette exploration, ce serait quoi ?",
		"Comment cette discussion a-t-elle changé votre compréhension de %s ?",
		"Quelles nouvelles questions cette exploration a-t-elle soulevées ?",
		"Quelle est la prochaine étape logique dans votre exploration de %s ?",
		"Comment connecteriez-vous tout ce que nous avons discuté ?",
	}

	template := templates[rand.Intn(len(templates))]
	questionText := strings.Replace(template, "%s", session.Topic, -1)

	return models.SocraticQuestion{
		ID:           fmt.Sprintf("q_%d", len(session.Questions)),
		Text:         questionText,
		Type:         "synthesis",
		Category:     "conclusion",
		QuestionTime: time.Now(),
		Depth:        session.Depth,
		IsFinal:      true,
	}
}

func (h *SocraticHandler) generateAdaptiveQuestion(session *models.SocraticSession, lastQ *models.SocraticQuestion) models.SocraticQuestion {
	// Décider du type de question basé sur le contexte
	if session.Depth == 0 {
		return h.generateExplorationQuestion(session, lastQ)
	} else if session.Depth < 3 {
		if rand.Float32() < 0.5 {
			return h.generateClarificationQuestion(session, lastQ)
		}
		return h.generateExplorationQuestion(session, lastQ)
	} else {
		if rand.Float32() < 0.3 {
			return h.generateChallengeQuestion(session, lastQ)
		}
		return h.generateClarificationQuestion(session, lastQ)
	}
}

func (h *SocraticHandler) analyzeAnswer(answer string, session *models.SocraticSession) []string {
	insights := []string{}

	// Détecter les nouveaux concepts mentionnés
	newConcepts := h.extractNewConcepts(answer, session.GraphData)
	if len(newConcepts) > 0 {
		insights = append(insights, fmt.Sprintf("Nouveaux concepts identifiés : %s", strings.Join(newConcepts, ", ")))
	}

	// Détecter les relations implicites
	if strings.Contains(answer, "parce que") || strings.Contains(answer, "donc") || strings.Contains(answer, "car") {
		insights = append(insights, "Relation causale détectée")
	}

	// Détecter l'incertitude
	if strings.Contains(answer, "peut-être") || strings.Contains(answer, "je pense") || strings.Contains(answer, "probablement") {
		insights = append(insights, "Zone d'incertitude identifiée - opportunité d'exploration")
	}

	// Détecter les contradictions potentielles
	if h.detectContradiction(answer, session) {
		insights = append(insights, "Tension conceptuelle détectée - à clarifier")
	}

	return insights
}

func (h *SocraticHandler) shouldDeepenInquiry(answer string, session *models.SocraticSession) bool {
	// Approfondir si :
	// - La réponse est courte (besoin de plus de détails)
	// - Des mots clés d'incertitude sont présents
	// - Le niveau de profondeur est faible
	// - Des concepts nouveaux sont mentionnés

	if len(answer) < 50 && session.Depth < 3 {
		return true
	}

	uncertaintyWords := []string{"peut-être", "je ne sais pas", "pas sûr", "difficile à dire"}
	for _, word := range uncertaintyWords {
		if strings.Contains(strings.ToLower(answer), word) {
			return true
		}
	}

	newConcepts := h.extractNewConcepts(answer, session.GraphData)
	if len(newConcepts) > 2 && session.Depth < 4 {
		return true
	}

	return false
}

func (h *SocraticHandler) shouldConclude(session *models.SocraticSession) bool {
	// Conclure si :
	// - Plus de 10 questions posées
	// - Profondeur maximale atteinte (5+)
	// - Patterns de réponses répétitifs détectés
	// - Session dure depuis plus de 20 minutes

	if len(session.Questions) >= 10 {
		return true
	}

	if session.Depth >= 5 {
		return true
	}

	if time.Since(session.StartTime) > 20*time.Minute {
		return true
	}

	// Vérifier les patterns répétitifs
	if h.detectRepetitivePatterns(session) {
		return true
	}

	return false
}

func (h *SocraticHandler) identifyFocusArea(graph models.GraphData, topic string) string {
	// Trouver le nœud le plus pertinent par rapport au topic
	if topic == "" && len(graph.Nodes) > 0 {
		// Si pas de topic, prendre un nœud central
		return h.findCentralNode(graph)
	}

	// Chercher un nœud qui correspond au topic
	for _, node := range graph.Nodes {
		if strings.Contains(strings.ToLower(node.Label), strings.ToLower(topic)) {
			return node.Label
		}
	}

	// Si aucun match, utiliser le topic tel quel
	return topic
}

func (h *SocraticHandler) identifyNewFocus(session *models.SocraticSession) string {
	// Identifier un nouveau focus basé sur les réponses précédentes
	mentionedConcepts := make(map[string]int)

	for _, q := range session.Questions {
		if q.Answer != "" {
			concepts := h.extractConcepts(q.Answer)
			for _, c := range concepts {
				mentionedConcepts[c]++
			}
		}
	}

	// Trouver le concept le plus mentionné qui n'est pas le focus actuel
	maxCount := 0
	newFocus := session.CurrentFocus

	for concept, count := range mentionedConcepts {
		if concept != session.CurrentFocus && count > maxCount {
			maxCount = count
			newFocus = concept
		}
	}

	return newFocus
}

func (h *SocraticHandler) generateConnectionSuggestions(session *models.SocraticSession) []models.ConnectionSuggestion {
	suggestions := []models.ConnectionSuggestion{}

	// Analyser toutes les réponses pour identifier les connexions implicites
	for i, q := range session.Questions {
		if q.Answer == "" {
			continue
		}

		// Extraire les concepts de la réponse
		concepts := h.extractConcepts(q.Answer)

		// Créer des suggestions de connexions entre concepts mentionnés ensemble
		for j := 0; j < len(concepts)-1; j++ {
			for k := j + 1; k < len(concepts); k++ {
				// Vérifier si cette connexion n'existe pas déjà
				if !h.connectionExists(concepts[j], concepts[k], session.GraphData) {
					suggestion := models.ConnectionSuggestion{
						From:   concepts[j],
						To:     concepts[k],
						Reason: fmt.Sprintf("Mentionnés ensemble dans la question %d", i+1),
						Impact: "medium",
					}

					// Déterminer le type de relation basé sur le contexte
					if strings.Contains(q.Answer, "cause") || strings.Contains(q.Answer, "parce que") {
						suggestion.SuggestedRelation = "cause"
					} else if strings.Contains(q.Answer, "similaire") || strings.Contains(q.Answer, "comme") {
						suggestion.SuggestedRelation = "similaire à"
					} else {
						suggestion.SuggestedRelation = "lié à"
					}

					suggestions = append(suggestions, suggestion)
				}
			}
		}
	}

	// Limiter à 5 suggestions
	if len(suggestions) > 5 {
		suggestions = suggestions[:5]
	}

	return suggestions
}

func (h *SocraticHandler) calculateProgress(session *models.SocraticSession) models.SocraticProgress {
	progress := models.SocraticProgress{
		QuestionsAsked:   len(session.Questions),
		CurrentDepth:     session.Depth,
		InsightsGained:   len(session.Insights),
		ConceptsExplored: h.countExploredConcepts(session),
	}

	// Calculer le score de complétude (0-100)
	if session.IsComplete {
		progress.CompletionScore = 100
	} else {
		// Basé sur : nombre de questions, profondeur, insights
		questionScore := float64(len(session.Questions)) / 15.0 * 40 // Max 40% (base 15 questions)
		depthScore := float64(session.Depth) / 5.0 * 30              // Max 30%
		insightScore := float64(len(session.Insights)) / 10.0 * 30   // Max 30%

		progress.CompletionScore = int(questionScore + depthScore + insightScore)
		if progress.CompletionScore > 100 {
			progress.CompletionScore = 100
		}
	}

	// Identifier la phase actuelle
	if len(session.Questions) <= 3 {
		progress.Phase = "Exploration"
	} else if len(session.Questions) <= 7 {
		progress.Phase = "Approfondissement"
	} else if len(session.Questions) <= 12 {
		progress.Phase = "Clarification"
	} else {
		progress.Phase = "Synthèse"
	}

	return progress
}

func (h *SocraticHandler) generateSessionSummary(session *models.SocraticSession) models.SocraticSummary {
	summary := models.SocraticSummary{
		SessionID:       session.ID,
		Topic:           session.Topic,
		Duration:        time.Since(session.StartTime).Round(time.Second),
		TotalQuestions:  len(session.Questions),
		MaxDepthReached: session.Depth, // This needs to track max depth, not current
		KeyInsights:     session.Insights,
	}

	// Extract key concepts
	conceptFreq := make(map[string]int)
	for _, q := range session.Questions {
		if q.Answer != "" {
			concepts := h.extractConcepts(q.Answer)
			for _, c := range concepts {
				conceptFreq[c]++
			}
		}
	}
	for concept, freq := range conceptFreq {
		if freq > 1 {
			summary.KeyConcepts = append(summary.KeyConcepts, concept)
		}
	}

	summary.DiscoveredConnections = h.generateConnectionSuggestions(session)
	summary.SuggestedFollowUp = h.generateFollowUpQuestions(session)
	summary.QualityScore = h.calculateSessionQuality(session)

	return summary
}

func (h *SocraticHandler) extractKeyTerm(text string) string {
	words := strings.Fields(text)
	for _, word := range words {
		cleanedWord := strings.Trim(strings.ToLower(word), ".,;:!?")
		if len(cleanedWord) > 4 && !h.isCommonWord(cleanedWord) {
			return cleanedWord
		}
	}
	if len(words) > 0 {
		return words[0]
	}
	return "cela"
}

func (h *SocraticHandler) extractConcepts(text string) []string {
	concepts := []string{}
	// A simple split by space and basic cleaning
	words := strings.Fields(text)
	for _, word := range words {
		cleanedWord := strings.Trim(strings.ToLower(word), ".,;:!?()")
		if len(cleanedWord) > 3 && !h.isCommonWord(cleanedWord) {
			concepts = append(concepts, cleanedWord)
		}
	}
	return concepts
}

func (h *SocraticHandler) extractNewConcepts(answer string, graph models.GraphData) []string {
	existingConcepts := make(map[string]bool)
	for _, node := range graph.Nodes {
		existingConcepts[strings.ToLower(node.Label)] = true
	}

	newConcepts := []string{}
	concepts := h.extractConcepts(answer)

	for _, concept := range concepts {
		if !existingConcepts[strings.ToLower(concept)] {
			newConcepts = append(newConcepts, concept)
		}
	}
	return newConcepts
}

func (h *SocraticHandler) isCommonWord(word string) bool {
	commonWords := map[string]bool{
		"le": true, "la": true, "les": true, "un": true, "une": true, "de": true, "du": true, "des": true, "et": true, "ou": true, "mais": true,
		"pour": true, "avec": true, "sans": true, "sur": true, "sous": true, "dans": true, "par": true, "que": true, "qui": true, "quoi": true,
		"être": true, "avoir": true, "faire": true, "dire": true, "aller": true, "voir": true, "savoir": true, "pouvoir": true, "comme": true,
		"c'est": true, "il": true, "elle": true, "nous": true, "vous": true, "ils": true, "elles": true, "sont": true, "est": true, "s'est": true,
	}
	return commonWords[word]
}

func (h *SocraticHandler) findRelatedConcept(focus string, graph models.GraphData) string {
	for _, edge := range graph.Edges {
		if strings.EqualFold(edge.From, focus) {
			return edge.To
		}
		if strings.EqualFold(edge.To, focus) {
			return edge.From
		}
	}
	if len(graph.Nodes) > 1 {
		for i := 0; i < 5; i++ { // Try a few times to not get the same concept
			randNode := graph.Nodes[rand.Intn(len(graph.Nodes))].Label
			if !strings.EqualFold(randNode, focus) {
				return randNode
			}
		}
	}
	return "un autre aspect"
}

func (h *SocraticHandler) findCentralNode(graph models.GraphData) string {
	if len(graph.Nodes) == 0 {
		return ""
	}

	connections := make(map[string]int)
	for _, edge := range graph.Edges {
		connections[edge.From]++
		connections[edge.To]++
	}

	maxConn := -1
	var centralNode string
	for nodeID, count := range connections {
		if count > maxConn {
			maxConn = count
			centralNode = nodeID
		}
	}

	if centralNode == "" {
		return graph.Nodes[0].Label
	}
	return centralNode
}

func (h *SocraticHandler) detectContradiction(answer string, session *models.SocraticSession) bool {
	contradictions := [][]string{
		{"toujours", "jamais"},
		{"tous", "aucun"},
		{"impossible", "certain"},
	}

	lowerAnswer := strings.ToLower(answer)
	for _, pair := range contradictions {
		if strings.Contains(lowerAnswer, pair[0]) && strings.Contains(lowerAnswer, pair[1]) {
			return true
		}
	}
	return false
}

func (h *SocraticHandler) detectRepetitivePatterns(session *models.SocraticSession) bool {
	if len(session.Questions) < 4 {
		return false
	}
	// Check if last two answers are very similar in concept
	q1 := session.Questions[len(session.Questions)-2]
	q2 := session.Questions[len(session.Questions)-3]

	if q1.Answer != "" && q2.Answer != "" {
		concepts1 := h.extractConcepts(q1.Answer)
		concepts2 := h.extractConcepts(q2.Answer)
		if len(concepts1) > 0 && len(concepts1) == len(concepts2) {
			return true // Simplified check
		}
	}
	return false
}

func (h *SocraticHandler) connectionExists(from, to string, graph models.GraphData) bool {
	for _, edge := range graph.Edges {
		if (strings.EqualFold(edge.From, from) && strings.EqualFold(edge.To, to)) ||
			(strings.EqualFold(edge.From, to) && strings.EqualFold(edge.To, from)) {
			return true
		}
	}
	return false
}

func (h *SocraticHandler) countExploredConcepts(session *models.SocraticSession) int {
	concepts := make(map[string]bool)
	for _, q := range session.Questions {
		if q.Answer != "" {
			for _, c := range h.extractConcepts(q.Answer) {
				concepts[c] = true
			}
		}
	}
	return len(concepts)
}

func (h *SocraticHandler) generateFollowUpQuestions(session *models.SocraticSession) []string {
	questions := []string{}
	if len(session.Insights) > 0 {
		questions = append(questions, "Comment pourriez-vous valider ou réfuter les insights découverts ?")
	}
	if session.Depth < 3 {
		questions = append(questions, fmt.Sprintf("Quels aspects de '%s' restent encore flous ou méritent une exploration plus approfondie ?", session.Topic))
	}
	// Simplified: find a new concept from the whole conversation
	allAnswers := ""
	for _, q := range session.Questions {
		allAnswers += q.Answer + " "
	}
	newConcepts := h.extractNewConcepts(allAnswers, session.GraphData)
	if len(newConcepts) > 0 {
		questions = append(questions, fmt.Sprintf("Comment le concept de '%s' s'intègre-t-il dans votre compréhension globale ?", newConcepts[0]))
	}
	if len(questions) == 0 {
		questions = append(questions, "Quelle est la question la plus importante qui reste sans réponse pour vous ?")
	}
	return questions
}

func (h *SocraticHandler) calculateSessionQuality(session *models.SocraticSession) int {
	score := 0
	answeredCount := 0
	totalLength := 0
	for _, q := range session.Questions {
		if q.Answer != "" {
			answeredCount++
			totalLength += len(q.Answer)
		}
	}

	if answeredCount > 0 {
		participationScore := (answeredCount * 30) / len(session.Questions)
		score += participationScore
		avgLength := totalLength / answeredCount
		if avgLength > 100 {
			score += 30
		} else {
			score += (avgLength * 30) / 100
		}
	}
	if len(session.Insights) > 5 {
		score += 20
	} else {
		score += (len(session.Insights) * 20) / 5
	}
	maxDepth := 0
	for _, q := range session.Questions {
		if q.Depth > maxDepth {
			maxDepth = q.Depth
		}
	}
	if maxDepth > 3 {
		score += 20
	} else {
		score += (maxDepth * 20) / 3
	}
	return score
}

func (h *SocraticHandler) getQuestionTemplates() models.QuestionTemplates {
	return models.QuestionTemplates{
		Exploration: []string{
			"Qu'est-ce qui vous amène à penser que %s ?",
			"Pouvez-vous m'en dire plus sur %s ?",
			"Comment %s est-il relié à %s ?",
		},
		Clarification: []string{
			"Que voulez-vous dire par %s ?",
			"Pouvez-vous donner un exemple ?",
			"Comment savez-vous que %s ?",
		},
		Challenge: []string{
			"Et si le contraire était vrai ?",
			"Quelles sont les limites de cette approche ?",
			"Existe-t-il des exceptions ?",
		},
		Synthesis: []string{
			"Quelle est la relation la plus importante ?",
			"Qu'avez-vous appris ?",
			"Quelle est la prochaine étape ?",
		},
	}
}
