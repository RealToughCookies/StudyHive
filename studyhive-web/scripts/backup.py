#!/usr/bin/env python3
"""Read-only capture for the connected StudyHive project; never restores remotely."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import Request, build_opener, HTTPRedirectHandler

PROJECT = 'nqrkcxigvlwfxpzolrhv'
HOST = 'aws-0-us-west-2.pooler.supabase.com'
ROOT = Path(__file__).resolve().parents[1]
INVENTORY = """select coalesce(json_agg(x order by x.bucket_id,x.name),'[]'::json) from
(select id,bucket_id,name,updated_at,metadata from storage.objects) x"""

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Storage redirected the download; backup stopped.')

def now():
    return datetime.now(timezone.utc).isoformat()

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def tool(name):
    candidate = shutil.which(name)
    if not candidate:
        for prefix in ['/opt/homebrew/opt/libpq/bin', '/usr/local/opt/libpq/bin']:
            if (Path(prefix) / name).is_file():
                candidate = str(Path(prefix) / name)
                break
    if not candidate:
        raise ValueError(f'Missing {name}. Install libpq and age before running this tool.')
    return candidate

def db_run(name, args, env):
    result = subprocess.run([tool(name), *args], env=env, capture_output=True, timeout=1800)
    if result.returncode:
        # Emit only fixed categories: stderr can contain credentials or private rows.
        error = result.stderr.lower()
        categories = [
            (b'password authentication failed', 'Database password authentication failed.'),
            (b'no password supplied', 'No database password was supplied.'),
            (b'unsupported startup parameter', 'The pooler rejected a connection option.'),
            (b'invalid startup parameter', 'The pooler rejected a connection option.'),
            (b'permission denied', 'Database permission denied.'),
            (b'certificate verify failed', 'Database certificate verification failed.'),
            (b'could not translate host name', 'Database hostname lookup failed.'),
            (b'connection timed out', 'Database connection timed out.'),
            (b'timeout expired', 'Database connection timed out.'),
            (b'does not exist', 'A required database object or role does not exist.'),
            (b'server version mismatch', 'PostgreSQL client/server versions are incompatible.'),
        ]
        reason = next((message for marker, message in categories if marker in error),
                      'Unclassified database error; further private diagnosis is needed.')
        raise ValueError(f'{name} failed. {reason} No successful backup was published.')
    return result.stdout

def inventory(env):
    return json.loads(db_run('psql', ['-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', INVENTORY], env))

def object_url(item):
    bucket, name = item['bucket_id'], item['name']
    if not isinstance(bucket, str) or not isinstance(name, str) or not bucket or not name:
        raise ValueError('Invalid Storage inventory.')
    if '/' in bucket or '\\' in bucket or bucket in ('.', '..') or any(p in ('', '.', '..') for p in name.split('/')) or '\\' in name:
        raise ValueError('Unsafe Storage path; backup stopped.')
    return f'https://{PROJECT}.supabase.co/storage/v1/object/authenticated/{quote(bucket, safe="")}/' + '/'.join(quote(p, safe='') for p in name.split('/'))

def download(item, target, key, opener):
    req = Request(object_url(item), headers={'apikey': key, 'Authorization': 'Bearer ' + key})
    expected = item.get('metadata', {}).get('size')
    if not isinstance(expected, int) or isinstance(expected, bool) or expected < 0:
        raise ValueError('Storage inventory has no trustworthy byte size.')
    received = 0
    try:
        with opener.open(req, timeout=60) as response, target.open('xb') as out:
            for chunk in iter(lambda: response.read(1024 * 1024), b''):
                received += len(chunk)
                if received > expected:
                    raise ValueError('Storage file changed during backup.')
                out.write(chunk)
    except Exception:
        raise ValueError('A private file download failed. No successful backup was published.') from None
    if received != expected:
        raise ValueError('Downloaded file size differs from Storage inventory.')

def write_manifest(folder, details):
    details['entries'] = {p.relative_to(folder).as_posix(): {'size': p.stat().st_size, 'sha256': digest(p)}
                          for p in sorted(folder.rglob('*')) if p.is_file()}
    (folder / 'manifest.json').write_text(json.dumps(details, indent=2) + '\n')

def verify_folder(folder):
    data = json.loads((folder / 'manifest.json').read_text())
    if data.get('format') != 'studyhive-operator-backup' or data.get('version') != 1 or data.get('project') != PROJECT:
        raise ValueError('Unsupported backup manifest.')
    entries = data['entries']
    actual = {p.relative_to(folder).as_posix() for p in folder.rglob('*') if p.is_file()} - {'manifest.json'}
    if actual != set(entries):
        raise ValueError('Missing or unexpected backup file.')
    for name, record in entries.items():
        p = folder / name
        if p.stat().st_size != record['size'] or digest(p) != record['sha256']:
            raise ValueError('Backup checksum mismatch.')
    objects = data['objects']
    expected_files = {f'objects/{i:08}.bin' for i in range(len(objects))}
    if {name for name in entries if name.startswith('objects/')} != expected_files:
        raise ValueError('Storage inventory and downloaded files differ.')
    for i, item in enumerate(objects):
        object_url(item)
        if entries[f'objects/{i:08}.bin']['size'] != item['metadata']['size']:
            raise ValueError('Storage byte count mismatch.')
    if not {'database.dump', 'roles.sql', 'database-toc.txt'} <= set(entries):
        raise ValueError('Database backup is incomplete.')
    return data

def encrypt(folder, output):
    # age prompts on the controlling terminal; no passphrase enters argv or logs.
    with output.open('xb') as encrypted:
        child = subprocess.Popen([tool('age'), '-p'], stdin=subprocess.PIPE, stdout=encrypted)
        try:
            with tarfile.open(fileobj=child.stdin, mode='w|') as archive:
                for p in sorted(folder.rglob('*')):
                    if p.is_file():
                        archive.add(p, arcname=p.relative_to(folder).as_posix(), recursive=False)
            child.stdin.close()
            if child.wait() != 0:
                raise ValueError('Encryption failed; no completed backup was published.')
        finally:
            if child.poll() is None:
                child.terminate()
                child.wait()

def unpack_stream(stream, folder):
    # Never extract links, directories, absolute paths, traversal or duplicates.
    seen = set()
    with tarfile.open(fileobj=stream, mode='r|') as archive:
        for member in archive:
            name = member.name
            if not member.isfile() or name in seen or '\\' in name or any(p in ('', '.', '..') for p in name.split('/')):
                raise ValueError('Unsafe archive entry.')
            seen.add(name)
            target = folder / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as source, target.open('xb') as out:
                shutil.copyfileobj(source, out)

def capture(output):
    root_cert = ROOT / 'supabase/certs/prod-ca-2021.crt'
    if not root_cert.is_file():
        raise ValueError('Missing Supabase database CA certificate. See docs/BACKUP_RECOVERY.md.')
    for name in ['psql', 'pg_dump', 'pg_dumpall', 'pg_restore', 'age']:
        tool(name)
    if not sys.stdin.isatty():
        raise ValueError('Run capture in your own terminal for private credential entry.')
    if input('Pause edits/uploads on all devices. Type BACKUP to confirm: ') != 'BACKUP':
        raise ValueError('Capture cancelled.')
    env = os.environ.copy()
    for name in list(env):
        if name.startswith('PG'):
            del env[name]
    env.update(PGHOST=HOST, PGPORT='5432', PGDATABASE='postgres', PGUSER='postgres.' + PROJECT,
               PGSSLMODE='verify-full', PGSSLROOTCERT=str(root_cert), PGCONNECT_TIMEOUT='20',
               PGOPTIONS='-c default_transaction_read_only=on -c lock_timeout=10000',
               PGPASSWORD=getpass.getpass('Supabase database password (not your login password): '))
    key = getpass.getpass('Supabase service_role key (private, used only to download Storage): ')
    if not key or any(c.isspace() for c in key):
        raise ValueError('Missing or invalid Storage credential.')
    output = output.expanduser().resolve()
    if not output.name.endswith('.tar.age') or output.exists() or ROOT == output.parent or ROOT in output.parents:
        raise ValueError('Choose a new .tar.age file outside the source repository.')
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    partial = output.with_name(output.name + '.partial')
    if partial.exists():
        raise ValueError('Partial backup already exists; choose a new output name.')
    # Temporary plaintext requires a trusted disk (FileVault/encrypted volume recommended).
    with tempfile.TemporaryDirectory(prefix='.studyhive-capture-', dir=output.parent) as work:
        folder = Path(work)
        started = now()
        objects = inventory(env)
        (folder / 'objects').mkdir()
        print('Capturing PostgreSQL (read-only)…')
        db_run('pg_dump', ['-w', '--format=custom', '--file=' + str(folder / 'database.dump')], env)
        (folder / 'roles.sql').write_bytes(db_run('pg_dumpall', ['-w', '--roles-only', '--no-role-passwords'], env))
        toc = db_run('pg_restore', ['--list', str(folder / 'database.dump')], env)
        for required in [b'TABLE DATA auth users ', b'TABLE DATA public users ', b'TABLE DATA public notes ', b'TABLE DATA storage objects ']:
            if required not in toc:
                raise ValueError('Required Auth/application/Storage table missing from database archive.')
        (folder / 'database-toc.txt').write_bytes(toc)
        opener = build_opener(NoRedirect())
        for i, item in enumerate(objects):
            download(item, folder / 'objects' / f'{i:08}.bin', key, opener)
            print(f'Copied private file {i + 1}/{len(objects)}')
        if inventory(env) != objects:
            raise ValueError('Storage changed during capture. Pause writes and retry.')
        for source in (ROOT / 'supabase' / 'migrations').glob('*.sql'):
            dest = folder / 'migrations' / source.name
            dest.parent.mkdir(exist_ok=True)
            shutil.copyfile(source, dest)
        write_manifest(folder, {'format': 'studyhive-operator-backup', 'version': 1, 'project': PROJECT,
                       'started_at': started, 'finished_at': now(), 'objects': objects,
                       'restore_tested': False,
                       'limitations': 'No provider secrets, SMTP/CAPTCHA settings, Edge deployment or off-site copy. Auth/platform-managed restore must be reviewed in an isolated compatible environment. Storage was checked before/after, not atomically snapshotted with the database.'})
        verify_folder(folder)
        print('Choose and save a backup passphrase in your password manager. age will prompt privately.')
        encrypt(folder, partial)
        # Hard-link publication never overwrites another backup, even after a race.
        os.link(partial, output)
        partial.unlink()
    print(f'Encrypted capture saved: {output}\nRun verify next. A restore drill is still required.')

def verify(archive, inspect=False):
    archive = archive.expanduser().resolve()
    with tempfile.TemporaryDirectory(prefix='.studyhive-verify-', dir=archive.parent) as work:
        child = subprocess.Popen([tool('age'), '-d', str(archive)], stdout=subprocess.PIPE)
        try:
            unpack_stream(child.stdout, Path(work))
            # Drain to authenticate the entire age stream before accepting results.
            while child.stdout.read(1024 * 1024):
                pass
            if child.wait() != 0:
                raise ValueError('Decryption/authentication failed.')
            data = verify_folder(Path(work))
            print(f'Archive integrity verified: {len(data["objects"])} Storage files. This is not a database restore test.')
            if inspect:
                # Read archive structure only; no connection or row data is exported.
                toc = db_run('pg_restore', ['--list', str(Path(work) / 'database.dump')],
                             {k: v for k, v in os.environ.items() if not k.startswith('PG')})
                report = archive.with_name(archive.name + '.restore-inventory.txt')
                with report.open('xb') as out:
                    out.write(b'Restore inspection only; no database changes performed.\n')
                    out.write(b'Intended test target: llhttvndnusoalbcvfzr\n')
                    out.write(b'Production target is forbidden: nqrkcxigvlwfxpzolrhv\n\n')
                    out.write(toc)
                print(f'Restore structure report saved: {report}')
        finally:
            child.stdout.close()
            if child.poll() is None:
                child.terminate()
                child.wait()

def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['capture', 'verify', 'inspect'])
    parser.add_argument('path', type=Path, help='new encrypted output path (capture), or existing archive (verify)')
    args = parser.parse_args()
    try:
        if args.action == 'capture':
            capture(args.path)
        else:
            verify(args.path, inspect=args.action == 'inspect')
    except (Exception, KeyboardInterrupt) as error:
        # Never print arbitrary provider/SQL exceptions or credential-bearing URLs.
        print(str(error) if isinstance(error, ValueError) else 'Backup operation failed or was cancelled. No recovery claim was made.', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
