"""Coordinated Fallen World exports tested against the shipped engine."""
import base64
import io
import json
import unittest
import zipfile
import xml.etree.ElementTree as ET
from test_bridge import bridge


class FallenPairTests(unittest.TestCase):
    def call(self, **request):
        result=json.loads(bridge.handle(json.dumps(request)))
        self.assertTrue(result['ok'],result.get('error'))
        return result['data']

    def test_both_unlock_variants_export_a_signed_matching_pair(self):
        from fwls_editor.guard import render_guard,inspect_guard
        for action in ('all_full','all_plausible'):
            data=self.call(op='open',profile='fallen',demo=True)
            s=bridge.sessions[data['session']]
            mirror,_=render_guard(s['bank'],s['bank'].state)
            staged=self.call(op='preset',session=data['session'],action=action)
            self.assertEqual(inspect_guard(s['bank'],mirror,target_state=s['work'])['status'],'edit')
            result=self.call(op='fallen_bundle',session=data['session'],mirror=base64.b64encode(mirror).decode())
            with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['archive']))) as archive:
                self.assertEqual(set(archive.namelist()),{'demo-FWLSBank.SC2Bank','demo-FWLSBankChk.SC2Bank','READ-ME.txt'})
                main=bridge.construct('fallen',archive.read('demo-FWLSBank.SC2Bank'),s['name'],s['player'],s['author'])
                check=inspect_guard(main,archive.read('demo-FWLSBankChk.SC2Bank'))
                self.assertEqual(check['status'],'ok')
                self.assertTrue(check['signature_verified'])
                self.assertEqual(main.state,s['work'])
            self.assertEqual(self.call(op='preview',session=data['session'])['fields'],staged['fields'])

    def test_invalid_existing_comparison_refused_without_mutating_session(self):
        data=self.call(op='open',profile='fallen',demo=True)
        result=json.loads(bridge.handle(json.dumps({'op':'fallen_bundle','session':data['session'],'mirror':base64.b64encode(b'<Bank/>').decode(),'edits':{'["values","kills"]':'42'}})))
        self.assertFalse(result['ok'])
        self.assertEqual(self.call(op='preview',session=data['session'])['fields'],data['fields'])

    def test_new_comparison_export_and_limits(self):
        data=self.call(op='open',profile='fallen',demo=True)
        result=self.call(op='fallen_bundle',session=data['session'],mirror=None,edits={'["values","ascension_level"]':'1000'})
        self.assertEqual(result['guard']['status'],'ok')
        for edits in ({'["values","ascension_level"]':'1001'},{'["values","total_xp"]':'1'}):
            bad=json.loads(bridge.handle(json.dumps({'op':'fallen_bundle','session':data['session'],'mirror':None,'edits':edits})))
            self.assertFalse(bad['ok'])

    def test_funded_skills_contains_three_consistent_banks(self):
        from fwls_editor.skill_preset import EMPTY_COMPANION
        from fwls_editor.guard import inspect_guard
        from fwls_editor.companion import parse
        data=self.call(op='open',profile='fallen',demo=True)
        result=self.call(op='funded_skills',session=data['session'],mirror=None,companion=base64.b64encode(EMPTY_COMPANION).decode(),slot=1)
        with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['archive']))) as archive:
            self.assertEqual(len(archive.namelist()),4)
            main=bridge.construct('fallen',archive.read('demo-FWLSBank.SC2Bank'),data['name'],data['player'],data['author'])
            self.assertEqual(inspect_guard(main,archive.read('demo-FWLSBankChk.SC2Bank'))['status'],'ok')
            self.assertEqual(parse(archive.read('demo-FWLSBank2.SC2Bank')).auto,1)
            self.assertFalse(any('Snap' in name for name in archive.namelist()))
        self.assertEqual(self.call(op='preview',session=data['session'])['fields'],data['fields'])

    def test_unknown_comparison_data_survives_export(self):
        from fwls_editor.guard import render_guard
        from zrc_editor.core import signature_for
        data=self.call(op='open',profile='fallen',demo=True);bank=bridge.sessions[data['session']]['bank']
        raw,_=render_guard(bank,bank.state)
        root=ET.fromstring(raw)
        ET.SubElement(ET.SubElement(ET.SubElement(root,'Section',name='Extra'),'Key',name='keep'),'Value',string='unknown')
        root.find('Signature').set('value',signature_for(root,bank.player,bank.author,'FWLSBankChk'))
        result=self.call(op='fallen_bundle',session=data['session'],mirror=base64.b64encode(ET.tostring(root)).decode(),edits={'["values","kills"]':'99'})
        output=ET.fromstring(base64.b64decode(result['guardOutput']))
        self.assertEqual(output.find("Section[@name='Extra']/Key/Value").get('string'),'unknown')

if __name__=='__main__':unittest.main()
