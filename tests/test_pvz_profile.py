import copy, hashlib, sys, unittest
from pathlib import Path
import xml.etree.ElementTree as ET

sys.path.append(str(Path(__file__).resolve().parents[1]/'dist/engine.zip'))
from pvz_editor.core import Bank, BankError, NAMES, signature_for, matches_structure, level_xp
from pvz_editor.demo import demo_bytes

PLAYER='1-S2-1-1234567';AUTHOR='1-S2-1-7654321'
def bank(raw=None,name=NAMES[0]):return Bank(raw or demo_bytes(name),Path(name+'.SC2Bank'),player=PLAYER,author=AUTHOR)

class PvZProfileTests(unittest.TestCase):
    def test_all_bank_variants(self):
        for name,count in zip(NAMES,[281,33,6]):
            b=bank(name=name);self.assertFalse(b.errors);self.assertEqual(len(b.state.values),count)
            self.assertEqual(b.render(b.state.clone())[0],b.raw)
            self.assertTrue(matches_structure(b.root))
    def test_win_loss_game_dependency(self):
        b=bank();s=b.state.clone();s.values['HumanStats/Wins']=20;s.values['HumanStats/Losses']=4
        raw,effective,notes=b.render(s)
        self.assertEqual(effective.values['HumanStats/Games'],24)
        self.assertEqual(bank(raw).state,effective)
        # Further previews after automatic dependency updates remain valid.
        effective.values['HumanStats/Wins']=21
        self.assertEqual(b.render(effective)[1].values['HumanStats/Games'],25)
    def test_points_rank_and_validation_boundary(self):
        b=bank();s=b.state.clone();s.values['VampireStats/Wins']=2;s.values['VampireStats/Points']=1751
        self.assertEqual(b.render(s)[1].values['VampireStats/Rank'],'D')
        s.values['VampireStats/Points']=1752
        with self.assertRaisesRegex(BankError,'require more wins'):b.render(s)
        s.values['VampireStats/Points']=500001
        with self.assertRaisesRegex(BankError,'supported range'):b.render(s)
    def test_original_loader_relationships(self):
        r=ET.fromstring(demo_bytes());r.find("Section[@name='HumanStats']/Key[@name='Games']/Value").set('int','2')
        r.find('Signature').set('value',signature_for(r,PLAYER,AUTHOR,NAMES[0]))
        self.assertIn('Games must equal',bank(ET.tostring(r)).errors[0])
    def test_reward_funds_role_xp(self):
        b=bank();s=b.state.clone();s.values['Rewards/17']=True;s.values['Rewards/32']=True
        raw,e,n=b.render(s)
        self.assertEqual(e.values['HumanStats/XP'],level_xp(51));self.assertEqual(e.values['VampireStats/XP'],level_xp(45))
        self.assertEqual(bank(raw).state,e)
        # Once saved, an XP reduction cannot strand an enabled reward.
        fresh=bank(raw);t=fresh.state.clone();t.values['HumanStats/XP']=0
        self.assertEqual(fresh.render(t)[1].values['HumanStats/XP'],level_xp(51))
    def test_all_achievement_flags(self):
        b=bank();s=b.state.clone()
        for key in s.values:
            if key.startswith('Achievments'):s.values[key]=True
        raw,e,n=b.render(s);self.assertEqual(sum(v is True for k,v in e.values.items() if k.startswith('Achievments')),207)
        self.assertEqual(bank(raw).state,e)
    def test_text_canonicalization_and_preservation(self):
        b=bank();r=copy.deepcopy(b.root);value=r.find("Section[@name='PlayerInfo']/Key[@name='PlayerName']/Value")
        original_sig=signature_for(r,PLAYER,AUTHOR,NAMES[0]);value.set('text','<c val="AA00FF">Different localized name</c>')
        self.assertEqual(signature_for(r,PLAYER,AUTHOR,NAMES[0]),original_sig)
        r.find('Signature').set('value',original_sig);fresh=bank(ET.tostring(r));s=fresh.state.clone();s.values['HumanStats/XP']=100
        out=fresh.render(s)[0];self.assertEqual(bank(out).state.values['PlayerInfo/PlayerName'],value.get('text'))
        s.values['PlayerInfo/PlayerName']='Other'
        with self.assertRaisesRegex(BankError,'read-only'):fresh.render(s)
    def test_unknown_field_preservation(self):
        r=ET.fromstring(demo_bytes());section=ET.SubElement(r,'Section',name='Future');node=ET.SubElement(section,'Key',name='Keep');ET.SubElement(node,'Value',string='untouched')
        r.find('Signature').set('value',signature_for(r,PLAYER,AUTHOR,NAMES[0]));b=bank(ET.tostring(r));s=b.state.clone();s.values['HumanStats/XP']=100
        self.assertEqual(ET.fromstring(b.render(s)[0]).find("Section[@name='Future']/Key/Value").get('string'),'untouched')
    def test_companion_edits_do_not_add_signature_to_unsigned(self):
        for name,key in [(NAMES[1],'GameplayOptions/AutoCastRepairAbility'),(NAMES[2],'Options/Night')]:
            b=bank(name=name);s=b.state.clone();s.values[key]=not s.values[key]
            raw,e,n=b.render(s);fresh=bank(raw,name);self.assertFalse(fresh.errors);self.assertEqual(fresh.state,e)
            self.assertEqual(fresh.root.find('Signature') is None,name==NAMES[2])
    def test_reject_wrong_signature_identity_and_structure(self):
        b=Bank(demo_bytes(),Path(NAMES[0]+'.SC2Bank'),player=AUTHOR,author=PLAYER);self.assertTrue(b.errors)
        b=bank(demo_bytes(NAMES[1]));self.assertTrue(b.errors)
        with self.assertRaises(BankError):bank().render(type(bank().state)({'junk':0}))
        raw=demo_bytes().replace(b'<Bank',b'<!DOCTYPE Bank [<!ENTITY bad "x">]><Bank',1);self.assertTrue(bank(raw).errors)
if __name__=='__main__':unittest.main()
