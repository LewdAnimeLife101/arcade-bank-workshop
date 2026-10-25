"""Packaged browser paths for native-verified Evolution progression controls."""
from pathlib import Path
import base64, importlib.util, json, sys, unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT/'dist/engine.zip'))
spec=importlib.util.spec_from_file_location('mze_controls_bridge',ROOT/'dist/bridge.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
from mze_editor.prestige import plan
from mze_editor.impossible import calculate_candidate
from zwl_editor.fixed import parse_fixed

class ProgressionControlsTests(unittest.TestCase):
    def call(self,**req):
        out=json.loads(bridge.handle(json.dumps(req)))
        self.assertTrue(out['ok'],out.get('error'));return out['data']
    def opened(self):return self.call(op='open',profile='mineralz_evolution_258',demo=True)
    def edit(self,opened,**values):
        return self.call(op='preview',session=opened['session'],edits={json.dumps(['values',k],separators=(',',':')):v for k,v in values.items()})
    def stored(self,result):
        root=ET.fromstring(base64.b64decode(result['output']))
        return {k.get('name'):dict(k.find('Value').attrib) for k in root.find("./Section[@name='Sec']").findall('Key')}
    def test_prestige_presets_repeated_preview_and_revert(self):
        opened=self.opened();original=self.call(op='preview',session=opened['session'])['output']
        result=self.call(op='preset',session=opened['session'],action='prestige_perks')
        self.assertEqual(sum(f['value']=='Available' for f in result['fields'] if f['kind']=='info'),14)
        result=self.call(op='preset',session=opened['session'],action='prestige_rewards')
        fields=self.stored(result)
        self.assertEqual(fields['PHR'],{'int':'100'});self.assertEqual(fields['PHR2'],{'int':'58'})
        self.assertEqual(parse_fixed(fields['PR']['fixed']),plan(100)['PR'])
        lower=self.edit(opened,PHR=12);self.assertEqual(self.stored(lower)['PHR2'],{'int':'0'})
        unchanged=self.call(op='preview',session=opened['session'])
        self.assertEqual(unchanged['output'],lower['output'])
        reverted=self.edit(opened,PHR=0)
        self.assertEqual(reverted['output'],original)
    def test_impossible_coupled_records_and_signed_reopen(self):
        opened=self.opened()
        result=self.edit(opened,ims=35,impossible_complete=True,impossible_dna=True,NIVO='200')
        values=self.stored(result);expected=calculate_candidate(opened['player'],35)
        for key in ('im','is','imval'):self.assertEqual(parse_fixed(values[key]['fixed']),expected[key])
        self.assertEqual(values['ims'],{'int':'35'})
        reopened=self.call(op='open',profile=opened['profile'],name=opened['name'],player=opened['player'],author=opened['author'],raw=result['output'])
        self.assertEqual(reopened['fields'],result['fields'])
        later=self.edit(opened,ims=36)
        self.assertEqual(self.stored(later)['is'],values['is'])
        self.assertEqual(self.call(op='preview',session=opened['session'])['output'],later['output'])
        before=later['fields']
        bad=json.loads(bridge.handle(json.dumps({'op':'preview','session':opened['session'],'edits':{'["values","ims"]':'34'}})))
        self.assertFalse(bad['ok'])
        self.assertEqual(self.call(op='preview',session=opened['session'])['fields'],before)
    def test_cosmetics_refresh_and_prerequisite_downgrade(self):
        opened=self.opened();result=self.edit(opened,PHR=50)
        skin=next(f for f in result['fields'] if f['id']=='["values","skn"]')
        self.assertIn('P4',{o['value'] for o in skin['options']})
        result=self.edit(opened,skn='P4')
        bad=json.loads(bridge.handle(json.dumps({'op':'preview','session':opened['session'],'edits':{'["values","PHR"]':'49'}})))
        self.assertFalse(bad['ok']);self.assertIn('requires',bad['error'])
        result=self.edit(opened,skn='default',PHR=49)
        self.assertEqual(self.stored(result)['skn'],{'string':'default'})
    def test_no_direct_check_or_external_entitlement_edits(self):
        opened=self.opened()
        for key,value in [('PR','1'),('im','1'),('challenge_6',True)]:
            bad=json.loads(bridge.handle(json.dumps({'op':'preview','session':opened['session'],'edits':{json.dumps(['values',key],separators=(',',':')):value}})))
            self.assertFalse(bad['ok']);self.assertIn('read-only',bad['error'])
        self.assertFalse(self.call(op='preview',session=opened['session'])['dirty'])

if __name__=='__main__':unittest.main()
