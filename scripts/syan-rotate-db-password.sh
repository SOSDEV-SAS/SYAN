set -euo pipefail

cd /srv/projects/syan
set -a
source docker/.env
set +a

[[ $DB_USERNAME =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
new_password=$(openssl rand -hex 32)
printf 'ALTER ROLE "%s" WITH PASSWORD '\''%s'\'';\n' "$DB_USERNAME" "$new_password" | docker exec -i syan_postgres psql --username "$DB_USERNAME" --dbname "$DB_DATABASE_NAME" >/dev/null
printf 'DB_PASSWORD=%s\n' "$new_password" | python3 /tmp/syan-storage-env.py
unset new_password
