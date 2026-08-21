const fs=require('fs');
const path=require('path');
const {loadLatest, collectAll}=require('../lib/collector');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
  try{
    const latest=await loadLatest();
    if(latest) return res.status(200).json(latest);
    const live=await collectAll();
    if(live.items?.length) return res.status(200).json(live);
  }catch(e){}
  const sample=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','sample.json'),'utf8'));
  return res.status(200).json(sample);
}
