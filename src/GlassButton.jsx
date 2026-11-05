import React,{useEffect,useRef} from 'react';
// Capsule SDF and exponential edge/rim refraction adapted from dashersw/liquid-glass-js (MIT).
// Sample the existing ShaderGradient canvas directly; never screenshot the page.
const vertex=`attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.)*.5;gl_Position=vec4(p,0.,1.);}`;
const fragment=`precision mediump float;
uniform sampler2D image; uniform vec2 size; uniform vec2 viewport; uniform vec2 origin; varying vec2 uv;
void main(){
 vec2 q=vec2(uv.x,1.-uv.y)*size; float r=size.y*.5;
 vec2 nearest=vec2(clamp(q.x,r,size.x-r),r);vec2 v=q-nearest;
 float len=length(v);vec2 normal=len>.01?v/len:vec2(0.,1.);
 float d=max(r-len,0.); float edge=exp(-d*.22); float rim=exp(-d*1.2);
 vec2 refraction=normal*(edge*15.+rim*9.);
 vec2 st=(origin+q+refraction)/viewport;st.y=1.-st.y;
 vec2 texel=1./viewport;vec3 c=vec3(0.);float total=0.;
 for(int x=-2;x<=2;x++){for(int y=-2;y<=2;y++){float w=exp(-float(x*x+y*y)/4.);c+=texture2D(image,st+vec2(float(x),float(y))*texel*2.).rgb*w;total+=w;}}
 c/=total;c=mix(c,vec3(.94,.96,1.),.14);
 float light=pow(max(dot(normal,normalize(vec2(-.6,-1.))),0.),2.);
 c+=rim*(.22+light*.45);c-=edge*.035;
 float mask=1.-smoothstep(r-1.,r+1.,len);gl_FragColor=vec4(c,mask);
}`;
export function GlassButton({children,onClick,disabled=false}){
 const ref=useRef();
 useEffect(()=>{
  const canvas=ref.current,gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});if(!gl)return;
  let raf=0,last=0,dead=false;const shaders=[];
  function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('shader');shaders.push(s);return s;}
  let program,texture,buffer;
  try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
   texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   const loc=Object.fromEntries(['size','viewport','origin'].map(n=>[n,gl.getUniformLocation(program,n)]));
   const draw=t=>{if(dead)return;raf=requestAnimationFrame(draw);if(document.hidden||t-last<80)return;last=t;const source=document.querySelector('#gradient canvas');if(!source||!source.width)return;
    const r=canvas.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const dpr=Math.min(devicePixelRatio,1.5);if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform2f(loc.size,r.width,r.height);gl.uniform2f(loc.viewport,innerWidth,innerHeight);gl.uniform2f(loc.origin,r.left,r.top);
    try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.drawArrays(gl.TRIANGLES,0,6);canvas.classList.add('ready');}catch{dead=true;canvas.classList.remove('ready');}
   };raf=requestAnimationFrame(draw);
  }catch{canvas.classList.remove('ready');}
  const lost=e=>{e.preventDefault();dead=true;canvas.classList.remove('ready');};canvas.addEventListener('webglcontextlost',lost);
  return()=>{dead=true;cancelAnimationFrame(raf);canvas.removeEventListener('webglcontextlost',lost);shaders.forEach(s=>gl.deleteShader(s));if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();};
 },[]);
 return <button className="liquid-button" onClick={onClick} disabled={disabled}><canvas ref={ref} aria-hidden="true"/><span>{children}</span></button>;
}
