let sqlPromise=null;
let schemaReady=false;

function enabled(){return Boolean(process.env.DATABASE_URL)}
async function getSql(){
  if(!enabled())return null;
  if(!sqlPromise){
    sqlPromise=import('@neondatabase/serverless').then(({neon})=>neon(process.env.DATABASE_URL));
  }
  return sqlPromise;
}
async function ensureSchema(){
  if(schemaReady||!enabled())return enabled();
  const sql=await getSql();
  await sql.query(`CREATE TABLE IF NOT EXISTS sapio_feed_snapshots (
    id bigserial PRIMARY KEY,
    generated_at timestamptz NOT NULL,
    refresh_after timestamptz NOT NULL,
    item_count integer NOT NULL DEFAULT 0,
    category_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql.query(`CREATE TABLE IF NOT EXISTS sapio_timeline_renewals (
    id bigserial PRIMARY KEY,
    requested_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    trigger_type text NOT NULL,
    status text NOT NULL DEFAULT 'running',
    snapshot_id bigint REFERENCES sapio_feed_snapshots(id) ON DELETE SET NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
  )`);
  await sql.query(`CREATE INDEX IF NOT EXISTS sapio_feed_snapshots_generated_idx ON sapio_feed_snapshots (generated_at DESC)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS sapio_timeline_renewals_requested_idx ON sapio_timeline_renewals (requested_at DESC)`);
  schemaReady=true;
  return true;
}
function counts(payload){
  const out={};
  for(const item of payload?.items||[]){
    const cats=new Set([...(item.categories||[]),item.primaryCategory].filter(Boolean));
    cats.forEach(cat=>out[cat]=(out[cat]||0)+1);
  }
  return out;
}
async function saveSnapshot(payload,{trigger='collector'}={}){
  if(!enabled())return{ok:false,reason:'DATABASE_URL missing'};
  await ensureSchema();
  const sql=await getSql();
  const generatedAt=payload.generatedAt||new Date().toISOString();
  const refreshAfter=new Date(new Date(generatedAt).getTime()+15*60*1000).toISOString();
  const metadata={sourcesAttempted:payload.run?.sourcesAttempted||0,sourcesOk:payload.run?.sourcesOk||0,observations:payload.run?.observations||0,clusters:payload.run?.clusters||payload.items?.length||0};
  const renewal=await sql.query(
    `INSERT INTO sapio_timeline_renewals (trigger_type,status,metadata) VALUES ($1,'running',$2::jsonb) RETURNING id`,
    [trigger,JSON.stringify(metadata)]
  );
  try{
    const rows=await sql.query(
      `INSERT INTO sapio_feed_snapshots (generated_at,refresh_after,item_count,category_counts,payload)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb) RETURNING id`,
      [generatedAt,refreshAfter,payload.items?.length||0,JSON.stringify(counts(payload)),JSON.stringify(payload)]
    );
    const snapshotId=rows[0]?.id||null;
    await sql.query(
      `UPDATE sapio_timeline_renewals SET completed_at=now(),status='complete',snapshot_id=$1 WHERE id=$2`,
      [snapshotId,renewal[0]?.id]
    );
    await sql.query(`DELETE FROM sapio_feed_snapshots WHERE created_at < now() - interval '14 days'`);
    return{ok:true,snapshotId};
  }catch(error){
    try{await sql.query(`UPDATE sapio_timeline_renewals SET completed_at=now(),status='failed',metadata=metadata || $1::jsonb WHERE id=$2`,[JSON.stringify({error:String(error.message||error).slice(0,500)}),renewal[0]?.id])}catch{}
    throw error;
  }
}
async function loadLatestSnapshot(){
  if(!enabled())return null;
  await ensureSchema();
  const sql=await getSql();
  const rows=await sql.query(`SELECT id,generated_at,refresh_after,payload FROM sapio_feed_snapshots ORDER BY generated_at DESC LIMIT 1`);
  if(!rows.length)return null;
  const row=rows[0],payload=row.payload;
  if(payload&&typeof payload==='object'){
    payload.persistence={...(payload.persistence||{}),neon:true,snapshotId:row.id};
    payload.databaseRefreshAfter=row.refresh_after;
  }
  return payload||null;
}
module.exports={enabled,ensureSchema,saveSnapshot,loadLatestSnapshot};
