import fs from 'node:fs/promises';
// Seeds remain authoritative for new manually verified records; previous imports survive pushes.
for(const file of ['anilist.json','musicbrainz.json']){
 let previous;try{previous=JSON.parse(await fs.readFile(`previous/${file}`,'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
 if(!Array.isArray(previous)||previous.some(w=>typeof w.id!=='string'||typeof w.title!=='string'))throw Error('Invalid Works snapshot');
 const seeds=JSON.parse(await fs.readFile(file,'utf8'));
 const map=new Map(seeds.map(w=>[w.id,w]));
 for(const row of previous)map.set(row.id,{...map.get(row.id),...row});
 await fs.writeFile(file,JSON.stringify([...map.values()],null,2)+'\n');
}
