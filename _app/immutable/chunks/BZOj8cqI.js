import{$ as O,a0 as ne,a1 as ae,a2 as P,a3 as ie,W as y,a4 as S,a5 as _,M as g,c as C,a6 as te,a7 as fe,i as se,a8 as J,y as A,m as Q,a9 as X,aa as ue,ab as le,l as ce,k as K,ac as $,w as B,ad as F,n as k,ae as de,af as oe,C as M,ag as ve,Y as ee,B as G,ah as _e,d as be,ai as he,aj as ye,ak as ge,al as we,am as Pe,an as pe,a as H,ao as Re,G as Ee,ap as Ie,aq as Oe,V as re,O as V,ar as Se,as as me,at as x}from"./CZyTQF_d.js";import{s as Te,g as Ne}from"./CovUXKMJ.js";function I(e,r=null,t){if(typeof e!="object"||e===null||O in e)return e;const n=fe(e);if(n!==ne&&n!==ae)return e;var a=new Map,u=se(e),b=P(0);u&&a.set("length",P(e.length));var w;return new Proxy(e,{defineProperty(c,i,f){(!("value"in f)||f.configurable===!1||f.enumerable===!1||f.writable===!1)&&ie();var l=a.get(i);return l===void 0?(l=P(f.value),a.set(i,l)):y(l,I(f.value,w)),!0},deleteProperty(c,i){var f=a.get(i);if(f===void 0)i in c&&a.set(i,P(_));else{if(u&&typeof i=="string"){var l=a.get("length"),s=Number(i);Number.isInteger(s)&&s<l.v&&y(l,s)}y(f,_),Z(b)}return!0},get(c,i,f){var v;if(i===O)return e;var l=a.get(i),s=i in c;if(l===void 0&&(!s||(v=S(c,i))!=null&&v.writable)&&(l=P(I(s?c[i]:_,w)),a.set(i,l)),l!==void 0){var d=g(l);return d===_?void 0:d}return Reflect.get(c,i,f)},getOwnPropertyDescriptor(c,i){var f=Reflect.getOwnPropertyDescriptor(c,i);if(f&&"value"in f){var l=a.get(i);l&&(f.value=g(l))}else if(f===void 0){var s=a.get(i),d=s==null?void 0:s.v;if(s!==void 0&&d!==_)return{enumerable:!0,configurable:!0,value:d,writable:!0}}return f},has(c,i){var d;if(i===O)return!0;var f=a.get(i),l=f!==void 0&&f.v!==_||Reflect.has(c,i);if(f!==void 0||C!==null&&(!l||(d=S(c,i))!=null&&d.writable)){f===void 0&&(f=P(l?I(c[i],w):_),a.set(i,f));var s=g(f);if(s===_)return!1}return l},set(c,i,f,l){var R;var s=a.get(i),d=i in c;if(u&&i==="length")for(var v=f;v<s.v;v+=1){var p=a.get(v+"");p!==void 0?y(p,_):v in c&&(p=P(_),a.set(v+"",p))}s===void 0?(!d||(R=S(c,i))!=null&&R.writable)&&(s=P(void 0),y(s,I(f,w)),a.set(i,s)):(d=s.v!==_,y(s,I(f,w)));var h=Reflect.getOwnPropertyDescriptor(c,i);if(h!=null&&h.set&&h.set.call(l,f),!d){if(u&&typeof i=="string"){var m=a.get("length"),T=Number(i);Number.isInteger(T)&&T>=m.v&&y(m,T+1)}Z(b)}return!0},ownKeys(c){g(b);var i=Reflect.ownKeys(c).filter(s=>{var d=a.get(s);return d===void 0||d.v!==_});for(var[f,l]of a)l.v!==_&&!(f in c)&&i.push(f);return i},setPrototypeOf(){te()}})}function Z(e,r=1){y(e,e.v+r)}function Ce(e,r,t=!1){A&&Q();var n=e,a=null,u=null,b=_,w=t?X:0,c=!1;const i=(l,s=!0)=>{c=!0,f(s,l)},f=(l,s)=>{if(b===(b=l))return;let d=!1;if(A){const v=n.data===ue;!!b===v&&(n=le(),ce(n),K(!1),d=!0)}b?(a?$(a):s&&(a=B(()=>s(n))),u&&F(u,()=>{u=null})):(u?$(u):s&&(u=B(()=>s(n))),a&&F(a,()=>{a=null})),d&&K(!0)};J(()=>{c=!1,r(i),c||f(null,null)},w),A&&(n=k)}function Be(e,r,t){A&&Q();var n=e,a,u;J(()=>{a!==(a=r())&&(u&&(F(u),u=null),a&&(u=B(()=>t(n,a))))},X),A&&(n=k)}function z(e,r){return e===r||(e==null?void 0:e[O])===r}function Fe(e={},r,t,n){return de(()=>{var a,u;return oe(()=>{a=u,u=(n==null?void 0:n())||[],M(()=>{e!==t(...u)&&(r(e,...u),a&&z(t(...a),e)&&r(null,...a))})}),()=>{ve(()=>{u&&z(t(...u),e)&&r(null,...u)})}}),e}let D=!1,U=Symbol();function Me(e,r,t){const n=t[r]??(t[r]={store:null,source:ee(void 0),unsubscribe:G});if(n.store!==e&&!(U in t))if(n.unsubscribe(),n.store=e??null,e==null)n.source.v=void 0,n.unsubscribe=G;else{var a=!0;n.unsubscribe=Te(e,u=>{a?n.source.v=u:y(n.source,u)}),a=!1}return e&&U in t?Ne(e):g(n.source)}function Ue(){const e={};function r(){_e(()=>{for(var t in e)e[t].unsubscribe();be(e,U,{enumerable:!1,value:!0})})}return[e,r]}function xe(e){var r=D;try{return D=!1,[e(),D]}finally{D=r}}const Ae={get(e,r){if(!e.exclude.includes(r))return e.props[r]},set(e,r){return!1},getOwnPropertyDescriptor(e,r){if(!e.exclude.includes(r)&&r in e.props)return{enumerable:!0,configurable:!0,value:e.props[r]}},has(e,r){return e.exclude.includes(r)?!1:r in e.props},ownKeys(e){return Reflect.ownKeys(e.props).filter(r=>!e.exclude.includes(r))}};function Ye(e,r,t){return new Proxy({props:e,exclude:r},Ae)}const De={get(e,r){let t=e.props.length;for(;t--;){let n=e.props[t];if(x(n)&&(n=n()),typeof n=="object"&&n!==null&&r in n)return n[r]}},set(e,r,t){let n=e.props.length;for(;n--;){let a=e.props[n];x(a)&&(a=a());const u=S(a,r);if(u&&u.set)return u.set(t),!0}return!1},getOwnPropertyDescriptor(e,r){let t=e.props.length;for(;t--;){let n=e.props[t];if(x(n)&&(n=n()),typeof n=="object"&&n!==null&&r in n){const a=S(n,r);return a&&!a.configurable&&(a.configurable=!0),a}}},has(e,r){if(r===O||r===re)return!1;for(let t of e.props)if(x(t)&&(t=t()),t!=null&&r in t)return!0;return!1},ownKeys(e){const r=[];for(let t of e.props){x(t)&&(t=t());for(const n in t)r.includes(n)||r.push(n)}return r}};function je(...e){return new Proxy({props:e},De)}function W(e){for(var r=C,t=C;r!==null&&!(r.f&(Pe|pe));)r=r.parent;try{return H(r),e()}finally{H(t)}}function Ke(e,r,t,n){var j;var a=(t&Re)!==0,u=!Ee||(t&Ie)!==0,b=(t&Oe)!==0,w=(t&me)!==0,c=!1,i;b?[i,c]=xe(()=>e[r]):i=e[r];var f=O in e||re in e,l=b&&(((j=S(e,r))==null?void 0:j.set)??(f&&r in e&&(o=>e[r]=o)))||void 0,s=n,d=!0,v=!1,p=()=>(v=!0,d&&(d=!1,w?s=M(n):s=n),s);i===void 0&&n!==void 0&&(l&&u&&he(),i=p(),l&&l(i));var h;if(u)h=()=>{var o=e[r];return o===void 0?p():(d=!0,v=!1,o)};else{var m=W(()=>(a?V:Se)(()=>e[r]));m.f|=ye,h=()=>{var o=g(m);return o!==void 0&&(s=void 0),o===void 0?s:o}}if(!(t&ge))return h;if(l){var T=e.$$legacy;return function(o,E){return arguments.length>0?((!u||!E||T||c)&&l(E?h():o),o):h()}}var R=!1,Y=!1,L=ee(i),N=W(()=>V(()=>{var o=h(),E=g(L);return R?(R=!1,Y=!0,E):(Y=!1,L.v=o)}));return a||(N.equals=we),function(o,E){if(arguments.length>0){const q=E?g(N):u&&b?I(o):o;return N.equals(q)||(R=!0,y(L,q),v&&s!==void 0&&(s=q),M(()=>g(N))),o}return g(N)}}export{I as a,Fe as b,Be as c,Ue as d,Me as e,Ce as i,Ke as p,Ye as r,je as s};
