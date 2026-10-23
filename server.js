const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
// DATA_DIR can point to durable storage in production (for example, a mounted disk).
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
const dataFile = path.join(dataDir, 'carteira.json');
const usersFile = path.join(dataDir, 'usuarios.json');
const profilesDir = path.join(dataDir, 'perfis');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const collections = ['assets','transactions','quotes','snapshots','dividends','plans','fixedIncome','fixedIncomeObservations','dailyMarketSnapshots','marketCaptureReports','historicalSnapshots','dailyReportRecords','sourceLogs','research','portfolioAllocationSnapshots','dailyAssetImpacts','contributionHistory','withinClassWeights','positionHistory','importedRules','importReports','rawHistoryImports'];
function mergeState(current, incoming) {
  const merged = { ...current, ...incoming };
  for (const key of collections) {
    const oldRows = Array.isArray(current[key]) ? current[key] : [];
    const newRows = Array.isArray(incoming[key]) ? incoming[key] : [];
    const idFor = row => key === 'assets' ? String(row.ticker || row.id) : String(row.id || row.importKey || JSON.stringify(row));
    const map = new Map(oldRows.map(row => [idFor(row), row]));
    for (const row of newRows) map.set(idFor(row), { ...map.get(idFor(row)), ...row });
    merged[key] = [...map.values()];
  }
  merged.importedFiles = [...new Set([...(current.importedFiles || []), ...(incoming.importedFiles || [])])];
  merged.settings = { ...(current.settings || {}), ...(incoming.settings || {}) };
  return merged;
}
function sendJson(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
function readBody(req) { return new Promise((resolve, reject) => { let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 20 * 1024 * 1024) reject(new Error('Payload muito grande')); }); req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON inválido')); } }); req.on('error', reject); }); }
let persistQueue = Promise.resolve();
function persistState(incoming, userId) {
  const task = persistQueue.then(async () => {
    await fs.promises.mkdir(userId === 'vitor-samuel' ? dataDir : profilesDir, { recursive: true });
    const targetFile = userId === 'vitor-samuel' ? dataFile : path.join(profilesDir, `${userId}.json`);
    let current = {};
    try { current = JSON.parse(await fs.promises.readFile(targetFile, 'utf8')); }
    catch (err) { if (err.code !== 'ENOENT') throw new Error('Arquivo de dados inválido; nada foi sobrescrito.'); }
    const next = mergeState(current, incoming);
    const tmp = `${targetFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
    await fs.promises.rename(tmp, targetFile);
    return next;
  });
  persistQueue = task.catch(() => {});
  return task;
}
const sessionStore = new Map();
const sessionCookie = 'carteira_session';
function derivePassword(password, salt) { return crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex'); }
function safeEqualHex(left, right) { try { const a=Buffer.from(left,'hex'),b=Buffer.from(right,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b) } catch { return false } }
function initializeUsers() {
  let users=[];
  try { users=JSON.parse(fs.readFileSync(usersFile,'utf8')); if(!Array.isArray(users))users=[]; } catch (err) { if(err.code!=='ENOENT') throw err; }
  const defaults=[{id:'vitor-samuel',username:'Vitor Samuel',normalized:'vitor samuel'},{id:'teste',username:'Teste',normalized:'teste'}];
  let changed=false;
  for(const item of defaults){
    if(users.some(u=>u.id===item.id))continue;
    const password = process.env.NODE_ENV === 'production'
      ? process.env[item.id === 'vitor-samuel' ? 'VITOR_INITIAL_PASSWORD' : 'TESTE_INITIAL_PASSWORD']
      : '123456';
    if (!password || (process.env.NODE_ENV === 'production' && password.length < 12)) {
      throw new Error(`Configure ${item.id === 'vitor-samuel' ? 'VITOR_INITIAL_PASSWORD' : 'TESTE_INITIAL_PASSWORD'} com pelo menos 12 caracteres antes da primeira inicialização em produção.`);
    }
    const salt=crypto.randomBytes(16).toString('hex');
    users.push({...item,salt,passwordHash:derivePassword(password,salt),createdAt:new Date().toISOString()});changed=true;
  }
  if(changed||!fs.existsSync(usersFile)){fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(usersFile,JSON.stringify(users,null,2),'utf8');}
  return users;
}
const users=initializeUsers();
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));}
function currentUser(req){const token=cookies(req)[sessionCookie],session=token&&sessionStore.get(token);if(!session)return null;if(session.expiresAt<Date.now()){sessionStore.delete(token);return null;}return users.find(u=>u.id===session.userId)||null;}
function requireUser(req,res){const user=currentUser(req);if(!user)sendJson(res,401,{error:'Faça login para acessar sua carteira.'});return user;}
function publicUser(user){return {id:user.id,name:user.username};}
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if(pathname==='/healthz'&&req.method==='GET'){
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ok:true}));
  }
  if(pathname==='/api/session'&&req.method==='GET'){
    const user=currentUser(req);return sendJson(res,200,{authenticated:!!user,user:user?publicUser(user):null});
  }
  if(pathname==='/api/login'&&req.method==='POST'){
    readBody(req).then(body=>{
      const normalized=String(body?.username||'').trim().toLocaleLowerCase('pt-BR');
      const normalizedId=normalized.replace(/\s+/g,'-');
      const user=users.find(u=>u.normalized===normalized||u.id===normalizedId);const password=String(body?.password||'');
      if(!user||!safeEqualHex(derivePassword(password,user.salt),user.passwordHash))return sendJson(res,401,{error:'Perfil ou senha incorretos.'});
      const previousToken=cookies(req)[sessionCookie];if(previousToken)sessionStore.delete(previousToken);
      const token=crypto.randomBytes(32).toString('hex');sessionStore.set(token,{userId:user.id,expiresAt:Date.now()+8*60*60*1000});
      const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie',`${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie}`);
      sendJson(res,200,{authenticated:true,user:publicUser(user)});
    }).catch(error=>sendJson(res,400,{error:error.message}));return;
  }
  if(pathname==='/api/logout'&&req.method==='POST'){
    const token=cookies(req)[sessionCookie];if(token)sessionStore.delete(token);const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';res.setHeader('Set-Cookie',`${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`);return sendJson(res,200,{ok:true});
  }
  if(pathname==='/api/state'&&(req.method==='GET'||req.method==='PUT')){
    const user=requireUser(req,res);if(!user)return;
    const targetFile=user.id==='vitor-samuel'?dataFile:path.join(profilesDir,`${user.id}.json`);
    if(req.method==='GET'){
      fs.readFile(targetFile,'utf8',(err,raw)=>{if(err&&err.code==='ENOENT')return sendJson(res,200,{state:null});if(err)return sendJson(res,500,{error:'Não foi possível ler os dados deste perfil.'});try{return sendJson(res,200,{state:JSON.parse(raw)});}catch{return sendJson(res,500,{error:'Arquivo de dados deste perfil inválido; preservado para recuperação.'});}});return;
    }
    readBody(req).then(incoming=>{if(!incoming||typeof incoming!=='object'||!Array.isArray(incoming.assets))return sendJson(res,400,{error:'Estado inválido.'});persistState(incoming,user.id).then(()=>sendJson(res,200,{ok:true})).catch(err=>sendJson(res,500,{error:err.message}));}).catch(error=>sendJson(res,400,{error:error.message}));return;
  }
  const appAddress = '/Controle_Carteira_de_investimento';
  const relative = pathname === '/' || pathname === appAddress || pathname === `${appAddress}/` ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) && target !== path.join(root, 'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  });
});
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
server.listen(port, host, () => console.log(`Painel disponível em http://${host}:${port}`));
