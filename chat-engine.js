// Deterministic restaurant chat engine.
// Critical actions (product, photo, cart and modifications) are resolved here,
// never trusted to free-form AI output.

export function normalize(value="") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER_WORDS = new Map([
  ["um",1],["uma",1],["dois",2],["duas",2],["tres",3],["quatro",4],["cinco",5]
]);

const MANUAL_ALIASES = {
  "Frango Caseiro":["frango caseiro","frango"],
  "Bife Acebolado":["bife acebolado","bife"],
  "Lasanha à Bolonhesa":["lasanha a bolonhesa","lasanha bolonhesa","lasanha"],
  "Peixe Frito":["peixe frito","peixe"],
  "X-Burger":["x burger","xburger","xis burger"],
  "X-Salada":["x salada","xsalada","xis salada"],
  "Misto Quente":["misto quente","misto"],
  "Coca-Cola 350 ml":["coca cola 350 ml","coca cola","cocacola","coca"],
  "Guaraná 350 ml":["guarana 350 ml","guarana"],
  "Suco de Laranja":["suco de laranja","suco laranja","suco"],
  "Água Mineral":["agua mineral","agua"]
};

const INGREDIENT_ALIASES = {
  alface:["alface","alfasse","alfacee"],
  tomate:["tomate","tomates"],
  cebola:["cebola","cebolas"],
  queijo:["queijo","queijos"],
  presunto:["presunto"],
  carne:["carne"],
  "carne moída":["carne moida"],
  arroz:["arroz"],
  "feijão":["feijao"],
  farofa:["farofa"],
  peixe:["peixe"],
  frango:["frango"],
  massa:["massa"],
  "molho de tomate":["molho de tomate","molho"],
  salada:["salada"],
  "pão":["pao"]
};

const VEGETABLES = new Set(["alface","tomate","cebola","salada"]);

function productAliases(product){
  const aliases = new Set([normalize(product.name)]);
  for(const a of (MANUAL_ALIASES[product.name]||[])) aliases.add(normalize(a));
  return [...aliases].filter(Boolean).sort((a,b)=>b.length-a.length);
}

function aliasRegex(alias){
  const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`,"i");
}

export function detectProductMentions(message,menu=[]){
  const text=normalize(message);
  const found=[];
  for(const product of menu){
    let best=null;
    for(const alias of productAliases(product)){
      const re=aliasRegex(alias);
      const m=re.exec(text);
      if(m){
        const raw=m[0];
        const leading=raw.length-raw.trimStart().length;
        const index=m.index+leading;
        if(!best || alias.length>best.alias.length) best={product,alias,index};
      }
    }
    if(best)found.push(best);
  }
  return found.sort((a,b)=>a.index-b.index || b.alias.length-a.alias.length);
}

function qtyBefore(text,index){
  const before=normalize(text.slice(Math.max(0,index-22),index));
  const m=before.match(/(?:^|\s)(\d{1,2}|um|uma|dois|duas|tres|quatro|cinco)\s*$/);
  if(!m)return 1;
  const raw=m[1];
  const n=/^\d+$/.test(raw)?Number(raw):NUMBER_WORDS.get(raw);
  return Math.max(1,Math.min(20,n||1));
}

function ingredientList(product){
  return String(product?.ingredients||"")
    .split(",")
    .map(x=>x.trim())
    .filter(Boolean);
}

function canonicalIngredientFromText(text,allowed){
  const q=normalize(text);
  const hits=[];
  for(const ingredient of allowed){
    const canon=normalize(ingredient);
    const aliases=new Set([canon,...(INGREDIENT_ALIASES[ingredient]||INGREDIENT_ALIASES[canon]||[]).map(normalize)]);
    if([...aliases].some(a=>a && aliasRegex(a).test(q)))hits.push(ingredient);
  }
  return [...new Set(hits)];
}

function formatList(values){
  if(values.length<=1)return values[0]||"";
  if(values.length===2)return `${values[0]} e ${values[1]}`;
  return `${values.slice(0,-1).join(", ")} e ${values.at(-1)}`;
}

function formatNote(ingredients){
  if(!ingredients.length)return "";
  const s=formatList(ingredients);
  return `Sem ${s}`;
}

function extractRemovalForMention(message,mention,nextMention){
  const start=mention.index+mention.alias.length;
  const end=nextMention?nextMention.index:normalize(message).length;
  const span=normalize(message).slice(start,end);
  const m=span.match(/\bsem\b\s+(.+)/);
  if(!m)return {note:"",generic:false,unknown:false};
  const removalText=m[1].trim();
  if(/\b(verdura|verduras|salada)\b/.test(removalText)){
    return {note:"",generic:true,unknown:false};
  }
  const allowed=ingredientList(mention.product);
  const removed=canonicalIngredientFromText(removalText,allowed);
  return {note:formatNote(removed),generic:false,unknown:removed.length===0,removed};
}

function availableVegetables(product){
  return ingredientList(product).filter(i=>VEGETABLES.has(normalize(i)));
}

function statusReply(product){
  if(product.status==="oculto")return "Esse item não está no cardápio disponível.";
  if(product.status==="esgotado")return `Hoje o ${product.name} está esgotado.`;
  return `${product.name} está disponível por ${money(product.price)}.`;
}

function money(v){
  return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function isGreeting(q){
  return /^(oi|ola|bom dia|boa tarde|boa noite|e ai|opa)( tudo bem| tudo bom| tudo certo)?$/.test(q)
}
function greetingForHour(hour){const h=Number(hour);if(Number.isFinite(h)){if(h>=5&&h<12)return "Bom dia";if(h>=12&&h<18)return "Boa tarde";return "Boa noite"}return "Olá"}
function isYes(q){return /^(sim|s|isso|isso mesmo|pode|pode sim|quero|sim quero|quero sim|ok|certo|confirmo|confirma)$/.test(q)}
function isNo(q){return /^(nao|n|nao quero|agora nao|so isso)$/.test(q)}
function wantsPhoto(q){return /\b(foto|imagem|fotografia)\b/.test(q) || /\b(cade|mostra|mostrar|ver)\b.*\b(dele|dela|produto|lanche|prato)\b/.test(q)}
function wantsPrice(q){return /\b(preco|valor|quanto custa|quanto e)\b/.test(q)}
function wantsIngredients(q){return /\b(ingrediente|ingredientes|leva|vem com|o que vem|que vem|tem no)\b/.test(q)}
function wantsAvailability(q){return /\b(disponivel|esgotado|tem hoje|tem esse|tem essa)\b/.test(q)}
function wantsFinalize(q){return /\b(finaliza|finalizar|fechar pedido|fecha pedido|feche meu pedido|confirmar pedido|confirma pedido|meu pedido)\b/.test(q)}
function wantsRecommendation(q){return /\b(me recomenda|recomenda|recomendacao|sugere|sugestao|o que voce indica|o que indica)\b/.test(q)}
function budgetFromText(q){
  const m=q.match(/(?:ate|tenho|com|por)\s*(?:r\$\s*)?(\d{1,4}(?:[.,]\d{1,2})?)/);
  if(!m)return null;
  const n=Number(m[1].replace(",","."));
  return Number.isFinite(n)&&n>0?n:null;
}
function wantsOrder(q){
  if(wantsPhoto(q)||wantsPrice(q)||wantsIngredients(q)||wantsAvailability(q))return false;
  // Também entende continuação natural de um pedido: "e um suco", "e uma coca".
  // Só vale quando há um produto oficial explicitamente detectado; portanto não transforma conversa solta em item.
  return /\b(quero|queria|vou querer|adiciona|adicionar|coloca|colocar|pede|pedir|manda|traz|inclui|incluir)\b/.test(q)
    || /^(?:e\s+)?(?:mais\s+)?(?:um|uma|1)\b/.test(q);
}

function resolveFocused(context,menu){
  const name=String(context?.focusedProduct||"");
  return menu.find(p=>normalize(p.name)===normalize(name))||null;
}

function resolvePending(context,menu){
  const name=String(context?.pendingModificationProduct||"");
  return menu.find(p=>normalize(p.name)===normalize(name))||null;
}

export function processDeterministicMessage({message,menu=[],context={}}){
  const q=normalize(message);
  const visible=menu.filter(p=>p.status!=="oculto");
  const mentions=detectProductMentions(message,menu);
  const explicitProducts=mentions.map(x=>x.product);
  const focused=explicitProducts[0]||resolveFocused(context,menu);
  const base={handled:true,reply:"",show_product:null,add_items:[],show_cart:false,context:{}};

  if(!q)return {...base,reply:"Pode escrever seu pedido."};

  if(isGreeting(q)){
    return {...base,reply:`${greetingForHour(context?.clientHour)}! Eu sou o Garçom Virtual do Sabor da Casa. Posso ajudar com seu pedido?`};
  }

  if(context?.awaitingFinalize && isYes(q)){
    return {...base,reply:"Perfeito. Confira seu pedido e confirme no botão.",show_cart:true,context:{awaitingFinalize:false}};
  }
  if(context?.awaitingFinalize && isNo(q)){
    return {...base,reply:"Tudo bem. O que mais você gostaria?",context:{awaitingFinalize:false}};
  }

  const pending=resolvePending(context,menu);
  if(pending && /\bsem\b/.test(q)){
    const allowed=ingredientList(pending);
    const removed=canonicalIngredientFromText(q,allowed);
    if(removed.length){
      if(pending.status!=="disponivel")return {...base,reply:statusReply(pending),context:{pendingModificationProduct:null}};
      const note=formatNote(removed);
      return {
        ...base,
        reply:`Ok, ${pending.name} ${note.toLowerCase()}. Deseja finalizar seu pedido?`,
        add_items:[{name:pending.name,qty:1,note}],
        context:{focusedProduct:pending.name,pendingModificationProduct:null,awaitingFinalize:true}
      };
    }
    return {...base,reply:`Não encontrei essa retirada nos ingredientes do ${pending.name}.`,context:{focusedProduct:pending.name}};
  }

  if(wantsFinalize(q)){
    return {...base,reply:"Confira seu pedido e confirme no botão.",show_cart:true,context:{awaitingFinalize:false}};
  }

  // Explicit photo requests are always resolved from the official menu, never by AI.
  if((wantsPhoto(q) || (/\b(cade|mostra|mostrar|ver)\b/.test(q) && explicitProducts.length)) && focused){
    if(focused.status==="oculto")return {...base,reply:"Esse item não está disponível no cardápio."};
    return {...base,reply:`Aqui está o ${focused.name}.`,show_product:focused.name,context:{focusedProduct:focused.name}};
  }
  if(wantsPhoto(q) && !focused){
    return {...base,reply:"Qual produto você quer ver?"};
  }

  if(explicitProducts.length && wantsPrice(q)){
    const p=explicitProducts[0];
    return {...base,reply:p.status==="oculto"?"Esse item não está disponível no cardápio.":`${p.name} custa ${money(p.price)}.`,context:{focusedProduct:p.name}};
  }
  if(explicitProducts.length && wantsIngredients(q)){
    const p=explicitProducts[0];
    const ing=ingredientList(p);
    return {...base,reply:ing.length?`${p.name}: ${formatList(ing)}.`:`O cadastro não informa ingredientes do ${p.name}.`,context:{focusedProduct:p.name}};
  }
  if(explicitProducts.length && wantsAvailability(q)){
    const p=explicitProducts[0];
    return {...base,reply:statusReply(p),context:{focusedProduct:p.name}};
  }

  if(explicitProducts.length && wantsOrder(q)){
    const unavailable=explicitProducts.find(p=>p.status!=="disponivel");
    if(unavailable)return {...base,reply:statusReply(unavailable),context:{focusedProduct:unavailable.name}};

    const items=[];
    for(let i=0;i<mentions.length;i++){
      const mention=mentions[i];
      const mod=extractRemovalForMention(message,mention,mentions[i+1]);
      if(mod.generic){
        const veg=availableVegetables(mention.product);
        const options=veg.length?formatList(veg):"os ingredientes cadastrados";
        return {
          ...base,
          reply:`No ${mention.product.name} temos ${options}. O que você quer retirar?`,
          context:{focusedProduct:mention.product.name,pendingModificationProduct:mention.product.name}
        };
      }
      if(mod.unknown){
        return {...base,reply:`Essa retirada não consta nos ingredientes cadastrados do ${mention.product.name}.`,context:{focusedProduct:mention.product.name}};
      }
      const qty=qtyBefore(normalize(message),mention.index);
      // Mixed preparation of the same product must stay as separate cart lines.
      // Example: "dois X-Salada, um normal e outro sem tomate" => 1 normal + 1 sem tomate.
      const whole=normalize(message);
      const mixedNormal=/\b(um|uma|1)\s+normal\b/.test(whole) && /\b(outro|outra)\s+sem\b/.test(whole);
      if(mentions.length===1 && qty===2 && mixedNormal && mod.note){
        items.push({name:mention.product.name,qty:1,note:""});
        items.push({name:mention.product.name,qty:1,note:mod.note});
      }else{
        items.push({name:mention.product.name,qty,note:mod.note});
      }
    }
    const summary=items.map(x=>`${x.qty>1?`${x.qty}x `:""}${x.name}${x.note?` (${x.note.toLowerCase()})`:""}`).join(" e ");
    return {
      ...base,
      reply:`Ok, ${summary}. Deseja finalizar seu pedido?`,
      add_items:items,
      context:{focusedProduct:items.at(-1)?.name||null,awaitingFinalize:true,pendingModificationProduct:null}
    };
  }

  // Continuação natural sem repetir o nome do produto.
  // Ex.: depois de perguntar/ver a foto do Frango: "vou querer", "sim quero", "coloca esse".
  if(!explicitProducts.length && focused && focused.status!=="oculto" && (
    /^(vou querer|eu quero|quero|sim quero|quero sim|pode colocar|pode adicionar|adiciona|adicione|coloca|coloque|manda|traz|esse|essa|quero esse|quero essa|vou querer esse|vou querer essa)$/.test(q)
  )){
    if(focused.status!=="disponivel")return {...base,reply:statusReply(focused),context:{focusedProduct:focused.name}};
    return {...base,reply:`Ok, ${focused.name}. Deseja finalizar seu pedido?`,add_items:[{name:focused.name,qty:1,note:""}],context:{focusedProduct:focused.name,awaitingFinalize:true}};
  }

  // A named product without an order/photo intent gets a safe factual answer.
  if(explicitProducts.length){
    const p=explicitProducts[0];
    return {...base,reply:statusReply(p),context:{focusedProduct:p.name}};
  }

  if(wantsRecommendation(q)){
    const budget=budgetFromText(q);
    const candidates=visible.filter(p=>p.status==="disponivel" && (!budget || Number(p.price)<=budget));
    if(!candidates.length)return {...base,reply:budget?`Não encontrei item disponível até ${money(budget)}.`:"Não há itens disponíveis para recomendar agora."};
    const choice=[...candidates].sort((a,b)=>Number(b.price)-Number(a.price))[0];
    return {...base,reply:`Recomendo ${choice.name} por ${money(choice.price)}. Quer adicionar ao pedido?`,show_product:choice.name,context:{focusedProduct:choice.name,pendingRecommendationProduct:choice.name}};
  }

  if(context?.pendingRecommendationProduct && isYes(q)){
    const p=menu.find(x=>normalize(x.name)===normalize(context.pendingRecommendationProduct));
    if(p&&p.status==="disponivel")return {...base,reply:`Ok, ${p.name}. Deseja finalizar seu pedido?`,add_items:[{name:p.name,qty:1,note:""}],context:{focusedProduct:p.name,pendingRecommendationProduct:null,awaitingFinalize:true}};
  }

  if(/\b(pratos|lanches|bebidas)\b/.test(q)){
    const cat=/\bpratos\b/.test(q)?"Pratos":/\blanches\b/.test(q)?"Lanches":"Bebidas";
    const list=visible.filter(p=>p.category===cat&&p.status==="disponivel");
    return {...base,reply:list.length?`${cat}: ${list.map(p=>`${p.name} (${money(p.price)})`).join(", ")}.`:`Não há ${cat.toLowerCase()} disponíveis no momento.`};
  }
  if(/\bcardapio\b/.test(q)){
    const cats=["Pratos","Lanches","Bebidas"].map(cat=>{
      const n=visible.filter(p=>p.category===cat&&p.status==="disponivel").length;
      return n?`${cat} (${n})`:null;
    }).filter(Boolean);
    return {...base,reply:cats.length?`Temos ${formatList(cats)}. Você pode escolher uma categoria ou dizer o nome do produto.`:"O cardápio está sem itens disponíveis no momento."};
  }

  if(/\b(obrigado|obrigada|valeu)\b/.test(q))return {...base,reply:"Por nada! Posso ajudar com mais alguma coisa do seu pedido?"};
  if(/\b(ajuda|como funciona|o que posso pedir)\b/.test(q))return {...base,reply:"Posso mostrar o cardápio, preços, fotos, ingredientes e montar seu pedido."};
  if(/\b(cancelar|limpar|apagar)\b.*\b(pedido|carrinho)\b/.test(q))return {...base,reply:"Você pode abrir Meu pedido e usar a opção de limpar o pedido.",show_cart:true};

  // V27 sem IA: nenhuma mensagem é enviada a serviço externo.
  return {...base,reply:"Posso ajudar com o cardápio, preços, fotos e seu pedido. Diga o produto ou escolha Pratos, Lanches ou Bebidas."};
}

export function safeAiReply(raw){
  const text=String(raw||"").trim();
  try{
    const clean=text.replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
    const obj=JSON.parse(clean);
    return String(obj.reply||"").trim().slice(0,280)||"Como posso ajudar com o cardápio?";
  }catch{
    return text.slice(0,280)||"Como posso ajudar com o cardápio?";
  }
}

export function validateOrderNote(product,note){
  const raw=String(note||"").trim();
  if(!raw)return "";
  if(!/^sem\b/i.test(normalize(raw)))return "";
  const allowed=ingredientList(product);
  const removed=canonicalIngredientFromText(raw,allowed);
  return formatNote(removed);
}
