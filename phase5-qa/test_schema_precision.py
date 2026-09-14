import unittest
from build_schema import sequence_integer


class SequencePrecisionTests(unittest.TestCase):
    def test_exact_bigint_text_is_preserved(self):
        self.assertEqual(sequence_integer('9223372036854775807'), '9223372036854775807')
        self.assertEqual(sequence_integer('-9223372036854775808'), '-9223372036854775808')

    def test_browser_rounded_limit_is_rejected(self):
        with self.assertRaises(ValueError):
            sequence_integer(9223372036854776000)

    def test_large_numeric_json_requires_text_recapture(self):
        with self.assertRaises(ValueError):
            sequence_integer(9223372036854775807)

    def test_safe_integer_values_remain_supported(self):
        for value in (1, -1, 100, 2147483647):
            self.assertEqual(sequence_integer(value), str(value))

    def test_invalid_and_executable_values_are_rejected(self):
        for value in (True, 1.5, '1;DROP TABLE anything', '1e3', '9223372036854775808', None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                sequence_integer(value)


if __name__ == '__main__':
    unittest.main()
