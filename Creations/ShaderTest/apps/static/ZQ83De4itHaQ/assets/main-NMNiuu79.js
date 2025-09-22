(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const a of i.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&r(a)}).observe(document,{childList:!0,subtree:!0});function o(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function r(n){if(n.ep)return;n.ep=!0;const i=o(n);fetch(n.href,i)}})();class T{constructor(){this.sideButtonEnabled=!0,this.scrollWheelEnabled=!0,this.eventListeners=new Map}init(e={}){this.sideButtonEnabled=e.sideButtonEnabled??!0,this.scrollWheelEnabled=e.scrollWheelEnabled??!0,this.sideButtonEnabled&&this.setupSideButtonListener(),this.scrollWheelEnabled&&this.setupScrollWheelListener(),e.keyboardFallback!==!1&&this.setupKeyboardFallback()}setupSideButtonListener(){window.addEventListener("sideClick",e=>{this.sideButtonEnabled&&this.handleSideButtonClick(e)})}setupScrollWheelListener(){window.addEventListener("scrollUp",e=>{this.scrollWheelEnabled&&this.handleScrollWheel({direction:"up",event:e})}),window.addEventListener("scrollDown",e=>{this.scrollWheelEnabled&&this.handleScrollWheel({direction:"down",event:e})})}setupKeyboardFallback(){window.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();const o=new CustomEvent("sideClick",{detail:{source:"keyboard"}});window.dispatchEvent(o)}})}handleSideButtonClick(e){(this.eventListeners.get("sideButton")||[]).forEach(r=>r(e))}handleScrollWheel(e){(this.eventListeners.get("scrollWheel")||[]).forEach(r=>r({direction:e.direction,event:e.event}))}on(e,o){this.eventListeners.has(e)||this.eventListeners.set(e,[]),this.eventListeners.get(e).push(o)}off(e,o){const r=this.eventListeners.get(e)||[],n=r.indexOf(o);n>-1&&r.splice(n,1)}}const I=new T;class O{constructor(){this.screenWidth=240}setupViewport(){let e=document.querySelector('meta[name="viewport"]');e||(e=document.createElement("meta"),e.name="viewport",document.head.appendChild(e)),e.content="width=240, height=320, initial-scale=1, maximum-scale=1, user-scalable=no"}}const A=new O;A.setupViewport();I.init();const c=document.getElementById("glcanvas"),s=c.getContext("webgl2",{antialias:!1});s||console.error("WebGL2 not supported");function b(t,e,o){const r=t.createShader(e);return t.shaderSource(r,o),t.compileShader(r),t.getShaderParameter(r,t.COMPILE_STATUS)?r:(console.error(t.getShaderInfoLog(r)||"Shader compile error"),t.deleteShader(r),null)}function R(t,e,o){const r=b(t,t.VERTEX_SHADER,e),n=b(t,t.FRAGMENT_SHADER,o),i=t.createProgram();return t.attachShader(i,r),t.attachShader(i,n),t.linkProgram(i),t.getProgramParameter(i,t.LINK_STATUS)?i:(console.error(t.getProgramInfoLog(i)||"Program link error"),t.deleteProgram(i),null)}const V=`#version 300 es
precision highp float;
void main(){
  // 3-vertex fullscreen triangle
  vec2 pos = vec2(
    (gl_VertexID == 0) ? -1.0 : (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 0) ? -1.0 : (gl_VertexID == 1) ? -1.0 : 3.0
  );
  gl_Position = vec4(pos, 0.0, 1.0);
}`,H=`#version 300 es
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
}`,u=R(s,V,H);s.useProgram(u);const U=s.getUniformLocation(u,"u_resolution"),N=s.getUniformLocation(u,"u_center"),X=s.getUniformLocation(u,"u_scale"),K=s.getUniformLocation(u,"u_maxIter");s.disable(s.DEPTH_TEST);s.clearColor(.03,.03,.05,1);function Y(){const t=Math.min(window.devicePixelRatio||1,2),e=Math.floor(c.clientWidth*t),o=Math.floor(c.clientHeight*t);(c.width!==e||c.height!==o)&&(c.width=e,c.height=o),s.viewport(0,0,c.width,c.height)}const l=document.createElement("div");l.style.position="fixed";l.style.left="8px";l.style.top="8px";l.style.padding="4px 6px";l.style.background="rgba(0,0,0,0.5)";l.style.color="#0f0";l.style.fontFamily="monospace";l.style.fontSize="12px";l.style.zIndex="1000";l.style.pointerEvents="none";document.body.appendChild(l);const q=1e3;let h=[],x=0,_=performance.now(),E=!1,y=-.75,w=0,d=Math.log(1.5),C=0,W=0,g=1;const G=800;let M=0;const $=.12,Q=6;I.on("scrollWheel",({direction:t})=>{const e=performance.now(),o=t==="up"?1:-1;o===W&&e-C<G?g=Math.min(Q,g+1):g=1,C=e,W=o,M+=o*g*$});function Z(t,e){const o=c.getBoundingClientRect(),r=(t-o.left)/Math.max(1,o.width),n=1-(e-o.top)/Math.max(1,o.height),i=Math.max(1,c.width),a=Math.max(1,c.height),S=i/a,f=Math.exp(d),m=f,p=f*S,v=y-p,D=y+p,L=w-m,k=w+m,B=v+(D-v)*r,F=L+(k-L)*n;y=B,w=F}c.addEventListener("pointerdown",t=>{t.preventDefault(),Z(t.clientX,t.clientY)},{passive:!1});function z(t){Y();const e=t-_;for(_=t,h.push(e),x+=e;x>q&&h.length>0;)x-=h.shift();if(h.length>0){const m=h.length,p=x/m,v=1e3/Math.max(1e-4,p);l.textContent=`fps ${v.toFixed(1)} | zoom ${(-d).toFixed(2)}`}const o=Math.max(0,Math.min(.1,e*.001)),r=Math.exp(-1.2*o);M*=r,d-=M*o;const a=Math.min(4,Math.max(1e-14,Math.exp(d)));d=Math.log(a),s.clear(s.COLOR_BUFFER_BIT);const S=Math.max(0,-d),f=Math.min(4096,Math.floor(100+60*S));s.useProgram(u),s.uniform2f(U,c.width,c.height),s.uniform2f(N,y,w),s.uniform1f(X,a),s.uniform1i(K,f),s.drawArrays(s.TRIANGLES,0,3),P()}function j(){c.style.width="240px",c.style.height="254px",c.style.display="block"}j();P();function P(){E?requestAnimationFrame(z):setTimeout(()=>z(performance.now()),0)}window.addEventListener("keydown",t=>{(t.key==="v"||t.key==="V")&&(E=!E)});
