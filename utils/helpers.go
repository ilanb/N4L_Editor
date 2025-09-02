package utils

import (
	"regexp"
	"strings"
)

// ExtractSentences extrait les phrases d'un texte
func ExtractSentences(text string) []string {
	re := regexp.MustCompile(`[.!?]\s*`)
	sentences := re.Split(text, -1)

	var concepts []string
	for _, s := range sentences {
		trimmed := strings.TrimSpace(s)
		if trimmed != "" {
			concepts = append(concepts, trimmed)
		}
	}

	return concepts
}

// Contains vérifie si une slice contient un élément
func Contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// RemoveDuplicates supprime les doublons d'une slice
func RemoveDuplicates(slice []string) []string {
	seen := make(map[string]bool)
	result := []string{}

	for _, item := range slice {
		if !seen[item] {
			seen[item] = true
			result = append(result, item)
		}
	}

	return result
}

// CleanString nettoie une chaîne de caractères
func CleanString(s string) string {
	// Supprimer les guillemets et espaces
	s = strings.Trim(s, `"'`)
	s = strings.TrimSpace(s)
	return s
}

// ExtractBetween extrait le texte entre deux délimiteurs
func ExtractBetween(text, start, end string) string {
	startIdx := strings.Index(text, start)
	if startIdx == -1 {
		return ""
	}
	startIdx += len(start)

	endIdx := strings.Index(text[startIdx:], end)
	if endIdx == -1 {
		return ""
	}

	return text[startIdx : startIdx+endIdx]
}

// SplitAndClean divise une chaîne et nettoie chaque élément
func SplitAndClean(s, sep string) []string {
	parts := strings.Split(s, sep)
	result := []string{}

	for _, part := range parts {
		cleaned := CleanString(part)
		if cleaned != "" {
			result = append(result, cleaned)
		}
	}

	return result
}
