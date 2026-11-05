import React,{useEffect,useRef} from 'react';

// Based on liquid-glass-js (MIT): sample a background texture, bend it near
// the edge normal, blur it, and add a light rim. One context serves the wheel.
const vertex=`attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.)*.5;gl_Position=vec4(p,0.,1.);}`;
const fragment=`precision mediump float;
uniform sampler2D image; uniform vec2 size; uniform vec2 viewport; uniform vec2 origin; uniform float count; varying vec2 uv;
const float PI=3.14159265359;
void main(){
 vec2 q=vec2(uv.x,1.-uv.y)*size;
 vec2 v=q-size*.5;float radius=length(v);vec2 outward=radius>0.01?v/radius:vec2(0.,1.);
 float inner=size.x*.28, outer=size.x*.47;
 float theta=mod(atan(v.x,-v.y)+2.*PI,2.*PI);float stepAngle=2.*PI/count;
 float local=mod(theta,stepAngle);float gap=2.*PI/180.;
 float radialDistance=min(radius-inner,outer-radius);
 float angularDistance=(min(local,stepAngle-local)-gap)*radius;
 float corner=size.x*.0275;
 float d=min(radialDistance,angularDistance);
 vec2 rounded=max(vec2(corner-radialDistance,corner-angularDistance),0.);
 d-=max(0.,length(rounded)-max(corner-d,0.));
 float mask=smoothstep(-.8,1.1,d);
 vec2 tangent=vec2(-outward.y,outward.x);
 vec2 normal=radialDistance<angularDistance?(radius-inner<outer-radius?-outward:outward):(local<stepAngle*.5?-tangent:tangent);
 float edge=exp(-max(d,0.)*.18);float rim=exp(-max(d,0.)*.95);
 vec2 refractOffset=normal*(edge*13.+rim*6.);
 vec2 st=(origin+q+refractOffset)/viewport;st.y=1.-st.y;
 vec2 texel=1./viewport;vec3 col=vec3(0.);float sum=0.;
 for(int x=-2;x<=2;x++){for(int y=-2;y<=2;y++){float w=exp(-float(x*x+y*y)/4.);col+=texture2D(image,st+vec2(float(x),float(y))*texel*2.).rgb*w;sum+=w;}}
 col/=sum;col=mix(col,vec3(.93,.96,1.),.24);
 float light=pow(max(dot(normal,normalize(vec2(-.65,-1.))),0.),2.);
 col+=rim*(.18+.38*light);col-=edge*.035;
 gl_FragColor=vec4(col,mask*.91);
}`;
export function RadialGlass({count}){
 const ref=useRef(null), countRef=useRef(count);countRef.current=count;
 useEffect(()=>{
  const canvas=ref.current,gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});if(!gl)return;
  let raf=0,last=0,firstFrame=null,dead=false,program,buffer,texture;const shaders=[];
  const compile=(type,source)=>{const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('shader compilation failed');return s;};
  try{
   program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('shader link failed');gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
   texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   const u=Object.fromEntries(['size','viewport','origin','count'].map(n=>[n,gl.getUniformLocation(program,n)]));
   const draw=t=>{if(dead)return;raf=requestAnimationFrame(draw);if(firstFrame===null)firstFrame=t;if(t-firstFrame<700||document.hidden||t-last<80)return;last=t;const source=document.querySelector('#gradient canvas'),r=canvas.getBoundingClientRect();if(!source?.width||!countRef.current||r.bottom<0||r.top>innerHeight)return;
    const dpr=Math.min(devicePixelRatio,1.3),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.uniform2f(u.size,r.width,r.height);gl.uniform2f(u.viewport,innerWidth,innerHeight);gl.uniform2f(u.origin,r.left,r.top);gl.uniform1f(u.count,countRef.current);
    try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.drawArrays(gl.TRIANGLES,0,6);canvas.parentElement?.classList.add('glass-ready');}catch{dead=true;canvas.parentElement?.classList.remove('glass-ready');}
   };raf=requestAnimationFrame(draw);
  }catch{canvas.parentElement?.classList.remove('glass-ready');}
  const lost=e=>{e.preventDefault();dead=true;canvas.parentElement?.classList.remove('glass-ready');};canvas.addEventListener('webglcontextlost',lost);
  return()=>{dead=true;cancelAnimationFrame(raf);canvas.parentElement?.classList.remove('glass-ready');canvas.removeEventListener('webglcontextlost',lost);shaders.forEach(s=>gl.deleteShader(s));if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();};
 },[]);
 return <canvas ref={ref} className="radial-glass-canvas" aria-hidden="true"/>;
}
