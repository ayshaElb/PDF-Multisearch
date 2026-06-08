# 📄 PDF Multi-Search Dashboard

Une application web moderne, fluide et **100% côté client (Client-Side)** permettant de charger un document PDF et d'effectuer des recherches simultanées sur plusieurs termes avec un tableau de bord analytique complet.

---

## ✨ Fonctionnalités

- **🔒 Confidentialité Totale** : Vos documents ne quittent jamais votre machine. Tout le traitement d'extraction de texte et de recherche est effectué localement dans votre navigateur web à l'aide de **PDF.js**.
- **📂 Interface Drag & Drop** : Glissez-déposez simplement votre fichier PDF ou cliquez pour en sélectionner un.
- **🔍 Recherche Multi-Termes** :
  - Ajoutez autant de mots-clés ou d'expressions que vous le souhaitez grâce à un système intuitif de tags.
  - Option de respect de la casse.
  - Option de recherche par mots entiers.
  - Support complet des **expressions régulières (Regex)**.
- **📊 Tableau de Bord Analytique (Dashboard)** :
  - **Cartes de Statistique** : Pages analysées, total des occurrences trouvées, terme principal le plus représenté, temps d'exécution en millisecondes.
  - **Répartition Graphique** : Visualisation des fréquences par terme sous forme de barres de progression animées.
  - **Densité par Page (Heatmap)** : Grille interactive des pages représentant l'intensité des correspondances. Cliquez sur une page pour filtrer instantanément le tableau des résultats.
- **📋 Résultats Détaillés & Filtrables** :
  - Tableau interactif avec tri des colonnes.
  - Contexte textuel environnant avec mise en surbrillance automatique du terme trouvé.
  - Pagination personnalisable (10, 25, 50, 100 lignes par page).
  - Boîte modale de détail pour prévisualiser le texte de l'occurrence et le copier rapidement dans le presse-papiers.
- **📥 Export CSV** : Exportez tous les résultats de recherche au format CSV compatible avec Microsoft Excel (encodage UTF-8 BOM avec délimiteur point-virgule `;`).

---

## 🛠️ Technologies Utilisées

- **HTML5** : Structure sémantique et responsive.
- **CSS3 (Vanilla)** :
  - Thème sombre moderne et élégant ("Obsidian Dark").
  - Design system avec variables HSL personnalisées.
  - Effets de verre semi-transparent (Glassmorphism).
  - Animations CSS3 fluides de transition et d'apparition.
- **JavaScript (ES6+)** : Logique de l'application, gestion de l'état local et manipulation du DOM.
- **PDF.js (Mozilla)** : Bibliothèque d'analyse et d'extraction de texte de documents PDF dans le navigateur.
- **FontAwesome v6** : Iconographie premium.
- **Google Fonts** : Polices de caractères *Plus Jakarta Sans* et *JetBrains Mono*.

---

## 🚀 Comment l'utiliser

Puisque l'application s'exécute uniquement côté client, vous n'avez pas besoin d'installer de base de données ni de configurer de serveur backend complexe.

### Méthode 1 : Lancement direct
1. Téléchargez ou clonez ce dépôt.
2. Double-cliquez sur le fichier `index.html` pour l'ouvrir directement dans le navigateur de votre choix (Chrome, Firefox, Safari, Edge).

### Méthode 2 : Lancement via un serveur local HTTP (Recommandé)
Si vous souhaitez le déployer ou le servir localement en HTTP :

**Avec Python :**
```powershell
# Déplacez-vous dans le dossier du projet
cd PDF-Multisearch

# Lancez le serveur local
python -m http.server 8000
```
Ouvrez ensuite votre navigateur à l'adresse : `http://localhost:8000`.

---

## 📁 Structure du Projet

```
PDF-Multisearch/
│
├── index.html   # Structure HTML5 et points d'ancrage des composants
├── style.css    # Feuille de style, thème Obsidian et design adaptatif
├── app.js       # Logique JS, moteur de recherche et gestion du PDF
└── README.md    # Documentation du projet
```
