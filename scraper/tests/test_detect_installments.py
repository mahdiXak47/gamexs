import unittest

from detect_installments import detect


class DetectInstallmentsTest(unittest.TestCase):
    def test_provider_footprints(self):
        self.assertEqual(detect(['<div class="snapp-pay-widget"></div>']), ["snapppay"])
        self.assertEqual(detect(['<link id="digipay-badge-css" href="/wp-digipay/x.css">']), ["digipay"])
        self.assertEqual(detect(['{"allowed":["api.snapppay.ir","cpg.torobpay.com"]}']), ["snapppay", "torobpay"])
        self.assertEqual(detect(["<h2>خرید قسطی از پی اس ان با همکاری ترب‌پی</h2>"]), ["torobpay"])
        self.assertEqual(detect(['<img alt="دیجی پی">']), ["digipay"])

    def test_own_plan_only_without_a_provider(self):
        self.assertEqual(detect(["<span>خرید اقساطی</span>"]), ["own"])
        self.assertEqual(detect(["خرید اقساطی با سرویس اقساطی دیجی پی"]), ["digipay"])
        self.assertEqual(detect(["<p>نقدی</p>"]), [])

    def test_noise_is_ignored(self):
        self.assertEqual(detect([":root{--color-digipay:#0040ff;}"]), [])
        self.assertEqual(detect(["<style>.torobpay-widget{border:0}</style>"]), [])
        self.assertEqual(detect(['"activate_snapppay_payment_customization":{"enabled":true}']), [])
        self.assertEqual(detect(["دیجی پین"]), [])


if __name__ == "__main__":
    unittest.main()
