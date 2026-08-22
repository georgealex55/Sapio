const fs=require('fs');
const path=require('path');
const {collectAll}=require('../lib/collector');
const {enrichFeedImages}=require('../lib/image-enrichment');
const {persistClusters}=require('../lib/cluster-persistence');

async function main(){
  const target=path.join(process.cwd(),'data','live.json');
  let previous=null;
  if(fs.existsSync(target)){try{previous=JSON.parse(fs.readFileSync(target,'utf8'))}catch{}}
  let payload=await collectAll();
  await enrichFeedImages(payload,{limit:60,concurrency:4,timeoutMs:1800});
  payload=persistClusters(payload,previous,{maxHistory:500,retentionDays:90});
  payload.scheduled=true;
  payload.generator='github-actions';
  if(!payload.items?.length)throw new Error('Collector returned no timeline items; preserving the previous snapshot.');
  const temp=`${target}.tmp`;
  fs.writeFileSync(temp,JSON.stringify(payload,null,2)+'\n','utf8');
  fs.renameSync(temp,target);
  console.log(JSON.stringify({generatedAt:payload.generatedAt,items:payload.items.length,run:payload.run}));
}
main().catch(error=>{console.error(error);process.exit(1)});
