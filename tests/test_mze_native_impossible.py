"""Synthetic candidate arithmetic and write-planning policy regressions.

These do not substitute for the separate SC2 native output comparison.
"""
from pathlib import Path
import sys, unittest, json
from unittest.mock import patch
sys.path.append(str(Path(__file__).resolve().parents[1]/'dist'/'engine.zip'))
from mze_editor import impossible as m
from zwl_editor.common import BankError
from zwl_editor.fixed import int_fixed

class ImpossibleTests(unittest.TestCase):
    def test_native_full_expression_goldens(self):
        data=json.loads((Path(__file__).parent/'fixtures'/'mze_native_impossible.json').read_text(encoding='utf-8'))
        compared=0;excluded=0
        for case in data['cases']:
            native=case['values']
            if native.get('zero_divisor'):
                with self.assertRaises(BankError):m.calculate_candidate(case['player'],case['night'])
                excluded+=1;continue
            actual=m.calculate_candidate(case['player'],case['night'])
            p=m.parameters_candidate(case['player'])
            for key in ('im','is','imval'):self.assertEqual(actual[key],native[key])
            self.assertEqual(actual['ims'],native['night'])
            self.assertEqual(list(p.constants),[native['constant'+str(i)] for i in range(1,10)])
            self.assertEqual(p.shield_modulus,native['divisor'])
            self.assertEqual(p.heal,native['heal'])
            compared+=1
        self.assertEqual((compared,excluded),(30,6))
        for key,raw in data['round'].items():self.assertEqual(m.round_candidate(int(key[3:])),raw)
        self.assertEqual(len(data['round']),21)

    def test_final_constant_omits_immediate_predecessor(self):
        # The native output and exact source agree on A9=1. Including A8 in
        # the last product incorrectly makes A9=18 and invalidates all tokens.
        self.assertEqual(m.constants_candidate(),(240466,49152,90112,8192,106496,73728,163840,2711552,4096))
        self.assertEqual(m.round_candidate(-2048),0)
        self.assertEqual(m.round_candidate(-6144),-4096)

    def test_source_handle_replaces_first_eight_characters(self):
        self.assertEqual(m.handle_term('1-S2-1-1234567'),int_fixed(234567))
        self.assertEqual(m.handle_term('1-S2-1-1765432'),int_fixed(765432))
        for value in ('','1234567','1-S2-1-notdigits'):
            with self.assertRaises(BankError):m.handle_term(value)

    def test_arithmetic_ceiling_and_invalid_waves(self):
        for night in (0,1,34,35,36,m.MAX_NIGHT):
            result=m.calculate_candidate('1-S2-1-1234567',night)
            self.assertLess(result['im'],2**31)
            self.assertEqual(result['ims'],night)
            self.assertEqual(result['im']//(10*m.SCALE),night)
            self.assertTrue(all(m.check_candidate(result,'1-S2-1-1234567').values()))
        for night in (-1,m.MAX_NIGHT+1,1.5,True):
            with self.assertRaises(BankError):m.calculate_candidate('1-S2-1-1234567',night)

    def test_zero_account_divisor_is_explicit(self):
        with self.assertRaisesRegex(BankError,'divisor is zero'):
            m.calculate_candidate('1-S2-1-1000000',35)

    def test_no_writes_until_native_verification(self):
        with patch.object(m,'MODEL_VERIFIED',False):
            with self.assertRaisesRegex(BankError,'native diagnostic'):
                m.plan('1-S2-1-1234567',35,completed=True)

    def test_write_plan_keeps_independent_markers_optional(self):
        with patch.object(m,'MODEL_VERIFIED',True):
            player='1-S2-1-1234567'
            self.assertEqual(set(m.plan(player,35)),{'im','ims'})
            self.assertEqual(set(m.plan(player,35,completed=True)),{'im','ims','is'})
            self.assertEqual(set(m.plan(player,35,dna_complete=True)),{'im','ims','imval'})
            self.assertEqual(m.plan(player,36,completed=True)['is'],m.calculate_candidate(player,35)['is'])
            self.assertEqual(m.plan(player,35,completed=False)['is'],0)
            with self.assertRaisesRegex(BankError,'at least 35'):m.plan(player,34,completed=True)
            with self.assertRaises(BankError):m.plan(player,35,completed='true')

    def test_zero_marker_cannot_be_misrepresented_as_cleared(self):
        with patch.object(m,'MODEL_VERIFIED',True),patch.object(m,'calculate_candidate',return_value={'ims':35,'im':35*10*m.SCALE,'is':0,'imval':0}):
            with self.assertRaisesRegex(BankError,'zero-valued win token'):m.plan('1-S2-1-1234567',35,completed=False)
            with self.assertRaisesRegex(BankError,'zero-valued DNA token'):m.plan('1-S2-1-1234567',35,dna_complete=False)

if __name__=='__main__':unittest.main()
