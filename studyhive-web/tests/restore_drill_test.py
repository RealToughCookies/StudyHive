import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import restore_drill as r

BASE = '''1; 0 1 TABLE DATA auth users supabase_auth_admin
2; 0 2 TABLE DATA auth identities supabase_auth_admin
3; 0 3 TABLE DATA public users postgres
4; 0 4 TABLE DATA public notes postgres
'''

class RestoreTests(unittest.TestCase):
    def test_managed_schema_and_live_sessions_excluded(self):
        toc = BASE + '''5; 0 5 SCHEMA - auth supabase_admin
6; 0 6 TABLE auth users supabase_auth_admin
7; 0 7 TABLE DATA auth sessions supabase_auth_admin
8; 0 8 TABLE DATA storage objects supabase_storage_admin
9; 0 9 TRIGGER storage objects protect_objects_delete supabase_storage_admin
10; 0 10 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES supabase_admin
11; 0 11 TABLE DATA vault secrets supabase_admin
'''
        self.assertEqual(r.selections(toc), BASE)

    def test_public_security_and_custom_auth_trigger_preserved(self):
        extra = '''12; 0 12 ACL public TABLE notes postgres
13; 0 13 POLICY public notes own_read postgres
14; 0 14 ROW SECURITY public notes postgres
15; 0 15 TRIGGER auth users studyhive_new_account supabase_auth_admin
16; 0 16 POLICY storage objects study_files_read supabase_storage_admin
17; 0 17 SEQUENCE SET public users_id_seq postgres
'''
        self.assertEqual(r.selections(BASE + extra), BASE + extra)

    def test_incomplete_archive_rejected(self):
        with self.assertRaises(ValueError): r.selections(BASE.replace('TABLE DATA public notes', 'TABLE DATA public other'))

    def test_target_and_tls_cannot_be_overridden_by_environment(self):
        with patch.dict(r.os.environ, {'PGHOST':'production', 'PGSERVICE':'production', 'PGSSLMODE':'disable'}):
            env = r.connection_env('synthetic')
        self.assertEqual(env['PGHOST'], r.HOST)
        self.assertEqual(env['PGUSER'], 'postgres.llhttvndnusoalbcvfzr')
        self.assertEqual(env['PGSSLMODE'], 'verify-full')
        self.assertNotIn('PGSERVICE', env)
        with patch.object(r, 'TARGET', r.b.PROJECT):
            with self.assertRaises(ValueError): r.connection_env('synthetic')

    def test_copy_count_and_truncation(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / 'data.sql'
            p.write_bytes(b'COPY public.notes (id, text) FROM stdin;\n1\thello\\nthere\n2\tworld\n\\.\n')
            self.assertEqual(r.copy_counts(p), {('public','notes'):2})
            p.write_bytes(b'COPY public.notes (id) FROM stdin;\n1\n')
            with self.assertRaises(ValueError): r.copy_counts(p)

    def test_persistent_auth_and_encrypted_vault_fail_closed(self):
        for key in [('auth','mfa_factors'), ('auth','webauthn_credentials'), ('vault','secrets'), ('storage','buckets_vectors')]:
            with self.assertRaises(ValueError): r.validate_scope({key:1})
        r.validate_scope({('auth','users'):1, ('auth','sessions'):2, ('vault','secrets'):0})

if __name__ == '__main__': unittest.main()
