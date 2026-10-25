"""Synthetic packaged-engine tests for MineralZ Evolution 2.58."""
import base64, importlib.util, json
from pathlib import Path
import sys, unittest

ROOT=Path(__file__).resolve().parents[1]
# Keep the shipped archive available for a standalone run, but do not put it
# ahead of the prepared extraction used by the full packaged-engine suite.
sys.path.append(str(ROOT/"dist"/"engine.zip"))
spec=importlib.util.spec_from_file_location("generated_bridge",ROOT/"dist"/"bridge.py")
bridge=importlib.util.module_from_spec(spec); spec.loader.exec_module(bridge)

class GeneratedEvolutionTests(unittest.TestCase):
    def call(self,**req):
        result=json.loads(bridge.handle(json.dumps(req)))
        self.assertTrue(result["ok"],result.get("error")); return result["data"]
    def values(self, raw):
        import xml.etree.ElementTree as ET
        root=ET.fromstring(raw)
        return root,{k.get("name"):k.find("Value").get("fixed") for s in root.findall("Section") for k in s.findall("Key")}
    def test_synthetic_roundtrip_dependencies_and_unchanged_fields(self):
        opened=self.call(op="open",profile="mineralz_evolution_258",demo=True)
        fields={x["label"]:x for x in opened["fields"]}
        self.assertEqual(set(fields),{"Probe level","Normal highest night","Elite highest night"})
        edits={fields["Probe level"]["id"]:"200",fields["Normal highest night"]["id"]:"36",
               fields["Elite highest night"]["id"]:"51"}
        result=self.call(op="preview",session=opened["session"],edits=edits)
        raw=base64.b64decode(result["output"])
        root,values=self.values(raw)
        self.assertEqual(values["NIVEXP"],"244800"); self.assertEqual(values["KILLED"],"172368")
        self.assertEqual(values["HEAL"],"21634")
        self.assertEqual(values["XPNB"],"0"); self.assertEqual(values["XPNQ"],"0")
        self.assertEqual(values["HAL"],"0"); self.assertEqual(values["HLO"],"0")
        self.assertEqual(values["VERSION"],"6")
        reopened=self.call(op="open",profile="mineralz_evolution_258",raw=result["output"],name="Banks.SC2Bank",
                           player="1-S2-1-1234567",author="1-S2-1-7654321")
        self.assertEqual(reopened["fields"],result["fields"])
    def test_invalid_bounds_account_and_original_rollback(self):
        opened=self.call(op="open",profile="mineralz_evolution_258",demo=True); field=opened["fields"][0]
        original=self.call(op="preview",session=opened["session"])["original"]
        bad=json.loads(bridge.handle(json.dumps({"op":"preview","session":opened["session"],"edits":{field["id"]:"201"}})))
        self.assertFalse(bad["ok"]); self.assertEqual(self.call(op="preview",session=opened["session"])["original"],original)
        output=self.call(op="preview",session=opened["session"])["output"]
        wrong=json.loads(bridge.handle(json.dumps({"op":"open","profile":"mineralz_evolution_258","raw":output,"name":"Banks.SC2Bank",
                                                  "player":"1-S2-1-7654321","author":"1-S2-1-1234567"})))
        self.assertFalse(wrong["ok"])
    def test_adjacent_bounds_fractional_and_noop(self):
        opened=self.call(op="open",profile="mineralz_evolution_258",demo=True)
        fields={x["label"]:x for x in opened["fields"]}
        original=self.call(op="preview",session=opened["session"])["original"]
        self.assertEqual(self.call(op="preview",session=opened["session"])["output"],original)
        result=self.call(op="preview",session=opened["session"],edits={fields["Normal highest night"]["id"]:"35.5"})
        _,values=self.values(base64.b64decode(result["output"]))
        self.assertEqual(values["NIGHTMNHD"],"35.5"); self.assertEqual(values["KILLED"],"169974")
        for label,value in (("Probe level","200.000244140625"),("Normal highest night","36.000244140625"),("Elite highest night","51.000244140625")):
            response=json.loads(bridge.handle(json.dumps({"op":"preview","session":opened["session"],"edits":{fields[label]["id"]:value}})))
            self.assertFalse(response["ok"],(label,value))
    def test_lowering_elite_preserves_completion_marker(self):
        opened=self.call(op="open",profile="mineralz_evolution_258",demo=True)
        field=next(x for x in opened["fields"] if x["label"]=="Elite highest night")
        high=self.call(op="preview",session=opened["session"],edits={field["id"]:"35"})
        reopened=self.call(op="open",profile="mineralz_evolution_258",raw=high["output"],name="Banks.SC2Bank",player="1-S2-1-1234567",author="1-S2-1-7654321")
        field2=next(x for x in reopened["fields"] if x["label"]=="Elite highest night")
        low=self.call(op="preview",session=reopened["session"],edits={field2["id"]:"34"})
        _,values=self.values(base64.b64decode(low["output"]))
        self.assertEqual(values["NIGHTELITE"],"34"); self.assertEqual(values["HEAL"],"21634")
    def test_missing_key_legacy_format_and_source_enforced_relationships(self):
        from mze_editor.demo import demo_bytes
        from zrc_editor.core import signature_for
        import xml.etree.ElementTree as ET
        def altered(remove=None, changes=None):
            root=ET.fromstring(demo_bytes()); sec=root.find("Section")
            nodes={n.get("name"):n for n in sec.findall("Key")}
            if remove: sec.remove(nodes[remove])
            for key,value in (changes or {}).items(): nodes[key].find("Value").set("fixed",value)
            root.find("Signature").set("value",signature_for(root,"1-S2-1-1234567","1-S2-1-7654321","Banks"))
            return base64.b64encode(ET.tostring(root,encoding="utf-8",xml_declaration=True)).decode()
        # The loader only enforces NIVO/NIVEXP once NIVO is at least 51.
        low_mismatch=altered(changes={"NIVEXP":"1225"})
        accepted=self.call(op="open",profile="mineralz_evolution_258",raw=low_mismatch,name="Banks.SC2Bank",player="1-S2-1-1234567",author="1-S2-1-7654321")
        self.assertEqual(next(x for x in accepted["fields"] if x["label"]=="Probe level")["value"],"1")
        for raw in (altered(remove="NIVO"),altered(changes={"NIVO":"51","NIVEXP":"1225"}),altered(changes={"NIGHTNMAR":"35","XPNB":"57925","XPNQ":"0"})):
            response=json.loads(bridge.handle(json.dumps({"op":"open","profile":"mineralz_evolution_258","raw":raw,"name":"Banks.SC2Bank","player":"1-S2-1-1234567","author":"1-S2-1-7654321"})))
            self.assertFalse(response["ok"])
    def test_normal_save_without_reset_version_or_unearned_difficulty_keys(self):
        # Source 2.58 reads no VERSION key; reset/admin writers alone set it.
        # Exercise non-demo opening, not a shortcut into the generated fixture.
        from mze_editor.demo import demo_bytes
        from zrc_editor.core import signature_for
        import xml.etree.ElementTree as ET
        root=ET.fromstring(demo_bytes());sec=root.find("Section")
        for node in list(sec):
            if node.get("name") in {"VERSION","NIGHTNMAR","XPNB","XPNQ","HL","HAL","HLO"}:sec.remove(node)
        def signed():
            root.find("Signature").set("value",signature_for(root,"1-S2-1-1234567","1-S2-1-7654321","Banks"))
            return base64.b64encode(ET.tostring(root,encoding="utf-8")).decode()
        raw=signed()
        opened=self.call(op="open",profile="mineralz_evolution_258",raw=raw,name="Banks.SC2Bank",player="1-S2-1-1234567",author="1-S2-1-7654321")
        self.assertEqual(self.call(op="preview",session=opened['session'])['output'],raw)
        field=next(f for f in opened['fields'] if f['label']=='Probe level')
        edited=self.call(op="preview",session=opened['session'],edits={field['id']:'51'})
        _,values=self.values(base64.b64decode(edited['output']))
        self.assertEqual(values['NIVEXP'],'62424')
        self.assertFalse({'VERSION','NIGHTNMAR','HL'} & set(values))
        # An existing reset-history key is opaque and stays unchanged.
        ET.SubElement(ET.SubElement(sec,'Key',name='VERSION'),'Value',fixed='5')
        with_version=self.call(op="open",profile="mineralz_evolution_258",raw=signed(),name="Banks.SC2Bank",player="1-S2-1-1234567",author="1-S2-1-7654321")
        output=self.call(op="preview",session=with_version['session'])
        self.assertEqual(self.values(base64.b64decode(output['output']))[1]['VERSION'],'5')
    def test_profile_has_separate_main_and_backup_registration(self):
        profiles=json.loads((ROOT/"dist"/"profiles.json").read_text(encoding="utf-8")); p=next(x for x in profiles if x["id"]=="mineralz_evolution_258")
        self.assertEqual(p["mainNames"],["Banks"]); self.assertEqual(p["nativeBackupNames"],["Banks"])

if __name__=="__main__": unittest.main()
