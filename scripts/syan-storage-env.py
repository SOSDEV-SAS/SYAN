import pathlib
import sys

allowed_keys = {'DB_PASSWORD', 'SYAN_STORAGE_HOST', 'SYAN_STORAGE_USERNAME', 'SYAN_STORAGE_PASSWORD'}
values = {}
for raw_line in sys.stdin:
    key, separator, value = raw_line.rstrip('\r\n').partition('=')
    if separator != '=' or key not in allowed_keys or not value:
        raise SystemExit('invalid private environment value')
    values[key] = value

if not values:
    raise SystemExit('no private environment values supplied')

path = pathlib.Path('/srv/projects/syan/docker/.env')
lines = path.read_text().splitlines()
lines = [line for line in lines if line.split('=', 1)[0] not in values]
lines.extend(f'{key}={values[key]}' for key in sorted(values))
path.write_text('\n'.join(lines) + '\n')
path.chmod(0o600)
