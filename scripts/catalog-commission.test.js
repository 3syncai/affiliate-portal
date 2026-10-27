const test = require("node:test");
const assert = require("node:assert/strict");
require("./register-portal-ts");
const { catalogCommissionFamily, lookupCatalogCommission, saveCatalogCommission, commissionAmounts, validCommissionRate } = require("../lib/catalog-commission");
const { previewCatalogRepair, applyCatalogRepair } = require("../lib/catalog-commission-repair");

function fixture() {
  const products = new Map([["root",{id:"root",metadata:{}}],["offer",{id:"offer",metadata:{catalog_product_id:"root"}}],["other",{id:"other",metadata:{}}]]);
  let rules = [{id:"rule",product_id:"offer",commission_rate:5}];
  let logs = [{id:"log",order_id:"order",product_id:"root",commission_source:"affiliate",affiliate_code:"agent",commission_rate:0,commission_amount:0,affiliate_commission:0,affiliate_rate:50,order_amount:1290,status:"CREDITED"}];
  const audit = [], queries = [];
  const db = { query: async (sql, params=[]) => {
    queries.push(sql);
    if (sql.includes("SELECT id, metadata FROM product")) return {rows:products.has(params[0])?[products.get(params[0])]:[]};
    if (sql.includes("WITH RECURSIVE family")) {
      const ids = new Set([params[0]]);
      for (let i=0;i<products.size;i++) for (const p of products.values()) if(ids.has(p.metadata.catalog_product_id)) ids.add(p.id);
      return {rows:[...ids].map(id=>({id}))};
    }
    if (sql.includes("SELECT id, commission_rate FROM affiliate_commission")) return {rows:rules.filter(r=>params[0].includes(r.product_id))};
    if (sql.includes("WITH RECURSIVE categories")) return {rows:[]};
    if (sql.includes("DELETE FROM affiliate_commission")) {rules=rules.filter(r=>!params[0].includes(r.product_id));return {rows:[]};}
    if (sql.includes("INSERT INTO affiliate_commission(")) { const row={id:params[0],product_id:params[1],commission_rate:params[2]}; rules.push(row);return {rows:[row]}; }
    if (sql.includes("SELECT acl.*")) return {rows:logs.filter(r=>params[0].includes(r.product_id)&&r.commission_rate===0&&r.affiliate_commission===0)};
    if (sql.includes("INSERT INTO affiliate_commission_correction")) {assert.ok(!audit.includes(params[1]));audit.push(params[1]);}
    if (sql.includes("UPDATE affiliate_commission_log")) { const row=logs.find(r=>r.id===params[0]&&r.commission_rate===0); if(!row)return {rowCount:0,rows:[]};Object.assign(row,{commission_rate:params[1],commission_amount:params[2],affiliate_commission:params[3],status:"PENDING",credited_at:null,unlock_at:null});return {rowCount:1,rows:[{id:row.id}]}; }
    return {rows:[]};
  }};
  return {db,products,queries,audit,get rules(){return rules},set rules(value){rules=value},get logs(){return logs},set logs(value){logs=value}};
}
test("root and all verified vendor copies inherit the existing sibling rule",async()=>{const f=fixture();for(const id of ["root","offer"]){assert.equal((await lookupCatalogCommission(f.db,id)).rate,5)}});
test("same name or SKU does not merge unrelated products",async()=>{const f=fixture();f.products.get("other").title=f.products.get("root").title="same kettle";assert.equal(await lookupCatalogCommission(f.db,"other"),null)});
test("catalog chains resolve and cycles fail closed",async()=>{const f=fixture();f.products.set("child",{id:"child",metadata:{catalog_product_id:"offer"}});assert.equal((await catalogCommissionFamily(f.db,"child"))[0],"root");f.products.get("root").metadata.catalog_product_id="child";await assert.rejects(catalogCommissionFamily(f.db,"offer"),/Invalid catalog/)});
test("missing/deleted canonical product cannot use a sibling rate",async()=>{const f=fixture();f.products.delete("root");await assert.rejects(lookupCatalogCommission(f.db,"offer"),/missing or deleted/)});
test("conflicting legacy sibling rates require admin resolution, not highest-rate selection",async()=>{const f=fixture();f.rules.push({id:"second",product_id:"root",commission_rate:8});await assert.rejects(lookupCatalogCommission(f.db,"root"),/conflicting/)});
test("an explicitly configured zero rate is distinct from no configuration",async()=>{const f=fixture();f.rules[0].commission_rate=0;assert.equal((await lookupCatalogCommission(f.db,"root")).rate,0);f.rules=[];assert.equal(await lookupCatalogCommission(f.db,"root"),null)});
test("saving from any vendor listing consolidates into a single canonical rule",async()=>{const f=fixture();f.rules.push({id:"second",product_id:"root",commission_rate:8});await saveCatalogCommission(f.db,"offer",6,"saved");assert.deepEqual(f.rules,[{id:"saved",product_id:"root",commission_rate:6}]);assert.ok(f.queries.some(q=>q.includes("pg_advisory_xact_lock")))});
test("rates reject invalid inputs and calculate the executive share of the base pool",()=>{for(const rate of [null,"5",NaN,Infinity,-1,101])assert.equal(validCommissionRate(rate),false);assert.deepEqual(commissionAmounts(1290,5,50),{base:64.5,earned:32.25})});
test("repair preview is read-only, preserves historical shares, and detects stale rates",async()=>{const f=fixture();const preview=await previewCatalogRepair(f.db,"root");assert.equal(preview.items[0].earned,32.25);assert.equal(f.audit.length,0);f.rules[0].commission_rate=6;await assert.rejects(applyCatalogRepair(f.db,"root",preview.fingerprint,"admin"),/Preview changed/)});
test("correction is audited, returns to delivery hold, and never credits wallets or repeats",async()=>{const f=fixture();const preview=await previewCatalogRepair(f.db,"root");assert.equal(await applyCatalogRepair(f.db,"root",preview.fingerprint,"admin"),1);assert.equal(f.logs[0].status,"PENDING");assert.equal(f.logs[0].unlock_at,null);assert.equal(f.audit.length,1);await assert.rejects(applyCatalogRepair(f.db,"root",preview.fingerprint,"admin"),/Preview changed/);assert.equal((await previewCatalogRepair(f.db,"root")).items.length,0);assert.ok(!f.queries.some(sql=>sql.includes("customer_wallet")))});

test("repair preserves recipient identity and each recorded hierarchy share without reinterpreting route names",async()=>{
  const f=fixture();
  f.logs=[
    {...f.logs[0],id:"branch-log",commission_source:"branch_admin",affiliate_code:"BRANCH",affiliate_user_id:"existing-branch-id",affiliate_rate:30},
    {...f.logs[0],id:"asm-log",commission_source:"area_manager",affiliate_code:"AREA",affiliate_user_id:"existing-asm-id",affiliate_rate:20}
  ];
  const preview=await previewCatalogRepair(f.db,"root");
  assert.deepEqual(preview.items.map(i=>i.earned),[19.35,12.9]);
  await applyCatalogRepair(f.db,"root",preview.fingerprint,"admin");
  assert.equal(f.logs[0].affiliate_user_id,"existing-branch-id");
  assert.equal(f.logs[0].commission_source,"branch_admin");
  assert.equal(f.logs[0].affiliate_rate,30);
  assert.equal(f.logs[1].affiliate_user_id,"existing-asm-id");
  assert.equal(f.logs[1].commission_source,"area_manager");
  assert.equal(f.logs[1].affiliate_rate,20);
});

test("business labels match /bm ASM 30% and /asm Branch Admin 20% without swapping ledger roles",()=>{
  const { commissionRecipientLabel } = require("../lib/commission-recipient-label");
  assert.equal(commissionRecipientLabel("branch_admin"),"Area Sales Manager (/bm)");
  assert.equal(commissionRecipientLabel("area_manager"),"Branch Admin (/asm)");
  assert.equal(commissionRecipientLabel("affiliate"),"Sales Executive");
  assert.equal(commissionRecipientLabel("state_admin"),"State Head");
  assert.equal(commissionAmounts(1290,5,30).earned,19.35);
  assert.equal(commissionAmounts(1290,5,20).earned,12.9);
});
