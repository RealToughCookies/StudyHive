import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).resolve().parents[1] / 'scripts/backup.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

class BackupTests(unittest.TestCase):
    def test_capture_requires_ca_before_credentials(self):
        with tempfile.TemporaryDirectory() as empty, patch.object(b, 'ROOT', Path(empty)), patch.object(b.getpass, 'getpass') as prompt:
            with self.assertRaisesRegex(ValueError, 'CA certificate'):
                b.capture(Path(empty) / 'unused.tar.age')
            prompt.assert_not_called()

    def test_capture_uses_supabase_ca_and_full_verification(self):
        with patch.object(b, 'tool'), patch.object(b.sys.stdin, 'isatty', return_value=True), patch('builtins.input', return_value='BACKUP'), patch.object(b.getpass, 'getpass', return_value='synthetic'), patch.object(b, 'inventory', side_effect=RuntimeError('stop before capture')) as inventory:
            with self.assertRaisesRegex(RuntimeError, 'stop before capture'):
                with tempfile.TemporaryDirectory() as dest:
                    b.capture(Path(dest) / 'test.tar.age')
            env = inventory.call_args.args[0]
            self.assertEqual(env['PGSSLMODE'], 'verify-full')
            self.assertEqual(env['PGSSLROOTCERT'], str(b.ROOT / 'supabase/certs/prod-ca-2021.crt'))

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
    def tearDown(self):
        self.tmp.cleanup()
    def fixture(self):
        (self.root / 'objects').mkdir()
        (self.root / 'objects/00000000.bin').write_bytes(b'hello')
        for name in ['database.dump', 'roles.sql', 'database-toc.txt']:
            (self.root / name).write_bytes(b'synthetic fixture')
        meta = {'format':'studyhive-operator-backup','version':1,'project':b.PROJECT,
                'objects':[{'bucket_id':'study-files','name':'3/test.txt','metadata':{'size':5}}]}
        b.write_manifest(self.root, meta)
        return meta
    def test_inventory_matches_every_file(self):
        self.fixture()
        self.assertEqual(len(b.verify_folder(self.root)['objects']), 1)
        (self.root / 'objects/00000000.bin').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing'): b.verify_folder(self.root)
    def test_same_size_corruption_rejected(self):
        self.fixture()
        (self.root / 'objects/00000000.bin').write_bytes(b'jello')
        with self.assertRaisesRegex(ValueError, 'checksum'): b.verify_folder(self.root)
    def test_uninventoried_file_rejected(self):
        self.fixture()
        (self.root / 'unexpected.txt').write_text('no')
        with self.assertRaisesRegex(ValueError, 'unexpected'): b.verify_folder(self.root)
    def test_inventory_byte_mismatch_rejected(self):
        self.fixture()
        p=self.root/'manifest.json'; data=json.loads(p.read_text()); data['objects'][0]['metadata']['size']=6;p.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'byte count'): b.verify_folder(self.root)
    def test_paths_cannot_escape_expected_project(self):
        for name in ['../secret','3/../secret','/secret','3//secret','3\\secret']:
            with self.assertRaises(ValueError): b.object_url({'bucket_id':'study-files','name':name})
        url=b.object_url({'bucket_id':'study-files','name':'3/a?b#c %2F.txt'})
        self.assertTrue(url.startswith('https://'+b.PROJECT+'.supabase.co/'))
        self.assertIn('a%3Fb%23c%20%252F.txt',url)
    def test_archive_links_traversal_and_duplicate_rejected(self):
        for name, kind, duplicate in [('../escaped',tarfile.REGTYPE,False),('/escaped',tarfile.REGTYPE,False),('link',tarfile.SYMTYPE,False),('same',tarfile.REGTYPE,True)]:
            data=io.BytesIO()
            with tarfile.open(fileobj=data,mode='w') as t:
                i=tarfile.TarInfo(name); i.type=kind;i.linkname='../outside';t.addfile(i)
                if duplicate:t.addfile(i)
            data.seek(0)
            with tempfile.TemporaryDirectory() as dest:
                with self.assertRaisesRegex(ValueError,'Unsafe'):b.unpack_stream(data,Path(dest))
    def test_failed_or_short_download_not_accepted(self):
        item={'bucket_id':'study-files','name':'3/test.txt','metadata':{'size':5}}
        class Opener:
            def open(self,*args,**kwargs): return io.BytesIO(b'four')
        with self.assertRaisesRegex(ValueError,'size differs'): b.download(item,self.root/'short','fake',Opener())
        class Failing:
            def open(self,*args,**kwargs):raise RuntimeError('SECRET=private')
        with self.assertRaisesRegex(ValueError,'private file download failed') as error:b.download(item,self.root/'failed','fake',Failing())
        self.assertNotIn('SECRET',str(error.exception))
    def test_redirect_is_not_followed(self):
        with self.assertRaisesRegex(ValueError,'redirected'):
            b.NoRedirect().redirect_request(None,None,302,'',{},'https://other.example')
    def test_database_error_does_not_leak(self):
        result=subprocess.CompletedProcess([],1,stdout=b'',stderr=b'private password or row')
        with patch.object(b,'tool',return_value='/fake/pg_dump'),patch.object(b.subprocess,'run',return_value=result):
            with self.assertRaises(ValueError) as error:b.db_run('pg_dump',[],{})
        self.assertNotIn('password or row',str(error.exception))
    def test_database_errors_report_safe_categories(self):
        for raw, category in [
            (b'FATAL: password authentication failed for user PRIVATE', 'authentication failed'),
            (b'FATAL: unsupported startup parameter: options PRIVATE', 'connection option'),
            (b'ERROR: permission denied for table PRIVATE', 'permission denied'),
            (b'SSL error: certificate verify failed PRIVATE', 'certificate verification failed'),
        ]:
            result = subprocess.CompletedProcess([], 1, stdout=b'', stderr=raw)
            with patch.object(b, 'tool', return_value='/fake/psql'), patch.object(b.subprocess, 'run', return_value=result):
                with self.assertRaisesRegex(ValueError, category) as error:
                    b.db_run('psql', [], {})
                self.assertNotIn('PRIVATE', str(error.exception))
    def test_real_age_roundtrip_and_tamper_detection(self):
        self.fixture()
        with tempfile.TemporaryDirectory() as outer:
            outer=Path(outer); identity=outer/'identity.txt'
            subprocess.run([b.tool('age-keygen'),'-o',str(identity)],check=True,capture_output=True)
            recipient=subprocess.check_output([b.tool('age-keygen'),'-y',str(identity)]).decode().strip()
            packed=io.BytesIO()
            with tarfile.open(fileobj=packed,mode='w') as archive:
                for p in self.root.rglob('*'):
                    if p.is_file():archive.add(p,arcname=p.relative_to(self.root),recursive=False)
            encrypted=subprocess.run([b.tool('age'),'-r',recipient],input=packed.getvalue(),capture_output=True,check=True).stdout
            decoded=subprocess.run([b.tool('age'),'-d','-i',str(identity)],input=encrypted,capture_output=True,check=True).stdout
            restored=outer/'restored';restored.mkdir();b.unpack_stream(io.BytesIO(decoded),restored)
            self.assertEqual(b.verify_folder(restored)['objects'][0]['name'],'3/test.txt')
            altered=bytearray(encrypted);altered[-1]^=1
            bad=subprocess.run([b.tool('age'),'-d','-i',str(identity)],input=altered,capture_output=True)
            self.assertNotEqual(bad.returncode,0)

if __name__ == '__main__': unittest.main()
