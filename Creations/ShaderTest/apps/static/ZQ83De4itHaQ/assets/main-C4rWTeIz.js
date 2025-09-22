(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))s(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&s(a)}).observe(document,{childList:!0,subtree:!0});function o(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerPolicy&&(r.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?r.credentials="include":n.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(n){if(n.ep)return;n.ep=!0;const r=o(n);fetch(n.href,r)}})();class H{constructor(){this.sideButtonEnabled=!0,this.scrollWheelEnabled=!0,this.eventListeners=new Map}init(e={}){this.sideButtonEnabled=e.sideButtonEnabled??!0,this.scrollWheelEnabled=e.scrollWheelEnabled??!0,this.sideButtonEnabled&&this.setupSideButtonListener(),this.scrollWheelEnabled&&this.setupScrollWheelListener(),e.keyboardFallback!==!1&&this.setupKeyboardFallback()}setupSideButtonListener(){window.addEventListener("sideClick",e=>{this.sideButtonEnabled&&this.handleSideButtonClick(e)})}setupScrollWheelListener(){window.addEventListener("scrollUp",e=>{this.scrollWheelEnabled&&this.handleScrollWheel({direction:"up",event:e})}),window.addEventListener("scrollDown",e=>{this.scrollWheelEnabled&&this.handleScrollWheel({direction:"down",event:e})})}setupKeyboardFallback(){window.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();const o=new CustomEvent("sideClick",{detail:{source:"keyboard"}});window.dispatchEvent(o)}})}handleSideButtonClick(e){(this.eventListeners.get("sideButton")||[]).forEach(s=>s(e))}handleScrollWheel(e){(this.eventListeners.get("scrollWheel")||[]).forEach(s=>s({direction:e.direction,event:e.event}))}on(e,o){this.eventListeners.has(e)||this.eventListeners.set(e,[]),this.eventListeners.get(e).push(o)}off(e,o){const s=this.eventListeners.get(e)||[],n=s.indexOf(o);n>-1&&s.splice(n,1)}}const B=new H;class U{constructor(){this.screenWidth=240}setupViewport(){let e=document.querySelector('meta[name="viewport"]');e||(e=document.createElement("meta"),e.name="viewport",document.head.appendChild(e)),e.content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"}}const X=new U;X.setupViewport();B.init();const i=document.getElementById("glcanvas"),c=i.getContext("webgl2",{antialias:!1});c||console.error("WebGL2 not supported");function z(t,e,o){const s=t.createShader(e);return t.shaderSource(s,o),t.compileShader(s),t.getShaderParameter(s,t.COMPILE_STATUS)?s:(console.error(t.getShaderInfoLog(s)||"Shader compile error"),t.deleteShader(s),null)}function N(t,e,o){const s=z(t,t.VERTEX_SHADER,e),n=z(t,t.FRAGMENT_SHADER,o),r=t.createProgram();return t.attachShader(r,s),t.attachShader(r,n),t.linkProgram(r),t.getProgramParameter(r,t.LINK_STATUS)?r:(console.error(t.getProgramInfoLog(r)||"Program link error"),t.deleteProgram(r),null)}const Y=`#version 300 es
precision highp float;
void main(){
  // 3-vertex fullscreen triangle
  vec2 pos = vec2(
    (gl_VertexID == 0) ? -1.0 : (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 0) ? -1.0 : (gl_VertexID == 1) ? -1.0 : 3.0
  );
  gl_Position = vec4(pos, 0.0, 1.0);
}`,K=`#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 u_resolution;  // framebuffer size in pixels
uniform vec2 u_center;      // complex plane center (x,y)
uniform float u_scale;      // half-height in complex plane units
uniform int u_maxIter;      // iteration count

vec3 palette(float t){
  // IQ-like cosine palette
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return a + b * cos(6.28318 * (c * t + d));
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution; // [0,1]
  float aspect = u_resolution.x / max(1.0, u_resolution.y);
  float halfH = u_scale;
  float halfW = u_scale * aspect;
  vec2 minC = u_center + vec2(-halfW, -halfH);
  vec2 maxC = u_center + vec2( halfW,  halfH);
  vec2 c = mix(minC, maxC, uv);

  vec2 z = vec2(0.0);
  int i;
  for (i = 0; i < u_maxIter; i++) {
    // z = z^2 + c
    float x = z.x*z.x - z.y*z.y + c.x;
    float y = 2.0*z.x*z.y + c.y;
    z = vec2(x, y);
    if (dot(z, z) > 1024.0) break; // escape radius^2
  }

  if (i == u_maxIter) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // Smooth coloring
    float m2 = dot(z, z);
    float nu = log(log(max(1.000001, m2)) / 2.0) / log(2.0);
    float it = float(i) + 1.0 - nu;
    float t = it / float(u_maxIter);
    vec3 col = palette(t);
    outColor = vec4(col, 1.0);
  }
}`,h=N(c,Y,K);c.useProgram(h);const q=c.getUniformLocation(h,"u_resolution"),G=c.getUniformLocation(h,"u_center"),$=c.getUniformLocation(h,"u_scale"),Q=c.getUniformLocation(h,"u_maxIter");c.disable(c.DEPTH_TEST);c.clearColor(.03,.03,.05,1);function Z(){const t=Math.min(window.devicePixelRatio||1,2),e=Math.floor(i.clientWidth*t),o=Math.floor(i.clientHeight*t);(i.width!==e||i.height!==o)&&(i.width=e,i.height=o),c.viewport(0,0,i.width,i.height)}const l=document.createElement("div");l.style.position="fixed";l.style.left="8px";l.style.top="8px";l.style.padding="4px 6px";l.style.background="rgba(0,0,0,0.5)";l.style.color="#0f0";l.style.fontFamily="monospace";l.style.fontSize="12px";l.style.zIndex="1000";l.style.pointerEvents="none";document.body.appendChild(l);const j=1e3;let u=[],p=0,I=performance.now(),E=!1,g=-.75,x=0,d=Math.log(1.5),P=0,D=0,v=1;const J=800;let L=0;const ee=.12,te=6;B.on("scrollWheel",({direction:t})=>{const e=performance.now(),o=t==="up"?1:-1;o===D&&e-P<J?v=Math.min(te,v+1):v=1,P=e,D=o,L+=o*v*ee});function F(t,e){const o=i.getBoundingClientRect(),s=i.width/Math.max(1,o.width),n=i.height/Math.max(1,o.height),r=(t-o.left)*s+.5,a=(e-o.top)*n+.5,f=Math.max(1,i.width),m=Math.max(1,i.height),y=r/f,w=1-a/m,S=f/m,M=Math.exp(d),b=M,_=M*S,C=g-_,O=g+_,W=x-b,A=x+b,R=C+(O-C)*y,V=W+(A-W)*w;g=R,x=V}i.addEventListener("pointerdown",t=>{t.preventDefault(),F(t.clientX,t.clientY)});i.addEventListener("touchstart",t=>{if(t.touches&&t.touches.length>0){t.preventDefault();const e=t.touches[0];F(e.clientX,e.clientY)}},{passive:!1});function k(t){Z();const e=t-I;for(I=t,u.push(e),p+=e;p>j&&u.length>0;)p-=u.shift();if(u.length>0){const y=u.length,w=p/y,S=1e3/Math.max(1e-4,w);l.textContent=`fps ${S.toFixed(1)} | zoom ${(-d).toFixed(2)}`}const o=Math.max(0,Math.min(.1,e*.001)),s=Math.exp(-1.2*o);L*=s,d-=L*o;const a=Math.min(4,Math.max(1e-14,Math.exp(d)));d=Math.log(a),c.clear(c.COLOR_BUFFER_BIT);const f=Math.max(0,-d),m=Math.min(4096,Math.floor(100+60*f));c.useProgram(h),c.uniform2f(q,i.width,i.height),c.uniform2f(G,g,x),c.uniform1f($,a),c.uniform1i(Q,m),c.drawArrays(c.TRIANGLES,0,3),T()}function oe(){i.style.width||(i.style.width="100vw"),i.style.height||(i.style.height="100vh"),i.style.display="block"}oe();T();function T(){E?requestAnimationFrame(k):setTimeout(()=>k(performance.now()),0)}window.addEventListener("keydown",t=>{(t.key==="v"||t.key==="V")&&(E=!E)});
