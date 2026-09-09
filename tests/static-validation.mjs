import assert from 'node:assert/strict';
import fs from 'node:fs';
const menu=JSON.parse(fs.readFileSync(new URL('../data/menu.json',import.meta.url),'utf8'));
assert.equal(menu.length,11,'Cardápio deve manter 11 produtos');
for(const p of menu){
  assert.ok(p.name && Number.isFinite(Number(p.price)),'Produto inválido');
  assert.ok(fs.existsSync(new URL('../'+p.image,import.meta.url)),`Foto ausente: ${p.name}`);
}
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/<title>Garçom Virtual V29 Demonstração/);
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.match(app,/function findProductExactName/);
assert.match(app,/cartAddByName/);
assert.match(app,/setInterval\(loadRestaurantOrders,4000\)/);
const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
assert.match(server,/validateOrderNote/);
assert.match(server,/const VERSION="V29 DEMONSTRACAO"/);
console.log('OK: validação estrutural, 11 produtos, 11 fotos e integrações essenciais passaram.');

assert.doesNotMatch(server,/OpenAI|OPENAI_API_KEY|responses\.create|\/api\/chat/);

assert.doesNotMatch(html,/id="chatThread"|id="chatInput"|Me recomenda/);
assert.match(html,/>Combos</);
assert.match(app,/✏️ Observação/);
assert.match(app,/placeholder="Ex\.: sem tomate"/);
assert.match(app,/function updateCartNote/);
assert.match(app,/function openCombosMenu/);

assert.match(app,/async function syncClientMenu/);
assert.match(app,/setInterval\(syncClientMenu,3000\)/);
assert.match(app,/refreshOpenVisualMenu/);
