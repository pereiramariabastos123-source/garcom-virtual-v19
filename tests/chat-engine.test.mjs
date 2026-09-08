import assert from "node:assert/strict";
import fs from "node:fs";
import {processDeterministicMessage,validateOrderNote,detectProductMentions} from "../chat-engine.js";

const menu=JSON.parse(fs.readFileSync(new URL("../data/menu.json",import.meta.url),"utf8"));
function run(message,context={},customMenu=menu){return processDeterministicMessage({message,menu:customMenu,context})}
function item(name){return menu.find(x=>x.name===name)}

// Saudações e conversa básica
let r=run("oi",{clientHour:9});
assert.match(r.reply,/Bom dia/);
assert.match(r.reply,/Garçom Virtual do Sabor da Casa/);
r=run("boa noite",{clientHour:21});
assert.match(r.reply,/Boa noite/);

// Saudação + pedido no mesmo texto não pode engolir o pedido
r=run("oi quero um x-salada e uma coca-cola");
assert.deepEqual(r.add_items.map(x=>x.name),["X-Salada","Coca-Cola 350 ml"]);

// Detecção exata e aliases
assert.deepEqual(detectProductMentions("xsalada",menu).map(x=>x.product.name),["X-Salada"]);
assert.deepEqual(detectProductMentions("xis salada",menu).map(x=>x.product.name),["X-Salada"]);
assert.deepEqual(detectProductMentions("coca",menu).map(x=>x.product.name),["Coca-Cola 350 ml"]);
assert.deepEqual(detectProductMentions("suco laranja",menu).map(x=>x.product.name),["Suco de Laranja"]);

// Pedido simples / múltiplo
r=run("quero um x-salada e uma coca-cola");
assert.deepEqual(r.add_items.map(x=>x.name),["X-Salada","Coca-Cola 350 ml"]);
assert.equal(r.context.awaitingFinalize,true);
r=run("quero dois x-salada");
assert.equal(r.add_items[0].qty,2);
// Mesma comida com preparações diferentes deve virar linhas separadas.
r=run("quero dois x-salada, um normal e outro sem tomate");
assert.equal(r.add_items.length,2);
assert.deepEqual(r.add_items.map(x=>x.qty),[1,1]);
assert.deepEqual(r.add_items.map(x=>x.note),["","Sem tomate"]);
assert.match(r.reply,/X-Salada/);
r=run("vou querer um suco de laranja");
assert.equal(r.add_items[0].name,"Suco de Laranja");
r=run("e um suco de laranja",{awaitingFinalize:true});
assert.equal(r.add_items[0].name,"Suco de Laranja");
assert.equal(r.context.awaitingFinalize,true);
r=run("quero x-salada e suco laranja");
assert.deepEqual(r.add_items.map(x=>x.name),["X-Salada","Suco de Laranja"]);

// Confirmação abre carrinho, não envia pedido sozinho
r=run("sim",{awaitingFinalize:true});
assert.equal(r.show_cart,true);
assert.equal(r.add_items.length,0);
r=run("não",{awaitingFinalize:true});
assert.equal(r.show_cart,false);
assert.match(r.reply,/Tudo bem/);

// Fotos: nunca pode trocar de produto
r=run("foto do x-salada");
assert.equal(r.show_product,"X-Salada");
assert.doesNotMatch(r.reply,/Frango/i);
r=run("ver x-salada");
assert.equal(r.show_product,"X-Salada");
r=run("cadê a foto dele",{focusedProduct:"X-Salada"});
assert.equal(r.show_product,"X-Salada");
r=run("cadê a foto dele",{focusedProduct:"Frango Caseiro"});
assert.equal(r.show_product,"Frango Caseiro");
r=run("foto do suco de laranja");
assert.equal(r.show_product,"Suco de Laranja");

// Modificações estruturadas: somente o ingrediente solicitado
r=run("quero um x-salada sem tomate");
assert.equal(r.add_items[0].name,"X-Salada");
assert.equal(r.add_items[0].note,"Sem tomate");
assert.doesNotMatch(r.add_items[0].note,/queijo/i);
r=run("quero um x-salada sem alfasse");
assert.equal(r.add_items[0].note,"Sem alface");
r=run("quero um x-salada sem alface e tomate");
assert.equal(r.add_items[0].note,"Sem alface e tomate");
r=run("quero um x-salada sem queijo");
assert.equal(r.add_items[0].note,"Sem queijo");
r=run("quero um x-salada sem cebola");
assert.equal(r.add_items.length,0);
assert.match(r.reply,/não consta/i);

// "sem verduras" deve perguntar, nunca adivinhar
r=run("quero um x-salada sem verduras");
assert.equal(r.add_items.length,0);
assert.equal(r.context.pendingModificationProduct,"X-Salada");
assert.match(r.reply,/alface/);
assert.match(r.reply,/tomate/);
r=run("sem alface e tomate",{pendingModificationProduct:"X-Salada",focusedProduct:"X-Salada"});
assert.equal(r.add_items[0].name,"X-Salada");
assert.equal(r.add_items[0].note,"Sem alface e tomate");

// Observação do pedido também é validada no servidor
assert.equal(validateOrderNote(item("X-Salada"),"Sem tomate"),"Sem tomate");
assert.equal(validateOrderNote(item("X-Salada"),"Sem tomate e queijo"),"Sem queijo e tomate");
assert.equal(validateOrderNote(item("X-Salada"),"Sem cebola"),"");
assert.equal(validateOrderNote(item("Água Mineral"),"Sem tomate"),"");
assert.equal(validateOrderNote(item("Coca-Cola 350 ml"),"Sem gelo"),"");
assert.equal(validateOrderNote(item("X-Salada"),"caprichar"),"");

// Disponibilidade e itens ocultos
const sold=menu.map(x=>x.name==="X-Salada"?{...x,status:"esgotado"}:x);
r=run("quero um x-salada",{},sold);
assert.equal(r.add_items.length,0);
assert.match(r.reply,/esgotado/);
r=run("foto do misto quente");
assert.equal(r.show_product,null);
assert.match(r.reply,/não está disponível/i);
r=run("quero um misto quente");
assert.equal(r.add_items.length,0);
assert.match(r.reply,/não está/i);

// Preço, ingredientes e disponibilidade devem vir do cardápio
r=run("quanto custa o bife acebolado?");
assert.match(r.reply,/R\$\s*29,00/);
r=run("o que vem no x-salada?");
assert.match(r.reply,/pão/i);
assert.match(r.reply,/tomate/i);
r=run("tem x-salada hoje?");
assert.match(r.reply,/disponível/);

// Categorias só listam disponíveis e nunca item oculto
r=run("quais lanches tem?");
assert.match(r.reply,/X-Burger/);
assert.match(r.reply,/X-Salada/);
assert.doesNotMatch(r.reply,/Misto Quente/);

// Recomendações também são determinísticas
r=run("me recomenda algo até 20");
assert.equal(r.show_product,"X-Salada");
assert.equal(r.context.pendingRecommendationProduct,"X-Salada");
r=run("sim",{pendingRecommendationProduct:"X-Salada"});
assert.equal(r.add_items[0].name,"X-Salada");
assert.equal(r.context.awaitingFinalize,true);

// Finalização explícita só abre carrinho
r=run("feche meu pedido");
assert.equal(r.show_cart,true);
assert.equal(r.add_items.length,0);

console.log("OK: 52 verificações críticas do atendimento passaram.");
