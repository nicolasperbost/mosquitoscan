#!/bin/bash
# Script de déploiement automatique pour MosquitoScan

PROJECT_REF="pdypseywigpzgawhlmvu"

echo "========================================================"
echo "   Déploiement de MosquitoScan sur Supabase"
echo "   ID du Projet : $PROJECT_REF"
echo "========================================================"
echo ""

# Vérification de la commande supabase
if ! command -v supabase &> /dev/null
then
    echo "Supabase CLI n'est pas installé globalement. Utilisation de npx..."
    SUPABASE_CMD="npx supabase"
else
    SUPABASE_CMD="supabase"
fi

# Demande du Token d'accès si non défini en variable d'environnement
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Vous pouvez générer un token d'accès ici : https://supabase.com/dashboard/account/tokens"
    read -p "Entrez votre Supabase Access Token : " SUPABASE_ACCESS_TOKEN
    export SUPABASE_ACCESS_TOKEN
fi

# Demande du mot de passe de base de données si non défini en variable d'environnement
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    read -s -p "Entrez le mot de passe de votre base de données Supabase : " SUPABASE_DB_PASSWORD
    echo ""
    export SUPABASE_DB_PASSWORD
fi

echo ""
echo "--------------------------------------------------------"
echo "1. Liaison (link) au projet Supabase..."
echo "--------------------------------------------------------"
$SUPABASE_CMD link --project-ref "$PROJECT_REF" -p "$SUPABASE_DB_PASSWORD"

echo ""
echo "--------------------------------------------------------"
echo "2. Envoi des migrations de la base de données..."
echo "--------------------------------------------------------"
$SUPABASE_CMD db push --password "$SUPABASE_DB_PASSWORD"

echo ""
echo "--------------------------------------------------------"
echo "3. Déploiement de la fonction Edge 'ingest-sensor'..."
echo "--------------------------------------------------------"
$SUPABASE_CMD functions deploy ingest-sensor --project-ref "$PROJECT_REF"

echo ""
echo "--------------------------------------------------------"
echo "4. Déploiement de la fonction Edge 'analyze-site-photos'..."
echo "--------------------------------------------------------"
$SUPABASE_CMD functions deploy analyze-site-photos --project-ref "$PROJECT_REF"

echo ""
echo "========================================================"
echo "   Déploiement terminé !"
echo "========================================================"
