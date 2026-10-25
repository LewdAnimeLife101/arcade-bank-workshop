from pathlib import Path
import sys, unittest
sys.path.append(str(Path(__file__).resolve().parents[1]/'dist'/'engine.zip'))
from mze_editor.prestige import plan, curve_value, curve_rank, validate_triplet, unlock_summary

class PrestigeTests(unittest.TestCase):
    def test_native_q12_operator_goldens(self):
        from zwl_editor.fixed import parse_fixed, divide
        from mineralz_editor.protection import _multiply
        # Existing SC2 diagnostic v5 scalar goldens, no progress/account inputs.
        self.assertEqual(parse_fixed('1.2'),4915)
        self.assertEqual(_multiply(1,2048),0)
        self.assertEqual(_multiply(-1,2048),-1)
        self.assertEqual(divide(4096,12288),1365)
        self.assertEqual(divide(-4096,12288),-1365)

    def test_full_curve_and_inverse(self):
        for n in range(43):self.assertEqual(curve_rank(curve_value(n)),n)
        for n,raw in [(0,0),(1,191685),(2,421697),(12,7584646),(40,1405755471),(41,1687029609),(42,2024544841)]:
            self.assertEqual(curve_value(n),raw)
        with self.assertRaises(Exception):curve_value(43)
        # The source's split prevents a 43rd multiplicative stage from wrapping.
        self.assertGreater(((curve_value(42)+39*4096)*4915)//4096,2147483647)

    def test_all_three_fields_updated_at_transition_and_downgrade(self):
        self.assertEqual(plan(42),{'PHR':42,'PR':2024544841,'PHR2':0})
        self.assertEqual(plan(43),{'PHR':43,'PR':2024544841,'PHR2':1})
        self.assertEqual(plan(100),{'PHR':100,'PR':2024544841,'PHR2':58})
        self.assertEqual(plan(12),{'PHR':12,'PR':7584646,'PHR2':0})
        for n in [0,1,12,40,41,42,43,50,100,1000,2147483647]:
            p=plan(n);self.assertEqual(validate_triplet(p['PHR'],p['PR'],p['PHR2']),min(n,42))
        for bad in [-1,2147483648,True,1.0,'10']:
            with self.assertRaises(Exception):plan(bad)

    def test_original_dependency_checks_not_canonical_value_equality(self):
        # Source accepts slight old rounding differences that retain the count.
        self.assertEqual(validate_triplet(12,curve_value(12)+1,0),12)
        for triple in [(12,curve_value(12),1),(41,curve_value(40),1),(100,curve_value(41),58)]:
            with self.assertRaises(Exception):validate_triplet(*triple)

    def test_unlock_thresholds_are_not_stackable_perks(self):
        self.assertEqual(len(unlock_summary(1)['available_perks']),3)
        self.assertEqual(len(unlock_summary(11)['available_perks']),13)
        self.assertEqual(len(unlock_summary(12)['available_perks']),14)
        self.assertEqual(unlock_summary(100)['passive_role_level'],40)
        self.assertFalse(unlock_summary(99)['secret_worker_skin'])
        self.assertTrue(unlock_summary(100)['secret_worker_skin'])
        self.assertEqual(unlock_summary(100)['prestige_cosmetic_indices'],[0,1,2,3,4])
        self.assertEqual(unlock_summary(100)['prestige_achievement_indices'],[10,11,12,13,14,15])

if __name__=='__main__':unittest.main()
