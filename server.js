require('dotenv').config();

const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { hashPassword, verifyPassword } = require('./auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = path.join(__dirname, 'data', 'app.sqlite');
const db = new sqlite3.Database(DB_PATH);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'validade-produto-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_user TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consent_accepted INTEGER DEFAULT 0,
        device_id TEXT,
        browser TEXT,
        platform TEXT,
        language TEXT,
        screen TEXT,
        hostname TEXT,
        pathname TEXT,
        referrer TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS consent_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE NOT NULL,
        consent_accepted INTEGER DEFAULT 1,
        accepted_at TEXT DEFAULT CURRENT_TIMESTAMP,
        browser TEXT,
        platform TEXT,
        language TEXT,
        screen TEXT,
        hostname TEXT,
        pathname TEXT,
        referrer TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS blocked_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.get('SELECT COUNT(*) as total FROM users', (err, row) => {
      if (!err && row && Number(row.total) === 0) {
        const githubUser = (process.env.DEV_GITHUB_USER || 'LeoDev991').trim();
        const defaultPassword = process.env.DEV_GITHUB_PASSWORD || 'github123';
        const defaultHash = hashPassword(defaultPassword);

        db.run(
          'INSERT INTO users (github_user, password_hash, name) VALUES (?, ?, ?)',
          [githubUser, defaultHash, 'Developer'],
          (insertErr) => {
            if (insertErr) {
              console.error('Erro ao criar usuário padrão:', insertErr);
              return;
            }

            console.log(`Usuário padrão criado. Login: ${githubUser} / Senha: ${defaultPassword}`);
          }
        );
      }
    });
  });
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  return res.status(401).json({ error: 'Não autenticado.' });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'online' });
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }

  return res.json({ authenticated: false });
});

app.post('/api/login', (req, res) => {
  const { github_user, password } = req.body || {};
  if (!github_user || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha.' });
  }

  db.get('SELECT * FROM users WHERE github_user = ?', [String(github_user).trim()], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!verifyPassword(String(password), user.password_hash)) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    req.session.user = {
      id: user.id,
      github_user: user.github_user,
      name: user.name
    };

    return res.json({ ok: true, user: req.session.user });
  });
});

app.post('/api/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      return res.json({ ok: true });
    });
    return;
  }

  return res.json({ ok: true });
});

app.post('/api/consent', (req, res) => {
  const body = req.body || {};
  const deviceId = String(body.deviceId || '').trim();

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId é obrigatório.' });
  }

  const payload = {
    device_id: deviceId,
    consent_accepted: 1,
    browser: body.browser || '',
    platform: body.platform || '',
    language: body.language || '',
    screen: body.screen || '',
    hostname: body.hostname || '',
    pathname: body.pathname || '',
    referrer: body.referrer || '',
    accepted_at: new Date().toISOString()
  };

  db.run(
    `INSERT INTO consent_registry (device_id, consent_accepted, accepted_at, browser, platform, language, screen, hostname, pathname, referrer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET
       consent_accepted = excluded.consent_accepted,
       accepted_at = excluded.accepted_at,
       browser = excluded.browser,
       platform = excluded.platform,
       language = excluded.language,
       screen = excluded.screen,
       hostname = excluded.hostname,
       pathname = excluded.pathname,
       referrer = excluded.referrer`,
    [
      payload.device_id,
      payload.consent_accepted,
      payload.accepted_at,
      payload.browser,
      payload.platform,
      payload.language,
      payload.screen,
      payload.hostname,
      payload.pathname,
      payload.referrer
    ],
    function (err) {
      if (err) {
        console.error('Erro ao gravar consentimento:', err);
        return res.status(500).json({ error: 'Erro ao gravar consentimento.' });
      }

      db.run(
        `INSERT INTO access_logs (consent_accepted, device_id, browser, platform, language, screen, hostname, pathname, referrer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          1,
          payload.device_id,
          payload.browser,
          payload.platform,
          payload.language,
          payload.screen,
          payload.hostname,
          payload.pathname,
          payload.referrer
        ],
        (logErr) => {
          if (logErr) {
            console.error('Erro ao gravar log de acesso:', logErr);
          }
          return res.json({ ok: true, message: 'Consentimento salvo.' });
        }
      );
    }
  );
});

app.get('/api/access-log', requireAuth, (req, res) => {
  db.all('SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 200', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar registros.' });
    }

    return res.json(rows);
  });
});

app.get('/api/consent-list', requireAuth, (req, res) => {
  db.all('SELECT * FROM consent_registry ORDER BY accepted_at DESC LIMIT 200', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar consentimentos.' });
    }

    return res.json(rows);
  });
});

app.get('/api/blocked-devices', requireAuth, (req, res) => {
  db.all('SELECT * FROM blocked_devices ORDER BY created_at DESC LIMIT 200', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar bloqueados.' });
    }

    return res.json(rows);
  });
});

app.post('/api/block-device', requireAuth, (req, res) => {
  const { deviceId, reason } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId obrigatório.' });
  }

  db.run(
    'INSERT OR IGNORE INTO blocked_devices (device_id, reason) VALUES (?, ?)',
    [String(deviceId), String(reason || 'Bloqueado pelo desenvolvedor')],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao bloquear dispositivo.' });
      }

      return res.json({ ok: true });
    }
  );
});

app.post('/api/unblock-device', requireAuth, (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId obrigatório.' });
  }

  db.run('DELETE FROM blocked_devices WHERE device_id = ?', [String(deviceId)], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao desbloquear dispositivo.' });
    }

    return res.json({ ok: true });
  });
});

app.delete('/api/access-log', requireAuth, (req, res) => {
  db.run('DELETE FROM access_logs', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao limpar registros.' });
    }

    return res.json({ ok: true });
  });
});

app.use(express.static(__dirname));

app.get('/dev_acessos.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dev_acessos.html'));
});

app.get('/validade.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'validade.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'validade.html'));
});

initDb();

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Usuário padrão: ${process.env.DEV_GITHUB_USER || 'LeoDev991'}`);
  console.log(`Senha padrão: ${process.env.DEV_GITHUB_PASSWORD || 'github123'}`);
});
