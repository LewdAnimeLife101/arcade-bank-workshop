"""Source-derived menu gates and regression for reaching night35 without victory."""
from pathlib import Path
import sys, unittest, xml.etree.ElementTree as ET
sys.path.append(str(Path(__file__).resolve().parents[1]/'dist/engine.zip'))
from mze_editor.core import Bank
from mze_editor.demo import demo_bytes
from mze_editor.unlocks import catalog,available,grant,describe
from zrc_editor.core import signature_for

PLAYER,AUTHOR='1-S2-1-1234567','1-S2-1-7654321'
def bank(**fields):
    root=ET.fromstring(demo_bytes());sec=root.find("./Section[@name='Sec']")
    for name,(kind,value) in fields.items():
        key=sec.find("./Key[@name='"+name+"']")
        if key is None:key=ET.SubElement(sec,'Key',name=name)
        leaf=key.find('Value')
        if leaf is None:leaf=ET.SubElement(key,'Value')
        leaf.attrib.clear();leaf.set(kind,str(value))
    root.find('Signature').set('value',signature_for(root,PLAYER,AUTHOR,'Banks'))
    return Bank(ET.tostring(root),player=PLAYER,author=AUTHOR)

class MenuUnlockTests(unittest.TestCase):
    def test_night35_without_hell_victory_is_fixed_by_named_unlock(self):
        b=bank(NIVO=('fixed',99),NIVEXP=('fixed',99*1224),HL=('fixed',35),HAL=('fixed',35*1631))
        self.assertFalse(b.errors);self.assertFalse(b.state.values['hell_complete'])
        row=next(r for r in catalog() if r['id']=='speciality_7')
        self.assertFalse(available(row,b.state.values))
        self.assertEqual(b.render(b.state.clone())[0],b.raw)
        target,_=grant(b.state,'speciality_7');raw,effective,_=b.render(target)
        fresh=Bank(raw,player=PLAYER,author=AUTHOR)
        self.assertFalse(fresh.errors);self.assertTrue(available(row,fresh.state.values))
        self.assertEqual(fresh.state.values['HL'],35*4096)
        self.assertEqual(fresh.root.find("./Section[@name='Sec']/Key[@name='HLO']/Value").get('fixed'),'25265')
    def test_speciality_needs_both_level_and_completion(self):
        row=next(r for r in catalog() if r['id']=='speciality_7')
        for level,complete,expected in [(98,True,False),(99,False,False),(99,True,True)]:
            values=bank().state.values;values.update(NIVO=level*4096,hell_complete=complete)
            self.assertEqual(available(row,values),expected)
    def test_historical_completion_survives_prestige_record_reset(self):
        b=bank(NIVO=('fixed',99),NIVEXP=('fixed',99*1224),HL=('fixed',0),HLO=('fixed',25265))
        self.assertFalse(b.errors)
        row=next(r for r in catalog() if r['id']=='speciality_7')
        self.assertTrue(available(row,b.state.values))
        t=b.state.clone();t.values['WINS']=10*4096
        self.assertTrue(b.render(t)[1].values['hell_complete'])
    def test_reaching_elite_and_hell_does_not_invent_completion(self):
        b=bank();t=b.state.clone();t.values.update(HL=35*4096,NIGHTELITE=35*4096)
        raw,effective,_=b.render(t)
        self.assertFalse(effective.values['hell_complete']);self.assertFalse(effective.values['elite_complete'])
        t.values.update(hell_complete=True,elite_complete=True)
        raw,effective,_=b.render(t)
        self.assertTrue(effective.values['hell_complete']);self.assertTrue(effective.values['elite_complete'])
        # Explicitly revert those flags during the same editing session.
        effective.values.update(hell_complete=False,elite_complete=False)
        out=b.render(effective)[1]
        self.assertFalse(out.values['hell_complete']);self.assertFalse(out.values['elite_complete'])
    def test_complete_menu_catalog_and_all_preset_signed_roundtrip(self):
        items=catalog();self.assertEqual(len(items),90)
        self.assertEqual(len({r['id'] for r in items}),90)
        b=bank();target,_=grant(b.state,'all');raw,state,_=b.render(target)
        fresh=Bank(raw,player=PLAYER,author=AUTHOR);self.assertFalse(fresh.errors)
        self.assertEqual(state,fresh.state)
        for row in items:
            if row.get('grantable',True):self.assertTrue(available(row,state.values),row['id'])
        self.assertEqual(state.values['NIGHTMNHD'],35*4096)
        self.assertEqual(state.values['role_mc'],b.state.values['role_mc'])
        self.assertFalse(state.values['challenge_6'])
        self.assertTrue(all(state.values['achievement_'+str(i)] for i in range(23)))
        self.assertFalse(any(r.get('action') for r in describe(state.values)))
    def test_each_unlock_plan_validates_from_fresh_bank(self):
        for row in catalog():
            if not row.get('grantable',True):continue
            with self.subTest(unlock=row['id']):
                b=bank();t,_=grant(b.state,row['id']);raw,effective,_=b.render(t)
                self.assertTrue(available(row,effective.values))
    def test_nightmare_marker_cannot_be_cleared_above_loader_threshold(self):
        b=bank();t=b.state.clone();t.values['NIGHTNMAR']=35*4096
        raw,state,_=b.render(t);b=Bank(raw,player=PLAYER,author=AUTHOR)
        state.values['nightmare_complete']=False
        with self.assertRaisesRegex(Exception,'requires its completion'):b.render(state)

if __name__=='__main__':unittest.main()
