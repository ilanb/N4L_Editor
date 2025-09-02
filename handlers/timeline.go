package handlers

import (
	"encoding/json"
	"net/http"

	"n4l-editor/services"
)

// TimelineHandler gère les requêtes liées à la chronologie
type TimelineHandler struct {
	analyzer *services.GraphAnalyzer
}

// NewTimelineHandler crée une nouvelle instance
func NewTimelineHandler() *TimelineHandler {
	return &TimelineHandler{
		analyzer: services.NewGraphAnalyzer(),
	}
}

// GetTimelineData extrait les événements chronologiques
func (h *TimelineHandler) GetTimelineData(w http.ResponseWriter, r *http.Request) {
	var n4lNotes map[string][]string
	if err := json.NewDecoder(r.Body).Decode(&n4lNotes); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	events := h.analyzer.GetTimelineEvents(n4lNotes)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
