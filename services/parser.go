package services

import (
	"bufio"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"n4l-editor/models"
)

// N4LParser gère le parsing des fichiers N4L
type N4LParser struct {
	contextRegex        *regexp.Regexp
	relationRegex       *regexp.Regexp
	equivalenceRegex    *regexp.Regexp
	groupRegex          *regexp.Regexp
	parenthesesRegex    *regexp.Regexp
	annotationRegex     *regexp.Regexp
	referenceRegex      *regexp.Regexp
	altEquivalenceRegex *regexp.Regexp
}

// NewN4LParser crée une nouvelle instance du parser
func NewN4LParser() *N4LParser {
	return &N4LParser{
		contextRegex:        regexp.MustCompile(`^:{2,}\s*(.*)\s*:{2,}$`),
		relationRegex:       regexp.MustCompile(`^(.*) -> (.*) -> (.*)$`),
		equivalenceRegex:    regexp.MustCompile(`^(.*) <-> (.*)$`),
		groupRegex:          regexp.MustCompile(`^(.*) => {(.*)}$`),
		parenthesesRegex:    regexp.MustCompile(`^([^()]+)\s*\(([^)]+)\)\s*(.+)$`),
		annotationRegex:     regexp.MustCompile(`>"([^"]+)"`),
		referenceRegex:      regexp.MustCompile(`\$(\w+)\.(\d+)`),
		altEquivalenceRegex: regexp.MustCompile(`^(.+)\s*\(=\)\s*(.+)$`),
	}
}

// ParseN4L parse le contenu d'un fichier N4L
func (p *N4LParser) ParseN4L(content string) models.ParsedN4L {
	notes := make(map[string][]string)
	subjectsMap := make(map[string]bool)
	currentContext := "general"
	lastSubject := ""

	scanner := bufio.NewScanner(strings.NewReader(content))

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Ignorer les lignes vides, commentaires et séparateurs
		if line == "" || strings.HasPrefix(line, "#") ||
			strings.HasPrefix(line, "+::") || strings.HasPrefix(line, "-::") {
			continue
		}

		// Gérer les contextes
		if matches := p.contextRegex.FindStringSubmatch(line); len(matches) > 1 {
			contextName := strings.TrimSpace(matches[1])
			if contextName != "_sequence_" && contextName != "sequence" {
				currentContext = contextName
				if _, ok := notes[currentContext]; !ok {
					notes[currentContext] = []string{}
				}
			}
			continue
		}

		// Nettoyer et parser la ligne
		cleanedLine, extractedSubjects := p.cleanAnnotations(line)
		for _, subject := range extractedSubjects {
			subjectsMap[subject] = true
		}

		// Gérer les références
		cleanedLine = p.handleReferences(cleanedLine, lastSubject)

		// Parser les différentes syntaxes
		if note, subjects := p.parseParenthesesSyntax(cleanedLine, lastSubject, notes[currentContext]); note != "" {
			notes[currentContext] = append(notes[currentContext], note)
			for _, s := range subjects {
				subjectsMap[s] = true
			}
			if len(subjects) > 0 {
				lastSubject = subjects[0]
			}
			continue
		}

		if note, subjects := p.parseStandardSyntax(cleanedLine); note != "" {
			notes[currentContext] = append(notes[currentContext], note)
			for _, s := range subjects {
				subjectsMap[s] = true
			}
			if len(subjects) > 0 {
				lastSubject = subjects[0]
			}
			continue
		}

		// Si ce n'est pas une relation reconnue, extraire les mots capitalisés
		if cleanedLine != "" && !strings.HasPrefix(cleanedLine, "::") {
			words := strings.Fields(cleanedLine)
			for _, word := range words {
				word = strings.Trim(word, `"'.,;:!?`)
				if len(word) > 2 && unicode.IsUpper(rune(word[0])) {
					subjectsMap[word] = true
				}
			}
			notes[currentContext] = append(notes[currentContext], cleanedLine)
		}
	}

	// Convertir la map en slice
	var subjects []string
	for s := range subjectsMap {
		if s != "" && s != `""` && s != "[" && s != "]" {
			subjects = append(subjects, s)
		}
	}

	return models.ParsedN4L{
		Subjects: subjects,
		Notes:    notes,
	}
}

// ParseN4LToGraph convertit les notes N4L en graphe
func (p *N4LParser) ParseN4LToGraph(n4lNotes map[string][]string) models.GraphData {
	nodesMap := make(map[string]string) // Map ID to context
	var edges []models.Edge

	for context, notes := range n4lNotes {
		for _, note := range notes {
			// Nettoyer les annotations
			cleanedNote, _ := p.cleanAnnotations(note)

			// Parser les différentes syntaxes
			if edge, nodes := p.parseNoteToEdge(cleanedNote, context); edge != nil {
				edges = append(edges, *edge)
				for _, node := range nodes {
					nodesMap[node] = context
				}
			}
		}
	}

	// Créer les nœuds
	var nodes []models.Node
	for nodeID, context := range nodesMap {
		if nodeID != "" && nodeID != `""` && nodeID != "[" && nodeID != "]" {
			nodes = append(nodes, models.Node{
				ID:      nodeID,
				Label:   nodeID,
				Context: context,
			})
		}
	}

	return models.GraphData{
		Nodes: nodes,
		Edges: edges,
	}
}

// cleanAnnotations nettoie les annotations et extrait les sujets
func (p *N4LParser) cleanAnnotations(line string) (string, []string) {
	var subjects []string
	cleanedLine := line

	if matches := p.annotationRegex.FindAllStringSubmatch(line, -1); len(matches) > 0 {
		for _, match := range matches {
			concept := match[1]
			cleanedLine = strings.ReplaceAll(cleanedLine, match[0], concept)
			subjects = append(subjects, concept)
		}
	}

	return cleanedLine, subjects
}

// handleReferences gère les références $variable
func (p *N4LParser) handleReferences(line, lastSubject string) string {
	if matches := p.referenceRegex.FindAllStringSubmatch(line, -1); len(matches) > 0 {
		for _, match := range matches {
			if match[1] == "goal" || match[1] == "PREV" {
				if lastSubject != "" {
					line = strings.ReplaceAll(line, match[0], lastSubject)
				} else {
					line = strings.ReplaceAll(line, match[0], "[REF:"+match[1]+"]")
				}
			}
		}
	}
	return line
}

// parseParenthesesSyntax parse la syntaxe avec parenthèses
func (p *N4LParser) parseParenthesesSyntax(line, lastSubject string, currentNotes []string) (string, []string) {
	if matches := p.parenthesesRegex.FindStringSubmatch(line); len(matches) == 4 {
		source := strings.TrimSpace(matches[1])
		relation := strings.TrimSpace(matches[2])
		target := strings.TrimSpace(matches[3])

		// Gérer les références vides
		if source == `""` || source == `"` || source == "" {
			if lastSubject != "" {
				source = lastSubject
			} else if len(currentNotes) > 0 {
				source = ExtractFirstSubject(currentNotes[len(currentNotes)-1])
			}
		}

		if source != "" && source != `""` && target != "" {
			source = strings.Trim(source, `"`)
			target = strings.Trim(target, `"`)
			normalizedNote := fmt.Sprintf("%s -> %s -> %s", source, relation, target)
			return normalizedNote, []string{source, target}
		}
	}

	// Équivalence alternative
	if matches := p.altEquivalenceRegex.FindStringSubmatch(line); len(matches) == 3 {
		source := strings.Trim(strings.TrimSpace(matches[1]), `"`)
		target := strings.Trim(strings.TrimSpace(matches[2]), `"`)

		if source != "" && target != "" {
			normalizedNote := fmt.Sprintf("%s <-> %s", source, target)
			return normalizedNote, []string{source, target}
		}
	}

	return "", nil
}

// parseStandardSyntax parse les syntaxes standard
func (p *N4LParser) parseStandardSyntax(line string) (string, []string) {
	// Relation standard
	if matches := p.relationRegex.FindStringSubmatch(line); len(matches) == 4 {
		source := strings.TrimSpace(matches[1])
		target := strings.TrimSpace(matches[3])
		return line, []string{source, target}
	}

	// Équivalence standard
	if matches := p.equivalenceRegex.FindStringSubmatch(line); len(matches) == 3 {
		source := strings.TrimSpace(matches[1])
		target := strings.TrimSpace(matches[2])
		return line, []string{source, target}
	}

	// Groupe
	if matches := p.groupRegex.FindStringSubmatch(line); len(matches) == 3 {
		parent := strings.TrimSpace(matches[1])
		children := strings.Split(matches[2], ";")

		subjects := []string{parent}
		for _, child := range children {
			childName := strings.Trim(strings.TrimSpace(child), `"`)
			if childName != "" {
				subjects = append(subjects, childName)
			}
		}
		return line, subjects
	}

	return "", nil
}

// parseNoteToEdge convertit une note en arête
func (p *N4LParser) parseNoteToEdge(note, context string) (*models.Edge, []string) {
	// Relation
	if matches := p.relationRegex.FindStringSubmatch(note); len(matches) == 4 {
		source := strings.TrimSpace(matches[1])
		label := strings.TrimSpace(matches[2])
		target := strings.TrimSpace(matches[3])

		// Nettoyer les références
		source = strings.TrimPrefix(strings.TrimSuffix(source, "]"), "[REF:")
		target = strings.TrimPrefix(strings.TrimSuffix(target, "]"), "[REF:")

		if source != "" && target != "" {
			return &models.Edge{
				From:    source,
				To:      target,
				Label:   label,
				Type:    "relation",
				Context: context,
			}, []string{source, target}
		}
	}

	// Équivalence
	if matches := p.equivalenceRegex.FindStringSubmatch(note); len(matches) == 3 {
		source := strings.TrimSpace(matches[1])
		target := strings.TrimSpace(matches[2])
		if source != "" && target != "" {
			return &models.Edge{
				From:    source,
				To:      target,
				Label:   "",
				Type:    "equivalence",
				Context: context,
			}, []string{source, target}
		}
	}

	// Groupe
	if matches := p.groupRegex.FindStringSubmatch(note); len(matches) == 3 {
		parent := strings.TrimSpace(matches[1])
		childrenStr := strings.TrimSpace(matches[2])
		children := strings.Split(childrenStr, ";")

		if parent != "" {
			nodes := []string{parent}
			for _, child := range children {
				childName := strings.Trim(strings.TrimSpace(child), `"`)
				if childName != "" {
					nodes = append(nodes, childName)
				}
			}

			// Créer une arête pour chaque enfant
			var edges []models.Edge
			for i := 1; i < len(nodes); i++ {
				edges = append(edges, models.Edge{
					From:    parent,
					To:      nodes[i],
					Label:   "contient",
					Type:    "group",
					Context: context,
				})
			}
			if len(edges) > 0 {
				return &edges[0], nodes // Retourner la première arête et tous les nœuds
			}
		}
	}

	return nil, nil
}

// ExtractFirstSubject extrait le premier sujet d'une note
func ExtractFirstSubject(note string) string {
	parts := strings.Fields(note)
	for _, part := range parts {
		part = strings.Trim(part, `"'`)
		if len(part) > 2 && !strings.Contains(part, "->") && !strings.Contains(part, "<->") {
			return part
		}
	}
	return ""
}

// BuildPathStory construit une histoire à partir d'un chemin
func BuildPathStory(path []string, notes map[string][]string) string {
	var storyBuilder strings.Builder
	relationRegex := regexp.MustCompile(`^(.*) -> (.*) -> (.*)$`)
	groupRegex := regexp.MustCompile(`^(.*) => {(.*)}$`)

	for i := 0; i < len(path)-1; i++ {
		fromNode := path[i]
		toNode := path[i+1]
		foundRelation := false

		for _, notesList := range notes {
			for _, note := range notesList {
				if matches := relationRegex.FindStringSubmatch(note); len(matches) == 4 {
					source, _, target := strings.TrimSpace(matches[1]), strings.TrimSpace(matches[2]), strings.TrimSpace(matches[3])
					if (source == fromNode && target == toNode) || (source == toNode && target == fromNode) {
						storyBuilder.WriteString(fmt.Sprintf("Fait %d: %s.\n", i+1, note))
						foundRelation = true
						break
					}
				} else if matches := groupRegex.FindStringSubmatch(note); len(matches) == 3 {
					parent := strings.TrimSpace(matches[1])
					children := strings.Split(matches[2], ";")
					for _, child := range children {
						childName := strings.TrimSpace(child)
						if (parent == fromNode && childName == toNode) || (parent == toNode && childName == fromNode) {
							storyBuilder.WriteString(fmt.Sprintf("Fait %d: %s.\n", i+1, note))
							foundRelation = true
							break
						}
					}
				}
			}
			if foundRelation {
				break
			}
		}
	}

	return storyBuilder.String()
}
