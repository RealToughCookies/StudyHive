#!/usr/bin/env python3
"""Restore and verify archived files only in the pinned restore-test project."""
import argparse
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.request import Request, build_opener
from urllib.error import HTTPError
import backup as b
import restore_drill as r

TRIGGERS = {'study_file_account_guard', 'study_file_capacity', 'study_file_cleanup_guard'}

def validate_key(key):
    # A routing guard, not signature validation (the target service verifies that).
    try:
        payload = key.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        if claims.get('ref') != r.TARGET or claims.get('role') != 'service_role':
            raise ValueError()
    except Exception:
        raise ValueError('Use the restore-test project legacy service_role key, not the production key.') from None

def target_url(item, download=False):
    # Reuse strict bucket/path encoding, but never send a key or bytes to production.
    source = b.object_url(item)
    prefix = f'https://{b.PROJECT}.supabase.co/storage/v1/object/authenticated/'
    if not source.startswith(prefix) or r.TARGET != 'llhttvndnusoalbcvfzr':
        raise ValueError('Invalid restore destination.')
    return f'https://{r.TARGET}.supabase.co/storage/v1/object/' + ('authenticated/' if download else '') + source[len(prefix):]

def trigger_selection(toc):
    chosen = []
    names = set()
    for line in toc.splitlines():
        m = re.match(r'^\d+; \d+ \d+ TRIGGER storage objects (\w+) ', line)
        if m and m[1] in TRIGGERS:
            chosen.append(line)
            names.add(m[1])
    if names != TRIGGERS or len(chosen) != 3:
        raise ValueError('Required Storage protections are missing or duplicated in archive.')
    return '\n'.join(chosen) + '\n'

def request(opener, req):
    try:
        return opener.open(req, timeout=90)
    except HTTPError as error:
        raise ValueError(f'Test Storage request failed (HTTP {error.code}); no full restore claim.') from None
    except Exception:
        raise ValueError('Test Storage request failed; no full restore claim.') from None

def verify_bytes(opener, item, key, expected_digest):
    headers = {'apikey':key, 'Authorization':'Bearer ' + key}
    h = hashlib.sha256()
    size = 0
    with request(opener, Request(target_url(item, download=True), headers=headers)) as response:
        for chunk in iter(lambda: response.read(1024 * 1024), b''):
            size += len(chunk)
            if size > item['metadata']['size']:
                raise ValueError('Restored file exceeds archived byte count.')
            h.update(chunk)
    if size != item['metadata']['size'] or h.hexdigest() != expected_digest:
        raise ValueError('Restored file checksum differs from archive; no overwrite attempted.')

def run(archive):
    if not sys.stdin.isatty():
        raise ValueError('Run in your own Terminal for private credential entry.')
    archive = archive.expanduser().resolve()
    report_path = archive.with_name(archive.name + '.database-restore.json')
    report = json.loads(report_path.read_text())
    if report.get('target') != r.TARGET or report.get('archive_sha256') != b.digest(archive) or report.get('database_stage') != 'passed':
        raise ValueError('No matching completed database-stage report.')
    if report.get('file_stage') == 'passed':
        raise ValueError('File stage already passed. Continue with app acceptance.')
    with tempfile.TemporaryDirectory(prefix='.studyhive-verify-', dir=archive.parent) as work:
        folder = Path(work)
        child = subprocess.Popen([b.tool('age'), '-d', str(archive)], stdout=subprocess.PIPE)
        try:
            b.unpack_stream(child.stdout, folder)
            while child.stdout.read(1024 * 1024): pass
            if child.wait() != 0: raise ValueError('Backup authentication failed.')
        finally:
            child.stdout.close()
            if child.poll() is None:
                child.terminate(); child.wait()
        manifest = b.verify_folder(folder)
        listing = folder / 'storage-triggers.list'
        env = r.connection_env(getpass.getpass('RESTORE TEST project database password: '))
        toc = b.db_run('pg_restore', ['--list', str(folder / 'database.dump')], env).decode()
        listing.write_text(trigger_selection(toc))
        # Refuse a used/changed test database; this stage only follows this snapshot.
        for table, count in report['table_counts'].items():
            if not re.fullmatch(r'(public|auth|storage)\.[a-z_][a-z0-9_]*', table) or type(count) is not int:
                raise ValueError('Invalid database report.')
            actual = b.db_run('psql', ['-X', '-w', '-At', '-v', 'ON_ERROR_STOP=1', '-c', f'SELECT count(*) FROM {table}'], env).strip()
            if actual != str(count).encode(): raise ValueError('Test database changed since database restore; stop for review.')
        private = b.db_run('psql', ['-X','-w','-At','-c', 'SELECT count(*) FROM storage.buckets WHERE public'], env).strip()
        if private != b'0': raise ValueError('Restore requires private Storage buckets.')
        existing = {(o['bucket_id'],o['name']) for o in b.inventory(env)}
        expected = {(o['bucket_id'],o['name']) for o in manifest['objects']}
        if not existing <= expected: raise ValueError('Test project contains unexpected files.')
        if len(expected) != len(manifest['objects']): raise ValueError('Duplicate archived object paths.')
        present = b.db_run('psql', ['-X','-w','-At','-c', "SELECT count(*) FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND tgname IN ('study_file_account_guard','study_file_capacity','study_file_cleanup_guard')"], env).strip()
        if present != b'0': raise ValueError('Storage triggers already installed; review stage status before retrying.')
        key = getpass.getpass('RESTORE TEST project service_role key (not production): ')
        if not key or any(c.isspace() for c in key): raise ValueError('Invalid Storage key.')
        validate_key(key)
        opener = build_opener(b.NoRedirect())
        for index, item in enumerate(manifest['objects']):
            local = folder / 'objects' / f'{index:08}.bin'
            if (item['bucket_id'],item['name']) not in existing:
                if local.stat().st_size > 10485760: raise ValueError('Archived file exceeds supported upload size.')
                headers = {'apikey':key, 'Authorization':'Bearer ' + key,
                           'Content-Type':item['metadata'].get('mimetype') or 'application/octet-stream',
                           'x-upsert':'false'}
                with request(opener, Request(target_url(item), data=local.read_bytes(), headers=headers, method='POST')) as response:
                    response.read(1024)
            verify_bytes(opener, item, key, b.digest(local))
            print(f'Restored file {index + 1}/{len(manifest["objects"])}: checksum verified.')
        if {(o['bucket_id'],o['name']) for o in b.inventory(env)} != expected:
            raise ValueError('Final Storage paths differ from archive.')
        payload = folder / 'storage-triggers.sql'
        b.db_run('pg_restore', ['--no-owner', '--use-list=' + str(listing), '--file=' + str(payload), str(folder / 'database.dump')], env)
        # Historical counters were restored in the database stage. Installing AFTER
        # uploads avoids incrementing those counters for the same archived files.
        health_sql = (b.ROOT / 'supabase/operations/storage_health.sql').read_text()
        health = json.loads(b.db_run('psql', ['-X','-w','-At','-v','ON_ERROR_STOP=1','-c', 'SELECT row_to_json(h) FROM (' + health_sql.rstrip().rstrip(';') + ') h'], env))
        if health['stored_files'] != len(expected) or health['counted_files'] != len(expected) or any(v != 0 for k,v in health.items() if k not in {'stored_files','counted_files'}):
            raise ValueError('Storage health checks failed; keep test project isolated.')
        b.db_run('psql', ['-X','-w','--single-transaction','-v','ON_ERROR_STOP=1','-f',str(payload)], env)
        installed = b.db_run('psql', ['-X','-w','-At','-c', "SELECT count(*) FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND tgenabled='O' AND tgname IN ('study_file_account_guard','study_file_capacity','study_file_cleanup_guard')"], env).strip()
        if installed != b'3': raise ValueError('Storage protection installation not verified.')
        report.update(file_stage='passed', file_completed_at=b.now(), storage_health=health,
                      file_checksums_verified=len(expected), storage_triggers_verified=3,
                      file_metadata_note='Paths and bytes preserved; object IDs, owner metadata and timestamps are recreated by Storage API.',
                      full_restore_passed=False)
        temp_report = report_path.with_suffix('.json.partial')
        with temp_report.open('x') as output: json.dump(report, output, indent=2)
        os.replace(temp_report, report_path)
        print('File stage passed: checksums, paths, counters, health and Storage triggers verified.')
        print('Login, app behavior and cross-account access tests remain pending.')

def main():
    os.umask(0o077)
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('archive', type=Path)
    args = p.parse_args()
    try: run(args.archive)
    except (Exception, KeyboardInterrupt) as error:
        print(str(error) if isinstance(error, ValueError) else 'File restore stopped; keep the test project isolated.', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__': sys.exit(main())
