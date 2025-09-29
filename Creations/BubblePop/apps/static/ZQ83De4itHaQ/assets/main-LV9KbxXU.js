(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function i(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=i(s);fetch(s.href,r)}})();class lt{constructor(){this.screenWidth=240}setupViewport(){let e=document.querySelector('meta[name="viewport"]');e||(e=document.createElement("meta"),e.name="viewport",document.head.appendChild(e)),e.content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"}}const ut=new lt;function X(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}function q(t,e){const i=new Float32Array(16);for(let n=0;n<4;n++){const s=t[n],r=t[n+4],a=t[n+8],l=t[n+12];i[n]=s*e[0]+r*e[1]+a*e[2]+l*e[3],i[n+4]=s*e[4]+r*e[5]+a*e[6]+l*e[7],i[n+8]=s*e[8]+r*e[9]+a*e[10]+l*e[11],i[n+12]=s*e[12]+r*e[13]+a*e[14]+l*e[15]}return i}function j(t,e,i,n){const s=1/Math.tan(t/2),r=1/(i-n),a=new Float32Array(16);return a[0]=s/e,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=s,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=(n+i)*r,a[11]=-1,a[12]=0,a[13]=0,a[14]=2*n*i*r,a[15]=0,a}function K(t,e){const[i,n,s]=e,r=t.slice(0);return r[12]=t[0]*i+t[4]*n+t[8]*s+t[12],r[13]=t[1]*i+t[5]*n+t[9]*s+t[13],r[14]=t[2]*i+t[6]*n+t[10]*s+t[14],r[15]=t[3]*i+t[7]*n+t[11]*s+t[15],r}ut.setupViewport();const c=document.getElementById("glcanvas"),o=c.getContext("webgl2",{antialias:!0,alpha:!0});o||console.error("WebGL2 not supported");function ft(){const t=Math.min(window.devicePixelRatio||1,2),e=Math.floor((c.clientWidth||window.innerWidth)*t),i=Math.floor((c.clientHeight||window.innerHeight)*t);(c.width!==e||c.height!==i)&&(c.width=e,c.height=i),o.viewport(0,0,c.width,c.height)}function dt(){c.style.width||(c.style.width="100vw"),c.style.height||(c.style.height="100vh"),c.style.display="block"}dt();function W(t,e,i){const n=t.createShader(e);return t.shaderSource(n,i),t.compileShader(n),t.getShaderParameter(n,t.COMPILE_STATUS)?n:(console.error(t.getShaderInfoLog(n)||"shader error"),t.deleteShader(n),null)}function pt(t,e,i){const n=W(t,t.VERTEX_SHADER,e),s=W(t,t.FRAGMENT_SHADER,i),r=t.createProgram();return t.attachShader(r,n),t.attachShader(r,s),t.linkProgram(r),t.getProgramParameter(r,t.LINK_STATUS)?r:(console.error(t.getProgramInfoLog(r)||"link error"),t.deleteProgram(r),null)}function ht(t=24,e=16,i=.5){const n=[],s=[],r=[];for(let l=0;l<=e;l++){const u=l/e*Math.PI,f=Math.sin(u),h=Math.cos(u);for(let m=0;m<=t;m++){const L=m/t*Math.PI*2,N=Math.sin(L),M=Math.cos(L)*f,P=h,w=N*f;n.push(M*i,P*i,w*i),s.push(M,P,w)}}const a=t+1;for(let l=0;l<e;l++)for(let d=0;d<t;d++){const u=l*a+d,f=u+1,h=u+a,m=h+1;r.push(u,h,f,f,h,m)}return{positions:new Float32Array(n),normals:new Float32Array(s),indices:new Uint32Array(r)}}const A=10,b=10,z=A*b,mt=z*2,v=new Uint32Array(4);function Z(t,e){const i=t>>>5,n=t&31;v[i]|=1<<n}function $(t){const e=t>>>5,i=t&31;return(v[e]>>>i&1)!==0}function J(){v[0]=0,v[1]=0,v[2]=0,v[3]=0}let _=null;function gt(){if(!_)try{_=new(window.AudioContext||window.webkitAudioContext)}catch{}}function Q(){if(!_)return;const t=_.currentTime,e=_.createOscillator(),i=_.createGain();e.type="triangle",e.frequency.setValueAtTime(520,t),e.frequency.exponentialRampToValueAtTime(120,t+.08),i.gain.setValueAtTime(1e-4,t),i.gain.exponentialRampToValueAtTime(.35,t+.01),i.gain.exponentialRampToValueAtTime(1e-4,t+.12),e.connect(i).connect(_.destination),e.start(t),e.stop(t+.14)}const _t=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;

uniform mat4 u_vp;
uniform vec2 u_gridOrigin;     // world-space origin of grid center
uniform vec2 u_cellSize;       // x,y cell spacing
uniform int u_gridCols;
uniform int u_gridRows;
uniform float u_bubbleRadius;
uniform float u_scrollT;       // 0..gridHeight, when >0 draw incoming grid
uniform vec3 u_lightDir;
uniform uvec4 u_state;         // 128 bits -> 4*32

out vec3 v_normal;
out float v_visible;
out float v_ndl;
out float v_edge;
out float v_popped;

// Read pop bit for instance index [0..99]
bool isPopped(uint idx) {
  uint word = idx >> 5u;
  uint bit = idx & 31u;
  uint mask = uint(1) << bit;
  if (word == 0u) return (u_state.x & mask) != 0u;
  if (word == 1u) return (u_state.y & mask) != 0u;
  if (word == 2u) return (u_state.z & mask) != 0u;
  return (u_state.w & mask) != 0u;
}

void main(){
  // Determine which grid: 0=active, 1=incoming
  int gridIdx = gl_InstanceID / ${z};
  int localIdx = gl_InstanceID - gridIdx * ${z};
  int col = int(mod(float(localIdx), float(u_gridCols)));
  int row = localIdx / u_gridCols;

  // Compute base position
  // Staggered hex packing: every other row is offset by half a cell in X
  float rowParity = mod(float(row), 2.0);
  float gx = (float(col) - float(u_gridCols-1) * 0.5) * u_cellSize.x + u_gridOrigin.x + rowParity * 0.5 * u_cellSize.x;
  float gy = (float(row) - float(u_gridRows-1) * 0.5) * u_cellSize.y + u_gridOrigin.y;

  float gridHeight = float(u_gridRows) * u_cellSize.y;
  float yOffset = 0.0;
  if (gridIdx == 0) {
    yOffset = -u_scrollT; // active grid moves down
  } else {
    yOffset = gridHeight - u_scrollT; // incoming grid from top
  }

  bool popped = (gridIdx == 0) ? isPopped(uint(localIdx)) : false;

  // Start from sphere but keep only front hemisphere and flatten depth (dome)
  vec3 pos = a_position;
  pos.z = max(0.0, pos.z);
  float flatten = 0.3; // 1.0 = sphere, smaller = flatter dome
  pos.z *= flatten;
  // Apply scale to normals for non-uniform scaling
  vec3 nrm = a_normal;
  nrm.z *= (1.0/flatten);
  nrm = normalize(nrm);
  // Full-surface wrinkles using spherical direction and multiple octaves
  vec3 sp = normalize(a_position * 2.0);
  float w = 0.0;
  w += sin(sp.x * 48.0) * 0.6;
  w += sin(sp.y * 44.0) * 0.6;
  w += sin(sp.z * 40.0) * 0.6;
  w += sin((sp.x + sp.y) * 36.0) * 0.4;
  w += sin((sp.y + sp.z) * 32.0) * 0.3;
  float wrinkle = 0.02 * w;
  pos += nrm * wrinkle;
  // Apply bubble radius with popped flattening
  float heightScale = popped ? 0.03 : 1.0;
  pos.xy *= u_bubbleRadius;
  pos.z  *= (u_bubbleRadius * heightScale);

  vec3 worldPos = vec3(gx, gy + yOffset, 0.0) + pos;
  gl_Position = u_vp * vec4(worldPos, 1.0);

  // Lighting
  vec3 N = normalize(nrm);
  vec3 L = normalize(-u_lightDir);
  v_ndl = max(0.0, dot(N, L));
  v_normal = N;
  v_visible = 1.0; // keep visible; popped handled via flatten/alpha
  // Edge factor (for slight alpha tweak in fragment)
  float rim = 1.0 - clamp(abs(nrm.z), 0.0, 1.0);
  v_edge = rim;
  v_popped = popped ? 1.0 : 0.0;
}
`,vt=`#version 300 es
precision highp float;
in vec3 v_normal;
in float v_visible;
in float v_ndl;
in float v_edge;
in float v_popped;
out vec4 outColor;

void main(){
  if (v_visible <= 0.0) discard;
  // Simple plastic-like shading
  vec3 base = mix(vec3(0.78, 0.84, 0.90), vec3(0.85, 0.93, 0.98), 1.0 - step(0.5, v_popped));
  vec3 color = base * (0.25 + 0.75 * v_ndl);
  float alpha = mix(0.18, 0.62 + 0.18 * (1.0 - v_edge), 1.0 - step(0.5, v_popped));
  outColor = vec4(color, alpha);
}
`,g=pt(o,_t,vt);o.useProgram(g);const D=ht(24,16,.5),tt=o.createVertexArray();o.bindVertexArray(tt);const wt=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,wt);o.bufferData(o.ARRAY_BUFFER,D.positions,o.STATIC_DRAW);o.enableVertexAttribArray(0);o.vertexAttribPointer(0,3,o.FLOAT,!1,0,0);const yt=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,yt);o.bufferData(o.ARRAY_BUFFER,D.normals,o.STATIC_DRAW);o.enableVertexAttribArray(1);o.vertexAttribPointer(1,3,o.FLOAT,!1,0,0);const At=o.createBuffer();o.bindBuffer(o.ELEMENT_ARRAY_BUFFER,At);o.bufferData(o.ELEMENT_ARRAY_BUFFER,D.indices,o.STATIC_DRAW);const xt=o.getUniformLocation(g,"u_vp"),bt=o.getUniformLocation(g,"u_gridOrigin"),Rt=o.getUniformLocation(g,"u_cellSize"),St=o.getUniformLocation(g,"u_gridCols"),Tt=o.getUniformLocation(g,"u_gridRows"),It=o.getUniformLocation(g,"u_bubbleRadius"),Lt=o.getUniformLocation(g,"u_scrollT"),Mt=o.getUniformLocation(g,"u_lightDir"),Pt=o.getUniformLocation(g,"u_state[0]");o.enable(o.DEPTH_TEST);o.clearColor(.02,.02,.035,1);o.enable(o.BLEND);o.blendFunc(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA);let et=.75,T=1.2,I=1.2,H=0,Y=0,S=0,E=!1;const Et=6;J();let O=0,B=!1;function ot(t,e){const i=c.getBoundingClientRect(),n=(t-i.left)*(c.width/i.width),s=(e-i.top)*(c.height/i.height),r=c.width/Math.max(1,c.height),a=j(Math.PI/3,r,.05,100);let l=X();l=K(l,[0,0,-6]),q(a,l);function d(rt,st){const V=Math.tan(Math.PI/3/2),at=rt*V*6*r,ct=st*V*6;return[at,ct]}const u=n/c.width*2-1,f=1-s/c.height*2,h=d(u,f),m=h[0],L=h[1]+S-Y,N=m-H,R=Math.round(L/I+(b-1)*.5);if(R<0||R>=b)return-1;const M=R&1,P=N-(M?.5*T:0),w=Math.round(P/T+(A-1)*.5);return w<0||w>=A?-1:R*A+w}c.addEventListener("pointerdown",t=>{B=!0,gt();const e=ot(t.clientX,t.clientY);e>=0&&!$(e)&&(Z(e),O++,Q())});c.addEventListener("pointermove",t=>{if(!B)return;const e=ot(t.clientX,t.clientY);e>=0&&!$(e)&&(Z(e),O++,Q())});c.addEventListener("pointerup",()=>B=!1);c.addEventListener("pointercancel",()=>B=!1);function Ct(){const t=c.width/Math.max(1,c.height),e=6,i=Math.PI/3,n=2*Math.tan(i/2)*e,s=n*t,r=.4,a=s-r*2,l=n-r*2,d=a/(A-.5),u=d*.8660254,f=l/(b-1);T=Math.min(d,f),I=Math.min(u,f);const m=.5*T,U=.5*I;et=Math.min(m,U),H=0,Y=0}let k=performance.now(),p=new Float32Array([.3,.8,.5]),x=new Float32Array([.3,.8,.5]),y=new Float32Array([.3,.8,.5]),F=!1,nt=!1;function C(t=60){var e;try{const i=(e=window==null?void 0:window.creationSensors)==null?void 0:e.accelerometer;if(i&&typeof i.start=="function")return i.start(n=>{if(!n)return;const s=typeof n.tiltX=="number"?n.tiltX:typeof n.x=="number"?n.x:0,r=typeof n.tiltY=="number"?n.tiltY:typeof n.y=="number"?n.y:-1,a=typeof n.tiltZ=="number"?n.tiltZ:typeof n.z=="number"?n.z:0;let l=s,d=-r+.6,u=-a+.2;const f=Math.hypot(l,d,u)||1;l/=f,d/=f,u/=f,x[0]=l,x[1]=d,x[2]=u,F=!0,nt=!0},{frequency:t}),!0}catch{}return!1}var G;try{const t=(G=window==null?void 0:window.creationSensors)==null?void 0:G.accelerometer;t&&(typeof t.isAvailable=="function"?t.isAvailable().then(s=>{s&&C(60)}).catch(()=>{}):C(60));let e=0;const i=40,n=setInterval(()=>{var s;if(nt){clearInterval(n);return}try{const r=(s=window==null?void 0:window.creationSensors)==null?void 0:s.accelerometer;r&&(typeof r.isAvailable=="function"?r.isAvailable().then(a=>{a&&C(60)}).catch(()=>{}):C(60))}catch{}e++,e>=i&&clearInterval(n)},300)}catch{}function it(t){ft(),Ct();const e=Math.min(.05,Math.max(.001,(t-k)*.001));if(k=t,!E&&O>=z&&(E=!0),E){const m=b*I;S+=Et*e,S>=m&&(S=0,E=!1,J(),O=0)}o.clear(o.COLOR_BUFFER_BIT|o.DEPTH_BUFFER_BIT);const i=c.width/Math.max(1,c.height),n=j(Math.PI/3,i,.05,100);let s=X();s=K(s,[0,0,-6]);const r=q(n,s),a=.35,l=7;let d=F?x[0]:y[0],u=F?x[1]:y[1],f=F?x[2]:y[2];d+=(y[0]-d)*Math.min(1,a*e),u+=(y[1]-u)*Math.min(1,a*e),f+=(y[2]-f)*Math.min(1,a*e),p[0]+=(d-p[0])*Math.min(1,l*e),p[1]+=(u-p[1])*Math.min(1,l*e),p[2]+=(f-p[2])*Math.min(1,l*e);const h=Math.hypot(p[0],p[1],p[2])||1;p[0]/=h,p[1]/=h,p[2]/=h,o.useProgram(g),o.uniformMatrix4fv(xt,!1,r),o.uniform2f(bt,H,Y),o.uniform2f(Rt,T,I),o.uniform1i(St,A),o.uniform1i(Tt,b),o.uniform1f(It,et),o.uniform1f(Lt,S),o.uniform3f(Mt,p[0],p[1],p[2]),o.uniform1uiv(Pt,v),o.bindVertexArray(tt),o.drawElementsInstanced(o.TRIANGLES,D.indices.length,o.UNSIGNED_INT,0,mt),requestAnimationFrame(it)}requestAnimationFrame(it);
