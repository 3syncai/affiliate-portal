/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real PostgreSQL webhook regression checks. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const portal=path.resolve(__dirname,'..');
const testUrl=process.env.SETTLEMENT_TEST_DATABASE_URL;
if(!testUrl)throw Error('SETTLEMENT_TEST_DATABASE_URL is required');
const parsed=new URL(testUrl);
if(parsed.hostname!=='127.0.0.1'||parsed.port!=='55439'||parsed.pathname!=='/postgres')throw Error('Only disposable localhost:55439/postgres is permitted');
const {Pool}=require(portal+'/node_modules/pg');
const ts=require(portal+'/node_modules/typescript');
require(portal+'/scripts/register-portal-ts');
const {receiveCommissionEvent,CommissionEventConflict}=require(portal+'/lib/commission-webhook-transaction.ts');
const catalog=require(portal+'/lib/catalog-commission.ts');
const repair=require(portal+'/lib/repair-branch-admin-commissions.ts');
const {syncAffiliateCommissionStatuses:settle}=require(portal+'/lib/affiliate-commission-sync.ts');
const {commissionRecipientLabel:label}=require(portal+'/lib/commission-recipient-label.ts');
const dbName='qa_partner_hierarchy_'+crypto.randomBytes(6).toString('hex');
const admin=new Pool({connectionString:testUrl});
let pool;const findings=[];const checks=[];
function load(file,modules){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(portal,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:k=>{if(!(k in modules))throw Error('Unstubbed dependency '+k);return modules[k]},console:{log(){},error(...a){console.error(...a)}},process,Buffer,URL,setTimeout});return exports;}
(async()=>{
 await admin.query('CREATE DATABASE '+dbName);
 pool=new Pool({connectionString:'postgres://postgres@127.0.0.1:55439/'+dbName,max:8});
 await pool.query(`
 CREATE TABLE product(id text PRIMARY KEY,metadata jsonb DEFAULT '{}',deleted_at timestamptz,collection_id text,type_id text);
 CREATE TABLE product_category(id text PRIMARY KEY,parent_category_id text,deleted_at timestamptz);
 CREATE TABLE product_category_product(product_id text,product_category_id text);
 CREATE TABLE product_variant(id text,product_id text);
 CREATE TABLE category_return_policy(category_id text,return_window_days int,replacement_window_days int);
 CREATE TABLE affiliate_commission(id text PRIMARY KEY,product_id text,category_id text,collection_id text,type_id text,commission_rate numeric,deleted_at timestamptz);
 CREATE TABLE affiliate_user(id text PRIMARY KEY,refer_code text UNIQUE,branch text,city text,state text,area text,approved_by text,entry_sponsor text);
 CREATE TABLE branch_admin(id text PRIMARY KEY,refer_code text,first_name text,last_name text,email text,branch text,city text,state text,is_active bool DEFAULT true,created_at timestamptz DEFAULT NOW());
 CREATE TABLE area_sales_manager(id text PRIMARY KEY,refer_code text,first_name text,last_name text,email text,city text,state text);
 CREATE TABLE state_admin(id text PRIMARY KEY,refer_code text,first_name text,last_name text,email text,state text);
 CREATE TABLE commission_rates(id text,role_type text UNIQUE,commission_percentage numeric,description text,updated_at timestamptz);
 CREATE TABLE customer_wallet(customer_id text PRIMARY KEY,coins_balance numeric DEFAULT 0);
 CREATE TABLE "order"(id text PRIMARY KEY,status text,metadata jsonb DEFAULT '{}',canceled_at timestamptz,deleted_at timestamptz);
 CREATE TABLE order_item(order_id text,item_id text);
 CREATE TABLE order_line_item(id text,product_id text,variant_id text);
 CREATE TABLE fulfillment(id text,delivered_at timestamptz,canceled_at timestamptz);
 CREATE TABLE order_fulfillment(order_id text,fulfillment_id text);
 CREATE TABLE return_request(id text PRIMARY KEY,order_id text,status text,deleted_at timestamptz);
 CREATE TABLE affiliate_commission_log(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,order_id text,affiliate_code text,affiliate_user_id text,commission_source text,status text,unlock_at timestamptz,credited_at timestamptz,created_at timestamptz DEFAULT NOW(),product_name text,quantity int,item_price numeric,order_amount numeric,commission_rate numeric,commission_amount numeric,affiliate_rate numeric,affiliate_commission numeric,customer_id text,customer_name text,customer_email text,product_id text,category_id text,collection_id text);
 INSERT INTO commission_rates(id,role_type,commission_percentage) VALUES('r1','affiliate',50),('r2','branch',25),('r3','area',15),('r4','state',10),('r5','branch_direct',15);
 INSERT INTO affiliate_user VALUES('qa_se','QA_SE','QA_BRANCH','QA_CITY','QA_STATE',NULL,'qa_bm','QA_BM');
 INSERT INTO branch_admin(id,refer_code,first_name,last_name,email,branch,city,state) VALUES('qa_bm','QA_BM','QA','BM','bm@example.invalid','QA_BRANCH','QA_CITY','QA_STATE');
 INSERT INTO area_sales_manager VALUES('qa_asm','QA_ASM','QA','ASM','asm@example.invalid','QA_CITY','QA_STATE');
 INSERT INTO state_admin VALUES('qa_state','QA_STATE','QA','State','state@example.invalid','QA_STATE');
 INSERT INTO product(id) VALUES('p1'),('p2');
 INSERT INTO product_category VALUES('cat',NULL,NULL);
 INSERT INTO product_category_product VALUES('p1','cat'),('p2','cat');
 INSERT INTO category_return_policy VALUES('cat',0,0);
 INSERT INTO affiliate_commission(id,product_id,commission_rate) VALUES('ac1','p1',5),('ac2','p2',5);
 `);
 for(const file of ['update_commission_unlock_policy.sql','add_commission_wallet_ledger.sql','add_commission_webhook_events.sql'])await pool.query(fs.readFileSync(path.join(portal,'migrations',file),'utf8'));
 const additional=load('lib/additional-commission.ts',{'@/lib/db':{__esModule:true,default:pool}});
 const route=load('app/api/webhook/commission/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '@/lib/db':{__esModule:true,default:pool},'@/lib/catalog-commission':catalog,
  '@/lib/commission-webhook-transaction':{receiveCommissionEvent,CommissionEventConflict},
  '@/lib/sse':{sendNotification(){}},'@/lib/additional-commission':additional,'@/lib/repair-branch-admin-commissions':repair
 });
 async function reset(order){await pool.query('TRUNCATE affiliate_commission_log,affiliate_commission_webhook_event,partner_commission_wallet_ledger,customer_wallet,return_request,"order",order_item,order_line_item');await pool.query(`INSERT INTO "order"(id,status,metadata) VALUES($1,'completed','{"shiprocket_delivered_at":"2026-01-01T00:00:00Z"}')`,[order]);await pool.query('INSERT INTO order_item VALUES($1,$2);',[order,'item_'+order]);await pool.query('INSERT INTO order_line_item VALUES($1,$2,NULL)',['item_'+order,'p1']);}
 async function send(order,code,product='p1',event='event_'+order,title=product){const payload={event_id:event,order_id:order,affiliate_code:code,product_id:product,product_name:title,quantity:1,item_price:1000,order_amount:1000,customer_id:'qa_customer',customer_email:'customer@example.invalid'};const r=await route.POST({json:async()=>({...payload}),headers:{get:()=>event}});assert.equal(r.status,200,JSON.stringify(r.body));return r;}
 async function snapshot(){return (await pool.query('SELECT commission_source,affiliate_user_id,affiliate_rate::text,affiliate_commission::text,status FROM affiliate_commission_log ORDER BY commission_source,product_id')).rows.map(r=>({...r,label:label(r.commission_source)}));}
 async function wallets(){return (await pool.query('SELECT customer_id,coins_balance::text FROM customer_wallet ORDER BY customer_id')).rows;}
 const options={logPrefix:'[Hierarchy QA]',throwOnError:true};
 assert.equal(label('branch_admin'),'Area Sales Manager (/bm)');assert.equal(label('area_manager'),'Branch Admin (/asm)');checks.push('Business mapping preserved despite opposite legacy DB names');
 await reset('se_order');await send('se_order','QA_SE');const initial=await snapshot();assert.equal(initial.length,4);
 const expected={affiliate:['50','25'],branch_admin:['25','12.5'],area_manager:['15','7.5'],state_admin:['10','5']};
 for(const r of initial){assert.equal(Number(r.affiliate_rate),Number(expected[r.commission_source][0]));assert.equal(Number(r.affiliate_commission),Number(expected[r.commission_source][1]));}
 await settle(pool,options);await send('se_order','QA_SE');await settle(pool,options);
 let ws=await wallets();assert.equal(ws.length,4);assert.equal(ws.reduce((a,r)=>a+Number(r.coins_balance),0),50);
 findings.push({case:'SE referral with valid 50/25/15/10 test configuration',commissionPool:50,totalPayout:50,configurationExceedsPool:false,entries:await snapshot(),wallets:ws});checks.push('Actual webhook -> four-role wallet credits -> duplicate webhook/worker do not double credit');
 await reset('bm_direct');await send('bm_direct','QA_BM');await settle(pool,options);const bm=await wallets();assert.equal(Number(bm.find(r=>r.customer_id==='qa_bm').coins_balance),37.5);assert.equal(Number(bm.find(r=>r.customer_id==='qa_asm').coins_balance),7.5);assert.equal(Number(bm.find(r=>r.customer_id==='qa_state').coins_balance),5);checks.push('Area Sales Manager (/bm) direct sale combines affiliate+branch shares into correct recipient');findings.push({case:'Area Sales Manager (/bm) direct sale',entries:await snapshot(),wallets:bm});
 await reset('asm_direct');await send('asm_direct','QA_ASM');await settle(pool,options);const asm=await snapshot();findings.push({case:'Branch Admin (/asm) direct sale',entries:asm,wallets:await wallets(),missingRecipient:asm.filter(r=>!r.affiliate_user_id).map(r=>r.commission_source)});
 await reset('state_direct');await send('state_direct','QA_STATE');await settle(pool,options);const state=await snapshot();findings.push({case:'State Head direct sale',entries:state,wallets:await wallets(),missingRecipient:state.filter(r=>!r.affiliate_user_id).map(r=>r.commission_source)});
 await reset('multi');await send('multi','QA_SE','p1','multi_1');await send('multi','QA_SE','p2','multi_2');const before=(await snapshot()).length;await settle(pool,options);const after=(await snapshot()).length;findings.push({case:'Two distinct products in one SE order',entriesBeforeWorker:before,entriesAfterWorker:after,wallets:await wallets()});
 await reset('same_title');await send('same_title','QA_SE','p1','same_1','Shared product title');await send('same_title','QA_SE','p2','same_2','Shared product title');await settle(pool,options);findings.push({case:'Two different product IDs with same display title in one order',expectedCommissionRows:8,actualCommissionRows:(await snapshot()).length,entries:await snapshot(),wallets:await wallets()});

 // Verify every earlier reproduction, including the exact wallet recipients/amounts.
 function expectWallet(actual,expected){assert.deepEqual(Object.fromEntries(actual.map(r=>[r.customer_id,Number(r.coins_balance)])),expected);}
 for(const finding of findings){
  if(finding.missingRecipient)assert.deepEqual(finding.missingRecipient,[],finding.case);
  if(finding.expectedCommissionRows)assert.equal(finding.actualCommissionRows,finding.expectedCommissionRows,finding.case);
 }
 expectWallet(findings[2].wallets,{qa_asm:45,qa_state:5});
 expectWallet(findings[3].wallets,{qa_state:50});
 assert.equal(findings[4].entriesBeforeWorker,8);
 expectWallet(findings[5].wallets,{qa_se:50,qa_bm:25,qa_asm:15,qa_state:10});
 checks.push('Direct /asm and State Head sales attach explicit recipients and credit the correct wallets');
 checks.push('Two different same-title products create eight entries and pay the full two-product pool');
 // All referral levels: new event IDs, renamed titles, and concurrent duplicate delivery.
 for(const [code,count,expected] of [
  ['QA_SE',8,{qa_se:50,qa_bm:25,qa_asm:15,qa_state:10}],
  ['QA_BM',6,{qa_bm:75,qa_asm:15,qa_state:10}],
  ['QA_ASM',4,{qa_asm:90,qa_state:10}],
  ['QA_STATE',2,{qa_state:100}]
 ]){
  const order='repeat_'+code;await reset(order);
  await send(order,code,'p1',order+'_1','Same title');
  await send(order,code,'p2',order+'_2','Same title');
  assert.equal((await snapshot()).length,count);
  await settle(pool,options);expectWallet(await wallets(),expected);
  await Promise.all([send(order,code,'p1',order+'_retry1','Renamed title'),send(order,code,'p1',order+'_retry2','Renamed title')]);
  await settle(pool,options);assert.equal((await snapshot()).length,count);expectWallet(await wallets(),expected);
 }
 checks.push('All four referral levels: same-title products and concurrent fresh-event retries never duplicate payouts');
 await reset('without_title');await send('without_title','QA_SE','p1','no_title_1','');await send('without_title','QA_SE','p1','no_title_2','');
 assert.equal((await snapshot()).length,4);await settle(pool,options);expectWallet(await wallets(),{qa_se:25,qa_bm:12.5,qa_asm:7.5,qa_state:5});
 checks.push('Missing display title still deduplicates by product ID');
 await reset('repair_same_title');await send('repair_same_title','QA_SE','p1','repair_1','Same');await send('repair_same_title','QA_SE','p2','repair_2','Same');
 await pool.query("DELETE FROM affiliate_commission_log WHERE commission_source='branch_admin' AND product_id='p2'");
 await settle(pool,options);assert.equal((await snapshot()).length,8);expectWallet(await wallets(),{qa_se:50,qa_bm:25,qa_asm:15,qa_state:10});
 checks.push('Worker repairs a missing second-product /bm row even when both product titles match');
 await reset('legacy_row');await send('legacy_row','QA_SE','p1','legacy_1','Legacy');
 await pool.query('UPDATE affiliate_commission_log SET product_id=NULL');
 await send('legacy_row','QA_SE','p1','legacy_2','Legacy');assert.equal((await snapshot()).length,4);
 checks.push('Legacy rows without product ID retain conservative name fallback and do not duplicate');

 // Vendor listings share only a verified catalog link, while order entries retain listing IDs.
 await pool.query("INSERT INTO product(id,metadata) VALUES ('vendor_b', '{\"catalog_product_id\":\"p1\"}')");
 await pool.query("INSERT INTO product_category_product VALUES ('vendor_b','cat')");
 await pool.query("DELETE FROM affiliate_commission WHERE product_id='p2'");
 await reset('cross_vendor');await send('cross_vendor','QA_SE','vendor_b','vendor_b_1','Same kettle');
 let cross=await snapshot();assert.equal(cross.length,4);assert(cross.every(r=>Number(r.affiliate_commission)>0));
 await settle(pool,options);expectWallet(await wallets(),{qa_se:25,qa_bm:12.5,qa_asm:7.5,qa_state:5});
 // Root and another vendor's listing can both occur in one order without collapsing.
 await send('cross_vendor','QA_SE','p1','vendor_a_1','Same kettle');await settle(pool,options);
 assert.equal((await snapshot()).length,8);expectWallet(await wallets(),{qa_se:50,qa_bm:25,qa_asm:15,qa_state:10});
 await send('cross_vendor','QA_SE','vendor_b','vendor_b_retry','Same kettle');await settle(pool,options);
 assert.equal((await snapshot()).length,8);expectWallet(await wallets(),{qa_se:50,qa_bm:25,qa_asm:15,qa_state:10});
 // A matching title without a verified catalog link must not borrow that rate.
 await reset('unlinked_vendor');await send('unlinked_vendor','QA_SE','p2','unlinked_1','Same kettle');
 assert((await snapshot()).every(r=>r.status==='RATE_MISSING'));await settle(pool,options);assert.equal((await wallets()).length,0);
 checks.push('Cross-vendor purchase inherits canonical rate; distinct listings remain separate and retries stay idempotent');
 checks.push('Unlinked same-title products cannot silently inherit a different product commission');
 console.log(checks.map(check=>'PASS: '+check).join('\n'));

})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(pool)await pool.end();await admin.query('DROP DATABASE IF EXISTS '+dbName);await admin.end()});

