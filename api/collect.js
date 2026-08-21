const { collectAll, saveLatest } = require('../lib/collector');

module.exports = async function handler(req,res){
  const secret=process.env.CRON_SECRET;
  if(secret && req.headers.authorization !== `Bearer ${secret}`){
    return res.status(401).json({ok:false,error:'unauthorized'});
  }
  try{
    const payload=await collectAll();
    let persisted=false;
    try{ if(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN){ await saveLatest(payload); persisted=true; } }catch(e){ payload.persistenceError=String(e.message||e); }
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,persisted,...payload});
  }catch(e){ return res.status(500).json({ok:false,error:String(e.message||e)}); }
}
