import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, urlparse
from pathlib import Path
from base64 import b64encode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'data'
DATA_FILE = DATA_DIR / 'app-data.json'
PORT = int(os.environ.get('PORT', '3000'))

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
}


def ensure_data_file():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(json.dumps(create_seed_data(), ensure_ascii=False, indent=2), encoding='utf-8')


def create_seed_data():
    return {
        'categories': [
            {'id': 'cat-health', 'name': '健康', 'icon': 'heart', 'color': '#10B981', 'description': '保持身心健康', 'order': 1},
            {'id': 'cat-work', 'name': '工作', 'icon': 'briefcase', 'color': '#3B82F6', 'description': '工作相关', 'order': 2},
            {'id': 'cat-study', 'name': '学习', 'icon': 'book-open', 'color': '#8B5CF6', 'description': '持续学习', 'order': 3},
        ],
        'items': [
            {'id': 'item-water', 'categoryId': 'cat-health', 'name': '喝水', 'unit': 'ml', 'target': 2000, 'planTime': '09:00', 'duration': 5, 'createdAt': '2026-07-24T00:00:00.000Z'},
            {'id': 'item-sport', 'categoryId': 'cat-health', 'name': '运动', 'unit': '分钟', 'target': 30, 'planTime': '18:30', 'duration': 30, 'createdAt': '2026-07-24T00:00:00.000Z'},
            {'id': 'item-sleep', 'categoryId': 'cat-health', 'name': '睡眠', 'unit': '小时', 'target': 8, 'planTime': '23:00', 'duration': 480, 'createdAt': '2026-07-24T00:00:00.000Z'},
            {'id': 'item-focus', 'categoryId': 'cat-work', 'name': '专注工作', 'unit': '小时', 'target': 6, 'planTime': '09:30', 'duration': 360, 'createdAt': '2026-07-24T00:00:00.000Z'},
            {'id': 'item-pomodoro', 'categoryId': 'cat-work', 'name': '番茄钟', 'unit': '个', 'target': 8, 'planTime': '10:00', 'duration': 25, 'createdAt': '2026-07-24T00:00:00.000Z'},
            {'id': 'item-read', 'categoryId': 'cat-study', 'name': '阅读', 'unit': '页', 'target': 30, 'planTime': '21:00', 'duration': 30, 'createdAt': '2026-07-24T00:00:00.000Z'},
            {'id': 'item-write', 'categoryId': 'cat-study', 'name': '写作', 'unit': '字', 'target': 500, 'planTime': '20:00', 'duration': 60, 'createdAt': '2026-07-24T00:00:00.000Z'},
        ],
        'records': [],
        'settings': {
            'timezone': 'Asia/Shanghai',
            'language': 'zh-CN',
            'notificationEnabled': True,
            'remindAheadMinutes': 0,
            'nutstore': {
                'enabled': False,
                'baseUrl': 'https://dav.jianguoyun.com/dav/',
                'username': '',
                'password': '',
                'remotePath': '小秘书/app-data.json',
            },
        },
        'finance': {'profile': {'name': '我的财务', 'cash': 0}, 'assets': [], 'liabilities': [], 'incomes': [], 'expenses': []},
        'health': {'meds': [], 'bloodPressures': [], 'heartRates': [], 'weights': [], 'waistMeasurements': [], 'medicationLogs': []},
    }


def read_data():
    ensure_data_file()
    return json.loads(DATA_FILE.read_text(encoding='utf-8'))


def write_data(payload):
    ensure_data_file()
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def build_sync_url(base_url, remote_path):
    cleaned_base = base_url.rstrip('/')
    cleaned_path = remote_path.lstrip('/')
    encoded_path = quote(cleaned_path, safe='/')
    return f'{cleaned_base}/{encoded_path}'


def collect_parent_paths(remote_path):
    normalized = remote_path.strip('/').split('/')
    if len(normalized) <= 1:
        return []
    parents = []
    for idx in range(1, len(normalized)):
        parents.append('/'.join(normalized[:idx]))
    return parents


def ensure_remote_directory(base_url, remote_path, auth):
    for parent in collect_parent_paths(remote_path):
        url = build_sync_url(base_url, parent)
        req = Request(url, method='MKCOL', headers={'Authorization': f'Basic {auth}'})
        try:
            with urlopen(req, timeout=10):
                pass
        except HTTPError as exc:
            if exc.code not in {405, 409, 301, 302, 303, 307, 308}:
                raise


def sync_to_nutstore(data):
    nutstore = data.get('settings', {}).get('nutstore', {})
    if not nutstore.get('enabled') or not nutstore.get('username') or not nutstore.get('password'):
        return {'ok': True, 'skipped': True, 'message': '未启用坚果云同步'}
    base_url = nutstore.get('baseUrl', 'https://dav.jianguoyun.com/dav/')
    remote_path = nutstore.get('remotePath', '小秘书/app-data.json')
    url = build_sync_url(base_url, remote_path)
    body = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
    auth = b64encode(f"{nutstore['username']}:{nutstore['password']}".encode('utf-8')).decode('ascii')
    try:
        ensure_remote_directory(base_url, remote_path, auth)
        req = Request(url, data=body, method='PUT', headers={'Authorization': f'Basic {auth}', 'Content-Type': 'application/json; charset=utf-8'})
        with urlopen(req, timeout=10) as response:
            return {'ok': True, 'synced': True, 'status': getattr(response, 'status', 200), 'message': f'已上传到 {remote_path}'}
    except HTTPError as exc:
        return {'ok': False, 'message': f'同步失败: {exc.code} {exc.reason}', 'status': exc.code}
    except Exception as exc:
        return {'ok': False, 'message': f'同步失败: {exc}', 'status': 500}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/data':
            self.send_json(200, {'ok': True, 'data': read_data()})
            return
        if parsed.path == '/api/export':
            data = read_data()
            body = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="app-data.json"')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        path = parsed.path
        if path == '/':
            path = '/index.html'
        file_path = (ROOT / path.lstrip('/')).resolve()
        if file_path.exists() and file_path.is_file() and str(file_path).startswith(str(ROOT)):
            content = file_path.read_bytes()
            ext = file_path.suffix.lower()
            mime = MIME_TYPES.get(ext, 'application/octet-stream')
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        self.send_json(404, {'ok': False, 'message': '未找到资源'})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/data':
            try:
                length = int(self.headers.get('Content-Length', '0'))
                body = self.rfile.read(length).decode('utf-8') if length else '{}'
                payload = json.loads(body) if body else {}
                write_data(payload)
                try:
                    sync_result = sync_to_nutstore(payload)
                except Exception as exc:
                    sync_result = {'ok': False, 'message': str(exc)}
                self.send_json(200, {'ok': True, 'data': payload, 'sync': sync_result})
            except Exception as exc:
                self.send_json(400, {'ok': False, 'message': str(exc)})
            return
        if parsed.path == '/api/sync-now':
            try:
                data = read_data()
                self.send_json(200, {'ok': True, 'sync': sync_to_nutstore(data)})
            except Exception as exc:
                self.send_json(500, {'ok': False, 'message': str(exc)})
            return
        self.send_json(404, {'ok': False, 'message': '未找到接口'})

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    ensure_data_file()
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'小秘书 PWA 已启动，访问 http://localhost:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('正在关闭服务')
        server.server_close()
