"""Synthetic integration checks for the 0.89 current-save comparison pair."""
import unittest
import xml.etree.ElementTree as ET


from test_bridge import bridge  # Uses the exact bundled engine and shared harness.

from fwls_editor.common import BankError, load_profile
from fwls_editor.core import Bank
from fwls_editor.demo import demo_bank, demo_state, demo_bytes, PLAYER, AUTHOR
from fwls_editor.guard import render_guard, inspect_guard, range_notes, NAME, _key
from fwls_editor.codec import shift
from zrc_editor.core import signature_for


class GuardTest(unittest.TestCase):
    def setUp(self):
        self.bank = demo_bank()
        self.assertTrue(self.bank.original_verified(), self.bank.errors)
        self.raw, _ = render_guard(self.bank, self.bank.state)

    def signed_edit(self, raw, action, name=NAME):
        root = ET.fromstring(raw)
        action(root)
        root.find('Signature').set('value', signature_for(root, PLAYER, AUTHOR, name))
        return ET.tostring(root)

    def test_pair_passes_and_leaves_main_state_unchanged(self):
        before = self.bank.state.clone()
        target = before.clone()
        target.values.update(skill_level=10000, ascension_level=65, kills=10000000, play_time=3600)
        original = inspect_guard(self.bank, self.raw, target_state=target)
        self.assertEqual(original['status'], 'edit')
        raw, notes = render_guard(self.bank, target, self.raw)
        self.assertEqual(inspect_guard(self.bank, raw, target_state=target)['status'], 'ok')
        self.assertTrue(inspect_guard(self.bank, raw, target_state=target)['signature_verified'])
        self.assertEqual(self.bank.state, before)
        self.assertEqual(inspect_guard(self.bank, raw)['status'], 'behind')

    def test_noop_exact_bytes_and_unknown_sections_preserved(self):
        def extra(root):
            section = ET.SubElement(root, 'Section', name='Future')
            ET.SubElement(ET.SubElement(section, 'Key', name='keep'), 'Value', string='opaque')
        raw = self.signed_edit(self.raw, extra)
        self.assertEqual(render_guard(self.bank, self.bank.state, raw)[0], raw)
        target = self.bank.state.clone(); target.values['kills'] = 10
        output, _ = render_guard(self.bank, target, raw)
        self.assertEqual(ET.fromstring(output).find("Section[@name='Future']/Key/Value").get('string'), 'opaque')

    def test_wrong_filename_signature_and_unsigned_refused(self):
        wrong = self.signed_edit(self.raw, lambda root: None, name='FWLSBank')
        self.assertEqual(inspect_guard(self.bank, wrong)['status'], 'lost')
        with self.assertRaises(BankError): render_guard(self.bank, self.bank.state, wrong)
        root = ET.fromstring(self.raw); root.remove(root.find('Signature'))
        with self.assertRaises(BankError): render_guard(self.bank, self.bank.state, ET.tostring(root))

    def test_foreign_author_and_player_refused(self):
        for player, author in [('1-S2-1-1234568', AUTHOR), (PLAYER, '1-S2-1-7654322')]:
            b = Bank(demo_bytes(player=player, author=author), player=player, author=author)
            self.assertTrue(b.original_verified())
            with self.assertRaises(BankError): render_guard(b, b.state, self.raw)

    def test_foreign_record_with_valid_signature_refused(self):
        def foreign(root):
            node = root.find("Section[@name='M']/Key/Value")
            text = shift(node.get('string'), _key(PLAYER), decrypt=True)
            node.set('string', shift(text.replace(PLAYER, '1-S2-1-9999999'), _key(PLAYER)))
        with self.assertRaises(BankError): inspect_guard(self.bank, self.signed_edit(self.raw, foreign))

    def test_missing_mirror_snapshot_status(self):
        self.assertEqual(inspect_guard(self.bank, None)['status'], 'ok')
        self.assertEqual(inspect_guard(self.bank, None, snapshots_exist=True)['status'], 'lost')
        self.assertFalse(inspect_guard(self.bank, None)['signature_verified'])

    def test_range_priority_and_boundaries(self):
        for asc, expected in [(0, False), (1000, False), (1001, True)]:
            target = self.bank.state.clone(); target.values['ascension_level'] = asc
            self.assertEqual(bool(range_notes(target)), expected)
        target = self.bank.state.clone(); target.values.update(skill_level=2, current_xp=100)
        self.assertEqual(inspect_guard(self.bank, self.raw, target_state=target)['status'], 'range')
        with self.assertRaises(BankError): self.bank.render(target)
        target.values['current_xp'] = 99
        self.bank.render(target)
        target.values.update(skill_level=10000, current_xp=499999)
        self.assertFalse(range_notes(target))

    def test_old_anomalies_read_preserved_and_explicitly_repaired(self):
        state = demo_state(); state.values.update(ascension_level=1001, total_xp=1)
        raw = demo_bytes(state=state)
        bank = Bank(raw, player=PLAYER, author=AUTHOR)
        self.assertTrue(bank.original_verified(), bank.errors)
        self.assertTrue(any('Bank Guard issue' in note for note in bank.warnings))
        self.assertEqual(bank.render(bank.state)[0], raw)
        target = bank.state.clone(); target.values['kills'] = 10
        with self.assertRaises(BankError): bank.render(target)
        with self.assertRaises(BankError): render_guard(bank, bank.state)
        target.values.update(ascension_level=1000, total_xp=0)
        bank.render(target)
        mirror, _ = render_guard(bank, target)
        self.assertEqual(inspect_guard(bank, mirror, target_state=target)['status'], 'ok')

    def test_malformed_xml_and_duplicate_records_refused(self):
        for raw in [b'<!DOCTYPE x><Bank version="1"/>', b'<Bank/>', b'bad', b'']:
            with self.assertRaises(BankError): render_guard(self.bank, self.bank.state, raw)
        root = ET.fromstring(self.raw); section = root.find('Section')
        section.append(ET.fromstring(ET.tostring(section.find('Key'))))
        with self.assertRaises(BankError): inspect_guard(self.bank, ET.tostring(root))

    def test_both_unlock_presets_generate_valid_pairs(self):
        from arcade_editor.preset_rpg import apply
        for plausible in (False, True):
            session = {'profile':'fallen', 'bank':self.bank, 'work':self.bank.state.clone()}
            apply(session, plausible)
            self.assertEqual(inspect_guard(self.bank, self.raw, target_state=session['work'])['status'], 'edit')
            mirror, _ = render_guard(self.bank, session['work'], self.raw)
            self.assertEqual(inspect_guard(self.bank, mirror, target_state=session['work'])['status'], 'ok')

    def test_status_priority_matches_source(self):
        old = self.bank.state.clone(); old.values['kills'] = 10
        mirror, _ = render_guard(self.bank, old)
        invalid = self.signed_edit(mirror, lambda root: None, name='WrongName')
        for kills, asc, signed, expected in [
            (10, 0, True, 'ok'), (5, 0, True, 'behind'),
            (5, 0, False, 'lost'), (20, 0, False, 'edit'),
            (20, 1001, False, 'range'), (10, 1001, True, 'range')]:
            state = self.bank.state.clone(); state.values.update(kills=kills, ascension_level=asc)
            self.assertEqual(inspect_guard(self.bank, mirror if signed else invalid,
                                         target_state=state)['status'], expected)

    def test_invalid_original_presets_fail_without_state_or_byte_changes(self):
        from arcade_editor.preset_rpg import apply
        for key, value in [('ascension_level',1001), ('total_xp',1)]:
            state = demo_state(); state.values[key] = value
            raw = demo_bytes(state=state); bank = Bank(raw, player=PLAYER, author=AUTHOR)
            for plausible in (False, True):
                session = {'profile':'fallen', 'bank':bank, 'work':bank.state.clone()}
                original = session['work'].clone()
                with self.assertRaises(BankError): apply(session, plausible)
                self.assertEqual(session['work'], original)
                self.assertEqual(bank.raw, raw)

    def test_refused_pair_preserves_original_bytes(self):
        target = self.bank.state.clone(); target.values['ascension_level'] = 1001
        main, mirror = bytes(self.bank.raw), bytes(self.raw)
        with self.assertRaises(BankError): render_guard(self.bank, target, self.raw)
        self.assertEqual(self.bank.raw, main)
        self.assertEqual(self.raw, mirror)


if __name__ == '__main__': unittest.main()
