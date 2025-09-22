(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function o(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(i){if(i.ep)return;i.ep=!0;const r=o(i);fetch(i.href,r)}})();class A{constructor(){this.sideButtonEnabled=!0,this.scrollWheelEnabled=!0,this.eventListeners=new Map}init(e={}){this.sideButtonEnabled=e.sideButtonEnabled??!0,this.scrollWheelEnabled=e.scrollWheelEnabled??!0,this.sideButtonEnabled&&this.setupSideButtonListener(),this.scrollWheelEnabled&&this.setupScrollWheelListener(),e.keyboardFallback!==!1&&this.setupKeyboardFallback()}setupSideButtonListener(){window.addEventListener("sideClick",e=>{this.sideButtonEnabled&&this.handleSideButtonClick(e)})}setupScrollWheelListener(){window.addEventListener("scrollUp",e=>{this.scrollWheelEnabled&&this.handleScrollWheel({direction:"up",event:e})}),window.addEventListener("scrollDown",e=>{this.scrollWheelEnabled&&this.handleScrollWheel({direction:"down",event:e})})}setupKeyboardFallback(){window.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();const o=new CustomEvent("sideClick",{detail:{source:"keyboard"}});window.dispatchEvent(o)}})}handleSideButtonClick(e){(this.eventListeners.get("sideButton")||[]).forEach(n=>n(e))}handleScrollWheel(e){(this.eventListeners.get("scrollWheel")||[]).forEach(n=>n({direction:e.direction,event:e.event}))}on(e,o){this.eventListeners.has(e)||this.eventListeners.set(e,[]),this.eventListeners.get(e).push(o)}off(e,o){const n=this.eventListeners.get(e)||[],i=n.indexOf(o);i>-1&&n.splice(i,1)}}const k=new A;class H{constructor(){this.screenWidth=240}setupViewport(){let e=document.querySelector('meta[name="viewport"]');e||(e=document.createElement("meta"),e.name="viewport",document.head.appendChild(e)),e.content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"}}const U=new H;U.setupViewport();k.init();const s=document.getElementById("glcanvas"),c=s.getContext("webgl2",{antialias:!1});c||console.error("WebGL2 not supported");function W(t,e,o){const n=t.createShader(e);return t.shaderSource(n,o),t.compileShader(n),t.getShaderParameter(n,t.COMPILE_STATUS)?n:(console.error(t.getShaderInfoLog(n)||"Shader compile error"),t.deleteShader(n),null)}function N(t,e,o){const n=W(t,t.VERTEX_SHADER,e),i=W(t,t.FRAGMENT_SHADER,o),r=t.createProgram();return t.attachShader(r,n),t.attachShader(r,i),t.linkProgram(r),t.getProgramParameter(r,t.LINK_STATUS)?r:(console.error(t.getProgramInfoLog(r)||"Program link error"),t.deleteProgram(r),null)}const X=`#version 300 es
precision highp float;
void main(){
  // 3-vertex fullscreen triangle
  vec2 pos = vec2(
    (gl_VertexID == 0) ? -1.0 : (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 0) ? -1.0 : (gl_VertexID == 1) ? -1.0 : 3.0
  );
  gl_Position = vec4(pos, 0.0, 1.0);
}`,Y=`#version 300 es
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
}`,u=N(c,X,Y);c.useProgram(u);const K=c.getUniformLocation(u,"u_resolution"),q=c.getUniformLocation(u,"u_center"),G=c.getUniformLocation(u,"u_scale"),$=c.getUniformLocation(u,"u_maxIter");c.disable(c.DEPTH_TEST);c.clearColor(.03,.03,.05,1);function Q(){const t=Math.min(window.devicePixelRatio||1,2),e=Math.floor(s.clientWidth*t),o=Math.floor(s.clientHeight*t);(s.width!==e||s.height!==o)&&(s.width=e,s.height=o),c.viewport(0,0,s.width,s.height)}const l=document.createElement("div");l.style.position="fixed";l.style.left="8px";l.style.top="8px";l.style.padding="4px 6px";l.style.background="rgba(0,0,0,0.5)";l.style.color="#0f0";l.style.fontFamily="monospace";l.style.fontSize="12px";l.style.zIndex="1000";l.style.pointerEvents="none";document.body.appendChild(l);const j=1e3;let h=[],p=0,z=performance.now(),E=!1,v=-.75,x=0,d=Math.log(1.5),I=0,P=0,S=1;const J=2e3;let L=0;k.on("scrollWheel",({direction:t})=>{const e=performance.now(),o=t==="up"?1:-1;o===P&&e-I<J?S+=1:S=1,I=e,P=o,L+=o*S});function B(t,e){const o=s.getBoundingClientRect(),n=Math.min(window.devicePixelRatio||1,2),i=(t-o.left)*n,r=(e-o.top)*n,a=Math.max(1,s.width),f=Math.max(1,s.height),g=i/a,y=1-r/f,w=a/f,m=Math.exp(d),b=m,_=m*w,C=v-_,T=v+_,M=x-b,R=x+b,O=C+(T-C)*g,V=M+(R-M)*y;v=O,x=V}s.addEventListener("pointerdown",t=>{t.preventDefault(),B(t.clientX,t.clientY)});s.addEventListener("touchstart",t=>{if(t.touches&&t.touches.length>0){t.preventDefault();const e=t.touches[0];B(e.clientX,e.clientY)}},{passive:!1});function D(t){Q();const e=t-z;for(z=t,h.push(e),p+=e;p>j&&h.length>0;)p-=h.shift();if(h.length>0){const y=h.length,w=p/y,m=1e3/Math.max(1e-4,w);l.textContent=`fps ${m.toFixed(1)} | zoom ${(-d).toFixed(2)}`}const o=Math.max(0,Math.min(.1,e*.001)),n=Math.exp(-.4*o);L*=n,d-=L*o;const a=Math.min(4,Math.max(1e-14,Math.exp(d)));d=Math.log(a),c.clear(c.COLOR_BUFFER_BIT);const f=Math.max(0,-d),g=Math.min(4096,Math.floor(100+60*f));c.useProgram(u),c.uniform2f(K,s.width,s.height),c.uniform2f(q,v,x),c.uniform1f(G,a),c.uniform1i($,g),c.drawArrays(c.TRIANGLES,0,3),F()}function Z(){s.style.width||(s.style.width="100vw"),s.style.height||(s.style.height="100vh"),s.style.display="block"}Z();F();function F(){E?requestAnimationFrame(D):setTimeout(()=>D(performance.now()),0)}window.addEventListener("keydown",t=>{(t.key==="v"||t.key==="V")&&(E=!E)});
