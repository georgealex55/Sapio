const OPEN_SOURCES = [
  { id: 'hn', name: 'Hacker News', role: 'WHISPER', kind: 'community', categories: ['SIGNAL LAB','IGNITION'], sourceEdge: 82, adapter: 'hackernews' },
  { id: 'arxiv', name: 'arXiv', role: 'EVIDENCE', kind: 'research', categories: ['SIGNAL LAB'], sourceEdge: 78, adapter: 'arxiv' },
  { id: 'pubmed-sex', name: 'PubMed — Sexuality', role: 'EVIDENCE', kind: 'research', categories: ['EROS INDEX','SOMA'], sourceEdge: 92, adapter: 'pubmed', query: '(sexual behavior OR sexuality OR sexual health OR kink OR BDSM OR libido)' },
  { id: 'pubmed-wellness', name: 'PubMed — Wellness', role: 'EVIDENCE', kind: 'research', categories: ['SOMA'], sourceEdge: 92, adapter: 'pubmed', query: '(longevity OR supplements OR sleep OR exercise OR meditation OR nutrition)' },
  { id: 'usgs', name: 'USGS', role: 'EVIDENCE', kind: 'agency', categories: ['TERRA','THE PULSE'], sourceEdge: 96, adapter: 'usgs' },
  { id: 'nasa', name: 'NASA', role: 'EVIDENCE', kind: 'agency', categories: ['TERRA','SIGNAL LAB'], sourceEdge: 95, adapter: 'rss', url: 'https://www.nasa.gov/feed/' },
  { id: 'reddit-futurology', name: 'Reddit r/Futurology', role: 'WHISPER', kind: 'community', categories: ['SIGNAL LAB','IGNITION'], sourceEdge: 70, adapter: 'reddit', subreddit: 'Futurology' },
  { id: 'reddit-graphicdesign', name: 'Reddit r/graphic_design', role: 'WHISPER', kind: 'community', categories: ['VISUAL CORTEX'], sourceEdge: 68, adapter: 'reddit', subreddit: 'graphic_design' },
  { id: 'reddit-gardening', name: 'Reddit r/gardening', role: 'WHISPER', kind: 'community', categories: ['VERDANT'], sourceEdge: 67, adapter: 'reddit', subreddit: 'gardening' },
  { id: 'reddit-cooking', name: 'Reddit r/Cooking', role: 'WHISPER', kind: 'community', categories: ['APPETITE'], sourceEdge: 66, adapter: 'reddit', subreddit: 'Cooking' },
  { id: 'reddit-occult', name: 'Reddit r/occult', role: 'WHISPER', kind: 'community', categories: ['ARCANA'], sourceEdge: 64, adapter: 'reddit', subreddit: 'occult' },
  { id: 'reddit-astrology', name: 'Reddit r/astrology', role: 'WHISPER', kind: 'community', categories: ['ARCANA'], sourceEdge: 63, adapter: 'reddit', subreddit: 'astrology' },
  { id: 'reddit-sex', name: 'Reddit r/sex', role: 'WHISPER', kind: 'community', categories: ['EROS INDEX'], sourceEdge: 65, adapter: 'reddit', subreddit: 'sex', textOnly: true },
  { id: 'reddit-bdsm', name: 'Reddit r/BDSMcommunity', role: 'WHISPER', kind: 'community', categories: ['EROS INDEX'], sourceEdge: 67, adapter: 'reddit', subreddit: 'BDSMcommunity', textOnly: true },
  { id: 'gnews-fashion', name: 'Google News — Fashion & Culture', role: 'CONFIRMATION', kind: 'news-index', categories: ['APPETITE','VISUAL CORTEX'], sourceEdge: 76, adapter: 'gnews', query: 'fashion culture design trend' },
  { id: 'gnews-pop', name: 'Google News — Pop Culture', role: 'CONFIRMATION', kind: 'news-index', categories: ['IGNITION','THE PULSE'], sourceEdge: 76, adapter: 'gnews', query: 'pop culture viral trend' },
  { id: 'gnews-products', name: 'Google News — Viral Products', role: 'CONFIRMATION', kind: 'news-index', categories: ['OBJECTS OF DESIRE'], sourceEdge: 74, adapter: 'gnews', query: 'viral product trend sold out' },
  { id: 'gnews-wellness', name: 'Google News — Wellness', role: 'CONFIRMATION', kind: 'news-index', categories: ['SOMA'], sourceEdge: 74, adapter: 'gnews', query: 'wellness health trend longevity' }
];

const CATALOG_SOURCES = [
  ['Reddit','WHISPER'],['TikTok Creative Center','WHISPER'],['Pinterest Trends / Predicts','WHISPER'],['YouTube / Shorts','WHISPER'],['Instagram','WHISPER'],['Threads','WHISPER'],['Tumblr','WHISPER'],['Bluesky','WHISPER'],['X','WHISPER'],['Substack','WHISPER'],['Public Discord communities','WHISPER'],['Know Your Meme','CONTEXT'],['Google Trends','CONFIRMATION'],['Exploding Topics','WHISPER'],['Trend Hunter','WHISPER'],['Kickstarter','WHISPER'],['Indiegogo','WHISPER'],['Product Hunt','WHISPER'],['GitHub Trending','WHISPER'],['Hacker News','WHISPER'],
  ['The Atlantic','CONTEXT'],['The New Yorker','CONTEXT'],['Aeon','CONTEXT'],['Psyche','CONTEXT'],['Nautilus','CONTEXT'],['Quanta Magazine','EVIDENCE'],['MIT Technology Review','CONFIRMATION'],['WIRED','CONFIRMATION'],['404 Media','CONFIRMATION'],['Ars Technica','CONFIRMATION'],['The Verge','CONFIRMATION'],['Semafor','CONFIRMATION'],
  ['Dazed','WHISPER'],['Highsnobiety','WHISPER'],['Hypebeast','WHISPER'],['Vogue / Vogue Business','CONFIRMATION'],['GQ','CONFIRMATION'],['WWD','CONFIRMATION'],['Fashionista','WHISPER'],['The Cut','WHISPER'],['Allure','CONFIRMATION'],['Eater','CONFIRMATION'],['Bon Appetit','CONFIRMATION'],['Food & Wine','CONFIRMATION'],['Serious Eats','CONFIRMATION'],
  ['PubMed','EVIDENCE'],['Kinsey Institute','EVIDENCE'],['International Society for Sexual Medicine','EVIDENCE'],['Archives of Sexual Behavior','EVIDENCE'],['The Journal of Sex Research','EVIDENCE'],['The Journal of Sexual Medicine','EVIDENCE'],['Sexual Medicine Reviews','EVIDENCE'],['Journal of Sex & Marital Therapy','EVIDENCE'],['International Journal of Sexual Health','EVIDENCE'],['medRxiv','PREPRINT'],['bioRxiv','PREPRINT'],['arXiv','PREPRINT'],
  ['Reuters','EVIDENCE'],['AP','EVIDENCE'],['BBC','CONFIRMATION'],['NPR','CONFIRMATION'],['Financial Times','CONFIRMATION'],['The Economist','CONTEXT'],
  ['NASA Earth Observatory','EVIDENCE'],['NOAA','EVIDENCE'],['USGS','EVIDENCE'],['Eos','EVIDENCE'],['EarthSky','CONFIRMATION'],['Nature','EVIDENCE'],['Science','EVIDENCE'],['PNAS','EVIDENCE'],
  ['Behance','WHISPER'],['Dribbble','WHISPER'],['Are.na','WHISPER'],["It's Nice That",'WHISPER'],['Creative Boom','WHISPER'],['Dezeen','CONFIRMATION'],['Designboom','WHISPER'],
  ['Apple Podcasts charts','WHISPER'],['Spotify podcast charts','WHISPER'],['Hidden Brain','CONTEXT'],['Radiolab','CONTEXT'],['Hard Fork','WHISPER'],['Decoder','WHISPER'],['The Ezra Klein Show','CONTEXT'],['Search Engine','CONTEXT'],['The Gray Area','CONTEXT'],['Science Vs','EVIDENCE'],['Ologies','CONTEXT'],['Modern Love','CONTEXT'],['Where Should We Begin?','CONTEXT'],['Savage Lovecast','WHISPER'],['Sex With Emily','WHISPER'],
  ['NYT Books','CONFIRMATION'],['Publishers Weekly','CONFIRMATION'],['Literary Hub','WHISPER'],['Book Riot','WHISPER'],['Goodreads communities','WHISPER'],['BookTok / Bookstagram','WHISPER'],['Service95 Book Club','WHISPER']
].map(([name,role]) => ({name,role}));

module.exports = { OPEN_SOURCES, CATALOG_SOURCES };
