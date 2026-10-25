"""Synthetic codec verification; fixtures contain no real player banks.

Run from this directory: python -m unittest test_expanded -v
"""
from pathlib import Path
import sys, unittest, xml.etree.ElementTree as ET
sys.path.append(str(Path(__file__).resolve().parents[1]/'dist/engine.zip'))
from mze_editor.core import Bank, SPECS, load_profile
from mze_editor.demo import demo_bytes
from mze_editor.hashing import hash_string, achievement_location
from zrc_editor.core import signature_for

PLAYER,AUTHOR='1-S2-1-1234567','1-S2-1-7654321'
def bank(raw=None): return Bank(raw or demo_bytes(),player=PLAYER,author=AUTHOR)
def sign(root):
    root.find('Signature').set('value',signature_for(root,PLAYER,AUTHOR,'Banks'))
    return ET.tostring(root,encoding='utf-8')
def value(root,section,key):
    return root.find(f"./Section[@name='{section}']/Key[@name='{key}']/Value")

class ExpandedEvolutionTests(unittest.TestCase):
    def test_hash_vectors_independent_int32_port(self):
        # Independently evaluated with JavaScript Math.imul/|0 from the source's
        # integer recurrence. These are offline vectors, not game observations.
        vectors={'achievements':'w30OIbaaod20kcaa','ach0':'9ytl7aaaB1AOucaa',
                 'ach0true':'5gAcUbaanzuA0baa','ach10':'L0yZpbaa5gUikaaa',
                 'ach10true':'lrW00baaL9KT7baa','ach22':'WEalwaaaupwukcaa',
                 'ach22true':'mc1gJaaaS7n6qcaa'}
        for text,expected in vectors.items():self.assertEqual(hash_string(text),expected)
        self.assertEqual(len({achievement_location(i)[1] for i in range(23)}),23)

    def test_signed_noop_and_unknown_fields_preserved(self):
        root=ET.fromstring(demo_bytes())
        sec=ET.SubElement(root,'Section',name='Future')
        ET.SubElement(ET.SubElement(sec,'Key',name='Opaque'),'Value',string='unchanged')
        # A partial encoded role count is preserved byte-for-byte on unrelated edits.
        ET.SubElement(ET.SubElement(root.find('Section'),'Key',name='a'),'Value',int='403')
        b=bank(sign(root));self.assertFalse(b.errors);self.assertEqual(len(b.state.values),67)
        self.assertEqual(b.render(b.state.clone())[0],b.raw)
        t=b.state.clone();t.values['NIVO']=200*4096
        raw=b.render(t)[0];out=ET.fromstring(raw)
        self.assertEqual(value(out,'Sec','a').get('int'),'403')
        self.assertEqual(value(out,'Future','Opaque').get('string'),'unchanged')
        self.assertEqual(value(out,'Sec','NIVEXP').get('fixed'),'244800')

    def test_nightmare_hell_dependencies_and_completion_retained(self):
        b=bank();t=b.state.clone();t.values.update(NIGHTNMAR=35*4096,HL=35*4096)
        raw=b.render(t)[0];out=ET.fromstring(raw)
        for key,expected in [('XPNB','57925'),('XPNQ','59120'),('HAL','57085'),('HLO','25265')]:
            self.assertEqual(value(out,'Sec',key).get('fixed'),expected)
        b=bank(raw);t=b.state.clone();t.values.update(NIGHTNMAR=34*4096,HL=34*4096)
        out=ET.fromstring(b.render(t)[0])
        self.assertEqual(value(out,'Sec','XPNQ').get('fixed'),'59120')
        self.assertEqual(value(out,'Sec','HLO').get('fixed'),'25265')
        for key,cap in [('NIGHTNMAR',316),('HL',321)]:
            t=b.state.clone();t.values[key]=cap*4096;self.assertTrue(b.render(t)[0])
            t.values[key]+=1
            with self.assertRaises(Exception):b.render(t)

    def test_all_role_encodings_and_building_dependencies(self):
        b=bank();t=b.state.clone()
        for key in ['a','e','i','f','o','mc']:t.values['role_'+key]=100
        for key in ['wall','photon','robo','heal','aa','core']:t.values['building_'+key]=2
        t.values['building_gen']=3;t.values['building_tesla']=1;t.values['building_toweraura']=1
        raw=b.render(t)[0];out=ET.fromstring(raw)
        for key,mult in [('a',4),('e',7),('i',9),('f',5),('o',13),('mc',6)]:
            self.assertEqual(value(out,'Sec',key).get('int'),str(100*mult))
        b=bank(raw);t=b.state.clone();t.values['role_e']=99
        with self.assertRaisesRegex(Exception,'at least 100'):b.render(t)
        t=b.state.clone();t.values['building_wall']=1
        with self.assertRaisesRegex(Exception,'supported option'):b.render(t)

    def test_achievements_unlock_buildings_and_relock_dependency(self):
        # Match wrapper bodies, not achievement names: the map's naming and
        # wrapper indices differ for several resource-stock achievements.
        cosmetic={x['key']:x for x in load_profile()['building_cosmetics']}
        for building,choice,expected in [('wall','3','achievement_0'),('photon','3','achievement_2'),('robo','3','achievement_2'),('heal','3','achievement_1'),('gen','4','achievement_3')]:
            self.assertEqual(cosmetic[building]['requirements'][choice],expected)
        b=bank();t=b.state.clone()
        for i in range(23):t.values['achievement_'+str(i)]=True
        t.values['building_wall']=3;t.values['building_gen']=5
        raw=b.render(t)[0];out=ET.fromstring(raw)
        for i in range(23):
            section,key,expected=achievement_location(i)
            self.assertEqual(value(out,section,key).get('string'),expected)
        b=bank(raw);t=b.state.clone();t.values['achievement_0']=False
        with self.assertRaisesRegex(Exception,'requires'):b.render(t)
        t.values['building_wall']=0
        out=ET.fromstring(b.render(t)[0]);section,key,_=achievement_location(0)
        self.assertIsNone(value(out,section,key))

    def test_challenge_migration_marker_and_donor_readonly(self):
        b=bank();t=b.state.clone()
        for i in [0,1,2,3,4,5,7,8]:t.values['challenge_'+str(i)]=True
        raw=b.render(t)[0];out=ET.fromstring(raw)
        self.assertEqual(value(out,'reset','cs1').get('flag'),'1')
        self.assertIsNone(value(out,'kev','ks6'))
        b=bank(raw);t=b.state.clone();t.values['challenge_0']=False
        self.assertIsNone(value(ET.fromstring(b.render(t)[0]),'kev','ks0'))
        for key,value_ in [('challenge_6',True),('PHR',100),('ims',35),('skn','ds0')]:
            t=b.state.clone();t.values[key]=value_
            with self.assertRaisesRegex(Exception,'read-only'):b.render(t)

    def test_settings_markers_and_invalid_original(self):
        b=bank();t=b.state.clone();t.values.update(zvl=50,easy_complete=True,special_normal=True,WINS=400*4096,EXPP=100*4096)
        out=ET.fromstring(b.render(t)[0]);self.assertEqual(value(out,'Sec','EASY').get('fixed'),'35')
        self.assertEqual(value(out,'Sec','ZUHIB').get('fixed'),'121186')
        self.assertEqual(value(out,'Sec','zvl').get('int'),'50')
        for distance in [0,1,100,101]:
            t=b.state.clone();t.values['zvl']=distance
            if distance:
                with self.assertRaises(Exception):b.render(t)
        root=ET.fromstring(demo_bytes())
        ET.SubElement(ET.SubElement(root.find('Section'),'Key',name='CODID'),'Value',fixed='17')
        self.assertIn('CODID',bank(sign(root)).errors[0])
        self.assertTrue(Bank(demo_bytes(),player=AUTHOR,author=PLAYER).errors)

if __name__=='__main__':unittest.main()
