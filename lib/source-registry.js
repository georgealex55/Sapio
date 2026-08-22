const OPEN_SOURCES = [
  // Core evidence / science
  { id:'hn', name:'Hacker News', role:'WHISPER', kind:'community', categories:['SIGNAL LAB','IGNITION'], sourceEdge:82, adapter:'hackernews', limit:18 },

  // Public forums / community feeds — no OAuth required
  { id:'forum-lobsters', name:'Lobsters', role:'WHISPER', kind:'public-forum', categories:['SIGNAL LAB','IGNITION'], sourceEdge:72, adapter:'rss', url:'https://lobste.rs/rss', limit:14 },
  { id:'forum-metafilter', name:'MetaFilter', role:'WHISPER', kind:'public-forum', categories:['THE PULSE','IGNITION','APPETITE'], sourceEdge:70, adapter:'rss', url:'https://www.metafilter.com/rss.xml', limit:14 },
  { id:'forum-lesswrong', name:'LessWrong', role:'CONTEXT', kind:'public-forum', categories:['SIGNAL LAB','ARCANA','SOMA'], sourceEdge:74, adapter:'rss', url:'https://www.lesswrong.com/feed.xml', limit:12 },
  { id:'forum-slashdot', name:'Slashdot', role:'WHISPER', kind:'public-forum', categories:['SIGNAL LAB','THE PULSE','IGNITION'], sourceEdge:71, adapter:'rss', url:'https://rss.slashdot.org/Slashdot/slashdotMain', limit:14 },
  { id:'arxiv', name:'arXiv', role:'PREPRINT', kind:'research', categories:['SIGNAL LAB'], sourceEdge:78, adapter:'arxiv', limit:12 },
  { id:'pubmed-sex', name:'PubMed — Sexuality', role:'EVIDENCE', kind:'research', categories:['EROS INDEX','SOMA'], sourceEdge:92, adapter:'pubmed', limit:10, query:'(sexual behavior OR sexuality OR sexual health OR kink OR BDSM OR libido)' },
  { id:'pubmed-wellness', name:'PubMed — Wellness', role:'EVIDENCE', kind:'research', categories:['SOMA'], sourceEdge:92, adapter:'pubmed', limit:10, query:'(longevity OR supplements OR sleep OR exercise OR meditation OR nutrition)' },
  { id:'usgs', name:'USGS', role:'EVIDENCE', kind:'agency', categories:['TERRA','THE PULSE'], sourceEdge:96, adapter:'usgs', limit:14 },
  { id:'nasa', name:'NASA', role:'EVIDENCE', kind:'agency', categories:['TERRA','SIGNAL LAB'], sourceEdge:95, adapter:'rss', url:'https://www.nasa.gov/feed/', limit:12 },

  // Direct magazine / editorial RSS feeds
  { id:'esquire', name:'Esquire', role:'CONFIRMATION', kind:'magazine', categories:['APPETITE','IGNITION','OBJECTS OF DESIRE','THE PULSE','EROS INDEX'], sourceEdge:82, adapter:'rss', url:'https://www.esquire.com/rss/all.xml', limit:14 },
  { id:'gq', name:'GQ', role:'CONFIRMATION', kind:'magazine', categories:['APPETITE','IGNITION','OBJECTS OF DESIRE','SOMA','EROS INDEX'], sourceEdge:84, adapter:'rss', url:'https://www.gq.com/feed/rss', limit:14 },
  { id:'menshealth', name:"Men's Health", role:'CONFIRMATION', kind:'magazine', categories:['SOMA','APPETITE','EROS INDEX','OBJECTS OF DESIRE'], sourceEdge:86, adapter:'rss', url:'https://www.menshealth.com/rss/all.xml', limit:14 },
  { id:'glamour', name:'Glamour', role:'CONFIRMATION', kind:'magazine', categories:['APPETITE','VISUAL CORTEX','IGNITION','SOMA','OBJECTS OF DESIRE'], sourceEdge:80, adapter:'rss', url:'https://www.glamour.com/feed/rss', limit:14 },

  // Reddit — broad cultural radar
  { id:'reddit-futurology', name:'Reddit r/Futurology', role:'WHISPER', kind:'community', categories:['SIGNAL LAB','IGNITION'], sourceEdge:70, adapter:'reddit', subreddit:'Futurology', limit:12 },
  { id:'reddit-graphicdesign', name:'Reddit r/graphic_design', role:'WHISPER', kind:'community', categories:['VISUAL CORTEX'], sourceEdge:68, adapter:'reddit', subreddit:'graphic_design', limit:12 },
  { id:'reddit-gardening', name:'Reddit r/gardening', role:'WHISPER', kind:'community', categories:['VERDANT'], sourceEdge:67, adapter:'reddit', subreddit:'gardening', limit:12 },
  { id:'reddit-cooking', name:'Reddit r/Cooking', role:'WHISPER', kind:'community', categories:['APPETITE'], sourceEdge:66, adapter:'reddit', subreddit:'Cooking', limit:12 },
  { id:'reddit-occult', name:'Reddit r/occult', role:'WHISPER', kind:'community', categories:['ARCANA'], sourceEdge:64, adapter:'reddit', subreddit:'occult', limit:12 },
  { id:'reddit-astrology', name:'Reddit r/astrology', role:'WHISPER', kind:'community', categories:['ARCANA'], sourceEdge:63, adapter:'reddit', subreddit:'astrology', limit:12 },
  { id:'reddit-blacktwitter', name:'Reddit r/BlackPeopleTwitter', role:'WHISPER', kind:'community', categories:['IGNITION','THE PULSE','APPETITE'], sourceEdge:74, adapter:'reddit', subreddit:'BlackPeopleTwitter', limit:14 },
  { id:'reddit-streetwear', name:'Reddit r/streetwear', role:'WHISPER', kind:'community', categories:['APPETITE','VISUAL CORTEX','OBJECTS OF DESIRE'], sourceEdge:69, adapter:'reddit', subreddit:'streetwear', limit:12 },
  { id:'reddit-biohacking', name:'Reddit r/Biohackers', role:'WHISPER', kind:'community', categories:['SOMA','OBJECTS OF DESIRE'], sourceEdge:66, adapter:'reddit', subreddit:'Biohackers', limit:12 },
  { id:'reddit-sex', name:'Reddit r/sex', role:'WHISPER', kind:'community', categories:['EROS INDEX'], sourceEdge:65, adapter:'reddit', subreddit:'sex', textOnly:true, limit:12 },
  { id:'reddit-bdsm', name:'Reddit r/BDSMcommunity', role:'WHISPER', kind:'community', categories:['EROS INDEX'], sourceEdge:67, adapter:'reddit', subreddit:'BDSMcommunity', textOnly:true, limit:12 },

  // Platform / social trend radar through news-index discovery
  { id:'gnews-tiktok', name:'TikTok Trend Radar', role:'WHISPER', kind:'social-index', categories:['IGNITION','APPETITE','OBJECTS OF DESIRE','VISUAL CORTEX'], sourceEdge:74, adapter:'gnews', query:'TikTok viral trend culture fashion food product creator', limit:10 },
  { id:'gnews-instagram', name:'Instagram Trend Radar', role:'WHISPER', kind:'social-index', categories:['IGNITION','APPETITE','VISUAL CORTEX','OBJECTS OF DESIRE'], sourceEdge:72, adapter:'gnews', query:'Instagram viral trend creator culture fashion beauty product', limit:10 },
  { id:'gnews-pinterest', name:'Pinterest Trend Radar', role:'WHISPER', kind:'social-index', categories:['APPETITE','VISUAL CORTEX','OBJECTS OF DESIRE','VERDANT'], sourceEdge:76, adapter:'gnews', query:'Pinterest trend predicts aesthetic fashion food home product', limit:10 },
  { id:'gnews-blacktwitter', name:'Black Twitter / Black Social Culture', role:'WHISPER', kind:'social-index', categories:['IGNITION','THE PULSE','APPETITE'], sourceEdge:76, adapter:'gnews', query:'"Black Twitter" OR "Black TikTok" viral culture social media', limit:10 },

  // Named editorial sources requested by the user
  { id:'gnews-natgeo', name:'National Geographic', role:'CONFIRMATION', kind:'magazine-index', categories:['TERRA','SIGNAL LAB','SOMA','VERDANT','THE PULSE'], sourceEdge:90, adapter:'gnews', query:'site:nationalgeographic.com science wildlife earth health travel culture', limit:10 },
  { id:'gnews-discovery', name:'Discovery', role:'CONFIRMATION', kind:'media-index', categories:['TERRA','SIGNAL LAB','IGNITION'], sourceEdge:78, adapter:'gnews', query:'site:discovery.com science nature technology culture Discovery', limit:10 },
  { id:'gnews-maxim', name:'Maxim', role:'WHISPER', kind:'magazine-index', categories:['APPETITE','IGNITION','OBJECTS OF DESIRE','EROS INDEX'], sourceEdge:72, adapter:'gnews', query:'site:maxim.com style culture travel gear entertainment relationships', limit:10 },
  { id:'gnews-kandy', name:'KANDY Magazine', role:'WHISPER', kind:'magazine-index', categories:['APPETITE','IGNITION','OBJECTS OF DESIRE','EROS INDEX'], sourceEdge:62, adapter:'gnews', query:'site:kandymag.com KANDY magazine lifestyle entertainment tech sports relationships', limit:8, textOnly:true },
  { id:'gnews-fhm', name:'FHM', role:'WHISPER', kind:'magazine-index', categories:['APPETITE','IGNITION','OBJECTS OF DESIRE','EROS INDEX'], sourceEdge:66, adapter:'gnews', query:'site:fhm.com lifestyle fashion tech entertainment relationships culture', limit:8, textOnly:true },
  { id:'gnews-stuff', name:'Stuff Magazine', role:'WHISPER', kind:'magazine-index', categories:['SIGNAL LAB','OBJECTS OF DESIRE','IGNITION'], sourceEdge:76, adapter:'gnews', query:'Stuff magazine gadgets technology gear trend', limit:10 },
  { id:'gnews-foodbeast', name:'Foodbeast', role:'WHISPER', kind:'food-index', categories:['APPETITE','IGNITION','OBJECTS OF DESIRE'], sourceEdge:74, adapter:'gnews', query:'site:foodbeast.com food culture viral food product restaurant trend', limit:10 },
  { id:'gnews-allrecipes', name:'Allrecipes', role:'CONFIRMATION', kind:'food-index', categories:['APPETITE'], sourceEdge:78, adapter:'gnews', query:'site:allrecipes.com recipe food trend cooking viral', limit:10 },
  { id:'gnews-foodnetwork', name:'Food Network', role:'CONFIRMATION', kind:'food-index', categories:['APPETITE','IGNITION'], sourceEdge:80, adapter:'gnews', query:'site:foodnetwork.com food recipe chef trend restaurant', limit:10 },

  // Broad category coverage
  { id:'gnews-fashion', name:'Google News — Fashion & Culture', role:'CONFIRMATION', kind:'news-index', categories:['APPETITE','VISUAL CORTEX'], sourceEdge:76, adapter:'gnews', query:'fashion culture design trend beauty style', limit:10 },
  { id:'gnews-pop', name:'Google News — Pop Culture', role:'CONFIRMATION', kind:'news-index', categories:['IGNITION','THE PULSE'], sourceEdge:76, adapter:'gnews', query:'pop culture viral trend celebrity internet culture', limit:10 },
  { id:'gnews-products', name:'Google News — Viral Products', role:'CONFIRMATION', kind:'news-index', categories:['OBJECTS OF DESIRE'], sourceEdge:74, adapter:'gnews', query:'viral product trend sold out restock gadget beauty fashion', limit:10 },
  { id:'gnews-wellness', name:'Google News — Wellness', role:'CONFIRMATION', kind:'news-index', categories:['SOMA'], sourceEdge:74, adapter:'gnews', query:'wellness health trend longevity sleep nutrition fitness', limit:10 },
  { id:'gnews-gardening', name:'Google News — Plants & Gardening', role:'CONFIRMATION', kind:'news-index', categories:['VERDANT'], sourceEdge:72, adapter:'gnews', query:'gardening houseplants home growing plant trend agriculture', limit:10 },
  { id:'gnews-spiritual', name:'Google News — Spirituality & Ritual', role:'CONTEXT', kind:'news-index', categories:['ARCANA'], sourceEdge:68, adapter:'gnews', query:'spirituality astrology ritual occult religion cultural trend', limit:10 },
  { id:'gnews-world', name:'Google News — World & Culture', role:'CONFIRMATION', kind:'news-index', categories:['THE PULSE'], sourceEdge:84, adapter:'gnews', query:'world news culture society Reuters AP BBC NPR', limit:12 },

  // Adult-industry culture/business: text-only + explicit-release filter
  { id:'gnews-xbiz', name:'XBIZ — Business & Pleasure Products', role:'WHISPER', kind:'adult-trade-index', categories:['EROS INDEX','SIGNAL LAB','OBJECTS OF DESIRE'], sourceEdge:78, adapter:'gnews', query:'site:xbiz.com adult industry business technology pleasure products sexual wellness law', limit:8, textOnly:true, safeAdultOnly:true },
  { id:'gnews-avn', name:'AVN — Industry & Business', role:'WHISPER', kind:'adult-trade-index', categories:['EROS INDEX','THE PULSE'], sourceEdge:72, adapter:'gnews', query:'site:avn.com adult industry business law technology awards policy', limit:8, textOnly:true, safeAdultOnly:true },
  { id:'gnews-mikesouth', name:'Mike South — Industry Commentary', role:'WHISPER', kind:'adult-trade-index', categories:['EROS INDEX','THE PULSE'], sourceEdge:62, adapter:'gnews', query:'site:mikesouth.com adult industry business law commentary technology', limit:8, textOnly:true, safeAdultOnly:true }
];

const CATALOG_SOURCES = [
  ['Reddit','WHISPER'],['TikTok Creative Center','WHISPER'],['Pinterest Trends / Predicts','WHISPER'],['YouTube / Shorts','WHISPER'],['Instagram','WHISPER'],['Threads','WHISPER'],['Tumblr','WHISPER'],['Bluesky','WHISPER'],['X / Black Twitter','WHISPER'],['Substack','WHISPER'],['Know Your Meme','CONTEXT'],['Google Trends','CONFIRMATION'],['Exploding Topics','WHISPER'],['Trend Hunter','WHISPER'],['Kickstarter','WHISPER'],['Indiegogo','WHISPER'],['Product Hunt','WHISPER'],['GitHub Trending','WHISPER'],['Hacker News','WHISPER'],
  ['National Geographic','EVIDENCE'],['Discovery','CONFIRMATION'],['The Atlantic','CONTEXT'],['The New Yorker','CONTEXT'],['Aeon','CONTEXT'],['Psyche','CONTEXT'],['Nautilus','CONTEXT'],['Quanta Magazine','EVIDENCE'],['MIT Technology Review','CONFIRMATION'],['WIRED','CONFIRMATION'],['404 Media','CONFIRMATION'],['Ars Technica','CONFIRMATION'],['The Verge','CONFIRMATION'],['Semafor','CONFIRMATION'],
  ['GQ','CONFIRMATION'],['Esquire','CONFIRMATION'],["Men's Health",'CONFIRMATION'],['Maxim','WHISPER'],['KANDY Magazine','WHISPER'],['FHM','WHISPER'],['Stuff Magazine','WHISPER'],['Glamour','CONFIRMATION'],['Dazed','WHISPER'],['Highsnobiety','WHISPER'],['Hypebeast','WHISPER'],['Vogue / Vogue Business','CONFIRMATION'],['WWD','CONFIRMATION'],['Fashionista','WHISPER'],['The Cut','WHISPER'],['Allure','CONFIRMATION'],
  ['Foodbeast','WHISPER'],['Allrecipes','CONFIRMATION'],['Food Network','CONFIRMATION'],['Eater','CONFIRMATION'],['Bon Appetit','CONFIRMATION'],['Food & Wine','CONFIRMATION'],['Serious Eats','CONFIRMATION'],
  ['PubMed','EVIDENCE'],['Kinsey Institute','EVIDENCE'],['International Society for Sexual Medicine','EVIDENCE'],['Archives of Sexual Behavior','EVIDENCE'],['The Journal of Sex Research','EVIDENCE'],['The Journal of Sexual Medicine','EVIDENCE'],['Sexual Medicine Reviews','EVIDENCE'],['medRxiv','PREPRINT'],['bioRxiv','PREPRINT'],['arXiv','PREPRINT'],
  ['XBIZ — non-explicit trade coverage','WHISPER'],['AVN — non-explicit trade coverage','WHISPER'],['Mike South — industry commentary','WHISPER'],
  ['Reuters','EVIDENCE'],['AP','EVIDENCE'],['BBC','CONFIRMATION'],['NPR','CONFIRMATION'],['Financial Times','CONFIRMATION'],['The Economist','CONTEXT'],
  ['NASA Earth Observatory','EVIDENCE'],['NOAA','EVIDENCE'],['USGS','EVIDENCE'],['Eos','EVIDENCE'],['EarthSky','CONFIRMATION'],['Nature','EVIDENCE'],['Science','EVIDENCE'],['PNAS','EVIDENCE']
].map(([name,role]) => ({name,role}));

module.exports = { OPEN_SOURCES, CATALOG_SOURCES };
