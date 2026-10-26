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

    def reign_history_fixture(self,values):
        import xml.etree.ElementTree as ET
        from zrc_editor.demo import demo_bytes,DEMO_PLAYER,DEMO_AUTHOR
        from zrc_editor.core import signature_for
        # Omit unit carriers deliberately: these standalone records still work.
        root=ET.fromstring(demo_bytes())
        section=ET.SubElement(root,'Section',name='GameTS')
        for key,value in values.items():
            ET.SubElement(ET.SubElement(section,'Key',name=key),'Value',int=str(value))
        root.find('Signature').set('value',signature_for(root,DEMO_PLAYER,DEMO_AUTHOR,'HackersWillBeBanned'))
        return self.call(op='open',profile='reign',raw=base64.b64encode(ET.tostring(root)).decode(),
                         name='HackersWillBeBanned.SC2Bank',player=DEMO_PLAYER,author=DEMO_AUTHOR)

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

    def test_reign_unlock_history_all_heroes_totals_and_reserved_records(self):
        for action,hours,clears in [('all_full',1290,100),('all_plausible',129,2)]:
            with self.subTest(action=action):
                # Reserved history participates in sums but must not be replaced.
                data=self.reign_history_fixture({'TP6':80,'H6S1':7,'H1S10':19})
                s=bridge.sessions[data['session']]
                draft=self.call(op='preset',session=data['session'],action=action)
                values=s['work'].values;heroes=[h['id'] for h in s['bank'].profile['heroes']]
                self.assertEqual(len(heroes),11)
                self.assertEqual(sum(values['GameTS',f'TP{h}'] for h in heroes),hours*3600)
                self.assertTrue(all(values['GameTS',f'TP{h}']>0 and values['GameTS',f'TP{h}']%20==0 for h in heroes))
                self.assertEqual(values['GameTS','TP0'],hours*3600+80)
                for shop in range(1,10):
                    self.assertTrue(all(values['GameTS',f'H{h}S{shop}']==clears for h in heroes))
                    self.assertGreaterEqual(values['GameTS',f'H0S{shop}'],sum(values['GameTS',f'H{h}S{shop}'] for h in range(1,13)))
                self.assertEqual(values['GameTS','TP6'],80)
                self.assertEqual(values['GameTS','H6S1'],7)
                self.assertEqual(values['GameTS','H1S10'],19)
                self.assertGreaterEqual(values['GameTS','HSEC'],9)
                fresh=self.call(op='open',profile='reign',raw=draft['output'],name=data['name'],player=data['player'],author=data['author'])
                self.assertEqual([f for f in draft['fields'] if f['category']=='Records'],
                                 [f for f in fresh['fields'] if f['category']=='Records'])
                self.assertEqual(s['work'],bridge.sessions[fresh['session']]['bank'].state)

    def test_reign_full_history_preserves_larger_counters_and_is_repeatable(self):
        data=self.opened('reign');s=bridge.sessions[data['session']]
        s['work'].values['GameTS','TP1']=9000000
        s['work'].values['GameTS','H1S1']=400
        first=self.call(op='preset',session=data['session'],action='all_full')
        self.assertEqual(s['work'].values['GameTS','TP1'],9000000)
        self.assertEqual(s['work'].values['GameTS','H1S1'],400)
        again=self.call(op='preset',session=data['session'],action='all_full')
        self.assertEqual(first['fields'],again['fields'])
        self.assertEqual(first['reign'],again['reign'])

    def test_reign_history_overflow_rolls_back_entire_preset(self):
        data=self.reign_history_fixture({'TP6':2147483647});s=bridge.sessions[data['session']]
        before=s['work'].clone();levels=dict(s['levels']);evos=dict(s['evos'])
        result=json.loads(bridge.handle(json.dumps(dict(op='preset',session=data['session'],action='all_full'))))
        self.assertFalse(result['ok'])
        self.assertEqual(s['work'],before)
        self.assertEqual(s['levels'],levels);self.assertEqual(s['evos'],evos)

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

