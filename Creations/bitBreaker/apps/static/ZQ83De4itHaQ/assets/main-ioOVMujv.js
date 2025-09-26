(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&r(a)}).observe(document,{childList:!0,subtree:!0});function i(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(s){if(s.ep)return;s.ep=!0;const o=i(s);fetch(s.href,o)}})();class Ne{constructor(){this.sideButtonEnabled=!0,this.scrollWheelEnabled=!0,this.eventListeners=new Map}init(t={}){this.sideButtonEnabled=t.sideButtonEnabled??!0,this.scrollWheelEnabled=t.scrollWheelEnabled??!0,this.sideButtonEnabled&&this.setupSideButtonListener(),this.scrollWheelEnabled&&this.setupScrollWheelListener(),t.keyboardFallback!==!1&&this.setupKeyboardFallback()}setupSideButtonListener(){window.addEventListener("sideClick",t=>{this.sideButtonEnabled&&this.handleSideButtonClick(t)})}setupScrollWheelListener(){window.addEventListener("scrollUp",t=>{this.scrollWheelEnabled&&this.handleScrollWheel({direction:"up",event:t})}),window.addEventListener("scrollDown",t=>{this.scrollWheelEnabled&&this.handleScrollWheel({direction:"down",event:t})})}setupKeyboardFallback(){window.addEventListener("keydown",t=>{if(t.code==="Space"){t.preventDefault();const i=new CustomEvent("sideClick",{detail:{source:"keyboard"}});window.dispatchEvent(i)}})}handleSideButtonClick(t){(this.eventListeners.get("sideButton")||[]).forEach(r=>r(t))}handleScrollWheel(t){(this.eventListeners.get("scrollWheel")||[]).forEach(r=>r({direction:t.direction,event:t.event}))}on(t,i){this.eventListeners.has(t)||this.eventListeners.set(t,[]),this.eventListeners.get(t).push(i)}off(t,i){const r=this.eventListeners.get(t)||[],s=r.indexOf(i);s>-1&&r.splice(s,1)}}const De=new Ne;class He{constructor(){this.screenWidth=240}setupViewport(){let t=document.querySelector('meta[name="viewport"]');t||(t=document.createElement("meta"),t.name="viewport",document.head.appendChild(t)),t.content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"}}const ze=new He;ze.setupViewport();De.init();const d=document.getElementById("glcanvas"),e=d.getContext("webgl2",{antialias:!0});e||console.error("WebGL2 not supported");const P=240,Y=320;function _e(n,t,i){const r=n.createShader(t);return n.shaderSource(r,i),n.compileShader(r),n.getShaderParameter(r,n.COMPILE_STATUS)?r:(console.error(n.getShaderInfoLog(r)||"Shader compile error"),n.deleteShader(r),null)}function pe(n,t,i){const r=_e(n,n.VERTEX_SHADER,t),s=_e(n,n.FRAGMENT_SHADER,i),o=n.createProgram();return n.attachShader(o,r),n.attachShader(o,s),n.linkProgram(o),n.getProgramParameter(o,n.LINK_STATUS)?o:(console.error(n.getProgramInfoLog(o)||"Program link error"),n.deleteProgram(o),null)}const Ve=`#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;       // unit quad verts [-0.5,0.5]
layout(location=1) in vec2 a_instPos;   // world center
layout(location=2) in vec2 a_instSize;  // world size
layout(location=3) in vec4 a_color;     // base color
layout(location=4) in vec2 a_params;    // x: seed, y: damage [0,1]
uniform vec2 u_worldSize;
out vec4 v_color;
out vec2 v_uv;        // local 0..1
out vec2 v_params;    // seed, damage
void main(){
  vec2 world = a_instPos + a_pos * a_instSize;
  vec2 ndc = (world / u_worldSize) * 2.0 - 1.0;
  ndc.y = -ndc.y; // flip Y to screen coords
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_color = a_color;
  v_uv = a_pos * 0.5 + 0.5;
  v_params = a_params;
}`,Ge=`#version 300 es
precision highp float;
in vec4 v_color;
in vec2 v_uv;
in vec2 v_params; // seed, damage
out vec4 outColor;

// Hash helpers
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
vec2 hash21(float p) {
  float n = hash11(p);
  return vec2(hash11(n + 1.2345), hash11(n + 6.5432));
}

// Simple Voronoi crack mask using F2-F1 metric
float crackMask(vec2 uv, float seed, float damage) {
  // cell count scales with damage (more cracks over time)
  float cells = mix(6.0, 18.0, clamp(damage, 0.0, 1.0));
  vec2 p = uv * cells;
  vec2 pi = floor(p);
  vec2 pf = fract(p);
  float f1 = 1e9, f2 = 1e9;
  for (int j=-1;j<=1;j++){
    for (int i=-1;i<=1;i++){
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash21(dot(pi+g, vec2(127.1,311.7))+seed*91.7) - 0.5;
      vec2 d = g + o + 0.5 - pf;
      float dist = dot(d,d);
      if (dist < f1) { f2 = f1; f1 = dist; }
      else if (dist < f2) { f2 = dist; }
    }
  }
  float edge = abs(f2 - f1);
  float thickness = mix(0.01, 0.08, damage);
  float m = smoothstep(thickness, thickness*0.5, edge);
  return m;
}

void main(){
  float seed = v_params.x;
  float damage = clamp(v_params.y, 0.0, 1.0);
  float cracks = crackMask(clamp(v_uv, 0.0, 1.0), seed, damage);
  vec3 base = v_color.rgb;
  vec3 crackCol = vec3(0.02,0.02,0.02);
  vec3 col = mix(base, crackCol, cracks);
  outColor = vec4(col, 1.0);
}`,ve=pe(e,Ve,Ge);e.useProgram(ve);const Q=e.createTexture(),Le=e.createFramebuffer(),le=e.createTexture(),Me=e.createFramebuffer();let K=0,j=0;function Re(n,t,i){e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t,i,0,e.RGBA,e.UNSIGNED_BYTE,null)}function Ke(){K===d.width&&j===d.height||(K=d.width,j=d.height,Re(Q,K,j),e.bindFramebuffer(e.FRAMEBUFFER,Le),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Q,0),Re(le,K,j),e.bindFramebuffer(e.FRAMEBUFFER,Me),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,le,0),e.bindFramebuffer(e.FRAMEBUFFER,null))}const Ue=`#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,je=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_dir;       // (1,0) or (0,1)
uniform float u_threshold; // >=0 to apply bright-pass; <0 to skip
void main(){
  vec2 texel = 1.0 / vec2(textureSize(u_tex, 0));
  float w[9];
  w[0]=0.05; w[1]=0.07; w[2]=0.1; w[3]=0.13; w[4]=0.2; w[5]=0.13; w[6]=0.1; w[7]=0.07; w[8]=0.05;
  vec3 sum = vec3(0.0);
  int k = 0;
  for (int i=-4;i<=4;i++){
    vec2 uv = v_uv + float(i) * texel * u_dir * 2.0; // widen radius
    vec3 s = texture(u_tex, uv).rgb;
    if (u_threshold >= 0.0) {
      float b = max(0.0, max(max(s.r, s.g), s.b) - u_threshold);
      s *= b;
    }
    sum += s * w[k++];
  }
  outColor = vec4(sum, 1.0);
}`,qe=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_scene;
uniform sampler2D u_blur;
uniform float u_bloom;
void main(){
  vec3 scene = texture(u_scene, v_uv).rgb;
  vec3 blur = texture(u_blur, v_uv).rgb;
  outColor = vec4(scene + blur * u_bloom, 1.0);
}`,ne=pe(e,Ue,je),$e=e.getUniformLocation(ne,"u_tex"),Ze=e.getUniformLocation(ne,"u_dir"),Je=e.getUniformLocation(ne,"u_threshold"),oe=pe(e,Ue,qe),Qe=e.getUniformLocation(oe,"u_scene"),et=e.getUniformLocation(oe,"u_blur"),tt=e.getUniformLocation(oe,"u_bloom"),ue=e.createVertexArray();e.bindVertexArray(ue);const nt=new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),ot=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,ot);e.bufferData(e.ARRAY_BUFFER,nt,e.STATIC_DRAW);e.enableVertexAttribArray(0);e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);const rt=new Float32Array([-.5,-.5,.5,-.5,.5,.5,-.5,-.5,.5,.5,-.5,.5]),ke=e.createVertexArray();e.bindVertexArray(ke);const it=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,it);e.bufferData(e.ARRAY_BUFFER,rt,e.STATIC_DRAW);e.enableVertexAttribArray(0);e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);const Pe=e.createBuffer(),Ce=e.createBuffer(),Se=e.createBuffer(),Ie=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,Pe);e.enableVertexAttribArray(1);e.vertexAttribPointer(1,2,e.FLOAT,!1,0,0);e.vertexAttribDivisor(1,1);e.bindBuffer(e.ARRAY_BUFFER,Ce);e.enableVertexAttribArray(2);e.vertexAttribPointer(2,2,e.FLOAT,!1,0,0);e.vertexAttribDivisor(2,1);e.bindBuffer(e.ARRAY_BUFFER,Se);e.enableVertexAttribArray(3);e.vertexAttribPointer(3,4,e.FLOAT,!1,0,0);e.vertexAttribDivisor(3,1);e.bindBuffer(e.ARRAY_BUFFER,Ie);e.enableVertexAttribArray(4);e.vertexAttribPointer(4,2,e.FLOAT,!1,0,0);e.vertexAttribDivisor(4,1);const st=e.getUniformLocation(ve,"u_worldSize");e.disable(e.DEPTH_TEST);e.clearColor(.02,.02,.03,1);function at(){const n=Math.min(window.devicePixelRatio||1,2),t=Math.floor(d.clientWidth*n),i=Math.floor(d.clientHeight*n);(d.width!==t||d.height!==i)&&(d.width=t,d.height=i),e.viewport(0,0,d.width,d.height)}let N=2654435769,H=608135816;function be(n){N=(n^2654435769)>>>0,H=n*1664525+1013904223>>>0}function xe(){let n=(H+=1831565813)>>>0,t=(N+=2246822507)>>>0;return n^=n>>>15,n=Math.imul(n,739982445),n^=n>>>12,n=Math.imul(n,695872825),n^=n>>>15,t^=t>>>15,t=Math.imul(t,739982445),t^=t>>>12,t=Math.imul(t,695872825),t^=t>>>15,((n^t)>>>0)/4294967295}const re=50,ie=30,W=28,z=6,y=4;let g=P*.5,S=Y-16,C=0;const ct=140,he=[],B=[];function lt(){return he.length>0?he.pop():{x:0,y:0,vx:0,vy:0}}function ut(n){he.push(n)}const fe=[],I=[];function ht(){return fe.length?fe.pop():{x:0,y:0,w:8,h:8,vy:30,type:0}}function Fe(n){fe.push(n)}const k=[];function ft(n,t,i){let r=(n|0)*374761393^(t|0)*668265263^(i|0);return r=(r^r>>>13)>>>0,r=Math.imul(r,1274126177)>>>0,(r>>>0)/4294967295}function se(n){return Math.floor(xe()*n)}let ee=12345,G=1,q=!1,w={bg:[.02,.02,.03],brick1:[.9,.4,.4],brick2:[.4,.9,.5],brick3:[.4,.6,.9],paddle:[1,1,1],ball:[1,1,.3]};function dt(n){k.length=0;const t=8,i=10,r=P-t*2,s=Y*.6,o=r/re,a=s/ie,v=t,m=i,u=16,F=10,{mask:T,width:c,height:R}=mt(u,F,n^666745);for(let b=0;b<ie;b++)for(let D=0;D<re;D++){const M=v+D*o+o*.5,U=m+b*a+a*.5,x=Math.max(0,Math.min(c-1,Math.floor((D+.5)/re*c))),h=Math.max(0,Math.min(R-1,Math.floor((b+.5)/ie*R))),p=T[h*c+x]===1,l=1+(D+b+(n&7))%3;k.push({x:M,y:U,w:o*.95,h:a*.9,hp:p?l:0,alive:p})}}function mt(n,t,i){const r=n*2+1,s=t*2+1,o=new Uint8Array(r*s);for(let h=0;h<r*s;h++)o[h]=1;const a=N,v=H;be(i);const m=new Uint8Array(n*t),u=[];function F(h,f){return f*n+h}function T(h,f){o[(f*2+1)*r+(h*2+1)]=0}function c(h,f,p,l){o[(f+l+1)*r+(h+p+1)]=0}let R=se(n),b=se(t);for(m[F(R,b)]=1,T(R,b),u.push([R,b]);u.length;){const h=u[u.length-1];R=h[0],b=h[1];const f=[[1,0],[-1,0],[0,1],[0,-1]];for(let l=f.length-1;l>0;l--){const E=se(l+1),L=f[l];f[l]=f[E],f[E]=L}let p=!1;for(let l=0;l<4;l++){const E=f[l][0],L=f[l][1],A=R+E,_=b+L;if(!(A<0||_<0||A>=n||_>=t)&&!m[F(A,_)]){m[F(A,_)]=1,T(A,_),c(R,b,A,_),u.push([A,_]),p=!0;break}}p||u.pop()}const D=0,M=0,U=n-1,x=t-1;return T(D,M),T(U,x),o[(M*2+1)*r+0]=0,o[(x*2+1)*r+(r-1)]=0,N=a,H=v,{mask:o,width:r,height:s}}function ye(n,t,i=120,r=-Math.PI/4){const s=lt();s.x=n,s.y=t,s.vx=Math.cos(r)*i,s.vy=Math.sin(r)*i,B.push(s)}function pt(n){for(let i=0;i<n&&B.length<5e3;i++){const r=-Math.PI*.75+xe()*(Math.PI*.5);ye(g,S-16,110,r)}}let te=3,de=!1;function V(n,t){G=n;const i=(ee^n*2654435769)>>>0;I.length=0,be(i),w=yt(i),dt(i),B.length=0,ye(g,S-20,120,-Math.PI*.6),t&&(te=3,de=!1)}class X{constructor(t,i,r,s,o=0,a=6,v=12){this.x=t,this.y=i,this.w=r,this.h=s,this.depth=o,this.maxDepth=a,this.cap=v,this.items=[],this.kids=null}insert(t){if(this.kids){this._insertIntoKids(t);return}this.items.push(t),this.items.length>this.cap&&this.depth<this.maxDepth&&this._split()}_split(){const t=this.w*.5,i=this.h*.5;this.kids=[new X(this.x,this.y,t,i,this.depth+1,this.maxDepth,this.cap),new X(this.x+t,this.y,t,i,this.depth+1,this.maxDepth,this.cap),new X(this.x,this.y+i,t,i,this.depth+1,this.maxDepth,this.cap),new X(this.x+t,this.y+i,t,i,this.depth+1,this.maxDepth,this.cap)];const r=this.items;this.items=[];for(let s=0;s<r.length;s++)this._insertIntoKids(r[s])}_insertIntoKids(t){for(let i=0;i<4;i++){const r=this.kids[i];t.rx1>r.x&&t.rx0<r.x+r.w&&t.ry1>r.y&&t.ry0<r.y+r.h&&r.insert(t)}}query(t,i,r,s,o){if(r<=this.x||t>=this.x+this.w||s<=this.y||i>=this.y+this.h)return o;for(let a=0;a<this.items.length;a++)o.push(this.items[a]);if(this.kids)for(let a=0;a<4;a++)this.kids[a].query(t,i,r,s,o);return o}}let me=null;function vt(){me=new X(0,0,P,Y);for(let n=0;n<k.length;n++){const t=k[n];t.alive&&me.insert({rx0:t.x-t.w*.5,ry0:t.y-t.h*.5,rx1:t.x+t.w*.5,ry1:t.y+t.h*.5,ref:n})}}function bt(n){Oe&&(C=0),g+=C*n;const t=Math.exp(-6*n);C*=t;const i=W*.5;g<i&&(g=i,C=Math.abs(C)),g>P-i&&(g=P-i,C=-Math.abs(C)),vt();for(let s=0;s<B.length;s++){const o=B[s];if(o.x+=o.vx*n,o.y+=o.vy*n,o.x<y*.5&&(o.x=y*.5,o.vx*=-1),o.x>P-y*.5&&(o.x=P-y*.5,o.vx*=-1),o.y<y*.5&&(o.y=y*.5,o.vy*=-1),o.y>Y+20){ut(o),B.splice(s,1),s--;continue}const a=g-W*.5,v=g+W*.5,m=S-z*.5,u=S+z*.5;if(o.x+y*.5>a&&o.x-y*.5<v&&o.y+y*.5>m&&o.y-y*.5<u){o.y=m-y*.5,o.vy=-Math.abs(o.vy);const F=(o.x-g)/(W*.5);o.vx=F*120}}for(let s=0;s<B.length;s++){const o=B[s],a=o.x-y*.5,v=o.x+y*.5,m=o.y-y*.5,u=o.y+y*.5,F=[];me.query(a,m,v,u,F);for(let T=0;T<F.length;T++){const c=k[F[T].ref];if(!c||!c.alive)continue;const R=c.x-c.w*.5,b=c.x+c.w*.5,D=c.y-c.h*.5,M=c.y+c.h*.5;if(v>R&&a<b&&u>D&&m<M){const U=v-R,x=b-a,h=u-D,f=M-m,p=Math.min(U,x),l=Math.min(h,f);if(p<l?(o.vx*=-1,o.x+=(U<x?-p:p)*.5*Math.sign(o.vx||1)):(o.vy*=-1,o.y+=(h<f?-l:l)*.5*Math.sign(o.vy||1)),c.hp-=1,Xe+=10,c.hp<=0&&(c.alive=!1,xe()<.6)){const E=ht();E.x=c.x,E.y=c.y,E.w=8,E.h=8,E.vy=40,E.type=1,I.push(E)}break}}}for(let s=0;s<I.length;s++){const o=I[s];if(o.y+=o.vy*n,o.y>Y+10){Fe(o),I.splice(s,1),s--;continue}const a=g-W*.5,v=g+W*.5,m=S-z*.5,u=S+z*.5;if(o.x+o.w*.5>a&&o.x-o.w*.5<v&&o.y+o.h*.5>m&&o.y-o.h*.5<u){pt(16),Fe(o),I.splice(s,1),s--;continue}}B.length===0&&!de&&(te-=1,te>0?ye(g,S-20,120,-Math.PI*.5):(de=!0,O&&Z&&J?(Z.textContent="Game Over",O.style.display="flex",J.style.display="inline-block",J.onclick=()=>{O.style.display="none",J.style.display="none",ee=Math.random()*1e9|0,V(1,!0)}):(ee=Math.random()*1e9|0,V(1,!0))));let r=0;for(let s=0;s<k.length;s++)k[s].alive&&r++;r===0&&!q&&(q=!0,O&&Z?(Z.textContent=`Level ${G} cleared!`,O.style.display="flex",setTimeout(()=>{O.style.display="none",q=!1,V(G+1,!1)},1e3)):(q=!1,V(G+1,!1)))}const Ee=[],ge=[],Ae=[],We=[];function $(n,t,i,r,s,o,a,v,m=0,u=0){Ee.push(n,t),ge.push(i,r),Ae.push(s,o,a,v),We.push(m,u)}function xt(){const n=new Float32Array(Ee),t=new Float32Array(ge),i=new Float32Array(Ae),r=new Float32Array(We);e.bindBuffer(e.ARRAY_BUFFER,Pe),e.bufferData(e.ARRAY_BUFFER,n,e.DYNAMIC_DRAW),e.bindBuffer(e.ARRAY_BUFFER,Ce),e.bufferData(e.ARRAY_BUFFER,t,e.DYNAMIC_DRAW),e.bindBuffer(e.ARRAY_BUFFER,Se),e.bufferData(e.ARRAY_BUFFER,i,e.DYNAMIC_DRAW),e.bindBuffer(e.ARRAY_BUFFER,Ie),e.bufferData(e.ARRAY_BUFFER,r,e.DYNAMIC_DRAW),e.drawArraysInstanced(e.TRIANGLES,0,6,n.length/2)}function yt(n){const t=N,i=H;be(n^3203338804);const r=.61803398875;let s=ft(1,2,n)*360%360;function o(R,b,D){const M=(R%360+360)%360/360,U=Math.min(1,Math.max(0,b)),x=D,h=Math.floor(M*6),f=M*6-h,p=x*(1-U),l=x*(1-f*U),E=x*(1-(1-f)*U);let L,A,_;switch(h%6){case 0:L=x,A=E,_=p;break;case 1:L=l,A=x,_=p;break;case 2:L=p,A=x,_=E;break;case 3:L=p,A=l,_=x;break;case 4:L=E,A=p,_=x;break;case 5:L=x,A=p,_=l;break}return[L,A,_]}function a(){return s=(s+r*360)%360,s}const v=o(s,.08,.06),m=o(a(),.85,.75),u=o(a(),.95,.78),F=o(a(),.9,.82),T=o(a(),.1,.98),c=o(a(),.3,.98);return N=t,H=i,{bg:v,brick1:m,brick2:u,brick3:F,paddle:T,ball:c}}const we=document.getElementById("hud"),Et=document.getElementById("menu"),O=document.getElementById("overlay"),ae=document.getElementById("seed-input"),ce=document.getElementById("btn-start"),Z=document.getElementById("overlay-text"),J=document.getElementById("btn-restart");let Oe=!0,Be=!1,Xe=0;ce==null||ce.addEventListener("click",()=>{ee=parseInt((ae==null?void 0:ae.value)||"12345",10)||12345,V(1,!0),Oe=!1,Et.style.display="none";const n=document.getElementById("glcanvas");n&&(n.style.visibility="visible"),Be||(Be=!0,requestAnimationFrame(Ye))});let Te=performance.now();function Ye(n){at(),Ke();const t=Math.min(.05,Math.max(0,(n-Te)*.001));Te=n,bt(t),e.bindFramebuffer(e.FRAMEBUFFER,Le),e.clear(e.COLOR_BUFFER_BIT),e.clearColor(w.bg[0],w.bg[1],w.bg[2],1),e.useProgram(ve),e.uniform2f(st,P,Y),e.bindVertexArray(ke),Ee.length=0,ge.length=0,Ae.length=0;for(let i=0;i<k.length;i++){const r=k[i];if(!r.alive)continue;const s=r.hp===1?w.brick1:r.hp===2?w.brick2:w.brick3,o=1-Math.max(0,Math.min(1,r.hp/3));$(r.x,r.y,r.w,r.h,s[0],s[1],s[2],1,i*13.37%1e3,o)}$(g,S,W,z,w.paddle[0],w.paddle[1],w.paddle[2],1);for(let i=0;i<B.length;i++){const r=B[i];$(r.x,r.y,y,y,w.ball[0],w.ball[1],w.ball[2],1)}for(let i=0;i<I.length;i++){const r=I[i];$(r.x,r.y,r.w,r.h,.2,1,.6,1)}xt(),e.bindFramebuffer(e.FRAMEBUFFER,Me),e.useProgram(ne),e.bindVertexArray(ue),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,Q),e.uniform1i($e,0),e.uniform2f(Ze,1,0),e.uniform1f(Je,.3),e.drawArrays(e.TRIANGLES,0,6),e.bindFramebuffer(e.FRAMEBUFFER,null),e.useProgram(oe),e.bindVertexArray(ue),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,Q),e.uniform1i(Qe,0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,le),e.uniform1i(et,1),e.uniform1f(tt,4),e.drawArrays(e.TRIANGLES,0,6),we&&(we.textContent=`Lvl ${G}  Lives ${te}  Balls ${B.length}  Score ${Xe}`),requestAnimationFrame(Ye)}De.on("scrollWheel",({direction:n})=>{C+=(n==="up"?-1:1)*ct});window.addEventListener("mousemove",n=>{const t=d.getBoundingClientRect();g=(n.clientX-t.left)/Math.max(1,t.width)*P});function gt(){d.style.width||(d.style.width="100vw"),d.style.height||(d.style.height="100vh"),d.style.display="block"}gt();window.BB_DEBUG={getStats:()=>({paddleX:g,balls:B.length,bricksAlive:k.reduce((n,t)=>n+(t.alive?1:0),0)})};
