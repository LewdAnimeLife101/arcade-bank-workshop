"""Exercise named Reign operations against the exact public engine bundle."""
import base64,json,unittest
from test_bridge import bridge


class ReignWorkshopTests(unittest.TestCase):
    def call(self,**request):
        result=json.loads(bridge.handle(json.dumps(request)))
        self.assertTrue(result['ok'],result.get('error'))
        return result['data']

    def setUp(self):
        self.opened=self.call(op='open',profile='reign',demo=True)
        self.session=self.opened['session']

    def operation(self,op,request,**extra):
        return self.call(op=op,session=self.session,request=request,**extra)

    def reopen(self,data):
        return self.call(op='open',profile='reign',raw=data['output'],name=data['name'],player=data['player'],author=data['author'])

    def test_named_catalogs_and_no_raw_glyph_strings(self):
        d=self.opened
        self.assertEqual(len(d['reign']['equipment']['catalog']),121)
        self.assertEqual([q['name'] for q in d['reign']['glyphs']['qualities']],['Legendary','Ancient','Unique'])
        self.assertFalse(any('Glyphs3' in f['id'] for f in d['fields']))
        self.assertTrue(any(f['id']=='charm:1:1:1' for f in d['fields']))
        self.assertTrue(all(f['description'] for f in d['fields'] if f['id'].startswith(('asc:','level:','evolution:'))))

    def test_item_add_move_signed_reopen_and_undo(self):
        original=bridge.sessions[self.session]['bank'].raw
        self.operation('reign_equipment',dict(action='add',carrier='Stashes/StashBox1',container=0,slot=0,itemId='rin1'))
        d=self.operation('reign_equipment',dict(action='move',carrier='Stashes/StashBox1',container=0,slot=0,toCarrier='Hero/RiflemanA',toContainer=0,toSlot=0))
        fresh=self.reopen(d)
        self.assertEqual(d['reign']['equipment'],fresh['reign']['equipment'])
        carrier=next(c for c in fresh['reign']['equipment']['carriers'] if c['id']=='Hero/RiflemanA')
        self.assertEqual(carrier['containers'][0]['slots'][0]['item']['id'],'rin1')
        self.assertEqual(original,bridge.sessions[self.session]['bank'].raw)
        self.call(op='undo',session=self.session)
        undone=self.call(op='undo',session=self.session)
        self.assertEqual(undone['reign']['equipment'],self.opened['reign']['equipment'])

    def test_invalid_equipment_action_rolls_back_pending_fields(self):
        gems=next(f for f in self.opened['fields'] if f['label']=='Gems')
        bad=json.loads(bridge.handle(json.dumps(dict(op='reign_equipment',session=self.session,edits={gems['id']:'50'},request=dict(action='add',carrier='Hero/FootmanA',container=0,slot=16,itemId='rin1')))))
        self.assertFalse(bad['ok'])
        data=self.call(op='preview',session=self.session)
        self.assertEqual(self.opened['fields'],data['fields'])
        self.assertEqual(self.opened['reign'],data['reign'])

    def test_glyph_creation_equip_and_explicit_mastery_dependency(self):
        q=self.opened['reign']['glyphs']['qualities'][0]
        request=dict(action='create',hero=1,slot=0,quality=q['id'],tier=1,powers=[q['powers'][0]['id']],stats=[dict(id=1,value='0.1')])
        denied=json.loads(bridge.handle(json.dumps(dict(op='reign_glyph',session=self.session,request=request))))
        self.assertFalse(denied['ok'])
        request['unlockMastery']=True
        self.operation('reign_glyph',request)
        data=self.operation('reign_glyph',dict(action='equip',hero=1,slot=0,toSlot=91))
        self.assertEqual(data['reign']['glyphs'],self.reopen(data)['reign']['glyphs'])
        slots=data['reign']['glyphs']['heroes'][0]['slots']
        self.assertTrue(slots[0]['empty']);self.assertFalse(slots[91]['empty'])

    def test_named_evolution_updates_native_unit_and_level_and_survives_equipment(self):
        from zrc_editor.evolutions import form_for_stage
        d=self.call(op='preview',session=self.session,edits={'level:2':'1','evolution:2':'8'})
        self.assertEqual(next(f for f in d['fields'] if f['id']=='level:2')['value'],80)
        d=self.operation('reign_equipment',dict(action='add',carrier='Hero/RiflemanA',container=0,slot=0,itemId='rin1'))
        fresh=self.reopen(d);bank=bridge.sessions[fresh['session']]['bank']
        self.assertEqual(bank.nodes['Hero','RiflemanA'].find('Type').get('string'),form_for_stage(2,8)['unit_id'])
        self.assertEqual(d['fields'],fresh['fields'])

    def test_named_ascendancy_and_charm_dependencies(self):
        d=self.call(op='preview',session=self.session,edits={'asc:1:budget':'3','asc:1:passive:6':'2'})
        self.assertEqual(d['fields'],self.reopen(d)['fields'])
        denied=json.loads(bridge.handle(json.dumps(dict(op='preview',session=self.session,edits={'charm:1:1:1':'1'}))))
        self.assertFalse(denied['ok'])


    def test_final_dependency_order_and_evolution_intent_undo(self):
        # Budget may be entered after a passive in the UI; final batch order is deterministic.
        d=self.call(op='preview',session=self.session,edits={'asc:1:passive:6':'2','asc:1:budget':'3'})
        self.assertEqual(next(f for f in d['fields'] if f['id']=='asc:1:budget')['value'],3)
        self.call(op='preview',session=self.session,edits={'evolution:2':'8'})
        d=self.call(op='preview',session=self.session,edits={'level:2':'1','evolution:2':'1'})
        self.assertTrue(d['dirty'])
        d=self.call(op='undo',session=self.session)
        self.assertEqual(next(f for f in d['fields'] if f['id']=='evolution:2')['value'],8)
