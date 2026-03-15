#!/bin/bash

# Script to replace "import { Pool } from \"pg\";" with "import pool from \"@/lib/db\";" in all API route files
# and remove all pool.end() calls

echo "🔄 Starting database pool refactoring..."

# Find all route.ts files in the app/api directory
find /Users/vishalgupta/Desktop/affiliate-portal/app/api -name "route.ts" -type f | while read file; do
    # Check if file contains "new Pool("
    if grep -q "new Pool(" "$file"; then
        echo "📝 Processing: $file"
        
        # Backup file
        cp "$file" "$file.bak"
        
        # Replace Pool import with shared pool import
        sed -i '' 's/import { Pool } from "pg";/import pool from "@\/lib\/db";/g' "$file"
        sed -i '' "s/import { Pool } from 'pg';/import pool from '@\/lib\/db';/g" "$file"
        
        # Remove pool.end() calls
        sed -i '' '/await pool\.end();/d' "$file"
        sed -i '' '/pool\.end();/d' "$file"
        
        # Remove individual pool instantiations (multi-line pattern)
        # This is tricky, so we'll use perl for better multiine handling
        perl -i -0pe 's/const pool = new Pool\(\{[^}]*\}\);?//gs' "$file"
        perl -i -0pe 's/\n\s*\n\s*\n/\n\n/g' "$file" # Clean up extra blank lines
        
        echo "   ✅ Fixed: $file"
    fi
done

echo "✨ Refactoring complete!"
echo "📋 Backup files created with .bak extension"
