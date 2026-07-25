const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const dataFile = path.join(dataDir, 'app-data.json');
const port = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    const seed = createSeedData();
    fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2));
  }
}

function createSeedData() {
  return {
    categories: [
      { id: 'cat-health', name: '健康', icon: 'heart', color: '#10B981', description: '保持身心健康', order: 1 },
      { id: 'cat-work', name: '工作', icon: 'briefcase', color: '#3B82F6', description: '工作相关', order: 2 },
      { id: 'cat-study', name: '学习', icon: 'book-open', color: '#8B5CF6', description: '持续学习', order: 3 }
    ],
    items: [
      { id: 'item-water', categoryId: 'cat-health', name: '喝水', unit: 'ml', target: 2000, planTime: '09:00', duration: 5, createdAt: new Date().toISOString() },
      { id: 'item-sport', categoryId: 'cat-health', name: '运动', unit: '分钟', target: 30, planTime: '18:30', duration: 30, createdAt: new Date().toISOString() },
      { id: 'item-sleep', categoryId: 'cat-health', name: '睡眠', unit: '小时', target: 8, planTime: '23:00', duration: 480, createdAt: new Date().toISOString() },
      { id: 'item-focus', categoryId: 'cat-work', name: '专注工作', unit: '小时', target: 6, planTime: '09:30', duration: 360, createdAt: new Date().toISOString() },
      { id: 'item-pomodoro', categoryId: 'cat-work', name: '番茄钟', unit: '个', target: 8, planTime: '10:00', duration: 25, createdAt: new Date().toISOString() },
      { id: 'item-read', categoryId: 'cat-study', name: '阅读', unit: '页', target: 30, planTime: '21:00', duration: 30, createdAt: new Date().toISOString() },
      { id: 'item-write', categoryId: 'cat-study', name: '写作', unit: '字', target: 500, planTime: '20:00', duration: 60, createdAt: new Date().toISOString() }
    ],
    records: [],
    settings: {
      timezone: 'Asia/Shanghai',
      language: 'zh-CN',
      notificationEnabled: true,
      remindAheadMinutes: 0,
      nutstore: {
        enabled: false,
        baseUrl: 'https://dav.jianguoyun.com/dav/',
        username: '',
        password: '',
        remotePath: '小秘书/app-data.json'
      }
    },
    finance: {
      profile: { name: '我的财务', cash: 0 },
      assets: [],
      liabilities: [],
      incomes: [],
      expenses: []
    },
    health: {
      meds: [],
      bloodPressures: [],
      heartRates: [],
      weights: [],
      waistMeasurements: [],
      medicationLogs: []
    }
  };
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeData(payload) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(payload, null, 2));
}

async function syncToNutstore(data) {
  const nutstore = data?.settings?.nutstore || {};
  if (!nutstore.enabled || !nutstore.username || !nutstore.password) return { ok: true, skipped: true };

  const url = new URL(nutstore.remotePath || '小秘书/app-data.json', nutstore.baseUrl || 'https://dav.jianguoyun.com/dav/');
  const payload = JSON.stringify(data, null, 2);

  const auth = Buffer.from(`${nutstore.username}:${nutstore.password}`).toString('base64');
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: payload
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`坚果云同步失败: ${response.status} ${text}`);
  }

  return { ok: true, synced: true, status: response.status };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/data') {
    const data = readData();
    return sendJson(res, 200, { ok: true, data });
  }

  if (req.method === 'POST' && url.pathname === '/api/data') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        writeData(payload);
        let syncResult = { ok: true, skipped: true };
        try {
          syncResult = await syncToNutstore(payload);
        } catch (error) {
          syncResult = { ok: false, message: error.message };
        }
        return sendJson(res, 200, { ok: true, data: payload, sync: syncResult });
      } catch (error) {
        return sendJson(res, 400, { ok: false, message: error.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/sync-now') {
    try {
      const data = readData();
      const syncResult = await syncToNutstore(data);
      return sendJson(res, 200, { ok: true, sync: syncResult });
    } catch (error) {
      return sendJson(res, 500, { ok: false, message: error.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/export') {
    const data = readData();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="app-data.json"' });
    res.end(JSON.stringify(data, null, 2));
    return;
  }

  const safePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(rootDir, safePath));
  const withinRoot = filePath.startsWith(rootDir);
  if (withinRoot && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(res, filePath);
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, message: '未找到资源' }));
});

server.listen(port, () => {
  console.log(`小秘书 PWA 已启动，访问 http://localhost:${port}`);
});
