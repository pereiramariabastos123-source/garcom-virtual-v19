import assert from 'node:assert/strict';
import fs from 'node:fs';
const menu=JSON.parse(fs.readFileSync(new URL('../data/menu.json',import.meta.url),'utf8'));
assert.equal(menu.length,11,'Cardápio deve manter 11 produtos');
for(const p of menu){
  assert.ok(p.name && Number.isFinite(Number(p.price)),'Produto inválido');
  assert.ok(fs.existsSync(new URL('../'+p.image,import.meta.url)),`Foto ausente: ${p.name}`);
}
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/<title>Garçom Virtual V26/);
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.match(app,/function findProductExactName/);
assert.match(app,/cartAddByName/);
assert.match(app,/setInterval\(loadRestaurantOrders,4000\)/);
const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
assert.match(server,/processDeterministicMessage/);
assert.match(server,/validateOrderNote/);
assert.match(server,/const VERSION="V24"/);
console.log('OK: validação estrutural, 11 produtos, 11 fotos e integrações essenciais passaram.');
