package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"n4l-editor/models"
)

// OllamaService manages interactions with the Ollama API
type OllamaService struct {
	APIUrl string
}

// NewOllamaService creates a new instance of the Ollama service
func NewOllamaService(apiUrl string) *OllamaService {
	return &OllamaService{
		APIUrl: apiUrl,
	}
}

// Generate provides a simplified interface for making calls to Ollama with a default model.
// This is the missing function that socratic.go was trying to call.
func (s *OllamaService) Generate(prompt string, format string) (string, error) {
	// We use a versatile model by default. This can be changed to any other model available in your Ollama setup.
	defaultModel := "gpt-oss:20b"
	return s.CallOllama(defaultModel, prompt, format)
}

// CallOllama performs a request to the Ollama API
func (s *OllamaService) CallOllama(model, prompt string, format string) (string, error) {
	reqPayload := models.OllamaRequest{
		Model:  model,
		Prompt: prompt,
		Stream: false,
		Format: format,
	}

	reqBody, err := json.Marshal(reqPayload)
	if err != nil {
		return "", fmt.Errorf("error creating the request body: %w", err)
	}

	resp, err := http.Post(s.APIUrl, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return "", fmt.Errorf("error connecting to Ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Ollama returned an error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading the response body: %w", err)
	}

	var ollamaResp models.OllamaResponse
	if err := json.Unmarshal(respBody, &ollamaResp); err != nil {
		// Fallback for non-streaming or malformed JSON responses
		return string(respBody), nil
	}

	return ollamaResp.Response, nil
}

// ExtractSubjectsWithAI uses AI to extract subjects from text
func (s *OllamaService) ExtractSubjectsWithAI(text string) ([]string, error) {
	prompt := `À partir du texte suivant, identifiez les entités nommées (personnes, lieux, objets).
Répondez uniquement avec un objet JSON contenant des listes pour chaque catégorie
(par exemple, {"personnes": [...], "lieux": [...]}). Le texte est : ` + text

	// Using a model fine-tuned for NER (Named Entity Recognition) is better here.
	response, err := s.CallOllama("llama3", prompt, "json")
	if err != nil {
		return nil, err
	}

	cleanedJson := CleanOllamaJSON(response)
	if cleanedJson == "" {
		return nil, fmt.Errorf("the AI returned a non-JSON response")
	}

	var subjects []string
	var structuredResp map[string]interface{}

	if err := json.Unmarshal([]byte(cleanedJson), &structuredResp); err == nil {
		for _, value := range structuredResp {
			if items, ok := value.([]interface{}); ok {
				for _, item := range items {
					if str, ok := item.(string); ok {
						subjects = append(subjects, str)
					}
				}
			}
		}
	} else if err2 := json.Unmarshal([]byte(cleanedJson), &subjects); err2 != nil {
		return nil, fmt.Errorf("unable to parse the AI's response: %s", cleanedJson)
	}

	return subjects, nil
}

// AnalyzeGraph generates a summary of the graph with AI
func (s *OllamaService) AnalyzeGraph(graphData models.GraphData) (string, error) {
	var sb strings.Builder
	sb.WriteString("Known facts:\n")

	for _, edge := range graphData.Edges {
		switch edge.Type {
		case "relation":
			sb.WriteString(fmt.Sprintf("- %s %s %s.\n", edge.From, edge.Label, edge.To))
		case "equivalence":
			sb.WriteString(fmt.Sprintf("- %s is equivalent to %s.\n", edge.From, edge.To))
		case "group":
			sb.WriteString(fmt.Sprintf("- The group '%s' contains %s.\n", edge.From, edge.To))
		}
	}

	prompt := fmt.Sprintf(`Vous êtes un assistant d'enquête intelligent.
En vous basant uniquement sur les faits suivants, rédigez un résumé de la situation.
Quels sont les points clés, les principaux suspects et les pistes à explorer ?
Soyez concis et direct.\n\n%s`, sb.String())

	return s.Generate(prompt, "")
}

// AnalyzePath analyzes a semantic path
func (s *OllamaService) AnalyzePath(path []string, notes map[string][]string) (string, error) {
	storyBuilder := BuildPathStory(path, notes)

	prompt := fmt.Sprintf(`Vous êtes un analyste sémantique.
La séquence de faits suivante représente un chemin logique découvert dans un graphe de connaissances :
\n%s\n
Analysez cette séquence et déterminez s'il s'agit principalement d'une chaîne causale,
d'une simple corrélation, ou si elle révèle une possible contradiction.
Justifiez votre réponse en une ou deux phrases.`, storyBuilder)

	return s.Generate(prompt, "")
}

// CleanOllamaJSON cleans the JSON response from Ollama
func CleanOllamaJSON(rawJson string) string {
	start := strings.Index(rawJson, "{")
	end := strings.LastIndex(rawJson, "}")
	if start == -1 || end == -1 || start > end {
		start = strings.Index(rawJson, "[")
		end = strings.LastIndex(rawJson, "]")
		if start == -1 || end == -1 || start > end {
			return ""
		}
	}
	return rawJson[start : end+1]
}

// AnalyzeClusters generates an analysis of node clusters using AI
func (s *OllamaService) AnalyzeClusters(clusters map[string][]string, graphData models.GraphData) (string, error) {
	var sb strings.Builder
	sb.WriteString("Analyse les clusters de nœuds suivants et leur signification dans le contexte du graphe global.\n")
	sb.WriteString("Sois concis et va droit au but. Explique ce que chaque cluster représente et comment ils sont liés les uns aux autres.\n\n")

	for name, nodes := range clusters {
		sb.WriteString(fmt.Sprintf("Cluster '%s':\n", name))
		for _, nodeID := range nodes {
			sb.WriteString(fmt.Sprintf("- %s\n", nodeID))
		}
	}

	sb.WriteString("\nContexte du graphe global (relations):\n")
	for _, edge := range graphData.Edges {
		sb.WriteString(fmt.Sprintf("- %s %s %s\n", edge.From, edge.Label, edge.To))
	}

	prompt := sb.String()

	// Using the default model as requested by the user
	return s.Generate(prompt, "")
}
