/* eslint-disable @typescript-eslint/no-require-imports -- Isolated PostgreSQL/API regression runner. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
require('./register-portal-ts');
const {Pool}=require('pg');
const {normalCommissionPool,parseCommissionRateUpdates,CommissionPoolValidationError,COMMISSION_POOL_LABELS}=require('../lib/commission-pool.ts');
const {updateCommissionRates}=require('../lib/commission-rate-update.ts');
const valid={affiliate:50,branch:25,area:15,state:10};
const input=values=>Object.entries(values).map(([role_type,commission_percentage])=>({role_type,commission_percentage}));

test('exact normal pool accepts decimals/zero shares and excludes legacy/bonus fields',()=>{
 assert.equal(normalCommissionPool({...valid,branch_direct:99,additional_commission:50}).valid,true);
 assert.equal(normalCommissionPool({affiliate:'33.33',branch:'33.33',area:'33.34',state:'0'}).valid,true);
 assert.equal(normalCommissionPool({affiliate:0,branch:0,area:0,state:100}).valid,true);
 for(const state of ['9.99','10.01',0,20])assert.equal(normalCommissionPool({...valid,state}).valid,false);
 assert.equal(COMMISSION_POOL_LABELS.branch,'Area Sales Manager (/bm)');
 assert.equal(COMMISSION_POOL_LABELS.area,'Branch Admin (/asm)');
});
test('malformed values, precision, duplicates, unknown roles and missing normal shares fail closed',()=>{
 for(const value of ['',null,true,'50abc','1e2',Infinity,-1,'50.001',101])assert.throws(()=>parseCommissionRateUpdates([{role_type:'affiliate',commission_percentage:value}]),CommissionPoolValidationError);
 for(const value of [null,[],{},[{role_type:'bonus',commission_percentage:20}],[...input(valid),{role_type:'affiliate',commission_percentage:50}]])assert.throws(()=>parseCommissionRateUpdates(value),CommissionPoolValidationError);
 assert.equal(normalCommissionPool({affiliate:50,branch:50}).valid,false);
});

const url=process.env.COMMISSION_POOL_TEST_DATABASE_URL;
if(url){const parsed=new URL(url);if(parsed.hostname!=='127.0.0.1'||parsed.port!=='55439'||parsed.pathname!=='/postgres')throw Error('Only disposable localhost:55439/postgres is permitted');}
test('real settings transaction, concurrent saves and actual route validation',{skip:!url},async t=>{
 const admin=new Pool({connectionString:url});const dbName='qa_commission_pool_'+crypto.randomBytes(6).toString('hex');let pool;
 try{
  await admin.query('CREATE DATABASE '+dbName);const scoped=new URL(url);scoped.pathname='/'+dbName;pool=new Pool({connectionString:scoped.toString(),max:5});
  await pool.query('CREATE TABLE commission_rates(id text,role_type text PRIMARY KEY,commission_percentage numeric(10,2),description text,updated_at timestamptz)');
  const read=async()=>Object.fromEntries((await pool.query('SELECT role_type,commission_percentage FROM commission_rates ORDER BY role_type')).rows.map(r=>[r.role_type,r.commission_percentage]));
  const reset=async(values=valid)=>{await pool.query('TRUNCATE commission_rates');for(const [role,value]of Object.entries({...values,branch_direct:15}))await pool.query('INSERT INTO commission_rates(id,role_type,commission_percentage) VALUES($1,$1,$2)',[role,value]);};
  await t.test('90%,110%,99.99% and100.01% requests write nothing, including bonus changes',async()=>{
   for(const state of [0,20,'9.99','10.01']){await reset();const before=await read();await assert.rejects(updateCommissionRates(pool,[...input({...valid,state}),{role_type:'branch_direct',commission_percentage:30}]),CommissionPoolValidationError);assert.deepEqual(await read(),before);}
  });
  await t.test('100% save persists exactly and legacy amount is not counted',async()=>{
   await reset();await updateCommissionRates(pool,input({affiliate:'33.33',branch:'33.33',area:'33.34',state:0,branch_direct:99}));assert.equal(normalCommissionPool(await read()).valid,true);assert.equal((await read()).branch_direct,'99.00');
  });
  await t.test('partial normal update validates merged rates and can repair existing 90% configuration',async()=>{
   await reset({affiliate:50,branch:25,area:10,state:5});await updateCommissionRates(pool,input({area:20}));assert.equal(normalCommissionPool(await read()).valid,true);const before=await read();await assert.rejects(updateCommissionRates(pool,input({area:10})),CommissionPoolValidationError);assert.deepEqual(await read(),before);
  });
  await t.test('legacy-only edit stays independent even when existing normal pool needs correction',async()=>{
   await reset({affiliate:50,branch:25,area:10,state:5});await updateCommissionRates(pool,input({branch_direct:20}));const after=await read();assert.equal(after.branch_direct,'20.00');assert.equal(normalCommissionPool(after).total,90);
  });
  await t.test('simultaneous valid plans cannot combine into a 90% or110% pool',async()=>{
   await reset();const results=await Promise.allSettled([updateCommissionRates(pool,input({affiliate:60,branch:15})),updateCommissionRates(pool,input({branch:35,area:5}))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(normalCommissionPool(await read()).valid,true);
  });
  await t.test('failure after first rate update rolls the entire save back',async()=>{
   await reset();const before=await read();let changes=0;
   const faulty={connect:async()=>{const c=await pool.connect();return {release:()=>c.release(),query:(sql,args)=>{if(sql.startsWith('UPDATE')&&++changes===2)throw Error('QA injected write failure');return c.query(sql,args);}}}};
   await assert.rejects(updateCommissionRates(faulty,input({...valid,affiliate:60,branch:15})),/QA injected/);assert.deepEqual(await read(),before);
  });
  await t.test('actual PUT returns400 for invalid totals/malformed JSON and200 only for valid saves',async()=>{
   await reset();const ts=require('typescript');const exports={};const source=fs.readFileSync(path.join(__dirname,'../app/api/admin/commission-rates/route.ts'),'utf8');
   const modules={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},pg:{Pool:function(){return pool}},'@/lib/commission-rates':require('../lib/commission-rates.ts'),'@/lib/commission-pool':require('../lib/commission-pool.ts'),'@/lib/commission-rate-update':{updateCommissionRates}};
   vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:k=>modules[k],console,process});
   const before=await read();const bad=await exports.PUT({json:async()=>({rates:input({...valid,state:20})})});assert.equal(bad.status,400);assert.match(bad.body.error,/exactly 100/);assert.deepEqual(await read(),before);
   assert.equal((await exports.PUT({json:async()=>{throw new SyntaxError('bad')}})).status,400);
   assert.equal((await exports.PUT({json:async()=>({rates:input(valid)})})).status,200);
   const get=await exports.GET();assert.equal(get.status,200);assert.equal(get.body.ratesByRole.branch,25);assert.equal(get.body.ratesByRole.area,15);
  });
 }finally{if(pool)await pool.end();await admin.query('DROP DATABASE IF EXISTS '+dbName);await admin.end();}
});
