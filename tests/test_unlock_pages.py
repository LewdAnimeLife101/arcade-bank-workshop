"""Shared unlock pages exercise the exact browser engine, never user files."""
import base64,json,unittest
from unittest.mock import patch
from test_bridge import bridge

PROFILES=('unity','liberty','mineralz','reign','fallen','mineralz_evolution_258','probes_zealot_2118')

class UnlockPageTests(unittest.TestCase):
    def call(self,**request):
        result=json.loads(bridge.handle(json.dumps(request)))
        self.assertTrue(result['ok'],result.get('error'))
        return result['data']

    def opened(self,pid):return self.call(op='open',profile=pid,demo=True)

    def test_every_profile_has_organized_fields_and_coverage(self):
        from arcade_editor.editor_layout import ORDER
        for pid in PROFILES:
            with self.subTest(profile=pid):
                data=self.opened(pid);fields=data['fields']
                self.assertEqual(len(fields),len({f['id'] for f in fields}))
                if pid!='reign':
                    self.assertTrue(all(f['category'] in ORDER for f in fields))
                    self.assertEqual([ORDER.index(f['category']) for f in fields],sorted(ORDER.index(f['category']) for f in fields))
                else:
                    self.assertTrue(all(f['category'] in {'Heroes','Ascendancy','Perks','Charms','Resources','Records','Preferences','Advanced'} for f in fields))
                self.assertTrue(data['presetCoverage']['summary'])
                self.assertTrue(data['presetCoverage']['limits'])
                self.assertIsInstance(data['presetActions'],list)
        data=self.opened('reign')
        self.assertEqual(len(data['reign']['glyphs']['heroes']),11)
        self.assertTrue(all(len([s for s in h['slots'] if s['location']=='equipped'])==4 for h in data['reign']['glyphs']['heroes']))
        self.assertEqual(len({f['hero'] for f in data['fields'] if f['category']=='Ascendancy'}),11)
        self.assertEqual(len([a for a in data['presetActions'] if a['action'].startswith('reign:')]),7)
        self.assertTrue(self.opened('mineralz')['presetCoverage']['partial'])

    def test_both_presets_validate_reopen_undo_and_preserve_originals(self):
        for pid in PROFILES:
            for action in ('all_full','all_plausible'):
                with self.subTest(profile=pid,action=action):
                    data=self.opened(pid);session=bridge.sessions[data['session']]
                    original=session['bank'].raw
                    draft=self.call(op='preset',session=data['session'],action=action)
                    self.assertEqual(original,session['bank'].raw)
                    self.assertEqual(base64.b64decode(draft['original']),original)
                    self.assertTrue(draft['notes'])
                    reopened=self.call(op='open',profile=pid,raw=draft['output'],name=data['name'],player=data['player'],author=data['author'])
                    self.assertEqual(draft['fields'],reopened['fields'])
                    undo=self.call(op='undo',session=data['session'])
                    self.assertEqual(data['fields'],undo['fields'])

    def test_presets_roll_back_pending_edit_if_plan_fails(self):
        data=self.opened('unity');field=next(f for f in data['fields'] if f['label']=='Talent points')
        with patch('arcade_editor.preset_catalog.apply',side_effect=ValueError('test plan failed')):
            result=json.loads(bridge.handle(json.dumps(dict(op='preset',session=data['session'],action='all_full',edits={field['id']:'12000'}))))
        self.assertFalse(result['ok'])
        after=self.call(op='preview',session=data['session'])
        self.assertEqual(after['fields'],data['fields'])

    def test_reign_individual_actions_produce_valid_copies(self):
        data=self.opened('reign')
        for action in data['presetActions']:
            with self.subTest(action=action['action']):
                opened=self.opened('reign')
                self.assertTrue(self.call(op='preset',session=opened['session'],action=action['action'])['output'])

    def test_evolution_lower_records_retain_menu_availability(self):
        states=[]
        for action in ('all_full','all_plausible'):
            data=self.opened('mineralz_evolution_258')
            draft=self.call(op='preset',session=data['session'],action=action)
            states.append({f['id']:f for f in draft['fields']})
        for key,f in states[0].items():
            if f['kind']=='info':self.assertEqual(f['value'],states[1][key]['value'],f['label'])
        self.assertTrue(any(f['value']!=states[1][key]['value'] for key,f in states[0].items()))

if __name__=='__main__':unittest.main()

