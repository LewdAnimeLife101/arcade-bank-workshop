"""Integration checks against the exact engine archive shipped to visitors."""
import base64
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREPARED = os.environ.get('ARCADE_ENGINE_TEST_DIR')
TEMP = None if PREPARED else tempfile.TemporaryDirectory()
ENGINE_DIR = str(Path(PREPARED).resolve()) if PREPARED else TEMP.name
if PREPARED:
    assert Path(ENGINE_DIR).is_dir() and not any(Path(ENGINE_DIR).iterdir()), 'Prepared test engine directory must exist and be empty.'
with zipfile.ZipFile(ROOT/'dist/engine.zip') as z:
    z.extractall(ENGINE_DIR)
sys.path.insert(0, ENGINE_DIR)
spec = importlib.util.spec_from_file_location('bridge', ROOT/'dist/bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

class BridgeTests(unittest.TestCase):
    def call(self, **request):
        result = json.loads(bridge.handle(json.dumps(request)))
        self.assertTrue(result['ok'], result.get('error'))
        return result['data']

    def opened(self, profile):
        return self.call(op='open', profile=profile, demo=True)

    def test_five_profiles_roundtrip_and_edit(self):
        for profile, label, value in [('unity','Talent points','13000'), ('liberty','Soul dust','110'), ('mineralz','Games played','3'), ('reign','Gems','25'), ('fallen','Skill level','2')]:
            with self.subTest(profile=profile):
                data=self.opened(profile)
                first=self.call(op='preview', session=data['session'])
                self.assertTrue(first['output'])
                fields=[f for f in data['fields'] if f['label'].lower()==label.lower() and not f['readonly']]
                self.assertTrue(fields, f'Missing {label}')
                field=fields[0]
                edited=self.call(op='preview', session=data['session'], edits={field['id']:value})
                self.assertEqual(str(next(f for f in edited['fields'] if f['id']==field['id'])['value']),value)
                reopened=self.call(op='open',profile=profile,raw=edited['output'],name=data['name'],player=data['player'],author=data['author'])
                self.assertEqual(reopened['fields'],edited['fields'])
                undone=self.call(op='undo',session=data['session'])
                self.assertEqual(undone['fields'],data['fields'])

    def test_invalid_edit_rolls_back_and_does_not_modify_original(self):
        data=self.opened('unity');field=data['fields'][0]
        result=json.loads(bridge.handle(json.dumps({'op':'preview','session':data['session'],'edits':{field['id']:'999999999999999'}})))
        self.assertFalse(result['ok'])
        after=self.call(op='preview',session=data['session'])
        self.assertEqual(after['fields'],data['fields'])

    def test_presets(self):
        for profile,action in [('fallen','unlock'),('reign','unlock'),('reign','loadouts'),('reign','statistics'),('liberty','soul:1')]:
            with self.subTest(profile=profile,action=action):
                data=self.opened(profile)
                edits={'["souls",1,"type"]':'15'} if profile=='liberty' else {}
                result=self.call(op='preset',session=data['session'],action=action,edits=edits)
                self.assertTrue(result['output'])

    def test_corruption_and_wrong_identity_fail(self):
        data=self.opened('fallen');output=self.call(op='preview',session=data['session'])['output']
        for raw,player in [(output,'1-S2-1-9999999'),(base64.b64encode(b'not xml').decode(),data['player'])]:
            result=json.loads(bridge.handle(json.dumps({'op':'open','profile':'fallen','name':data['name'],'raw':raw,'player':player,'author':data['author']})))
            self.assertFalse(result['ok'])

    def test_funded_bundle_preserves_editor_session_and_other_loadouts(self):
        import io
        from fwls_editor.skill_preset import EMPTY_COMPANION
        from fwls_editor.companion import parse
        data=self.opened('fallen')
        result=self.call(op='funded_skills',session=data['session'],companion=base64.b64encode(EMPTY_COMPANION).decode(),slot=2)
        with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['archive']))) as archive:
            companion=parse(archive.read('demo-FWLSBank2.SC2Bank'))
            self.assertEqual(companion.auto,2)
            self.assertEqual(companion.loadouts[2].name,'AllSkills')
            self.assertTrue(archive.read('demo-FWLSBank.SC2Bank'))
        self.assertEqual(self.call(op='preview',session=data['session'])['fields'],data['fields'])

    def test_decimal_damage_string_roundtrip(self):
        data=self.opened('fallen');field=next(f for f in data['fields'] if f['label']=='Lifetime damage dealt')
        output=self.call(op='preview',session=data['session'],edits={field['id']:'123456789012345678901234567890'})
        self.assertEqual(next(f for f in output['fields'] if f['id']==field['id'])['value'],'123456789012345678901234567890')

    def test_public_archive_contains_no_banks_or_desktop_ui(self):
        with zipfile.ZipFile(ROOT/'dist/engine.zip') as z:
            for name in z.namelist():
                self.assertFalse(name.lower().endswith(('.sc2bank','.exe','.sc2map')))
                self.assertNotEqual(Path(name).name,'app.py')
                if name.endswith(('.py','.json')):
                    text=z.read(name).decode('utf-8-sig')
                    self.assertNotIn('C:\\Users\\',text,name)

if __name__=='__main__': unittest.main()
