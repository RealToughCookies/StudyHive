import base64
import io
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import restore_files as f

class FileRestoreTests(unittest.TestCase):
    def test_url_is_pinned_and_encoded(self):
        item={'bucket_id':'study-files','name':'3/a?b#c.txt'}
        url=f.target_url(item)
        self.assertTrue(url.startswith('https://llhttvndnusoalbcvfzr.supabase.co/storage/v1/object/study-files/'))
        self.assertIn('a%3Fb%23c.txt',url)
        with self.assertRaises(ValueError):f.target_url({'bucket_id':'study-files','name':'../secret'})

    def test_production_key_cannot_be_sent(self):
        def key(ref,role='service_role'):
            return 'x.'+base64.urlsafe_b64encode(json.dumps({'ref':ref,'role':role}).encode()).decode().rstrip('=')+'.x'
        f.validate_key(key(f.r.TARGET))
        for candidate in [key(f.b.PROJECT),key(f.r.TARGET,'anon'),'malformed']:
            with self.assertRaises(ValueError):f.validate_key(candidate)

    def test_only_three_custom_triggers_selected(self):
        lines=[f'{i}; 0 1 TRIGGER storage objects {name} supabase_storage_admin' for i,name in enumerate(sorted(f.TRIGGERS),1)]
        extra='9; 0 1 TRIGGER storage objects protect_objects_delete supabase_storage_admin'
        self.assertEqual(f.trigger_selection('\n'.join(lines+[extra])), '\n'.join(lines)+'\n')
        with self.assertRaises(ValueError):f.trigger_selection('\n'.join(lines[:-1]))

    def test_download_checks_hash_and_length(self):
        class Opener:
            def open(self,*args,**kwargs):return io.BytesIO(b'hello')
        item={'bucket_id':'study-files','name':'3/test.txt','metadata':{'size':5}}
        f.verify_bytes(Opener(),item,'synthetic',f.hashlib.sha256(b'hello').hexdigest())
        with self.assertRaises(ValueError):f.verify_bytes(Opener(),item,'synthetic',f.hashlib.sha256(b'world').hexdigest())
        item['metadata']['size']=4
        with self.assertRaises(ValueError):f.verify_bytes(Opener(),item,'synthetic',f.hashlib.sha256(b'hello').hexdigest())

    def test_provider_error_does_not_leak(self):
        class Opener:
            def open(self,*args,**kwargs):raise RuntimeError('SECRET PRIVATE')
        with self.assertRaises(ValueError) as e:f.request(Opener(),None)
        self.assertNotIn('SECRET',str(e.exception))

if __name__ == '__main__':unittest.main()
