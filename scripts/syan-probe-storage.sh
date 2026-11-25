set -euo pipefail

cd /srv/projects/syan
set -a
source docker/.env
set +a

image=$(docker image ls --format '{{.Repository}}:{{.Tag}}' | sed -n '/^syan-server:/p' | head -n 1)
test -n "$image"

library_volume=syan_library_probe
storage_volume=syan_storage_probe

cleanup() {
  docker volume rm "$library_volume" "$storage_volume" >/dev/null 2>&1 || true
}

trap cleanup EXIT
cleanup

docker volume create --driver local --opt type=cifs --opt "device=//$SYAN_STORAGE_HOST/SYAN_LIBRARY" --opt "o=addr=$SYAN_STORAGE_HOST,username=$SYAN_STORAGE_USERNAME,password=$SYAN_STORAGE_PASSWORD,vers=3.1.1,seal,ro,noserverino" "$library_volume" >/dev/null
docker volume create --driver local --opt type=cifs --opt "device=//$SYAN_STORAGE_HOST/SYAN_STORAGE" --opt "o=addr=$SYAN_STORAGE_HOST,username=$SYAN_STORAGE_USERNAME,password=$SYAN_STORAGE_PASSWORD,vers=3.1.1,seal,noserverino" "$storage_volume" >/dev/null

docker run --rm -v "$library_volume:/mnt:ro" "$image" node -e 'const fs=require("node:fs");const files=fs.readdirSync("/mnt/VIDEOS INSTA");if(files.length!==184)process.exit(2);console.log(`SMB_LIBRARY_FILES=${files.length}`)'
docker run --rm -v "$storage_volume:/mnt" "$image" node -e 'const fs=require("node:fs");const path="/mnt/.syan-write-probe";fs.writeFileSync(path,"S&AN");fs.unlinkSync(path);console.log("SMB_STORAGE_WRITABLE=yes")'
