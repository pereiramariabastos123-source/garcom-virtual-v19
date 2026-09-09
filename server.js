import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {validateOrderNote} from "./chat-engine.js";

dotenv.config();

const app=express();
const PORT=Number(process.env.PORT||3000);
const HOST=process.env.HOST||"0.0.0.0";
const VERSION="V29 DEMONSTRACAO";

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
app.get("/api/status",(req,res)=>res.json({ok:true,version:VERSION,ai:false,adminProtected:Boolean(process.env.ADMIN_PASSWORD),publicBaseUrl:String(process.env.PUBLIC_BASE_URL||"").trim()}));

app.listen(PORT,HOST,()=>{
  console.log(`Garcom Virtual ${VERSION}`);
  console.log(`Endereco: http://${HOST}:${PORT}`);
  console.log("Atendimento do cliente: cardápio visual sem chat e sem custo de API");
  console.log(`Painel: ${process.env.ADMIN_PASSWORD?"protegido por senha":"sem senha"}`);
});
