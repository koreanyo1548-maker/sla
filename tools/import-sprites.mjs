/* Production atlas importer: generated magenta mattes become real alpha once,
   before release. The game never keys pixels or reads back a canvas at runtime.
   Usage: NODE_PATH=<sharp installation> node tools/import-sprites.mjs input output cols rows
   Atlas cell ordering is preserved, with a small transparent gutter in every cell. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const [input, output, c='4', r='2'] = process.argv.slice(2);
if (!input || !output) throw new Error('input output columns rows are required');
const cols=Number(c), rows=Number(r), cell=384, inset=12;
const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const {width,height}=info;
// The image tool supplies a flat matte. Remove only pixels connected to a cell
// edge, so similarly colored purple gems/armor enclosed by their outline survive.
const keyed=new Uint8Array(width*height), queue=new Int32Array(width*height);
const candidate=i=>{
  const p=i*4;
  return data[p]>165 && data[p+2]>170 && data[p+1]<65
    && Math.abs(data[p]-data[p+2])<85;
};
for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
  const x0=Math.floor(col*width/cols),x1=Math.floor((col+1)*width/cols);
  const y0=Math.floor(row*height/rows),y1=Math.floor((row+1)*height/rows);
  let head=0,tail=0;
  const add=i=>{if(!keyed[i]&&candidate(i)){keyed[i]=1;queue[tail++]=i;}};
  for(let x=x0;x<x1;x++){add(y0*width+x);add((y1-1)*width+x);}
  for(let y=y0;y<y1;y++){add(y*width+x0);add(y*width+x1-1);}
  while(head<tail){
    const i=queue[head++],x=i%width,y=Math.floor(i/width);
    if(x>x0)add(i-1);if(x<x1-1)add(i+1);if(y>y0)add(i-width);if(y<y1-1)add(i+width);
  }
}
for(let i=0;i<keyed.length;i++) if(keyed[i]) data[i*4+3]=0;
// Tiny enclosed matte gaps (between fingers, weapons, capes) use the stricter
// saturated-key threshold rather than expanding the connected outline mask.
for(let i=0;i<keyed.length;i++){
  const p=i*4;
  if(data[p]>220&&data[p+2]>220&&data[p+1]<24) data[p+3]=0;
}
const composite=[];
for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
  const left=Math.floor(col*width/cols),top=Math.floor(row*height/rows);
  const tile=await sharp(data,{raw:{width,height,channels:4}})
    .extract({left,top,width:Math.floor((col+1)*width/cols)-left,height:Math.floor((row+1)*height/rows)-top})
    .resize(cell-inset*2,cell-inset*2,{fit:'contain',background:'#00000000'}).png().toBuffer();
  composite.push({input:tile,left:col*cell+inset,top:row*cell+inset});
}
await sharp({create:{width:cols*cell,height:rows*cell,channels:4,background:'#00000000'}})
  .composite(composite).webp({quality:88,alphaQuality:100,effort:6}).toFile(output);
console.log(output);
