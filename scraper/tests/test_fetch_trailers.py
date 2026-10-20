import unittest

from fetch_trailers import featured_trailer_url, trailer_key


class TrailerTests(unittest.TestCase):
    def test_first_preview_video_wins_and_other_roles_are_ignored(self):
        html = (
            '{"role":"SCREENSHOT","type":"IMAGE","url":"https://x/a.jpg"}'
            '{"role":"BACKGROUND","type":"VIDEO","url":"https://x/bg.mp4"}'
            '{"role":"PREVIEW","type":"VIDEO","url":"https://vulcan.dl.playstation.net/one.mp4"}'
            '{"role":"PREVIEW","type":"VIDEO","url":"https://vulcan.dl.playstation.net/two.mp4"}'
        )
        self.assertEqual(featured_trailer_url(html), "https://vulcan.dl.playstation.net/one.mp4")

    def test_no_trailer(self):
        self.assertIsNone(featured_trailer_url('{"role":"PREVIEW","type":"IMAGE","url":"https://x/a.jpg"}'))

    def test_key_changes_only_with_the_source(self):
        a = trailer_key("fc-27", "https://v/1.mp4")
        self.assertEqual(a, trailer_key("fc-27", "https://v/1.mp4"))
        self.assertNotEqual(a, trailer_key("fc-27", "https://v/2.mp4"))
        self.assertRegex(a, r"^trailers/fc-27-[0-9a-f]{10}\.mp4$")


if __name__ == "__main__":
    unittest.main()
