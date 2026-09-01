const {enabled,saveNavigationHistory,loadNavigationHistory}=require('../lib/neon-store');

function validDevice(value){return typeof value==='string'&&/^[A-Za-z0-9:_-]{8,160}$/.test(value)}
function parseBody(req){
  if(req.body&&typeof req.body==='object')return req.body;
  if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{return null}}
  return null;
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'){
    const device=Array.isArray(req.query?.device)?req.query.device[0]:req.query?.device;
    if(!validDevice(device))return res.status(400).json({ok:false,error:'invalid device id'});
    if(!enabled())return res.status(200).json({ok:true,persisted:'local',entries:[]});
    try{return res.status(200).json({ok:true,persisted:'neon',entries:await loadNavigationHistory(device,30)})}
    catch(error){return res.status(200).json({ok:true,persisted:'local',entries:[],warning:String(error.message||error)})}
  }
  if(req.method==='POST'){
    const body=parseBody(req)||{};const device=body.deviceId,entry=body.entry;
    if(!validDevice(device)||!entry?.id)return res.status(400).json({ok:false,error:'invalid history payload'});
    if(!enabled())return res.status(200).json({ok:true,persisted:'local'});
    try{await saveNavigationHistory(device,entry);return res.status(200).json({ok:true,persisted:'neon'})}
    catch(error){return res.status(200).json({ok:true,persisted:'local',warning:String(error.message||error)})}
  }
  res.setHeader('Allow','GET, POST');
  return res.status(405).json({ok:false,error:'method not allowed'});
};
