# Éditeur N4L - Note for Life

## 🌐 Description

L'**Éditeur N4L** (Note for Life) est une application web innovante pour la gestion et l'analyse de connaissances basée sur un système de notation sémantique. Ce projet permet de créer, visualiser et analyser des graphes de connaissances en utilisant un format de notation propriétaire qui capture les relations entre concepts.

### Caractéristiques principales

* 📝 **Format N4L** : Système de notation sémantique avec sujets et relations
* 🧠 **Intégration IA** : Utilisation d'Ollama pour l'analyse et la génération de contenu
* 📊 **Visualisation de graphe** : Interface interactive avec vis-network
* 🔍 **Modes d'analyse multiples** : Investigation, questionnement socratique, analyse temporelle
* 📈 **Versioning sémantique** : Historique et évolution des graphes de connaissances
* 🎯 **Vue densité conceptuelle** : Cartographie thermique des zones de connaissances

## 🏗️ Architecture

### Backend (Go)

```
├── main.go                 # Point d'entrée, configuration serveur
├── handlers/               # Gestionnaires HTTP
│   ├── analysis.go        # Analyse de graphe avec IA
│   ├── concepts.go        # Extraction et gestion des concepts
│   ├── density.go         # Analyse de densité conceptuelle
│   ├── graph.go           # Opérations sur le graphe
│   ├── history.go         # Versioning sémantique
│   ├── investigation.go   # Mode enquête guidée
│   ├── socratic.go        # Questionnement socratique
│   └── timeline.go        # Analyse temporelle
├── services/
│   ├── graph_analyzer.go  # Analyse avancée de graphes
│   ├── ollama.go          # Intégration avec Ollama LLM
│   └── parser.go          # Parsing du format N4L
├── models/
│   └── types.go           # Structures de données
└── utils/
    └── helpers.go         # Fonctions utilitaires
```

### Frontend (JavaScript)

```
├── static/
│   ├── index.html         # Interface principale
│   ├── css/
│   │   └── styles.css     # Styles personnalisés
│   └── js/
│       ├── app.js         # Application principale
│       ├── editor.js      # Éditeur de code N4L
│       ├── graph.js       # Visualisation du graphe
│       ├── density.js     # Vue densité
│       ├── history.js     # Gestion de l'historique
│       ├── investigation.js # Mode investigation
│       ├── socratic.js    # Mode socratique
│       └── utils.js       # Utilitaires frontend
```

## 🚀 Installation

### Prérequis

* **Go** 1.19+
* **Ollama** installé et lancé localement (port 11434)
* Navigateur web moderne

### Étapes d'installation

1. **Cloner le repository**

```bash
git clone [votre-repo]
cd n4l-editor
```

2. **Installer les dépendances Go**

```bash
go mod download
```

3. **Lancer Ollama**

```bash
ollama serve
```

4. **Démarrer l'application**

```bash
go run main.go
```

5. **Accéder à l'application**

```
http://localhost:8080
```

## 📋 Format N4L

Le format N4L utilise une syntaxe simple pour définir des sujets et leurs relations :

### Syntaxe de base

```
[Sujet Principal]
- Note ou concept lié au sujet
- sujet_source -> relation -> sujet_cible
- groupe => {élément1, élément2, élément3}
```

### Exemple

```
[Intelligence Artificielle]
- L'IA transforme notre monde
- IA -> utilise -> apprentissage automatique
- IA -> nécessite -> données
- Techniques => {deep learning, NLP, vision par ordinateur}

[Apprentissage Automatique]
- Sous-domaine de l'IA
- apprentissage automatique -> produit -> modèles prédictifs
```

## 🎯 Fonctionnalités principales

### 1. Import et Parsing

* **Import de fichiers texte** : Extraction automatique de concepts
* **Génération N4L par IA** : Conversion de texte brut en format N4L
* **Parsing N4L** : Interprétation et validation du format

### 2. Visualisation de graphe

* **Graphe interactif** : Navigation et manipulation en temps réel
* **Vue en couches** : Organisation hiérarchique des concepts
* **Cône d'expansion** : Exploration progressive du graphe
* **Clustering** : Identification automatique de groupes

### 3. Modes d'analyse

#### Mode Investigation 🔍

* Assistant guidé pour l'enquête structurée
* Étapes progressives : acteurs → lieux → chronologie → motifs → preuves
* Suggestions contextuelles basées sur le graphe

#### Mode Socratique 🤔

* Questionnement progressif pour approfondir la compréhension
* Trois modes : exploration, contradiction, synthèse
* Sauvegarde et chargement de sessions

#### Analyse temporelle ⏱️

* Détection de patterns temporels
* Timeline des événements
* Identification des séquences causales

### 4. Versioning sémantique

* **Sauvegarde automatique** : Points de contrôle réguliers
* **Historique complet** : Toutes les versions avec métriques
* **Comparaison** : Diff entre versions
* **Restauration** : Retour à une version antérieure
* **Moments Eureka** : Détection automatique des percées

### 5. Vue densité conceptuelle

* **Carte thermique** : Visualisation de la densité des connaissances
* **Territoires conceptuels** : Zones explorées vs inexplorées
* **Suggestions d'exploration** : Recommandations pour équilibrer le graphe

## 🔌 API Endpoints

### Concepts et Parsing

* `POST /api/extract-concepts` : Extraction de concepts d'un fichier
* `POST /api/auto-extract-subjects` : Extraction IA de sujets
* `POST /api/parse-n4l` : Parsing de notation N4L
* `POST /api/generate-n4l-from-text` : Génération N4L par IA

### Graphe

* `POST /api/graph-data` : Conversion N4L vers graphe
* `POST /api/find-all-paths` : Recherche de chemins
* `POST /api/layered-graph` : Génération vue en couches
* `POST /api/graph/expansion-cone` : Cône d'expansion
* `POST /api/find-clusters` : Détection de clusters

### Analyse

* `POST /api/analyze-graph` : Analyse IA du graphe
* `POST /api/detect-temporal-patterns` : Patterns temporels
* `POST /api/check-consistency` : Vérification de cohérence
* `POST /api/generate-questions` : Questions d'investigation

### Historique

* `POST /api/save-version` : Sauvegarde de version
* `GET /api/version-history` : Liste des versions
* `POST /api/restore-version` : Restauration
* `POST /api/compare-versions` : Comparaison

### Modes spéciaux

* `POST /api/investigation-mode` : Mode enquête
* `POST /api/start-socratic` : Session socratique
* `POST /api/density-map` : Carte de densité

## 🛠️ Technologies utilisées

* **Backend** : Go
* **IA** : Ollama (LLM local)
* **Frontend** : JavaScript vanilla, TailwindCSS
* **Visualisation** : vis-network
* **Éditeur** : CodeMirror
* **Build** : Module Go standard

## 📝 Configuration

Le serveur utilise les paramètres suivants (modifiables dans `main.go`) :

```go
const (
    port         = ":8080"
    ollamaAPIURL = "http://localhost:11434/api/generate"
)
```

## 🤝 Contribution

Les contributions sont bienvenues ! Voici comment participer :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous Apache License. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Mentions

* **Mark Burgess** et son projet [SSTorytime](https://github.com/markburgess/SSTorytime) pour l'inspiration sur la représentation sémantique des connaissances

## 📞 Support

Pour toute question ou problème, veuillez ouvrir une issue sur le repository GitHub.
