"""Synthetic skin/dependency and preservation regressions."""
import sys
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

sys.path.append(str(Path(__file__).resolve().parents[1]/'dist/engine.zip'))
from mineralz_editor.core import Bank,validate,skin_eligible,skin_options,talent_points
from mineralz_editor.demo import demo_bank,demo_bytes,DEMO_PLAYER
from mineralz_editor.common import BankError

class Expansion(unittest.TestCase):
    def test_missing_skin_stays_absent_and_noop_exact(self):
        b=demo_bank();self.assertEqual([],b.errors)
        self.assertEqual(1,b.state.skin)
        self.assertEqual(demo_bytes(),b.render(b.state.clone())[0])
        t=b.state.clone();t.values['v1']=10
        raw=b.render(t)[0]
        self.assertIsNone(ET.fromstring(raw).find("./Section[@name='cus']"))

    def test_skin_unlocked_by_records_creates_cus_and_roundtrips(self):
        b=demo_bank();t=b.state.clone();t.values['v1']=10;t.skin=2
        raw=b.render(t)[0];fresh=Bank(raw,player=DEMO_PLAYER)
        self.assertEqual([],fresh.errors);self.assertEqual(t,fresh.state)
        self.assertEqual('2',ET.fromstring(raw).find("./Section[@name='cus']/Key[@name='skin']/Value").get('int'))

    def test_all_local_skin_thresholds(self):
        b=demo_bank()
        for skin in b.profile['skins']:
            if skin['eligibility']['type']!='night_record':continue
            rule=skin['eligibility'];t=b.state.clone();t.skin=skin['id']
            t.values[rule['key']]=rule['min']-1
            with self.assertRaises(BankError):validate(t,b.profile,before=b.state)
            t.values[rule['key']]=rule['min'];validate(t,b.profile,before=b.state)

    def test_achievement_and_test_game_requirements(self):
        b=demo_bank()
        for n in (23,24,25,31,32):
            t=b.state.clone();t.skin=n
            with self.assertRaises(BankError):validate(t,b.profile,before=b.state)
            if n<=25:t.values['testgames']=1
            else:
                i={31:105,32:107}[n];a=list(t.achievements);a[i]=str(int(a[i])+1);t.achievements=''.join(a)
            validate(t,b.profile,before=b.state)

    def test_reducing_prerequisite_cannot_leave_newly_locked_skin(self):
        b=demo_bank();original=b.state.clone();original.values['v1']=10;original.skin=2
        target=original.clone();target.values['v1']=0
        with self.assertRaises(BankError):validate(target,b.profile,before=original)
        target.skin=1;validate(target,b.profile,before=original)

    def test_external_unknown_selection_preserved_not_granted(self):
        for selection in (26,33,999):
            root=ET.fromstring(demo_bytes());s=ET.SubElement(root,'Section',name='cus')
            ET.SubElement(ET.SubElement(s,'Key',name='skin'),'Value',{'int':str(selection)})
            raw=ET.tostring(root);b=Bank(raw,player=DEMO_PLAYER)
            self.assertEqual([],b.errors);self.assertEqual(raw,b.render(b.state.clone())[0])
            t=b.state.clone();t.values['v1']=10
            self.assertEqual(selection,Bank(b.render(t)[0],player=DEMO_PLAYER).state.skin)
            self.assertIn(selection,[x['value'] for x in skin_options(b.state,b.profile)])
            fresh=demo_bank();t=fresh.state.clone();t.skin=selection
            with self.assertRaises(BankError):fresh.render(t)

    def test_all_achievement_metadata_and_derived_tp(self):
        b=demo_bank();p=b.profile
        self.assertEqual(list(range(1,109)),[a['id'] for a in p['achievements']])
        self.assertTrue(all(a['label'] and a['description'] for a in p['achievements']))
        t=b.state.clone();t.values.update(v1=20,v10=16,v11=16*4096,v12=3)
        t.achievements=''.join(str(int(c)+1) if i<7 else c for i,c in enumerate(t.achievements))
        self.assertEqual(15,talent_points(t,p))

if __name__=='__main__':unittest.main()
