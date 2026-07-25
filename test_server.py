import unittest
from unittest.mock import patch

import server


class SyncUrlTests(unittest.TestCase):
    def test_build_sync_url_encodes_non_ascii_path(self):
        url = server.build_sync_url('https://dav.jianguoyun.com/dav/', '小秘书/app-data.json')
        self.assertEqual(url, 'https://dav.jianguoyun.com/dav/%E5%B0%8F%E7%A7%98%E4%B9%A6/app-data.json')

    def test_collect_parent_paths_for_nested_remote_path(self):
        paths = server.collect_parent_paths('小秘书/子目录/app-data.json')
        self.assertEqual(paths, ['小秘书', '小秘书/子目录'])

    def test_sync_to_nutstore_handles_network_errors(self):
        data = {
            'settings': {
                'nutstore': {
                    'enabled': True,
                    'username': 'u',
                    'password': 'p',
                    'baseUrl': 'https://dav.jianguoyun.com/dav/',
                    'remotePath': '小秘书/app-data.json',
                }
            }
        }
        with patch('server.urlopen', side_effect=TimeoutError('boom')):
            result = server.sync_to_nutstore(data)
        self.assertFalse(result['ok'])
        self.assertIn('同步失败', result['message'])


if __name__ == '__main__':
    unittest.main()
