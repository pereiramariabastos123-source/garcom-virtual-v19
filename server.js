import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {processDeterministicMessage,safeAiReply,validateOrderNote} from "./chat-engine.js";

dotenv.config();

const app=express();
const PORT=Number(process.env.PORT||3000);
const MODEL=process.env.OPENAI_MODEL||"gpt-5.6-luna";
const HOST=process.env.HOST||"0.0.0.0";
const VERSION="V24";

const DATA_DIR=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(process.cwd(),"data");
const ORDERS_FILE=path.join(DATA_DIR,"orders.json");
const MENU_FILE=path.join(DATA_DIR,"menu.json");
const MENU_SEED_FILE=path.join(process.cwd(),"data","menu.seed.json");

function ensureDataDir(){fs.mkdirSync(DATA_DIR,{recursive:true})}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8")||JSON.stringify(fallback))}catch{return fallback}}
function writeJson(file,value){ensureDataDir();fs.writeFileSync(file,JSON.stringify(value,null,2),"utf8")}
function ensureOrderStore(){ensureDataDir();if(!fs.existsSync(ORDERS_FILE))writeJson(ORDERS_FILE,[])}
function readOrders(){ensureOrderStore();return readJson(ORDERS_FILE,[])}
function writeOrders(orders){writeJson(ORDERS_FILE,orders)}
function seedMenu(){ensureDataDir();if(fs.existsSync(MENU_FILE))return;const seed=readJson(MENU_SEED_FILE,[]);writeJson(MENU_FILE,Array.isArray(seed)?seed:[])}
function readMenu(){seedMenu();return readJson(MENU_FILE,[])}
function writeMenu(products){writeJson(MENU_FILE,products)}

function requireAdmin(req,res,next){
  const expected=String(process.env.ADMIN_PASSWORD||"");
  if(!expected)return next();
  if(String(req.get("x-admin-password")||"")!==expected)return res.status(401).json({error:"Senha administrativa inválida."});
  next();
}

app.disable("x-powered-by");
app.use(express.json({limit:"8mb"}));
app.use(express.static("."));

app.get("/api/config",(req,res)=>{res.set("Cache-Control","no-store");res.json({publicBaseUrl:String(process.env.PUBLIC_BASE_URL||"").trim(),onlineReady:true,version:VERSION})});
app.get("/api/admin/check",requireAdmin,(req,res)=>res.json({ok:true}));
app.get("/api/menu",(req,res)=>{res.set("Cache-Control","no-store");res.json({products:readMenu()})});
app.put("/api/menu",requireAdmin,(req,res)=>{
  const products=Array.isArray(req.body?.products)?req.body.products.slice(0,200):null;
  if(!products)return res.status(400).json({error:"Cardápio inválido."});
  const clean=products.map((p,i)=>({
    id:Number(p.id)||i+1,name:String(p.name||"").slice(0,100),category:String(p.category||"").slice(0,50),
    price:Math.max(0,Number(p.price)||0),image:String(p.image||"").slice(0,7000000),
    status:["disponivel","esgotado","oculto"].includes(p.status)?p.status:"disponivel",
    description:String(p.description||"").slice(0,500),ingredients:String(p.ingredients||"").slice(0,500)
  })).filter(p=>p.name);
  writeMenu(clean);res.json({products:clean});
});

function safeHistory(history=[]){return history.filter(x=>x&&(x.role==="user"||x.role==="assistant")&&typeof x.content==="string").slice(-12).map(x=>({role:x.role,content:x.content.slice(0,500)}))}
function compactMenu(menu=[]){return menu.filter(p=>p&&p.name&&p.status!=="oculto").slice(0,120).map(p=>({name:p.name,category:p.category,price:Number(p.price)||0,description:p.description||"",ingredients:p.ingredients||"",status:p.status}))}

app.post("/api/chat",async(req,res)=>{
  const message=String(req.body?.message||"").trim().slice(0,500);
  if(!message)return res.status(400).json({error:"Mensagem vazia."});
  const menu=readMenu();
  const context=(req.body?.context&&typeof req.body.context==="object")?req.body.context:{};
  const deterministic=processDeterministicMessage({message,menu,context});
  if(deterministic.handled)return res.json(deterministic);

  if(!process.env.OPENAI_API_KEY){
    return res.json({reply:"Posso ajudar com o cardápio, preços, fotos e pedidos do Sabor da Casa.",show_product:null,add_items:[],show_cart:false,context:{}});
  }

  const official=compactMenu(menu);
  const cart=Array.isArray(req.body?.cart)?req.body.cart.slice(0,30).map(x=>({name:String(x.name||""),qty:Number(x.qty)||1,note:String(x.note||"")})):[];
  const history=safeHistory(req.body?.history);
  const instructions=`Você é o Garçom Virtual do restaurante Sabor da Casa.
Atenda de forma natural, educada e curta, como um garçom humano.
Você só pode falar sobre o restaurante, o cardápio, produtos, preços, ingredientes cadastrados, disponibilidade, recomendações e o pedido do cliente.
Se perguntarem qualquer assunto fora do restaurante, responda somente: "Só posso ajudar com o restaurante e o seu pedido."
Use SOMENTE o CARDÁPIO OFICIAL abaixo. Nunca invente produto, preço, ingrediente, promoção, foto, disponibilidade ou possibilidade de alteração.
Produtos ocultos não existem para o cliente. Produtos esgotados não podem ser recomendados como disponíveis.
IMPORTANTE: você NÃO controla carrinho, foto, produto ou observação. Essas ações são tratadas pelo sistema. Sua saída contém APENAS texto de conversa.
Responda normalmente em 1 ou 2 frases curtas. Sem markdown.
Responda SEMPRE JSON válido exatamente no formato: {"reply":"texto"}
PRODUTO EM FOCO: ${String(context.focusedProduct||"nenhum")}
CARDÁPIO OFICIAL: ${JSON.stringify(official)}
CARRINHO ATUAL: ${JSON.stringify(cart)}`;
  try{
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const response=await client.responses.create({model:MODEL,reasoning:{effort:"none"},instructions,input:[...history,{role:"user",content:message}],max_output_tokens:120});
    return res.json({reply:safeAiReply(response.output_text),show_product:null,add_items:[],show_cart:false,context:{}});
  }catch(err){
    console.error(err);
    return res.status(500).json({error:err?.status===401?"A chave da API não foi aceita.":err?.status===429?"A API atingiu limite/créditos.":"Não consegui acessar a IA agora."});
  }
});

app.get("/api/orders/:id",(req,res)=>{const order=readOrders().find(o=>String(o.id)===String(req.params.id));if(!order)return res.status(404).json({error:"Pedido não encontrado."});res.set("Cache-Control","no-store");res.json({order})});
app.get("/api/orders",requireAdmin,(req,res)=>{res.set("Cache-Control","no-store");res.json({orders:readOrders()})});
app.post("/api/orders",(req,res)=>{
  const mesa=String(req.body?.mesa||"").replace(/\D/g,"").padStart(2,"0").slice(-2);
  const items=Array.isArray(req.body?.items)?req.body.items:[];
  if(!mesa||!items.length)return res.status(400).json({error:"Pedido inválido."});
  const menu=readMenu();const cleanItems=[];
  for(const x of items.slice(0,50)){
    const official=menu.find(p=>Number(p.id)===Number(x.id)&&p.status==="disponivel");
    if(!official)continue;
    cleanItems.push({id:Number(official.id),name:String(official.name),price:Number(official.price)||0,qty:Math.max(1,Math.min(20,Number(x.qty)||1)),note:validateOrderNote(official,x.note)});
  }
  if(!cleanItems.length)return res.status(400).json({error:"Nenhum item disponível no pedido."});
  const total=cleanItems.reduce((sum,x)=>sum+x.price*x.qty,0);const orders=readOrders();
  const order={id:String(Date.now())+String(Math.floor(Math.random()*900)+100),mesa,items:cleanItems,total,status:"novo",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  orders.unshift(order);writeOrders(orders);res.json({order});
});
app.patch("/api/orders/:id/status",requireAdmin,(req,res)=>{const allowed=["novo","preparo","pronto","finalizado"];const status=String(req.body?.status||"");if(!allowed.includes(status))return res.status(400).json({error:"Status inválido."});const orders=readOrders();const order=orders.find(o=>String(o.id)===String(req.params.id));if(!order)return res.status(404).json({error:"Pedido não encontrado."});order.status=status;order.updatedAt=new Date().toISOString();writeOrders(orders);res.json({order})});
app.get("/api/status",(req,res)=>res.json({ok:true,version:VERSION,configured:Boolean(process.env.OPENAI_API_KEY),model:MODEL,adminProtected:Boolean(process.env.ADMIN_PASSWORD),publicBaseUrl:String(process.env.PUBLIC_BASE_URL||"").trim()}));

app.listen(PORT,HOST,()=>{
  console.log(`Garcom Virtual ${VERSION}`);
  console.log(`Endereco: http://${HOST}:${PORT}`);
  console.log(`IA: ${process.env.OPENAI_API_KEY?"configurada":"nao configurada (acoes deterministicas continuam funcionando)"}`);
  console.log(`Painel: ${process.env.ADMIN_PASSWORD?"protegido por senha":"sem senha"}`);
});
