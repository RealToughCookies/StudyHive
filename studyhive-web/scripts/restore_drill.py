#!/usr/bin/env python3
"""Restore database stage into the owner's EMPTY, isolated test project only."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import backup as b

TARGET = 'llhttvndnusoalbcvfzr'
HOST = 'aws-0-ca-central-1.pooler.supabase.com'
# Login credentials/identities are restored; old sessions and one-time links are not.
AUTH_KEEP = {'users', 'identities'}
AUTH_EPHEMERAL = {'audit_log_entries', 'flow_state', 'one_time_tokens', 'refresh_tokens',
                  'sessions', 'mfa_amr_claims', 'mfa_challenges', 'webauthn_challenges',
                  'oauth_client_states', 'saml_relay_states', 'schema_migrations', 'instances'}
EMPTY_GUARD = """DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public')
 OR EXISTS (SELECT 1 FROM auth.users)
 OR EXISTS (SELECT 1 FROM storage.buckets)
 OR EXISTS (SELECT 1 FROM storage.objects)
 THEN RAISE EXCEPTION 'Restore target is not empty'; END IF;
END $$;
"""

def connection_env(password):
    if TARGET == b.PROJECT or TARGET != 'llhttvndnusoalbcvfzr':
        raise ValueError('Restore destination is not the approved test project.')
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env.update(PGHOST=HOST, PGPORT='5432', PGDATABASE='postgres', PGUSER='postgres.' + TARGET,
               PGSSLMODE='verify-full', PGSSLROOTCERT=str(b.ROOT / 'supabase/certs/prod-ca-2021.crt'),
               PGCONNECT_TIMEOUT='20', PGPASSWORD=password)
    return env

def selections(toc):
    selected = []
    for line in toc.splitlines():
        if not re.match(r'^\d+; \d+ \d+ ', line):
            continue
        entry = line.split(' ', 3)[3]
        # Preserve all public object grants/RLS, but not managed admin default grants.
        public = re.match(r'^(?:FUNCTION|TABLE|TABLE DATA|SEQUENCE|SEQUENCE OWNED BY|SEQUENCE SET|ACL|COMMENT|CONSTRAINT|FK CONSTRAINT|INDEX|TRIGGER|POLICY|ROW SECURITY|TYPE|DEFAULT ACL) public ', entry)
        if public and not (entry.startswith('DEFAULT ACL ') and entry.endswith(' supabase_admin')):
            selected.append(line)
        elif re.match(r'^TABLE DATA auth (users|identities) ', entry):
            selected.append(line)
        elif entry.startswith('TRIGGER auth users studyhive_new_account '):
            selected.append(line)
        elif entry.startswith('TABLE DATA storage buckets '):
            selected.append(line)
        elif re.match(r'^POLICY storage objects study_files_(read|upload|delete) ', entry):
            selected.append(line)
    for required in ['TABLE DATA auth users ', 'TABLE DATA auth identities ', 'TABLE DATA public users ', 'TABLE DATA public notes ']:
        if not any(required in line for line in selected):
            raise ValueError('Required restore data is absent from the archive.')
    return '\n'.join(selected) + '\n'

def copy_counts(path):
    """Count pg_dump COPY records without emitting any row contents."""
    counts = {}
    current = None
    with path.open('rb') as source:
        for line in source:
            if current is not None:
                if line.rstrip(b'\r\n') == b'\\.':
                    current = None
                else:
                    counts[current] += 1
            elif line.startswith(b'COPY '):
                match = re.match(rb'COPY ([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*) \(.*\) FROM stdin;\r?\n$', line)
                if not match:
                    raise ValueError('Unsupported COPY layout; restore requires review.')
                current = (match[1].decode(), match[2].decode())
                if current in counts:
                    raise ValueError('Duplicate COPY block.')
                counts[current] = 0
    if current is not None:
        raise ValueError('Truncated COPY data.')
    return counts

def validate_scope(counts):
    for (schema, table), count in counts.items():
        if not count:
            continue
        if schema == 'auth' and table not in AUTH_KEEP | AUTH_EPHEMERAL:
            raise ValueError('Additional persistent Auth data exists; this email/password restore requires review.')
        if schema == 'vault':
            raise ValueError('Vault data requires encryption-key recovery; restore stopped.')
        if schema == 'storage' and table not in {'buckets', 'objects', 'migrations'}:
            raise ValueError('Additional Storage data exists; restore requires review.')
        if schema not in {'public', 'auth', 'storage', 'realtime', 'vault'}:
            raise ValueError('Additional schema data exists; restore requires review.')

def run(archive):
    if not sys.stdin.isatty():
        raise ValueError('Run in your own Terminal for private passphrase/password entry.')
    archive = archive.expanduser().resolve()
    for name in ['age', 'pg_restore', 'psql']:
        b.tool(name)
    with tempfile.TemporaryDirectory(prefix='.studyhive-verify-', dir=archive.parent) as work:
        folder = Path(work)
        child = subprocess.Popen([b.tool('age'), '-d', str(archive)], stdout=subprocess.PIPE)
        try:
            b.unpack_stream(child.stdout, folder)
            while child.stdout.read(1024 * 1024):
                pass
            if child.wait() != 0:
                raise ValueError('Backup authentication failed.')
        finally:
            child.stdout.close()
            if child.poll() is None:
                child.terminate()
                child.wait()
        manifest = b.verify_folder(folder)
        dump = folder / 'database.dump'
        local_env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        toc = b.db_run('pg_restore', ['--list', str(dump)], local_env).decode()
        listing = folder / 'restore.list'
        listing.write_text(selections(toc))
        all_data = folder / 'all-data.sql'
        b.db_run('pg_restore', ['--data-only', '--file=' + str(all_data), str(dump)], local_env)
        counts = copy_counts(all_data)
        validate_scope(counts)
        expected = {f'{s}.{t}': n for (s, t), n in counts.items() if s == 'public' or (s == 'auth' and t in AUTH_KEEP) or (s == 'storage' and t == 'buckets')}
        if counts.get(('storage', 'objects'), 0) != len(manifest['objects']):
            raise ValueError('Database and file inventory counts differ; review snapshot consistency.')
        payload = folder / 'restore.sql'
        b.db_run('pg_restore', ['--no-owner', '--use-list=' + str(listing), '--file=' + str(payload), str(dump)], local_env)
        print('Target: StudyHive Restore test (' + TARGET + '). Production is not a destination.')
        print('Database stage only: account identities/password hashes, public tables, grants, RLS and buckets.')
        print('Old sessions/links are omitted. File bytes and Storage triggers are a subsequent stage.')
        if input('Type RESTORE TEST to import into the empty test project: ') != 'RESTORE TEST':
            raise ValueError('Restore cancelled.')
        env = connection_env(getpass.getpass('RESTORE TEST project database password: '))
        # Check first for a clear error, then repeat inside the atomic import.
        check = "select (exists(select 1 from pg_tables where schemaname='public') or exists(select 1 from auth.users) or exists(select 1 from storage.buckets) or exists(select 1 from storage.objects))::int"
        if b.db_run('psql', ['-X', '-w', '-At', '-v', 'ON_ERROR_STOP=1', '-c', check], env).strip() != b'0':
            raise ValueError('Restore target is not empty; no import attempted.')
        driver = folder / 'driver.sql'
        with driver.open('wb') as out:
            out.write(b'BEGIN;\nSET LOCAL session_replication_role = replica;\n')
            out.write(EMPTY_GUARD.encode())
            with payload.open('rb') as source:
                import shutil
                shutil.copyfileobj(source, out)
            # Verify all restored table counts before commit. FK constraints on public
            # data are created and validated by the post-data portion of pg_restore.
            for table, count in sorted(expected.items()):
                out.write(f"\nDO $$ BEGIN IF (SELECT count(*) FROM {table}) <> {count} THEN RAISE EXCEPTION 'Restore row count mismatch'; END IF; END $$;\n".encode())
            out.write(b"DO $$ BEGIN IF EXISTS (SELECT 1 FROM auth.identities i LEFT JOIN auth.users u ON u.id=i.user_id WHERE u.id IS NULL) THEN RAISE EXCEPTION 'Restored identity has no account'; END IF; IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'Restored application table lacks RLS'; END IF; END $$;\n")
            out.write(b'COMMIT;\n')
        b.db_run('psql', ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-f', str(driver)], env)
        report = archive.with_name(archive.name + '.database-restore.json')
        with report.open('w') as out:
            json.dump({'target': TARGET, 'completed_at': b.now(), 'archive_sha256': b.digest(archive),
                       'table_counts': expected, 'database_stage': 'passed', 'file_stage': 'pending',
                       'auth_and_app_acceptance': 'pending', 'full_restore_passed': False}, out, indent=2)
        print('Database stage committed; all selected table counts match the backup.')
        print('Report: ' + str(report))
        print('Do not use this project yet. File restoration and app acceptance remain pending.')

def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    try:
        run(args.archive)
    except (Exception, KeyboardInterrupt) as error:
        print(str(error) if isinstance(error, ValueError) else 'Restore stopped. No full recovery claim is made.', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
