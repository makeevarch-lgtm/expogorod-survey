/* Screen-space captions; geographic points remain unchanged. */
(function(root){
  'use strict';
  function arrangeCallouts(items,width,height){
    const padding=10,gap=7,placed=[];
    const control={left:width-58,top:0,width:58,height:112};
    const overlap=(a,b)=>a.left<b.left+b.width+gap&&a.left+a.width+gap>b.left&&a.top<b.top+b.height+gap&&a.top+a.height+gap>b.top;
    const order=items.slice().sort((a,b)=>(b.priority||0)-(a.priority||0)||a.y-b.y||a.id.localeCompare(b.id));
    for(const item of order){
      const maxX=width-padding-item.width,maxY=height-34-item.height;
      let best=null,bestCost=Infinity;
      const consider=(left,top)=>{
        left=Math.max(padding,Math.min(maxX,left));top=Math.max(padding,Math.min(maxY,top));
        const candidate={...item,left,top};
        if(overlap(candidate,control)||placed.some(p=>overlap(candidate,p)))return;
        const cx=left+item.width/2,cy=top+item.height/2;
        const cost=(cx-item.x)**2+(cy-item.y)**2;
        if(cost<bestCost){best=candidate;bestCost=cost;}
      };
      // Prefer short, orthogonal leaders close to their actual source points.
      for(let r=20;r<=220;r+=20){
        consider(item.x-item.width/2,item.y-item.height-r);
        consider(item.x-item.width/2,item.y+r);
        consider(item.x-item.width-r,item.y-item.height/2);
        consider(item.x+r,item.y-item.height/2);
      }
      // Dense groups still receive a caption; collisions never hide an object.
      for(let top=padding;top<=maxY;top+=8){
        for(let left=padding;left<=maxX;left+=8)consider(left,top);
      }
      if(!best)return packColumns(order,width,height);
      placed.push(best);
    }
    return placed;
  }
  function packColumns(items,width,height){
    const padding=10,gap=7,maxWidth=Math.max(...items.map(i=>i.width));
    const count=Math.max(1,Math.min(3,Math.floor((width-padding*2+gap)/(maxWidth+gap))));
    const columns=Array.from({length:count},(_,i)=>({left:padding+i*(maxWidth+gap),top:padding,items:[]}));
    for(const c of columns)if(c.left+maxWidth+gap>width-58)c.top=119;
    for(const item of items){
      const column=columns.slice().sort((a,b)=>a.top-b.top||Math.abs(a.left-item.x)-Math.abs(b.left-item.x))[0];
      if(column.top+item.height>height-34)throw Error('Callout frame too small for '+item.id);
      column.items.push({...item,left:column.left,top:column.top});column.top+=item.height+gap;
    }
    return columns.flatMap(c=>c.items);
  }
  if(typeof module==='object'&&module.exports)module.exports={arrangeCallouts};
  else root.EXPO_CALLOUTS={arrangeCallouts};
})(typeof window==='object'?window:this);
