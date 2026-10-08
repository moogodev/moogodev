var e=Object.create,t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.getPrototypeOf,a=Object.prototype.hasOwnProperty,o=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports),s=(e,i,o,s)=>{if(i&&typeof i==`object`||typeof i==`function`)for(var c=r(i),l=0,u=c.length,d;l<u;l++)d=c[l],!a.call(e,d)&&d!==o&&t(e,d,{get:(e=>i[e]).bind(null,d),enumerable:!(s=n(i,d))||s.enumerable});return e},c=(n,r,o)=>(o=n==null?{}:e(i(n)),s(r||!n||!n.__esModule||!a.call(n,`default`)?t(o,`default`,{value:n,enumerable:!0}):o,n)),l=o((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.portal`),r=Symbol.for(`react.fragment`),i=Symbol.for(`react.strict_mode`),a=Symbol.for(`react.profiler`),o=Symbol.for(`react.consumer`),s=Symbol.for(`react.context`),c=Symbol.for(`react.forward_ref`),l=Symbol.for(`react.suspense`),u=Symbol.for(`react.memo`),d=Symbol.for(`react.lazy`),f=Symbol.for(`react.activity`),p=Symbol.for(`react.view_transition`),m=Symbol.iterator;function h(e){return typeof e!=`object`||!e?null:(e=m&&e[m]||e[`@@iterator`],typeof e==`function`?e:null)}var g={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},_=Object.assign,v={};function y(e,t,n){this.props=e,this.context=t,this.refs=v,this.updater=n||g}y.prototype.isReactComponent={},y.prototype.setState=function(e,t){if(typeof e!=`object`&&typeof e!=`function`&&e!=null)throw Error(`takes an object of state variables to update or a function which returns an object of state variables.`);this.updater.enqueueSetState(this,e,t,`setState`)},y.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,`forceUpdate`)};function b(){}b.prototype=y.prototype;function x(e,t,n){this.props=e,this.context=t,this.refs=v,this.updater=n||g}var S=x.prototype=new b;S.constructor=x,_(S,y.prototype),S.isPureReactComponent=!0;var C=Array.isArray;function w(){}var T={H:null,A:null,T:null,S:null},E=Object.prototype.hasOwnProperty;function D(e,n,r){var i=r.ref;return{$$typeof:t,type:e,key:n,ref:i===void 0?null:i,props:r}}function ee(e,t){return D(e.type,t,e.props)}function O(e){return typeof e==`object`&&!!e&&e.$$typeof===t}function te(e){var t={"=":`=0`,":":`=2`};return`$`+e.replace(/[=:]/g,function(e){return t[e]})}var k=/\/+/g;function A(e,t){return typeof e==`object`&&e&&e.key!=null?te(``+e.key):t.toString(36)}function ne(e){switch(e.status){case`fulfilled`:return e.value;case`rejected`:throw e.reason;default:switch(typeof e.status==`string`?e.then(w,w):(e.status=`pending`,e.then(function(t){e.status===`pending`&&(e.status=`fulfilled`,e.value=t)},function(t){e.status===`pending`&&(e.status=`rejected`,e.reason=t)})),e.status){case`fulfilled`:return e.value;case`rejected`:throw e.reason}}throw e}function re(e,r,i,a,o){var s=typeof e;(s===`undefined`||s===`boolean`)&&(e=null);var c=!1;if(e===null)c=!0;else switch(s){case`bigint`:case`string`:case`number`:c=!0;break;case`object`:switch(e.$$typeof){case t:case n:c=!0;break;case d:return c=e._init,re(c(e._payload),r,i,a,o)}}if(c)return o=o(e),c=a===``?`.`+A(e,0):a,C(o)?(i=``,c!=null&&(i=c.replace(k,`$&/`)+`/`),re(o,r,i,``,function(e){return e})):o!=null&&(O(o)&&(o=ee(o,i+(o.key==null||e&&e.key===o.key?``:(``+o.key).replace(k,`$&/`)+`/`)+c)),r.push(o)),1;c=0;var l=a===``?`.`:a+`:`;if(C(e))for(var u=0;u<e.length;u++)a=e[u],s=l+A(a,u),c+=re(a,r,i,s,o);else if(u=h(e),typeof u==`function`)for(e=u.call(e),u=0;!(a=e.next()).done;)a=a.value,s=l+A(a,u++),c+=re(a,r,i,s,o);else if(s===`object`){if(typeof e.then==`function`)return re(ne(e),r,i,a,o);throw r=String(e),Error(`Objects are not valid as a React child (found: `+(r===`[object Object]`?`object with keys {`+Object.keys(e).join(`, `)+`}`:r)+`). If you meant to render a collection of children, use an array instead.`)}return c}function ie(e,t,n){if(e==null)return e;var r=[],i=0;return re(e,r,``,``,function(e){return t.call(n,e,i++)}),r}function ae(e){if(e._status===-1){var t=e._result,n=t();n.then(function(t){(e._status===0||e._status===-1)&&(e._status=1,e._result=t,n.status===void 0&&(n.status=`fulfilled`,n.value=t))},function(t){(e._status===0||e._status===-1)&&(e._status=2,e._result=t,n.status===void 0&&(n.status=`rejected`,n.reason=t))}),e._status===-1&&(e._status=0,e._result=n)}if(e._status===1)return e._result.default;throw e._result}var oe=typeof reportError==`function`?reportError:function(e){if(typeof window==`object`&&typeof window.ErrorEvent==`function`){var t=new window.ErrorEvent(`error`,{bubbles:!0,cancelable:!0,message:typeof e==`object`&&e&&typeof e.message==`string`?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process==`object`&&typeof process.emit==`function`){process.emit(`uncaughtException`,e);return}console.error(e)};function j(e){var t=T.T,n={};n.types=t===null?null:t.types,T.T=n;try{var r=e(),i=T.S;i!==null&&i(n,r),typeof r==`object`&&r&&typeof r.then==`function`&&r.then(w,oe)}catch(e){oe(e)}finally{t!==null&&n.types!==null&&(t.types=n.types),T.T=t}}function M(e){var t=T.T;if(t!==null){var n=t.types;n===null?t.types=[e]:n.indexOf(e)===-1&&n.push(e)}else j(M.bind(null,e))}var N={map:ie,forEach:function(e,t,n){ie(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return ie(e,function(){t++}),t},toArray:function(e){return ie(e,function(e){return e})||[]},only:function(e){if(!O(e))throw Error(`React.Children.only expected to receive a single React element child.`);return e}};e.Activity=f,e.Children=N,e.Component=y,e.Fragment=r,e.Profiler=a,e.PureComponent=x,e.StrictMode=i,e.Suspense=l,e.ViewTransition=p,e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=T,e.__COMPILER_RUNTIME={__proto__:null,c:function(e){return T.H.useMemoCache(e)}},e.addTransitionType=M,e.cache=function(e){return function(){return e.apply(null,arguments)}},e.cacheSignal=function(){return null},e.cloneElement=function(e,t,n){if(e==null)throw Error(`The argument must be a React element, but you passed `+e+`.`);var r=_({},e.props),i=e.key;if(t!=null)for(a in t.key!==void 0&&(i=``+t.key),t)!E.call(t,a)||a===`key`||a===`__self`||a===`__source`||a===`ref`&&t.ref===void 0||(r[a]=t[a]);var a=arguments.length-2;if(a===1)r.children=n;else if(1<a){for(var o=Array(a),s=0;s<a;s++)o[s]=arguments[s+2];r.children=o}return D(e.type,i,r)},e.createContext=function(e){return e={$$typeof:s,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:o,_context:e},e},e.createElement=function(e,t,n){var r,i={},a=null;if(t!=null)for(r in t.key!==void 0&&(a=``+t.key),t)E.call(t,r)&&r!==`key`&&r!==`__self`&&r!==`__source`&&(i[r]=t[r]);var o=arguments.length-2;if(o===1)i.children=n;else if(1<o){for(var s=Array(o),c=0;c<o;c++)s[c]=arguments[c+2];i.children=s}if(e&&e.defaultProps)for(r in o=e.defaultProps,o)i[r]===void 0&&(i[r]=o[r]);return D(e,a,i)},e.createRef=function(){return{current:null}},e.forwardRef=function(e){return{$$typeof:c,render:e}},e.isValidElement=O,e.lazy=function(e){return{$$typeof:d,_payload:{_status:-1,_result:e},_init:ae}},e.memo=function(e,t){return{$$typeof:u,type:e,compare:t===void 0?null:t}},e.startTransition=j,e.unstable_useCacheRefresh=function(){return T.H.useCacheRefresh()},e.use=function(e){return T.H.use(e)},e.useActionState=function(e,t,n){return T.H.useActionState(e,t,n)},e.useCallback=function(e,t){return T.H.useCallback(e,t)},e.useContext=function(e){return T.H.useContext(e)},e.useDebugValue=function(){},e.useDeferredValue=function(e,t){return T.H.useDeferredValue(e,t)},e.useEffect=function(e,t){return T.H.useEffect(e,t)},e.useEffectEvent=function(e){return T.H.useEffectEvent(e)},e.useId=function(){return T.H.useId()},e.useImperativeHandle=function(e,t,n){return T.H.useImperativeHandle(e,t,n)},e.useInsertionEffect=function(e,t){return T.H.useInsertionEffect(e,t)},e.useLayoutEffect=function(e,t){return T.H.useLayoutEffect(e,t)},e.useMemo=function(e,t){return T.H.useMemo(e,t)},e.useOptimistic=function(e,t){return T.H.useOptimistic(e,t)},e.useReducer=function(e,t,n){return T.H.useReducer(e,t,n)},e.useRef=function(e){return T.H.useRef(e)},e.useState=function(e){return T.H.useState(e)},e.useSyncExternalStore=function(e,t,n){return T.H.useSyncExternalStore(e,t,n)},e.useTransition=function(){return T.H.useTransition()},e.version=`19.3.0`})),u=o(((e,t)=>{t.exports=l()})),d=(function(){let e=typeof document<`u`&&document.createElement(`link`).relList;return e&&e.supports&&e.supports(`modulepreload`)?`modulepreload`:`preload`})(),f=function(e){return`/static/`+e},p={},m=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=f(t,n),t=s(t),t in p)return;p[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:d,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},h=c(u(),1),g=/^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i,_=/^[\\/]{2}/;function v(e,t){return t+e.replace(/\\/g,`/`)}var y=`popstate`;function b(e){return typeof e==`object`&&!!e&&`pathname`in e&&`search`in e&&`hash`in e&&`state`in e&&`key`in e}function x(e={}){function t(e,t){let n=t.state?.masked,{pathname:r,search:i,hash:a}=n||e.location;return E(``,{pathname:r,search:i,hash:a},t.state&&t.state.usr||null,t.state&&t.state.key||`default`,n?{pathname:e.location.pathname,search:e.location.search,hash:e.location.hash}:void 0)}function n(e,t){return typeof t==`string`?t:D(t)}return O(t,n,null,e)}function S(e,t){if(e===!1||e==null)throw Error(t)}function C(e,t){if(!e){typeof console<`u`&&console.warn(t);try{throw Error(t)}catch{}}}function w(){return Math.random().toString(36).substring(2,10)}function T(e,t){return{usr:e.state,key:e.key,idx:t,masked:e.mask?{pathname:e.pathname,search:e.search,hash:e.hash}:void 0}}function E(e,t,n=null,r,i){return{pathname:typeof e==`string`?e:e.pathname,search:``,hash:``,...typeof t==`string`?ee(t):t,state:n,key:t&&t.key||r||w(),mask:i}}function D({pathname:e=`/`,search:t=``,hash:n=``}){return t&&t!==`?`&&(e+=t.charAt(0)===`?`?t:`?`+t),n&&n!==`#`&&(e+=n.charAt(0)===`#`?n:`#`+n),e}function ee(e){let t={};if(e){let n=e.indexOf(`#`);n>=0&&(t.hash=e.substring(n),e=e.substring(0,n));let r=e.indexOf(`?`);r>=0&&(t.search=e.substring(r),e=e.substring(0,r)),e&&(t.pathname=e)}return t}function O(e,t,n,r={}){let{window:i=document.defaultView,v5Compat:a=!1}=r,o=i.history,s=`POP`,c=null,l=u();l??(l=0,o.replaceState({...o.state,idx:l},``));function u(){return(o.state||{idx:null}).idx}function d(){s=`POP`;let e=u(),t=e==null?null:e-l;l=e,c&&c({action:s,location:h.location,delta:t})}function f(e,t){s=`PUSH`;let r=b(e)?e:E(h.location,e,t);n&&n(r,e),l=u()+1;let d=T(r,l),f=h.createHref(r.mask||r);try{o.pushState(d,``,f)}catch(e){if(e instanceof DOMException&&e.name===`DataCloneError`)throw e;i.location.assign(f)}a&&c&&c({action:s,location:h.location,delta:1})}function p(e,t){s=`REPLACE`;let r=b(e)?e:E(h.location,e,t);n&&n(r,e),l=u();let i=T(r,l),d=h.createHref(r.mask||r);o.replaceState(i,``,d),a&&c&&c({action:s,location:h.location,delta:0})}function m(e){return te(i,e)}let h={get action(){return s},get location(){return e(i,o)},listen(e){if(c)throw Error(`A history only accepts one active listener`);return i.addEventListener(y,d),c=e,()=>{i.removeEventListener(y,d),c=null}},createHref(e){return t(i,e)},createURL:m,encodeLocation(e){let t=m(e);return{pathname:t.pathname,search:t.search,hash:t.hash}},push:f,replace:p,go(e){return o.go(e)}};return h}function te(e,t,n=!1){let r=`http://localhost`;e&&(r=e.location.origin===`null`?e.location.href:e.location.origin),S(r,`No window.location.(origin|href) available to create URL`);let i=typeof t==`string`?t:D(t);return i=i.replace(/ $/,`%20`),!n&&_.test(i)&&(i=r+i),new URL(i,r)}function k(e,t,n=`/`){return A(e,t,n,!1)}function A(e,t,n,r,i){let a=he((typeof t==`string`?ee(t):t).pathname||`/`,n);if(a==null)return null;let o=i??ne(e),s=null,c=F(a);for(let e=0;s==null&&e<o.length;++e)s=fe(o[e],c,r);return s}function ne(e){let t=re(e);return ae(t),t}function re(e,t=[],n=[],r=``,i=!1){let a=(e,a,o=i,s)=>{let c={relativePath:s===void 0?e.path||``:s,caseSensitive:e.caseSensitive===!0,childrenIndex:a,route:e};if(c.relativePath.startsWith(`/`)){if(!c.relativePath.startsWith(r)&&o)return;S(c.relativePath.startsWith(r),`Absolute route path "${c.relativePath}" nested under path "${r}" is not valid. An absolute child route path must start with the combined path of all its parent routes.`),c.relativePath=c.relativePath.slice(r.length)}let l=Se([r,c.relativePath]),u=n.concat(c);e.children&&e.children.length>0&&(S(e.index!==!0,`Index routes must not have child routes. Please remove all child routes from route path "${l}".`),re(e.children,t,u,l,o)),(e.path!=null||e.index)&&t.push({path:l,score:ue(l,e.index),routesMeta:u.map((e,t)=>{let[n,r]=P(e.relativePath,e.caseSensitive,t===u.length-1);return{...e,matcher:n,compiledParams:r}})})};return e.forEach((e,t)=>{if(e.path===``||!e.path?.includes(`?`))a(e,t);else for(let n of ie(e.path))a(e,t,!0,n)}),t}function ie(e){let t=e.split(`/`);if(t.length===0)return[];let[n,...r]=t,i=n.endsWith(`?`),a=n.replace(/\?$/,``);if(r.length===0)return i?[a,``]:[a];let o=ie(r.join(`/`)),s=[];return s.push(...o.map(e=>e===``?a:[a,e].join(`/`))),i&&s.push(...o),s.map(t=>e.startsWith(`/`)&&t===``?`/`:t)}function ae(e){e.sort((e,t)=>e.score===t.score?de(e.routesMeta.map(e=>e.childrenIndex),t.routesMeta.map(e=>e.childrenIndex)):t.score-e.score)}var oe=/^:[\w-]+$/,j=3,M=2,N=1,se=10,ce=-2,le=e=>e===`*`;function ue(e,t){let n=e.split(`/`),r=n.length;return n.some(le)&&(r+=ce),t&&(r+=M),n.filter(e=>!le(e)).reduce((e,t)=>e+(oe.test(t)?j:t===``?N:se),r)}function de(e,t){return e.length===t.length&&e.slice(0,-1).every((e,n)=>e===t[n])?e[e.length-1]-t[t.length-1]:0}function fe(e,t,n=!1){let{routesMeta:r}=e,i={},a=`/`,o=[];for(let e=0;e<r.length;++e){let s=r[e],c=e===r.length-1,l=a===`/`?t:t.slice(a.length)||`/`,u={path:s.relativePath,caseSensitive:s.caseSensitive,end:c},d=s.matcher&&s.compiledParams?me(u,l,s.matcher,s.compiledParams):pe(u,l),f=s.route;if(!d&&c&&n&&!r[r.length-1].route.index&&(d=pe({path:s.relativePath,caseSensitive:s.caseSensitive,end:!1},l)),!d)return null;Object.assign(i,d.params),o.push({params:i,pathname:Se([a,d.pathname]),pathnameBase:we(Se([a,d.pathnameBase])),route:f}),d.pathnameBase!==`/`&&(a=Se([a,d.pathnameBase]))}return o}function pe(e,t){typeof e==`string`&&(e={path:e,caseSensitive:!1,end:!0});let[n,r]=P(e.path,e.caseSensitive,e.end);return me(e,t,n,r)}function me(e,t,n,r){let i=t.match(n);if(!i)return null;let a=i[0],o=Ce(a,1),s=i.slice(1);return{params:r.reduce((e,{paramName:t,isOptional:n},r)=>{if(t===`*`){let e=s[r]||``;o=Ce(a.slice(0,a.length-e.length),1)}let i=s[r];return e[t]=n&&!i?void 0:(i||``).replace(/%2F/g,`/`),e},{}),pathname:a,pathnameBase:o,pattern:e}}function P(e,t=!1,n=!0){C(e===`*`||!e.endsWith(`*`)||e.endsWith(`/*`),`Route path "${e}" will be treated as if it were "${e.replace(/\*$/,`/*`)}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${e.replace(/\*$/,`/*`)}".`);let r=[],i=`^`+e.replace(/\/*\*?$/,``).replace(/^\/*/,`/`).replace(/[\\.*+^${}|()[\]]/g,`\\$&`).replace(/\/:([\w-]+)(\?)?/g,(e,t,n,i,a)=>{if(r.push({paramName:t,isOptional:n!=null}),n){let t=a.charAt(i+e.length);return t&&t!==`/`?`/([^\\/]*)`:`(?:/([^\\/]*))?`}return`/([^\\/]+)`}).replace(/\/([\w-]+)\?(\/|$)/g,`(/$1)?$2`);return e.endsWith(`*`)?(r.push({paramName:`*`}),i+=e===`*`||e===`/*`?`(.*)$`:`(?:\\/(.+)|\\/*)$`):n?i+=`\\/*$`:e!==``&&e!==`/`&&(i+=`(?:(?=\\/|$))`),[new RegExp(i,t?void 0:`i`),r]}function F(e){try{return e.split(`/`).map(e=>decodeURIComponent(e).replace(/\//g,`%2F`)).join(`/`)}catch(t){return C(!1,`The URL path "${e}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${t}).`),e}}function he(e,t){if(t===`/`)return e;if(!e.toLowerCase().startsWith(t.toLowerCase()))return null;let n=t.endsWith(`/`)?t.length-1:t.length,r=e.charAt(n);return r&&r!==`/`?null:e.slice(n)||`/`}function ge(e,t=`/`){let{pathname:n,search:r=``,hash:i=``}=typeof e==`string`?ee(e):e,a;return n?(n=xe(n),a=n.startsWith(`/`)||n.startsWith(`\\`)?_e(n.substring(1),`/`):_e(n,t)):a=t,{pathname:a,search:Te(r),hash:Ee(i)}}function _e(e,t){let n=Ce(t).split(`/`);return e.split(`/`).forEach(e=>{e===`..`?n.length>1&&n.pop():e!==`.`&&n.push(e)}),n.length>1?n.join(`/`):`/`}function ve(e,t,n,r){return`Cannot include a '${e}' character in a manually specified \`to.${t}\` field [${JSON.stringify(r)}].  Please separate it out to the \`to.${n}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`}function ye(e){return e.filter((e,t)=>t===0||e.route.path&&e.route.path.length>0)}function I(e){let t=ye(e);return t.map((e,n)=>n===t.length-1?e.pathname:e.pathnameBase)}function be(e,t,n,r=!1){let i;typeof e==`string`?i=ee(e):(i={...e},S(!i.pathname||!i.pathname.includes(`?`),ve(`?`,`pathname`,`search`,i)),S(!i.pathname||!i.pathname.includes(`#`),ve(`#`,`pathname`,`hash`,i)),S(!i.search||!i.search.includes(`#`),ve(`#`,`search`,`hash`,i)));let a=e===``||i.pathname===``,o=a?`/`:i.pathname,s;if(o==null)s=n;else{let e=t.length-1;if(!r&&o.startsWith(`..`)){let t=o.split(`/`);for(;t[0]===`..`;)t.shift(),--e;i.pathname=t.join(`/`)}s=e>=0?t[e]:`/`}let c=ge(i,s),l=o&&o!==`/`&&o.endsWith(`/`),u=(a||o===`.`)&&n.endsWith(`/`);return!c.pathname.endsWith(`/`)&&(l||u)&&(c.pathname+=`/`),c}var xe=e=>e.replace(/[\\/]{2,}/g,`/`),Se=e=>xe(e.join(`/`));function Ce(e,t=0){let n=e.length;for(;n>t&&e.charCodeAt(n-1)===47;)n--;return n===e.length?e:e.slice(0,n)}var we=e=>Ce(e).replace(/^\/*/,`/`),Te=e=>!e||e===`?`?``:e.startsWith(`?`)?e:`?`+e,Ee=e=>!e||e===`#`?``:e.startsWith(`#`)?e:`#`+e,De=class{constructor(e,t,n,r=!1){this.status=e,this.statusText=t||``,this.internal=r,n instanceof Error?(this.data=n.toString(),this.error=n):this.data=n}};function Oe(e){return e!=null&&typeof e.status==`number`&&typeof e.statusText==`string`&&typeof e.internal==`boolean`&&`data`in e}function ke(e){return Se(e.map(e=>e.route.path).filter(Boolean))||`/`}var Ae=typeof window<`u`&&window.document!==void 0&&window.document.createElement!==void 0;function je(e,t){let n=e;if(typeof n!=`string`||!g.test(n))return{absoluteURL:void 0,isExternal:!1,to:n};let r=n,i=!1;if(Ae)try{let e=new URL(window.location.href),r=_.test(n)?new URL(v(n,e.protocol)):new URL(n),a=he(r.pathname,t);r.origin===e.origin&&a!=null?n=a+r.search+r.hash:i=!0}catch{C(!1,`<Link to="${n}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`)}return{absoluteURL:r,isExternal:i,to:n}}Object.getOwnPropertyNames(Object.prototype).sort().join(`\0`);var Me=new URL(`http://localhost`);function Ne(e){if(e.createURL)return e.createURL(`/`);try{return new URL(e.createHref(`/`),Me)}catch{return Me}}function Pe(e,t){return e.origin===t.origin&&(e.origin!==`null`||e.protocol===t.protocol&&e.host===t.host)}function Fe(e,t){if(e.startsWith(`//`))return!0;let n=t.protocol.toLowerCase();return e.toLowerCase().startsWith(n)?t.host===``||e.slice(n.length).startsWith(`//`):!1}function Ie(e,t,n,r){let i=null;try{i=e==null?null:new URL(e,n)}catch{}let a=new URL(t,n),o=i!=null&&!Pe(i,n),s=!Pe(a,n);if(r===`reject`){if(o||s)throw Error(`External navigation is not allowed`)}else if(s&&(i==null||!Fe(e,i)||!Pe(i,a)))throw Error(`External navigation is not allowed`)}var Le=[`POST`,`PUT`,`PATCH`,`DELETE`];new Set(Le);var Re=[`GET`,...Le];new Set(Re);var ze=[`about:`,`blob:`,`chrome:`,`chrome-untrusted:`,`content:`,`data:`,`devtools:`,`file:`,`filesystem:`,`javascript:`];function Be(e){try{return ze.includes(new URL(e).protocol)}catch{return!1}}var Ve=h.createContext(null);Ve.displayName=`DataRouter`;var He=h.createContext(null);He.displayName=`DataRouterState`;var Ue=h.createContext(!1);function We(){return h.useContext(Ue)}var Ge=h.createContext({isTransitioning:!1});Ge.displayName=`ViewTransition`;var Ke=h.createContext(new Map);Ke.displayName=`Fetchers`;var qe=h.createContext(null);qe.displayName=`Await`;var Je=h.createContext(null);Je.displayName=`Navigation`;var Ye=h.createContext(null);Ye.displayName=`Location`;var L=h.createContext({outlet:null,matches:[],isDataRoute:!1});L.displayName=`Route`;var Xe=h.createContext(null);Xe.displayName=`RouteError`;var Ze=`REACT_ROUTER_ERROR`,Qe=`REDIRECT`,$e=`ROUTE_ERROR_RESPONSE`;function et(e){if(e.startsWith(`${Ze}:${Qe}:{`))try{let t=JSON.parse(e.slice(28));if(typeof t==`object`&&t&&typeof t.status==`number`&&typeof t.statusText==`string`&&typeof t.location==`string`&&typeof t.reloadDocument==`boolean`&&typeof t.replace==`boolean`)return t}catch{}}function tt(e){if(e.startsWith(`${Ze}:${$e}:{`))try{let t=JSON.parse(e.slice(40));if(typeof t==`object`&&t&&typeof t.status==`number`&&typeof t.statusText==`string`)return new De(t.status,t.statusText,t.data)}catch{}}function nt(e,{relative:t}={}){S(rt(),`useHref() may be used only in the context of a <Router> component.`);let{basename:n,navigator:r}=h.useContext(Je),{hash:i,pathname:a,search:o}=ft(e,{relative:t}),s=a;return n!==`/`&&(s=a===`/`?n:Se([n,a])),r.createHref({pathname:s,search:o,hash:i})}function rt(){return h.useContext(Ye)!=null}function it(){return S(rt(),`useLocation() may be used only in the context of a <Router> component.`),h.useContext(Ye).location}var at=`You should call navigate() in a React.useEffect(), not when your component is first rendered.`;function ot(e){h.useContext(Je).static||h.useLayoutEffect(e)}function st(){let{isDataRoute:e}=h.useContext(L);return e?kt():ct()}function ct(){S(rt(),`useNavigate() may be used only in the context of a <Router> component.`);let e=h.useContext(Ve),{basename:t,navigator:n}=h.useContext(Je),{matches:r}=h.useContext(L),{pathname:i}=it(),a=JSON.stringify(I(r)),o=h.useRef(!1);return ot(()=>{o.current=!0}),h.useCallback((r,s={})=>{if(C(o.current,at),!o.current)return;if(typeof r==`number`){n.go(r);return}let c=be(r,JSON.parse(a),i,s.relative===`path`);e==null&&t!==`/`&&(c.pathname=c.pathname===`/`?t:Se([t,c.pathname])),Ie(typeof r==`string`?r:D(r),n.createHref(c),Ne(n),`reject`),(s.replace?n.replace:n.push)(c,s.state,s)},[t,n,a,i,e])}var lt=h.createContext(null);function ut(e){let t=h.useContext(L).outlet;return h.useMemo(()=>t&&h.createElement(lt.Provider,{value:e},t),[t,e])}function dt(){let{matches:e}=h.useContext(L);return e[e.length-1]?.params??{}}function ft(e,{relative:t}={}){let{matches:n}=h.useContext(L),{pathname:r}=it(),i=JSON.stringify(I(n));return h.useMemo(()=>be(e,JSON.parse(i),r,t===`path`),[e,i,r,t])}function pt(e,t){return mt(e,t)}function mt(e,t,n){S(rt(),`useRoutes() may be used only in the context of a <Router> component.`);let{navigator:r}=h.useContext(Je),{matches:i}=h.useContext(L),a=i[i.length-1],o=a?a.params:{},s=a?a.pathname:`/`,c=a?a.pathnameBase:`/`,l=a&&a.route;{let e=l&&l.path||``;jt(s,!l||e.endsWith(`*`)||e.endsWith(`*?`),`You rendered descendant <Routes> (or called \`useRoutes()\`) at "${s}" (under <Route path="${e}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${e}"> to <Route path="${e===`/`?`*`:`${e}/*`}">.`)}let u=it(),d;if(t){let e=typeof t==`string`?ee(t):t;S(c===`/`||e.pathname?.startsWith(c),`When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, the location pathname must begin with the portion of the URL pathname that was matched by all parent routes. The current pathname base is "${c}" but pathname "${e.pathname}" was given in the \`location\` prop.`),d=e}else d=u;let f=d.pathname||`/`,p=f;if(c!==`/`){let e=c.replace(/^\//,``).split(`/`);p=`/`+f.replace(/^\//,``).split(`/`).slice(e.length).join(`/`)}let m=n&&n.state.matches.length?n.state.matches.map(e=>Object.assign(e,{route:n.manifest[e.route.id]||e.route})):k(e,{pathname:p});C(l||m!=null,`No routes matched location "${d.pathname}${d.search}${d.hash}" `),C(m==null||m[m.length-1].route.element!==void 0||m[m.length-1].route.Component!==void 0||m[m.length-1].route.lazy!==void 0,`Matched leaf route at location "${d.pathname}${d.search}${d.hash}" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`);let g=xt(m&&m.map(e=>Object.assign({},e,{params:Object.assign({},o,e.params),pathname:Se([c,r.encodeLocation?r.encodeLocation(e.pathname.replace(/%/g,`%25`).replace(/\?/g,`%3F`).replace(/#/g,`%23`)).pathname:e.pathname]),pathnameBase:e.pathnameBase===`/`?c:Se([c,r.encodeLocation?r.encodeLocation(e.pathnameBase.replace(/%/g,`%25`).replace(/\?/g,`%3F`).replace(/#/g,`%23`)).pathname:e.pathnameBase])})),i,n);return t&&g?h.createElement(Ye.Provider,{value:{location:{pathname:`/`,search:``,hash:``,state:null,key:`default`,mask:void 0,...d},navigationType:`POP`}},g):g}function ht(){let e=Ot(),t=Oe(e)?`${e.status} ${e.statusText}`:e instanceof Error?e.message:JSON.stringify(e),n=e instanceof Error?e.stack:null,r=`rgba(200,200,200, 0.5)`,i={padding:`0.5rem`,backgroundColor:r},a={padding:`2px 4px`,backgroundColor:r},o=null;return console.error(`Error handled by React Router default ErrorBoundary:`,e),o=h.createElement(h.Fragment,null,h.createElement(`p`,null,`💿 Hey developer 👋`),h.createElement(`p`,null,`You can provide a way better UX than this when your app throws errors by providing your own `,h.createElement(`code`,{style:a},`ErrorBoundary`),` or`,` `,h.createElement(`code`,{style:a},`errorElement`),` prop on your route.`)),h.createElement(h.Fragment,null,h.createElement(`h2`,null,`Unexpected Application Error!`),h.createElement(`h3`,{style:{fontStyle:`italic`}},t),n?h.createElement(`pre`,{style:i},n):null,o)}var gt=h.createElement(ht,null),_t=class extends h.Component{constructor(e){super(e),this.state={location:e.location,revalidation:e.revalidation,error:e.error}}static getDerivedStateFromError(e){return{error:e}}static getDerivedStateFromProps(e,t){return t.location!==e.location||t.revalidation!==`idle`&&e.revalidation===`idle`?{error:e.error,location:e.location,revalidation:e.revalidation}:{error:e.error===void 0?t.error:e.error,location:t.location,revalidation:e.revalidation||t.revalidation}}componentDidCatch(e,t){this.props.onError?this.props.onError(e,t):console.error(`React Router caught the following error during render`,e)}render(){let e=this.state.error;if(this.context&&typeof e==`object`&&e&&`digest`in e&&typeof e.digest==`string`){let t=tt(e.digest);t&&(e=t)}let t=e===void 0?this.props.children:h.createElement(L.Provider,{value:this.props.routeContext},h.createElement(Xe.Provider,{value:e,children:this.props.component}));return this.context?h.createElement(yt,{error:e},t):t}};_t.contextType=Ue;var vt=new WeakMap;function yt({children:e,error:t}){let{basename:n,navigator:r}=h.useContext(Je);if(typeof t==`object`&&t&&`digest`in t&&typeof t.digest==`string`){let e=et(t.digest);if(e){let i=vt.get(t);if(i)throw i;let a=je(e.location,n),o=a.absoluteURL||a.to;if(Ie(e.location,o,Ne(r),`allow-explicit`),Be(o))throw Error(`Invalid redirect location`);if(Ae&&!vt.get(t)){if(a.isExternal||e.reloadDocument)window.location.href=o;else{let n=Promise.resolve().then(()=>window.__reactRouterDataRouter.navigate(a.to,{replace:e.replace}));throw vt.set(t,n),n}}return h.createElement(`meta`,{httpEquiv:`refresh`,content:`0;url=${o}`})}}return e}function bt({routeContext:e,match:t,children:n}){let r=h.useContext(Ve);return r&&r.static&&r.staticContext&&(t.route.errorElement||t.route.ErrorBoundary)&&(r.staticContext._deepestRenderedBoundaryId=t.route.id),h.createElement(L.Provider,{value:e},n)}function xt(e,t=[],n){let r=n?.state;if(e==null){if(!r)return null;if(r.errors)e=r.matches;else if(t.length===0&&!r.initialized&&r.matches.length>0)e=r.matches;else return null}let i=e,a=r?.errors;if(a!=null){let e=i.findIndex(e=>e.route.id&&a?.[e.route.id]!==void 0);S(e>=0,`Could not find a matching route for errors on route IDs: ${Object.keys(a).join(`,`)}`),i=i.slice(0,Math.min(i.length,e+1))}let o=!1,s=-1;if(n&&r){o=r.renderFallback;for(let e=0;e<i.length;e++){let t=i[e];if((t.route.HydrateFallback||t.route.hydrateFallbackElement)&&(s=e),t.route.id){let{loaderData:e,errors:a}=r,c=t.route.loader&&!e.hasOwnProperty(t.route.id)&&(!a||a[t.route.id]===void 0);if(t.route.lazy||c){n.isStatic&&(o=!0),i=s>=0?i.slice(0,s+1):[i[0]];break}}}}let c=n?.onError,l=r&&c?(e,t)=>{c(e,{location:r.location,params:r.matches?.[0]?.params??{},pattern:ke(r.matches),errorInfo:t})}:void 0;return i.reduceRight((e,n,c)=>{let u,d=!1,f=null,p=null;r&&(u=a&&n.route.id?a[n.route.id]:void 0,f=n.route.errorElement||gt,o&&(s<0&&c===0?(jt(`route-fallback`,!1,"No `HydrateFallback` element provided to render during initial hydration"),d=!0,p=null):s===c&&(d=!0,p=n.route.hydrateFallbackElement||null)));let m=t.concat(i.slice(0,c+1)),g=()=>{let t;return t=u?f:d?p:n.route.Component?h.createElement(n.route.Component,null):n.route.element?n.route.element:e,h.createElement(bt,{match:n,routeContext:{outlet:e,matches:m,isDataRoute:r!=null},children:t})};return r&&(n.route.ErrorBoundary||n.route.errorElement||c===0)?h.createElement(_t,{location:r.location,revalidation:r.revalidation,component:f,error:u,children:g(),routeContext:{outlet:null,matches:m,isDataRoute:!0},onError:l}):g()},null)}function St(e){return`${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function Ct(e){let t=h.useContext(Ve);return S(t,St(e)),t}function wt(e){let t=h.useContext(He);return S(t,St(e)),t}function Tt(e){let t=h.useContext(L);return S(t,St(e)),t}function Et(e){let t=Tt(e),n=t.matches[t.matches.length-1];return S(n.route.id,`${e} can only be used on routes that contain a unique "id"`),n.route.id}function Dt(){return Et(`useRouteId`)}function Ot(){let e=h.useContext(Xe),t=wt(`useRouteError`),n=Et(`useRouteError`);return e===void 0?t.errors?.[n]:e}function kt(){let{router:e}=Ct(`useNavigate`),t=Et(`useNavigate`),n=h.useRef(!1);return ot(()=>{n.current=!0}),h.useCallback(async(r,i={})=>{C(n.current,at),n.current&&(typeof r==`number`?await e.navigate(r):await e.navigate(r,{fromRouteId:t,...i}))},[e,t])}var At={};function jt(e,t,n){!t&&!At[e]&&(At[e]=!0,C(!1,n))}h.memo(Mt);function Mt({routes:e,manifest:t,future:n,state:r,isStatic:i,onError:a}){return mt(e,void 0,{manifest:t,state:r,isStatic:i,onError:a,future:n})}function Nt({to:e,replace:t,state:n,relative:r}){S(rt(),`<Navigate> may be used only in the context of a <Router> component.`);let{static:i,navigator:a}=h.useContext(Je);C(!i,`<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.`);let{matches:o}=h.useContext(L),{pathname:s}=it(),c=st(),l=be(e,I(o),s,r===`path`);Ie(typeof e==`string`?e:D(e),a.createHref(l),Ne(a),`reject`);let u=JSON.stringify(l);return h.useEffect(()=>{c(JSON.parse(u),{replace:t,state:n,relative:r})},[c,u,r,t,n]),null}function Pt(e){return ut(e.context)}function R(e){S(!1,`A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.`)}function Ft({basename:e=`/`,children:t=null,location:n,navigationType:r=`POP`,navigator:i,static:a=!1,useTransitions:o}){S(!rt(),`You cannot render a <Router> inside another <Router>. You should never have more than one in your app.`);let s=e.replace(/^\/*/,`/`),c=h.useMemo(()=>({basename:s,navigator:i,static:a,useTransitions:o,future:{}}),[s,i,a,o]);typeof n==`string`&&(n=ee(n));let{pathname:l=`/`,search:u=``,hash:d=``,state:f=null,key:p=`default`,mask:m}=n,g=h.useMemo(()=>{let e=he(l,s);return e==null?null:{location:{pathname:e,search:u,hash:d,state:f,key:p,mask:m},navigationType:r}},[s,l,u,d,f,p,r,m]);return C(g!=null,`<Router basename="${s}"> is not able to match the URL "${l}${u}${d}" because it does not start with the basename, so the <Router> won't render anything.`),g==null?null:h.createElement(Je.Provider,{value:c},h.createElement(Ye.Provider,{children:t,value:g}))}function It({children:e,location:t}){return pt(Lt(e),t)}h.Component;function Lt(e,t=[]){let n=[];return h.Children.forEach(e,(e,r)=>{if(!h.isValidElement(e))return;let i=[...t,r];if(e.type===h.Fragment){n.push.apply(n,Lt(e.props.children,i));return}S(e.type===R,`[${typeof e.type==`string`?e.type:e.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`),S(!e.props.index||!e.props.children,`An index route cannot have child routes.`);let a={id:e.props.id||i.join(`-`),caseSensitive:e.props.caseSensitive,element:e.props.element,Component:e.props.Component,index:e.props.index,path:e.props.path,middleware:e.props.middleware,loader:e.props.loader,action:e.props.action,hydrateFallbackElement:e.props.hydrateFallbackElement,HydrateFallback:e.props.HydrateFallback,errorElement:e.props.errorElement,ErrorBoundary:e.props.ErrorBoundary,hasErrorBoundary:e.props.hasErrorBoundary===!0||e.props.ErrorBoundary!=null||e.props.errorElement!=null,shouldRevalidate:e.props.shouldRevalidate,handle:e.props.handle,lazy:e.props.lazy};e.props.children&&(a.children=Lt(e.props.children,i)),n.push(a)}),n}var Rt=`get`,zt=`application/x-www-form-urlencoded`;function Bt(e){return typeof HTMLElement<`u`&&e instanceof HTMLElement}function Vt(e){return Bt(e)&&e.tagName.toLowerCase()===`button`}function Ht(e){return Bt(e)&&e.tagName.toLowerCase()===`form`}function Ut(e){return Bt(e)&&e.tagName.toLowerCase()===`input`}function z(e){return!!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)}function Wt(e,t){return e.button===0&&(!t||t===`_self`)&&!z(e)}function Gt(e=``){return new URLSearchParams(typeof e==`string`||Array.isArray(e)||e instanceof URLSearchParams?e:Object.keys(e).reduce((t,n)=>{let r=e[n];return t.concat(Array.isArray(r)?r.map(e=>[n,e]):[[n,r]])},[]))}function Kt(e,t){let n=Gt(e);return t&&t.forEach((e,r)=>{n.has(r)||t.getAll(r).forEach(e=>{n.append(r,e)})}),n}var qt=null;function Jt(){if(qt===null)try{new FormData(document.createElement(`form`),0),qt=!1}catch{qt=!0}return qt}var Yt=new Set([`application/x-www-form-urlencoded`,`multipart/form-data`,`text/plain`]);function Xt(e){return e!=null&&!Yt.has(e)?(C(!1,`"${e}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${zt}"`),null):e}function Zt(e,t){let n,r,i,a,o;if(Ht(e)){let o=e.getAttribute(`action`);r=o?he(o,t):null,n=e.getAttribute(`method`)||Rt,i=Xt(e.getAttribute(`enctype`))||zt,a=new FormData(e)}else if(Vt(e)||Ut(e)&&(e.type===`submit`||e.type===`image`)){let o=e.form;if(o==null)throw Error(`Cannot submit a <button> or <input type="submit"> without a <form>`);let s=e.getAttribute(`formaction`)||o.getAttribute(`action`);if(r=s?he(s,t):null,n=e.getAttribute(`formmethod`)||o.getAttribute(`method`)||Rt,i=Xt(e.getAttribute(`formenctype`))||Xt(o.getAttribute(`enctype`))||zt,a=new FormData(o,e),!Jt()){let{name:t,type:n,value:r}=e;if(n===`image`){let e=t?`${t}.`:``;a.append(`${e}x`,`0`),a.append(`${e}y`,`0`)}else t&&a.append(t,r)}}else if(Bt(e))throw Error(`Cannot submit element that is not <form>, <button>, or <input type="submit|image">`);else n=Rt,r=null,i=zt,o=e;return a&&i===`text/plain`&&(o=a,a=void 0),{action:r,method:n.toLowerCase(),encType:i,formData:a,body:o}}Object.getOwnPropertyNames(Object.prototype).sort().join(`\0`);function Qt(e,t){if(e===!1||e==null)throw Error(t)}function $t(e,t,n,r){let i=typeof e==`string`?new URL(e,typeof window>`u`?`server://singlefetch/`:window.location.origin):e;return i.pathname=n?i.pathname.endsWith(`/`)?`${i.pathname}_.${r}`:`${i.pathname}.${r}`:i.pathname===`/`?`_root.${r}`:t&&he(i.pathname,t)===`/`?`${Ce(t)}/_root.${r}`:`${Ce(i.pathname)}.${r}`,i}async function en(e,t){if(e.id in t)return t[e.id];try{let n=await m(()=>import(e.module),[]);return t[e.id]=n,n}catch(t){return console.error(`Error loading route module \`${e.module}\`, reloading page...`),console.error(t),window.__reactRouterContext&&window.__reactRouterContext.isSpaMode,window.location.reload(),new Promise(()=>{})}}function tn(e){return e!=null&&typeof e.page==`string`}function nn(e){return e==null?!1:e.href==null?e.rel===`preload`&&typeof e.imageSrcSet==`string`&&typeof e.imageSizes==`string`:typeof e.rel==`string`&&typeof e.href==`string`}async function rn(e,t,n){return ln((await Promise.all(e.map(async e=>{let r=t.routes[e.route.id];if(r){let e=await en(r,n);return e.links?e.links():[]}return[]}))).flat(1).filter(nn).filter(e=>e.rel===`stylesheet`||e.rel===`preload`).map(e=>e.rel===`stylesheet`?{...e,rel:`prefetch`,as:`style`}:{...e,rel:`prefetch`}))}function an(e,t,n,r,i,a){let o=(e,t)=>!n[t]||e.route.id!==n[t].route.id,s=(e,t)=>n[t].pathname!==e.pathname||n[t].route.path?.endsWith(`*`)&&n[t].params[`*`]!==e.params[`*`];return a===`assets`?t.filter((e,t)=>o(e,t)||s(e,t)):a===`data`?t.filter((t,a)=>{let c=r.routes[t.route.id];if(!c||!c.hasLoader)return!1;if(o(t,a)||s(t,a))return!0;if(t.route.shouldRevalidate){let r=t.route.shouldRevalidate({currentUrl:new URL(i.pathname+i.search+i.hash,window.origin),currentParams:n[0]?.params||{},nextUrl:new URL(e,window.origin),nextParams:t.params,defaultShouldRevalidate:!0});if(typeof r==`boolean`)return r}return!0}):[]}function on(e,t,{includeHydrateFallback:n}={}){return sn(e.map(e=>{let r=t.routes[e.route.id];if(!r)return[];let i=[r.module];return r.clientActionModule&&(i=i.concat(r.clientActionModule)),r.clientLoaderModule&&(i=i.concat(r.clientLoaderModule)),n&&r.hydrateFallbackModule&&(i=i.concat(r.hydrateFallbackModule)),r.imports&&(i=i.concat(r.imports)),i}).flat(1))}function sn(e){return[...new Set(e)]}function cn(e){let t={},n=Object.keys(e).sort();for(let r of n)t[r]=e[r];return t}function ln(e,t){let n=new Set,r=new Set(t);return e.reduce((e,i)=>{if(t&&!tn(i)&&i.as===`script`&&i.href&&r.has(i.href))return e;let a=JSON.stringify(cn(i));return n.has(a)||(n.add(a),e.push({key:a,link:i})),e},[])}function un(){let e=h.useContext(Ve);return Qt(e,`You must render this element inside a <DataRouterContext.Provider> element`),e}function dn(){let e=h.useContext(He);return Qt(e,`You must render this element inside a <DataRouterStateContext.Provider> element`),e}var fn=h.createContext(void 0);fn.displayName=`FrameworkContext`;function pn(){let e=h.useContext(fn);return Qt(e,`You must render this element inside a <HydratedRouter> element`),e}function mn(e,t){let n=h.useContext(fn),[r,i]=h.useState(!1),[a,o]=h.useState(!1),{onFocus:s,onBlur:c,onMouseEnter:l,onMouseLeave:u,onTouchStart:d}=t,f=h.useRef(null);h.useEffect(()=>{if(e===`render`&&o(!0),e===`viewport`){let e=new IntersectionObserver(e=>{e.forEach(e=>{o(e.isIntersecting)})},{threshold:.5});return f.current&&e.observe(f.current),()=>{e.disconnect()}}},[e]),h.useEffect(()=>{if(r){let e=setTimeout(()=>{o(!0)},100);return()=>{clearTimeout(e)}}},[r]);let p=()=>{i(!0)},m=()=>{i(!1),o(!1)};return n?e===`intent`?[a,f,{onFocus:hn(s,p),onBlur:hn(c,m),onMouseEnter:hn(l,p),onMouseLeave:hn(u,m),onTouchStart:hn(d,p)}]:[a,f,{}]:[!1,f,{}]}function hn(e,t){return n=>{e&&e(n),n.defaultPrevented||t(n)}}function gn({page:e,...t}){let n=We(),{nonce:r}=pn(),{router:i}=un(),a=h.useMemo(()=>k(i.routes,e,i.basename),[i.routes,e,i.basename]);return a?(t.nonce==null&&r&&(t={...t,nonce:r}),n?h.createElement(vn,{page:e,matches:a,...t}):h.createElement(yn,{page:e,matches:a,...t})):null}function _n(e){let{manifest:t,routeModules:n}=pn(),[r,i]=h.useState([]);return h.useEffect(()=>{let r=!1;return rn(e,t,n).then(e=>{r||i(e)}),()=>{r=!0}},[e,t,n]),r}function vn({page:e,matches:t,...n}){let r=it(),{future:i}=pn(),{basename:a}=un(),o=h.useMemo(()=>{if(e===r.pathname+r.search+r.hash)return[];let n=$t(e,a,i.v8_trailingSlashAwareDataRequests,`rsc`),o=!1,s=[];for(let e of t)typeof e.route.shouldRevalidate==`function`?o=!0:s.push(e.route.id);return o&&s.length>0&&n.searchParams.set(`_routes`,s.join(`,`)),[n.pathname+n.search]},[a,i.v8_trailingSlashAwareDataRequests,e,r,t]);return h.createElement(h.Fragment,null,o.map(e=>h.createElement(`link`,{key:e,rel:`prefetch`,as:`fetch`,href:e,...n})))}function yn({page:e,matches:t,...n}){let r=it(),{future:i,manifest:a,routeModules:o}=pn(),{basename:s}=un(),{loaderData:c,matches:l}=dn(),u=h.useMemo(()=>an(e,t,l,a,r,`data`),[e,t,l,a,r]),d=h.useMemo(()=>an(e,t,l,a,r,`assets`),[e,t,l,a,r]),f=h.useMemo(()=>{if(e===r.pathname+r.search+r.hash)return[];let n=new Set,l=!1;if(t.forEach(e=>{let t=a.routes[e.route.id];t&&t.hasLoader&&(!u.some(t=>t.route.id===e.route.id)&&e.route.id in c&&o[e.route.id]?.shouldRevalidate||t.hasClientLoader?l=!0:n.add(e.route.id))}),n.size===0)return[];let d=$t(e,s,i.v8_trailingSlashAwareDataRequests,`data`);return l&&n.size>0&&d.searchParams.set(`_routes`,t.filter(e=>n.has(e.route.id)).map(e=>e.route.id).join(`,`)),[d.pathname+d.search]},[s,i.v8_trailingSlashAwareDataRequests,c,r,a,u,t,e,o]),p=h.useMemo(()=>on(d,a),[d,a]),m=_n(d);return h.createElement(h.Fragment,null,f.map(e=>h.createElement(`link`,{key:e,rel:`prefetch`,as:`fetch`,href:e,...n})),p.map(e=>h.createElement(`link`,{key:e,rel:`modulepreload`,href:e,...n})),m.map(({key:e,link:t})=>h.createElement(`link`,{key:e,nonce:n.nonce,...t,crossOrigin:t.crossOrigin??n.crossOrigin})))}function bn(...e){return t=>{e.forEach(e=>{typeof e==`function`?e(t):e!=null&&(e.current=t)})}}h.Component;var xn=typeof window<`u`&&window.document!==void 0&&window.document.createElement!==void 0;try{xn&&(window.__reactRouterVersion=`7.18.4`)}catch{}function Sn({basename:e,children:t,useTransitions:n,window:r}){let i=h.useRef();i.current??=x({window:r,v5Compat:!0});let a=i.current,[o,s]=h.useState({action:a.action,location:a.location}),c=h.useCallback(e=>{n===!1?s(e):h.startTransition(()=>s(e))},[n]);return h.useLayoutEffect(()=>a.listen(c),[a,c]),h.createElement(Ft,{basename:e,children:t,location:o.location,navigationType:o.action,navigator:a,useTransitions:n})}var B=h.forwardRef(function({onClick:e,discover:t=`render`,prefetch:n=`none`,relative:r,reloadDocument:i,replace:a,mask:o,state:s,target:c,to:l,preventScrollReset:u,viewTransition:d,defaultShouldRevalidate:f,...p},m){let{basename:_,navigator:v,useTransitions:y}=h.useContext(Je),b=typeof l==`string`&&g.test(l),x=je(l,_);l=x.to;let S=nt(l,{relative:r}),C=it(),w=null;if(o){let e=be(o,[],C.mask?C.mask.pathname:`/`,!0);_!==`/`&&(e.pathname=e.pathname===`/`?_:Se([_,e.pathname])),w=v.createHref(e)}let[T,E,D]=mn(n,p),ee=Dn(l,{replace:a,mask:o,state:s,target:c,preventScrollReset:u,relative:r,viewTransition:d,defaultShouldRevalidate:f,useTransitions:y});function O(t){e&&e(t),t.defaultPrevented||ee(t)}let te=!(x.isExternal||i),k=h.createElement(`a`,{...p,...D,href:(te?w:void 0)||x.absoluteURL||S,onClick:te?O:e,ref:bn(m,E),target:c,"data-discover":!b&&t===`render`?`true`:void 0});return T&&!b?h.createElement(h.Fragment,null,k,h.createElement(gn,{page:S})):k});B.displayName=`Link`;var Cn=h.forwardRef(function({"aria-current":e=`page`,caseSensitive:t=!1,className:n=``,end:r=!1,style:i,to:a,viewTransition:o,children:s,...c},l){let u=ft(a,{relative:c.relative}),d=it(),f=h.useContext(He),{navigator:p,basename:m}=h.useContext(Je),g=f!=null&&Nn(u)&&o===!0,_=p.encodeLocation?p.encodeLocation(u).pathname:u.pathname,v=d.pathname,y=f&&f.navigation&&f.navigation.location?f.navigation.location.pathname:null;t||(v=v.toLowerCase(),y=y?y.toLowerCase():null,_=_.toLowerCase()),y&&m&&(y=he(y,m)||y);let b=_!==`/`&&_.endsWith(`/`)?_.length-1:_.length,x=v===_||!r&&v.startsWith(_)&&v.charAt(b)===`/`,S=y!=null&&(y===_||!r&&y.startsWith(_)&&y.charAt(_.length)===`/`),C={isActive:x,isPending:S,isTransitioning:g},w=x?e:void 0,T;T=typeof n==`function`?n(C):[n,x?`active`:null,S?`pending`:null,g?`transitioning`:null].filter(Boolean).join(` `);let E=typeof i==`function`?i(C):i;return h.createElement(B,{...c,"aria-current":w,className:T,ref:l,style:E,to:a,viewTransition:o},typeof s==`function`?s(C):s)});Cn.displayName=`NavLink`;var wn=h.forwardRef(({discover:e=`render`,fetcherKey:t,navigate:n,reloadDocument:r,replace:i,state:a,method:o=Rt,action:s,onSubmit:c,relative:l,preventScrollReset:u,viewTransition:d,defaultShouldRevalidate:f,...p},m)=>{let{useTransitions:_}=h.useContext(Je),v=jn(),y=Mn(s,{relative:l}),b=o.toLowerCase()===`get`?`get`:`post`,x=typeof s==`string`&&g.test(s);return h.createElement(`form`,{ref:m,method:b,action:y,onSubmit:r?c:e=>{if(c&&c(e),e.defaultPrevented)return;e.preventDefault();let r=e.nativeEvent.submitter,s=r?.getAttribute(`formmethod`)||o,p=()=>v(r||e.currentTarget,{fetcherKey:t,method:s,navigate:n,replace:i,state:a,relative:l,preventScrollReset:u,viewTransition:d,defaultShouldRevalidate:f});_&&n!==!1?h.startTransition(()=>p()):p()},...p,"data-discover":!x&&e===`render`?`true`:void 0})});wn.displayName=`Form`;function Tn(e){return`${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function En(e){let t=h.useContext(Ve);return S(t,Tn(e)),t}function Dn(e,{target:t,replace:n,mask:r,state:i,preventScrollReset:a,relative:o,viewTransition:s,defaultShouldRevalidate:c,useTransitions:l}={}){let u=st(),d=it(),f=ft(e,{relative:o});return h.useCallback(p=>{if(Wt(p,t)){p.preventDefault();let t=n===void 0?D(d)===D(f):n,m=()=>u(e,{replace:t,mask:r,state:i,preventScrollReset:a,relative:o,viewTransition:s,defaultShouldRevalidate:c});l?h.startTransition(()=>m()):m()}},[d,u,f,n,r,i,t,e,a,o,s,c,l])}function On(e){C(typeof URLSearchParams<`u`,"You cannot use the `useSearchParams` hook in a browser that does not support the URLSearchParams API. If you need to support Internet Explorer 11, we recommend you load a polyfill such as https://github.com/ungap/url-search-params.");let t=h.useRef(Gt(e)),n=h.useRef(!1),r=it(),i=h.useMemo(()=>Kt(r.search,n.current?null:t.current),[r.search]),a=st();return[i,h.useCallback((e,t)=>{let r=Gt(typeof e==`function`?e(new URLSearchParams(i)):e);n.current=!0,a(`?`+r,t)},[a,i])]}var kn=0,An=()=>`__${String(++kn)}__`;function jn(){let{router:e}=En(`useSubmit`),{basename:t}=h.useContext(Je),n=Dt(),r=e.fetch,i=e.navigate;return h.useCallback(async(e,a={})=>{let{action:o,method:s,encType:c,formData:l,body:u}=Zt(e,t);if(a.navigate===!1){let e=a.fetcherKey||An();await r(e,n,a.action||o,{defaultShouldRevalidate:a.defaultShouldRevalidate,preventScrollReset:a.preventScrollReset,formData:l,body:u,formMethod:a.method||s,formEncType:a.encType||c,flushSync:a.flushSync})}else await i(a.action||o,{defaultShouldRevalidate:a.defaultShouldRevalidate,preventScrollReset:a.preventScrollReset,formData:l,body:u,formMethod:a.method||s,formEncType:a.encType||c,replace:a.replace,state:a.state,fromRouteId:n,flushSync:a.flushSync,viewTransition:a.viewTransition})},[r,i,t,n])}function Mn(e,{relative:t}={}){let{basename:n}=h.useContext(Je),r=h.useContext(L);S(r,`useFormAction must be used inside a RouteContext`);let[i]=r.matches.slice(-1),a={...ft(e||`.`,{relative:t})},o=it();if(e==null){a.search=o.search;let e=new URLSearchParams(a.search),t=e.getAll(`index`);if(t.some(e=>e===``)){e.delete(`index`),t.filter(e=>e).forEach(t=>e.append(`index`,t));let n=e.toString();a.search=n?`?${n}`:``}}return(!e||e===`.`)&&i.route.index&&(a.search=a.search?a.search.replace(/^\?/,`?index&`):`?index`),n!==`/`&&(a.pathname=a.pathname===`/`?n:Se([n,a.pathname])),D(a)}function Nn(e,{relative:t}={}){let n=h.useContext(Ge);S(n!=null,"`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?");let{basename:r}=En(`useViewTransitionState`),i=ft(e,{relative:t});if(!n.isTransitioning)return!1;let a=he(n.currentLocation.pathname,r)||n.currentLocation.pathname,o=he(n.nextLocation.pathname,r)||n.nextLocation.pathname;return pe(i.pathname,o)!=null||pe(i.pathname,a)!=null}var Pn=o((e=>{var t=u();function n(e){var t=`https://react.dev/errors/`+e;if(1<arguments.length){t+=`?args[]=`+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+=`&args[]=`+encodeURIComponent(arguments[n])}return`Minified React error #`+e+`; visit `+t+` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`}function r(){}var i={d:{f:r,r:function(){throw Error(n(522))},D:r,C:r,L:r,m:r,X:r,S:r,M:r},p:0,findDOMNode:null},a=Symbol.for(`react.portal`),o=Symbol.for(`react.recoverable`),s=Symbol.for(`react.optimistic_key`);function c(e,t,n){var r=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:a,key:r==null?null:r===s?s:``+r,children:e,containerInfo:t,implementation:n}}var l=t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function d(e,t){if(e===`font`)return``;if(typeof t==`string`)return t===`use-credentials`?t:``}e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=i,e.browser=function(e){return{$$typeof:o,_reason:e}},e.createPortal=function(e,t){var r=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11)throw Error(n(299));return c(e,t,null,r)},e.flushSync=function(e){var t=l.T,n=i.p;try{if(l.T=null,i.p=2,e)return e()}finally{l.T=t,i.p=n,i.d.f()}},e.preconnect=function(e,t){typeof e==`string`&&(t?(t=t.crossOrigin,t=typeof t==`string`?t===`use-credentials`?t:``:void 0):t=null,i.d.C(e,t))},e.prefetchDNS=function(e){typeof e==`string`&&i.d.D(e)},e.preinit=function(e,t){if(typeof e==`string`&&t&&typeof t.as==`string`){var n=t.as,r=d(n,t.crossOrigin),a=typeof t.integrity==`string`?t.integrity:void 0,o=typeof t.fetchPriority==`string`?t.fetchPriority:void 0;n===`style`?i.d.S(e,typeof t.precedence==`string`?t.precedence:void 0,{crossOrigin:r,integrity:a,fetchPriority:o}):n===`script`&&i.d.X(e,{crossOrigin:r,integrity:a,fetchPriority:o,nonce:typeof t.nonce==`string`?t.nonce:void 0})}},e.preinitModule=function(e,t){if(typeof e==`string`){if(typeof t==`object`&&t){if(t.as==null||t.as===`script`){var n=d(t.as,t.crossOrigin);i.d.M(e,{crossOrigin:n,integrity:typeof t.integrity==`string`?t.integrity:void 0,nonce:typeof t.nonce==`string`?t.nonce:void 0,fetchPriority:typeof t.fetchPriority==`string`?t.fetchPriority:void 0})}}else t??i.d.M(e)}},e.preload=function(e,t){if(typeof e==`string`&&typeof t==`object`&&t&&typeof t.as==`string`){var n=t.as,r=d(n,t.crossOrigin);i.d.L(e,n,{crossOrigin:r,integrity:typeof t.integrity==`string`?t.integrity:void 0,nonce:typeof t.nonce==`string`?t.nonce:void 0,type:typeof t.type==`string`?t.type:void 0,fetchPriority:typeof t.fetchPriority==`string`?t.fetchPriority:void 0,referrerPolicy:typeof t.referrerPolicy==`string`?t.referrerPolicy:void 0,imageSrcSet:typeof t.imageSrcSet==`string`?t.imageSrcSet:void 0,imageSizes:typeof t.imageSizes==`string`?t.imageSizes:void 0,media:typeof t.media==`string`?t.media:void 0})}},e.preloadModule=function(e,t){if(typeof e==`string`){if(t){var n=d(t.as,t.crossOrigin);i.d.m(e,{as:typeof t.as==`string`&&t.as!==`script`?t.as:void 0,crossOrigin:n,integrity:typeof t.integrity==`string`?t.integrity:void 0,nonce:typeof t.nonce==`string`?t.nonce:void 0,fetchPriority:typeof t.fetchPriority==`string`?t.fetchPriority:void 0})}else i.d.m(e)}},e.requestFormReset=function(e){i.d.r(e)},e.unstable_batchedUpdates=function(e,t){return e(t)},e.useFormState=function(e,t,n){return l.H.useFormState(e,t,n)},e.useFormStatus=function(){return l.H.useHostTransitionStatus()},e.version=`19.3.0`})),Fn=o(((e,t)=>{function n(){if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<`u`&&typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE==`function`)try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(e){console.error(e)}}n(),t.exports=Pn()})),In=o((e=>{function t(e,t){var n=e.length;e.push(t);a:for(;0<n;){var r=n-1>>>1,a=e[r];if(0<i(a,t))e[r]=t,e[n]=a,n=r;else break a}}function n(e){return e.length===0?null:e[0]}function r(e){if(e.length===0)return null;var t=e[0],n=e.pop();if(n!==t){e[0]=n;a:for(var r=0,a=e.length,o=a>>>1;r<o;){var s=2*(r+1)-1,c=e[s],l=s+1,u=e[l];if(0>i(c,n))l<a&&0>i(u,c)?(e[r]=u,e[l]=n,r=l):(e[r]=c,e[s]=n,r=s);else if(l<a&&0>i(u,n))e[r]=u,e[l]=n,r=l;else break a}}return t}function i(e,t){var n=e.sortIndex-t.sortIndex;return n===0?e.id-t.id:n}if(e.unstable_now=void 0,typeof performance==`object`&&typeof performance.now==`function`){var a=performance;e.unstable_now=function(){return a.now()}}else{var o=Date,s=o.now();e.unstable_now=function(){return o.now()-s}}var c=[],l=[],u=1,d=null,f=3,p=!1,m=!1,h=!1,g=!1,_=typeof setTimeout==`function`?setTimeout:null,v=typeof clearTimeout==`function`?clearTimeout:null,y=typeof setImmediate<`u`?setImmediate:null;function b(e){for(var i=n(l);i!==null;){if(i.callback===null)r(l);else if(i.startTime<=e)r(l),i.sortIndex=i.expirationTime,t(c,i);else break;i=n(l)}}function x(e){if(h=!1,b(e),!m){if(n(c)!==null)m=!0,S||(S=!0,ee());else{var t=n(l);t!==null&&k(x,t.startTime-e)}}}var S=!1,C=-1,w=5,T=-1;function E(){return g?!0:!(e.unstable_now()-T<w)}function D(){if(g=!1,S){var t=e.unstable_now();T=t;var i=!0;try{a:{m=!1,h&&(h=!1,v(C),C=-1),p=!0;var a=f;try{b:{for(b(t),d=n(c);d!==null&&!(d.expirationTime>t&&E());){var o=d.callback;if(typeof o==`function`){d.callback=null,f=d.priorityLevel;var s=o(d.expirationTime<=t);if(t=e.unstable_now(),typeof s==`function`){d.callback=s,b(t),i=!0;break b}d===n(c)&&r(c),b(t)}else r(c);d=n(c)}if(d!==null)i=!0;else{var u=n(l);u!==null&&k(x,u.startTime-t),i=!1}}break a}finally{d=null,f=a,p=!1}i=void 0}}finally{i?ee():S=!1}}}var ee;if(typeof y==`function`)ee=function(){y(D)};else if(typeof MessageChannel<`u`){var O=new MessageChannel,te=O.port2;O.port1.onmessage=D,ee=function(){te.postMessage(null)}}else ee=function(){_(D,0)};function k(t,n){C=_(function(){t(e.unstable_now())},n)}e.unstable_IdlePriority=5,e.unstable_ImmediatePriority=1,e.unstable_LowPriority=4,e.unstable_NormalPriority=3,e.unstable_Profiling=null,e.unstable_UserBlockingPriority=2,e.unstable_cancelCallback=function(e){e.callback=null},e.unstable_forceFrameRate=function(e){0>e||125<e?console.error(`forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported`):w=0<e?Math.floor(1e3/e):5},e.unstable_getCurrentPriorityLevel=function(){return f},e.unstable_next=function(e){switch(f){case 1:case 2:case 3:var t=3;break;default:t=f}var n=f;f=t;try{return e()}finally{f=n}},e.unstable_requestPaint=function(){g=!0},e.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=f;f=e;try{return t()}finally{f=n}},e.unstable_scheduleCallback=function(r,i,a){var o=e.unstable_now();switch(typeof a==`object`&&a?(a=a.delay,a=typeof a==`number`&&0<a?o+a:o):a=o,r){case 1:var s=-1;break;case 2:s=250;break;case 5:s=1073741823;break;case 4:s=1e4;break;default:s=5e3}return s=a+s,r={id:u++,callback:i,priorityLevel:r,startTime:a,expirationTime:s,sortIndex:-1},a>o?(r.sortIndex=a,t(l,r),n(c)===null&&r===n(l)&&(h?(v(C),C=-1):h=!0,k(x,a-o))):(r.sortIndex=s,t(c,r),m||p||(m=!0,S||(S=!0,ee()))),r},e.unstable_shouldYield=E,e.unstable_wrapCallback=function(e){var t=f;return function(){var n=f;f=t;try{return e.apply(this,arguments)}finally{f=n}}}})),Ln=o(((e,t)=>{t.exports=In()})),Rn=o((e=>{var t=Ln(),n=u(),r=Fn();function i(e){var t=`https://react.dev/errors/`+e;if(1<arguments.length){t+=`?args[]=`+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+=`&args[]=`+encodeURIComponent(arguments[n])}return`Minified React error #`+e+`; visit `+t+` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`}function a(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function o(e){for(var t=e,n=t;n&&!n.alternate;)t=n,t.flags&4098&&(e=t.return),n=t.return;for(;t.return;)t=t.return;return t.tag===3?e:null}function s(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function c(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function l(e){if(o(e)!==e)throw Error(i(188))}function d(e){var t=e.alternate;if(!t){if(t=o(e),t===null)throw Error(i(188));return t===e?e:null}for(var n=e,r=t;;){var a=n.return;if(a===null)break;var s=a.alternate;if(s===null){if(r=a.return,r!==null){n=r;continue}break}if(a.child===s.child){for(s=a.child;s;){if(s===n)return l(a),e;if(s===r)return l(a),t;s=s.sibling}throw Error(i(188))}if(n.return!==r.return)n=a,r=s;else{for(var c=!1,u=a.child;u;){if(u===n){c=!0,n=a,r=s;break}if(u===r){c=!0,r=a,n=s;break}u=u.sibling}if(!c){for(u=s.child;u;){if(u===n){c=!0,n=s,r=a;break}if(u===r){c=!0,r=s,n=a;break}u=u.sibling}if(!c)throw Error(i(189))}}if(n.alternate!==r)throw Error(i(190))}if(n.tag!==3)throw Error(i(188));return n.stateNode.current===n?e:t}function f(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=f(e),t!==null)return t;e=e.sibling}return null}function p(e,t,n,r,i,a){for(;e!==null;){if((e.tag===5||e.tag===27||e.tag===6)&&n(e,r,i,a)||(e.tag!==22||e.memoizedState===null)&&(t||e.tag!==5&&e.tag!==27)&&p(e.child,t,n,r,i,a))return!0;e=e.sibling}return!1}function m(e){for(e=e.return;e!==null;){if(e.tag===3||e.tag===5||e.tag===27)return e;e=e.return}return null}function h(e){var t=!1;for(e=e.return;e!==null&&(e.tag===4&&(t=!0),e.tag!==3&&e.tag!==5&&e.tag!==27);)e=e.return;return t}function g(e){var t=[null,null],n=m(e);return n===null||_(t,e,n.child,{foundSelf:!1}),t}function _(e,t,n,r){for(;n!==null;){if(n===t)r.foundSelf=!0;else if(n.tag===5||n.tag===27||n.tag===6){if(r.foundSelf)return e[1]=n,!0;e[0]=n}else if((n.tag!==22||n.memoizedState===null)&&_(e,t,n.child,r))return!0;n=n.sibling}return!1}function v(e){switch(e.tag){case 5:case 27:case 6:return e.stateNode;case 3:return e.stateNode.containerInfo;default:throw Error(i(559))}}var y=null,b=null;function x(e,t,n){return e===n||e===t&&(y=e,!0)}function S(e,t,n){return e===n?(b=e,!1):e===t&&(b!==null&&(y=e),!0)}function C(e){if(e===null)return null;do e=e===null?null:e.return;while(e&&e.tag!==5&&e.tag!==27&&e.tag!==3);return e||null}function w(e,t,n){for(var r=0,i=e;i;i=n(i))r++;i=0;for(var a=t;a;a=n(a))i++;for(;0<r-i;)e=n(e),r--;for(;0<i-r;)t=n(t),i--;for(;r--;){if(e===t||t!==null&&e===t.alternate)return e;e=n(e),t=n(t)}return null}var T=Object.assign,E=Symbol.for(`react.element`),D=Symbol.for(`react.transitional.element`),ee=Symbol.for(`react.portal`),O=Symbol.for(`react.fragment`),te=Symbol.for(`react.strict_mode`),k=Symbol.for(`react.profiler`),A=Symbol.for(`react.consumer`),ne=Symbol.for(`react.context`),re=Symbol.for(`react.forward_ref`),ie=Symbol.for(`react.suspense`),ae=Symbol.for(`react.suspense_list`),oe=Symbol.for(`react.memo`),j=Symbol.for(`react.lazy`),M=Symbol.for(`react.activity`),N=Symbol.for(`react.legacy_hidden`),se=Symbol.for(`react.memo_cache_sentinel`),ce=Symbol.for(`react.view_transition`),le=Symbol.for(`react.recoverable`),ue=Symbol.iterator;function de(e){return typeof e!=`object`||!e?null:(e=ue&&e[ue]||e[`@@iterator`],typeof e==`function`?e:null)}var fe=Symbol.for(`react.client.reference`);function pe(e){if(e==null)return null;if(typeof e==`function`)return e.$$typeof===fe?null:e.displayName||e.name||null;if(typeof e==`string`)return e;switch(e){case O:return`Fragment`;case k:return`Profiler`;case te:return`StrictMode`;case ie:return`Suspense`;case ae:return`SuspenseList`;case M:return`Activity`;case ce:return`ViewTransition`}if(typeof e==`object`)switch(e.$$typeof){case ee:return`Portal`;case ne:return e.displayName||`Context`;case A:return(e._context.displayName||`Context`)+`.Consumer`;case re:var t=e.render;return e=e.displayName,e||=(e=t.displayName||t.name||``,e===``?`ForwardRef`:`ForwardRef(`+e+`)`),e;case oe:return t=e.displayName||null,t===null?pe(e.type)||`Memo`:t;case j:t=e._payload,e=e._init;try{return pe(e(t))}catch{}}return null}var me=Array.isArray,P=n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,F=r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,he={pending:!1,data:null,method:null,action:null},ge=[],_e=-1;function ve(e){return{current:e}}function ye(e){0>_e||(e.current=ge[_e],ge[_e]=null,_e--)}function I(e,t){_e++,ge[_e]=e.current,e.current=t}var be=ve(null),xe=ve(null),Se=ve(null),Ce=ve(null);function we(e,t){switch(I(Se,t),I(xe,e),I(be,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?up(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=up(t),e=dp(t,e);else switch(e){case`svg`:e=1;break;case`math`:e=2;break;default:e=0}}ye(be),I(be,e)}function Te(){ye(be),ye(xe),ye(Se)}function Ee(e){var t=e.memoizedState;t!==null&&(sh._currentValue=t.memoizedState,I(Ce,e)),t=be.current;var n=dp(t,e.type);t!==n&&(I(xe,e),I(be,n))}function De(e){xe.current===e&&(ye(be),ye(xe)),Ce.current===e&&(ye(Ce),sh._currentValue=he)}var Oe,ke;function Ae(e){if(Oe===void 0)try{throw Error()}catch(e){var t=e.stack.trim().match(/\n( *(at )?)/);Oe=t&&t[1]||``,ke=-1<e.stack.indexOf(`
    at`)?` (<anonymous>)`:-1<e.stack.indexOf(`@`)?`@unknown:0:0`:``}return`
`+Oe+e+ke}var je=!1;function Me(e,t){if(!e||je)return``;je=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var r={DetermineComponentFrameRoot:function(){try{if(t){var n=function(){throw Error()};if(Object.defineProperty(n.prototype,"props",{set:function(){throw Error()}}),typeof Reflect==`object`&&Reflect.construct){try{Reflect.construct(n,[])}catch(e){var r=e}Reflect.construct(e,[],n)}else{try{n.call()}catch(e){r=e}n=!1;try{var i=Object.getOwnPropertyDescriptor(e.prototype,`props`);Object.defineProperty(e.prototype,"props",{configurable:!0,set:function(){throw Error()}}),n=!0,new e}finally{n&&(i===void 0?delete e.prototype.props:Object.defineProperty(e.prototype,"props",i))}}}else{try{throw Error()}catch(e){r=e}(n=e())&&typeof n.catch==`function`&&n.catch(function(){})}}catch(e){if(e&&r&&typeof e.stack==`string`)return[e.stack,r.stack]}return[null,null]}};r.DetermineComponentFrameRoot.displayName=`DetermineComponentFrameRoot`;var i=Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot,`name`);i&&i.configurable&&Object.defineProperty(r.DetermineComponentFrameRoot,"name",{value:`DetermineComponentFrameRoot`});var a=r.DetermineComponentFrameRoot(),o=a[0],s=a[1];if(o&&s){var c=o.split(`
`),l=s.split(`
`);for(i=r=0;r<c.length&&!c[r].includes(`DetermineComponentFrameRoot`);)r++;for(;i<l.length&&!l[i].includes(`DetermineComponentFrameRoot`);)i++;if(r===c.length||i===l.length)for(r=c.length-1,i=l.length-1;1<=r&&0<=i&&c[r]!==l[i];)i--;for(;1<=r&&0<=i;r--,i--)if(c[r]!==l[i]){if(r!==1||i!==1)do if(r--,i--,0>i||c[r]!==l[i]){var u=`
`+c[r].replace(` at new `,` at `);return e.displayName&&u.includes(`<anonymous>`)&&(u=u.replace(`<anonymous>`,e.displayName)),u}while(1<=r&&0<=i);break}}}finally{je=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:``)?Ae(n):``}function Ne(e,t){switch(e.tag){case 26:case 27:case 5:return Ae(e.type);case 16:return Ae(`Lazy`);case 13:return e.child!==t&&t!==null?Ae(`Suspense Fallback`):Ae(`Suspense`);case 19:return Ae(`SuspenseList`);case 0:case 15:return Me(e.type,!1);case 11:return Me(e.type.render,!1);case 1:return Me(e.type,!0);case 31:return Ae(`Activity`);case 30:return Ae(`ViewTransition`);default:return``}}function Pe(e){try{var t=``,n=null;do t+=Ne(e,n),n=e,e=e.return;while(e);return t}catch(e){return`
Error generating stack: `+e.message+`
`+e.stack}}var Fe=Object.prototype.hasOwnProperty,Ie=t.unstable_scheduleCallback,Le=t.unstable_cancelCallback,Re=t.unstable_shouldYield,ze=t.unstable_requestPaint,Be=t.unstable_now,Ve=t.unstable_getCurrentPriorityLevel,He=t.unstable_ImmediatePriority,Ue=t.unstable_UserBlockingPriority,We=t.unstable_NormalPriority,Ge=t.unstable_LowPriority,Ke=t.unstable_IdlePriority,qe=t.log,Je=t.unstable_setDisableYieldValue,Ye=null,L=null;function Xe(e){if(typeof qe==`function`&&Je(e),L&&typeof L.setStrictMode==`function`)try{L.setStrictMode(Ye,e)}catch{}}var Ze=Math.clz32?Math.clz32:et,Qe=Math.log,$e=Math.LN2;function et(e){return e>>>=0,e===0?32:31-(Qe(e)/$e|0)|0}var tt=256,nt=262144,rt=4194304;function it(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&-e;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function at(e,t,n){var r=e.pendingLanes;if(r===0)return 0;var i=0,a=e.suspendedLanes,o=e.pingedLanes;e=e.warmLanes;var s=r&134217727;return s===0?(s=r&~a,s===0?o===0?n||(n=r&~e,n!==0&&(i=it(n))):i=it(o):i=it(s)):(r=s&~a,r===0?(o&=s,o===0?n||(n=s&~e,n!==0&&(i=it(n))):i=it(o)):i=it(r)),i===0?0:t!==0&&t!==i&&(t&a)===0&&(a=i&-i,n=t&-t,a>=n||a===32&&n&4194048)?t:i}function ot(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function st(e,t){t&8&&(t|=t&32);var n=e.entangledLanes;if(n!==0)for(e=e.entanglements,n&=t;0<n;){var r=31-Ze(n),i=1<<r;t|=e[r],n&=~i}return t}function ct(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function lt(){var e=rt;return rt<<=1,!(rt&62914560)&&(rt=4194304),e}function ut(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function dt(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function ft(e,t,n,r,i,a){var o=e.pendingLanes;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=n,e.entangledLanes&=n,e.errorRecoveryDisabledLanes&=n,e.shellSuspendCounter=0;var s=e.entanglements,c=e.expirationTimes,l=e.hiddenUpdates;for(n=o&~n;0<n;){var u=31-Ze(n),d=1<<u;s[u]=0,c[u]=-1;var f=l[u];if(f!==null)for(l[u]=null,u=0;u<f.length;u++){var p=f[u];p!==null&&(p.lane&=-536870913)}n&=~d}r!==0&&pt(e,r,0),a!==0&&i===0&&e.tag!==0&&(e.suspendedLanes|=a&~(o&~t))}function pt(e,t,n){e.pendingLanes|=t,e.suspendedLanes&=~t;var r=31-Ze(t);e.entangledLanes|=t,e.entanglements[r]=e.entanglements[r]|1073741824|n&261930}function mt(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var r=31-Ze(n),i=1<<r;i&t|e[r]&t&&(e[r]|=t),n&=~i}}function ht(e,t){var n=t&-t;return n=n&42?1:gt(n),(n&(e.suspendedLanes|t))===0?n:0}function gt(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function _t(e){return e&=-e,2<e?8<e?e&134217727?32:268435456:8:2}function vt(){var e=F.p;return e===0?(e=window.event,e===void 0?32:Ch(e.type)):e}function yt(e,t){var n=F.p;try{return F.p=e,t()}finally{F.p=n}}var bt=Math.random().toString(36).slice(2),xt=`__reactFiber$`+bt,St=`__reactProps$`+bt,Ct=`__reactContainer$`+bt,wt=`__reactEvents$`+bt,Tt=`__reactListeners$`+bt,Et=`__reactHandles$`+bt,Dt=`__reactResources$`+bt,Ot=`__reactMarker$`+bt,kt=`__reactLoad$`+bt;function At(e){delete e[xt],delete e[St],delete e[Tt],delete e[Et]}function jt(e){var t;if(t=e[xt])return t;for(var n=e.parentNode;n;){if(t=n[Ct]||n[xt]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=fm(e);e!==null;){if(n=e[xt])return n;e=fm(e)}return t}e=n,n=e.parentNode}return null}function Mt(e){if(e=e[xt]||e[Ct]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function Nt(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(i(33))}function Pt(e){var t=e[Dt];return t||=e[Dt]={hoistableStyles:new Map,hoistableScripts:new Map},t}function R(e){e[Ot]=!0}function Ft(e){e[kt]=void 0}var It=new Set,Lt={};function Rt(e,t){zt(e,t),zt(e+`Capture`,t)}function zt(e,t){for(Lt[e]=t,e=0;e<t.length;e++)It.add(t[e])}var Bt=RegExp(`^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$`),Vt={},Ht={};function Ut(e){return Fe.call(Ht,e)?!0:Fe.call(Vt,e)?!1:Bt.test(e)?Ht[e]=!0:(Vt[e]=!0,!1)}var z=!1;function Wt(){var e=z;return z=!1,e}function Gt(e,t,n){if(Ut(t)){if(n===null)e.removeAttribute(t);else{switch(typeof n){case`undefined`:case`function`:case`symbol`:e.removeAttribute(t);return;case`boolean`:var r=t.toLowerCase().slice(0,5);if(r!==`data-`&&r!==`aria-`){e.removeAttribute(t);return}}e.setAttribute(t,n)}}}function Kt(e,t,n){if(n===null)e.removeAttribute(t);else{switch(typeof n){case`undefined`:case`function`:case`symbol`:case`boolean`:e.removeAttribute(t);return}e.setAttribute(t,n)}}function qt(e,t,n,r){if(r===null)e.removeAttribute(n);else{switch(typeof r){case`undefined`:case`function`:case`symbol`:case`boolean`:e.removeAttribute(n);return}e.setAttributeNS(t,n,r)}}function Jt(e){switch(typeof e){case`bigint`:case`boolean`:case`number`:case`string`:case`undefined`:return e;case`object`:return e;default:return``}}function Yt(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()===`input`&&(t===`checkbox`||t===`radio`)}function Xt(e,t,n){var r=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&r!==void 0&&typeof r.get==`function`&&typeof r.set==`function`){var i=r.get,a=r.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return i.call(this)},set:function(e){n=``+e,a.call(this,e)}}),Object.defineProperty(e,t,{enumerable:r.enumerable}),{getValue:function(){return n},setValue:function(e){n=``+e},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Zt(e){if(!e._valueTracker){var t=Yt(e)?`checked`:`value`;e._valueTracker=Xt(e,t,``+e[t])}}function Qt(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),r=``;return e&&(r=Yt(e)?e.checked?`true`:`false`:e.value),e=r,e!==n&&(t.setValue(e),!0)}var $t=/[\n"\\]/g;function en(e){return e.replace($t,function(e){return`\\`+e.charCodeAt(0).toString(16)+` `})}function tn(e,t,n,r,i,a,o,s){e.name=``,o!=null&&typeof o!=`function`&&typeof o!=`symbol`&&typeof o!=`boolean`?e.type=o:e.removeAttribute(`type`),t==null?o!==`submit`&&o!==`reset`||e.removeAttribute(`value`):o===`number`?(t===0&&e.value===``||e.value!=t)&&(e.value=``+Jt(t)):e.value!==``+Jt(t)&&(e.value=``+Jt(t)),t==null?n==null?r!=null&&e.removeAttribute(`value`):rn(e,Jt(n)):o===`number`&&e.value==t?rn(e,Jt(e.value)):rn(e,Jt(t)),i==null&&a!=null&&(e.defaultChecked=!!a),i!=null&&(e.checked=i&&typeof i!=`function`&&typeof i!=`symbol`),s!=null&&typeof s!=`function`&&typeof s!=`symbol`&&typeof s!=`boolean`?e.name=``+Jt(s):e.removeAttribute(`name`)}function nn(e,t,n,r,i,a,o,s){if(a!=null&&typeof a!=`function`&&typeof a!=`symbol`&&typeof a!=`boolean`&&(e.type=a),t!=null||n!=null){if(!(a!==`submit`&&a!==`reset`||t!=null)){Zt(e);return}n=n==null?``:``+Jt(n),t=t==null?n:``+Jt(t),s||t===e.value||(e.value=t),e.defaultValue=t}r??=i,r=typeof r!=`function`&&typeof r!=`symbol`&&!!r,e.checked=s?e.checked:!!r,e.defaultChecked=!!r,o!=null&&typeof o!=`function`&&typeof o!=`symbol`&&typeof o!=`boolean`&&(e.name=o),Zt(e)}function rn(e,t){e.defaultValue!==``+t&&(e.defaultValue=``+t)}function an(e,t,n,r){if(e=e.options,t){t={};for(var i=0;i<n.length;i++)t[`$`+n[i]]=!0;for(n=0;n<e.length;n++)i=t.hasOwnProperty(`$`+e[n].value),e[n].selected!==i&&(e[n].selected=i),i&&r&&(e[n].defaultSelected=!0)}else{for(n=``+Jt(n),t=null,i=0;i<e.length;i++){if(e[i].value===n){e[i].selected=!0,r&&(e[i].defaultSelected=!0);return}t!==null||e[i].disabled||(t=e[i])}t!==null&&(t.selected=!0)}}function on(e,t,n){if(t!=null&&(t=``+Jt(t),t!==e.value&&(e.value=t),n==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=n==null?``:``+Jt(n)}function sn(e,t,n,r){if(t==null){if(r!=null){if(n!=null)throw Error(i(92));if(me(r)){if(1<r.length)throw Error(i(93));r=r[0]}n=r}n??=``,t=n}n=Jt(t),e.defaultValue=n,r=e.textContent,r===n&&r!==``&&r!==null&&(e.value=r),Zt(e)}function cn(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var ln=new Set(`animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp`.split(` `));function un(e,t,n){var r=t.indexOf(`--`)===0;n==null||typeof n==`boolean`||n===``?r?e.setProperty(t,``):t===`float`?e.cssFloat=``:e[t]=``:r?e.setProperty(t,n):typeof n!=`number`||n===0||ln.has(t)?t===`float`?e.cssFloat=n:e[t]=(``+n).trim():e[t]=n+`px`}function dn(e,t,n){if(t!=null&&typeof t!=`object`)throw Error(i(62));if(e=e.style,n!=null){for(var r in n)!n.hasOwnProperty(r)||t!=null&&t.hasOwnProperty(r)||(r.indexOf(`--`)===0?e.setProperty(r,``):r===`float`?e.cssFloat=``:e[r]=``,z=!0);for(var a in t)r=t[a],t.hasOwnProperty(a)&&n[a]!==r&&(un(e,a,r),z=!0)}else for(var o in t)t.hasOwnProperty(o)&&un(e,o,t[o])}function fn(e){if(e.indexOf(`-`)===-1)return!1;switch(e){case`annotation-xml`:case`color-profile`:case`font-face`:case`font-face-src`:case`font-face-uri`:case`font-face-format`:case`font-face-name`:case`missing-glyph`:return!1;default:return!0}}var pn=new Map([[`acceptCharset`,`accept-charset`],[`htmlFor`,`for`],[`httpEquiv`,`http-equiv`],[`crossOrigin`,`crossorigin`],[`accentHeight`,`accent-height`],[`alignmentBaseline`,`alignment-baseline`],[`arabicForm`,`arabic-form`],[`baselineShift`,`baseline-shift`],[`capHeight`,`cap-height`],[`clipPath`,`clip-path`],[`clipRule`,`clip-rule`],[`colorInterpolation`,`color-interpolation`],[`colorInterpolationFilters`,`color-interpolation-filters`],[`colorProfile`,`color-profile`],[`colorRendering`,`color-rendering`],[`dominantBaseline`,`dominant-baseline`],[`enableBackground`,`enable-background`],[`fillOpacity`,`fill-opacity`],[`fillRule`,`fill-rule`],[`floodColor`,`flood-color`],[`floodOpacity`,`flood-opacity`],[`fontFamily`,`font-family`],[`fontSize`,`font-size`],[`fontSizeAdjust`,`font-size-adjust`],[`fontStretch`,`font-stretch`],[`fontStyle`,`font-style`],[`fontVariant`,`font-variant`],[`fontWeight`,`font-weight`],[`glyphName`,`glyph-name`],[`glyphOrientationHorizontal`,`glyph-orientation-horizontal`],[`glyphOrientationVertical`,`glyph-orientation-vertical`],[`horizAdvX`,`horiz-adv-x`],[`horizOriginX`,`horiz-origin-x`],[`imageRendering`,`image-rendering`],[`letterSpacing`,`letter-spacing`],[`lightingColor`,`lighting-color`],[`markerEnd`,`marker-end`],[`markerMid`,`marker-mid`],[`markerStart`,`marker-start`],[`maskType`,`mask-type`],[`overlinePosition`,`overline-position`],[`overlineThickness`,`overline-thickness`],[`paintOrder`,`paint-order`],[`panose-1`,`panose-1`],[`pointerEvents`,`pointer-events`],[`renderingIntent`,`rendering-intent`],[`shapeRendering`,`shape-rendering`],[`stopColor`,`stop-color`],[`stopOpacity`,`stop-opacity`],[`strikethroughPosition`,`strikethrough-position`],[`strikethroughThickness`,`strikethrough-thickness`],[`strokeDasharray`,`stroke-dasharray`],[`strokeDashoffset`,`stroke-dashoffset`],[`strokeLinecap`,`stroke-linecap`],[`strokeLinejoin`,`stroke-linejoin`],[`strokeMiterlimit`,`stroke-miterlimit`],[`strokeOpacity`,`stroke-opacity`],[`strokeWidth`,`stroke-width`],[`textAnchor`,`text-anchor`],[`textDecoration`,`text-decoration`],[`textRendering`,`text-rendering`],[`transformOrigin`,`transform-origin`],[`underlinePosition`,`underline-position`],[`underlineThickness`,`underline-thickness`],[`unicodeBidi`,`unicode-bidi`],[`unicodeRange`,`unicode-range`],[`unitsPerEm`,`units-per-em`],[`vAlphabetic`,`v-alphabetic`],[`vHanging`,`v-hanging`],[`vIdeographic`,`v-ideographic`],[`vMathematical`,`v-mathematical`],[`vectorEffect`,`vector-effect`],[`vertAdvY`,`vert-adv-y`],[`vertOriginX`,`vert-origin-x`],[`vertOriginY`,`vert-origin-y`],[`wordSpacing`,`word-spacing`],[`writingMode`,`writing-mode`],[`xmlnsXlink`,`xmlns:xlink`],[`xHeight`,`x-height`]]),mn=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function hn(e){return mn.test(``+e)?`javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`:e}function gn(){}var _n=null;function vn(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var yn=null,bn=null;function xn(e){var t=Mt(e);if(t&&(e=t.stateNode)){var n=e[St]||null;a:switch(e=t.stateNode,t.type){case`input`:if(tn(e,n.value,n.defaultValue,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name),t=n.name,n.type===`radio`&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll(`input[name="`+en(``+t)+`"][type="radio"]`),t=0;t<n.length;t++){var r=n[t];if(r!==e&&r.form===e.form){var a=r[St]||null;if(!a)throw Error(i(90));tn(r,a.value,a.defaultValue,a.defaultValue,a.checked,a.defaultChecked,a.type,a.name)}}for(t=0;t<n.length;t++)r=n[t],r.form===e.form&&Qt(r)}break a;case`textarea`:on(e,n.value,n.defaultValue);break a;case`select`:t=n.value,t!=null&&an(e,!!n.multiple,t,!1)}}}var Sn=!1;function B(e,t,n){if(Sn)return e(t,n);Sn=!0;try{return e(t)}finally{if(Sn=!1,(yn!==null||bn!==null)&&(Ld(),yn&&(t=yn,e=bn,bn=yn=null,xn(t),e)))for(t=0;t<e.length;t++)xn(e[t])}}function Cn(e,t){var n=e.stateNode;if(n===null)return null;var r=n[St]||null;if(r===null)return null;n=r[t];a:switch(t){case`onClick`:case`onClickCapture`:case`onDoubleClick`:case`onDoubleClickCapture`:case`onMouseDown`:case`onMouseDownCapture`:case`onMouseMove`:case`onMouseMoveCapture`:case`onMouseUp`:case`onMouseUpCapture`:case`onMouseEnter`:(r=!r.disabled)||(e=e.type,r=e!==`button`&&e!==`input`&&e!==`select`&&e!==`textarea`),e=!r;break a;default:e=!1}if(e)return null;if(n&&typeof n!=`function`)throw Error(i(231,t,typeof n));return n}var wn=typeof window<`u`&&window.document!==void 0&&window.document.createElement!==void 0,Tn=!1;if(wn)try{var En={};Object.defineProperty(En,"passive",{get:function(){Tn=!0}}),window.addEventListener(`test`,En,En),window.removeEventListener(`test`,En,En)}catch{Tn=!1}var Dn=null,On=null,kn=null;function An(){if(kn)return kn;var e,t=On,n=t.length,r,i=`value`in Dn?Dn.value:Dn.textContent,a=i.length;for(e=0;e<n&&t[e]===i[e];e++);var o=n-e;for(r=1;r<=o&&t[n-r]===i[a-r];r++);return kn=i.slice(e,1<r?1-r:void 0)}function jn(e){var t=e.keyCode;return`charCode`in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Mn(){return!0}function Nn(){return!1}function Pn(e){function t(t,n,r,i,a){for(var o in this._reactName=t,this._targetInst=r,this.type=n,this.nativeEvent=i,this.target=a,this.currentTarget=null,e)e.hasOwnProperty(o)&&(t=e[o],this[o]=t?t(i):i[o]);return this.isDefaultPrevented=(i.defaultPrevented==null?!1===i.returnValue:i.defaultPrevented)?Mn:Nn,this.isPropagationStopped=Nn,this}return T(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var e=this.nativeEvent;e&&(e.preventDefault?e.preventDefault():typeof e.returnValue!=`unknown`&&(e.returnValue=!1),this.isDefaultPrevented=Mn)},stopPropagation:function(){var e=this.nativeEvent;e&&(e.stopPropagation?e.stopPropagation():typeof e.cancelBubble!=`unknown`&&(e.cancelBubble=!0),this.isPropagationStopped=Mn)},persist:function(){},isPersistent:Mn}),t}var In={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Rn=Pn(In),zn=T({},In,{view:0,detail:0}),Bn=Pn(zn),Vn,Hn,Un,Wn=T({},zn,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:er,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return`movementX`in e?e.movementX:(e!==Un&&(Un&&e.type===`mousemove`?(Vn=e.screenX-Un.screenX,Hn=e.screenY-Un.screenY):Hn=Vn=0,Un=e),Vn)},movementY:function(e){return`movementY`in e?e.movementY:Hn}}),V=Pn(Wn),Gn=Pn(T({},Wn,{dataTransfer:0})),Kn=Pn(T({},zn,{relatedTarget:0})),qn=Pn(T({},In,{animationName:0,elapsedTime:0,pseudoElement:0})),Jn=Pn(T({},In,{clipboardData:function(e){return`clipboardData`in e?e.clipboardData:window.clipboardData}})),Yn=Pn(T({},In,{data:0})),Xn={Esc:`Escape`,Spacebar:` `,Left:`ArrowLeft`,Up:`ArrowUp`,Right:`ArrowRight`,Down:`ArrowDown`,Del:`Delete`,Win:`OS`,Menu:`ContextMenu`,Apps:`ContextMenu`,Scroll:`ScrollLock`,MozPrintableKey:`Unidentified`},Zn={8:`Backspace`,9:`Tab`,12:`Clear`,13:`Enter`,16:`Shift`,17:`Control`,18:`Alt`,19:`Pause`,20:`CapsLock`,27:`Escape`,32:` `,33:`PageUp`,34:`PageDown`,35:`End`,36:`Home`,37:`ArrowLeft`,38:`ArrowUp`,39:`ArrowRight`,40:`ArrowDown`,45:`Insert`,46:`Delete`,112:`F1`,113:`F2`,114:`F3`,115:`F4`,116:`F5`,117:`F6`,118:`F7`,119:`F8`,120:`F9`,121:`F10`,122:`F11`,123:`F12`,144:`NumLock`,145:`ScrollLock`,224:`Meta`},Qn={Alt:`altKey`,Control:`ctrlKey`,Meta:`metaKey`,Shift:`shiftKey`};function $n(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=Qn[e])?!!t[e]:!1}function er(){return $n}var tr=Pn(T({},zn,{key:function(e){if(e.key){var t=Xn[e.key]||e.key;if(t!==`Unidentified`)return t}return e.type===`keypress`?(e=jn(e),e===13?`Enter`:String.fromCharCode(e)):e.type===`keydown`||e.type===`keyup`?Zn[e.keyCode]||`Unidentified`:``},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:er,charCode:function(e){return e.type===`keypress`?jn(e):0},keyCode:function(e){return e.type===`keydown`||e.type===`keyup`?e.keyCode:0},which:function(e){return e.type===`keypress`?jn(e):e.type===`keydown`||e.type===`keyup`?e.keyCode:0}})),nr=Pn(T({},Wn,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0})),rr=Pn(T({},In,{submitter:0})),ir=Pn(T({},zn,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:er})),ar=Pn(T({},In,{propertyName:0,elapsedTime:0,pseudoElement:0})),H=Pn(T({},Wn,{deltaX:function(e){return`deltaX`in e?e.deltaX:`wheelDeltaX`in e?-e.wheelDeltaX:0},deltaY:function(e){return`deltaY`in e?e.deltaY:`wheelDeltaY`in e?-e.wheelDeltaY:`wheelDelta`in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0})),U=Pn(T({},In,{newState:0,oldState:0,source:0})),or=[9,13,27,32],sr=wn&&`CompositionEvent`in window,cr=null;wn&&`documentMode`in document&&(cr=document.documentMode);var lr=wn&&`TextEvent`in window&&!cr,ur=wn&&(!sr||cr&&8<cr&&11>=cr),dr=` `,fr=!1;function pr(e,t){switch(e){case`keyup`:return or.indexOf(t.keyCode)!==-1;case`keydown`:return t.keyCode!==229;case`keypress`:case`mousedown`:case`focusout`:return!0;default:return!1}}function mr(e){return e=e.detail,typeof e==`object`&&`data`in e?e.data:null}var hr=!1;function gr(e,t){switch(e){case`compositionend`:return mr(t);case`keypress`:return t.which===32?(fr=!0,dr):null;case`textInput`:return e=t.data,e===dr&&fr?null:e;default:return null}}function _r(e,t){if(hr)return e===`compositionend`||!sr&&pr(e,t)?(e=An(),kn=On=Dn=null,hr=!1,e):null;switch(e){case`paste`:return null;case`keypress`:if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case`compositionend`:return ur&&t.locale!==`ko`?null:t.data;default:return null}}var vr={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function yr(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t===`input`?!!vr[e.type]:t===`textarea`}function br(e,t,n,r){yn?bn?bn.push(r):bn=[r]:yn=r,t=qf(t,`onChange`),0<t.length&&(n=new Rn(`onChange`,`change`,null,n,r),e.push({event:n,listeners:t}))}var xr=null,Sr=null;function Cr(e){Bf(e,0)}function wr(e){if(Qt(Nt(e)))return e}function Tr(e,t){if(e===`change`)return t}var Er=!1;if(wn){var Dr;if(wn){var Or=`oninput`in document;if(!Or){var kr=document.createElement(`div`);kr.setAttribute(`oninput`,`return;`),Or=typeof kr.oninput==`function`}Dr=Or}else Dr=!1;Er=Dr&&(!document.documentMode||9<document.documentMode)}function Ar(){xr&&(xr.detachEvent(`onpropertychange`,jr),Sr=xr=null)}function jr(e){if(e.propertyName===`value`&&wr(Sr)){var t=[];br(t,Sr,e,vn(e)),B(Cr,t)}}function Mr(e,t,n){e===`focusin`?(Ar(),xr=t,Sr=n,xr.attachEvent(`onpropertychange`,jr)):e===`focusout`&&Ar()}function Nr(e){if(e===`selectionchange`||e===`keyup`||e===`keydown`)return wr(Sr)}function Pr(e,t){if(e===`click`)return wr(t)}function Fr(e,t){if(e===`input`||e===`change`)return wr(t)}function Ir(e,t){return e===t&&(e!==0||1/e==1/t)||e!==e&&t!==t}var Lr=typeof Object.is==`function`?Object.is:Ir;function Rr(e,t){if(Lr(e,t))return!0;if(typeof e!=`object`||!e||typeof t!=`object`||!t)return!1;var n=Object.keys(e),r=Object.keys(t);if(n.length!==r.length)return!1;for(r=0;r<n.length;r++){var i=n[r];if(!Fe.call(t,i)||!Lr(e[i],t[i]))return!1}return!0}function zr(e){if(e||=typeof document<`u`?document:void 0,e===void 0)return null;try{return e.activeElement||e.body}catch{return e.body}}function Br(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Vr(e,t){var n=Br(e);e=0;for(var r;n;){if(n.nodeType===3){if(r=e+n.textContent.length,e<=t&&r>=t)return{node:n,offset:t-e};e=r}a:{for(;n;){if(n.nextSibling){n=n.nextSibling;break a}n=n.parentNode}n=void 0}n=Br(n)}}function Hr(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?Hr(e,t.parentNode):`contains`in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function Ur(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=zr(e.document);t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href==`string`}catch{n=!1}if(n)e=t.contentWindow;else break;t=zr(e.document)}return t}function Wr(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t===`input`&&(e.type===`text`||e.type===`search`||e.type===`tel`||e.type===`url`||e.type===`password`)||t===`textarea`||e.contentEditable===`true`)}var Gr=wn&&`documentMode`in document&&11>=document.documentMode,Kr=null,qr=null,Jr=null,Yr=!1;function Xr(e,t,n){var r=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;Yr||Kr==null||Kr!==zr(r)||(r=Kr,`selectionStart`in r&&Wr(r)?r={start:r.selectionStart,end:r.selectionEnd}:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection(),r={anchorNode:r.anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset}),Jr&&Rr(Jr,r)||(Jr=r,r=qf(qr,`onSelect`),0<r.length&&(t=new Rn(`onSelect`,`select`,null,t,n),e.push({event:t,listeners:r}),t.target=Kr)))}function Zr(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n[`Webkit`+e]=`webkit`+t,n[`Moz`+e]=`moz`+t,n}var Qr={animationend:Zr(`Animation`,`AnimationEnd`),animationiteration:Zr(`Animation`,`AnimationIteration`),animationstart:Zr(`Animation`,`AnimationStart`),transitionrun:Zr(`Transition`,`TransitionRun`),transitionstart:Zr(`Transition`,`TransitionStart`),transitioncancel:Zr(`Transition`,`TransitionCancel`),transitionend:Zr(`Transition`,`TransitionEnd`)},$r={},ei={};wn&&(ei=document.createElement(`div`).style,`AnimationEvent`in window||(delete Qr.animationend.animation,delete Qr.animationiteration.animation,delete Qr.animationstart.animation),`TransitionEvent`in window||delete Qr.transitionend.transition);function ti(e){if($r[e])return $r[e];if(!Qr[e])return e;var t=Qr[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in ei)return $r[e]=t[n];return e}var ni=ti(`animationend`),ri=ti(`animationiteration`),ii=ti(`animationstart`),ai=ti(`transitionrun`),oi=ti(`transitionstart`),si=ti(`transitioncancel`),ci=ti(`transitionend`),li=new Map,ui=`abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel`.split(` `);ui.push(`scrollEnd`);function di(e,t){li.set(e,t),Rt(t,[e])}var fi=0;function pi(e,t){if(e.name!=null&&e.name!==`auto`)return e.name;if(t.autoName!==null)return t.autoName;e=vd.identifierPrefix;var n=fi++;return e=`_`+e+`t_`+n.toString(32)+`_`,t.autoName=e}function mi(e){if(e==null||typeof e==`string`)return e;var t=null,n=Ed;if(n!==null)for(var r=0;r<n.length;r++){var i=e[n[r]];if(i!=null){if(i===`none`)return`none`;t=t==null?i:t+(` `+i)}}return t??e.default}function hi(e,t){return e=mi(e),t=mi(t),t==null?e===`auto`?null:e:t===`auto`?null:t}var gi=typeof reportError==`function`?reportError:function(e){if(typeof window==`object`&&typeof window.ErrorEvent==`function`){var t=new window.ErrorEvent(`error`,{bubbles:!0,cancelable:!0,message:typeof e==`object`&&e&&typeof e.message==`string`?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process==`object`&&typeof process.emit==`function`){process.emit(`uncaughtException`,e);return}console.error(e)},_i=[],vi=0,yi=0;function bi(){for(var e=vi,t=yi=vi=0;t<e;){var n=_i[t];_i[t++]=null;var r=_i[t];_i[t++]=null;var i=_i[t];_i[t++]=null;var a=_i[t];if(_i[t++]=null,r!==null&&i!==null){var o=r.pending;o===null?i.next=i:(i.next=o.next,o.next=i),r.pending=i}a!==0&&wi(n,i,a)}}function xi(e,t,n,r){_i[vi++]=e,_i[vi++]=t,_i[vi++]=n,_i[vi++]=r,yi|=r,e.lanes|=r,e=e.alternate,e!==null&&(e.lanes|=r)}function Si(e,t,n,r){return xi(e,t,n,r),Ti(e)}function Ci(e,t){return xi(e,null,null,t),Ti(e)}function wi(e,t,n){e.lanes|=n;var r=e.alternate;r!==null&&(r.lanes|=n);for(var i=!1,a=e.return;a!==null;)a.childLanes|=n,r=a.alternate,r!==null&&(r.childLanes|=n),a.tag===22&&(e=a.stateNode,e===null||e._visibility&1||(i=!0)),e=a,a=a.return;return e.tag===3?(a=e.stateNode,i&&t!==null&&(i=31-Ze(n),e=a.hiddenUpdates,r=e[i],r===null?e[i]=[t]:r.push(t),t.lane=n|536870912),a):null}function Ti(e){if(50<Dd)throw Dd=0,Od=null,Error(i(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var Ei={};function Di(e,t,n,r){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=r,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Oi(e,t,n,r){return new Di(e,t,n,r)}function ki(e){return e=e.prototype,!(!e||!e.isReactComponent)}function Ai(e,t){var n=e.alternate;return n===null?(n=Oi(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&1206910976,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n.refCleanup=e.refCleanup,n}function ji(e,t){e.flags&=1206910978;var n=e.alternate;return n===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=n.childLanes,e.lanes=n.lanes,e.child=n.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=n.memoizedProps,e.memoizedState=n.memoizedState,e.updateQueue=n.updateQueue,e.type=n.type,t=n.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function Mi(e,t,n,r,a,o){var s=0;if(r=e,typeof r==`function`)ki(r)&&(s=1);else if(typeof r==`string`)s=qm(e,n,be.current)?26:e===`html`||e===`head`||e===`body`?27:5;else a:switch(r){case M:return e=Oi(31,n,t,a),e.elementType=M,e.lanes=o,e;case O:return Ni(n.children,a,o,t);case te:s=8,a|=24;break;case k:return e=Oi(12,n,t,a|2),e.elementType=k,e.lanes=o,e;case ie:return e=Oi(13,n,t,a),e.elementType=ie,e.lanes=o,e;case ae:return e=Oi(19,n,t,a),e.elementType=ae,e.lanes=o,e;case N:case ce:return e=a|32,e=Oi(30,n,t,e),e.elementType=ce,e.lanes=o,e.stateNode={autoName:null,paired:null,clones:null,ref:null},e;default:if(typeof r==`object`&&r)switch(r.$$typeof){case ne:s=10;break a;case A:s=9;break a;case re:s=11;break a;case oe:s=14;break a;case j:s=16,r=null;break a}s=29,n=Error(i(130,e===null?`null`:typeof e,``)),r=null}return t=Oi(s,n,t,a),t.elementType=e,t.type=r,t.lanes=o,t}function Ni(e,t,n,r){return e=Oi(7,e,r,t),e.lanes=n,e}function Pi(e,t,n){return e=Oi(6,e,null,t),e.lanes=n,e}function Fi(e){var t=Oi(18,null,null,0);return t.stateNode=e,t}function Ii(e,t,n){return t=Oi(4,e.children===null?[]:e.children,e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var Li=new WeakMap;function Ri(e,t){if(typeof e==`object`&&e){var n=Li.get(e);return n===void 0?(t={value:e,source:t,stack:Pe(t)},Li.set(e,t),t):n}return{value:e,source:t,stack:Pe(t)}}var zi=[],Bi=0,Vi=null,Hi=0,Ui=[],Wi=0,Gi=null,Ki=1,qi=``;function Ji(e,t){zi[Bi++]=Hi,zi[Bi++]=Vi,Vi=e,Hi=t}function Yi(e,t,n){Ui[Wi++]=Ki,Ui[Wi++]=qi,Ui[Wi++]=Gi,Gi=e;var r=Ki;e=qi;var i=32-Ze(r)-1;r&=~(1<<i),n+=1;var a=32-Ze(t)+i;if(30<a){var o=i-i%5;a=(r&(1<<o)-1).toString(32),r>>=o,i-=o,Ki=1<<32-Ze(t)+i|n<<i|r,qi=a+e}else Ki=1<<a|n<<i|r,qi=e}function Xi(e){e.return!==null&&(Ji(e,1),Yi(e,1,0))}function Zi(e){for(;e===Vi;)Vi=zi[--Bi],zi[Bi]=null,Hi=zi[--Bi],zi[Bi]=null;for(;e===Gi;)Gi=Ui[--Wi],Ui[Wi]=null,qi=Ui[--Wi],Ui[Wi]=null,Ki=Ui[--Wi],Ui[Wi]=null}function Qi(e,t){Ui[Wi++]=Ki,Ui[Wi++]=qi,Ui[Wi++]=Gi,Ki=t.id,qi=t.overflow,Gi=e}var $i=null,ea=null,W=!1,ta=null,na=!1,ra=Error(i(519));function ia(e){throw G(Ri(Error(i(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?`text`:`HTML`,``)),e)),ra}function aa(e){var t=e.stateNode,n=e.type,r=e.memoizedProps;switch(t[xt]=e,t[St]=r,n){case`dialog`:$(`cancel`,t),$(`close`,t);break;case`iframe`:case`object`:case`embed`:$(`load`,t);break;case`video`:case`audio`:for(n=0;n<Rf.length;n++)$(Rf[n],t);break;case`source`:$(`error`,t);break;case`img`:case`image`:case`link`:$(`error`,t),$(`load`,t);break;case`details`:$(`toggle`,t);break;case`input`:$(`invalid`,t),nn(t,r.value,r.defaultValue,r.checked,r.defaultChecked,r.type,r.name,!0);break;case`select`:$(`invalid`,t);break;case`textarea`:$(`invalid`,t),sn(t,r.value,r.defaultValue,r.children)}n=r.children,typeof n!=`string`&&typeof n!=`number`&&typeof n!=`bigint`||t.textContent===``+n||!0===r.suppressHydrationWarning||$f(t.textContent,n)?(r.popover!=null&&($(`beforetoggle`,t),$(`toggle`,t)),r.onScroll!=null&&$(`scroll`,t),r.onScrollEnd!=null&&$(`scrollend`,t),r.onClick!=null&&(t.onclick=gn),t=!0):t=!1,t||ia(e,!0)}function oa(e){for($i=e.return;$i;)switch($i.tag){case 5:case 31:case 13:na=!1;return;case 27:case 3:na=!0;return;default:$i=$i.return}}function sa(e){if(e!==$i)return!1;if(!W)return oa(e),W=!0,!1;var t=e.tag,n;if((n=t!==3&&t!==27)&&((n=t===5)&&(n=e.type,n=n===`form`||n===`button`||pp(e.type,e.memoizedProps)),n=!n),n&&ea&&ia(e),oa(e),t===13){if(e=e.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(317));ea=dm(e)}else if(t===31){if(e=e.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(317));ea=dm(e)}else t===27?(t=ea,Sp(e.type)?(e=um,um=null,ea=e):ea=t):ea=$i?lm(e.stateNode.nextSibling):null;return!0}function ca(){ea=$i=null,W=!1}function la(){var e=ta;return e!==null&&(ud===null?ud=e:ud.push.apply(ud,e),ta=null),e}function G(e){ta===null?ta=[e]:ta.push(e)}var ua=ve(null),da=null,fa=null;function pa(e,t,n){I(ua,t._currentValue),t._currentValue=n}function ma(e){e._currentValue=ua.current,ye(ua)}function ha(e,t,n){for(;e!==null;){var r=e.alternate;if((e.childLanes&t)===t?r!==null&&(r.childLanes&t)!==t&&(r.childLanes|=t):(e.childLanes|=t,r!==null&&(r.childLanes|=t)),e===n)break;e=e.return}}function ga(e,t,n,r){var a=e.child;for(a!==null&&(a.return=e);a!==null;){var o=a.dependencies;if(o!==null){var s=a.child;o=o.firstContext;a:for(;o!==null;){var c=o;o=a;for(var l=0;l<t.length;l++)if(c.context===t[l]){o.lanes|=n,c=o.alternate,c!==null&&(c.lanes|=n),ha(o.return,n,e),r||(s=null);break a}o=c.next}}else if(a.tag===18){if(s=a.return,s===null)throw Error(i(341));s.lanes|=n,o=s.alternate,o!==null&&(o.lanes|=n),ha(s,n,e),s=null}else a.tag===13&&a.memoizedState!==null&&a.memoizedState.dehydrated===null?(a.lanes|=n,s=a.alternate,s!==null&&(s.lanes|=n),ha(a.return,n,e),s=a.child,s=s===null?null:s.sibling):s=a.child;if(s!==null)s.return=a;else for(s=a;s!==null;){if(s===e){s=null;break}if(a=s.sibling,a!==null){a.return=s.return,s=a;break}s=s.return}a=s}}function _a(e,t,n,r){e=null;for(var a=t,o=!1;a!==null;){if(!o){if(a.flags&524288)o=!0;else if(a.flags&262144)break}if(a.tag===10){var s=a.alternate;if(s===null)throw Error(i(387));if(s=s.memoizedProps,s!==null){var c=a.type;Lr(a.pendingProps.value,s.value)||(e===null?e=[c]:e.push(c))}}else if(a===Ce.current){if(s=a.alternate,s===null)throw Error(i(387));s.memoizedState.memoizedState!==a.memoizedState.memoizedState&&(e===null?e=[sh]:e.push(sh))}a=a.return}return e!==null&&ga(t,e,n,r),t.flags|=262144,e!==null}function va(e){for(e=e.firstContext;e!==null;){if(!Lr(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function ya(e){da=e,fa=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function ba(e){return Sa(da,e)}function xa(e,t){return da===null&&ya(e),Sa(e,t)}function Sa(e,t){var n=t._currentValue;if(t={context:t,memoizedValue:n,next:null},fa===null){if(e===null)throw Error(i(308));fa=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else fa=fa.next=t;return n}var Ca=typeof AbortController<`u`?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(t,n){e.push(n)}};this.abort=function(){t.aborted=!0,e.forEach(function(e){return e()})}},wa=t.unstable_scheduleCallback,Ta=t.unstable_NormalPriority,Ea={$$typeof:ne,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function Da(){return{controller:new Ca,data:new Map,refCount:0}}function Oa(e){e.refCount--,e.refCount===0&&wa(Ta,function(){e.controller.abort()})}function ka(e,t){if(e.pendingLanes&4194048){var n=e.transitionTypes;for(n===null&&(n=e.transitionTypes=[]),e=0;e<t.length;e++){var r=t[e];n.indexOf(r)===-1&&n.push(r)}}}var Aa=null;function ja(e){var t=e.transitionTypes;return e.transitionTypes=null,t}var Ma=null,Na=0,Pa=0,Fa=null;function Ia(e,t){if(Ma===null){var n=Ma=[];Na=0,Pa=Nf(),Fa={status:`pending`,value:void 0,then:function(e){n.push(e)}}}return Na++,t.then(La,La),t}function La(){if(--Na===0&&(Aa=null,Ma!==null)){Fa!==null&&(Fa.status=`fulfilled`);var e=Ma;Ma=null,Pa=0,Fa=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function Ra(e,t){var n=[],r={status:`pending`,value:null,reason:null,then:function(e){n.push(e)}};return e.then(function(){r.status=`fulfilled`,r.value=t;for(var e=0;e<n.length;e++)(0,n[e])(t)},function(e){for(r.status=`rejected`,r.reason=e,e=0;e<n.length;e++)(0,n[e])(void 0)}),r}var za=P.S;P.S=function(e,t){if(pd=Be(),typeof t==`object`&&t&&typeof t.then==`function`&&Ia(e,t),Aa!==null)for(var n=yf;n!==null;)ka(n,Aa),n=n.next;if(n=e.types,n!==null){for(var r=yf;r!==null;)ka(r,n),r=r.next;if(Pa!==0){r=Aa,r===null&&(r=Aa=[]);for(var i=0;i<n.length;i++){var a=n[i];r.indexOf(a)===-1&&r.push(a)}}}za!==null&&za(e,t)};var Ba=ve(null);function Va(){var e=Ba.current;return e===null?Xu.pooledCache:e}function Ha(e,t){t===null?I(Ba,Ba.current):I(Ba,t.pool)}function Ua(){var e=Va();return e===null?null:{parent:Ea._currentValue,pool:e}}var Wa=Error(i(460)),Ga=Error(i(474)),Ka=Error(i(542)),qa={then:function(){}};function Ja(e){return e=e.status,e===`fulfilled`||e===`rejected`}function Ya(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(gn,gn),t=n),t.status){case`fulfilled`:return t.value;case`rejected`:throw e=t.reason,$a(e),e===void 0&&!(`reason`in t)?Error(i(600)):e;default:if(typeof t.status==`string`)t.then(gn,gn);else{if(e=Xu,e!==null&&100<e.shellSuspendCounter)throw Error(i(482));e=t,e.status=`pending`,e.then(function(e){if(t.status===`pending`){var n=t;n.status=`fulfilled`,n.value=e}},function(e){if(t.status===`pending`){var n=t;n.status=`rejected`,n.reason=e}})}switch(t.status){case`fulfilled`:return t.value;case`rejected`:throw e=t.reason,$a(e),e}throw Za=t,Wa}}function Xa(e){try{var t=e._init;return t(e._payload)}catch(e){throw typeof e==`object`&&e&&typeof e.then==`function`?(Za=e,Wa):e}}var Za=null;function Qa(){if(Za===null)throw Error(i(459));var e=Za;return Za=null,e}function $a(e){if(e===Wa||e===Ka)throw Error(i(483))}var eo=null,to=0;function K(e){var t=to;return to+=1,eo===null&&(eo=[]),Ya(eo,e,t)}function no(e,t){t=t.props.ref,e.ref=t===void 0?null:t}function ro(e,t){throw t.$$typeof===E?Error(i(525)):(e=Object.prototype.toString.call(t),Error(i(31,e===`[object Object]`?`object with keys {`+Object.keys(t).join(`, `)+`}`:e)))}function io(e){function t(t,n){if(e){var r=t.deletions;r===null?(t.deletions=[n],t.flags|=16):r.push(n)}}function n(n,r){if(!e)return null;for(;r!==null;)t(n,r),r=r.sibling;return null}function r(e){for(var t=new Map;e!==null;)e.key===null?t.set(e.index,e):t.set(e.key,e),e=e.sibling;return t}function a(e,t){return e=Ai(e,t),e.index=0,e.sibling=null,e}function o(t,n,r){return t.index=r,e?(r=t.alternate,r===null?(t.flags|=134217730,n):(r=r.index,r<n?(t.flags|=2,n):r)):(t.flags|=1048576,n)}function s(t){return e&&t.alternate===null&&(t.flags|=134217730),t}function c(e,t,n,r){return t===null||t.tag!==6?(t=Pi(n,e.mode,r),t.return=e,t):(t=a(t,n),t.return=e,t)}function l(e,t,n,r){var i=n.type;return i===O?(e=d(e,t,n.props.children,r,n.key),no(e,n),e):t!==null&&(t.elementType===i||typeof i==`object`&&i&&i.$$typeof===j&&Xa(i)===t.type)?(t=a(t,n.props),no(t,n),t.return=e,t):(t=Mi(n.type,n.key,n.props,null,e.mode,r),no(t,n),t.return=e,t)}function u(e,t,n,r){return t===null||t.tag!==4||t.stateNode.containerInfo!==n.containerInfo||t.stateNode.implementation!==n.implementation?(t=Ii(n,e.mode,r),t.return=e,t):(t=a(t,n.children||[]),t.return=e,t)}function d(e,t,n,r,i){return t===null||t.tag!==7?(t=Ni(n,e.mode,r,i),t.return=e,t):(t=a(t,n),t.return=e,t)}function f(e,t,n){if(typeof t==`string`&&t!==``||typeof t==`number`||typeof t==`bigint`)return t=Pi(``+t,e.mode,n),t.return=e,t;if(typeof t==`object`&&t){switch(t.$$typeof){case D:return n=Mi(t.type,t.key,t.props,null,e.mode,n),no(n,t),n.return=e,n;case ee:return t=Ii(t,e.mode,n),t.return=e,t;case j:return t=Xa(t),f(e,t,n)}if(me(t)||de(t))return t=Ni(t,e.mode,n,null),t.return=e,t;if(typeof t.then==`function`)return f(e,K(t),n);if(t.$$typeof===ne)return f(e,xa(e,t),n);ro(e,t)}return null}function p(e,t,n,r){var i=t===null?null:t.key;if(typeof n==`string`&&n!==``||typeof n==`number`||typeof n==`bigint`)return i===null?c(e,t,``+n,r):null;if(typeof n==`object`&&n){switch(n.$$typeof){case D:return n.key===i?l(e,t,n,r):null;case ee:return n.key===i?u(e,t,n,r):null;case j:return n=Xa(n),p(e,t,n,r)}if(me(n)||de(n))return i===null?d(e,t,n,r,null):null;if(typeof n.then==`function`)return p(e,t,K(n),r);if(n.$$typeof===ne)return p(e,t,xa(e,n),r);ro(e,n)}return null}function m(e,t,n,r,i){if(typeof r==`string`&&r!==``||typeof r==`number`||typeof r==`bigint`)return e=e.get(n)||null,c(t,e,``+r,i);if(typeof r==`object`&&r){switch(r.$$typeof){case D:return e=e.get(r.key===null?n:r.key)||null,l(t,e,r,i);case ee:return e=e.get(r.key===null?n:r.key)||null,u(t,e,r,i);case j:return r=Xa(r),m(e,t,n,r,i)}if(me(r)||de(r))return e=e.get(n)||null,d(t,e,r,i,null);if(typeof r.then==`function`)return m(e,t,n,K(r),i);if(r.$$typeof===ne)return m(e,t,n,xa(t,r),i);ro(t,r)}return null}function h(i,a,s,c){for(var l=null,u=null,d=a,h=a=0,g=null;d!==null&&h<s.length;h++){d.index>h?(g=d,d=null):g=d.sibling;var _=p(i,d,s[h],c);if(_===null){d===null&&(d=g);break}e&&d&&_.alternate===null&&t(i,d),a=o(_,a,h),u===null?l=_:u.sibling=_,u=_,d=g}if(h===s.length)return n(i,d),W&&Ji(i,h),l;if(d===null){for(;h<s.length;h++)d=f(i,s[h],c),d!==null&&(a=o(d,a,h),u===null?l=d:u.sibling=d,u=d);return W&&Ji(i,h),l}for(d=r(d);h<s.length;h++)g=m(d,i,h,s[h],c),g!==null&&(e&&(_=g.alternate,_!==null&&d.delete(_.key===null?h:_.key)),a=o(g,a,h),u===null?l=g:u.sibling=g,u=g);return e&&d.forEach(function(e){return t(i,e)}),W&&Ji(i,h),l}function g(a,s,c,l){if(c==null)throw Error(i(151));for(var u=null,d=null,h=s,g=s=0,_=null,v=c.next();h!==null&&!v.done;g++,v=c.next()){h.index>g?(_=h,h=null):_=h.sibling;var y=p(a,h,v.value,l);if(y===null){h===null&&(h=_);break}e&&h&&y.alternate===null&&t(a,h),s=o(y,s,g),d===null?u=y:d.sibling=y,d=y,h=_}if(v.done)return n(a,h),W&&Ji(a,g),u;if(h===null){for(;!v.done;g++,v=c.next())v=f(a,v.value,l),v!==null&&(s=o(v,s,g),d===null?u=v:d.sibling=v,d=v);return W&&Ji(a,g),u}for(h=r(h);!v.done;g++,v=c.next())v=m(h,a,g,v.value,l),v!==null&&(e&&(_=v.alternate,_!==null&&h.delete(_.key===null?g:_.key)),s=o(v,s,g),d===null?u=v:d.sibling=v,d=v);return e&&h.forEach(function(e){return t(a,e)}),W&&Ji(a,g),u}function _(e,r,o,c){if(typeof o==`object`&&o&&o.type===O&&o.key===null&&o.props.ref===void 0&&(o=o.props.children),typeof o==`object`&&o){switch(o.$$typeof){case D:a:{for(var l=o.key;r!==null;){if(r.key===l){if(l=o.type,l===O){if(r.tag===7){n(e,r.sibling),c=a(r,o.props.children),no(c,o),c.return=e,e=c;break a}}else if(r.elementType===l||typeof l==`object`&&l&&l.$$typeof===j&&Xa(l)===r.type){n(e,r.sibling),c=a(r,o.props),no(c,o),c.return=e,e=c;break a}n(e,r);break}t(e,r),r=r.sibling}o.type===O?(c=Ni(o.props.children,e.mode,c,o.key),no(c,o),c.return=e,e=c):(c=Mi(o.type,o.key,o.props,null,e.mode,c),no(c,o),c.return=e,e=c)}return s(e);case ee:a:{for(l=o.key;r!==null;){if(r.key===l){if(r.tag===4&&r.stateNode.containerInfo===o.containerInfo&&r.stateNode.implementation===o.implementation){n(e,r.sibling),c=a(r,o.children||[]),c.return=e,e=c;break a}n(e,r);break}t(e,r),r=r.sibling}c=Ii(o,e.mode,c),c.return=e,e=c}return s(e);case j:return o=Xa(o),_(e,r,o,c)}if(me(o))return h(e,r,o,c);if(de(o)){if(l=de(o),typeof l!=`function`)throw Error(i(150));return o=l.call(o),g(e,r,o,c)}if(typeof o.then==`function`)return _(e,r,K(o),c);if(o.$$typeof===ne)return _(e,r,xa(e,o),c);ro(e,o)}return typeof o==`string`&&o!==``||typeof o==`number`||typeof o==`bigint`?(o=``+o,r!==null&&r.tag===6?(n(e,r.sibling),c=a(r,o),c.return=e,e=c):(n(e,r),c=Pi(o,e.mode,c),c.return=e,e=c),s(e)):n(e,r)}return function(e,t,n,r){try{to=0;var i=_(e,t,n,r);return eo=null,i}catch(t){if(t===Wa||t===Ka)throw t;var a=Oi(29,t,null,e.mode);return a.lanes=r,a.return=e,a}}}var ao=io(!0),oo=io(!1),so=!1;function co(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function lo(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function uo(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function fo(e,t,n){var r=e.updateQueue;if(r===null)return null;if(r=r.shared,X&2){var i=r.pending;return i===null?t.next=t:(t.next=i.next,i.next=t),r.pending=t,t=Ti(e),wi(e,null,n),t}return xi(e,r,t,n),Ti(e)}function po(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,n&4194048)){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,mt(e,n)}}function mo(e,t){var n=e.updateQueue,r=e.alternate;if(r!==null&&(r=r.updateQueue,n===r)){var i=null,a=null;if(n=n.firstBaseUpdate,n!==null){do{var o={lane:n.lane,tag:n.tag,payload:n.payload,callback:null,next:null};a===null?i=a=o:a=a.next=o,n=n.next}while(n!==null);a===null?i=a=t:a=a.next=t}else i=a=t;n={baseState:r.baseState,firstBaseUpdate:i,lastBaseUpdate:a,shared:r.shared,callbacks:r.callbacks},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}var ho=!1;function go(){if(ho){var e=Fa;if(e!==null)throw e}}function _o(e,t,n,r){ho=!1;var i=e.updateQueue;so=!1;var a=i.firstBaseUpdate,o=i.lastBaseUpdate,s=i.shared.pending;if(s!==null){i.shared.pending=null;var c=s,l=c.next;c.next=null,o===null?a=l:o.next=l,o=c;var u=e.alternate;u!==null&&(u=u.updateQueue,s=u.lastBaseUpdate,s!==o&&(s===null?u.firstBaseUpdate=l:s.next=l,u.lastBaseUpdate=c))}if(a!==null){var d=i.baseState;o=0,u=l=c=null,s=a;do{var f=s.lane&-536870913,p=f!==s.lane;if(p?(Q&f)===f:(r&f)===f){f!==0&&f===Pa&&(ho=!0),u!==null&&(u=u.next={lane:0,tag:s.tag,payload:s.payload,callback:null,next:null});a:{var m=e,h=s;f=t;var g=n;switch(h.tag){case 1:if(m=h.payload,typeof m==`function`){d=m.call(g,d,f);break a}d=m;break a;case 3:m.flags=m.flags&-65537|128;case 0:if(m=h.payload,f=typeof m==`function`?m.call(g,d,f):m,f==null)break a;d=T({},d,f);break a;case 2:so=!0}}f=s.callback,f!==null&&(e.flags|=64,p&&(e.flags|=8192),p=i.callbacks,p===null?i.callbacks=[f]:p.push(f))}else p={lane:f,tag:s.tag,payload:s.payload,callback:s.callback,next:null},u===null?(l=u=p,c=d):u=u.next=p,o|=f;if(s=s.next,s===null){if(s=i.shared.pending,s===null)break;p=s,s=p.next,p.next=null,i.lastBaseUpdate=p,i.shared.pending=null}}while(1);u===null&&(c=d),i.baseState=c,i.firstBaseUpdate=l,i.lastBaseUpdate=u,a===null&&(i.shared.lanes=0),id|=o,e.lanes=o,e.memoizedState=d}}function vo(e,t){if(typeof e!=`function`)throw Error(i(191,e));e.call(t)}function yo(e,t){var n=e.callbacks;if(n!==null)for(e.callbacks=null,e=0;e<n.length;e++)vo(n[e],t)}var bo=ve(null),xo=ve(0);function So(e,t){e=nd,I(xo,e),I(bo,t),nd=e|t.baseLanes}function Co(){I(xo,nd),I(bo,bo.current)}function wo(){nd=xo.current,ye(bo),ye(xo)}var To=ve(null),Eo=null;function Do(e){var t=e.alternate;I(Mo,Mo.current&1),I(To,e),Eo===null&&(t===null||bo.current!==null||t.memoizedState!==null)&&(Eo=e)}function Oo(e){I(Mo,Mo.current),I(To,e),Eo===null&&(Eo=e)}function ko(e){e.tag===22?(I(Mo,Mo.current),I(To,e),Eo===null&&(Eo=e)):Ao()}function Ao(){I(Mo,Mo.current),I(To,To.current)}function jo(e){ye(To),Eo===e&&(Eo=null),ye(Mo)}var Mo=ve(0);function No(e,t){I(To,To.current),I(Mo,t)}function Po(e){ye(Mo),ye(To),Eo===e&&(Eo=null)}function Fo(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||om(n)||sm(n)))return t}else if(t.tag===19&&t.memoizedProps.revealOrder!==`independent`){if(t.flags&128)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var Io=0,q=null,Lo=null,Ro=null,zo=!1,Bo=!1,Vo=!1,Ho=0,Uo=0,Wo=null,Go=0;function Ko(){throw Error(i(321))}function qo(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!Lr(e[n],t[n]))return!1;return!0}function Jo(e,t,n,r,i,a){return Io=a,q=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,P.H=e===null||e.memoizedState===null?dc:fc,Vo=!1,a=n(r,i),Vo=!1,Bo&&(a=Xo(t,n,r,i)),Yo(e),a}function Yo(e){P.H=uc;var t=Lo!==null&&Lo.next!==null;if(Io=0,Ro=Lo=q=null,zo=!1,Uo=0,Wo=null,t)throw Error(i(300));e===null||kc||(e=e.dependencies,e!==null&&va(e)&&(kc=!0))}function Xo(e,t,n,r){q=e;var a=0;do{if(Bo&&(Wo=null),Uo=0,Bo=!1,25<=a)throw Error(i(301));if(a+=1,Ro=Lo=null,e.updateQueue!=null){var o=e.updateQueue;o.lastEffect=null,o.events=null,o.stores=null,o.memoCache!=null&&(o.memoCache.index=0)}P.H=pc,o=t(n,r)}while(Bo);return o}function Zo(){var e=P.H,t=e.useState()[0];return t=typeof t.then==`function`?is(t):t,e=e.useState()[0],(Lo===null?null:Lo.memoizedState)!==e&&(q.flags|=1024),t}function Qo(){var e=Ho!==0;return Ho=0,e}function $o(e,t,n){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~n}function es(e){if(zo){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}zo=!1}Io=0,Ro=Lo=q=null,Bo=!1,Uo=Ho=0,Wo=null}function ts(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return Ro===null?q.memoizedState=Ro=e:Ro=Ro.next=e,Ro}function ns(){if(Lo===null){var e=q.alternate;e=e===null?null:e.memoizedState}else e=Lo.next;var t=Ro===null?q.memoizedState:Ro.next;if(t!==null)Ro=t,Lo=e;else{if(e===null)throw q.alternate===null?Error(i(467)):Error(i(310));Lo=e,e={memoizedState:Lo.memoizedState,baseState:Lo.baseState,baseQueue:Lo.baseQueue,queue:Lo.queue,next:null},Ro===null?q.memoizedState=Ro=e:Ro=Ro.next=e}return Ro}function rs(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function is(e){var t=Uo;return Uo+=1,Wo===null&&(Wo=[]),e=Ya(Wo,e,t),t=q,(Ro===null?t.memoizedState:Ro.next)===null&&(t=t.alternate,P.H=t===null||t.memoizedState===null?dc:fc),e}function as(e){if(typeof e==`object`&&e){if(typeof e.then==`function`)return is(e);if(e.$$typeof===le)return;if(e.$$typeof===ne)return ba(e)}throw Error(i(438,String(e)))}function os(e){var t=null,n=q.updateQueue;if(n!==null&&(t=n.memoCache),t==null){var r=q.alternate;r!==null&&(r=r.updateQueue,r!==null&&(r=r.memoCache,r!=null&&(t={data:r.data.map(function(e){return e.slice()}),index:0})))}if(t??={data:[],index:0},n===null&&(n=rs(),q.updateQueue=n),n.memoCache=t,n=t.data[t.index],n===void 0)for(n=t.data[t.index]=Array(e),r=0;r<e;r++)n[r]=se;return t.index++,n}function ss(e,t){return typeof t==`function`?t(e):t}function cs(e){return ls(ns(),Lo,e)}function ls(e,t,n){var r=e.queue;if(r===null)throw Error(i(311));r.lastRenderedReducer=n;var a=e.baseQueue,o=r.pending;if(o!==null){if(a!==null){var s=a.next;a.next=o.next,o.next=s}t.baseQueue=a=o,r.pending=null}if(o=e.baseState,a===null)e.memoizedState=o;else{t=a.next;var c=s=null,l=null,u=t,d=!1;do{var f=u.lane&-536870913;if(f===u.lane?(Io&f)===f:(Q&f)===f){var p=u.revertLane;if(p===0)l!==null&&(l=l.next={lane:0,revertLane:0,gesture:null,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null}),f===Pa&&(d=!0);else if((Io&p)===p){u=u.next,p===Pa&&(d=!0);continue}else f={lane:0,revertLane:u.revertLane,gesture:null,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null},l===null?(c=l=f,s=o):l=l.next=f,q.lanes|=p,id|=p;f=u.action,Vo&&n(o,f),o=u.hasEagerState?u.eagerState:n(o,f)}else p={lane:f,revertLane:u.revertLane,gesture:u.gesture,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null},l===null?(c=l=p,s=o):l=l.next=p,q.lanes|=f,id|=f;u=u.next}while(u!==null&&u!==t);if(l===null?s=o:l.next=c,!Lr(o,e.memoizedState)&&(kc=!0,d&&(n=Fa,n!==null)))throw n;e.memoizedState=o,e.baseState=s,e.baseQueue=l,r.lastRenderedState=o}return a===null&&(r.lanes=0),[e.memoizedState,r.dispatch]}function us(e){var t=ns(),n=t.queue;if(n===null)throw Error(i(311));n.lastRenderedReducer=e;var r=n.dispatch,a=n.pending,o=t.memoizedState;if(a!==null){n.pending=null;var s=a=a.next;do o=e(o,s.action),s=s.next;while(s!==a);Lr(o,t.memoizedState)||(kc=!0),t.memoizedState=o,t.baseQueue===null&&(t.baseState=o),n.lastRenderedState=o}return[o,r]}function ds(e,t,n){var r=q,a=ns(),o=W;if(o){if(n===void 0)throw Error(i(407));n=n()}else n=t();var s=!Lr((Lo||a).memoizedState,n);if(s&&(a.memoizedState=n,kc=!0),a=a.queue,Is(ms.bind(null,r,a,e),[e]),e=a.getSnapshot!==t||s||Ro!==null&&!!(Ro.memoizedState.tag&1),js(e?9:8,{destroy:void 0},ps.bind(null,r,a,n,t),null),e){if(r.flags|=2048,Xu===null)throw Error(i(349));o||Io&127||fs(r,t,n)}return n}function fs(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=q.updateQueue,t===null?(t=rs(),q.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function ps(e,t,n,r){t.value=n,t.getSnapshot=r,hs(t)&&gs(e)}function ms(e,t,n){return n(function(){hs(t)&&gs(e)})}function hs(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Lr(e,n)}catch{return!0}}function gs(e){var t=Ci(e,2);t!==null&&Md(t,e,2)}function _s(e){var t=ts();if(typeof e==`function`){var n=e;if(e=n(),Vo){Xe(!0);try{n()}finally{Xe(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:ss,lastRenderedState:e},t}function vs(e,t,n,r){return e.baseState=n,ls(e,Lo,typeof r==`function`?r:ss)}function ys(e,t,n,r,a){if(sc(e))throw Error(i(485));if(e=t.action,e!==null){var o={payload:a,action:e,next:null,isTransition:!0,status:`pending`,value:null,reason:null,listeners:[],then:function(e){o.listeners.push(e)}};P.T===null?o.isTransition=!1:n(!0),r(o),n=t.pending,n===null?(o.next=t.pending=o,bs(t,o)):(o.next=n.next,t.pending=n.next=o)}}function bs(e,t){var n=t.action,r=t.payload,i=e.state;if(t.isTransition){var a=P.T,o={};o.types=a===null?null:a.types,P.T=o;try{var s=n(i,r),c=P.S;c!==null&&c(o,s),xs(e,t,s)}catch(n){Cs(e,t,n)}finally{a!==null&&o.types!==null&&(a.types=o.types),P.T=a}}else try{a=n(i,r),xs(e,t,a)}catch(n){Cs(e,t,n)}}function xs(e,t,n){typeof n==`object`&&n&&typeof n.then==`function`?n.then(function(n){Ss(e,t,n)},function(n){return Cs(e,t,n)}):Ss(e,t,n)}function Ss(e,t,n){t.status=`fulfilled`,t.value=n,ws(t),e.state=n,t=e.pending,t!==null&&(n=t.next,n===t?e.pending=null:(n=n.next,t.next=n,bs(e,n)))}function Cs(e,t,n){var r=e.pending;if(e.pending=null,r!==null){r=r.next;do t.status=`rejected`,t.reason=n,ws(t),t=t.next;while(t!==r)}e.action=null}function ws(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function Ts(e,t){return t}function Es(e,t){if(W){var n=Xu.formState;if(n!==null){a:{var r=q;if(W){if(ea){b:{for(var i=ea,a=na;i.nodeType!==8;){if(!a){i=null;break b}if(i=lm(i.nextSibling),i===null){i=null;break b}}a=i.data,i=a===`F!`||a===`F`?i:null}if(i){ea=lm(i.nextSibling),r=i.data===`F!`;break a}}ia(r)}r=!1}r&&(t=n[0])}}return n=ts(),n.memoizedState=n.baseState=t,r={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Ts,lastRenderedState:t},n.queue=r,n=ic.bind(null,q,r),r.dispatch=n,r=_s(!1),a=oc.bind(null,q,!1,r.queue),r=ts(),i={state:t,dispatch:null,action:e,pending:null},r.queue=i,n=ys.bind(null,q,i,a,n),i.dispatch=n,r.memoizedState=e,[t,n,!1]}function Ds(e){return Os(ns(),Lo,e)}function Os(e,t,n){if(t=ls(e,t,Ts)[0],e=cs(ss)[0],typeof t==`object`&&t&&typeof t.then==`function`)try{var r=is(t)}catch(e){throw e===Wa?Ka:e}else r=t;t=ns();var i=t.queue,a=i.dispatch;return n!==t.memoizedState&&(q.flags|=2048,js(9,{destroy:void 0},ks.bind(null,i,n),null)),[r,a,e]}function ks(e,t){e.action=t}function As(e){var t=ns(),n=Lo;if(n!==null)return Os(t,n,e);ns(),t=t.memoizedState,n=ns();var r=n.queue.dispatch;return n.memoizedState=e,[t,r,!1]}function js(e,t,n,r){return e={tag:e,create:n,deps:r,inst:t,next:null},t=q.updateQueue,t===null&&(t=rs(),q.updateQueue=t),n=t.lastEffect,n===null?t.lastEffect=e.next=e:(r=n.next,n.next=e,e.next=r,t.lastEffect=e),e}function Ms(){return ns().memoizedState}function Ns(e,t,n,r){var i=ts();q.flags|=e,i.memoizedState=js(1|t,{destroy:void 0},n,r===void 0?null:r)}function Ps(e,t,n,r){var i=ns();r=r===void 0?null:r;var a=i.memoizedState.inst;Lo!==null&&r!==null&&qo(r,Lo.memoizedState.deps)?i.memoizedState=js(t,a,n,r):(q.flags|=e,i.memoizedState=js(1|t,a,n,r))}function Fs(e,t){Ns(8390656,8,e,t)}function Is(e,t){Ps(2048,8,e,t)}function Ls(e){q.flags|=4;var t=q.updateQueue;if(t===null)t=rs(),q.updateQueue=t,t.events=[e];else{var n=t.events;n===null?t.events=[e]:n.push(e)}}function Rs(e){var t=ns().memoizedState;return Ls({ref:t,nextImpl:e}),function(){if(X&2)throw Error(i(440));return t.impl.apply(void 0,arguments)}}function zs(e,t){return Ps(4,2,e,t)}function Bs(e,t){return Ps(4,4,e,t)}function Vs(e,t){if(typeof t==`function`){e=e();var n=t(e);return function(){typeof n==`function`?n():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function Hs(e,t,n){n=n==null?null:n.concat([e]),Ps(4,4,Vs.bind(null,t,e),n)}function Us(){}function Ws(e,t){var n=ns();t=t===void 0?null:t;var r=n.memoizedState;return t!==null&&qo(t,r[1])?r[0]:(n.memoizedState=[e,t],e)}function Gs(e,t){var n=ns();t=t===void 0?null:t;var r=n.memoizedState;if(t!==null&&qo(t,r[1]))return r[0];if(r=e(),Vo){Xe(!0);try{e()}finally{Xe(!1)}}return n.memoizedState=[r,t],r}function Ks(e,t,n){return n===void 0||Io&1073741824&&!(Q&261930)?e.memoizedState=t:(e.memoizedState=n,e=Ad(),q.lanes|=e,id|=e,n)}function qs(e,t,n,r){return Lr(n,t)?n:bo.current===null?!(Io&106)||Io&1073741824&&!(Q&261930)?(kc=!0,e.memoizedState=n):(e=Ad(),q.lanes|=e,id|=e,t):(e=Ks(e,n,r),Lr(e,t)||(kc=!0),e)}function Js(e,t,n,r,i){var a=F.p;F.p=a!==0&&8>a?a:8;var o=P.T,s={};s.types=o===null?null:o.types,P.T=s,oc(e,!1,t,n);try{var c=i(),l=P.S;l!==null&&l(s,c),typeof c==`object`&&c&&typeof c.then==`function`?ac(e,t,Ra(c,r),kd(e)):ac(e,t,r,kd(e))}catch(n){ac(e,t,{then:function(){},status:`rejected`,reason:n},kd())}finally{F.p=a,o!==null&&s.types!==null&&(o.types=s.types),P.T=o}}function Ys(){}function Xs(e,t,n,r){if(e.tag!==5)throw Error(i(476));var a=Zs(e).queue;Js(e,a,t,he,n===null?Ys:function(){return Qs(e),n(r)})}function Zs(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:he,baseState:he,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:ss,lastRenderedState:he},next:null};var n={};return t.next={memoizedState:n,baseState:n,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:ss,lastRenderedState:n},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function Qs(e){var t=Zs(e);t.next===null&&(t=e.alternate.memoizedState),ac(e,t.next.queue,{},kd())}function $s(){return ba(sh)}function ec(){return ns().memoizedState}function tc(){return ns().memoizedState}function nc(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var n=kd();e=uo(n);var r=fo(t,e,n);r!==null&&(Md(r,t,n),po(r,t,n)),t={cache:Da()},e.payload=t;return}t=t.return}}function rc(e,t,n){var r=kd();n={lane:r,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},sc(e)?cc(t,n):(n=Si(e,t,n,r),n!==null&&(Md(n,e,r),lc(n,t,r)))}function ic(e,t,n){ac(e,t,n,kd())}function ac(e,t,n,r){var i={lane:r,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null};if(sc(e))cc(t,i);else{var a=e.alternate;if(e.lanes===0&&(a===null||a.lanes===0)&&(a=t.lastRenderedReducer,a!==null))try{var o=t.lastRenderedState,s=a(o,n);if(i.hasEagerState=!0,i.eagerState=s,Lr(s,o))return xi(e,t,i,0),Xu===null&&bi(),!1}catch{}if(n=Si(e,t,i,r),n!==null)return Md(n,e,r),lc(n,t,r),!0}return!1}function oc(e,t,n,r){if(r={lane:2,revertLane:Nf(),gesture:null,action:r,hasEagerState:!1,eagerState:null,next:null},sc(e)){if(t)throw Error(i(479))}else t=Si(e,n,r,2),t!==null&&Md(t,e,2)}function sc(e){var t=e.alternate;return e===q||t!==null&&t===q}function cc(e,t){Bo=zo=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function lc(e,t,n){if(n&4194048){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,mt(e,n)}}var uc={readContext:ba,use:as,useCallback:Ko,useContext:Ko,useEffect:Ko,useImperativeHandle:Ko,useLayoutEffect:Ko,useInsertionEffect:Ko,useMemo:Ko,useReducer:Ko,useRef:Ko,useState:Ko,useDebugValue:Ko,useDeferredValue:Ko,useTransition:Ko,useSyncExternalStore:Ko,useId:Ko,useHostTransitionStatus:Ko,useFormState:Ko,useActionState:Ko,useOptimistic:Ko,useMemoCache:Ko,useCacheRefresh:Ko,useEffectEvent:Ko},dc={readContext:ba,use:as,useCallback:function(e,t){return ts().memoizedState=[e,t===void 0?null:t],e},useContext:ba,useEffect:Fs,useImperativeHandle:function(e,t,n){n=n==null?null:n.concat([e]),Ns(4194308,4,Vs.bind(null,t,e),n)},useLayoutEffect:function(e,t){return Ns(4194308,4,e,t)},useInsertionEffect:function(e,t){Ns(4,2,e,t)},useMemo:function(e,t){var n=ts();t=t===void 0?null:t;var r=e();if(Vo){Xe(!0);try{e()}finally{Xe(!1)}}return n.memoizedState=[r,t],r},useReducer:function(e,t,n){var r=ts();if(n!==void 0){var i=n(t);if(Vo){Xe(!0);try{n(t)}finally{Xe(!1)}}}else i=t;return r.memoizedState=r.baseState=i,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:i},r.queue=e,e=e.dispatch=rc.bind(null,q,e),[r.memoizedState,e]},useRef:function(e){var t=ts();return e={current:e},t.memoizedState=e},useState:function(e){e=_s(e);var t=e.queue,n=ic.bind(null,q,t);return t.dispatch=n,[e.memoizedState,n]},useDebugValue:Us,useDeferredValue:function(e,t){return Ks(ts(),e,t)},useTransition:function(){var e=_s(!1);return e=Js.bind(null,q,e.queue,!0,!1),ts().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,n){var r=q,a=ts();if(W){if(n===void 0)throw Error(i(407));n=n()}else{if(n=t(),Xu===null)throw Error(i(349));Q&127||fs(r,t,n)}a.memoizedState=n;var o={value:n,getSnapshot:t};return a.queue=o,Fs(ms.bind(null,r,o,e),[e]),r.flags|=2048,js(9,{destroy:void 0},ps.bind(null,r,o,n,t),null),n},useId:function(){var e=ts(),t=Xu.identifierPrefix;if(W){var n=qi,r=Ki;n=(r&~(1<<32-Ze(r)-1)).toString(32)+n,t=`_`+t+`R_`+n,n=Ho++,0<n&&(t+=`H`+n.toString(32)),t+=`_`}else n=Go++,t=`_`+t+`r_`+n.toString(32)+`_`;return e.memoizedState=t},useHostTransitionStatus:$s,useFormState:Es,useActionState:Es,useOptimistic:function(e){var t=ts();t.memoizedState=t.baseState=e;var n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=n,t=oc.bind(null,q,!0,n),n.dispatch=t,[e,t]},useMemoCache:os,useCacheRefresh:function(){return ts().memoizedState=nc.bind(null,q)},useEffectEvent:function(e){var t=ts(),n={impl:e};return t.memoizedState=n,function(){if(X&2)throw Error(i(440));return n.impl.apply(void 0,arguments)}}},fc={readContext:ba,use:as,useCallback:Ws,useContext:ba,useEffect:Is,useImperativeHandle:Hs,useInsertionEffect:zs,useLayoutEffect:Bs,useMemo:Gs,useReducer:cs,useRef:Ms,useState:function(){return cs(ss)},useDebugValue:Us,useDeferredValue:function(e,t){return qs(ns(),Lo.memoizedState,e,t)},useTransition:function(){var e=cs(ss)[0],t=ns().memoizedState;return[typeof e==`boolean`?e:is(e),t]},useSyncExternalStore:ds,useId:ec,useHostTransitionStatus:$s,useFormState:Ds,useActionState:Ds,useOptimistic:function(e,t){return vs(ns(),Lo,e,t)},useMemoCache:os,useCacheRefresh:tc,useEffectEvent:Rs},pc={readContext:ba,use:as,useCallback:Ws,useContext:ba,useEffect:Is,useImperativeHandle:Hs,useInsertionEffect:zs,useLayoutEffect:Bs,useMemo:Gs,useReducer:us,useRef:Ms,useState:function(){return us(ss)},useDebugValue:Us,useDeferredValue:function(e,t){var n=ns();return Lo===null?Ks(n,e,t):qs(n,Lo.memoizedState,e,t)},useTransition:function(){var e=us(ss)[0],t=ns().memoizedState;return[typeof e==`boolean`?e:is(e),t]},useSyncExternalStore:ds,useId:ec,useHostTransitionStatus:$s,useFormState:As,useActionState:As,useOptimistic:function(e,t){var n=ns();return Lo===null?(n.baseState=e,[e,n.queue.dispatch]):vs(n,Lo,e,t)},useMemoCache:os,useCacheRefresh:tc,useEffectEvent:Rs};function mc(e,t,n,r){t=e.memoizedState,n=n(r,t),n=n==null?t:T({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var hc={enqueueSetState:function(e,t,n){e=e._reactInternals;var r=kd(),i=uo(r);i.payload=t,n!=null&&(i.callback=n),t=fo(e,i,r),t!==null&&(Md(t,e,r),po(t,e,r))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var r=kd(),i=uo(r);i.tag=1,i.payload=t,n!=null&&(i.callback=n),t=fo(e,i,r),t!==null&&(Md(t,e,r),po(t,e,r))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=kd(),r=uo(n);r.tag=2,t!=null&&(r.callback=t),t=fo(e,r,n),t!==null&&(Md(t,e,n),po(t,e,n))}};function gc(e,t,n,r,i,a,o){return e=e.stateNode,typeof e.shouldComponentUpdate==`function`?e.shouldComponentUpdate(r,a,o):t.prototype&&t.prototype.isPureReactComponent?!Rr(n,r)||!Rr(i,a):!0}function _c(e,t,n,r){e=t.state,typeof t.componentWillReceiveProps==`function`&&t.componentWillReceiveProps(n,r),typeof t.UNSAFE_componentWillReceiveProps==`function`&&t.UNSAFE_componentWillReceiveProps(n,r),t.state!==e&&hc.enqueueReplaceState(t,t.state,null)}function vc(e,t){var n=t;if(`ref`in t)for(var r in n={},t)r!==`ref`&&(n[r]=t[r]);if(e=e.defaultProps)for(var i in n===t&&(n=T({},n)),e)n[i]===void 0&&(n[i]=e[i]);return n}function yc(e){gi(e)}function bc(e){console.error(e)}function xc(e){gi(e)}function Sc(e,t){try{var n=e.onUncaughtError;n(t.value,{componentStack:t.stack})}catch(e){setTimeout(function(){throw e})}}function Cc(e,t,n){try{var r=e.onCaughtError;r(n.value,{componentStack:n.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(e){setTimeout(function(){throw e})}}function wc(e,t,n){return n=uo(n),n.tag=3,n.payload={element:null},n.callback=function(){Sc(e,t)},n}function Tc(e){return e=uo(e),e.tag=3,e}function Ec(e,t,n,r){var i=n.type.getDerivedStateFromError;if(typeof i==`function`){var a=r.value;e.payload=function(){return i(a)},e.callback=function(){Cc(t,n,r)}}var o=n.stateNode;o!==null&&typeof o.componentDidCatch==`function`&&(e.callback=function(){Cc(t,n,r),typeof i!=`function`&&(gd===null?gd=new Set([this]):gd.add(this));var e=r.stack;this.componentDidCatch(r.value,{componentStack:e===null?``:e})})}function Dc(e,t,n,r,a){if(n.flags|=32768,typeof r==`object`&&r&&typeof r.then==`function`){if(t=n.alternate,t!==null&&_a(t,n,a,!0),n=To.current,n!==null){switch(n.tag){case 31:case 13:case 19:return Eo===null?Wd():n.alternate===null&&rd===0&&(rd=3),n.flags&=-257,n.flags|=65536,n.lanes=a,r===qa?n.flags|=16384:(t=n.updateQueue,t===null?n.updateQueue=new Set([r]):t.add(r),pf(e,r,a)),!1;case 22:return n.flags|=65536,r===qa?n.flags|=16384:(t=n.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([r])},n.updateQueue=t):(n=t.retryQueue,n===null?t.retryQueue=new Set([r]):n.add(r)),pf(e,r,a)),!1}throw Error(i(435,n.tag))}return pf(e,r,a),Wd(),!1}if(W)return t=To.current,t===null?(r!==ra&&(t=Error(i(423),{cause:r}),G(Ri(t,n))),e=e.current.alternate,e.flags|=65536,a&=-a,e.lanes|=a,r=Ri(r,n),a=wc(e.stateNode,r,a),mo(e,a),rd!==4&&(rd=2)):(!(t.flags&65536)&&(t.flags|=256),t.flags|=65536,t.lanes=a,r!==ra&&(e=Error(i(422),{cause:r}),G(Ri(e,n)))),!1;var o=Error(i(520),{cause:r});if(o=Ri(o,n),ld===null?ld=[o]:ld.push(o),rd!==4&&(rd=2),t===null)return!0;r=Ri(r,n),n=t;do{switch(n.tag){case 3:return n.flags|=65536,e=a&-a,n.lanes|=e,e=wc(n.stateNode,r,e),mo(n,e),!1;case 1:if(t=n.type,o=n.stateNode,!(n.flags&128)&&(typeof t.getDerivedStateFromError==`function`||o!==null&&typeof o.componentDidCatch==`function`&&(gd===null||!gd.has(o))))return n.flags|=65536,a&=-a,n.lanes|=a,a=Tc(a),Ec(a,e,n,r),mo(n,a),!1;break;case 22:if(n.memoizedState!==null)return n.flags|=65536,!1}n=n.return}while(n!==null);return!1}var Oc=Error(i(461)),kc=!1;function Ac(e,t,n,r){t.child=e===null?oo(t,null,n,r):ao(t,e.child,n,r)}function jc(e,t,n,r,i){n=n.render;var a=t.ref;if(`ref`in r){var o={};for(var s in r)s!==`ref`&&(o[s]=r[s])}else o=r;return ya(t),r=Jo(e,t,n,o,a,i),s=Qo(),e!==null&&!kc?($o(e,t,i),al(e,t,i)):(W&&s&&Xi(t),t.flags|=1,Ac(e,t,r,i),t.child)}function Mc(e,t,n,r,i){if(e===null){var a=n.type;return typeof a==`function`&&!ki(a)&&a.defaultProps===void 0&&n.compare===null?(t.tag=15,t.type=a,Nc(e,t,a,r,i)):(e=Mi(n.type,null,r,t,t.mode,i),e.ref=t.ref,e.return=t,t.child=e)}if(a=e.child,!ol(e,i)){var o=a.memoizedProps;if(n=n.compare,n=n===null?Rr:n,n(o,r)&&e.ref===t.ref)return al(e,t,i)}return t.flags|=1,e=Ai(a,r),e.ref=t.ref,e.return=t,t.child=e}function Nc(e,t,n,r,i){if(e!==null){var a=e.memoizedProps;if(Rr(a,r)&&e.ref===t.ref){if(kc=!1,t.pendingProps=r=a,ol(e,i))e.flags&131072&&(kc=!0);else return t.lanes=e.lanes,al(e,t,i)}}return Vc(e,t,n,r,i)}function Pc(e,t,n,r){var i=r.children,a=e===null?null:e.memoizedState;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),r.mode===`hidden`){if(t.flags&128){if(a=a===null?n:a.baseLanes|n,e!==null){for(r=t.child=e.child,i=0;r!==null;)i=i|r.lanes|r.childLanes,r=r.sibling;r=i&~a}else r=0,t.child=null;return Ic(e,t,a,n,r)}if(n&536870912)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&Ha(t,a===null?null:a.cachePool),a===null?Co():So(t,a),ko(t);else return r=t.lanes=536870912,Ic(e,t,a===null?n:a.baseLanes|n,n,r)}else a===null?(e!==null&&Ha(t,null),Co(),Ao()):(Ha(t,a.cachePool),So(t,a),Ao(),t.memoizedState=null);return Ac(e,t,i,n),t.child}function Fc(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function Ic(e,t,n,r,i){var a=Va();return a=a===null?null:{parent:Ea._currentValue,pool:a},t.memoizedState={baseLanes:n,cachePool:a},e!==null&&Ha(t,null),Co(),ko(t),e!==null&&_a(e,t,r,!0),t.childLanes=i,null}function Lc(e,t){return t=Xc({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function Rc(e,t,n){return ao(t,e.child,null,n),e=Lc(t,t.pendingProps),e.flags|=2,jo(t),t.memoizedState=null,e}function zc(e,t,n){var r=t.pendingProps,a=!!(t.flags&128);if(t.flags&=-129,e===null){if(W){if(r.mode===`hidden`)return e=Lc(t,r),t.lanes=536870912,e.memoizedState={baseLanes:0,cachePool:null},Fc(null,e);if(Oo(t),(e=ea)?(e=am(e,na),e=e!==null&&e.data===`&`?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Gi===null?null:{id:Ki,overflow:qi},retryLane:536870912,hydrationErrors:null},n=Fi(e),n.return=t,t.child=n,$i=t,ea=null)):e=null,e===null)throw ia(t);return t.lanes=536870912,null}return Lc(t,r)}var o=e.memoizedState;if(o!==null){var s=o.dehydrated;if(Oo(t),a){if(t.flags&256)t.flags&=-257,t=Rc(e,t,n);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(i(558))}else if(kc||_a(e,t,n,!1),a=(n&e.childLanes)!==0,kc||a){if(bo.current===null){if(r=Xu,r!==null&&(s=ht(r,n),s!==0&&s!==o.retryLane))throw o.retryLane=s,Ci(e,s),Md(r,e,s),Oc;Wd()}t=Rc(e,t,n)}else e=o.treeContext,ea=lm(s.nextSibling),$i=t,W=!0,ta=null,na=!1,e!==null&&Qi(t,e),t=Lc(t,r),t.flags|=134221824;return t}return e=Ai(e.child,{mode:r.mode,children:r.children}),e.ref=t.ref,t.child=e,e.return=t,e}function Bc(e,t){var n=t.ref;if(n===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof n!=`function`&&typeof n!=`object`)throw Error(i(284));(e===null||e.ref!==n)&&(t.flags|=4194816)}}function Vc(e,t,n,r,i){return ya(t),n=Jo(e,t,n,r,void 0,i),r=Qo(),e!==null&&!kc?($o(e,t,i),al(e,t,i)):(W&&r&&Xi(t),t.flags|=1,Ac(e,t,n,i),t.child)}function Hc(e,t,n,r,i,a){return ya(t),t.updateQueue=null,n=Xo(t,r,n,i),Yo(e),r=Qo(),e!==null&&!kc?($o(e,t,a),al(e,t,a)):(W&&r&&Xi(t),t.flags|=1,Ac(e,t,n,a),t.child)}function Uc(e,t,n,r,i){if(ya(t),t.stateNode===null){var a=Ei,o=n.contextType;typeof o==`object`&&o&&(a=ba(o)),a=new n(r,a),t.memoizedState=a.state!==null&&a.state!==void 0?a.state:null,a.updater=hc,t.stateNode=a,a._reactInternals=t,a=t.stateNode,a.props=r,a.state=t.memoizedState,a.refs={},co(t),o=n.contextType,a.context=typeof o==`object`&&o?ba(o):Ei,a.state=t.memoizedState,o=n.getDerivedStateFromProps,typeof o==`function`&&(mc(t,n,o,r),a.state=t.memoizedState),typeof n.getDerivedStateFromProps==`function`||typeof a.getSnapshotBeforeUpdate==`function`||typeof a.UNSAFE_componentWillMount!=`function`&&typeof a.componentWillMount!=`function`||(o=a.state,typeof a.componentWillMount==`function`&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount==`function`&&a.UNSAFE_componentWillMount(),o!==a.state&&hc.enqueueReplaceState(a,a.state,null),_o(t,r,a,i),go(),a.state=t.memoizedState),typeof a.componentDidMount==`function`&&(t.flags|=4194308),r=!0}else if(e===null){a=t.stateNode;var s=t.memoizedProps,c=vc(n,s);a.props=c;var l=a.context,u=n.contextType;o=Ei,typeof u==`object`&&u&&(o=ba(u));var d=n.getDerivedStateFromProps;u=typeof d==`function`||typeof a.getSnapshotBeforeUpdate==`function`,s=t.pendingProps!==s,u||typeof a.UNSAFE_componentWillReceiveProps!=`function`&&typeof a.componentWillReceiveProps!=`function`||(s||l!==o)&&_c(t,a,r,o),so=!1;var f=t.memoizedState;a.state=f,_o(t,r,a,i),go(),l=t.memoizedState,s||f!==l||so?(typeof d==`function`&&(mc(t,n,d,r),l=t.memoizedState),(c=so||gc(t,n,c,r,f,l,o))?(u||typeof a.UNSAFE_componentWillMount!=`function`&&typeof a.componentWillMount!=`function`||(typeof a.componentWillMount==`function`&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount==`function`&&a.UNSAFE_componentWillMount()),typeof a.componentDidMount==`function`&&(t.flags|=4194308)):(typeof a.componentDidMount==`function`&&(t.flags|=4194308),t.memoizedProps=r,t.memoizedState=l),a.props=r,a.state=l,a.context=o,r=c):(typeof a.componentDidMount==`function`&&(t.flags|=4194308),r=!1)}else{a=t.stateNode,lo(e,t),o=t.memoizedProps,u=vc(n,o),a.props=u,d=t.pendingProps,f=a.context,l=n.contextType,c=Ei,typeof l==`object`&&l&&(c=ba(l)),s=n.getDerivedStateFromProps,(l=typeof s==`function`||typeof a.getSnapshotBeforeUpdate==`function`)||typeof a.UNSAFE_componentWillReceiveProps!=`function`&&typeof a.componentWillReceiveProps!=`function`||(o!==d||f!==c)&&_c(t,a,r,c),so=!1,f=t.memoizedState,a.state=f,_o(t,r,a,i),go();var p=t.memoizedState;o!==d||f!==p||so||e!==null&&e.dependencies!==null&&va(e.dependencies)?(typeof s==`function`&&(mc(t,n,s,r),p=t.memoizedState),(u=so||gc(t,n,u,r,f,p,c)||e!==null&&e.dependencies!==null&&va(e.dependencies))?(l||typeof a.UNSAFE_componentWillUpdate!=`function`&&typeof a.componentWillUpdate!=`function`||(typeof a.componentWillUpdate==`function`&&a.componentWillUpdate(r,p,c),typeof a.UNSAFE_componentWillUpdate==`function`&&a.UNSAFE_componentWillUpdate(r,p,c)),typeof a.componentDidUpdate==`function`&&(t.flags|=4),typeof a.getSnapshotBeforeUpdate==`function`&&(t.flags|=1024)):(typeof a.componentDidUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=1024),t.memoizedProps=r,t.memoizedState=p),a.props=r,a.state=p,a.context=c,r=u):(typeof a.componentDidUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=1024),r=!1)}return a=r,Bc(e,t),r=!!(t.flags&128),a||r?(a=t.stateNode,n=r&&typeof n.getDerivedStateFromError!=`function`?null:a.render(),t.flags|=1,e!==null&&r?(t.child=ao(t,e.child,null,i),t.child=ao(t,null,n,i)):Ac(e,t,n,i),t.memoizedState=a.state,e=t.child):e=al(e,t,i),e}function Wc(e,t,n,r){return ca(),t.flags|=256,Ac(e,t,n,r),t.child}var Gc={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function Kc(e){return{baseLanes:e,cachePool:Ua()}}function qc(e,t,n){return e=e===null?0:e.childLanes&~n,t&&(e|=sd),e}function Jc(e,t,n){var r=t.pendingProps,i=!1,a=!!(t.flags&128),o;if((o=a)||(o=e!==null&&e.memoizedState===null?!1:!!(Mo.current&2)),o&&(i=!0,t.flags&=-129),o=!!(t.flags&32),t.flags&=-33,e===null){if(W){if(i?Do(t):Ao(),(e=ea)?(e=am(e,na),e=e!==null&&e.data!==`&`?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Gi===null?null:{id:Ki,overflow:qi},retryLane:536870912,hydrationErrors:null},n=Fi(e),n.return=t,t.child=n,$i=t,ea=null)):e=null,e===null)throw ia(t);return t.lanes=sm(e)?32:536870912,null}return a=r.children,r=r.fallback,i?(Ao(),i=t.mode,a=Xc({mode:`hidden`,children:a},i),r=Ni(r,i,n,null),a.return=t,r.return=t,a.sibling=r,t.child=a,r=t.child,r.memoizedState=Kc(n),r.childLanes=qc(e,o,n),t.memoizedState=Gc,Fc(null,r)):(Do(t),Yc(t,a))}var s=e.memoizedState;if(s!==null){var c=s.dehydrated;if(c!==null)return Qc(e,t,a,o,r,c,s,n)}return i?(Ao(),i=r.fallback,a=t.mode,s=e.child,c=s.sibling,r=Ai(s,{mode:`hidden`,children:r.children}),r.subtreeFlags=s.subtreeFlags&1206910976,c===null?(i=Ni(i,a,n,null),i.flags|=2):i=Ai(c,i),i.return=t,r.return=t,r.sibling=i,t.child=r,Fc(null,r),r=t.child,i=e.child.memoizedState,i===null?i=Kc(n):(a=i.cachePool,a===null?a=Ua():(s=Ea._currentValue,a=a.parent===s?a:{parent:s,pool:s}),i={baseLanes:i.baseLanes|n,cachePool:a}),r.memoizedState=i,r.childLanes=qc(e,o,n),t.memoizedState=Gc,Fc(e.child,r)):(Do(t),n=e.child,e=n.sibling,n=Ai(n,{mode:`visible`,children:r.children}),n.return=t,n.sibling=null,e!==null&&(o=t.deletions,o===null?(t.deletions=[e],t.flags|=16):o.push(e)),t.child=n,t.memoizedState=null,n)}function Yc(e,t){return t=Xc({mode:`visible`,children:t},e.mode),t.return=e,e.child=t}function Xc(e,t){return e=Oi(22,e,null,t),e.lanes=0,e}function Zc(e,t,n){return ao(t,e.child,null,n),e=Yc(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function Qc(e,t,n,r,a,o,s,c){if(n)return t.flags&256?(Do(t),t.flags&=-257,Zc(e,t,c)):t.memoizedState===null?(Ao(),o=a.fallback,s=t.mode,a=Xc({mode:`visible`,children:a.children},s),o=Ni(o,s,c,null),o.flags|=2,a.return=t,o.return=t,a.sibling=o,t.child=a,ao(t,e.child,null,c),a=t.child,a.memoizedState=Kc(c),a.childLanes=qc(e,r,c),t.memoizedState=Gc,Fc(null,a)):(Ao(),t.child=e.child,t.flags|=128,null);if(Do(t),sm(o)){if(r=o.nextSibling&&o.nextSibling.dataset,r)var l=r.dgst;return r=l,r!==``&&(a=Error(i(419)),a.stack=``,a.digest=r,G({value:a,source:null,stack:null})),Zc(e,t,c)}if(kc||_a(e,t,c,!1),r=(c&e.childLanes)!==0,kc||r){if(bo.current!==null)return Zc(e,t,c);if(r=Xu,r!==null&&(a=ht(r,c),a!==0&&a!==s.retryLane))throw s.retryLane=a,Ci(e,a),Md(r,e,a),Oc;return om(o)||Wd(),Zc(e,t,c)}return om(o)?(t.flags|=192,t.child=e.child,null):(e=s.treeContext,ea=lm(o.nextSibling),$i=t,W=!0,ta=null,na=!1,e!==null&&Qi(t,e),t=Yc(t,a.children),t.flags|=134221824,t)}function $c(e,t,n){e.lanes|=t;var r=e.alternate;r!==null&&(r.lanes|=t),ha(e.return,t,n)}function el(e){for(var t=null;e!==null;){var n=e.alternate;n!==null&&Fo(n)===null&&(t=e),e=e.sibling}return t}function tl(e,t,n,r,i,a){var o=e.memoizedState;o===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:r,tail:n,tailMode:i,treeForkCount:a}:(o.isBackwards=t,o.rendering=null,o.renderingStartTime=0,o.last=r,o.tail=n,o.tailMode=i,o.treeForkCount=a)}function nl(e){var t=e.child;for(e.child=null;t!==null;){var n=t.sibling;t.sibling=e.child,e.child=t,t=n}}function rl(e,t,n){var r=t.pendingProps,i=r.revealOrder,a=r.tail;r=r.children;var o=Mo.current;if(t.flags&128)return No(t,o),null;var s=!!(o&2);if(s?(o=o&1|2,t.flags|=128):o&=1,No(t,o),i===`backwards`&&e!==null?(nl(e),Ac(e,t,r,n),nl(e)):Ac(e,t,r,n),r=W?Hi:0,!s&&e!==null&&e.flags&128)a:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&$c(e,n,t);else if(e.tag===19)$c(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break a;for(;e.sibling===null;){if(e.return===null||e.return===t)break a;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(i){case`backwards`:n=el(t.child),n===null?(i=t.child,t.child=null):(i=n.sibling,n.sibling=null,nl(t)),tl(t,!0,i,null,a,r);break;case`unstable_legacy-backwards`:for(n=null,i=t.child,t.child=null;i!==null;){if(e=i.alternate,e!==null&&Fo(e)===null){t.child=i;break}e=i.sibling,i.sibling=n,n=i,i=e}tl(t,!0,n,null,a,r);break;case`together`:tl(t,!1,null,null,void 0,r);break;case`independent`:t.memoizedState=null;break;default:n=el(t.child),n===null?(i=t.child,t.child=null):(i=n.sibling,n.sibling=null),tl(t,!1,i,n,a,r)}return t.child}function il(e,t,n){var r=t.pendingProps;return pa(t,t.type,r.value),Ac(e,t,r.children,n),t.child}function al(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),id|=t.lanes,(n&t.childLanes)===0){if(e!==null){if(_a(e,t,n,!1),(n&t.childLanes)===0)return null}else return null}if(e!==null&&t.child!==e.child)throw Error(i(153));if(t.child!==null){for(e=t.child,n=Ai(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=Ai(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function ol(e,t){return(e.lanes&t)!==0||(e=e.dependencies,!!(e!==null&&va(e)))}function sl(e,t,n){switch(t.tag){case 3:we(t,t.stateNode.containerInfo),pa(t,Ea,e.memoizedState.cache),ca();break;case 27:case 5:Ee(t);break;case 4:we(t,t.stateNode.containerInfo);break;case 10:pa(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,Oo(t),null;break;case 13:var r=t.memoizedState;if(r!==null){if(r.dehydrated!==null)return Do(t),t.flags|=128,null;r=_a(e,t,n,!1);var i=t.child.childLanes;return r||(n&i)!==0?Jc(e,t,n):(Do(t),e=al(e,t,n),e===null?null:e.sibling)}Do(t);break;case 19:if(t.flags&128)return rl(e,t,n);if(i=!!(e.flags&128),r=(n&t.childLanes)!==0,r||=(_a(e,t,n,!1),(n&t.childLanes)!==0),i){if(r)return rl(e,t,n);t.flags|=128}if(i=t.memoizedState,i!==null&&(i.rendering=null,i.tail=null,i.lastEffect=null),No(t,Mo.current),r)break;return null;case 22:return t.lanes=0,Pc(e,t,n,t.pendingProps);case 24:pa(t,Ea,e.memoizedState.cache)}return al(e,t,n)}function cl(e,t,n){if(e!==null){if(e.memoizedProps!==t.pendingProps)kc=!0;else{if(!ol(e,n)&&!(t.flags&128))return kc=!1,sl(e,t,n);kc=!!(e.flags&131072)}}else kc=!1,W&&t.flags&1048576&&Yi(t,Hi,t.index);switch(t.lanes=0,t.tag){case 16:a:{var r=t.pendingProps;if(e=Xa(t.elementType),t.type=e,typeof e==`function`)ki(e)?(r=vc(e,r),t.tag=1,t=Uc(null,t,e,r,n)):(t.tag=0,t=Vc(null,t,e,r,n));else{if(e!=null){var a=e.$$typeof;if(a===re){t.tag=11,t=jc(null,t,e,r,n);break a}if(a===oe){t.tag=14,t=Mc(null,t,e,r,n);break a}if(a===ne){t.tag=10,t.type=e,t=il(null,t,n);break a}}throw t=pe(e)||e,Error(i(306,t,``))}}return t;case 0:return Vc(e,t,t.type,t.pendingProps,n);case 1:return r=t.type,a=vc(r,t.pendingProps),Uc(e,t,r,a,n);case 3:a:{if(we(t,t.stateNode.containerInfo),e===null)throw Error(i(387));r=t.pendingProps;var o=t.memoizedState;a=o.element,lo(e,t),_o(t,r,null,n);var s=t.memoizedState;if(r=s.cache,pa(t,Ea,r),r!==o.cache&&ga(t,[Ea],n,!0),go(),r=s.element,o.isDehydrated){if(o={element:r,isDehydrated:!1,cache:s.cache},t.updateQueue.baseState=o,t.memoizedState=o,t.flags&256){t=Wc(e,t,r,n);break a}if(r!==a){a=Ri(Error(i(424)),t),G(a),t=Wc(e,t,r,n);break a}switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName===`HTML`?e.ownerDocument.body:e}for(ea=lm(e.firstChild),$i=t,W=!0,ta=null,na=!0,n=oo(t,null,r,n),t.child=n;n;)n.flags=n.flags&-3|134221824,n=n.sibling}else{if(ca(),r===a){t=al(e,t,n);break a}Ac(e,t,r,n)}t=t.child}return t;case 26:return Bc(e,t),e===null?(n=Nm(t.type,null,t.pendingProps,null))?t.memoizedState=n:W||(t.stateNode=fp(t.type,t.pendingProps,Se.current,t)):t.memoizedState=Nm(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return Ee(t),e===null&&W&&(r=t.stateNode=hm(t.type,t.pendingProps,Se.current),$i=t,na=!0,a=ea,Sp(t.type)?(um=a,ea=lm(r.firstChild)):ea=a),Ac(e,t,t.pendingProps.children,n),Bc(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&W&&((a=r=ea)&&(r=rm(r,t.type,t.pendingProps,na),r===null?a=!1:(t.stateNode=r,$i=t,ea=lm(r.firstChild),na=!1,a=!0)),a||ia(t)),Ee(t),a=t.type,o=t.pendingProps,s=e===null?null:e.memoizedProps,r=o.children,pp(a,o)?r=null:s!==null&&pp(a,s)&&(t.flags|=32),t.memoizedState!==null&&(a=Jo(e,t,Zo,null,null,n),sh._currentValue=a),Bc(e,t),Ac(e,t,r,n),t.child;case 6:return e===null&&W&&((e=n=ea)&&(n=im(n,t.pendingProps,na),n===null?e=!1:(t.stateNode=n,$i=t,ea=null,e=!0)),e||ia(t)),null;case 13:return Jc(e,t,n);case 4:return we(t,t.stateNode.containerInfo),r=t.pendingProps,e===null?t.child=ao(t,null,r,n):Ac(e,t,r,n),t.child;case 11:return jc(e,t,t.type,t.pendingProps,n);case 7:return r=t.pendingProps,Bc(e,t),Ac(e,t,r,n),t.child;case 8:return Ac(e,t,t.pendingProps.children,n),t.child;case 12:return Ac(e,t,t.pendingProps.children,n),t.child;case 10:return il(e,t,n);case 9:return a=t.type._context,r=t.pendingProps.children,ya(t),a=ba(a),r=r(a),t.flags|=1,Ac(e,t,r,n),t.child;case 14:return Mc(e,t,t.type,t.pendingProps,n);case 15:return Nc(e,t,t.type,t.pendingProps,n);case 19:return rl(e,t,n);case 31:return zc(e,t,n);case 22:return Pc(e,t,n,t.pendingProps);case 24:return ya(t),r=ba(Ea),e===null?(a=Va(),a===null&&(a=Xu,o=Da(),a.pooledCache=o,o.refCount++,o!==null&&(a.pooledCacheLanes|=n),a=o),t.memoizedState={parent:r,cache:a},co(t),pa(t,Ea,a)):((e.lanes&n)!==0&&(lo(e,t),_o(t,null,null,n),go()),a=e.memoizedState,o=t.memoizedState,a.parent===r?(r=o.cache,pa(t,Ea,r),r!==a.cache&&ga(t,[Ea],n,!0)):(a={parent:r,cache:r},t.memoizedState=a,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=a),pa(t,Ea,r))),Ac(e,t,t.pendingProps.children,n),t.child;case 30:return t.stateNode===null&&(t.stateNode={autoName:null,paired:null,clones:null,ref:null}),r=t.pendingProps,r.name!=null&&r.name!==`auto`?t.flags|=e===null?18882560:18874368:W&&Xi(t),e!==null&&e.memoizedProps.name!==r.name?t.flags|=4194816:Bc(e,t),Ac(e,t,r.children,n),t.child;case 29:throw t.pendingProps}throw Error(i(156,t.tag))}function ll(e){e.flags|=4}function ul(e,t,n,r,i){var a;if((a=!!(e.mode&32))&&(a=n===null?Jm(t,r):Jm(t,r)&&(r.src!==n.src||r.srcSet!==n.srcSet)),a){if(e.flags|=16777216,(i&335544128)===i){if(e.stateNode.complete)e.flags|=8192;else if(Vd())e.flags|=8192;else throw Za=qa,Ga}}else e.flags&=-16777217}function dl(e,t){if(t.type!==`stylesheet`||t.state.loading&4)e.flags&=-16777217;else if(e.flags|=16777216,!Ym(t)){if(Vd())e.flags|=8192;else throw Za=qa,Ga}}function fl(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag===22?536870912:lt(),e.lanes|=t,cd|=t)}function pl(e,t){if(!W)switch(e.tailMode){case`visible`:break;case`collapsed`:for(var n=e.tail,r=null;n!==null;)n.alternate!==null&&(r=n),n=n.sibling;r===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:r.sibling=null;break;default:for(t=e.tail,n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null}}function ml(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,r=0;if(t)for(var i=e.child;i!==null;)n|=i.lanes|i.childLanes,r|=i.subtreeFlags&1206910976,r|=i.flags&1206910976,i.return=e,i=i.sibling;else for(i=e.child;i!==null;)n|=i.lanes|i.childLanes,r|=i.subtreeFlags,r|=i.flags,i.return=e,i=i.sibling;return e.subtreeFlags|=r,e.childLanes=n,t}function hl(e,t,n){var r=t.pendingProps;switch(Zi(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return ml(t),null;case 1:return ml(t),null;case 3:return n=t.stateNode,r=null,e!==null&&(r=e.memoizedState.cache),t.memoizedState.cache!==r&&(t.flags|=2048),ma(Ea),Te(),n.pendingContext&&(n.context=n.pendingContext,n.pendingContext=null),(e===null||e.child===null)&&(sa(t)?ll(t):e===null||e.memoizedState.isDehydrated&&!(t.flags&256)||(t.flags|=1024,la())),ml(t),null;case 26:var a=t.type,o=t.memoizedState;return e===null?(ll(t),o===null?(ml(t),ul(t,a,null,r,n)):(ml(t),dl(t,o))):o?o===e.memoizedState?(ml(t),t.flags&=-16777217):(ll(t),ml(t),dl(t,o)):(e=e.memoizedProps,e!==r&&ll(t),ml(t),ul(t,a,e,r,n)),null;case 27:if(De(t),n=Se.current,a=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==r&&ll(t);else{if(!r){if(t.stateNode===null)throw Error(i(166));return ml(t),t.subtreeFlags&=-33554433,null}e=be.current,sa(t)?aa(t,e):(e=hm(a,r,n),t.stateNode=e,ll(t))}return ml(t),t.subtreeFlags&=-33554433,null;case 5:if(De(t),a=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==r&&ll(t);else{if(!r){if(t.stateNode===null)throw Error(i(166));return ml(t),t.subtreeFlags&=-33554433,null}if(o=be.current,sa(t))aa(t,o);else{var s=lp(Se.current);switch(o){case 1:o=s.createElementNS(`http://www.w3.org/2000/svg`,a);break;case 2:o=s.createElementNS(`http://www.w3.org/1998/Math/MathML`,a);break;default:switch(a){case`svg`:o=s.createElementNS(`http://www.w3.org/2000/svg`,a);break;case`math`:o=s.createElementNS(`http://www.w3.org/1998/Math/MathML`,a);break;case`script`:o=s.createElement(`div`),o.innerHTML=`<script><\/script>`,o=o.removeChild(o.firstChild);break;case`select`:o=typeof r.is==`string`?s.createElement(`select`,{is:r.is}):s.createElement(`select`),r.multiple?o.multiple=!0:r.size&&(o.size=r.size);break;default:o=typeof r.is==`string`?s.createElement(a,{is:r.is}):s.createElement(a)}}o[xt]=t,o[St]=r;a:for(s=t.child;s!==null;){if(s.tag===5||s.tag===6)o.appendChild(s.stateNode);else if(s.tag!==4&&s.tag!==27&&s.child!==null){s.child.return=s,s=s.child;continue}if(s===t)break a;for(;s.sibling===null;){if(s.return===null||s.return===t)break a;s=s.return}s.sibling.return=s.return,s=s.sibling}t.stateNode=o;a:switch(np(o,a,r),a){case`button`:case`input`:case`select`:case`textarea`:r=!!r.autoFocus;break a;case`img`:r=!0;break a;default:r=!1}r&&ll(t)}}return ml(t),t.subtreeFlags&=-33554433,ul(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,n),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==r&&ll(t);else{if(typeof r!=`string`&&t.stateNode===null)throw Error(i(166));if(e=Se.current,sa(t)){if(e=t.stateNode,n=t.memoizedProps,r=null,a=$i,a!==null)switch(a.tag){case 27:case 5:r=a.memoizedProps}e[xt]=t,e=!!(e.nodeValue===n||r!==null&&!0===r.suppressHydrationWarning||$f(e.nodeValue,n)),e||ia(t,!0)}else e=lp(e).createTextNode(r),e[xt]=t,t.stateNode=e}return ml(t),null;case 31:if(n=t.memoizedState,e===null||e.memoizedState!==null){if(r=sa(t),n!==null){if(e===null){if(!r)throw Error(i(318));if(e=t.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(557));e[xt]=t}else ca(),!(t.flags&128)&&(t.memoizedState=null),t.flags|=4;ml(t),e=!1}else n=la(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=n),e=!0;if(!e)return t.flags&256?(jo(t),t):(jo(t),null);if(t.flags&128)throw Error(i(558))}return ml(t),null;case 13:if(r=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(a=sa(t),r!==null&&r.dehydrated!==null){if(e===null){if(!a)throw Error(i(318));if(a=t.memoizedState,a=a===null?null:a.dehydrated,!a)throw Error(i(317));a[xt]=t}else ca(),!(t.flags&128)&&(t.memoizedState=null),t.flags|=4;ml(t),a=!1}else a=la(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=a),a=!0;if(!a)return t.flags&256?(jo(t),t):(jo(t),null)}return jo(t),t.flags&128?(t.lanes=n,t):(n=r!==null,e=e!==null&&e.memoizedState!==null,n&&(r=t.child,a=null,r.alternate!==null&&r.alternate.memoizedState!==null&&r.alternate.memoizedState.cachePool!==null&&(a=r.alternate.memoizedState.cachePool.pool),o=null,r.memoizedState!==null&&r.memoizedState.cachePool!==null&&(o=r.memoizedState.cachePool.pool),o!==a&&(r.flags|=2048)),n!==e&&n&&(t.child.flags|=8192),fl(t,t.updateQueue),ml(t),null);case 4:return Te(),e===null&&Uf(t.stateNode.containerInfo),t.flags|=67108864,ml(t),null;case 10:return ma(t.type),ml(t),null;case 19:if(Po(t),r=t.memoizedState,r===null)return ml(t),null;if(a=!!(t.flags&128),o=r.rendering,o===null){if(a)pl(r,!1);else{if(rd!==0||e!==null&&e.flags&128)for(e=t.child;e!==null;){if(o=Fo(e),o!==null){for(t.flags|=128,pl(r,!1),e=o.updateQueue,t.updateQueue=e,fl(t,e),t.subtreeFlags=0,e=n,n=t.child;n!==null;)ji(n,e),n=n.sibling;return No(t,Mo.current&1|2),W&&Ji(t,r.treeForkCount),t.child}e=e.sibling}r.tail!==null&&Be()>md&&(t.flags|=128,a=!0,pl(r,!1),t.lanes=4194304)}}else{if(!a){if(e=Fo(o),e!==null){if(t.flags|=128,a=!0,e=e.updateQueue,t.updateQueue=e,fl(t,e),pl(r,!0),r.tail===null&&r.tailMode!==`collapsed`&&r.tailMode!==`visible`&&!o.alternate&&!W)return ml(t),null}else 2*Be()-r.renderingStartTime>md&&n!==536870912&&(t.flags|=128,a=!0,pl(r,!1),t.lanes=4194304)}r.isBackwards?(o.sibling=t.child,t.child=o):(e=r.last,e===null?t.child=o:e.sibling=o,r.last=o)}if(r.tail!==null){e=r.tail;a:{for(n=e;n!==null;){if(n.alternate!==null){n=!1;break a}n=n.sibling}n=!0}return r.rendering=e,r.tail=e.sibling,r.renderingStartTime=Be(),e.sibling=null,o=Mo.current,o=a?o&1|2:o&1,r.tailMode===`visible`||r.tailMode===`collapsed`||!n||W?No(t,o):(n=o,I(To,t),I(Mo,n),Eo===null&&(Eo=t)),W&&Ji(t,r.treeForkCount),e}return ml(t),null;case 22:case 23:return jo(t),wo(),r=t.memoizedState!==null,e===null?r&&(t.flags|=8192):e.memoizedState!==null!==r&&(t.flags|=8192),r?n&536870912&&!(t.flags&128)&&(ml(t),t.subtreeFlags&6&&(t.flags|=8192)):ml(t),n=t.updateQueue,n!==null&&fl(t,n.retryQueue),n=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),r=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(r=t.memoizedState.cachePool.pool),r!==n&&(t.flags|=2048),e!==null&&ye(Ba),null;case 24:return n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),ma(Ea),ml(t),null;case 25:return null;case 30:return t.flags|=33554432,ml(t),null}throw Error(i(156,t.tag))}function gl(e,t){switch(Zi(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return ma(Ea),Te(),e=t.flags,e&65536&&!(e&128)?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return De(t),null;case 31:if(t.memoizedState!==null){if(jo(t),t.alternate===null)throw Error(i(340));ca()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(jo(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(i(340));ca()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return Po(t),e=t.flags,e&65536?(t.flags=e&-65537|128,e=t.memoizedState,e!==null&&(e.rendering=null,e.tail=null),t.flags|=4,t):null;case 4:return Te(),null;case 10:return ma(t.type),null;case 22:case 23:return jo(t),wo(),e!==null&&ye(Ba),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return ma(Ea),null;case 25:return null;default:return null}}function _l(e,t){switch(Zi(t),t.tag){case 3:ma(Ea),Te();break;case 26:case 27:case 5:De(t);break;case 4:Te();break;case 31:t.memoizedState!==null&&jo(t);break;case 13:jo(t);break;case 19:Po(t);break;case 10:ma(t.type);break;case 22:case 23:jo(t),wo(),e!==null&&ye(Ba);break;case 24:ma(Ea)}}function vl(e,t){try{var n=t.updateQueue,r=n===null?null:n.lastEffect;if(r!==null){var i=r.next;n=i;do{if((n.tag&e)===e){r=void 0;var a=n.create,o=n.inst;r=a(),o.destroy=r}n=n.next}while(n!==i)}}catch(e){ff(t,t.return,e)}}function yl(e,t,n){try{var r=t.updateQueue,i=r===null?null:r.lastEffect;if(i!==null){var a=i.next;r=a;do{if((r.tag&e)===e){var o=r.inst,s=o.destroy;if(s!==void 0){o.destroy=void 0,i=t;var c=n,l=s;try{l()}catch(e){ff(i,c,e)}}}r=r.next}while(r!==a)}}catch(e){ff(t,t.return,e)}}function bl(e){var t=e.updateQueue;if(t!==null){var n=e.stateNode;try{yo(t,n)}catch(t){ff(e,e.return,t)}}}function xl(e,t,n){n.props=vc(e.type,e.memoizedProps),n.state=e.memoizedState;try{n.componentWillUnmount()}catch(n){ff(e,t,n)}}function Sl(e,t){try{var n=e.ref;if(n!==null){switch(e.tag){case 26:case 27:case 5:var r=e.stateNode;break;case 30:var i=e.stateNode,a=pi(e.memoizedProps,i);(i.ref===null||i.ref.name!==a)&&(i.ref=Pp(a)),r=i.ref;break;case 7:if(e.stateNode===null){var o=new Fp(e);p(e.child,!1,Qp,o,void 0,void 0),e.stateNode=o}r=e.stateNode;break;default:r=e.stateNode}typeof n==`function`?e.refCleanup=n(r):n.current=r}}catch(n){ff(e,t,n)}}function Cl(e,t){var n=e.ref,r=e.refCleanup;if(n!==null){if(typeof r==`function`)try{r()}catch(n){ff(e,t,n)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof n==`function`)try{n(null)}catch(n){ff(e,t,n)}else n.current=null}}function wl(e,t){if((e.tag===5||e.tag===27||e.tag===6)&&e.alternate===null&&t!==null)for(var n=0;n<t.length;n++)em(e.stateNode,t[n])}function Tl(e){for(var t=e.return;t!==null&&(Dl(t)&&em(e.stateNode,t.stateNode),!J(t));)t=t.return}function El(e){for(var t=e.return;t!==null&&(Dl(t)&&tm(e.stateNode,t.stateNode),!J(t));)t=t.return}function J(e){return e.tag===5||e.tag===3||e.tag===27}function Dl(e){return e&&e.tag===7&&e.stateNode!==null}function Ol(e){var t=e.type,n=e.memoizedProps,r=e.stateNode;try{a:switch(t){case`button`:case`input`:case`select`:case`textarea`:n.autoFocus&&r.focus();break a;case`img`:n.src?r.src=n.src:n.srcSet&&(r.srcset=n.srcSet)}}catch(t){ff(e,e.return,t)}}function kl(e,t,n){try{var r=e.stateNode;ip(r,e.type,n,t),r[St]=t}catch(t){ff(e,e.return,t)}}function Al(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&Sp(e.type)||e.tag===4}function jl(e){a:for(;;){for(;e.sibling===null;){if(e.return===null||Al(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&Sp(e.type)||e.flags&2||e.child===null||e.tag===4)continue a;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Ml(e,t,n,r){var i=e.tag;if(i===5||i===6)i=e.stateNode,t?(n.nodeType===9?n.body:n.nodeName===`HTML`?n.ownerDocument.body:n).insertBefore(i,t):(t=n.nodeType===9?n.body:n.nodeName===`HTML`?n.ownerDocument.body:n,t.appendChild(i),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=gn)),wl(e,r),z=!0;else if(i!==4&&(i===27&&(wl(e,r),r=null,Sp(e.type)&&(n=e.stateNode,t=null)),e=e.child,e!==null))for(Ml(e,t,n,r),e=e.sibling;e!==null;)Ml(e,t,n,r),e=e.sibling}function Nl(e,t,n,r){var i=e.tag;if(i===5||i===6)i=e.stateNode,t?n.insertBefore(i,t):n.appendChild(i),wl(e,r),z=!0;else if(i!==4&&(i===27&&(wl(e,r),r=null,Sp(e.type)&&(n=e.stateNode)),e=e.child,e!==null))for(Nl(e,t,n,r),e=e.sibling;e!==null;)Nl(e,t,n,r),e=e.sibling}function Pl(e){var t=e.stateNode,n=e.memoizedProps;try{for(var r=e.type,i=t.attributes;i.length;)t.removeAttributeNode(i[0]);np(t,r,n),t[xt]=e,t[St]=n}catch(t){ff(e,e.return,t)}}var Fl=!1,Il=null;function Ll(e){(e.tag===30||e.subtreeFlags&33554432)&&(Fl=!0)}var Rl=null;function zl(){var e=Rl;return Rl=null,e}var Bl=0;function Vl(e,t,n,r,i){return Bl=0,Hl(e.child,t,n,r,i)}function Hl(e,t,n,r,i){for(var a=!1;e!==null;){if(e.tag===5){var o=e.stateNode;if(r!==null){var s=Op(o);r.push(s),s.view&&(a=!0)}else a||Op(o).view&&(a=!0);Fl=!0,Tp(o,Bl===0?t:t+`_`+Bl,n),Bl++}else(e.tag!==22||e.memoizedState===null)&&(e.tag===30&&i||Hl(e.child,t,n,r,i)&&(a=!0));e=e.sibling}return a}function Ul(e,t){for(;e!==null;)e.tag===5?Ep(e.stateNode,e.memoizedProps):(e.tag!==22||e.memoizedState===null)&&(e.tag===30&&t||Ul(e.child,t)),e=e.sibling}function Wl(e){if(e.subtreeFlags&18874368)for(e=e.child;e!==null;){if((e.tag!==22||e.memoizedState===null)&&(Wl(e),e.tag===30&&e.flags&18874368&&e.stateNode.paired)){var t=e.memoizedProps;if(t.name==null||t.name===`auto`)throw Error(i(544));var n=t.name;t=hi(t.default,t.share),t!==`none`&&(Vl(e,n,t,null,!1)||Ul(e.child,!1))}e=e.sibling}}function Gl(e,t){if(e.tag===30){var n=e.stateNode,r=e.memoizedProps,i=pi(r,n),a=hi(r.default,n.paired?r.share:r.enter);a===`none`?Wl(e):Vl(e,i,a,null,!1)?(Wl(e),n.paired||t||jd(e,r.onEnter)):Ul(e.child,!1)}else if(e.subtreeFlags&33554432)for(e=e.child;e!==null;)Gl(e,t),e=e.sibling;else Wl(e)}function Kl(e){if(Il!==null&&Il.size!==0){var t=Il;if(e.subtreeFlags&18874368)for(e=e.child;e!==null;){if(e.tag!==22||e.memoizedState===null){if(e.tag===30&&e.flags&18874368){var n=e.memoizedProps,r=n.name;if(r!=null&&r!==`auto`){var i=t.get(r);if(i!==void 0){var a=hi(n.default,n.share);if(a!==`none`&&(Vl(e,r,a,null,!1)?(a=e.stateNode,i.paired=a,a.paired=i,jd(e,n.onShare)):Ul(e.child,!1)),t.delete(r),t.size===0)break}}}Kl(e)}e=e.sibling}}}function ql(e){if(e.tag===30){var t=e.memoizedProps,n=pi(t,e.stateNode),r=Il===null?void 0:Il.get(n),i=hi(t.default,r===void 0?t.exit:t.share);i!==`none`&&(Vl(e,n,i,null,!1)?r===void 0?jd(e,t.onExit):(i=e.stateNode,r.paired=i,i.paired=r,Il.delete(n),jd(e,t.onShare)):Ul(e.child,!1)),Il!==null&&Kl(e)}else if(e.subtreeFlags&33554432)for(e=e.child;e!==null;)ql(e),e=e.sibling;else Il!==null&&Kl(e)}function Jl(e){for(e=e.child;e!==null;){if(e.tag===30){var t=e.memoizedProps,n=pi(t,e.stateNode);t=hi(t.default,t.update),e.flags&=-5,t!==`none`&&Vl(e,n,t,e.memoizedState=[],!1)}else e.subtreeFlags&33554432&&Jl(e);e=e.sibling}}function Yl(e){if(e.subtreeFlags&18874368)for(e=e.child;e!==null;){if(e.tag!==22||e.memoizedState===null){if(e.tag===30&&e.flags&18874368){var t=e.stateNode;t.paired!==null&&(t.paired=null,Ul(e.child,!1))}Yl(e)}e=e.sibling}}function Xl(e){if(e.tag===30)e.stateNode.paired=null,Ul(e.child,!1),Yl(e);else if(e.subtreeFlags&33554432)for(e=e.child;e!==null;)Xl(e),e=e.sibling;else Yl(e)}function Zl(e){for(e=e.child;e!==null;)e.tag===30?Ul(e.child,!1):e.subtreeFlags&33554432&&Zl(e),e=e.sibling}function Ql(e,t,n,r,i,a,o){for(var s=!1;t!==null;){if(t.tag===5){var c=t.stateNode;if(a!==null&&Bl<a.length){var l=a[Bl],u=Op(c);(l.view||u.view)&&(s=!0);var d;if(d=!(e.flags&4)){if(u.clip)d=!0;else{d=l.rect;var f=u.rect;d=d.y!==f.y||d.x!==f.x||d.height!==f.height||d.width!==f.width}}d&&(e.flags|=4),u.abs?u=!l.abs:(l=l.rect,u=u.rect,u=l.height!==u.height||l.width!==u.width),u&&(e.flags|=32)}else e.flags|=32;e.flags&4&&Tp(c,Bl===0?n:n+`_`+Bl,i),s&&e.flags&4||(Rl===null&&(Rl=[]),Rl.push(c,Bl===0?r:r+`_`+Bl,t.memoizedProps)),Bl++}else(t.tag!==22||t.memoizedState===null)&&(t.tag===30&&o?e.flags|=t.flags&32:Ql(e,t.child,n,r,i,a,o)&&(s=!0));t=t.sibling}return s}function $l(e,t){for(e=e.child;e!==null;){if(e.tag===30){var n=e.memoizedProps,r=e.stateNode,i=pi(n,r),a=hi(n.default,n.update);if(t){r=r.clones;var o=r===null?null:r.map(kp)}else o=e.memoizedState,e.memoizedState=null;r=e;var s=e.child;Bl=0,i=Ql(r,s,i,i,a,o,!1),e.flags&4&&i&&(t||jd(e,n.onUpdate))}else e.subtreeFlags&33554432&&$l(e,t);e=e.sibling}}var eu=!1,Y=!1,tu=!1,nu=!1,ru=typeof WeakSet==`function`?WeakSet:Set,iu=null,au=!1,ou=!1,su=!1,cu=!1;function lu(e,t,n){if(e=e.containerInfo,sp=gh,e=Ur(e),Wr(e)){if(`selectionStart`in e)var r={start:e.selectionStart,end:e.selectionEnd};else a:{r=(r=e.ownerDocument)&&r.defaultView||window;var i=r.getSelection&&r.getSelection();if(i&&i.rangeCount!==0){r=i.anchorNode;var a=i.anchorOffset,o=i.focusNode;i=i.focusOffset;try{r.nodeType,o.nodeType}catch{r=null;break a}var s=0,c=-1,l=-1,u=0,d=0,f=e,p=null;b:for(;;){for(var m;f!==r||a!==0&&f.nodeType!==3||(c=s+a),f!==o||i!==0&&f.nodeType!==3||(l=s+i),f.nodeType===3&&(s+=f.nodeValue.length),(m=f.firstChild)!==null;)p=f,f=m;for(;;){if(f===e)break b;if(p===r&&++u===a&&(c=s),p===o&&++d===i&&(l=s),(m=f.nextSibling)!==null)break;f=p,p=f.parentNode}f=m}r=c===-1||l===-1?null:{start:c,end:l}}else r=null}r||={start:0,end:0}}else r=null;for(cp={focusedElem:e,selectionRange:r},gh=!1,n=(n&335544064)===n,iu=t,t=n?9270:1024;iu!==null;){if(e=iu,n&&(r=e.deletions,r!==null))for(a=0;a<r.length;a++)n&&ql(r[a]);if(e.alternate===null&&e.flags&2)n&&Ll(e),uu(n);else{if(e.tag===22){if(r=e.alternate,e.memoizedState!==null){r!==null&&r.memoizedState===null&&n&&ql(r),uu(n);continue}if(r!==null&&r.memoizedState!==null){n&&Ll(e),uu(n);continue}}r=e.child,(e.subtreeFlags&t)!==0&&r!==null?(r.return=e,iu=r):(n&&Jl(e),uu(n))}}Il=null}function uu(e){for(;iu!==null;){var t=iu,n=e,r=t.alternate,a=t.flags;switch(t.tag){case 0:case 11:case 15:break;case 1:if(a&1024&&r!==null){n=void 0,a=r.memoizedProps,r=r.memoizedState;var o=t.stateNode;try{var s=vc(t.type,a);n=o.getSnapshotBeforeUpdate(s,r),o.__reactInternalSnapshotBeforeUpdate=n}catch(e){ff(t,t.return,e)}}break;case 3:if(a&1024){if(r=t.stateNode.containerInfo,n=r.nodeType,n===9)nm(r);else if(n===1)switch(r.nodeName){case`HEAD`:case`HTML`:case`BODY`:nm(r);break;default:r.textContent=``}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;case 30:n&&r!==null&&(n=pi(r.memoizedProps,r.stateNode),a=t.memoizedProps,a=hi(a.default,a.update),a!==`none`&&Vl(r,n,a,r.memoizedState=[],!0));break;default:if(a&1024)throw Error(i(163))}if(r=t.sibling,r!==null){r.return=t.return,iu=r;break}iu=t.return}}function du(e,t,n){var r=n.flags;switch(n.tag){case 0:case 11:case 15:ju(e,n),r&4&&vl(5,n);break;case 1:if(ju(e,n),r&4){if(e=n.stateNode,t===null)try{e.componentDidMount()}catch(e){ff(n,n.return,e)}else{var i=vc(n.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(i,t,e.__reactInternalSnapshotBeforeUpdate)}catch(e){ff(n,n.return,e)}}}r&64&&bl(n),r&512&&Sl(n,n.return);break;case 3:if(ju(e,n),r&64&&(e=n.updateQueue,e!==null)){if(t=null,n.child!==null)switch(n.child.tag){case 27:case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}try{yo(e,t)}catch(e){ff(n,n.return,e)}}break;case 27:t===null&&r&4&&Pl(n);case 26:case 5:ju(e,n),t===null&&r&4&&Ol(n),r&512&&Sl(n,n.return);break;case 12:ju(e,n);break;case 31:ju(e,n),r&4&&bu(e,n);break;case 13:ju(e,n),r&4&&xu(e,n),r&64&&(e=n.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(n=gf.bind(null,n),cm(e,n))));break;case 22:if(r=n.memoizedState!==null||eu,!r){var a=t!==null&&t.memoizedState!==null||Y;t=eu,i=Y,eu=r,(Y=a)&&!i?(r=2,n.subtreeFlags&8772&&(r|=1),Nu(e,n,r)):ju(e,n),eu=t,Y=i}break;case 30:ju(e,n),r&512&&Sl(n,n.return);break;case 7:r&512&&Sl(n,n.return);default:ju(e,n)}}function fu(e,t){for(e=e.child;e!==null;)pu(e,t),e=e.sibling}function pu(e,t){switch(e.tag){case 5:case 26:try{var n=e.stateNode;if(t){var r=n.style;typeof r.setProperty==`function`?r.setProperty(`display`,`none`,`important`):r.display=`none`}else{var i=e.stateNode,a=e.memoizedProps.style,o=a!=null&&a.hasOwnProperty(`display`)?a.display:null;i.style.display=o==null||typeof o==`boolean`?``:(``+o).trim()}}catch(t){ff(e,e.return,t)}mu(e,t);break;case 6:try{e.stateNode.nodeValue=t?``:e.memoizedProps,z=!0}catch(t){ff(e,e.return,t)}break;case 18:try{var s=e.stateNode;t?wp(s,!0):wp(e.stateNode,!1)}catch(t){ff(e,e.return,t)}break;case 22:case 23:e.memoizedState===null&&fu(e,t);break;default:fu(e,t)}}function mu(e,t){if(e.subtreeFlags&67108864)for(e=e.child;e!==null;){a:{var n=e,r=t;switch(n.tag){case 4:pu(n,r);break a;case 22:n.memoizedState===null&&mu(n,r);break a;default:mu(n,r)}}e=e.sibling}}function hu(e){var t=e.alternate;t!==null&&(e.alternate=null,hu(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&At(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var gu=null,_u=!1;function vu(e,t,n){for(n=n.child;n!==null;)yu(e,t,n),n=n.sibling}function yu(e,t,n){if(L&&typeof L.onCommitFiberUnmount==`function`)try{L.onCommitFiberUnmount(Ye,n)}catch{}switch(n.tag){case 26:Y||Cl(n,t),vu(e,t,n),n.memoizedState?n.memoizedState.count--:n.stateNode&&!Y&&(n=n.stateNode,n.parentNode.removeChild(n));break;case 27:Y||Cl(n,t),El(n);var r=gu,i=_u;Sp(n.type)&&(gu=n.stateNode,_u=!1),vu(e,t,n),gm(n.stateNode,n.type,n.memoizedProps),gu=r,_u=i;break;case 5:Y||Cl(n,t),El(n);case 6:if(n.tag===6&&El(n),r=gu,i=_u,gu=null,vu(e,t,n),gu=r,_u=i,gu!==null){if(_u)try{(gu.nodeType===9?gu.body:gu.nodeName===`HTML`?gu.ownerDocument.body:gu).removeChild(n.stateNode),z=!0}catch(e){ff(n,t,e)}else try{gu.removeChild(n.stateNode),z=!0}catch(e){ff(n,t,e)}}break;case 18:gu!==null&&(_u?(e=gu,Cp(e.nodeType===9?e.body:e.nodeName===`HTML`?e.ownerDocument.body:e,n.stateNode),Hh(e)):Cp(gu,n.stateNode));break;case 4:r=gu,i=_u,gu=n.stateNode.containerInfo,_u=!0,vu(e,t,n),gu=r,_u=i;break;case 0:case 11:case 14:case 15:yl(2,n,t),Y||yl(4,n,t),vu(e,t,n);break;case 1:Y||(Cl(n,t),r=n.stateNode,typeof r.componentWillUnmount==`function`&&xl(n,t,r)),vu(e,t,n);break;case 21:vu(e,t,n);break;case 22:Y=(r=Y)||n.memoizedState!==null,vu(e,t,n),Y=r;break;case 30:Cl(n,t),vu(e,t,n);break;case 7:Y||Cl(n,t),vu(e,t,n);break;default:vu(e,t,n)}}function bu(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Hh(e)}catch(e){ff(t,t.return,e)}}}function xu(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Hh(e)}catch(e){ff(t,t.return,e)}}function Su(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new ru),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new ru),t;default:throw Error(i(435,e.tag))}}function Cu(e,t){var n=Su(e);t.forEach(function(t){if(!n.has(t)){n.add(t);var r=_f.bind(null,e,t);t.then(r,r)}})}function wu(e,t,n){var r=t.deletions;if(r!==null)for(var a=0;a<r.length;a++){var o=r[a],s=e,c=t,l=c;a:for(;l!==null;){switch(l.tag){case 27:if(Sp(l.type)){gu=l.stateNode,_u=!1;break a}break;case 5:gu=l.stateNode,_u=!1;break a;case 3:case 4:gu=l.stateNode.containerInfo,_u=!0;break a}l=l.return}if(gu===null)throw Error(i(160));yu(s,c,o),gu=null,_u=!1,s=o.alternate,s!==null&&(s.return=null),o.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)Eu(t,e,n),t=t.sibling}var Tu=null;function Eu(e,t,n){var r=e.alternate,a=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:if(a&4&&(r=e.updateQueue,r=r===null?null:r.events,r!==null))for(var o=0;o<r.length;o++){var s=r[o];s.ref.impl=s.nextImpl}wu(t,e,n),Du(e),a&4&&(yl(3,e,e.return),vl(3,e),yl(5,e,e.return));break;case 1:wu(t,e,n),Du(e),a&512&&(Y||r===null||Cl(r,r.return)),a&64&&eu&&(e=e.updateQueue,e!==null&&(t=e.callbacks,t!==null&&(n=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=n===null?t:n.concat(t))));break;case 26:if(o=Tu,wu(t,e,n),Du(e),a&512&&(Y||r===null||Cl(r,r.return)),a&4){if(a=r===null?null:r.memoizedState,n=e.memoizedState,r===null){if(n===null){if(e.stateNode===null){if(eu)e.stateNode=fp(e.type,e.memoizedProps,t.containerInfo,e);else{a:{t=e.type,n=e.memoizedProps,a=o.ownerDocument||o;b:switch(t){case`title`:r=a.getElementsByTagName(`title`)[0],(!r||r[Ot]||r[xt]||r.namespaceURI===`http://www.w3.org/2000/svg`||r.hasAttribute(`itemprop`))&&(r=a.createElement(t),a.head.insertBefore(r,a.querySelector(`head > title`))),np(r,t,n),r[xt]=e,R(r),t=r;break a;case`link`:if(o=Gm(`link`,`href`,a).get(t+(n.href||``))){for(s=0;s<o.length;s++)if(r=o[s],r.getAttribute(`href`)===(n.href==null||n.href===``?null:n.href)&&r.getAttribute(`rel`)===(n.rel==null?null:n.rel)&&r.getAttribute(`title`)===(n.title==null?null:n.title)&&r.getAttribute(`crossorigin`)===(n.crossOrigin==null?null:n.crossOrigin)){o.splice(s,1);break b}}r=a.createElement(t),np(r,t,n),a.head.appendChild(r);break;case`meta`:if(o=Gm(`meta`,`content`,a).get(t+(n.content||``))){for(s=0;s<o.length;s++)if(r=o[s],r.getAttribute(`content`)===(n.content==null?null:``+n.content)&&r.getAttribute(`name`)===(n.name==null?null:n.name)&&r.getAttribute(`property`)===(n.property==null?null:n.property)&&r.getAttribute(`http-equiv`)===(n.httpEquiv==null?null:n.httpEquiv)&&r.getAttribute(`charset`)===(n.charSet==null?null:n.charSet)){o.splice(s,1);break b}}r=a.createElement(t),np(r,t,n),a.head.appendChild(r);break;default:throw Error(i(468,t))}r[xt]=e,R(r),t=r}e.stateNode=t}}else eu||Km(o,e.type,e.stateNode)}else e.stateNode=Bm(o,n,e.memoizedProps)}else a===n?n===null&&e.stateNode!==null&&kl(e,e.memoizedProps,r.memoizedProps):(a===null?(t=r.stateNode,t===null||Y||t.parentNode.removeChild(t)):a.count--,n===null?eu||Km(o,e.type,e.stateNode):Bm(o,n,e.memoizedProps))}break;case 27:wu(t,e,n),Du(e),a&512&&(Y||r===null||Cl(r,r.return)),r!==null&&a&4&&kl(e,e.memoizedProps,r.memoizedProps);break;case 5:if(o=tu,tu=!1,wu(t,e,n),tu=o,Du(e),a&512&&(Y||r===null||Cl(r,r.return)),e.flags&32){t=e.stateNode;try{cn(t,``),z=!0}catch(t){ff(e,e.return,t)}}a&4&&e.stateNode!=null&&(t=e.memoizedProps,kl(e,t,r===null?t:r.memoizedProps)),a&1024&&(nu=!0);break;case 6:if(wu(t,e,n),Du(e),a&4){if(e.stateNode===null)throw Error(i(162));t=e.memoizedProps,n=e.stateNode;try{n.nodeValue=t,z=!0}catch(t){ff(e,e.return,t)}}break;case 3:if(z=!1,Wm=null,o=Tu,Tu=bm(t.containerInfo),wu(t,e,n),Tu=o,Du(e),a&4&&r!==null&&r.memoizedState.isDehydrated)try{Hh(t.containerInfo)}catch(t){ff(e,e.return,t)}nu&&(nu=!1,Ou(e)),z=!1;break;case 4:a=tu,tu=eu,r=Wt(),o=Tu,Tu=bm(e.stateNode.containerInfo),wu(t,e,n),Du(e),Tu=o,z&&ou&&(su=!0),z=r,tu=a;break;case 12:wu(t,e,n),Du(e);break;case 31:wu(t,e,n),Du(e),a&4&&(t=e.updateQueue,t!==null&&(e.updateQueue=null,Cu(e,t)));break;case 13:wu(t,e,n),Du(e),e.child.flags&8192&&e.memoizedState!==null!=(r!==null&&r.memoizedState!==null)&&(fd=Be()),a&4&&(t=e.updateQueue,t!==null&&(e.updateQueue=null,Cu(e,t)));break;case 22:o=e.memoizedState!==null,s=r!==null&&r.memoizedState!==null;var c=eu,l=Y,u=tu;eu=c||o,tu=u||o,Y=l||s,wu(t,e,n),Y=l,tu=u,eu=c,Du(e),a&8192&&(t=e.stateNode,t._visibility=o?t._visibility&-2:t._visibility|1,!o||r===null||s||eu||Y||(t=s||Y,n=eu,r=Y,eu=o||eu,Y=t,Mu(e,2),eu=n,Y=r),!o&&tu||fu(e,o)),a&4&&(t=e.updateQueue,t!==null&&(n=t.retryQueue,n!==null&&(t.retryQueue=null,Cu(e,n))));break;case 19:wu(t,e,n),Du(e),a&4&&(t=e.updateQueue,t!==null&&(e.updateQueue=null,Cu(e,t)));break;case 30:a&512&&(Y||r===null||Cl(r,r.return)),a=Wt(),o=ou,s=(n&335544064)===n,c=e.memoizedProps,ou=s&&hi(c.default,c.update)!==`none`,wu(t,e,n),Du(e),s&&r!==null&&z&&(e.flags|=4),ou=o,z=a;break;case 21:break;case 7:a&512&&(Y||r===null||Cl(r,r.return)),r&&r.stateNode!==null&&(r.stateNode._fragmentFiber=e);default:wu(t,e,n),Du(e)}}function Du(e){var t=e.flags;if(t&2){try{for(var n,r=e.return;r!==null;){if(Al(r)){n=r;break}r=r.return}r=null;for(var a=e.return;a!==null;){if(Dl(a)){var o=a.stateNode;r===null?r=[o]:r.push(o)}if(J(a))break;a=a.return}var s=r;if(n==null)throw Error(i(160));switch(n.tag){case 27:var c=n.stateNode;Nl(e,jl(e),c,s);break;case 5:var l=n.stateNode;n.flags&32&&(cn(l,``),n.flags&=-33),Nl(e,jl(e),l,s);break;case 3:case 4:var u=n.stateNode.containerInfo;Ml(e,jl(e),u,s);break;default:throw Error(i(161))}}catch(t){ff(e,e.return,t)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function Ou(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;Ou(t),t.tag===5&&t.flags&1024&&(t=t.stateNode,gh=!0,t.reset(),gh=!1),e=e.sibling}}function ku(e,t){if(t.subtreeFlags&9270)for(t=t.child;t!==null;)Au(t,e),t=t.sibling;else $l(t,!1)}function Au(e,t){var n=e.alternate;if(n===null)Gl(e,!1);else switch(e.tag){case 3:if(cu=au=!1,zl(),ku(t,e),!au&&!su){if(e=Rl,e!==null)for(var r=0;r<e.length;r+=3){n=e[r];var i=e[r+1];Ep(n,e[r+2]),n=n.ownerDocument.documentElement,n!==null&&n.animate({opacity:[0,0],pointerEvents:[`none`,`none`]},{duration:0,fill:`forwards`,pseudoElement:`::view-transition-group(`+i+`)`})}e=t.containerInfo,e=e.nodeType===9?e.documentElement:e.ownerDocument.documentElement,e!==null&&e.style.viewTransitionName===``&&(e.style.viewTransitionName=`none`,e.animate({opacity:[0,0],pointerEvents:[`none`,`none`]},{duration:0,fill:`forwards`,pseudoElement:`::view-transition-group(root)`}),e.animate({width:[0,0],height:[0,0]},{duration:0,fill:`forwards`,pseudoElement:`::view-transition`})),cu=!0}Rl=null;break;case 5:ku(t,e);break;case 4:r=au,au=!1,ku(t,e),au&&(su=!0),au=r;break;case 22:e.memoizedState===null&&(n.memoizedState===null?ku(t,e):Gl(e,!1));break;case 30:r=au,i=zl(),au=!1,ku(t,e),au&&(e.flags|=4);var a=e.memoizedProps,o=e.stateNode;t=pi(a,o),o=pi(n.memoizedProps,o);var s=hi(a.default,a.update);s===`none`?t=!1:(a=n.memoizedState,n.memoizedState=null,n=e.child,Bl=0,t=Ql(e,n,t,o,s,a,!0),Bl!==(a===null?0:a.length)&&(e.flags|=32)),e.flags&4&&t?(jd(e,e.memoizedProps.onUpdate),Rl=i):i!==null&&(i.push.apply(i,Rl),Rl=i),au=e.flags&32?!0:r;break;default:ku(t,e)}}function ju(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)du(e,t.alternate,t),t=t.sibling}function Mu(e,t){for(e=e.child;e!==null;){var n=e,r=t;switch(n.tag){case 0:case 11:case 14:case 15:yl(4,n,n.return),Mu(n,r);break;case 1:Cl(n,n.return);var i=n.stateNode;typeof i.componentWillUnmount==`function`&&xl(n,n.return,i),Mu(n,r);break;case 27:r&2&&gm(n.stateNode,n.type,n.memoizedProps);case 5:Cl(n,n.return),n.tag!==5&&n.tag!==27||El(n),Mu(n,r);break;case 6:El(n);break;case 26:Cl(n,n.return),i=n.stateNode,n.memoizedState!==null||i===null||Y||i.parentNode.removeChild(i),Mu(n,r);break;case 22:n.memoizedState===null&&Mu(n,r);break;case 30:Cl(n,n.return),Mu(n,r);break;case 7:Cl(n,n.return);default:Mu(n,r)}e=e.sibling}}function Nu(e,t,n){for(n=t.subtreeFlags&8772?n:n&-2,t=t.child;t!==null;){var r=t.alternate,i=e,a=t,o=a.flags,s=!!(n&1);switch(a.tag){case 0:case 11:case 15:Nu(i,a,n),vl(4,a);break;case 1:if(Nu(i,a,n),r=a,i=r.stateNode,typeof i.componentDidMount==`function`)try{i.componentDidMount()}catch(e){ff(r,r.return,e)}if(r=a,i=r.updateQueue,i!==null){var c=r.stateNode;try{var l=i.shared.hiddenCallbacks;if(l!==null)for(i.shared.hiddenCallbacks=null,i=0;i<l.length;i++)vo(l[i],c)}catch(e){ff(r,r.return,e)}}s&&o&64&&bl(a),Sl(a,a.return);break;case 27:n&2&&Pl(a);case 5:a.tag!==5&&a.tag!==27||Tl(a),Nu(i,a,n),s&&r===null&&o&4&&Ol(a),Sl(a,a.return);break;case 6:Tl(a);break;case 26:c=a.stateNode,a.memoizedState!==null||c===null||eu||Km(bm(c.ownerDocument),a.type,c),Nu(i,a,n),s&&r===null&&o&4&&Ol(a),Sl(a,a.return);break;case 12:Nu(i,a,n);break;case 31:Nu(i,a,n),s&&o&4&&bu(i,a);break;case 13:Nu(i,a,n),s&&o&4&&xu(i,a);break;case 22:a.memoizedState===null&&Nu(i,a,n),Sl(a,a.return);break;case 30:Nu(i,a,n),Sl(a,a.return);break;case 7:Sl(a,a.return);default:Nu(i,a,n)}t=t.sibling}}function Pu(e,t){var n=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==n&&(e!=null&&e.refCount++,n!=null&&Oa(n))}function Fu(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Oa(e))}function Iu(e,t,n,r){var i=(n&335544064)===n;if(t.subtreeFlags&(i?10262:10256))for(t=t.child;t!==null;)Lu(e,t,n,r),t=t.sibling;else i&&Zl(t)}function Lu(e,t,n,r){var i=(n&335544064)===n;i&&t.alternate===null&&t.return!==null&&t.return.alternate!==null&&Xl(t);var a=t.flags;switch(t.tag){case 0:case 11:case 15:Iu(e,t,n,r),a&2048&&vl(9,t);break;case 1:Iu(e,t,n,r);break;case 3:Iu(e,t,n,r),i&&cu&&(e=e.containerInfo,e=e.nodeType===9?e.body:e.nodeName===`HTML`?e.ownerDocument.body:e,e.style.viewTransitionName===`root`&&(e.style.viewTransitionName=``),e=e.ownerDocument.documentElement,e!==null&&e.style.viewTransitionName===`none`&&(e.style.viewTransitionName=``)),a&2048&&(a=null,t.alternate!==null&&(a=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==a&&(t.refCount++,a!=null&&Oa(a)));break;case 12:if(a&2048){Iu(e,t,n,r),a=t.stateNode;try{var o=t.memoizedProps,s=o.id,c=o.onPostCommit;typeof c==`function`&&c(s,t.alternate===null?`mount`:`update`,a.passiveEffectDuration,-0)}catch(e){ff(t,t.return,e)}}else Iu(e,t,n,r);break;case 31:Iu(e,t,n,r);break;case 13:Iu(e,t,n,r);break;case 23:break;case 22:o=t.stateNode,s=t.alternate,t.memoizedState===null?(i&&s!==null&&s.memoizedState!==null&&Xl(t),o._visibility&2?Iu(e,t,n,r):(o._visibility|=2,Ru(e,t,n,r,!!(t.subtreeFlags&10256)||!1))):(i&&s!==null&&s.memoizedState===null&&Xl(s),o._visibility&2?Iu(e,t,n,r):zu(e,t)),a&2048&&Pu(s,t);break;case 24:Iu(e,t,n,r),a&2048&&Fu(t.alternate,t);break;case 30:i&&(a=t.alternate,a!==null&&(Ul(a.child,!0),Ul(t.child,!0))),Iu(e,t,n,r);break;default:Iu(e,t,n,r)}}function Ru(e,t,n,r,i){for(i&&=!!(t.subtreeFlags&10256)||!1,t=t.child;t!==null;){var a=e,o=t,s=n,c=r,l=o.flags;switch(o.tag){case 0:case 11:case 15:Ru(a,o,s,c,i),vl(8,o);break;case 23:break;case 22:var u=o.stateNode;o.memoizedState===null?(u._visibility|=2,Ru(a,o,s,c,i)):u._visibility&2?Ru(a,o,s,c,i):zu(a,o),i&&l&2048&&Pu(o.alternate,o);break;case 24:Ru(a,o,s,c,i),i&&l&2048&&Fu(o.alternate,o);break;default:Ru(a,o,s,c,i)}t=t.sibling}}function zu(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var n=e,r=t,i=r.flags;switch(r.tag){case 22:zu(n,r),i&2048&&Pu(r.alternate,r);break;case 24:zu(n,r),i&2048&&Fu(r.alternate,r);break;default:zu(n,r)}t=t.sibling}}var Bu=8192;function Vu(e,t,n){if(e.subtreeFlags&Bu)for(e=e.child;e!==null;)Hu(e,t,n),e=e.sibling}function Hu(e,t,n){switch(e.tag){case 26:Vu(e,t,n),e.flags&Bu&&(e.memoizedState===null?(e=e.stateNode,(t&335544128)===t&&Zm(n,e)):Qm(n,Tu,e.memoizedState,e.memoizedProps));break;case 5:Vu(e,t,n),e.flags&Bu&&(e=e.stateNode,(t&335544128)===t&&Zm(n,e));break;case 3:case 4:var r=Tu;Tu=bm(e.stateNode.containerInfo),Vu(e,t,n),Tu=r;break;case 22:e.memoizedState===null&&(r=e.alternate,r!==null&&r.memoizedState!==null?(r=Bu,Bu=16777216,Vu(e,t,n),Bu=r):Vu(e,t,n));break;case 30:if((e.flags&Bu)!==0&&(r=e.memoizedProps.name,r!=null&&r!==`auto`)){var i=e.stateNode;i.paired=null,Il===null&&(Il=new Map),Il.set(r,i)}Vu(e,t,n);break;default:Vu(e,t,n)}}function Uu(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function Wu(e){var t=e.deletions;if(e.flags&16){if(t!==null)for(var n=0;n<t.length;n++){var r=t[n];iu=r,qu(r,e)}Uu(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Gu(e),e=e.sibling}function Gu(e){switch(e.tag){case 0:case 11:case 15:Wu(e),e.flags&2048&&yl(9,e,e.return);break;case 3:Wu(e);break;case 12:Wu(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,Ku(e)):Wu(e);break;default:Wu(e)}}function Ku(e){var t=e.deletions;if(e.flags&16){if(t!==null)for(var n=0;n<t.length;n++){var r=t[n];iu=r,qu(r,e)}Uu(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:yl(8,t,t.return),Ku(t);break;case 22:n=t.stateNode,n._visibility&2&&(n._visibility&=-3,Ku(t));break;default:Ku(t)}e=e.sibling}}function qu(e,t){for(;iu!==null;){var n=iu;switch(n.tag){case 0:case 11:case 15:yl(8,n,t);break;case 23:case 22:if(n.memoizedState!==null&&n.memoizedState.cachePool!==null){var r=n.memoizedState.cachePool.pool;r!=null&&r.refCount++}break;case 24:Oa(n.memoizedState.cache)}if(r=n.child,r!==null)r.return=n,iu=r;else a:for(n=e;iu!==null;){r=iu;var i=r.sibling,a=r.return;if(hu(r),r===n){iu=null;break a}if(i!==null){i.return=a,iu=i;break a}iu=a}}}var Ju={getCacheForType:function(e){var t=ba(Ea),n=t.data.get(e);return n===void 0&&(n=e(),t.data.set(e,n)),n},cacheSignal:function(){return ba(Ea).controller.signal}},Yu=typeof WeakMap==`function`?WeakMap:Map,X=0,Xu=null,Z=null,Q=0,Zu=0,Qu=null,$u=!1,ed=!1,td=!1,nd=0,rd=0,id=0,ad=0,od=0,sd=0,cd=0,ld=null,ud=null,dd=!1,fd=0,pd=0,md=1/0,hd=null,gd=null,_d=0,vd=null,yd=null,bd=0,xd=0,Sd=null,Cd=null,wd=null,Td=null,Ed=null,Dd=0,Od=null;function kd(){return X&2&&Q!==0?Q&-Q:P.T===null?vt():Nf()}function Ad(){if(sd===0){if(!(Q&536870912)||W){var e=nt;nt<<=1,!(nt&3932160)&&(nt=262144),sd=e}else sd=536870912}return e=To.current,e!==null&&(e.flags|=32),sd}function jd(e,t){if(t!=null){var n=e.stateNode,r=n.ref;r===null&&(r=n.ref=Pp(pi(e.memoizedProps,n))),Td===null&&(Td=[]),Td.push(t.bind(null,r))}}function Md(e,t,n){(e===Xu&&(Zu===2||Zu===9)||e.cancelPendingCommit!==null)&&(zd(e,0),Id(e,Q,sd,!1)),dt(e,n),(!(X&2)||e!==Xu)&&(e===Xu&&(!(X&2)&&(ad|=n),rd===4&&Id(e,Q,sd,!1)),Tf(e))}function Nd(e,t,n){if(X&6)throw Error(i(327));var r=!n&&!(t&127)&&(t&e.expiredLanes)===0||ot(e,t),a=r?qd(e,t):Gd(e,t,!0),o=r;do{if(a===0){ed&&!r&&Id(e,t,0,!1);break}if(n=e.current.alternate,o&&!Fd(n)){a=Gd(e,t,!1),o=!1;continue}if(a===2){if(o=t,e.errorRecoveryDisabledLanes&o)var s=0;else s=e.pendingLanes&-536870913,s=s===0?s&536870912?536870912:0:s;if(s!==0){t=s;a:{var c=e;a=ld;var l=c.current.memoizedState.isDehydrated;if(l&&(zd(c,s).flags|=256),s=Gd(c,s,!1),s!==2&&s!==6){if(td&&!l){c.errorRecoveryDisabledLanes|=o,ad|=o,a=4;break a}o=ud,ud=a,o!==null&&(ud===null?ud=o:ud.push.apply(ud,o))}a=s}if(o=!1,a!==2)continue}}if(a===1){zd(e,0),Id(e,t,0,!0);break}a:{switch(r=e,o=a,o){case 0:case 1:throw Error(i(345));case 4:if((t&4194048)!==t&&(t&62914560)!==t)break;case 6:Id(r,t,sd,!$u);break a;case 2:ud=null;break;case 3:case 5:break;default:throw Error(i(329))}if((t&62914560)===t&&(a=fd+300-Be(),10<a)){if(Id(r,t,sd,!$u),at(r,0,!0)!==0)break a;bd=t,r.timeoutHandle=gp(Pd.bind(null,r,n,ud,hd,dd,t,sd,ad,cd,$u,o,`Throttled`,-0,0),a);break a}Pd(r,n,ud,hd,dd,t,sd,ad,cd,$u,o,null,-0,0)}break}while(1);Tf(e)}function Pd(e,t,n,r,i,a,o,s,c,l,u,d,f,p){e.timeoutHandle=-1;var m=t.subtreeFlags,h=(a&335544064)===a;if(d=null,(h||m&8192||(m&16785408)==16785408)&&(d={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:gn},Il=null,Hu(t,a,d),h&&(m=d,h=e.containerInfo,h=(h.nodeType===9?h:h.ownerDocument).__reactViewTransition,h!=null&&(m.count++,m.waitingForViewTransition=!0,m=nh.bind(m),h.finished.then(m,m))),m=(a&62914560)===a?fd-Be():(a&4194048)===a?pd-Be():0,m=eh(d,m),m!==null)){bd=a,e.cancelPendingCommit=m(ef.bind(null,e,t,a,n,r,i,o,s,c,l,u,d,null,f,p)),Id(e,a,o,!l);return}ef(e,t,a,n,r,i,o,s,c,l,u,d)}function Fd(e){for(var t=e;;){var n=t.tag;if((n===0||n===11||n===15)&&t.flags&16384&&(n=t.updateQueue,n!==null&&(n=n.stores,n!==null)))for(var r=0;r<n.length;r++){var i=n[r],a=i.getSnapshot;i=i.value;try{if(!Lr(a(),i))return!1}catch{return!1}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function Id(e,t,n,r){t=st(e,t),t&=~od,t&=~ad,e.suspendedLanes|=t,e.pingedLanes&=~t,r&&(e.warmLanes|=t),r=e.expirationTimes;for(var i=t;0<i;){var a=31-Ze(i),o=1<<a;r[a]=-1,i&=~o}n!==0&&pt(e,n,t)}function Ld(){return X&6?!0:(Ef(0,!1),!1)}function Rd(){if(Z!==null){if(Zu===0)var e=Z.return;else e=Z,fa=da=null,es(e),eo=null,to=0,e=Z;for(;e!==null;)_l(e.alternate,e),e=e.return;Z=null}}function zd(e,t){var n=e.timeoutHandle;return n!==-1&&(e.timeoutHandle=-1,_p(n)),n=e.cancelPendingCommit,n!==null&&(e.cancelPendingCommit=null,n()),bd=0,Rd(),Xu=e,Z=n=Ai(e.current,null),Q=t,Zu=0,Qu=null,$u=!1,ed=ot(e,t),td=!1,cd=sd=od=ad=id=rd=0,ud=ld=null,dd=!1,nd=st(e,t),bi(),n}function Bd(e,t){q=null,P.H=uc,t===Wa||t===Ka?(t=Qa(),Zu=3):t===Ga?(t=Qa(),Zu=4):Zu=t===Oc?8:typeof t==`object`&&t&&typeof t.then==`function`?6:1,Qu=t,Z===null&&(rd=1,Sc(e,Ri(t,e.current)))}function Vd(){var e=To.current;return e===null?!0:(Q&4194048)===Q?Eo===null:(Q&62914560)===Q||Q&536870912?e===Eo:!1}function Hd(){var e=P.H;return P.H=uc,e===null?uc:e}function Ud(){var e=P.A;return P.A=Ju,e}function Wd(){rd=4,$u||(Q&4194048)!==Q&&To.current!==null||(ed=!0),!(id&134217727)&&!(ad&134217727)||Xu===null||Id(Xu,Q,sd,!1)}function Gd(e,t,n){var r=X;X|=2;var i=Hd(),a=Ud();(Xu!==e||Q!==t)&&(hd=null,zd(e,t)),t=!1;var o=rd;a:do try{if(Zu!==0&&Z!==null){var s=Z,c=Qu;switch(Zu){case 8:Rd(),o=6;break a;case 3:case 2:case 9:case 6:To.current===null&&(t=!0);var l=Zu;if(Zu=0,Qu=null,Zd(e,s,c,l),n&&ed){o=0;break a}break;default:l=Zu,Zu=0,Qu=null,Zd(e,s,c,l)}}Kd(),o=rd;break}catch(t){Bd(e,t)}while(1);return t&&e.shellSuspendCounter++,fa=da=null,X=r,P.H=i,P.A=a,Z===null&&(Xu=null,Q=0,bi()),o}function Kd(){for(;Z!==null;)Yd(Z)}function qd(e,t){var n=X;X|=2;var r=Hd(),a=Ud();Xu!==e||Q!==t?(hd=null,md=Be()+500,zd(e,t)):ed=ot(e,t);a:do try{if(Zu!==0&&Z!==null){t=Z;var o=Qu;b:switch(Zu){case 1:Zu=0,Qu=null,Zd(e,t,o,1);break;case 2:case 9:if(Ja(o)){Zu=0,Qu=null,Xd(t);break}t=function(){Zu!==2&&Zu!==9||Xu!==e||(Zu=7),Tf(e)},o.then(t,t);break a;case 3:Zu=7;break a;case 4:Zu=5;break a;case 7:Ja(o)?(Zu=0,Qu=null,Xd(t)):(Zu=0,Qu=null,Zd(e,t,o,7));break;case 5:var s=null;switch(Z.tag){case 26:s=Z.memoizedState;case 5:case 27:var c=Z;if(s?Ym(s):c.stateNode.complete){Zu=0,Qu=null;var l=c.sibling;if(l!==null)Z=l;else{var u=c.return;u===null?Z=null:(Z=u,Qd(u))}break b}}Zu=0,Qu=null,Zd(e,t,o,5);break;case 6:Zu=0,Qu=null,Zd(e,t,o,6);break;case 8:Rd(),rd=6;break a;default:throw Error(i(462))}}Jd();break}catch(t){Bd(e,t)}while(1);return fa=da=null,P.H=r,P.A=a,X=n,Z===null?(Xu=null,Q=0,bi(),rd):0}function Jd(){for(;Z!==null&&!Re();)Yd(Z)}function Yd(e){var t=cl(e.alternate,e,nd);e.memoizedProps=e.pendingProps,t===null?Qd(e):Z=t}function Xd(e){var t=e,n=t.alternate;switch(t.tag){case 15:case 0:t=Hc(n,t,t.pendingProps,t.type,void 0,Q);break;case 11:t=Hc(n,t,t.pendingProps,t.type.render,t.ref,Q);break;case 5:es(t);var r=t;r===$i&&(W?(oa(r),r.tag===5&&r.stateNode!=null&&(ea=r.stateNode)):(oa(r),W=!0));default:_l(n,t),t=Z=ji(t,nd),t=cl(n,t,nd)}e.memoizedProps=e.pendingProps,t===null?Qd(e):Z=t}function Zd(e,t,n,r){fa=da=null,es(t),eo=null,to=0;var i=t.return;try{if(Dc(e,i,t,n,Q)){rd=1,Sc(e,Ri(n,e.current)),Z=null;return}}catch(t){if(i!==null)throw Z=i,t;rd=1,Sc(e,Ri(n,e.current)),Z=null;return}t.flags&32768?(W||r===1?e=!0:ed||Q&536870912?e=!1:($u=e=!0,(r===2||r===9||r===3||r===6)&&(r=To.current,r!==null&&r.tag===13&&(r.flags|=16384))),$d(t,e)):Qd(t)}function Qd(e){var t=e;do{if(t.flags&32768){$d(t,$u);return}e=t.return;var n=hl(t.alternate,t,nd);if(n!==null){Z=n;return}if(t=t.sibling,t!==null){Z=t;return}Z=t=e}while(t!==null);rd===0&&(rd=5)}function $d(e,t){do{var n=gl(e.alternate,e);if(n!==null){n.flags&=32767,Z=n;return}if(n=e.return,n!==null&&(n.flags|=32768,n.subtreeFlags=0,n.deletions=null),!t&&(e=e.sibling,e!==null)){Z=e;return}Z=e=n}while(e!==null);rd=6,Z=null}function ef(e,t,n,r,a,o,s,c,l,u,d,f){e.cancelPendingCommit=null;do lf();while(_d!==0);if(X&6)throw Error(i(327));if(t!==null){if(t===e.current)throw Error(i(177));e===Xu&&(Z=Xu=null,Q=0),yd=t,vd=e,bd=n,Sd=a,Cd=r,tf(e,t,n,s,c,l,f)}}function tf(e,t,n,r,i,a,o){var s=t.lanes|t.childLanes;if(xd=s,s|=yi,ft(e,n,s,r,i,a),Td=null,(n&335544064)===n?(Ed=ja(e),r=10262):(Ed=null,r=10256),(t.subtreeFlags&r)!==0||(t.flags&r)!==0?(e.callbackNode=null,e.callbackPriority=0,vf(We,function(){return uf(),null})):(e.callbackNode=null,e.callbackPriority=0),Fl=!1,r=!!(t.flags&13878),t.subtreeFlags&13878||r){r=P.T,P.T=null,i=F.p,F.p=2,a=X,X|=4;try{lu(e,t,n)}finally{X=a,F.p=i,P.T=r}}_d=1,Fl?wd=Mp(o,e.containerInfo,Ed,af,of,rf,sf,uf,nf,null,null):(af(),of(),sf())}function nf(e){if(_d!==0){var t=vd.onRecoverableError;t(e,{componentStack:null})}}function rf(){_d===3&&(_d=0,Au(yd,vd),_d=4)}function af(){if(_d===1){_d=0;var e=vd,t=yd,n=bd,r=!!(t.flags&13878);if(t.subtreeFlags&13878||r){r=P.T,P.T=null;var i=F.p;F.p=2;var a=X;X|=4;try{ou=su=!1,Eu(t,e,n),n=cp;var o=Ur(e.containerInfo),s=n.focusedElem,c=n.selectionRange;if(o!==s&&s&&s.ownerDocument&&Hr(s.ownerDocument.documentElement,s)){if(c!==null&&Wr(s)){var l=c.start,u=c.end;if(u===void 0&&(u=l),`selectionStart`in s)s.selectionStart=l,s.selectionEnd=Math.min(u,s.value.length);else{var d=s.ownerDocument||document,f=d&&d.defaultView||window;if(f.getSelection){var p=f.getSelection(),m=s.textContent.length,h=Math.min(c.start,m),g=c.end===void 0?h:Math.min(c.end,m);!p.extend&&h>g&&(o=g,g=h,h=o);var _=Vr(s,h),v=Vr(s,g);if(_&&v&&(p.rangeCount!==1||p.anchorNode!==_.node||p.anchorOffset!==_.offset||p.focusNode!==v.node||p.focusOffset!==v.offset)){var y=d.createRange();y.setStart(_.node,_.offset),p.removeAllRanges(),h>g?(p.addRange(y),p.extend(v.node,v.offset)):(y.setEnd(v.node,v.offset),p.addRange(y))}}}}for(d=[],p=s;p=p.parentNode;)p.nodeType===1&&d.push({element:p,left:p.scrollLeft,top:p.scrollTop});for(typeof s.focus==`function`&&s.focus(),s=0;s<d.length;s++){var b=d[s];b.element.scrollLeft=b.left,b.element.scrollTop=b.top}}gh=!!sp,cp=sp=null}finally{X=a,F.p=i,P.T=r}}e.current=t,_d=2}}function of(){if(_d===2){_d=0;var e=vd,t=yd,n=!!(t.flags&8772);if(t.subtreeFlags&8772||n){n=P.T,P.T=null;var r=F.p;F.p=2;var i=X;X|=4;try{du(e,t.alternate,t)}finally{X=i,F.p=r,P.T=n}}_d=3}}function sf(){if(_d===4||_d===3){_d=0;var e=wd;wd=null,ze();var t=vd,n=yd,r=bd,i=Cd,a=(r&335544064)===r?10262:10256;if((n.subtreeFlags&a)!==0||(n.flags&a)!==0?_d=5:(_d=0,yd=vd=null,cf(t,t.pendingLanes)),a=t.pendingLanes,a===0&&(gd=null),_t(r),n=n.stateNode,L&&typeof L.onCommitFiberRoot==`function`)try{L.onCommitFiberRoot(Ye,n,void 0,(n.current.flags&128)==128)}catch{}if(i!==null){n=P.T,a=F.p,F.p=2,P.T=null;try{for(var o=t.onRecoverableError,s=0;s<i.length;s++){var c=i[s];o(c.value,{componentStack:c.stack})}}finally{P.T=n,F.p=a}}if(i=Td,o=Ed,Ed=null,i!==null&&(Td=null,o===null&&(o=[]),e!==null))for(c=0;c<i.length;c++)n=(0,i[c])(o),n!==void 0&&e.finished.finally(n);bd&3&&lf(),Tf(t),a=t.pendingLanes,r&261930&&a&42?t===Od?Dd++:(Dd=0,Od=t):(Dd=0,Od=null),Ef(0,!1)}}function cf(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,Oa(t)))}function lf(){return wd!==null&&(wd.skipTransition(),wd=null),af(),of(),sf(),uf()}function uf(){if(_d!==5)return!1;var e=vd,t=xd;xd=0;var n=_t(bd),r=P.T,a=F.p;try{F.p=32>n?32:n,P.T=null,n=Sd,Sd=null;var o=vd,s=bd;if(_d=0,yd=vd=null,bd=0,X&6)throw Error(i(331));var c=X;if(X|=4,Gu(o.current),Lu(o,o.current,s,n),X=c,Ef(0,!1),L&&typeof L.onPostCommitFiberRoot==`function`)try{L.onPostCommitFiberRoot(Ye,o)}catch{}return!0}finally{F.p=a,P.T=r,cf(e,t)}}function df(e,t,n){t=Ri(n,t),t=wc(e.stateNode,t,2),e=fo(e,t,2),e!==null&&(dt(e,2),Tf(e))}function ff(e,t,n){if(e.tag===3)df(e,e,n);else for(;t!==null;){if(t.tag===3){df(t,e,n);break}if(t.tag===1){var r=t.stateNode;if(typeof t.type.getDerivedStateFromError==`function`||typeof r.componentDidCatch==`function`&&(gd===null||!gd.has(r))){e=Ri(n,e),n=Tc(2),r=fo(t,n,2),r!==null&&(Ec(n,r,t,e),dt(r,2),Tf(r));break}}t=t.return}}function pf(e,t,n){var r=e.pingCache;if(r===null){r=e.pingCache=new Yu;var i=new Set;r.set(t,i)}else i=r.get(t),i===void 0&&(i=new Set,r.set(t,i));i.has(n)||(td=!0,i.add(n),e=mf.bind(null,e,t,n),t.then(e,e))}function mf(e,t,n){var r=e.pingCache;r!==null&&r.delete(t),e.pingedLanes|=e.suspendedLanes&n,e.warmLanes&=~n,Xu===e&&(Q&n)===n&&(rd===4||rd===3&&(Q&62914560)===Q&&300>Be()-fd?X&2?od|=n:zd(e,0):od|=n,cd===Q&&(cd=0)),Tf(e)}function hf(e,t){t===0&&(t=lt()),e=Ci(e,t),e!==null&&(dt(e,t),Tf(e))}function gf(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),hf(e,n)}function _f(e,t){var n=0;switch(e.tag){case 31:case 13:var r=e.stateNode,a=e.memoizedState;a!==null&&(n=a.retryLane);break;case 19:r=e.stateNode;break;case 22:r=e.stateNode._retryCache;break;default:throw Error(i(314))}r!==null&&r.delete(t),hf(e,n)}function vf(e,t){return Ie(e,t)}var yf=null,bf=null,xf=!1,Sf=!1,Cf=!1,wf=0;function Tf(e){e!==bf&&e.next===null&&(bf===null?yf=bf=e:bf=bf.next=e),Sf=!0,xf||(xf=!0,Mf())}function Ef(e,t){if(!Cf&&Sf){Cf=!0;do for(var n=!1,r=yf;r!==null;){if(!t){if(e!==0){var i=r.pendingLanes;if(i===0)var a=0;else{var o=r.suspendedLanes,s=r.pingedLanes;a=(1<<31-Ze(42|e)+1)-1,a&=i&~(o&~s),a=a&201326741?a&201326741|1:a?a|2:0}a!==0&&(n=!0,jf(r,a))}else a=Q,a=at(r,r===Xu?a:0,r.cancelPendingCommit!==null||r.timeoutHandle!==-1),!(a&3)||ot(r,a)||(n=!0,jf(r,a))}r=r.next}while(n);Cf=!1}}function Df(){Of()}function Of(){Sf=xf=!1;var e=0;wf!==0&&hp()&&(e=wf);for(var t=Be(),n=null,r=yf;r!==null;){var i=r.next,a=kf(r,t);a===0?(r.next=null,n===null?yf=i:n.next=i,i===null&&(bf=n)):(n=r,(e!==0||a&3)&&(Sf=!0)),r=i}_d!==0&&_d!==5||Ef(e,!1),wf!==0&&(wf=0)}function kf(e,t){for(var n=e.suspendedLanes,r=e.pingedLanes,i=e.expirationTimes,a=e.pendingLanes&-62914561;0<a;){var o=31-Ze(a),s=1<<o,c=i[o];c===-1?((s&n)===0||(s&r)!==0)&&(i[o]=ct(s,t)):c<=t&&(e.expiredLanes|=s),a&=~s}if(t=Xu,n=Q,n=at(e,e===t?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),r=e.callbackNode,n===0||e===t&&(Zu===2||Zu===9)||e.cancelPendingCommit!==null)return r!==null&&r!==null&&Le(r),e.callbackNode=null,e.callbackPriority=0;if(!(n&3)||ot(e,n)){if(t=n&-n,t===e.callbackPriority)return t;switch(r!==null&&Le(r),_t(n)){case 2:case 8:n=Ue;break;case 32:n=We;break;case 268435456:n=Ke;break;default:n=We}return r=Af.bind(null,e),n=Ie(n,r),e.callbackPriority=t,e.callbackNode=n,t}return r!==null&&r!==null&&Le(r),e.callbackPriority=2,e.callbackNode=null,2}function Af(e,t){if(_d!==0&&_d!==5)return e.callbackNode=null,e.callbackPriority=0,null;var n=e.callbackNode;if(lf()&&e.callbackNode!==n)return null;var r=Q;return r=at(e,e===Xu?r:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),r===0?null:(Nd(e,r,t),kf(e,Be()),e.callbackNode!=null&&e.callbackNode===n?Af.bind(null,e):null)}function jf(e,t){if(lf())return null;Nd(e,t,!0)}function Mf(){bp(function(){X&6?Ie(He,Df):Of()})}function Nf(){if(wf===0){var e=Pa;e===0&&(e=tt,tt<<=1,!(tt&261888)&&(tt=256)),wf=e}return wf}function Pf(e){return e==null||typeof e==`symbol`||typeof e==`boolean`?null:typeof e==`function`?e:hn(e)}function Ff(e,t,n,r,i){if(t===`submit`&&n&&n.stateNode===i){var a=Pf((i[St]||null).action),o=r.submitter;o&&(t=(t=o[St]||null)?Pf(t.formAction):o.getAttribute(`formAction`),t!==null&&(a=t,o=null));var s=new Rn(`action`,`action`,null,r,i);e.push({event:s,listeners:[{instance:null,listener:function(){if(r.defaultPrevented){if(wf!==0){var e=new FormData(i,o);Xs(n,{pending:!0,data:e,method:i.method,action:a},null,e)}}else typeof a==`function`&&(s.preventDefault(),e=new FormData(i,o),Xs(n,{pending:!0,data:e,method:i.method,action:a},a,e))},currentTarget:i}]})}}for(var If=0;If<ui.length;If++){var Lf=ui[If];di(Lf.toLowerCase(),`on`+(Lf[0].toUpperCase()+Lf.slice(1)))}di(ni,`onAnimationEnd`),di(ri,`onAnimationIteration`),di(ii,`onAnimationStart`),di(`dblclick`,`onDoubleClick`),di(`focusin`,`onFocus`),di(`focusout`,`onBlur`),di(ai,`onTransitionRun`),di(oi,`onTransitionStart`),di(si,`onTransitionCancel`),di(ci,`onTransitionEnd`),zt(`onMouseEnter`,[`mouseout`,`mouseover`]),zt(`onMouseLeave`,[`mouseout`,`mouseover`]),zt(`onPointerEnter`,[`pointerout`,`pointerover`]),zt(`onPointerLeave`,[`pointerout`,`pointerover`]),Rt(`onChange`,`change click focusin focusout input keydown keyup selectionchange`.split(` `)),Rt(`onSelect`,`focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange`.split(` `)),Rt(`onBeforeInput`,[`compositionend`,`keypress`,`textInput`,`paste`]),Rt(`onCompositionEnd`,`compositionend focusout keydown keypress keyup mousedown`.split(` `)),Rt(`onCompositionStart`,`compositionstart focusout keydown keypress keyup mousedown`.split(` `)),Rt(`onCompositionUpdate`,`compositionupdate focusout keydown keypress keyup mousedown`.split(` `));var Rf=`abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting`.split(` `),zf=new Set(`beforetoggle cancel close invalid load scroll scrollend toggle`.split(` `).concat(Rf));function Bf(e,t){t=!!(t&4);for(var n=0;n<e.length;n++){var r=e[n],i=r.event;r=r.listeners;a:{var a=void 0;if(t)for(var o=r.length-1;0<=o;o--){var s=r[o],c=s.instance,l=s.currentTarget;if(s=s.listener,c!==a&&i.isPropagationStopped())break a;a=s,i.currentTarget=l;try{a(i)}catch(e){gi(e)}i.currentTarget=null,a=c}else for(o=0;o<r.length;o++){if(s=r[o],c=s.instance,l=s.currentTarget,s=s.listener,c!==a&&i.isPropagationStopped())break a;a=s,i.currentTarget=l;try{a(i)}catch(e){gi(e)}i.currentTarget=null,a=c}}}}function $(e,t){var n=t[wt];n===void 0&&(n=t[wt]=new Set);var r=e+`__bubble`;n.has(r)||(Wf(t,e,2,!1),n.add(r))}function Vf(e,t,n){var r=0;t&&(r|=4),Wf(n,e,r,t)}var Hf=`_reactListening`+Math.random().toString(36).slice(2);function Uf(e){if(!e[Hf]){e[Hf]=!0,It.forEach(function(t){t!==`selectionchange`&&(zf.has(t)||Vf(t,!1,e),Vf(t,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[Hf]||(t[Hf]=!0,Vf(`selectionchange`,!1,t))}}function Wf(e,t,n,r){switch(Ch(t)){case 2:var i=_h;break;case 8:i=vh;break;default:i=yh}n=i.bind(null,t,n,e),i=void 0,!Tn||t!==`touchstart`&&t!==`touchmove`&&t!==`wheel`||(i=!0),r?i===void 0?e.addEventListener(t,n,!0):e.addEventListener(t,n,{capture:!0,passive:i}):i===void 0?e.addEventListener(t,n,!1):e.addEventListener(t,n,{passive:i})}function Gf(e,t,n,r,i){var a=r;if(!(t&1)&&!(t&2)&&r!==null)a:for(;;){if(r===null)return;var s=r.tag;if(s===3||s===4){var c=r.stateNode.containerInfo;if(c===i)break;if(s===4)for(s=r.return;s!==null;){var l=s.tag;if((l===3||l===4)&&s.stateNode.containerInfo===i)return;s=s.return}for(;c!==null;){if(s=jt(c),s===null)return;if(l=s.tag,l===5||l===6||l===26||l===27){r=a=s;continue a}c=c.parentNode}}r=r.return}B(function(){var r=a,i=vn(n),s=[];a:{var c=li.get(e);if(c!==void 0){var l=Rn,u=e;switch(e){case`keypress`:if(jn(n)===0)break a;case`keydown`:case`keyup`:l=tr;break;case`focusin`:u=`focus`,l=Kn;break;case`focusout`:u=`blur`,l=Kn;break;case`beforeblur`:case`afterblur`:l=Kn;break;case`click`:if(n.button===2)break a;case`auxclick`:case`dblclick`:case`mousedown`:case`mousemove`:case`mouseup`:case`mouseout`:case`mouseover`:case`contextmenu`:l=V;break;case`drag`:case`dragend`:case`dragenter`:case`dragexit`:case`dragleave`:case`dragover`:case`dragstart`:case`drop`:l=Gn;break;case`touchcancel`:case`touchend`:case`touchmove`:case`touchstart`:l=ir;break;case ni:case ri:case ii:l=qn;break;case ci:l=ar;break;case`scroll`:case`scrollend`:l=Bn;break;case`wheel`:l=H;break;case`copy`:case`cut`:case`paste`:l=Jn;break;case`gotpointercapture`:case`lostpointercapture`:case`pointercancel`:case`pointerdown`:case`pointermove`:case`pointerout`:case`pointerover`:case`pointerup`:l=nr;break;case`submit`:l=rr;break;case`toggle`:case`beforetoggle`:l=U}var d=!!(t&4),f=!d&&(e===`scroll`||e===`scrollend`),p=d?c===null?null:c+`Capture`:c;d=[];for(var m=r,h;m!==null;){var g=m;if(h=g.stateNode,g=g.tag,g!==5&&g!==26&&g!==27||h===null||p===null||(g=Cn(m,p),g!=null&&d.push(Kf(m,g,h))),f)break;m=m.return}0<d.length&&(c=new l(c,u,null,n,i),s.push({event:c,listeners:d}))}}if(!(t&7)){a:{if(l=e===`mouseover`||e===`pointerover`,c=e===`mouseout`||e===`pointerout`,l&&n!==_n&&(u=n.relatedTarget||n.fromElement)&&(jt(u)||u[Ct]))break a;(c||l)&&(u=i.window===i?i:(l=i.ownerDocument)?l.defaultView||l.parentWindow:window,c?(l=n.relatedTarget||n.toElement,c=r,l=l?jt(l):null,l!==null&&(f=o(l),d=l.tag,l!==f||d!==5&&d!==27&&d!==6)&&(l=null)):(c=null,l=r),c!==l&&(d=V,g=`onMouseLeave`,p=`onMouseEnter`,m=`mouse`,(e===`pointerout`||e===`pointerover`)&&(d=nr,g=`onPointerLeave`,p=`onPointerEnter`,m=`pointer`),f=c==null?u:Nt(c),h=l==null?u:Nt(l),u=new d(g,m+`leave`,c,n,i),u.target=f,u.relatedTarget=h,g=null,jt(i)===r&&(d=new d(p,m+`enter`,l,n,i),d.target=h,d.relatedTarget=f,g=d),f=g,d=c&&l?w(c,l,Jf):null,c!==null&&Yf(s,u,c,d,!1),l!==null&&f!==null&&Yf(s,f,l,d,!0)))}a:{if(c=r?Nt(r):window,l=c.nodeName&&c.nodeName.toLowerCase(),l===`select`||l===`input`&&c.type===`file`)var _=Tr;else if(yr(c)){if(Er)_=Fr;else{_=Nr;var v=Mr}}else l=c.nodeName,!l||l.toLowerCase()!==`input`||c.type!==`checkbox`&&c.type!==`radio`?r&&fn(r.elementType)&&(_=Tr):_=Pr;if(_&&=_(e,r)){br(s,_,n,i);break a}v&&v(e,c,r)}switch(v=r?Nt(r):window,e){case`focusin`:(yr(v)||v.contentEditable===`true`)&&(Kr=v,qr=r,Jr=null);break;case`focusout`:Jr=qr=Kr=null;break;case`mousedown`:Yr=!0;break;case`contextmenu`:case`mouseup`:case`dragend`:Yr=!1,Xr(s,n,i);break;case`selectionchange`:if(Gr)break;case`keydown`:case`keyup`:Xr(s,n,i)}var y;if(sr)b:{switch(e){case`compositionstart`:var b=`onCompositionStart`;break b;case`compositionend`:b=`onCompositionEnd`;break b;case`compositionupdate`:b=`onCompositionUpdate`;break b}b=void 0}else hr?pr(e,n)&&(b=`onCompositionEnd`):e===`keydown`&&n.keyCode===229&&(b=`onCompositionStart`);b&&(ur&&n.locale!==`ko`&&(hr||b!==`onCompositionStart`?b===`onCompositionEnd`&&hr&&(y=An()):(Dn=i,On=`value`in Dn?Dn.value:Dn.textContent,hr=!0)),v=qf(r,b),0<v.length&&(b=new Yn(b,e,null,n,i),s.push({event:b,listeners:v}),y?b.data=y:(y=mr(n),y!==null&&(b.data=y)))),(y=lr?gr(e,n):_r(e,n))&&(b=qf(r,`onBeforeInput`),0<b.length&&(v=new Yn(`onBeforeInput`,`beforeinput`,null,n,i),s.push({event:v,listeners:b}),v.data=y)),Ff(s,e,r,n,i)}Bf(s,t)})}function Kf(e,t,n){return{instance:e,listener:t,currentTarget:n}}function qf(e,t){for(var n=t+`Capture`,r=[];e!==null;){var i=e,a=i.stateNode;if(i=i.tag,i!==5&&i!==26&&i!==27||a===null||(i=Cn(e,n),i!=null&&r.unshift(Kf(e,i,a)),i=Cn(e,t),i!=null&&r.push(Kf(e,i,a))),e.tag===3)return r;e=e.return}return[]}function Jf(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function Yf(e,t,n,r,i){for(var a=t._reactName,o=[];n!==null&&n!==r;){var s=n,c=s.alternate,l=s.stateNode;if(s=s.tag,c!==null&&c===r)break;s!==5&&s!==26&&s!==27||l===null||(c=l,i?(l=Cn(n,a),l!=null&&o.unshift(Kf(n,l,c))):i||(l=Cn(n,a),l!=null&&o.push(Kf(n,l,c)))),n=n.return}o.length!==0&&e.push({event:t,listeners:o})}var Xf=/\r\n?/g,Zf=/\u0000|\uFFFD/g;function Qf(e){return(typeof e==`string`?e:``+e).replace(Xf,`
`).replace(Zf,``)}function $f(e,t){return t=Qf(t),Qf(e)===t}function ep(e,t,n,r,a,o){switch(n){case`children`:if(typeof r==`string`)t===`body`||t===`textarea`&&r===``||cn(e,r);else if(typeof r==`number`||typeof r==`bigint`)t!==`body`&&cn(e,``+r);else return;break;case`className`:Kt(e,`class`,r);break;case`tabIndex`:Kt(e,`tabindex`,r);break;case`dir`:case`role`:case`viewBox`:case`width`:case`height`:Kt(e,n,r);break;case`style`:dn(e,r,o);return;case`data`:if(t!==`object`){Kt(e,`data`,r);break}case`src`:case`href`:if(r===``&&(t!==`a`||n!==`href`)){e.removeAttribute(n);break}if(r==null||typeof r==`function`||typeof r==`symbol`||typeof r==`boolean`){e.removeAttribute(n);break}r=hn(r),e.setAttribute(n,r);break;case`action`:case`formAction`:if(typeof r==`function`){e.setAttribute(n,`javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')`);break}if(typeof o==`function`&&(n===`formAction`?(t!==`input`&&ep(e,t,`name`,a.name,a,null),ep(e,t,`formEncType`,a.formEncType,a,null),ep(e,t,`formMethod`,a.formMethod,a,null),ep(e,t,`formTarget`,a.formTarget,a,null)):(ep(e,t,`encType`,a.encType,a,null),ep(e,t,`method`,a.method,a,null),ep(e,t,`target`,a.target,a,null))),r==null||typeof r==`symbol`||typeof r==`boolean`){e.removeAttribute(n);break}r=hn(r),e.setAttribute(n,r);break;case`onClick`:r!=null&&(e.onclick=gn);return;case`onScroll`:r!=null&&$(`scroll`,e);return;case`onScrollEnd`:r!=null&&$(`scrollend`,e);return;case`dangerouslySetInnerHTML`:if(r!=null){if(typeof r!=`object`||!(`__html`in r))throw Error(i(61));if(n=r.__html,n!=null){if(a.children!=null)throw Error(i(60));o?.__html!==n&&(e.innerHTML=n)}}break;case`multiple`:e.multiple=r&&typeof r!=`function`&&typeof r!=`symbol`;break;case`muted`:e.muted=r&&typeof r!=`function`&&typeof r!=`symbol`;break;case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`defaultValue`:case`defaultChecked`:case`innerHTML`:case`ref`:break;case`autoFocus`:break;case`xlinkHref`:if(r==null||typeof r==`function`||typeof r==`boolean`||typeof r==`symbol`){e.removeAttribute(`xlink:href`);break}n=hn(r),e.setAttributeNS(`http://www.w3.org/1999/xlink`,`xlink:href`,n);break;case`contentEditable`:case`spellCheck`:case`draggable`:case`value`:case`autoReverse`:case`externalResourcesRequired`:case`focusable`:case`preserveAlpha`:r!=null&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,r):e.removeAttribute(n);break;case`inert`:case`allowFullScreen`:case`async`:case`autoPlay`:case`controls`:case`credentialless`:case`default`:case`defer`:case`disabled`:case`disablePictureInPicture`:case`disableRemotePlayback`:case`formNoValidate`:case`hidden`:case`loop`:case`noModule`:case`noValidate`:case`open`:case`playsInline`:case`readOnly`:case`required`:case`reversed`:case`scoped`:case`seamless`:case`itemScope`:r&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,``):e.removeAttribute(n);break;case`capture`:case`download`:!0===r?e.setAttribute(n,``):!1!==r&&r!=null&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,r):e.removeAttribute(n);break;case`cols`:case`rows`:case`size`:case`span`:r!=null&&typeof r!=`function`&&typeof r!=`symbol`&&!isNaN(r)&&1<=r?e.setAttribute(n,r):e.removeAttribute(n);break;case`rowSpan`:case`start`:r==null||typeof r==`function`||typeof r==`symbol`||isNaN(r)?e.removeAttribute(n):e.setAttribute(n,r);break;case`popover`:$(`beforetoggle`,e),$(`toggle`,e),Gt(e,`popover`,r);break;case`xlinkActuate`:qt(e,`http://www.w3.org/1999/xlink`,`xlink:actuate`,r);break;case`xlinkArcrole`:qt(e,`http://www.w3.org/1999/xlink`,`xlink:arcrole`,r);break;case`xlinkRole`:qt(e,`http://www.w3.org/1999/xlink`,`xlink:role`,r);break;case`xlinkShow`:qt(e,`http://www.w3.org/1999/xlink`,`xlink:show`,r);break;case`xlinkTitle`:qt(e,`http://www.w3.org/1999/xlink`,`xlink:title`,r);break;case`xlinkType`:qt(e,`http://www.w3.org/1999/xlink`,`xlink:type`,r);break;case`xmlBase`:qt(e,`http://www.w3.org/XML/1998/namespace`,`xml:base`,r);break;case`xmlLang`:qt(e,`http://www.w3.org/XML/1998/namespace`,`xml:lang`,r);break;case`xmlSpace`:qt(e,`http://www.w3.org/XML/1998/namespace`,`xml:space`,r);break;case`is`:Gt(e,`is`,r);break;case`innerText`:case`textContent`:return;default:if(!(2<n.length)||n[0]!==`o`&&n[0]!==`O`||n[1]!==`n`&&n[1]!==`N`)n=pn.get(n)||n,Gt(e,n,r);else return}z=!0}function tp(e,t,n,r,a,o){switch(n){case`style`:dn(e,r,o);return;case`dangerouslySetInnerHTML`:if(r!=null){if(typeof r!=`object`||!(`__html`in r))throw Error(i(61));if(n=r.__html,n!=null){if(a.children!=null)throw Error(i(60));o?.__html!==n&&(e.innerHTML=n)}}break;case`children`:if(typeof r==`string`)cn(e,r);else if(typeof r==`number`||typeof r==`bigint`)cn(e,``+r);else return;break;case`onScroll`:r!=null&&$(`scroll`,e);return;case`onScrollEnd`:r!=null&&$(`scrollend`,e);return;case`onClick`:r!=null&&(e.onclick=gn);return;case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`innerHTML`:case`ref`:return;case`innerText`:case`textContent`:return;default:if(!Lt.hasOwnProperty(n))a:{if(n[0]===`o`&&n[1]===`n`&&(a=n.endsWith(`Capture`),o=n.slice(2,a?n.length-7:void 0),t=e[St]||null,t=t==null?null:t[n],typeof t==`function`&&e.removeEventListener(o,t,a),typeof r==`function`)){typeof t!=`function`&&t!==null&&(n in e?e[n]=null:e.hasAttribute(n)&&e.removeAttribute(n)),e.addEventListener(o,r,a);break a}z=!0,n in e?e[n]=r:!0===r?e.setAttribute(n,``):Gt(e,n,r)}return}z=!0}function np(e,t,n){switch(t){case`div`:case`span`:case`svg`:case`path`:case`a`:case`g`:case`p`:case`li`:break;case`img`:$(`error`,e),$(`load`,e);var r=!1,a=!1,o;for(o in n)if(n.hasOwnProperty(o)){var s=n[o];if(s!=null)switch(o){case`src`:r=!0;break;case`srcSet`:a=!0;break;case`children`:case`dangerouslySetInnerHTML`:throw Error(i(137,t));default:ep(e,t,o,s,n,null)}}a&&ep(e,t,`srcSet`,n.srcSet,n,null),r&&ep(e,t,`src`,n.src,n,null);return;case`input`:$(`invalid`,e);var c=o=s=a=null,l=null,u=null;for(r in n)if(n.hasOwnProperty(r)){var d=n[r];if(d!=null)switch(r){case`name`:a=d;break;case`type`:s=d;break;case`checked`:l=d;break;case`defaultChecked`:u=d;break;case`value`:o=d;break;case`defaultValue`:c=d;break;case`children`:case`dangerouslySetInnerHTML`:if(d!=null)throw Error(i(137,t));break;default:ep(e,t,r,d,n,null)}}nn(e,o,c,l,u,s,a,!1);return;case`select`:for(a in $(`invalid`,e),r=s=o=null,n)if(n.hasOwnProperty(a)&&(c=n[a],c!=null))switch(a){case`value`:o=c;break;case`defaultValue`:s=c;break;case`multiple`:r=c;default:ep(e,t,a,c,n,null)}t=o,n=s,e.multiple=!!r,t==null?n!=null&&an(e,!!r,n,!0):an(e,!!r,t,!1);return;case`textarea`:for(s in $(`invalid`,e),o=a=r=null,n)if(n.hasOwnProperty(s)&&(c=n[s],c!=null))switch(s){case`value`:r=c;break;case`defaultValue`:a=c;break;case`children`:o=c;break;case`dangerouslySetInnerHTML`:if(c!=null)throw Error(i(91));break;default:ep(e,t,s,c,n,null)}sn(e,r,a,o);return;case`option`:for(l in n)if(n.hasOwnProperty(l)&&(r=n[l],r!=null))switch(l){case`selected`:e.selected=r&&typeof r!=`function`&&typeof r!=`symbol`;break;default:ep(e,t,l,r,n,null)}return;case`dialog`:$(`beforetoggle`,e),$(`toggle`,e),$(`cancel`,e),$(`close`,e);break;case`iframe`:case`object`:$(`load`,e);break;case`video`:case`audio`:for(r=0;r<Rf.length;r++)$(Rf[r],e);break;case`image`:$(`error`,e),$(`load`,e);break;case`details`:$(`toggle`,e);break;case`embed`:case`source`:case`link`:$(`error`,e),$(`load`,e);case`area`:case`base`:case`br`:case`col`:case`hr`:case`keygen`:case`meta`:case`param`:case`track`:case`wbr`:case`menuitem`:for(u in n)if(n.hasOwnProperty(u)&&(r=n[u],r!=null))switch(u){case`children`:case`dangerouslySetInnerHTML`:throw Error(i(137,t));default:ep(e,t,u,r,n,null)}return;default:if(fn(t)){for(d in n)n.hasOwnProperty(d)&&(r=n[d],r!==void 0&&tp(e,t,d,r,n,void 0));return}}for(c in n)n.hasOwnProperty(c)&&(r=n[c],r!=null&&ep(e,t,c,r,n,null))}var rp={};function ip(e,t,n,r){switch(t){case`div`:case`span`:case`svg`:case`path`:case`a`:case`g`:case`p`:case`li`:break;case`input`:var a=null,o=null,s=null,c=null,l=null,u=null,d=null;for(m in n){var f=n[m];if(n.hasOwnProperty(m)&&f!=null)switch(m){case`checked`:break;case`value`:break;case`defaultValue`:l=f;default:r.hasOwnProperty(m)||ep(e,t,m,null,r,f)}}for(var p in r){var m=r[p];if(f=n[p],r.hasOwnProperty(p)&&(m!=null||f!=null))switch(p){case`type`:m!==f&&(z=!0),o=m;break;case`name`:m!==f&&(z=!0),a=m;break;case`checked`:m!==f&&(z=!0),u=m;break;case`defaultChecked`:m!==f&&(z=!0),d=m;break;case`value`:m!==f&&(z=!0),s=m;break;case`defaultValue`:m!==f&&(z=!0),c=m;break;case`children`:case`dangerouslySetInnerHTML`:if(m!=null)throw Error(i(137,t));break;default:m!==f&&ep(e,t,p,m,r,f)}}tn(e,s,c,l,u,d,o,a);return;case`select`:for(o in m=s=c=p=null,n)if(l=n[o],n.hasOwnProperty(o)&&l!=null)switch(o){case`value`:break;case`multiple`:m=l;default:r.hasOwnProperty(o)||ep(e,t,o,null,r,l)}for(a in r)if(o=r[a],l=n[a],r.hasOwnProperty(a)&&(o!=null||l!=null))switch(a){case`value`:o!==l&&(z=!0),p=o;break;case`defaultValue`:o!==l&&(z=!0),c=o;break;case`multiple`:o!==l&&(z=!0),s=o;default:o!==l&&ep(e,t,a,o,r,l)}t=c,n=s,r=m,p==null?!!r!=!!n&&(t==null?an(e,!!n,n?[]:``,!1):an(e,!!n,t,!0)):an(e,!!n,p,!1);return;case`textarea`:for(c in m=p=null,n)if(a=n[c],n.hasOwnProperty(c)&&a!=null&&!r.hasOwnProperty(c))switch(c){case`value`:break;case`children`:break;default:ep(e,t,c,null,r,a)}for(s in r)if(a=r[s],o=n[s],r.hasOwnProperty(s)&&(a!=null||o!=null))switch(s){case`value`:a!==o&&(z=!0),p=a;break;case`defaultValue`:a!==o&&(z=!0),m=a;break;case`children`:break;case`dangerouslySetInnerHTML`:if(a!=null)throw Error(i(91));break;default:a!==o&&ep(e,t,s,a,r,o)}on(e,p,m);return;case`option`:for(var h in n)if(p=n[h],n.hasOwnProperty(h)&&p!=null&&!r.hasOwnProperty(h))switch(h){case`selected`:e.selected=!1;break;default:ep(e,t,h,null,r,p)}for(l in r)if(p=r[l],m=n[l],r.hasOwnProperty(l)&&p!==m&&(p!=null||m!=null))switch(l){case`selected`:p!==m&&(z=!0),e.selected=p&&typeof p!=`function`&&typeof p!=`symbol`;break;default:ep(e,t,l,p,r,m)}return;case`img`:case`link`:case`area`:case`base`:case`br`:case`col`:case`embed`:case`hr`:case`keygen`:case`meta`:case`param`:case`source`:case`track`:case`wbr`:case`menuitem`:for(var g in n)p=n[g],n.hasOwnProperty(g)&&p!=null&&!r.hasOwnProperty(g)&&ep(e,t,g,null,r,p);for(u in r)if(p=r[u],m=n[u],r.hasOwnProperty(u)&&p!==m&&(p!=null||m!=null))switch(u){case`children`:case`dangerouslySetInnerHTML`:if(p!=null)throw Error(i(137,t));break;default:ep(e,t,u,p,r,m)}return;default:if(fn(t)){for(var _ in n)p=n[_],n.hasOwnProperty(_)&&p!==void 0&&!r.hasOwnProperty(_)&&tp(e,t,_,void 0,r,p);for(d in r)p=r[d],m=n[d],!r.hasOwnProperty(d)||p===m||p===void 0&&m===void 0||tp(e,t,d,p,r,m);return}}for(var v in n)p=n[v],n.hasOwnProperty(v)&&p!=null&&!r.hasOwnProperty(v)&&ep(e,t,v,null,r,p);for(f in r)p=r[f],m=n[f],!r.hasOwnProperty(f)||p===m||p==null&&m==null||ep(e,t,f,p,r,m)}function ap(e){switch(e){case`css`:case`script`:case`font`:case`img`:case`image`:case`input`:case`link`:return!0;default:return!1}}function op(){if(typeof performance.getEntriesByType==`function`){for(var e=0,t=0,n=performance.getEntriesByType(`resource`),r=0;r<n.length;r++){var i=n[r],a=i.transferSize,o=i.initiatorType,s=i.duration;if(a&&s&&ap(o)){for(o=0,s=i.responseEnd,r+=1;r<n.length;r++){var c=n[r],l=c.startTime;if(l>s)break;var u=c.transferSize,d=c.initiatorType;u&&ap(d)&&(c=c.responseEnd,o+=u*(c<s?1:(s-l)/(c-l)))}if(--r,t+=8*(a+o)/(i.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e==`number`)?e:5}var sp=null,cp=null;function lp(e){return e.nodeType===9?e:e.ownerDocument}function up(e){switch(e){case`http://www.w3.org/2000/svg`:return 1;case`http://www.w3.org/1998/Math/MathML`:return 2;default:return 0}}function dp(e,t){if(e===0)switch(t){case`svg`:return 1;case`math`:return 2;default:return 0}return e===1&&t===`foreignObject`?0:e}function fp(e,t,n,r){return n=lp(n).createElement(e),n[xt]=r,n[St]=t,np(n,e,t),R(n),n}function pp(e,t){return e===`textarea`||e===`noscript`||typeof t.children==`string`||typeof t.children==`number`||typeof t.children==`bigint`||typeof t.dangerouslySetInnerHTML==`object`&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var mp=null;function hp(){var e=window.event;return e&&e.type===`popstate`?e!==mp&&(mp=e,!0):(mp=null,!1)}var gp=typeof setTimeout==`function`?setTimeout:void 0,_p=typeof clearTimeout==`function`?clearTimeout:void 0,vp=typeof Promise==`function`?Promise:void 0,yp=typeof requestAnimationFrame==`function`?requestAnimationFrame:gp,bp=typeof queueMicrotask==`function`?queueMicrotask:vp===void 0?gp:function(e){return vp.resolve(null).then(e).catch(xp)};function xp(e){setTimeout(function(){throw e})}function Sp(e){return e===`head`}function Cp(e,t){var n=t,r=0;do{var i=n.nextSibling;if(e.removeChild(n),i&&i.nodeType===8){if(n=i.data,n===`/$`||n===`/&`){if(r===0){e.removeChild(i),Hh(t);return}r--}else if(n===`$`||n===`$?`||n===`$~`||n===`$!`||n===`&`)r++;else if(n===`html`)_m(e.ownerDocument.documentElement);else if(n===`head`){n=e.ownerDocument.head,_m(n);for(var a=n.firstChild;a;){var o=a.nextSibling,s=a.nodeName;a[Ot]||s===`SCRIPT`||s===`STYLE`||s===`LINK`&&a.rel.toLowerCase()===`stylesheet`||n.removeChild(a),a=o}}else n===`body`&&_m(e.ownerDocument.body)}n=i}while(n);Hh(t)}function wp(e,t){var n=e;e=0;do{var r=n.nextSibling;if(n.nodeType===1?t?(n._stashedDisplay=n.style.display,n.style.display=`none`):(n.style.display=n._stashedDisplay||``,n.getAttribute(`style`)===``&&n.removeAttribute(`style`)):n.nodeType===3&&(t?(n._stashedText=n.nodeValue,n.nodeValue=``):n.nodeValue=n._stashedText||``),r&&r.nodeType===8){if(n=r.data,n===`/$`){if(e===0)break;e--}else n!==`$`&&n!==`$?`&&n!==`$~`&&n!==`$!`||e++}n=r}while(n)}function Tp(e,t,n){if(t=CSS.escape(t)===t?t:`r-`+btoa(t).replace(/=/g,``),e.style.viewTransitionName=t,n!=null&&(e.style.viewTransitionClass=n),n=getComputedStyle(e),n.display===`inline`){if(t=e.getClientRects(),t.length===1)var r=1;else for(var i=r=0;i<t.length;i++){var a=t[i];0<a.width&&0<a.height&&r++}r===1&&(e=e.style,e.display=t.length===1?`inline-block`:`block`,e.marginTop=`-`+n.paddingTop,e.marginBottom=`-`+n.paddingBottom)}}function Ep(e,t){e=e.style,t=t.style;var n=t==null?null:t.hasOwnProperty(`viewTransitionName`)?t.viewTransitionName:t.hasOwnProperty(`view-transition-name`)?t[`view-transition-name`]:null;e.viewTransitionName=n==null||typeof n==`boolean`?``:(``+n).trim(),n=t==null?null:t.hasOwnProperty(`viewTransitionClass`)?t.viewTransitionClass:t.hasOwnProperty(`view-transition-class`)?t[`view-transition-class`]:null,e.viewTransitionClass=n==null||typeof n==`boolean`?``:(``+n).trim(),e.display===`inline-block`&&(t==null?e.display=e.margin=``:(n=t.display,e.display=n==null||typeof n==`boolean`?``:n,n=t.margin,n==null?(n=t.hasOwnProperty(`marginTop`)?t.marginTop:t[`margin-top`],e.marginTop=n==null||typeof n==`boolean`?``:n,t=t.hasOwnProperty(`marginBottom`)?t.marginBottom:t[`margin-bottom`],e.marginBottom=t==null||typeof t==`boolean`?``:t):e.margin=n))}function Dp(e,t,n){return n=n.ownerDocument.defaultView,{rect:e,abs:t.position===`absolute`||t.position===`fixed`,clip:t.clipPath!==`none`||t.overflow!==`visible`||t.filter!==`none`||t.mask!==`none`||t.mask!==`none`||t.borderRadius!==`0px`,view:0<=e.bottom&&0<=e.right&&e.top<=n.innerHeight&&e.left<=n.innerWidth}}function Op(e){return Dp(e.getBoundingClientRect(),getComputedStyle(e),e)}function kp(e){var t=e.getBoundingClientRect();t=new DOMRect(t.x+2e4,t.y+2e4,t.width,t.height);var n=getComputedStyle(e);return Dp(t,n,e)}function Ap(e){return e.documentElement.clientHeight}function jp(e){this.addEventListener(`load`,e),this.addEventListener(`error`,e)}function Mp(e,t,n,r,i,a,o,s,c){var l=t.nodeType===9?t:t.ownerDocument;try{var u=l.startViewTransition({update:function(){var t=l.defaultView,n=t.navigation&&t.navigation.transition,o=l.fonts.status;r();var s=[];if(o===`loaded`&&(Ap(l),l.fonts.status===`loading`&&s.push(l.fonts.ready)),o=s.length,e!==null)for(var c=e.suspenseyImages,u=0,d=0;d<c.length;d++){var f=c[d];if(!f.complete){var p=f.getBoundingClientRect();if(0<p.bottom&&0<p.right&&p.top<t.innerHeight&&p.left<t.innerWidth){if(u+=Xm(f),u>$m){s.length=o;break}f=new Promise(jp.bind(f)),s.push(f)}}}if(0<s.length)return t=Promise.race([Promise.all(s),new Promise(function(e){return setTimeout(e,500)})]).then(i,i),(n?Promise.allSettled([n.finished,t]):t).then(a,a);if(i(),n)return n.finished.then(a,a);a()},types:n});l.__reactViewTransition=u;var d=[];return u.ready.then(function(){for(var e=l.documentElement.getAnimations({subtree:!0}),t=0;t<e.length;t++){var n=e[t],r=n.effect,i=r.pseudoElement;if(i!=null&&i.startsWith(`::view-transition`)){d.push(n),n=r.getKeyframes();for(var a=i=void 0,s=!0,c=0;c<n.length;c++){var u=n[c],f=u.width;if(i===void 0)i=f;else if(i!==f){s=!1;break}if(f=u.height,a===void 0)a=f;else if(a!==f){s=!1;break}delete u.width,delete u.height,u.transform===`none`&&delete u.transform}s&&i!==void 0&&a!==void 0&&(r.setKeyframes(n),s=getComputedStyle(r.target,r.pseudoElement),s.width!==i||s.height!==a)&&(s=n[0],s.width=i,s.height=a,s=n[n.length-1],s.width=i,s.height=a,r.setKeyframes(n))}}o()},function(e){l.__reactViewTransition===u&&(l.__reactViewTransition=null);try{if(typeof e==`object`&&e)switch(e.name){case`InvalidStateError`:(e.message===`View transition was skipped because document visibility state is hidden.`||e.message===`Skipping view transition because document visibility state has become hidden.`||e.message===`Skipping view transition because viewport size changed.`||e.message===`Transition was aborted because of invalid state`)&&(e=null)}e!==null&&c(e)}finally{r(),i(),o()}}),u.finished.finally(function(){for(var e=0;e<d.length;e++)d[e].cancel();l.__reactViewTransition===u&&(l.__reactViewTransition=null),s()}),u}catch{return r(),i(),o(),null}}function Np(e,t){this._scope=document.documentElement,this._selector=`::view-transition-`+e+`(`+t+`)`}Np.prototype.animate=function(e,t){return t=typeof t==`number`?{duration:t}:T({},t),t.pseudoElement=this._selector,this._scope.animate(e,t)},Np.prototype.getAnimations=function(){for(var e=this._scope,t=this._selector,n=e.getAnimations({subtree:!0}),r=[],i=0;i<n.length;i++){var a=n[i].effect;a!==null&&a.target===e&&a.pseudoElement===t&&r.push(n[i])}return r},Np.prototype.getComputedStyle=function(){return getComputedStyle(this._scope,this._selector)};function Pp(e){return{name:e,group:new Np(`group`,e),imagePair:new Np(`image-pair`,e),old:new Np(`old`,e),new:new Np(`new`,e)}}function Fp(e){this._fragmentFiber=e,this._observers=this._eventListeners=null}Fp.prototype.addEventListener=function(e,t,n){var r=null,i=null;if(!(n!=null&&typeof n!=`boolean`&&(r=n.signal||null,r!==null&&r.aborted))){this._eventListeners===null&&(this._eventListeners=[]);var a=this._eventListeners;if(Bp(a,e,t,n)===-1){var o=this,s=t;n!=null&&typeof n!=`boolean`&&!0===n.once&&(s=function(r){o.removeEventListener(e,t,n),typeof t==`function`?t.call(this,r):t.handleEvent(r)}),r!==null&&(i=o.removeEventListener.bind(o,e,t,n),r.addEventListener(`abort`,i,{once:!0}),i=r.removeEventListener.bind(r,`abort`,i)),r=Rp(n),a.push({type:e,listener:t,optionsOrUseCapture:n,attachedListener:s,cleanup:i}),p(this._fragmentFiber.child,!1,Ip,e,s,r)}this._eventListeners=a}};function Ip(e,t,n,r){return v(e).addEventListener(t,n,r),!1}Fp.prototype.removeEventListener=function(e,t,n){var r=this._eventListeners;if(r!==null&&(t=Bp(r,e,t,n),t!==-1)){var i=r[t];n=i.attachedListener;var a=i.cleanup;i=Rp(i.optionsOrUseCapture),p(this._fragmentFiber.child,!1,Lp,e,n,i),r.splice(t,1),a!==null&&a()}};function Lp(e,t,n,r){return v(e).removeEventListener(t,n,r),!1}function Rp(e){return e!=null&&typeof e!=`boolean`&&(!0===e.once||e.signal instanceof AbortSignal)?{capture:e.capture,passive:e.passive}:e}function zp(e){return e==null?`c=0`:typeof e==`boolean`?`c=`+(e?`1`:`0`):`c=`+(e.capture?`1`:`0`)}function Bp(e,t,n,r){if(e.length===0)return-1;r=zp(r);for(var i=0;i<e.length;i++){var a=e[i];if(a.type===t&&a.listener===n&&zp(a.optionsOrUseCapture)===r)return i}return-1}Fp.prototype.dispatchEvent=function(e){var t=m(this._fragmentFiber);if(t===null)return!0;t=v(t);var n=this._eventListeners;if(n!==null&&0<n.length||!e.bubbles){var r=t.nodeType===9?t.createComment(``):document.createTextNode(``);if(n)for(var i=0;i<n.length;i++){var a=n[i];r.addEventListener(a.type,a.attachedListener,Rp(a.optionsOrUseCapture))}if(t.appendChild(r),e=r.dispatchEvent(e),n)for(i=0;i<n.length;i++)a=n[i],r.removeEventListener(a.type,a.attachedListener,Rp(a.optionsOrUseCapture));return t.removeChild(r),e}return t.dispatchEvent(e)},Fp.prototype.focus=function(e){p(this._fragmentFiber.child,!0,Vp,e,void 0,void 0)};function Vp(e,t){return e.tag!==6&&(e=v(e),pm(e,t))}Fp.prototype.focusLast=function(e){var t=[];p(this._fragmentFiber.child,!0,Hp,t,void 0,void 0);for(var n=t.length-1;0<=n&&!Vp(t[n],e);n--);};function Hp(e,t){return t.push(e),!1}Fp.prototype.blur=function(){var e=m(this._fragmentFiber);e!==null&&(e=v(e),e=lp(e).activeElement,e!==null&&p(this._fragmentFiber.child,!1,Up,e,void 0,void 0))};function Up(e,t){return e.tag!==6&&(e=v(e),e===t||e.contains(t)?(t.blur(),!0):!1)}Fp.prototype.observeUsing=function(e){this._observers===null&&(this._observers=new Set),this._observers.add(e),p(this._fragmentFiber.child,!1,Wp,e,void 0,void 0)};function Wp(e,t){return e.tag!==6&&(e=v(e),t.observe(e),!1)}Fp.prototype.unobserveUsing=function(e){var t=this._observers;if(t!==null&&t.has(e)){t.delete(e),p(this._fragmentFiber.child,!1,Gp,e,void 0,void 0);for(var n=t=0;n<Kp.length;n++){var r=Kp[n];r.fragmentInstance===this&&r.observer===e?e.unobserve(r.instance):Kp[t++]=r}Kp.length=t}};function Gp(e,t){return e.tag!==6&&(e=v(e),t.unobserve(e),!1)}var Kp=[],qp=!1;function Jp(e,t,n){Kp.push({fragmentInstance:e,observer:t,instance:n}),qp||(qp=!0,mm(function(){qp=!1;var e=Kp;Kp=[];for(var t=0;t<e.length;t++){var n=e[t];n.observer.unobserve(n.instance)}}))}Fp.prototype.getClientRects=function(){var e=[];return p(this._fragmentFiber.child,!1,Yp,e,void 0,void 0),e};function Yp(e,t){if(e.tag===6){e=e.stateNode;var n=e.ownerDocument.createRange();n.selectNodeContents(e),t.push.apply(t,n.getClientRects())}else e=v(e),t.push.apply(t,e.getClientRects());return!1}Fp.prototype.getRootNode=function(e){var t=m(this._fragmentFiber);return t===null?this:v(t).getRootNode(e)},Fp.prototype.compareDocumentPosition=function(e){var t=m(this._fragmentFiber);if(t===null)return Node.DOCUMENT_POSITION_DISCONNECTED;var n=[];p(this._fragmentFiber.child,!1,Hp,n,void 0,void 0);var r=v(t);if(n.length===0){if(n=r,h(this._fragmentFiber)){a:{for(t=this._fragmentFiber.return;t!==null;){if(t.tag===4){t=t.stateNode.containerInfo;break a}if(t.tag===3||t.tag===5||t.tag===27)break;t=t.return}t=null}t!=null&&(n=t)}t=this._fragmentFiber;var i=r=n.compareDocumentPosition(e);return n===e?i=Node.DOCUMENT_POSITION_CONTAINS:r&Node.DOCUMENT_POSITION_CONTAINED_BY&&(n=g(t)[1],n===null?i=Node.DOCUMENT_POSITION_PRECEDING:(e=v(n).compareDocumentPosition(e),i=e===0||e&Node.DOCUMENT_POSITION_FOLLOWING?Node.DOCUMENT_POSITION_FOLLOWING:Node.DOCUMENT_POSITION_PRECEDING)),i|=Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC}t=v(n[0]),i=v(n[n.length-1]);var a=h(this._fragmentFiber)?t.parentElement:r;if(a==null)return Node.DOCUMENT_POSITION_DISCONNECTED;r=a.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_CONTAINED_BY,a=a.compareDocumentPosition(i)&Node.DOCUMENT_POSITION_CONTAINED_BY;var o=t.compareDocumentPosition(e),s=i.compareDocumentPosition(e),c=o&Node.DOCUMENT_POSITION_CONTAINED_BY||s&Node.DOCUMENT_POSITION_CONTAINED_BY;return s=r&&a&&o&Node.DOCUMENT_POSITION_FOLLOWING&&s&Node.DOCUMENT_POSITION_PRECEDING,t=r&&t===e||a&&i===e||c||s?Node.DOCUMENT_POSITION_CONTAINED_BY:!r&&t===e||!a&&i===e?Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC:o,t&Node.DOCUMENT_POSITION_DISCONNECTED||t&Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC||Xp(t,this._fragmentFiber,n[0],n[n.length-1],e)?t:Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC};function Xp(e,t,n,r,i){var a=jt(i);if(e&Node.DOCUMENT_POSITION_CONTAINED_BY){if(n=!!a)a:{for(;a!==null;){if(a.tag===7&&(a===t||a.alternate===t)){n=!0;break a}a=a.return}n=!1}return n}if(e&Node.DOCUMENT_POSITION_CONTAINS){if(a===null)return a=i.ownerDocument,i===a||i===a.documentElement||i===a.body;a:{for(a=t,t=m(t);a!==null;){if(!(a.tag!==5&&a.tag!==3&&a.tag!==27||a!==t&&a.alternate!==t)){a=!0;break a}a=a.return}a=!1}return a}return e&Node.DOCUMENT_POSITION_PRECEDING?((t=!!a)&&!(t=a===n)&&(t=w(n,a,C),t===null?t=!1:(p(t,!0,x,a,n),a=y,y=null,t=a!==null)),t):e&Node.DOCUMENT_POSITION_FOLLOWING?((t=!!a)&&!(t=a===r)&&(t=w(r,a,C),t===null?t=!1:(p(t,!0,S,a,r),a=y,b=y=null,t=a!==null)),t):!1}function Zp(e,t){var n=e.ownerDocument.createRange();n.selectNodeContents(e),e=n.getBoundingClientRect(),window.scrollTo(window.scrollX+e.left,t?window.scrollY+e.top:window.scrollY+e.bottom-window.innerHeight)}Fp.prototype.scrollIntoView=function(e){if(typeof e==`object`)throw Error(i(566));var t=[];p(this._fragmentFiber.child,!1,Hp,t,void 0,void 0);var n=!1!==e;if(t.length===0){var r=g(this._fragmentFiber);if(r=n?r[1]||r[0]||m(this._fragmentFiber):r[0]||r[1],r===null)return;if(r.tag===6){e=v(r),Zp(e,n);return}if(r=v(r),r.nodeType!==9){if(r.nodeType===11){n=`host`in r?r.host:null,n!==null&&n.scrollIntoView(e);return}r.scrollIntoView(e)}}for(r=n?t.length-1:0;r!==(n?-1:t.length);){var a=t[r];a.tag===6?(a=v(a),Zp(a,n)):v(a).scrollIntoView(e),r+=n?-1:1}};function Qp(e,t){return e=v(e),$p(e,t),!1}function $p(e,t){e.reactFragments??=new Set,e.reactFragments.add(t)}function em(e,t){var n=t._eventListeners;if(n!==null)for(var r=0;r<n.length;r++){var i=n[r];e.addEventListener(i.type,i.attachedListener,Rp(i.optionsOrUseCapture))}e.nodeType!==3&&(n=t._observers,n!==null&&n.forEach(function(n){for(var r=0,i=0;i<Kp.length;i++){var a=Kp[i];(a.fragmentInstance!==t||a.observer!==n||a.instance!==e)&&(Kp[r++]=a)}Kp.length=r,n.observe(e)}),$p(e,t))}function tm(e,t){var n=t._eventListeners;if(n!==null)for(var r=0;r<n.length;r++){var i=n[r];e.removeEventListener(i.type,i.attachedListener,Rp(i.optionsOrUseCapture))}e.nodeType!==3&&(n=t._observers,n!==null&&n.forEach(function(n){typeof n.rootMargin==`string`?Jp(t,n,e):n.unobserve(e)}),e.reactFragments!=null&&e.reactFragments.delete(t))}function nm(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var n=t;switch(t=t.nextSibling,n.nodeName){case`HTML`:case`HEAD`:case`BODY`:nm(n),At(n);continue;case`SCRIPT`:case`STYLE`:continue;case`LINK`:if(n.rel.toLowerCase()===`stylesheet`)continue}e.removeChild(n)}}function rm(e,t,n,r){for(;e.nodeType===1;){var i=n;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!r&&(e.nodeName!==`INPUT`||e.type!==`hidden`))break}else if(!r){if(t===`input`&&e.type===`hidden`){var a=i.name==null?null:``+i.name;if(i.type===`hidden`&&e.getAttribute(`name`)===a)return e}else return e}else if(!e[Ot])switch(t){case`meta`:if(!e.hasAttribute(`itemprop`))break;return e;case`link`:if(a=e.getAttribute(`rel`),a===`stylesheet`&&e.hasAttribute(`data-precedence`)||a!==i.rel||e.getAttribute(`href`)!==(i.href==null||i.href===``?null:i.href)||e.getAttribute(`crossorigin`)!==(i.crossOrigin==null?null:i.crossOrigin)||e.getAttribute(`title`)!==(i.title==null?null:i.title))break;return e;case`style`:if(e.hasAttribute(`data-precedence`))break;return e;case`script`:if(a=e.getAttribute(`src`),(a!==(i.src==null?null:i.src)||e.getAttribute(`type`)!==(i.type==null?null:i.type)||e.getAttribute(`crossorigin`)!==(i.crossOrigin==null?null:i.crossOrigin))&&a&&e.hasAttribute(`async`)&&!e.hasAttribute(`itemprop`))break;return e;default:return e}if(e=lm(e.nextSibling),e===null)break}return null}function im(e,t,n){if(t===``)return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!==`INPUT`||e.type!==`hidden`)&&!n||(e=lm(e.nextSibling),e===null))return null;return e}function am(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!==`INPUT`||e.type!==`hidden`)&&!t||(e=lm(e.nextSibling),e===null))return null;return e}function om(e){return e.data===`$?`||e.data===`$~`}function sm(e){return e.data===`$!`||e.data===`$?`&&e.ownerDocument.readyState!==`loading`}function cm(e,t){var n=e.ownerDocument;if(e.data===`$~`)e._reactRetry=t;else if(e.data!==`$?`||n.readyState!==`loading`)t();else{var r=function(){t(),n.removeEventListener(`DOMContentLoaded`,r)};n.addEventListener(`DOMContentLoaded`,r),e._reactRetry=r}}function lm(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t===`$`||t===`$!`||t===`$?`||t===`$~`||t===`&`||t===`F!`||t===`F`)break;if(t===`/$`||t===`/&`)return null}}return e}var um=null;function dm(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n===`/$`||n===`/&`){if(t===0)return lm(e.nextSibling);t--}else n!==`$`&&n!==`$!`&&n!==`$?`&&n!==`$~`&&n!==`&`||t++}e=e.nextSibling}return null}function fm(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n===`$`||n===`$!`||n===`$?`||n===`$~`||n===`&`){if(t===0)return e;t--}else n!==`/$`&&n!==`/&`||t++}e=e.previousSibling}return null}function pm(e,t){function n(){r=!0}if(e.ownerDocument.activeElement===e)return!0;var r=!1;try{e.ownerDocument.addEventListener(`focus`,n,!0),(e.focus||HTMLElement.prototype.focus).call(e,t)}finally{e.ownerDocument.removeEventListener(`focus`,n,!0)}return r}function mm(e){yp(function(){yp(function(t){return e(t)})})}function hm(e,t,n){switch(t=lp(n),e){case`html`:if(e=t.documentElement,!e)throw Error(i(452));return e;case`head`:if(e=t.head,!e)throw Error(i(453));return e;case`body`:if(e=t.body,!e)throw Error(i(454));return e;default:throw Error(i(451))}}function gm(e,t,n){for(var r in n){var i=n[r];n.hasOwnProperty(r)&&i!=null&&ep(e,t,r,null,rp,i)}n.dangerouslySetInnerHTML!=null&&(e.textContent=``),e.onclick===gn&&(e.onclick=null),At(e)}function _m(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);At(e)}var vm=new Map,ym=new Set;function bm(e){if(typeof e.getRootNode==`function`){var t=e.getRootNode();if(t.nodeType===9||t.nodeType===11)return t}return e.nodeType===9?e:e.ownerDocument}var xm=F.d;F.d={f:Sm,r:Cm,D:Em,C:Dm,L:Om,m:km,X:jm,S:Am,M:Mm};function Sm(){var e=xm.f(),t=Ld();return e||t}function Cm(e){var t=Mt(e);t!==null&&t.tag===5&&t.type===`form`?Qs(t):xm.r(e)}var wm=typeof document>`u`?null:document;function Tm(e,t,n){var r=wm;if(r&&typeof t==`string`&&t){var i=en(t);i=`link[rel="`+e+`"][href="`+i+`"]`,typeof n==`string`&&(i+=`[crossorigin="`+n+`"]`),ym.has(i)||(ym.add(i),e={rel:e,crossOrigin:n,href:t},r.querySelector(i)===null&&(t=r.createElement(`link`),np(t,`link`,e),R(t),r.head.appendChild(t)))}}function Em(e){xm.D(e),Tm(`dns-prefetch`,e,null)}function Dm(e,t){xm.C(e,t),Tm(`preconnect`,e,t)}function Om(e,t,n){xm.L(e,t,n);var r=wm;if(r&&e&&t){var i=`link[rel="preload"][as="`+en(t)+`"]`;t===`image`&&n&&n.imageSrcSet?(i+=`[imagesrcset="`+en(n.imageSrcSet)+`"]`,typeof n.imageSizes==`string`&&(i+=`[imagesizes="`+en(n.imageSizes)+`"]`)):i+=`[href="`+en(e)+`"]`;var a=i;switch(t){case`style`:a=Pm(e);break;case`script`:a=Rm(e)}if(!(vm.has(a)||(e=T({rel:`preload`,href:t===`image`&&n&&n.imageSrcSet?void 0:e,as:t},n),vm.set(a,e),r.querySelector(i)!==null||t===`style`&&r.querySelector(Fm(a))||t===`script`&&r.querySelector(zm(a))))){var o=r.createElement(`link`);np(o,`link`,e),t===`style`&&(o[kt]=!0,o.onload=o.onerror=function(){Ft(o)}),R(o),r.head.appendChild(o)}}}function km(e,t){xm.m(e,t);var n=wm;if(n&&e){var r=t&&typeof t.as==`string`?t.as:`script`,i=`link[rel="modulepreload"][as="`+en(r)+`"][href="`+en(e)+`"]`,a=i;switch(r){case`audioworklet`:case`paintworklet`:case`serviceworker`:case`sharedworker`:case`worker`:case`script`:a=Rm(e)}if(!vm.has(a)&&(e=T({rel:`modulepreload`,href:e},t),vm.set(a,e),n.querySelector(i)===null)){switch(r){case`audioworklet`:case`paintworklet`:case`serviceworker`:case`sharedworker`:case`worker`:case`script`:if(n.querySelector(zm(a)))return}r=n.createElement(`link`),np(r,`link`,e),R(r),n.head.appendChild(r)}}}function Am(e,t,n){xm.S(e,t,n);var r=wm;if(r&&e){var i=Pt(r).hoistableStyles,a=Pm(e);t||=`default`;var o=i.get(a);if(!o){var s={loading:0,preload:null};if(o=r.querySelector(Fm(a)))s.loading=5;else{e=T({rel:`stylesheet`,href:e,"data-precedence":t},n),(n=vm.get(a))&&Hm(e,n);var c=o=r.createElement(`link`);R(c),np(c,`link`,e),c._p=new Promise(function(e,t){c.onload=e,c.onerror=t}),c.addEventListener(`load`,function(){s.loading|=1}),c.addEventListener(`error`,function(){s.loading|=2}),s.loading|=4,Vm(o,t,r)}o={type:`stylesheet`,instance:o,count:1,state:s},i.set(a,o)}}}function jm(e,t){xm.X(e,t);var n=wm;if(n&&e){var r=Pt(n).hoistableScripts,i=Rm(e),a=r.get(i);a||(a=n.querySelector(zm(i)),a||(e=T({src:e,async:!0},t),(t=vm.get(i))&&Um(e,t),a=n.createElement(`script`),R(a),np(a,`link`,e),n.head.appendChild(a)),a={type:`script`,instance:a,count:1,state:null},r.set(i,a))}}function Mm(e,t){xm.M(e,t);var n=wm;if(n&&e){var r=Pt(n).hoistableScripts,i=Rm(e),a=r.get(i);a||(a=n.querySelector(zm(i)),a||(e=T({src:e,async:!0,type:`module`},t),(t=vm.get(i))&&Um(e,t),a=n.createElement(`script`),R(a),np(a,`link`,e),n.head.appendChild(a)),a={type:`script`,instance:a,count:1,state:null},r.set(i,a))}}function Nm(e,t,n,r){var a=(a=Se.current)?bm(a):null;if(!a)throw Error(i(446));switch(e){case`meta`:case`title`:return null;case`style`:return typeof n.precedence==`string`&&typeof n.href==`string`?(n=Pm(n.href),t=Pt(a).hoistableStyles,r=t.get(n),r||(r={type:`style`,instance:null,count:0,state:null},t.set(n,r)),r):{type:`void`,instance:null,count:0,state:null};case`link`:if(n.rel===`stylesheet`&&typeof n.href==`string`&&typeof n.precedence==`string`){e=Pm(n.href);var o=Pt(a).hoistableStyles,s=o.get(e);if(s||(a=a.ownerDocument||a,s={type:`stylesheet`,instance:null,count:0,state:{loading:0,preload:null}},o.set(e,s),(o=a.querySelector(Fm(e)))?o._p||(s.instance=o,s.state.loading=5):(o=vm.get(e),o||(o={rel:`preload`,as:`style`,href:n.href,crossOrigin:n.crossOrigin,integrity:n.integrity,media:n.media,hrefLang:n.hrefLang,referrerPolicy:n.referrerPolicy},vm.set(e,o)),Lm(a,e,o,s.state))),t&&r===null)throw Error(i(528,``));return s}if(t&&r!==null)throw Error(i(529,``));return null;case`script`:return t=n.async,n=n.src,typeof n==`string`&&t&&typeof t!=`function`&&typeof t!=`symbol`?(n=Rm(n),t=Pt(a).hoistableScripts,r=t.get(n),r||(r={type:`script`,instance:null,count:0,state:null},t.set(n,r)),r):{type:`void`,instance:null,count:0,state:null};default:throw Error(i(444,e))}}function Pm(e){return`href="`+en(e)+`"`}function Fm(e){return`link[rel="stylesheet"][`+e+`]`}function Im(e){return T({},e,{"data-precedence":e.precedence,precedence:null})}function Lm(e,t,n,r){if(t=e.querySelector(`link[rel="preload"][as="style"][`+t+`]`)){if(!0!==t[kt]){r.loading=1;return}}else t=e.createElement(`link`),t[kt]=!0,t.onload=t.onerror=Ft.bind(null,t),np(t,`link`,n),R(t),e.head.appendChild(t);r.preload=t,t.addEventListener(`load`,function(){return r.loading|=1}),t.addEventListener(`error`,function(){return r.loading|=2})}function Rm(e){return`[src="`+en(e)+`"]`}function zm(e){return`script[async]`+e}function Bm(e,t,n){if(t.count++,t.instance===null)switch(t.type){case`style`:var r=e.querySelector(`style[data-href~="`+en(n.href)+`"]`);if(r)return t.instance=r,R(r),r;var a=T({},n,{"data-href":n.href,"data-precedence":n.precedence,href:null,precedence:null});return r=(e.ownerDocument||e).createElement(`style`),R(r),np(r,`style`,a),Vm(r,n.precedence,e),t.instance=r;case`stylesheet`:a=Pm(n.href);var o=e.querySelector(Fm(a));if(o)return t.state.loading|=4,t.instance=o,R(o),o;r=Im(n),(a=vm.get(a))&&Hm(r,a),o=(e.ownerDocument||e).createElement(`link`),R(o);var s=o;return s._p=new Promise(function(e,t){s.onload=e,s.onerror=t}),np(o,`link`,r),t.state.loading|=4,Vm(o,n.precedence,e),t.instance=o;case`script`:return o=Rm(n.src),(a=e.querySelector(zm(o)))?(t.instance=a,R(a),a):(r=n,(a=vm.get(o))&&(r=T({},n),Um(r,a)),e=e.ownerDocument||e,a=e.createElement(`script`),R(a),np(a,`link`,r),e.head.appendChild(a),t.instance=a);case`void`:return null;default:throw Error(i(443,t.type))}else t.type===`stylesheet`&&!(t.state.loading&4)&&(r=t.instance,t.state.loading|=4,Vm(r,n.precedence,e));return t.instance}function Vm(e,t,n){for(var r=n.querySelectorAll(`link[rel="stylesheet"][data-precedence],style[data-precedence]`),i=r.length?r[r.length-1]:null,a=i,o=0;o<r.length;o++){var s=r[o];if(s.dataset.precedence===t)a=s;else if(a!==i)break}a?a.parentNode.insertBefore(e,a.nextSibling):(t=n.nodeType===9?n.head:n,t.insertBefore(e,t.firstChild))}function Hm(e,t){e.crossOrigin??=t.crossOrigin,e.referrerPolicy??=t.referrerPolicy,e.title??=t.title}function Um(e,t){e.crossOrigin??=t.crossOrigin,e.referrerPolicy??=t.referrerPolicy,e.integrity??=t.integrity}var Wm=null;function Gm(e,t,n){if(Wm===null){var r=new Map,i=Wm=new Map;i.set(n,r)}else i=Wm,r=i.get(n),r||(r=new Map,i.set(n,r));if(r.has(e))return r;for(r.set(e,null),n=n.getElementsByTagName(e),i=0;i<n.length;i++){var a=n[i];if(!(a[Ot]||a[xt]||e===`link`&&a.getAttribute(`rel`)===`stylesheet`)&&a.namespaceURI!==`http://www.w3.org/2000/svg`){var o=a.getAttribute(t)||``;o=e+o;var s=r.get(o);s?s.push(a):r.set(o,[a])}}return r}function Km(e,t,n){e=e.ownerDocument||e,e.head.insertBefore(n,t===`title`?e.querySelector(`head > title`):null)}function qm(e,t,n){if(n===1||t.itemProp!=null)return!1;switch(e){case`meta`:case`title`:return!0;case`style`:if(typeof t.precedence!=`string`||typeof t.href!=`string`||t.href===``)break;return!0;case`link`:if(typeof t.rel!=`string`||typeof t.href!=`string`||t.href===``||t.onLoad||t.onError)break;switch(t.rel){case`stylesheet`:return e=t.disabled,typeof t.precedence==`string`&&e==null;default:return!0}case`script`:if(t.async&&typeof t.async!=`function`&&typeof t.async!=`symbol`&&!t.onLoad&&!t.onError&&t.src&&typeof t.src==`string`)return!0}return!1}function Jm(e,t){return e===`img`&&t.src!=null&&t.src!==``&&t.onLoad==null&&t.loading!==`lazy`}function Ym(e){return!(e.type===`stylesheet`&&!(e.state.loading&3))}function Xm(e){return(e.width||100)*(e.height||100)*(typeof devicePixelRatio==`number`?devicePixelRatio:1)*.25}function Zm(e,t){typeof t.decode==`function`&&(e.imgCount++,t.complete||(e.imgBytes+=Xm(t),e.suspenseyImages.push(t)),e=rh.bind(e),t.decode().then(e,e))}function Qm(e,t,n,r){if(n.type===`stylesheet`&&(typeof r.media!=`string`||!1!==matchMedia(r.media).matches)&&!(n.state.loading&4)){if(n.instance===null){var i=Pm(r.href),a=t.querySelector(Fm(i));if(a){t=a._p,typeof t==`object`&&t&&typeof t.then==`function`&&(e.count++,e=nh.bind(e),t.then(e,e)),n.state.loading|=4,n.instance=a,R(a);return}a=t.ownerDocument||t,r=Im(r),(i=vm.get(i))&&Hm(r,i),a=a.createElement(`link`),R(a);var o=a;o._p=new Promise(function(e,t){o.onload=e,o.onerror=t}),np(a,`link`,r),n.instance=a}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(n,t),(t=n.state.preload)&&!(n.state.loading&3)&&(e.count++,n=nh.bind(e),t.addEventListener(`load`,n),t.addEventListener(`error`,n))}}var $m=0;function eh(e,t){return e.stylesheets&&e.count===0&&ah(e,e.stylesheets),0<e.count||0<e.imgCount?function(n){var r=setTimeout(function(){if(e.stylesheets&&ah(e,e.stylesheets),e.unsuspend){var t=e.unsuspend;e.unsuspend=null,t()}},6e4+t);0<e.imgBytes&&$m===0&&($m=62500*op());var i=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&ah(e,e.stylesheets),e.unsuspend)){var t=e.unsuspend;e.unsuspend=null,t()}},(e.imgBytes>$m?50:800)+t);return e.unsuspend=n,function(){e.unsuspend=null,clearTimeout(r),clearTimeout(i)}}:null}function th(e){if(e.count===0&&(e.imgCount===0||!e.waitingForImages)){if(e.stylesheets)ah(e,e.stylesheets);else if(e.unsuspend){var t=e.unsuspend;e.unsuspend=null,t()}}}function nh(){this.count--,th(this)}function rh(){this.imgCount--,th(this)}var ih=null;function ah(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,ih=new Map,t.forEach(oh,e),ih=null,nh.call(e))}function oh(e,t){if(!(t.state.loading&4)){var n=ih.get(e);if(n)var r=n.get(null);else{n=new Map,ih.set(e,n);for(var i=e.querySelectorAll(`link[data-precedence],style[data-precedence]`),a=0;a<i.length;a++){var o=i[a];(o.nodeName===`LINK`||o.getAttribute(`media`)!==`not all`)&&(n.set(o.dataset.precedence,o),r=o)}r&&n.set(null,r)}i=t.instance,o=i.getAttribute(`data-precedence`),a=n.get(o)||r,a===r&&n.set(null,i),n.set(o,i),this.count++,r=nh.bind(this),i.addEventListener(`load`,r),i.addEventListener(`error`,r),a?a.parentNode.insertBefore(i,a.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(i,e.firstChild)),t.state.loading|=4}}var sh={$$typeof:ne,Provider:null,Consumer:null,_currentValue:he,_currentValue2:he,_threadCount:0};function ch(e,t,n,r,i,a,o,s,c){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=ut(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=ut(0),this.hiddenUpdates=ut(null),this.identifierPrefix=r,this.onUncaughtError=i,this.onCaughtError=a,this.onRecoverableError=o,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=c,this.transitionTypes=null,this.incompleteTransitions=new Map}function lh(e,t,n,r,i,a,o,s,c,l,u,d){return e=new ch(e,t,n,o,c,l,u,d,s),t=1,!0===a&&(t|=24),a=Oi(3,null,null,t),e.current=a,a.stateNode=e,t=Da(),t.refCount++,e.pooledCache=t,t.refCount++,a.memoizedState={element:r,isDehydrated:n,cache:t},co(a),e}function uh(e){return e?(e=Ei,e):Ei}function dh(e,t,n,r,i,a){i=uh(i),r.context===null?r.context=i:r.pendingContext=i,r=uo(t),r.payload={element:n},a=a===void 0?null:a,a!==null&&(r.callback=a),n=fo(e,r,t),n!==null&&(Md(n,e,t),po(n,e,t))}function fh(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function ph(e,t){fh(e,t),(e=e.alternate)&&fh(e,t)}function mh(e){if(e.tag===13||e.tag===31){var t=Ci(e,67108864);t!==null&&Md(t,e,67108864),ph(e,67108864)}}function hh(e){if(e.tag===13||e.tag===31){var t=kd();t=gt(t);var n=Ci(e,t);n!==null&&Md(n,e,t),ph(e,t)}}var gh=!0;function _h(e,t,n,r){var i=P.T;P.T=null;var a=F.p;try{F.p=2,yh(e,t,n,r)}finally{F.p=a,P.T=i}}function vh(e,t,n,r){var i=P.T;P.T=null;var a=F.p;try{F.p=8,yh(e,t,n,r)}finally{F.p=a,P.T=i}}function yh(e,t,n,r){if(gh){var i=bh(r);if(i===null)Gf(e,t,r,xh,n),Mh(e,r);else if(Ph(i,e,t,n,r))r.stopPropagation();else if(Mh(e,r),t&4&&-1<jh.indexOf(e)){for(;i!==null;){var a=Mt(i);if(a!==null)switch(a.tag){case 3:if(a=a.stateNode,a.current.memoizedState.isDehydrated){var o=it(a.pendingLanes);if(o!==0){var s=a;for(s.pendingLanes|=2,s.entangledLanes|=2;o;){var c=1<<31-Ze(o);s.entanglements[1]|=c,o&=~c}Tf(a),!(X&6)&&(md=Be()+500,Ef(0,!1))}}break;case 31:case 13:s=Ci(a,2),s!==null&&Md(s,a,2),Ld(),ph(a,2)}if(a=bh(r),a===null&&Gf(e,t,r,xh,n),a===i)break;i=a}i!==null&&r.stopPropagation()}else Gf(e,t,r,null,n)}}function bh(e){return e=vn(e),Sh(e)}var xh=null;function Sh(e){if(xh=null,e=jt(e),e!==null){var t=o(e);if(t===null)e=null;else{var n=t.tag;if(n===13){if(e=s(t),e!==null)return e;e=null}else if(n===31){if(e=c(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return xh=e,null}function Ch(e){switch(e){case`beforetoggle`:case`cancel`:case`click`:case`close`:case`contextmenu`:case`copy`:case`cut`:case`auxclick`:case`dblclick`:case`dragend`:case`dragstart`:case`drop`:case`focusin`:case`focusout`:case`input`:case`invalid`:case`keydown`:case`keypress`:case`keyup`:case`mousedown`:case`mouseup`:case`paste`:case`pause`:case`play`:case`pointercancel`:case`pointerdown`:case`pointerup`:case`ratechange`:case`reset`:case`seeked`:case`submit`:case`toggle`:case`touchcancel`:case`touchend`:case`touchstart`:case`volumechange`:case`change`:case`selectionchange`:case`textInput`:case`compositionstart`:case`compositionend`:case`compositionupdate`:case`beforeblur`:case`afterblur`:case`beforeinput`:case`blur`:case`fullscreenchange`:case`fullscreenerror`:case`focus`:case`hashchange`:case`popstate`:case`select`:case`selectstart`:return 2;case`drag`:case`dragenter`:case`dragexit`:case`dragleave`:case`dragover`:case`mousemove`:case`mouseout`:case`mouseover`:case`pointermove`:case`pointerout`:case`pointerover`:case`resize`:case`scroll`:case`touchmove`:case`wheel`:case`mouseenter`:case`mouseleave`:case`pointerenter`:case`pointerleave`:return 8;case`message`:switch(Ve()){case He:return 2;case Ue:return 8;case We:case Ge:return 32;case Ke:return 268435456;default:return 32}default:return 32}}var wh=!1,Th=null,Eh=null,Dh=null,Oh=new Map,kh=new Map,Ah=[],jh=`mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset`.split(` `);function Mh(e,t){switch(e){case`focusin`:case`focusout`:Th=null;break;case`dragenter`:case`dragleave`:Eh=null;break;case`mouseover`:case`mouseout`:Dh=null;break;case`pointerover`:case`pointerout`:Oh.delete(t.pointerId);break;case`gotpointercapture`:case`lostpointercapture`:kh.delete(t.pointerId)}}function Nh(e,t,n,r,i,a){return e===null||e.nativeEvent!==a?(e={blockedOn:t,domEventName:n,eventSystemFlags:r,nativeEvent:a,targetContainers:[i]},t!==null&&(t=Mt(t),t!==null&&mh(t)),e):(e.eventSystemFlags|=r,t=e.targetContainers,i!==null&&t.indexOf(i)===-1&&t.push(i),e)}function Ph(e,t,n,r,i){switch(t){case`focusin`:return Th=Nh(Th,e,t,n,r,i),!0;case`dragenter`:return Eh=Nh(Eh,e,t,n,r,i),!0;case`mouseover`:return Dh=Nh(Dh,e,t,n,r,i),!0;case`pointerover`:var a=i.pointerId;return Oh.set(a,Nh(Oh.get(a)||null,e,t,n,r,i)),!0;case`gotpointercapture`:return a=i.pointerId,kh.set(a,Nh(kh.get(a)||null,e,t,n,r,i)),!0}return!1}function Fh(e){var t=jt(e.target);if(t!==null){var n=o(t);if(n!==null){if(t=n.tag,t===13){if(t=s(n),t!==null){e.blockedOn=t,yt(e.priority,function(){hh(n)});return}}else if(t===31){if(t=c(n),t!==null){e.blockedOn=t,yt(e.priority,function(){hh(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function Ih(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=bh(e.nativeEvent);if(n===null){n=e.nativeEvent;var r=new n.constructor(n.type,n);_n=r,n.target.dispatchEvent(r),_n=null}else return t=Mt(n),t!==null&&mh(t),e.blockedOn=n,!1;t.shift()}return!0}function Lh(e,t,n){Ih(e)&&n.delete(t)}function Rh(){wh=!1,Th!==null&&Ih(Th)&&(Th=null),Eh!==null&&Ih(Eh)&&(Eh=null),Dh!==null&&Ih(Dh)&&(Dh=null),Oh.forEach(Lh),kh.forEach(Lh)}function zh(e,n){e.blockedOn===n&&(e.blockedOn=null,wh||(wh=!0,t.unstable_scheduleCallback(t.unstable_NormalPriority,Rh)))}var Bh=null;function Vh(e){Bh!==e&&(Bh=e,t.unstable_scheduleCallback(t.unstable_NormalPriority,function(){Bh===e&&(Bh=null);for(var t=0;t<e.length;t+=3){var n=e[t],r=e[t+1],i=e[t+2];if(typeof r!=`function`){if(Sh(r||n)===null)continue;break}var a=Mt(n);a!==null&&(e.splice(t,3),t-=3,Xs(a,{pending:!0,data:i,method:n.method,action:r},r,i))}}))}function Hh(e){function t(t){return zh(t,e)}Th!==null&&zh(Th,e),Eh!==null&&zh(Eh,e),Dh!==null&&zh(Dh,e),Oh.forEach(t),kh.forEach(t);for(var n=0;n<Ah.length;n++){var r=Ah[n];r.blockedOn===e&&(r.blockedOn=null)}for(;0<Ah.length&&(n=Ah[0],n.blockedOn===null);)Fh(n),n.blockedOn===null&&Ah.shift();if(n=(e.ownerDocument||e).$$reactFormReplay,n!=null)for(r=0;r<n.length;r+=3){var i=n[r],a=n[r+1],o=i[St]||null;if(typeof a==`function`)o||Vh(n);else if(o){var s=null;if(a&&a.hasAttribute(`formAction`)){if(i=a,o=a[St]||null)s=o.formAction;else if(Sh(i)!==null)continue}else s=o.action;typeof s==`function`?n[r+1]=s:(n.splice(r,3),r-=3),Vh(n)}}}function Uh(){function e(e){e.canIntercept&&e.info===`react-transition`&&e.intercept({handler:function(){return new Promise(function(e){return i=e})},focusReset:`manual`,scroll:`manual`})}function t(){i!==null&&(i(),i=null),r||setTimeout(n,20)}function n(){if(!r&&!navigation.transition){var e=navigation.currentEntry;e&&e.url!=null&&navigation.navigate(e.url,{state:e.getState(),info:`react-transition`,history:`replace`})}}if(typeof navigation==`object`){var r=!1,i=null;return navigation.addEventListener(`navigate`,e),navigation.addEventListener(`navigatesuccess`,t),navigation.addEventListener(`navigateerror`,t),setTimeout(n,100),function(){r=!0,navigation.removeEventListener(`navigate`,e),navigation.removeEventListener(`navigatesuccess`,t),navigation.removeEventListener(`navigateerror`,t),i!==null&&(i(),i=null)}}}function Wh(e){this._internalRoot=e}Gh.prototype.render=Wh.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(i(409));var n=t.current;dh(n,kd(),e,t,null,null)},Gh.prototype.unmount=Wh.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;dh(e.current,2,null,e,null,null),Ld(),t[Ct]=null}};function Gh(e){this._internalRoot=e}Gh.prototype.unstable_scheduleHydration=function(e){if(e){var t=vt();e={blockedOn:null,target:e,priority:t};for(var n=0;n<Ah.length&&t!==0&&t<Ah[n].priority;n++);Ah.splice(n,0,e),n===0&&Fh(e)}};var Kh=n.version;if(Kh!==`19.3.0`)throw Error(i(527,Kh,`19.3.0`));F.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render==`function`?Error(i(188)):(e=Object.keys(e).join(`,`),Error(i(268,e)));return e=d(t),e=e===null?null:f(e),e=e===null?null:e.stateNode,e};var qh={bundleType:0,version:`19.3.0`,rendererPackageName:`react-dom`,currentDispatcherRef:P,reconcilerVersion:`19.3.0`};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<`u`){var Jh=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Jh.isDisabled&&Jh.supportsFiber)try{Ye=Jh.inject(qh),L=Jh}catch{}}e.createRoot=function(e,t){if(!a(e))throw Error(i(299));var n=!1,r=``,o=yc,s=bc,c=xc;return t!=null&&(!0===t.unstable_strictMode&&(n=!0),t.identifierPrefix!==void 0&&(r=t.identifierPrefix),t.onUncaughtError!==void 0&&(o=t.onUncaughtError),t.onCaughtError!==void 0&&(s=t.onCaughtError),t.onRecoverableError!==void 0&&(c=t.onRecoverableError)),t=lh(e,1,!1,null,null,n,r,null,o,s,c,Uh),e[Ct]=t.current,Uf(e),new Wh(t)}})),zn=o(((e,t)=>{function n(){if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<`u`&&typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE==`function`)try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(e){console.error(e)}}n(),t.exports=Rn()}))();function Bn(){return window.location.hostname===`moogo.dev`||window.location.hostname.endsWith(`.moogo.dev`)}function Vn(){return Bn()?`${window.location.protocol}//api.moogo.dev`:window.location.origin}function Hn(){return Bn()?`${window.location.protocol}//app.moogo.dev`:window.location.origin}function Un(e=`/`){return!Bn()||window.location.hostname===`moogo.dev`?e:`https://moogo.dev${e}`}var Wn=o((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.fragment`);function r(e,n,r){var i=null;if(r!==void 0&&(i=``+r),n.key!==void 0&&(i=``+n.key),`key`in n)for(var a in r={},n)a!==`key`&&(r[a]=n[a]);else r=n;return n=r.ref,{$$typeof:t,type:e,key:i,ref:n===void 0?null:n,props:r}}e.Fragment=n,e.jsx=r,e.jsxs=r})),V=o(((e,t)=>{t.exports=Wn()}))();function Gn({children:e,className:t}){let n=Un(`/`);return n===`/`?(0,V.jsx)(B,{to:`/`,className:t,children:e}):(0,V.jsx)(`a`,{href:n,className:t,children:e})}function Kn(){return(0,V.jsxs)(Gn,{className:`inline-flex flex-none items-center`,children:[(0,V.jsx)(`img`,{src:`https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/1.png`,alt:`Moogo`,className:`h-[30px] w-auto brand-logo-light`,loading:`lazy`}),(0,V.jsx)(`img`,{src:`https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/2.png`,alt:`Moogo`,className:`h-[30px] w-auto brand-logo-dark`,loading:`lazy`})]})}var qn=`moogo-theme`,Jn=`theme-dark`,Yn=new Set;function Xn(){try{let e=window.localStorage.getItem(qn);return e===`light`||e===`dark`?e:null}catch{return null}}function Zn(){return document.documentElement.classList.contains(Jn)?`dark`:`light`}function Qn(e){document.documentElement.classList.toggle(Jn,e===`dark`);try{window.localStorage.setItem(qn,e)}catch{}for(let t of Yn)t(e);return e}function $n(){return Qn(Xn()??`light`)}function er(){return Qn(Zn()===`dark`?`light`:`dark`)}function tr(e){return Yn.add(e),()=>{Yn.delete(e)}}function nr({className:e=``}){let[t,n]=(0,h.useState)(()=>Zn());(0,h.useEffect)(()=>{let e=tr(n),t=e=>{e.key===`moogo-theme`&&n(Zn())};return window.addEventListener(`storage`,t),()=>{e(),window.removeEventListener(`storage`,t)}},[]);let r=t===`dark`?`light`:`dark`,i=(0,h.useCallback)(()=>{er()},[]);return(0,V.jsxs)(`button`,{type:`button`,onClick:i,"aria-label":`Switch to ${r} theme`,title:`Switch to ${r} theme`,className:`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edge px-3 py-1.5 text-[0.85rem] text-muted transition-colors hover:border-edge-strong hover:bg-panel hover:text-foreground ${e}`,children:[t===`dark`?(0,V.jsx)(rr,{}):(0,V.jsx)(ir,{}),(0,V.jsx)(`span`,{children:t===`dark`?`Light`:`Dark`})]})}function rr(){return(0,V.jsxs)(`svg`,{width:`15`,height:`15`,viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,"aria-hidden":`true`,children:[(0,V.jsx)(`circle`,{cx:`12`,cy:`12`,r:`4`}),(0,V.jsx)(`path`,{d:`M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4`})]})}function ir(){return(0,V.jsx)(`svg`,{width:`15`,height:`15`,viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:(0,V.jsx)(`path`,{d:`M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z`})})}var ar=class extends Error{status;code;detail;constructor(e,t,n=`unknown`,r=``){super(e),this.name=`ApiError`,this.status=t,this.code=n,this.detail=r}};async function H(e,t={}){let n;try{n=await fetch(e,{credentials:`same-origin`,...t,headers:{Accept:`application/json`,...t.body?{"Content-Type":`application/json`}:{},...t.headers}})}catch(e){throw new ar(`Cannot reach the server. Check that it is running, then try again.`,0,`network_error`,e instanceof Error?e.message:``)}if(!n.ok){let e=`http_error`,t=`request failed with ${n.status}`,r=``;try{let i=await n.json();e=i.error?.code??e,t=i.error?.message??t,r=i.error?.detail??``}catch{}throw new ar(t,n.status,e,r)}if(n.status!==204)return await n.json()}var U={session:()=>H(`/auth/session`),oauthSetup:()=>H(`/auth/setup`),me:()=>H(`/api/me`),changePassword:e=>H(`/api/account/password`,{method:`POST`,body:JSON.stringify(e)}),updateProfile:e=>H(`/api/account/profile`,{method:`PATCH`,body:JSON.stringify(e)}),projects:()=>H(`/api/projects`),createProject:e=>H(`/api/projects`,{method:`POST`,body:JSON.stringify({name:e})}),rotateKey:e=>H(`/api/projects/${e}/rotate-key`,{method:`POST`}),storageCredentials:e=>H(`/api/projects/${e}/storage-credentials`),createStorageCredential:(e,t)=>H(`/api/projects/${e}/storage-credentials`,{method:`POST`,body:JSON.stringify({label:t})}),rotateStorageCredential:(e,t)=>H(`/api/projects/${e}/storage-credentials/${t}/rotate`,{method:`POST`}),revokeStorageCredential:(e,t)=>H(`/api/projects/${e}/storage-credentials/${t}`,{method:`DELETE`}),pauseProject:e=>H(`/api/projects/${e}/pause`,{method:`POST`}),resumeProject:e=>H(`/api/projects/${e}/resume`,{method:`POST`}),deleteProject:e=>H(`/api/projects/${e}`,{method:`DELETE`}),databaseBackupUrl:e=>`/api/projects/${e}/database-backup`,logout:()=>H(`/auth/logout`,{method:`POST`}),login:(e,t)=>H(`/auth/login`,{method:`POST`,body:JSON.stringify({email:e,password:t})}),forgotPassword:e=>H(`/auth/forgot-password`,{method:`POST`,body:JSON.stringify({email:e})}),resetPassword:(e,t)=>H(`/auth/reset-password`,{method:`POST`,body:JSON.stringify({token:e,password:t})}),register:(e,t,n)=>H(`/auth/register`,{method:`POST`,body:JSON.stringify({email:e,name:t,password:n})}),verifyEmail:e=>H(`/auth/verify-email`,{method:`POST`,body:JSON.stringify({token:e})}),resendVerification:e=>H(`/auth/resend-verification`,{method:`POST`,body:JSON.stringify({email:e})}),consoleQuery:(e,t,n=[])=>H(`/api/projects/${e}/query`,{method:`POST`,body:JSON.stringify({query:t,args:n})}),consoleExec:(e,t,n=[])=>H(`/api/projects/${e}/exec`,{method:`POST`,body:JSON.stringify({query:t,args:n})}),dashboardBuckets:e=>H(`/api/projects/${e}/buckets`),dashboardCreateBucket:(e,t,n={})=>H(`/api/projects/${e}/buckets`,{method:`POST`,body:JSON.stringify({name:t,...n})}),dashboardUpdateBucketSettings:(e,t,n)=>H(`/api/projects/${e}/buckets/${t}`,{method:`PATCH`,body:JSON.stringify(n)}),dashboardDeleteBucket:(e,t)=>H(`/api/projects/${e}/buckets/${t}`,{method:`DELETE`}),dashboardSetBucketPublic:(e,t,n)=>H(`/api/projects/${e}/buckets/${t}/public`,{method:`POST`,body:JSON.stringify({is_public:n})}),dashboardBucketList:(e,t={})=>H(`/api/projects/${e}/bucket${sr(t)}`),dashboardBucketUpload:(e,t,n,r,i)=>H(`/api/projects/${e}/bucket/${or(t)}${sr({bucket:i})}`,{method:`POST`,headers:{"Content-Type":r},body:n}),dashboardBucketDelete:(e,t,n=!1)=>H(`/api/projects/${e}/bucket/${or(t)}${sr(n?{prefix:`true`}:{})}`,{method:`DELETE`}),dashboardSetObjectPublic:(e,t,n)=>H(`/api/projects/${e}/bucket/${or(t)}`,{method:`PATCH`,body:JSON.stringify({is_public:n})}),dashboardRenameObject:(e,t,n)=>H(`/api/projects/${e}/bucket/${or(t)}`,{method:`PATCH`,body:JSON.stringify({new_key:n})})};function or(e){return e.split(`/`).map(encodeURIComponent).join(`/`)}function sr(e){let t=new URLSearchParams;for(let[n,r]of Object.entries(e))r!=null&&r!==``&&t.set(n,String(r));let n=t.toString();return n?`?${n}`:``}function cr(e){let t=e.content_type.split(`;`)[0].trim().toLowerCase();if(t.startsWith(`image/`))return`IMG`;if(t.startsWith(`video/`))return`VID`;if(t.startsWith(`audio/`))return`AUD`;if(t===`application/pdf`)return`PDF`;if(t===`application/json`)return`JSON`;if(t===`text/csv`)return`CSV`;if(t===`text/markdown`)return`MD`;if(t.startsWith(`text/`))return`TXT`;let n=e.key.split(`.`).pop();return n&&n!==e.key&&n.length<=5?n.toUpperCase():`BIN`}function lr(e){if(!e)return`0 B`;let t=e/1048576;return t>=1?`${t.toFixed(1)} MB`:`${Math.round(e/1024)} KB`}var ur=new Set([`SELECT`,`VALUES`,`PRAGMA`,`EXPLAIN`]),dr=new Set([`INSERT`,`UPDATE`,`DELETE`,`REPLACE`,`CREATE`,`ALTER`,`DROP`,`TRUNCATE`,`ATTACH`,`DETACH`,`VACUUM`,`REINDEX`,`ANALYZE`,`BEGIN`,`COMMIT`,`ROLLBACK`,`SAVEPOINT`,`RELEASE`,`GRANT`,`REVOKE`]);function fr(e){return e>=`a`&&e<=`z`||e>=`A`&&e<=`Z`||e>=`0`&&e<=`9`||e===`_`||e===`$`}function pr(e,t){let n=t;for(;n<e.length;){let t=e[n];if(/\s/.test(t)){n++;continue}if(e.startsWith(`--`,n)){let t=e.indexOf(`
`,n);n=t===-1?e.length:t+1;continue}if(e.startsWith(`/*`,n)){let t=e.indexOf(`*/`,n+2);n=t===-1?e.length:t+2;continue}break}return n}function mr(e){let t=pr(e,0),n=t;for(;n<e.length&&fr(e[n]);)n++;return e.slice(t,n).toUpperCase()}function hr(e){let t=pr(e,0);for(;t<e.length&&fr(e[t]);)t++;t=pr(e,t);let n=0;for(;t<e.length;){let r=e[t];if(r===`(`){n++,t++;continue}if(r===`)`){n=Math.max(0,n-1),t++;continue}if(r===`;`&&n===0)return!1;if(fr(r)){let r=t;for(;t<e.length&&fr(e[t]);)t++;if(n===0){let n=e.slice(r,t).toUpperCase();if(ur.has(n))return!0;if(dr.has(n))return!1}continue}t++}return!1}function gr(e){let t=mr(e);return ur.has(t)?!0:t===`WITH`&&hr(e)}function _r(){let e=it(),[t,n]=(0,h.useState)(null),[r,i]=(0,h.useState)(!0);(0,h.useEffect)(()=>{let e=!1;return U.me().then(t=>{e||n(t)}).catch(e=>{e instanceof ar&&e.status===401&&window.location.assign(`/login`)}).finally(()=>{e||i(!1)}),()=>{e=!0}},[]);let a=e.pathname.match(/^\/app\/projects\/([^/]+)/),o=a?a[1]:null;return(0,V.jsxs)(`div`,{className:`console min-h-screen bg-background text-foreground`,children:[(0,V.jsxs)(`aside`,{className:`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-edge bg-background-alt`,children:[(0,V.jsx)(`div`,{className:`flex h-14 items-center border-b border-edge px-4`,children:(0,V.jsx)(Kn,{})}),(0,V.jsxs)(`nav`,{className:`flex-1 overflow-y-auto px-2 py-3`,"aria-label":`Main`,children:[(0,V.jsx)(vr,{to:`/app`,active:e.pathname===`/app`,icon:(0,V.jsx)(br,{}),children:`Dashboard`}),(0,V.jsx)(vr,{to:`/app/projects`,active:e.pathname===`/app/projects`||!!o,icon:(0,V.jsx)(xr,{}),children:`Project`}),(0,V.jsx)(vr,{to:`/app/settings`,active:e.pathname===`/app/settings`,icon:(0,V.jsx)(Sr,{}),children:`Settings`}),(0,V.jsx)(vr,{to:`/plan`,active:e.pathname===`/plan`,icon:(0,V.jsx)(Cr,{}),children:`Pricing`}),(0,V.jsx)(vr,{to:`/docs/quickstart`,active:e.pathname.startsWith(`/docs`),icon:(0,V.jsx)(wr,{}),children:`Docs`}),o&&(0,V.jsxs)(`div`,{className:`mt-4`,children:[(0,V.jsx)(`p`,{className:`px-3 pb-1 text-[0.7rem] font-bold uppercase tracking-wider text-faint`,children:`This project`}),(0,V.jsx)(vr,{to:`/app/projects/${o}/database`,active:e.pathname.includes(`/database`)&&!e.search.includes(`tab=visual`),icon:(0,V.jsx)(Tr,{}),children:`Database`}),(0,V.jsx)(vr,{to:`/app/projects/${o}/database?tab=visual`,active:e.pathname.includes(`/database`)&&e.search.includes(`tab=visual`),icon:(0,V.jsx)(Er,{}),children:`Visual`}),(0,V.jsx)(vr,{to:`/app/projects/${o}/bucket`,active:e.pathname.includes(`/bucket`),icon:(0,V.jsx)(Dr,{}),children:`Bucket`}),(0,V.jsx)(vr,{to:`/app/projects/${o}/settings`,active:e.pathname===`/app/projects/${o}/settings`,icon:(0,V.jsx)(Sr,{}),children:`Settings`})]})]}),(0,V.jsxs)(`div`,{className:`border-t border-edge p-2`,children:[(0,V.jsx)(`div`,{className:`px-1 pb-2`,children:(0,V.jsx)(nr,{className:`w-full justify-center`})}),(0,V.jsx)(yr,{me:t})]})]}),(0,V.jsx)(`main`,{className:`ml-60 min-h-screen`,children:r?(0,V.jsx)(`div`,{className:`flex h-screen items-center justify-center`,children:(0,V.jsx)(`div`,{className:`h-6 w-6 animate-spin rounded-full border-2 border-accent-strong border-t-transparent`})}):(0,V.jsx)(Pt,{})})]})}function vr({to:e,active:t,icon:n,children:r}){return(0,V.jsxs)(B,{to:e,"aria-current":t?`page`:void 0,className:`flex items-center gap-2.5 rounded-md px-3 py-2 text-[0.86rem] transition-colors ${t?`bg-panel text-accent-strong font-medium`:`text-muted hover:bg-hover-bg hover:text-foreground`}`,children:[(0,V.jsx)(`span`,{className:t?`text-accent-strong [&>svg]:h-5 [&>svg]:w-5`:`text-current [&>svg]:h-5 [&>svg]:w-5`,children:n}),r]})}function yr({me:e}){let t=e?.user.name?.charAt(0).toUpperCase()??e?.user.email?.charAt(0).toUpperCase()??`U`;async function n(){try{await U.logout()}finally{window.location.assign(`/`)}}return(0,V.jsxs)(`div`,{className:`flex items-center gap-2.5 rounded-md px-2 py-1.5`,children:[(0,V.jsx)(`span`,{className:`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-panel-raised text-[0.78rem] font-semibold text-muted`,children:t}),(0,V.jsxs)(`div`,{className:`min-w-0 flex-1`,children:[(0,V.jsx)(`p`,{className:`truncate text-[0.82rem] font-medium text-foreground`,children:e?.user.name??`User`}),(0,V.jsx)(`p`,{className:`truncate text-[0.72rem] text-faint`,children:e?.user.email})]}),(0,V.jsx)(`button`,{type:`button`,onClick:n,className:`flex-shrink-0 cursor-pointer rounded px-1.5 py-1 text-[0.72rem] text-muted transition-colors hover:text-foreground`,children:`Sign out`})]})}function br(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,children:[(0,V.jsx)(`rect`,{x:`3`,y:`3`,width:`7`,height:`7`,rx:`1`}),(0,V.jsx)(`rect`,{x:`14`,y:`3`,width:`7`,height:`7`,rx:`1`}),(0,V.jsx)(`rect`,{x:`3`,y:`14`,width:`7`,height:`7`,rx:`1`}),(0,V.jsx)(`rect`,{x:`14`,y:`14`,width:`7`,height:`7`,rx:`1`})]})}function xr(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,children:[(0,V.jsx)(`path`,{d:`M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z`}),(0,V.jsx)(`line`,{x1:`10`,y1:`10`,x2:`14`,y2:`10`}),(0,V.jsx)(`line`,{x1:`10`,y1:`14`,x2:`14`,y2:`14`})]})}function Sr(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,children:[(0,V.jsx)(`circle`,{cx:`12`,cy:`12`,r:`3`}),(0,V.jsx)(`path`,{d:`M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4`})]})}function Cr(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,children:[(0,V.jsx)(`rect`,{x:`2`,y:`4`,width:`20`,height:`16`,rx:`2`}),(0,V.jsx)(`line`,{x1:`6`,y1:`10`,x2:`18`,y2:`10`}),(0,V.jsx)(`line`,{x1:`6`,y1:`14`,x2:`18`,y2:`14`})]})}function wr(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,children:[(0,V.jsx)(`path`,{d:`M18 3H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z`}),(0,V.jsx)(`polyline`,{points:`14 3 14 9 20 9`})]})}function Tr(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,children:[(0,V.jsx)(`ellipse`,{cx:`12`,cy:`5`,rx:`9`,ry:`3`}),(0,V.jsx)(`path`,{d:`M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5`}),(0,V.jsx)(`path`,{d:`M3 12c0 1.66 4 3 9 3s9-1.34 9-3`})]})}function Er(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,children:[(0,V.jsx)(`circle`,{cx:`5.5`,cy:`6`,r:`2.5`}),(0,V.jsx)(`circle`,{cx:`18.5`,cy:`6`,r:`2.5`}),(0,V.jsx)(`circle`,{cx:`12`,cy:`18`,r:`2.5`}),(0,V.jsx)(`path`,{d:`M8 6h8M7 8l3.5 8M17 8l-3.5 8`})]})}function Dr(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,children:[(0,V.jsx)(`path`,{d:`M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z`}),(0,V.jsx)(`line`,{x1:`8`,y1:`10`,x2:`16`,y2:`10`}),(0,V.jsx)(`line`,{x1:`8`,y1:`14`,x2:`16`,y2:`14`})]})}function Or({children:e,className:t,onClick:n}){let r=`${Hn()}/app`;return r===`${window.location.origin}/app`?(0,V.jsx)(B,{to:`/app`,className:t,onClick:n,children:e}):(0,V.jsx)(`a`,{href:r,className:t,onClick:n,children:e})}var kr=null,Ar=null;function jr(){return kr||=U.session().catch(e=>{throw kr=null,e}),kr}function Mr(e){return e.authenticated?{status:`authenticated`,email:e.email??``,oauthConfigured:e.oauth_configured}:{status:`anonymous`,oauthConfigured:e.oauth_configured}}function Nr(){let[e,t]=(0,h.useState)(()=>Ar?Mr(Ar):{status:`loading`,oauthConfigured:!1});return(0,h.useEffect)(()=>{let e=!1;return jr().then(n=>{Ar=n,e||t(Mr(n))}).catch(n=>{e||t({status:`unknown`,error:n instanceof Error?n.message:``,oauthConfigured:!1})}),()=>{e=!0}},[]),e}function Pr({children:e}){return(0,V.jsxs)(`div`,{className:`flex min-h-screen flex-col`,children:[(0,V.jsx)(Fr,{}),(0,V.jsx)(Rr,{}),(0,V.jsx)(`main`,{className:`flex-1`,children:e}),(0,V.jsx)(Br,{})]})}function Fr(){return(0,V.jsx)(`div`,{className:`border-b border-amber/30 bg-amber/10`,children:(0,V.jsxs)(`div`,{className:`mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-6 py-2 text-center text-[0.84rem] text-muted`,children:[(0,V.jsxs)(`span`,{children:[`moogo.dev is still in development — usable for testing,`,` `,(0,V.jsx)(`span`,{className:`font-medium text-foreground`,children:`not ready for production`}),`.`]}),(0,V.jsx)(B,{to:`/announcement`,className:`font-medium text-amber underline-offset-4 hover:underline`,children:`Read more`})]})})}var Ir=[{label:`Features`,to:`/#features`},{label:`SQL API`,to:`/docs/sql-api`},{label:`Storage`,to:`/docs/object-storage`},{label:`Pricing`,to:`/plan`},{label:`Docs`,to:`/docs/quickstart`}],Lr=[`/login`,`/register`,`/forgot-password`,`/reset-password`,`/verify-email`];function Rr(){let e=it(),t=Lr.includes(e.pathname),n=Nr(),[r,i]=(0,h.useState)(!1),a=n.status===`authenticated`,o=()=>i(!1);return(0,V.jsxs)(`header`,{className:`sticky top-0 z-50 border-b border-edge bg-background/80 backdrop-blur-md`,children:[(0,V.jsxs)(`div`,{className:`mx-auto flex h-[66px] w-full max-w-[1120px] items-center gap-7 px-6`,children:[(0,V.jsx)(Kn,{}),(0,V.jsx)(`nav`,{"aria-label":`Main`,className:`ml-auto hidden gap-6 text-[0.92rem] text-muted md:flex`,children:Ir.map(e=>e.to.startsWith(`/#`)?(0,V.jsx)(`a`,{className:`hover:text-foreground`,href:Un(e.to),children:e.label},e.label):(0,V.jsx)(B,{className:`hover:text-foreground`,to:e.to,children:e.label},e.label))}),(0,V.jsx)(`button`,{type:`button`,className:`ml-auto inline-flex items-center justify-center rounded-md p-2 text-muted transition-colors hover:bg-hover-bg hover:text-foreground md:hidden`,onClick:()=>i(!r),"aria-expanded":r,"aria-controls":`mobile-menu`,"aria-label":r?`Close menu`:`Open menu`,children:r?(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,className:`h-6 w-6`,children:[(0,V.jsx)(`line`,{x1:`18`,y1:`6`,x2:`6`,y2:`18`}),(0,V.jsx)(`line`,{x1:`6`,y1:`6`,x2:`18`,y2:`18`})]}):(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,className:`h-6 w-6`,children:[(0,V.jsx)(`line`,{x1:`3`,y1:`12`,x2:`21`,y2:`12`}),(0,V.jsx)(`line`,{x1:`3`,y1:`6`,x2:`21`,y2:`6`}),(0,V.jsx)(`line`,{x1:`3`,y1:`18`,x2:`21`,y2:`18`})]})}),t||n.status===`loading`||n.status===`unknown`?null:a?(0,V.jsx)(Or,{className:`hidden items-center justify-center rounded-lg bg-accent-strong px-4 py-2 text-[0.88rem] font-semibold text-accent-ink transition-colors hover:bg-accent md:inline-flex`,children:`Open dashboard`}):(0,V.jsx)(B,{to:`/login`,className:`hidden items-center justify-center rounded-lg bg-accent-strong px-4 py-2 text-[0.88rem] font-semibold text-accent-ink transition-colors hover:bg-accent md:inline-flex`,children:`Sign in`})]}),r&&(0,V.jsx)(`div`,{id:`mobile-menu`,className:`md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm animate-slide-down`,onClick:o,children:(0,V.jsx)(`div`,{className:`flex flex-col items-center justify-center min-h-screen gap-8 px-6 pt-20`,children:(0,V.jsxs)(`nav`,{className:`flex flex-col items-center gap-6 text-center`,"aria-label":`Mobile main`,children:[Ir.map(e=>e.to.startsWith(`/#`)?(0,V.jsx)(`a`,{className:`text-xl font-medium text-foreground hover:text-accent-strong transition-colors`,href:e.to,onClick:o,children:e.label},e.label):(0,V.jsx)(B,{className:`text-xl font-medium text-foreground hover:text-accent-strong transition-colors`,to:e.to,onClick:o,children:e.label},e.label)),a?(0,V.jsx)(Or,{className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-6 py-3 text-lg font-semibold text-accent-ink transition-colors hover:bg-accent w-64`,onClick:o,children:`Open dashboard`}):(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(B,{to:`/login`,className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-6 py-3 text-lg font-semibold text-accent-ink transition-colors hover:bg-accent w-64`,onClick:o,children:`Sign in`}),(0,V.jsx)(B,{to:`/register`,className:`inline-flex items-center justify-center rounded-lg border border-edge-strong px-6 py-3 text-lg font-semibold text-muted hover:border-hover-edge hover:bg-hover-bg hover:text-foreground transition-colors w-64`,onClick:o,children:`Sign up`})]})]})})})]})}var zr=[{title:`Product`,links:[{label:`What is Moogo`,to:`/docs/what-is-moogo`},{label:`Why Moogo`,to:`/docs/why-moogo`},{label:`Comparison`,to:`/docs/comparison`},{label:`Pricing`,to:`/plan`},{label:`Limits`,to:`/#limits`}]},{title:`Documentation`,links:[{label:`Quickstart`,to:`/docs/quickstart`},{label:`SQL API`,to:`/docs/sql-api`},{label:`Object storage`,to:`/docs/object-storage`},{label:`Dashboard`,to:`/docs/dashboard`},{label:`All pages`,to:`/docs`}]},{title:`Using Moogo`,links:[{label:`Register`,to:`/register`},{label:`Create a project`,to:`/docs/create-project`},{label:`Create a bucket`,to:`/docs/create-bucket`},{label:`Credentials`,to:`/docs/credentials`},{label:`Sign in`,to:`/login`}]},{title:`Reference`,links:[{label:`Security`,to:`/docs/security`},{label:`Errors`,to:`/docs/errors`},{label:`Troubleshooting`,to:`/docs/errors#common-problems`},{label:`Feedback`,to:`/docs/feedback`},{label:`GitHub`,to:`https://github.com/moogodev/moogodev`}]}];function Br(){return(0,V.jsx)(`footer`,{className:`mt-auto border-t border-edge bg-background-alt`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:[(0,V.jsxs)(`div`,{className:`grid gap-10 py-14 lg:grid-cols-[1.25fr_2.75fr] lg:gap-16`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(Kn,{}),(0,V.jsx)(`p`,{className:`mt-4 max-w-[34ch] text-[0.9rem] leading-relaxed text-muted`,children:`A hosted SQLite database and object storage for serverless apps. One file per project, SQL over HTTP, no connection string and no driver.`}),(0,V.jsxs)(`div`,{className:`mt-6 flex flex-wrap gap-2`,children:[(0,V.jsx)(B,{to:`/register`,className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-4 py-2 text-[0.86rem] font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Create a project`}),(0,V.jsx)(B,{to:`/docs/quickstart`,className:`inline-flex items-center justify-center rounded-lg border border-edge-strong px-4 py-2 text-[0.86rem] font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Read the docs`})]}),(0,V.jsxs)(`ul`,{className:`mt-7 flex flex-col gap-2 text-[0.87rem] text-muted`,children:[(0,V.jsxs)(`li`,{children:[(0,V.jsx)(`span`,{className:`text-faint`,children:`Database`}),` · 100 MB of SQLite per project`]}),(0,V.jsxs)(`li`,{children:[(0,V.jsx)(`span`,{className:`text-faint`,children:`Storage`}),` · 256 MB per project`]}),(0,V.jsxs)(`li`,{children:[(0,V.jsx)(`span`,{className:`text-faint`,children:`Price`}),` · free, no card`]})]})]}),(0,V.jsx)(`div`,{className:`grid gap-8 sm:grid-cols-2 lg:grid-cols-4`,children:zr.map(e=>(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`h2`,{className:`mb-3.5 text-[0.74rem] font-semibold uppercase tracking-[0.12em] text-faint`,children:e.title}),(0,V.jsx)(`ul`,{className:`flex flex-col gap-2.5`,children:e.links.map(e=>(0,V.jsx)(`li`,{children:e.to.startsWith(`http`)?(0,V.jsx)(`a`,{href:e.to,target:`_blank`,rel:`noopener noreferrer`,className:`text-[0.88rem] text-muted transition-colors hover:text-foreground`,children:e.label}):(0,V.jsx)(B,{to:e.to,className:`text-[0.88rem] text-muted transition-colors hover:text-foreground`,children:e.label})},e.label))})]},e.title))})]}),(0,V.jsxs)(`div`,{className:`flex flex-col-reverse items-start justify-between gap-4 border-t border-edge py-6 sm:flex-row sm:items-center`,children:[(0,V.jsx)(`p`,{className:`text-[0.85rem] text-faint`,children:`Moogo — SQLite over HTTP. Built with Go.`}),(0,V.jsx)(nr,{})]})]})})}function Vr(){return(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[720px] px-6`,children:[(0,V.jsx)(`p`,{className:`mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`Announcement`}),(0,V.jsx)(`h1`,{className:`mb-3 text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tight`,children:`Moogo is still in development`}),(0,V.jsx)(`p`,{className:`mx-auto mb-9 max-w-[46em] text-center text-muted`,children:`moogo.dev is under active development and testing. You are welcome to try it, build on it, and tell us what is wrong — but it is not ready for production, and nothing here should carry data you cannot afford to lose.`}),(0,V.jsxs)(`div`,{className:`grid gap-5 sm:grid-cols-2`,children:[(0,V.jsx)(Hr,{title:`Development and testing`,children:`The core works today: create a project, run SQL over the HTTP API, store objects in a bucket. Underneath, the platform is still being built and tested. Expect rough edges, breaking changes, and the occasional bug — that is what this stage is for.`}),(0,V.jsx)(Hr,{title:`Not ready for production`,children:`No uptime or durability promises are made yet. Use test data, not real data, and keep your own copies of anything that matters. When Moogo is ready for production workloads, this notice will say so.`}),(0,V.jsx)(Hr,{title:`Feedback and criticism`,children:`Criticism, suggestions, bug reports, and ideas are all welcome — the harsh ones included. Every message is read, and what makes sense is taken into account. Nothing here is too small to mention.`}),(0,V.jsx)(Hr,{title:`Join, sponsor, or fund`,children:`Want to join the effort, contribute code, sponsor the project, or fund its development? All of it is accepted. If you believe in a free, open platform for SQL and object storage, we would like to hear from you.`}),(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6 text-center sm:col-span-2`,children:[(0,V.jsx)(`h2`,{className:`mb-2 text-[1.05rem] font-semibold`,children:`Contact`}),(0,V.jsx)(`p`,{className:`mx-auto mb-5 max-w-[42em] text-[0.93rem] leading-relaxed text-muted`,children:`Questions, feedback, bug reports, or offers to help — send them all to the address below. Every message gets a reply.`}),(0,V.jsx)(`a`,{href:`mailto:moogodev@gmail.com`,className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-2.5 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`moogodev@gmail.com`})]})]}),(0,V.jsx)(`p`,{className:`mt-8 text-center text-[0.85rem] text-faint`,children:`This page is updated as Moogo moves closer to production.`})]})})})}function Hr({title:e,children:t}){return(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6`,children:[(0,V.jsx)(`h2`,{className:`mb-2 text-[1.05rem] font-semibold`,children:e}),(0,V.jsx)(`p`,{className:`text-[0.93rem] leading-relaxed text-muted`,children:t})]})}var Ur=[{date:`Oct 2026`,title:`Spreadsheet-style table editor with inline editing`,href:`https://news.moogo.dev/spreadsheet-table-editor`},{date:`Oct 2026`,title:`Per-project buckets with a 256 MB quota`,href:`https://news.moogo.dev/per-project-buckets`},{date:`Sep 2026`,title:`Email and password sign-in with password reset`,href:`https://news.moogo.dev/email-password-signin`}];function Wr(){let[e,t]=(0,h.useState)(null),[n,r]=(0,h.useState)([]),[i,a]=(0,h.useState)(!0),[o,s]=(0,h.useState)(null);(0,h.useEffect)(()=>{let e=!1;async function n(){try{let[n,i]=await Promise.all([U.me(),U.projects()]);if(e)return;t(n),r(i.projects)}catch(t){e||s(t instanceof ar?t.message:`Could not load your account.`)}finally{e||a(!1)}}return n(),()=>{e=!0}},[]);let c=n.slice(0,4);return(0,V.jsxs)(`div`,{className:`page-shell`,children:[(0,V.jsx)(`h1`,{className:`text-xl font-semibold tracking-tight`,children:`Dashboard`}),(0,V.jsx)(`p`,{className:`mt-0.5 text-[0.85rem] text-muted`,children:e?e.user.email:` `}),o&&(0,V.jsx)(`div`,{role:`alert`,className:`mt-4 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber`,children:o}),(0,V.jsxs)(`dl`,{className:`mt-6 grid grid-cols-1 divide-y divide-edge border-y border-edge sm:grid-cols-3 sm:divide-x sm:divide-y-0`,children:[(0,V.jsx)(Gr,{label:`Projects`,value:i?`—`:`${e?.usage.project_count??0} / ${e?.max_projects??2}`,hint:`Free plan`}),(0,V.jsx)(Gr,{label:`Database in use`,value:i?`—`:lr(e?.usage.database_bytes??0),hint:i?``:`${lr(e?.max_db_bytes??0)} allowed per project`}),(0,V.jsx)(Gr,{label:`Plan`,value:`Free`,hint:`No billing, nothing expires`})]}),(0,V.jsxs)(`div`,{className:`mt-8 grid gap-10 md:grid-cols-2`,children:[(0,V.jsxs)(`section`,{children:[(0,V.jsxs)(`div`,{className:`mb-3 flex items-center justify-between`,children:[(0,V.jsx)(`h2`,{className:`text-[0.9rem] font-semibold`,children:`Recent projects`}),(0,V.jsx)(B,{to:`/app/projects`,className:`text-[0.8rem] text-accent hover:underline`,children:`View all`})]}),i?(0,V.jsx)(`p`,{className:`text-[0.85rem] text-faint`,children:`Loading…`}):c.length===0?(0,V.jsxs)(`p`,{className:`text-[0.85rem] text-muted`,children:[`No projects yet.`,` `,(0,V.jsx)(B,{to:`/app/projects`,className:`text-accent hover:underline`,children:`Create one`}),`.`]}):(0,V.jsx)(`ul`,{className:`border-t border-edge`,children:c.map(e=>(0,V.jsx)(`li`,{className:`border-b border-edge`,children:(0,V.jsxs)(B,{to:`/app/projects/${e.id}/database`,className:`flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-accent`,children:[(0,V.jsxs)(`span`,{className:`min-w-0`,children:[(0,V.jsx)(`span`,{className:`block truncate text-[0.86rem] font-medium`,children:e.name}),(0,V.jsx)(`span`,{className:`block font-mono text-[0.72rem] text-faint`,children:e.id})]}),(0,V.jsx)(`span`,{className:`flex-shrink-0 text-[0.78rem] text-muted`,children:lr(e.database_bytes)})]})},e.id))})]}),(0,V.jsxs)(`section`,{children:[(0,V.jsxs)(`div`,{className:`mb-3 flex items-center justify-between`,children:[(0,V.jsx)(`h2`,{className:`text-[0.9rem] font-semibold`,children:`What's new`}),(0,V.jsx)(`a`,{href:`https://news.moogo.dev`,className:`text-[0.8rem] text-accent hover:underline`,children:`See all`})]}),(0,V.jsx)(`ul`,{className:`border-t border-edge`,children:Ur.map(e=>(0,V.jsx)(`li`,{className:`border-b border-edge`,children:(0,V.jsxs)(`a`,{href:e.href,className:`flex items-baseline justify-between gap-3 py-2.5 transition-colors hover:text-accent`,children:[(0,V.jsx)(`span`,{className:`min-w-0 truncate text-[0.86rem]`,children:e.title}),(0,V.jsx)(`span`,{className:`flex-shrink-0 text-[0.75rem] text-faint`,children:e.date})]})},e.title))})]})]})]})}function Gr({label:e,value:t,hint:n}){return(0,V.jsxs)(`div`,{className:`px-1 py-3 sm:px-6 sm:first:pl-1`,children:[(0,V.jsx)(`dt`,{className:`text-[0.72rem] uppercase font-bold tracking-wider text-faint`,children:e}),(0,V.jsx)(`dd`,{className:`mt-1 text-[1.05rem] font-medium`,children:t}),n&&(0,V.jsx)(`dd`,{className:`text-[0.75rem] text-faint`,children:n})]})}var Kr=`# Quickstart

Two minutes from an account to a working query. If you already have an account,
start at [step 2](#2-create-a-project).

## 1. Register

Go to [moogo.dev/register](/register) and create an account with an email and a
password. One email is one account, and you are signed in immediately — there is
no confirmation email to wait for.

Full detail: [Register](/docs/register).

## 2. Create a project

In the [dashboard](/app), click **New project**, name it, and confirm.

When it reaches the status \`ready\`, Moogo shows three values **once**:

\`\`\`
MOOGO_PROJECT_URL=https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
\`\`\`

**Copy them now.** The secret key is never displayed again — only a hash and an
eight-character prefix are stored. If you lose it, you can
[rotate it](/docs/credentials#rotating-a-key).

Put them in your environment:

\`\`\`bash
export MOOGO_PROJECT_URL="https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_PROJECT_ID="8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_SECRET_KEY="moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK"
\`\`\`

Full detail: [Create your first project](/docs/create-project).

## 3. Create a table

Creating a table is a **write**, so it goes to \`/exec\`:

\`\`\`bash
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT '"'"'free'"'"',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  }'
\`\`\`

Response:

\`\`\`json
{ "success": true, "rows_affected": 0, "size_bytes": 20480, "duration_ms": 1 }
\`\`\`

## 4. Insert data

Note the \`args\` array — values are bound parameters, never interpolated into the
SQL text.

\`\`\`bash
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    "args": ["7c1f", "ketut@example.com", "pro"]
  }'
\`\`\`

\`\`\`json
{ "success": true, "rows_affected": 1, "size_bytes": 24576, "duration_ms": 1 }
\`\`\`

## 5. Read it back

Reads go to \`/query\`:

\`\`\`bash
curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"SELECT id, email, plan FROM users WHERE plan = ?","args":["pro"]}'
\`\`\`

\`\`\`json
{
  "success": true,
  "columns": ["id", "email", "plan"],
  "rows": [["7c1f", "ketut@example.com", "pro"]],
  "row_count": 1,
  "truncated": false,
  "duration_ms": 1
}
\`\`\`

That is a working database.

## The one rule to remember

| Endpoint | Accepts | Rejects |
|---|---|---|
| \`/query\` | Reads — \`SELECT\`, \`VALUES\`, \`PRAGMA\`, \`EXPLAIN\` | Writes, with \`not_a_read\` |
| \`/exec\` | Writes — \`INSERT\`, \`UPDATE\`, \`DELETE\`, \`CREATE\`, \`ALTER\`, \`DROP\` | Reads, with \`not_a_write\` |

Sending the wrong kind of statement is the most common early mistake, and it is
rejected rather than silently accepted so you find out immediately.

## From JavaScript

The quickest way to integrate, since there is no driver to install:

\`\`\`js
const headers = {
  Authorization: \`Bearer \${process.env.MOOGO_SECRET_KEY}\`,
  "Content-Type": "application/json",
};

export async function sql(query, args = []) {
  const endpoint = /^(select|values|pragma|explain)\\b/i.test(query.trim())
    ? "query"
    : "exec";

  const response = await fetch(
    \`\${process.env.MOOGO_PROJECT_URL}/\${endpoint}\`,
    { method: "POST", headers, body: JSON.stringify({ query, args }) },
  );

  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "request failed");
  return body;
}
\`\`\`

\`\`\`js
const proUsers = await sql(
  "SELECT id, email FROM users WHERE plan = ?",
  ["pro"],
);
\`\`\`

\`rows\` come back as arrays aligned with \`columns\`. Full reference:
[SQL API](/docs/sql-api).

## From the dashboard

You never need a key to explore. Open the project's **Database** tab to browse
tables as a spreadsheet, build tables without writing DDL, and run SQL in a
console with the same rules the API applies.

## What to read next

- [SQL API](/docs/sql-api) — the full query and exec reference
- [Credentials](/docs/credentials) — keys, rotation, and storage credentials
- [Object storage](/docs/object-storage) — files under the same project
- [Limits](/docs/limits) — the quotas you are working within`,qr=`# What is Moogo?

Moogo is a hosted backend that gives every project its own **SQLite database** and
its own **object storage**, reachable over plain HTTP. There is no connection
string, no driver, and no database client to install.

You create a project, and Moogo hands you three values:

\`\`\`
MOOGO_PROJECT_URL=https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
\`\`\`

Put those in your application's environment and it can read and write data:

\`\`\`bash
curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"SELECT id, email FROM users WHERE plan = ?","args":["pro"]}'
\`\`\`

That is the whole integration. No SDK, no ORM, no connection pool to manage.

## The two planes

Everything about Moogo follows from one architectural decision: the service runs
in **two tiers**, and they never mix.

| Plane | Runs on | Holds | Touches your data? |
|---|---|---|---|
| **Control plane** | PostgreSQL | Accounts, projects, key hashes, quotas, the bucket catalog, activity logs | No |
| **Data plane** | SQLite, one \`.db\` file per project | Your tables and your rows | Yes |

The control plane knows that a project exists. The data plane holds what is in it.
A query never crosses between them, and a bug in the control plane cannot reach
your rows.

### Why this matters to you

Because the data plane is **one physical file per project**, isolation is not a
policy that can be misconfigured. Project A and project B are two different files
on disk. There is no shared connection, no shared buffer pool, and no query that
can be written to cross from one to the other. A project belonging to another
account answers \`404\`, not \`403\`, so an id cannot even be probed for existence.

## What you get

- **A real SQLite database.** Full SQLite, the engine you already know, with
  \`WAL\` journaling and foreign keys enabled on every connection.
- **Object storage per project.** Up to 256 MB of files, organized into buckets,
  with public URLs you can put in an \`<img>\` tag.
- **A dashboard.** Browse your tables as a spreadsheet, run SQL in a console, and
  watch the activity log. It needs no secret key from you.
- **Honest limits.** 100 MB per database, 15 seconds per statement, 1 MB per
  request body. Every one of them is reported in the response, so you find out
  from the API rather than from a hung tab.

## What Moogo is not

It is worth being direct about the edges.

- **It is not Postgres.** If you need \`PostGIS\`, logical replication, or
  concurrent analytical workloads, Moogo is the wrong tool.
- **It is not a global replica network.** One project is one file on one host.
  There is no read replica in another region.
- **It does not pause.** A project does not go to sleep after inactivity, so
  there is no cold start and no "first request after idle" latency. It also never
  pauses on its own — if you want to stop paying resources for an unused project,
  you pause it deliberately.

## Where to go next

- [Why Moogo](/docs/why-moogo) — the reasoning behind the design
- [Comparison](/docs/comparison) — how Moogo stacks up against Supabase and Turso
- [Register](/docs/register) — create an account
- [Quickstart](/docs/quickstart) — first query in about two minutes
`,Jr=`# Why Moogo?

Most hosted databases are Postgres with a nice wrapper. Moogo is not. It is built
around a different bet: **for a large class of applications, one SQLite file per
project is a better fit than a shared Postgres cluster**, and the ergonomics of
the API matter more than the feature list of the engine.

This page explains the reasoning, including the trade-offs that come with it.

## The problem Moogo is solving

If you are building a serverless function, a small SaaS, an internal tool, or an
AI agent that needs to remember things, you run into the same three problems.

**1. Connection management is your problem.** A serverless function has no
long-lived process. Every cold start means a new connection. You end up writing a
connection pool, or putting PgBouncer in front, or paying for a driver that
manages sockets for you.

**2. A shared database means shared risk.** In a multi-tenant Postgres, isolation
is a set of row-level security policies. They are well understood and they work —
until a policy is written with one too few \`WHERE\` clauses, and one tenant reads
another tenant's rows. This is not a hypothetical; it is the most common
multi-tenant data breach in the ecosystem.

**3. You do not need Postgres.** A huge fraction of applications are a few
tables, a handful of queries, and a few megabytes of data. What they need is
reliability, speed, and not having to think about the database at all. SQLite has
been the most-used embedded database in the world for over a decade, and it is
fast enough for essentially all of this.

Moogo takes that bet: **give each project a whole SQLite file, and expose it over
HTTP, and most of the operational work disappears.**

## The decisions that follow from that

### One file per project, not a shared cluster

This is the decision everything else follows from.

Isolation becomes structural instead of policy-based. There is no \`tenant_id\` to
filter on because there is no shared table. A query physically cannot reach
another project's data, because it is running against a different file opened by
a different file handle.

It is also why Moogo is fast. A write goes straight into the project's own file
with no row-level security evaluation, no cross-tenant index contention, and no
neighbour making your \`INSERT\` slow.

### Prepared statements only, enforced

Values never travel inside your SQL text. They are bound parameters:

\`\`\`json
{ "query": "SELECT id FROM users WHERE email = ?", "args": ["ketut@example.com"] }
\`\`\`

The engine only ever sees a parameterised statement. This means a value can never
become syntax, which is the whole class of SQL injection bugs — not "mostly
prevented", but structurally impossible on this path.

Every statement is also **tokenized and inspected before it runs**. \`ATTACH\`,
\`readfile\`, \`writefile\`, \`load_extension\`, stacked statements, and triggers are
rejected outright. See [Security](/docs/security) for the full list and why each
one is refused.

### No drivers, no cold starts

A \`moogo_...\` key and a URL are the entire integration. There is no driver to
install, no version to keep in sync with your runtime, and no connection to leak
when your function is frozen and thawed.

The project never pauses either. There is no idle timeout, so there is no cold
start to design around and no "first request is slow" to apologise for.

### Keys you can throw away

The project key is shown **once**, when the project is created and when it is
rotated. What is stored is a SHA-256 hash plus an eight-character prefix.

The consequence is worth stating plainly: a leaked database dump does not hand an
attacker a list of working keys. A key that appears in a log, a screenshot, or a
public repository is a key you need to rotate, but it is not a key that reveals
the others.

### Limits you can see

Every request has a time budget and every project has a size ceiling. Both come
back in the response, and both are enforced *before* the work is committed rather
than discovered afterwards. A write that would cross the size limit is refused; it
is not silently truncated.

## The trade-offs, stated honestly

Moogo is not the right tool for everything, and pretending otherwise would waste
your time.

| You probably want something else if | Why |
|---|---|
| You need \`PostGIS\` or spatial queries | SQLite has \`R-Tree\`, but it is not PostGIS |
| You need cross-region replicas | One project is one file on one host |
| You need concurrent analytical scans | SQLite is a single-writer engine |
| You need a database larger than 100 MB | That is the ceiling, and it is enforced |
| You need row-level security across tenants | You do not need it; you get file isolation instead |
| You need \`GRANT\` / \`REVOKE\` and multiple roles | Moogo has one role per project key |

On the free tier you also get **2 projects per account**, 100 MB per database,
and 256 MB of storage per project. There is no billing in the current version, so
every account is on the same plan. If you need more than that, the constraint is
a real one and you should know about it before you build.

## What is deliberately missing

Some things are absent on purpose, not by accident:

- **No triggers.** A trigger body contains semicolons, so detecting stacked
  statements correctly needs a real parser. Rather than ship a check that fails
  open on input SQLite accepts, triggers are declined. Write your invariants in
  your application.
- **No \`ATTACH\`.** It would turn the write endpoint into a file reader for the
  whole host.
- **No idle pausing.** It is a feature you would have to design around, and
  Moogo is always on.
- **No self-hosting yet.** It is planned, and it is not in this version.

Next: [Comparison](/docs/comparison) puts these decisions next to Supabase and
Turso, or [Register](/docs/register) if you would rather just try it.
`,Yr=`# Comparison

Moogo is not a replacement for every database. This page is an honest comparison
against the two services people usually weigh it against, so you can pick the
right tool rather than the fashionable one.

## At a glance

| | **Moogo** | **Supabase** | **Turso / libSQL** |
|---|---|---|---|
| Engine | SQLite, your own file | PostgreSQL, shared cluster | libSQL (SQLite fork), replicated |
| Isolation | One \`.db\` file per project | Shared Postgres, row-level security | Per-database, replicated globally |
| Connection | HTTP, no driver | Postgres wire protocol + REST/GraphQL | libSQL client (HTTP or WebSocket) |
| Serverless fit | Built for it, stateless, no pool | Pooling required, proxy adds latency | Edge replicas, sync complexity |
| Free tier pause | **Never pauses** | Pauses after 1 week inactive | Varies by plan |
| Max database size | 100 MB per project | Much larger | Larger than Moogo |
| Object storage | 256 MB per project, included | Separate, billed | Not included on lower tiers |
| AI context file | \`moogo.md\` for assistants | No standard format | No standard format |
| Licence | MIT | Apache 2 / MIT, varies by component | MPL 2.0 (the libSQL fork) |

## The three real differences

### Isolation: files versus policies

Supabase runs many tenants in one Postgres database and separates them with
row-level security. That model is genuinely powerful — it is what lets a single
cluster serve thousands of tenants cheaply — and it is also a policy that has to
be correct on every single table and every single query.

Moogo puts each project in its own file. A bug in one project's queries cannot
expose another's rows, because there is no shared table to query. The trade is
scale: you cannot fit thousands of projects onto one host the way you can with a
shared cluster, because each project is a real file.

If you are building a product for many customers and the isolation guarantee is
the core of your pitch, that trade is worth examining carefully. If you are
building *your* application, the shared-cluster problem is one you probably do
not have.

### Connection: HTTP versus a socket

Turso and Supabase both work by giving you a real database protocol. You install
a driver, and the driver manages sockets, reconnects, and pooling for you.

Moogo gives you HTTP. There is no socket to manage and no driver to keep in sync
with your runtime, which removes a category of deployment problem rather than
solving it with a library.

What you give up is transactions across requests and streaming query results.
For a serverless function issuing a handful of independent statements, this is
usually a good trade. For a reporting job that streams millions of rows, it is
not.

### Scale and ceiling

This is the clearest tradeoff, and you should check it first.

Moogo caps a database at **100 MB**. That is generous for an application and
small for a dataset. If you are storing user records, sessions, and a few
thousand uploads, you will never notice. If you are ingesting events, storing
media metadata at volume, or building a data warehouse, you should stop reading
this documentation and use a database sized for that.

Supabase and Turso both scale past 100 MB comfortably. They also cost more, and
they ask you to manage a connection from code that runs to completion.

## When to choose something else

Choose another tool if any of these are true:

- You need \`PostGIS\`, or Postgres extensions generally.
- You need a database larger than 100 MB per logical unit of data.
- You need many concurrent writers to the same tables. SQLite serialises writes
  per database; this is a property of the engine, not a Moogo setting.
- You need cross-region replicas or a multi-region write path.
- You need fine-grained roles, \`GRANT\` / \`REVOKE\`, or row-level security policies
  between your own teams.
- You need long-running analytical scans that would hold a write lock.

## When Moogo is the right call

Moogo fits well when:

- You are building a **serverless function, edge handler, or small SaaS** and want
  a real database with zero infrastructure.
- You want **SQL, not a proprietary client** — you should be able to point the
  official SQLite tooling at your data and understand it.
- Your dataset is **modest** and you would rather not pay for capacity you do not
  use.
- You want **object storage next to the database**, under the same key and the
  same quota model.
- You want your **AI assistant to be able to use the database directly**, via the
  \`moogo.md\` context file.
- You want to **never think about cold starts**, because nothing ever pauses.

## A note on the comparison table

The versions described here are the ones documented at the time of writing.
Supabase and Turso both move quickly and change their free tiers regularly, so
verify the current limits on their own sites before you commit to a decision
based on this page.

If you find something in this table that is out of date, please
[tell us](/docs/feedback) — corrections are welcome and credited.
`,Xr=`# Register

An account is one email address and a password. That is the whole identity
system: there are no organisations, no invitations, and no roles to assign.

## Create your account

1. Go to the [register page](/register), or click **Register / Login** in the
   header.
2. Fill in the form.

| Field | Required | Notes |
|---|---|---|
| Name | No | Shown in the dashboard. You can leave it empty. |
| Email | Yes | This is your identity. One email is one account. |
| Password | Yes | At least 8 characters. |
| Confirm password | Yes | Must match exactly. |

3. Click **Create account**.

## Confirm your email address

Registration does not sign you in. It creates the account and sends a
confirmation link to the address you typed, and the account cannot be used until
you follow it.

This exists because a typed address proves nothing. Without it, anybody could
register your email address and lock you out of an account they cannot get into.

The link:

- Expires after **24 hours**.
- Works **once**. Following it twice reports it as expired, which is the correct
  answer — it has already been used.
- Brings you to \`/verify-email\`, which exchanges it and signs you in on the next
  click.

**Nothing arrived?** The link is in your spam folder more often than not. The
login page can send a fresh one: try to sign in, and when it says the address is
not confirmed, offer **Send a new link**. That path answers the same way whether
or not an account exists, so it will not tell you whether your address is
registered.

> **If sending fails**, the registration is rejected with \`mail_failed\` rather
> than accepted quietly. That is deliberate: the account exists but is unusable,
> and silently returning success would leave you waiting on an inbox that will
> never receive anything.

## Sign in

Go to [the login page](/login) and enter the email and password you registered
with. Your session is stored in a cookie, so your browser stays signed in for
seven days.

If you are already signed in, visiting \`/login\` takes you to the dashboard
instead of showing the form.

An account that has not confirmed its address gets \`403 email_not_verified\`
rather than a normal session. The login page turns that into a prompt to resend
the link instead of an error above the same form.

## Sign out

Click your account in the top-right of the dashboard and choose **Sign out**. This
clears the session cookie on this browser only. Because the key never lives in the
browser, there is nothing else to revoke here.

## Forgotten password

1. Go to [the forgot password page](/forgot-password).
2. Enter your email address.
3. Check your inbox for a reset link.

The link expires after **one hour** and can only be used once.

> **Nothing arrived?** Reset emails are sent only to addresses that have an
> account. If the address is not registered, no email is sent. This is
> deliberate: telling an anonymous caller whether an address has an account
> would turn the form into an account-enumeration oracle.
>
> Password reset works on an account whose address has not been confirmed yet.
> It is the same thing: the link proves you can read mail at that address.

Once you have the link, you will land on a page where you choose a new password.

## Signing in with Google

Moogo also supports Google sign-in, and it is the recommended path when the
deployment has been configured for it.

Clicking **Continue with Google** sends you to Google's consent screen and back.
The email Google returns is always verified, so no email confirmation is needed
either — a Google account is created already confirmed and stays confirmed.

If Google sign-in is not configured on the deployment you are using, the button
is not shown at all and the email and password form is the only way in. Nothing
on your side needs to change either way.

### What an operator has to configure

The button appears only when both of these are set:

\`\`\`
MOOGO_GOOGLE_CLIENT_ID=...your client id...
MOOGO_GOOGLE_CLIENT_SECRET=...your client secret...
\`\`\`

Create them in the Google Cloud Console: **APIs & Services → Credentials → Create
Credentials → OAuth client ID → Application type: Web application**. Then set
the **Authorized redirect URI** to exactly:

\`\`\`
<MOOGO_PUBLIC_URL>/auth/google/callback
\`\`\`

It has to match character for character, including \`http\` versus \`https\` and any
port. A mismatch comes back as Google's \`redirect_uri_mismatch\` error.

## How sessions work

- The session is a signed, \`HttpOnly\` cookie marked \`Secure\` and \`SameSite=Lax\`.
- It lasts **7 days**.
- It is scoped to the browser that created it. Signing in on a different device is
  a separate sign-in.

Your session authorises the **dashboard**. It is not the credential your
application uses — that is a [project key](/docs/credentials), and the dashboard
never sees it.

## Confirming an address

If you followed a confirmation link already, the exchange is a \`POST\` of the
token rather than a \`GET\` on it. A token in a query string is recorded in
browser history and in the \`Referer\` header of any link followed afterwards, so
the page reads it from the address and posts it immediately, then clears the
address bar.

## What happens next

With an account, the next step is to
[create your first project](/docs/create-project), which is where your database
and your key come from.`,Zr=`# Create your first project

A project is one SQLite database, one object storage namespace, and one set of
credentials. Creating it takes a few seconds and gives you everything you need to
make your first query.

## Before you start

You need [an account](/docs/register). You get **2 projects** on the free tier, so
create a second one only when you have a reason to.

## Create the project

1. Sign in and go to the [dashboard](/app).
2. Click **New project**.
3. Give it a name. This is a label for you; nothing in the API depends on it.
4. Click **Create**.

The project is created in the background. Its status moves through:

| Status | Meaning |
|---|---|
| \`pending\` | The record exists; the database file is being prepared. |
| \`ready\` | Ready to use. The dashboard and the API both accept requests. |
| \`failed\` | Creation did not complete. Delete it and try again. |

A newly created project normally reaches \`ready\` within a second or two. If
something goes wrong the project is left in \`failed\` with a description, rather
than a spinner that never resolves — you always find out which state you are in.

## Save your credentials immediately

On creation, Moogo shows three values **once**:

\`\`\`
MOOGO_PROJECT_URL=https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
\`\`\`

| Value | What it is |
|---|---|
| \`MOOGO_PROJECT_URL\` | The base URL every API call hangs off. It already contains the project id. |
| \`MOOGO_PROJECT_ID\` | The project's UUID. Also identifies it in the dashboard and in URLs. |
| \`MOOGO_SECRET_KEY\` | The bearer token that authorises API calls. |

**Copy them now.** The secret key is never shown again — not in the project list,
not in settings, not by email. What Moogo keeps is a SHA-256 hash and an
eight-character prefix, so it genuinely cannot show you the key again.

If you lose it, [rotate it](/docs/credentials#rotating-a-key). Rotation is instant
and invalidates the old key immediately, so update your deployment before you
rotate.

### Put them in your environment

\`\`\`bash
# .env
MOOGO_PROJECT_URL=https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SECRET_KEY=moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
\`\`\`

Do not commit this file. The key is a real credential and it is the only thing
standing between your database and anyone who has it.

## Make your first query

\`\`\`bash
curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, plan TEXT)"}'
\`\`\`

That is a write, so it went to \`/exec\` in practice — \`/query\` refuses writes and
\`/exec\` refuses reads. Use the right one for what you are doing:

\`\`\`bash
# Create a table (a write)
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, plan TEXT)"}'

# Insert a row (a write, with a bound parameter)
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"INSERT INTO users (id, email, plan) VALUES (?, ?, ?)","args":["7c1f","ketut@example.com","free"]}'

# Read rows back (a read)
curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"SELECT id, email, plan FROM users"}'
\`\`\`

The read returns:

\`\`\`json
{
  "success": true,
  "columns": ["id", "email", "plan"],
  "rows": [["7c1f", "ketut@example.com", "free"]],
  "row_count": 1,
  "truncated": false,
  "duration_ms": 1
}
\`\`\`

The [SQL API page](/docs/sql-api) covers this in detail.

## Managing the project

Open the project from the dashboard, then use the tabs.

### Database tab

Browse tables as a spreadsheet, create tables with the table builder, edit rows,
and run SQL in the console. The console runs the same sanitizer and the same
read/write rules as the public API, so behaviour you see here is behaviour you
get there.

### Bucket tab

Upload and organise files. Covered in [Create a bucket](/docs/create-bucket).

### Settings tab

- **Project URL and id** — always visible, safe to copy.
- **Rotate key** — issues a new secret key and shows it once. The old key stops
  working immediately.
- **Pause / resume** — stops and restarts all API access for this project.
- **Download backup** — a \`.db\` file of the whole database. It uses your session,
  not a project key, so it works from the dashboard without the key.
- **Delete project** — permanent. Removes the database and every stored file.

### Pausing

Pausing makes the project refuse API requests for both SQL and storage. It does
not delete anything and does not change any credential, so resume puts it back
exactly as it was.

Pausing is immediate and is not billed differently — it exists so you can stop a
project you are not using without destroying it. Use it instead of deleting when
you might come back.

### Deleting

Deleting a project removes its database file and every object in its buckets. It
cannot be undone. If you only want to stop using it, pause it instead.

## Next

- [Credentials](/docs/credentials) — keys, rotation, and what is stored
- [SQL API](/docs/sql-api) — the full query and exec reference
- [Create a bucket](/docs/create-bucket) — object storage`,Qr=`# Credentials

Moogo uses **different credentials for different things**, on purpose. This page
covers what each one authorises, how to send it, and what happens if it leaks.

## The three credentials

| Credential | Authorises | Sent as |
|---|---|---|
| **Session cookie** | The dashboard, as you | \`Cookie\`, set by the browser |
| **Project key** | SQL (\`/query\`, \`/exec\`) | \`Authorization: Bearer moogo_...\` |
| **Storage credential** | Object storage | \`X-Moogo-Access-Key-Id\` + \`Authorization: Bearer moogo_sk_...\` |

They are not interchangeable. The dashboard never sees a project key, the project
key cannot touch storage, and a storage credential cannot run SQL. Each one is
scoped to the job it is named for.

## Project key

Issued when a project is created, and again whenever you rotate. Format:

\`\`\`
moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
\`\`\`

The prefix is \`moogo_\` followed by 32 bytes of base64 from \`crypto/rand\`. The
prefix means a key found in a log can be identified as a Moogo key.

### Send it like this

\`\`\`bash
Authorization: Bearer moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
\`\`\`

Only the \`Bearer\` scheme is accepted. Basic auth and custom schemes are refused,
so there is no second path into the API.

### Shown once

The plaintext key appears in exactly one response: the one that created it, or
the one that rotated it. What is stored is:

- a **SHA-256 hash**, used for verification
- an **eight-character prefix**, so you can tell your keys apart in the list
- the time it was last rotated

There is no endpoint that returns the key. This is not a policy that could be
changed later — the server does not hold a value it could give back.

The hash is unsalted SHA-256, which is correct here: the key already has 256 bits
of entropy from \`crypto/rand\`, so there is no guessing space for a salt to close.
Comparison is constant-time, so verification does not leak how many bytes matched.

### Rotating a key

In the project's **Settings** tab, click **Rotate key**.

The new key is shown once. The old key stops working **immediately** — there is
no grace period, so update your deployment before you rotate:

1. Update the secret in your deployment.
2. Restart or redeploy so the new value is live.
3. Confirm the application still works.
4. Only then, if you want to be certain the old value is gone, verify the old key
   now returns \`401\`.

If you rotate and then discover your deployment cannot pick up environment
changes, the project is still fully usable from the dashboard — you only need to
rotate again.

### Storage credential for one job

If several parts of your system need the SQL key, consider
[rotating per environment](/docs/credentials#storage-credentials) instead of
sharing one key across everything.

## Storage credentials

Storage has its own credential type, following the shape of Cloudflare R2: an
**access key id** that is safe to display, and a **secret key** that is not.

\`\`\`
moogo_ak_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK   <- access key id (public)
moogo_sk_3nQ8wRtZ2mK5xB9cV1yH4jL7pA0sD6fG2iO7uE   <- secret key (private)
\`\`\`

The distinct prefixes mean that if you ever see both in a log, you know which is
which without reading further.

### Why not just use the project key?

Because the two guard different things:

- A key scoped to running \`SELECT\` has no business being able to overwrite every
  file in the project.
- Rotating the SQL key should not be able to silently break every application that
  uploads files.

So storage **rejects** the project key, and the SQL endpoints reject the storage
credential.

### Create one

In the project's **Bucket** tab, open **Credentials** and click **Create
credential**. Give it a label so you can tell environments apart — \`production\`,
\`staging\`, \`ci\`.

The secret is returned exactly once, together with ready-to-paste environment
variables:

\`\`\`json
{
  "access_key_id": "moogo_ak_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK",
  "secret_access_key": "moogo_sk_3nQ8wRtZ2mK5xB9cV1yH4jL7pA0sD6fG2iO7uE",
  "env": {
    "MOOGO_BUCKET_ENDPOINT": "https://moogo.dev",
    "MOOGO_BUCKET_ACCESS_KEY_ID": "moogo_ak_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK",
    "MOOGO_BUCKET_SECRET_KEY": "moogo_sk_3nQ8wRtZ2mK5xB9cV1yH4jL7pA0sD6fG2iO7uE"
  }
}
\`\`\`

**Copy it immediately.** Like the project key, it is shown once.

### Use it

Two headers, on every storage request:

\`\`\`bash
curl https://moogo.dev/p/$MOOGO_PROJECT_ID/bucket/avatars/kit.png \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

Not AWS Signature V4, deliberately. Signing exists so a client can prove
possession of a secret without sending it, for a transport the client does not
control. Over TLS the secret goes in the \`Authorization\` header the same way it
does everywhere else in this API, and the access key id says which credential to
check it against.

### Limits and lifecycle

- You may hold **5 credentials** per project.
- **Rotating** keeps the same access key id and issues a new secret. Use this when
  only the secret is compromised.
- **Revoking** disables the credential permanently. Use this when the whole
  credential is compromised.

An unknown id, a revoked id, and a wrong secret all return \`401\`, deliberately
indistinguishable, so the endpoint cannot be used to discover which access key ids
are valid.

A credential belongs to exactly one project. Presenting project A's credential
against project B's URL returns \`404\`, not someone else's data.

### Keeping one credential per environment

A pattern worth copying:

| Credential | Used by | Scope it can reach |
|---|---|---|
| \`web-ssr\` | your server | full storage |
| \`ci-uploads\` | your test pipeline | full storage, revokable at any time |
| \`public-site\` | a static build step | full storage, revoke before going live |

This means a leaked CI variable does not stay live in production, and revoking one
environment does not take down the others.

## If a credential leaks

Treat a leaked key as a real incident. In order:

1. **Rotate or revoke immediately.** Project key: **Settings → Rotate key**.
   Storage: **Credentials → Rotate** or **Revoke**.
2. **Update every deployment** that was using it.
3. **Review the [activity log](/docs/dashboard#activity-log)** for requests you do
   not recognise.
4. **Check for other exposure** — a leaked key in a public repository stays
   exposed even after you rotate, because the history does not go away. Treat it
   as compromised from the moment it was pushed, not from the moment you noticed.

Rotating is cheap. Do not wait to be sure.

## What is never stored

- The **raw project key** — only a hash and an eight-character prefix.
- The **raw storage secret** — only a hash and a six-character preview.
- **Passwords** — stored as a salted hash, never in a readable form.

The practical test: if the Postgres control plane were dumped, the attacker would
hold no working credential. They would hold hashes, which cannot be reversed
because the keys are not recoverable in the first place.

## Next

- [SQL API](/docs/sql-api) — using the project key
- [Object storage](/docs/object-storage) — using storage credentials
- [Security](/docs/security) — the full model`,$r=`# SQL API

Two endpoints. One runs reads, the other runs writes. Both take a project key and
both validate your SQL before it touches the database.

## Base URL

Everything hangs off \`MOOGO_PROJECT_URL\`, which already contains the project id:

\`\`\`
https://moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
\`\`\`

Append \`/query\` or \`/exec\`. You never assemble the path yourself, so the internal
route layout is not something your application has to track.

There is also an older form, \`/db/{project_id}/query\` and \`/db/{project_id}/exec\`.
It behaves identically and exists so integrations built against it keep working.
New code should use the project-scoped URL.

## Authentication

Every request needs the project key:

\`\`\`
Authorization: Bearer moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
Content-Type: application/json
\`\`\`

A missing or wrong key returns \`401\`.

## Request body

Both endpoints take the same body:

\`\`\`json
{
  "query": "SELECT id, email FROM users WHERE plan = ?",
  "args": ["pro"]
}
\`\`\`

| Field | Type | Required | Notes |
|---|---|---|---|
| \`query\` | string | Yes | One SQL statement. |
| \`args\` | array | No | Values for the \`?\` placeholders, in order. |

Unknown fields are rejected rather than ignored. If you send \`{"argz": [...]}\` you
get an error instead of a success that quietly did nothing.

### Always use \`args\`

Values belong in \`args\`, never concatenated into \`query\`. \`args\` travel as bound
parameters, so a value can never become syntax:

\`\`\`json
{ "query": "INSERT INTO users (id, email) VALUES (?, ?)", "args": ["7c1f", "ketut@example.com"] }
\`\`\`

Not this, ever:

\`\`\`json
{ "query": "INSERT INTO users (id, email) VALUES ('7c1f', 'ketut@example.com')" }
\`\`\`

## \`POST /query\` — reads

Use this for anything that returns rows: \`SELECT\`, \`VALUES\`, \`PRAGMA\`, \`EXPLAIN\`.

\`\`\`bash
curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"SELECT id, email FROM users WHERE plan = ?","args":["pro"]}'
\`\`\`

Response:

\`\`\`json
{
  "success": true,
  "columns": ["id", "email"],
  "rows": [["7c1f", "ketut@example.com"]],
  "row_count": 1,
  "truncated": false,
  "duration_ms": 2
}
\`\`\`

| Field | Type | Notes |
|---|---|---|
| \`success\` | boolean | Always \`true\` on a 200. |
| \`columns\` | string[] | The shape of every row. |
| \`rows\` | any[][] | Positionally aligned with \`columns\`. |
| \`row_count\` | number | Rows returned. |
| \`truncated\` | boolean | \`true\` if a row cap was hit — do not treat this as the whole table. |
| \`duration_ms\` | number | Server-side execution time. |

Rows are **arrays, not objects**. \`rows[i][j]\` corresponds to \`columns[j]\`, which
keeps the payload small and lets you render a table without reading the first row
to discover the shape.

\`/query\` **rejects writes** with \`not_a_read\`. That is deliberate: routing a write
through the read endpoint would let a caller pull a large result set past the row
cap.

## \`POST /exec\` — writes

Use this for \`INSERT\`, \`UPDATE\`, \`DELETE\`, \`CREATE\`, \`ALTER\`, \`DROP\`.

\`\`\`bash
curl $MOOGO_PROJECT_URL/exec \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"INSERT INTO users (id, email, plan) VALUES (?, ?, ?)","args":["7c1f","ketut@example.com","free"]}'
\`\`\`

Response:

\`\`\`json
{
  "success": true,
  "rows_affected": 1,
  "size_bytes": 24576,
  "duration_ms": 1
}
\`\`\`

| Field | Type | Notes |
|---|---|---|
| \`success\` | boolean | Always \`true\` on a 200. |
| \`rows_affected\` | number | Rows changed. |
| \`size_bytes\` | number | Database size after the write. Useful for tracking quota. |
| \`duration_ms\` | number | Server-side execution time. |

\`/exec\` rejects reads with \`not_a_write\`.

> **DDL goes here too.** \`CREATE TABLE\`, \`ALTER TABLE\`, \`CREATE INDEX\` are all
> writes. They run through the same sanitizer, so check
> [what is rejected](#what-is-rejected) before you are surprised.

## One statement per request

Send exactly one statement. A second statement is rejected with
\`sql_multiple_statements\`.

\`\`\`json
{ "query": "SELECT 1; DROP TABLE users" }
\`\`\`

This is checked on **tokens**, not on raw text, so a semicolon inside a string
literal or a comment is not counted:

\`\`\`json
{ "query": "SELECT * FROM notes WHERE body = 'hello; world'" }
\`\`\`

That is fine. A trailing semicolon is also fine — it terminates the statement
rather than starting another one.

The dashboard's SQL console does this splitting for you: paste a script, and it
runs each statement as its own request in order. This rule constrains a single
HTTP request, not the console.

## What is rejected

Every statement is tokenized and inspected **before** it runs. Rejections come
back as \`400\` with a specific \`code\`.

### Keywords that would escape the database

| Rejected | Because |
|---|---|
| \`ATTACH\` | Opens an arbitrary path as a database. This would turn \`/exec\` into a file reader for the whole host. |
| \`DETACH\` | The other half of the same escape. |
| \`VACUUM\` | Rewrites the whole file, bypassing the per-project size limit. |
| \`REINDEX\` | Same — it rebuilds and can grow the file unchecked. |
| \`ANALYZE\` | Same. |
| \`BEGIN\`, \`COMMIT\`, \`ROLLBACK\`, \`SAVEPOINT\`, \`RELEASE\` | You get one statement per request, and transactions are managed per request. |

### Functions that read files or load native code

\`readfile\`, \`writefile\`, \`load_extension\`, \`edit\`, \`fts3_tokenizer\`,
\`sqlite_compileoption_get\`, \`sqlite_compileoption_used\`.

These are matched **by name anywhere they appear**, including as a column or table
name. That means a column literally named \`readfile\` is refused. This is a
deliberate trade: a confusingly-named column is a small cost next to a readable
\`/etc/passwd\`.

### Triggers

\`CREATE TRIGGER\` is rejected. A trigger body sits between \`BEGIN\` and \`END\` and
contains semicolons, so detecting stacked statements correctly needs a real
parser — and a hand-rolled approximation is exactly the kind of check that fails
open on input SQLite accepts. Triggers are declined rather than shipping a check
that might be wrong. Write your invariants in application code.

### PRAGMA

\`PRAGMA\` is **allowlisted, not blocked**, because many pragmas write to the file
(\`journal_mode\`, \`key\`, \`rekey\`, \`page_size\`, \`auto_vacuum\`, \`synchronous\`).

Allowed:

\`table_info\`, \`table_xinfo\`, \`index_list\`, \`index_info\`, \`index_xinfo\`,
\`foreign_key_list\`, \`database_list\`, \`collation_list\`, \`function_list\`,
\`module_list\`, \`pragma_list\`, \`compile_options\`, \`integrity_check\`,
\`quick_check\`, \`foreign_key_check\`

Both spellings work:

\`\`\`json
{ "query": "PRAGMA table_info(users)" }
{ "query": "pragma_table_info('users')" }
\`\`\`

These are read-only introspection statements, which is what the dashboard's
schema inspector needs.

### Size and duration

| Limit | Value | Error code |
|---|---|---|
| Statement length | 64 KB | \`sql_too_long\` |
| Request body | 1 MB | \`body_too_large\` |
| Execution time | 15 seconds | \`statement_timeout\` |
| Database size | 100 MB | \`database_too_large\` |

The statement length limit bounds tokenizer work and error-message size. It is not
a substitute for the body limit, which is enforced while reading.

A write that **would** cross the size ceiling is refused before it commits. You
get an error, not a silently truncated database.

## Migration Strategy

Moogo does not include a built-in migration framework. Instead, you run DDL
statements directly via the \`/exec\` endpoint. This gives you full control but
requires discipline.

### Recommended Workflow

1. **Keep migration files in version control**

\`\`\`
migrations/
  001_create_users.sql
  002_add_posts_table.sql
  003_add_indexes.sql
  004_add_foreign_keys.sql
\`\`\`

2. **Run migrations during deployment** (before deploying app code), using a
   simple runner that executes each \`.sql\` file through \`/exec\`:

\`\`\`javascript
// migrate.js
import fs from 'fs';
import path from 'path';
import { run } from './lib/moogo';

const MIGRATIONS_DIR = './migrations';

async function runMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(\`Running migration: \${file}\`);
    const text = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    // Split on ';'. This is correct as long as no statement keeps a
    // semicolon inside a string or comment — for those, split with a
    // tokenizer instead of a plain String.split.
    const statements = text.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      await run(stmt);
    }
    console.log(\`✓ \${file}\`);
  }
}
\`\`\`

### Migration File Template

\`\`\`sql
-- 001_create_users.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
\`\`\`

### Migration Checklist

Before running migrations in production:

- [ ] Test migrations on staging with production-like data
- [ ] Use \`IF NOT EXISTS\` / \`IF EXISTS\` for idempotency
- [ ] Run during low-traffic window
- [ ] Have rollback plan (backup before migrate)
- [ ] Test rollback locally first

---

## SQL Style Guide

Follow these conventions to write SQL that is readable, portable, and works well
with Moogo's HTTP API.

### 1. Always Use Prepared Statements

\`\`\`javascript
// ✅ Correct — parameterized
await sql("SELECT * FROM users WHERE email = ?", [email]);

// ❌ NEVER — string interpolation (SQL injection: the value becomes syntax)
await sql(\`SELECT * FROM users WHERE email = '\${email}'\`);
\`\`\`

### 2. Use Explicit Column Lists

\`\`\`sql
-- ✅ Good
SELECT id, email, name FROM users WHERE id = ?

-- ❌ Avoid SELECT *
SELECT * FROM users WHERE id = ?
\`\`\`

### 3. Use CTEs for Complex Queries

\`\`\`sql
WITH active_users AS (
  SELECT * FROM users WHERE is_active = 1
)
SELECT u.*, COUNT(p.id) as post_count
FROM active_users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id;
\`\`\`

### 4. Use \`UPSERT\` for Idempotent Writes

\`\`\`sql
INSERT INTO users (id, email, name)
VALUES (?, ?, ?)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  updated_at = datetime('now');
\`\`\`

### 5. Use \`RETURNING\` for Created Records

\`\`\`sql
INSERT INTO users (id, email, name)
VALUES (?, ?, ?)
RETURNING id, email, created_at;
\`\`\`

### 6. Schema Design Conventions

| Aspect | Convention | Why |
|--------|------------|-----|
| Primary Keys | \`id TEXT PRIMARY KEY\` (UUID) | Distributed-friendly, no sequence contention |
| Timestamps | \`TEXT DEFAULT (datetime('now'))\` | ISO8601 sorts lexicographically |
| Booleans | \`INTEGER DEFAULT 1\` (0/1) | SQLite has no native BOOLEAN |
| JSON | \`TEXT DEFAULT '{}'\` | Use \`json_extract()\` to query |
| Foreign Keys | Always explicit with \`ON DELETE\` | Enables CASCADE, prevents orphans |

### 7. Index Strategically

\`\`\`sql
-- Equality columns first, then range/order columns
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX idx_posts_published ON posts(published, created_at DESC);
\`\`\`

- Index columns used in \`WHERE\`, \`JOIN\`, \`ORDER BY\`
- Equality columns first, then range/order columns
- Don't over-index — each index slows writes

---

## What Cannot Run (Limitations)

Moogo enforces safety limits that differ from embedded SQLite:

| Feature | Status | Workaround |
|---------|--------|------------|
| Multi-statement transactions (\`BEGIN\`/\`COMMIT\`) | ❌ Rejected | Single statement per request; manage transactions in app |
| Triggers (\`CREATE TRIGGER\`) | ❌ Rejected | Write invariants in application code |
| \`ATTACH\` / \`DETACH\` | ❌ Rejected | Not supported |
| \`VACUUM\` / \`REINDEX\` / \`ANALYZE\` | ❌ Rejected | Not supported |
| \`load_extension\` / \`readfile\` / \`writefile\` | ❌ Blocked | Security |
| \`ALTER TABLE ... DROP COLUMN\` | ⚠️ SQLite 3.35+ | Requires table recreate in older versions |
| \`ALTER TABLE ... ADD FOREIGN KEY\` | ❌ Not supported | Requires table recreate |
| Transactions across requests | ❌ Not supported | Manage in application code |

See [What is rejected](#what-is-rejected) for the full list of rejected statements.

---

## Related Guides

- [Schema & Migration Best Practices](/docs/schema-best-practices) — Complete migration workflow, schema design patterns, and SQL style guide
- [SQL API Reference](/docs/sql-api) — This page
- [Security](/docs/security) — Prepared statements, sanitizer, limits
- [Limits](/docs/limits) — Quotas, request limits, retention

## Concurrency

- **Reads run in parallel.** \`WAL\` mode means a reader never blocks the writer.
- **Writes are serialised per project**, so two concurrent writes cannot hit
  \`SQLITE_BUSY\`.
- \`busy_timeout\` is still set as a backstop.
- \`journal_mode = WAL\` and \`foreign_keys = ON\` on every connection.
- **One connection per project**, not a global pool, so the number of open file
  handles is bounded and countable.

## Complete example

A tiny data layer, in plain JavaScript:

\`\`\`js
// db.js
const base = process.env.MOOGO_PROJECT_URL;
const headers = {
  Authorization: \`Bearer \${process.env.MOOGO_SECRET_KEY}\`,
  "Content-Type": "application/json",
};

async function sql(query, args = []) {
  // Route to the right endpoint: /query for reads, /exec for writes.
  const endpoint = /^(select|values|pragma|explain)\\b/i.test(query.trim())
    ? "query"
    : "exec";

  const response = await fetch(\`\${base}/\${endpoint}\`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, args }),
  });

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message ?? "request failed");
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

// Reads come back as arrays; give callers objects instead.
export async function all(query, args = []) {
  const result = await sql(query, args);
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
  );
}

export async function run(query, args = []) {
  return sql(query, args);
}
\`\`\`

Using it:

\`\`\`js
await run(
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, plan TEXT)",
);

await run("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [
  "7c1f",
  "ketut@example.com",
  "free",
]);

const proUsers = await all("SELECT id, email FROM users WHERE plan = ?", ["pro"]);
\`\`\`

## Errors

Every error has the same shape, so you can branch on \`code\` instead of parsing
\`message\`:

\`\`\`json
{
  "error": {
    "code": "sql_forbidden_keyword",
    "message": "this statement type is not allowed",
    "detail": "ATTACH"
  }
}
\`\`\`

| Field | Notes |
|---|---|
| \`code\` | Stable and machine-readable. Safe to branch on. |
| \`message\` | Human-readable, safe to show a developer. |
| \`detail\` | Optional context. For SQL errors this is the driver's message. |

### SQL validation codes

| Code | Meaning |
|---|---|
| \`sql_empty\` | No statement was sent. |
| \`sql_syntax_error\` | Could not be tokenized — usually an unterminated string or comment. |
| \`sql_multiple_statements\` | More than one statement. |
| \`sql_forbidden_keyword\` | A blocked keyword or trigger was used. \`detail\` names it. |
| \`sql_forbidden_function\` | A blocked function name was used. |
| \`sql_forbidden_pragma\` | The PRAGMA is not on the allowlist. |
| \`sql_too_long\` | Statement over 64 KB. |
| \`not_a_read\` | A write was sent to \`/query\`. |
| \`not_a_write\` | A read was sent to \`/exec\`. |

### Runtime codes

| Code | Status | Meaning |
|---|---|---|
| \`sql_error\` | 400 | SQLite rejected the statement. Check \`detail\`. |
| \`database_not_found\` | 404 | The project database does not exist. |
| \`database_too_large\` | 413 | The database is at its 100 MB ceiling. |
| \`statement_timeout\` | 504 | The statement passed 15 seconds and was cancelled. |
| \`quota_exceeded\` | 429 | An account quota was reached. |
| \`project_paused\` | 403 | The project is paused. |
| \`project_not_ready\` | 403 | The project is still being created. |
| \`body_too_large\` | 413 | Request body over 1 MB. |
| \`invalid_json\` | 400 | The body was not valid JSON. |

See [Errors and troubleshooting](/docs/errors) for how to handle them.

## Next

- [Object storage](/docs/object-storage) — files under the same project
- [Security](/docs/security) — why these rules exist
- [Errors](/docs/errors) — every error code and what to do about it`,ei=`# Create a bucket

Every project has **256 MB of object storage**. A bucket is a named namespace
inside that quota, so you can keep \`avatars\` separate from \`exports\` without
either one colliding.

## Create a bucket

### From the dashboard

1. Open your project and go to the **Bucket** tab.
2. Click **New bucket**.
3. Name it, set the upload policy, and confirm.

The new bucket appears in the sidebar with its object count and size, both of
which update as you upload.

### From the API

\`\`\`bash
curl https://moogo.dev/api/projects/$MOOGO_PROJECT_ID/buckets \\
  -H "Cookie: session=..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"avatars"}'
\`\`\`

Or, using a [storage credential](/docs/credentials):

\`\`\`bash
curl https://moogo.dev/buckets/$MOOGO_PROJECT_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"avatars"}'
\`\`\`

Response:

\`\`\`json
{
  "bucket": {
    "id": "3f8a2c11-9d4e-4b7a-8f21-5e6c3d9a1b84",
    "name": "avatars",
    "object_count": 0,
    "size_bytes": 0,
    "created_at": "2026-10-01T09:14:22Z",
    "is_public": false,
    "allowed_types": ["image"],
    "max_object_size_bytes": 2097152,
    "quota_bytes": 262144000
  }
}
\`\`\`

Bucket names must be unique within a project. A duplicate returns \`409\`.

## The \`default\` bucket

Uploads that name no bucket land in a bucket called \`default\`, which is created
on demand.

This exists for backwards compatibility: the original storage API had no concept
of buckets, and clients written against it should keep working rather than start
failing because they did not know about this feature. You are free to ignore it.

## Bucket settings

Four settings control what a bucket accepts and how much room it has. **The server
enforces all of them on every write**, not just in the dashboard's file picker, so
an API client cannot bypass them.

### \`is_public\`

Whether objects uploaded to this bucket from now on are readable by their URL
without a credential. \`false\` by default.

Turning a bucket off also makes the objects already in it private. Each object can
then be published again on its own, and replacing a file never changes its
visibility either way — overwriting is a storage operation, not a publishing
decision.

### \`allowed_types\`

An **array**, so a bucket can take more than one kind of file.

| Value | Accepts |
|---|---|
| \`any\` | Everything. The default. |
| \`image\` | Anything sent as \`image/*\`. |
| \`video\` | Anything sent as \`video/*\`. |
| \`audio\` | Anything sent as \`audio/*\`. |
| \`document\` | PDF, Word, Excel, PowerPoint, OpenDocument, plain text. |
| \`archive\` | Zip, Gzip, Tar, 7z, Rar, Bzip2, Xz. |
| \`file\` | Everything the rows above do not cover: binaries, fonts, and the like. |

\`file\` is **not** a synonym for \`any\`. It is the complement of the other rows, so
it refuses a PNG and accepts a compiled binary — which makes it the right choice
for a bucket of assets nobody wants to classify.

\`any\` cannot be combined with a specific type: asking to both allow and refuse the
same upload has no answer, so the request is rejected rather than one side being
dropped silently.

\`\`\`bash
curl -X PATCH https://moogo.dev/buckets/$MOOGO_PROJECT_ID/$BUCKET_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"allowed_types":["image","video"],"max_object_size_bytes":2097152}'
\`\`\`

### \`max_object_size_bytes\`

Per-object cap in bytes. **\`0\` means no limit**, which is not the same as a limit
of zero bytes — so \`0\` disables the cap rather than refusing everything.

### \`quota_bytes\`

This bucket's own storage ceiling, **250 MB** by default. Uploads past it are
refused with \`507 bucket_quota_exceeded\` even when the project still has room, so
one bucket cannot starve the others.

It cannot exceed the project's 256 MB total, and it cannot be set below what the
bucket already holds — a quota under its current usage would leave every later
upload refused for a reason that looks like a full project.

A rejected upload returns \`413\` with \`object_too_large\` and a \`detail\` naming the
limit, which is the difference between the two cases:

| Code | Status | Means |
|---|---|---|
| \`object_too_large\` | 413 | This one object is over **this bucket's** limit. |
| \`quota_exceeded\` | 507 | The object is fine, but the **project total** is full. |

Set the cap. A bucket meant for avatars should not accept a 200 MB video, and the
quota error arriving only after a long upload is a worse experience than being
refused immediately.

## Public objects

By default every object is private. Publishing makes it readable at a URL with no
credential at all:

\`\`\`bash
curl -X POST https://moogo.dev/buckets/$MOOGO_PROJECT_ID/$BUCKET_ID/public \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"is_public":true}'
\`\`\`

Publish one object:

\`\`\`json
{ "is_public": true, "key": "avatars/kit.png" }
\`\`\`

A published object gets a \`public_url\`:

\`\`\`
https://moogo.dev/pub/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0/avatars/kit.png
\`\`\`

That URL works with no header, no cookie, and no session. You can put it in an
\`<img>\`, a \`<video>\`, or a CSS \`background-image\`.

> **Understand what publishing means.** A public URL is a bearer token. Anyone who
> has the link has the file, and there is no way to make it private again without
> changing the URL. Publish only what you intend to be public — avatars, public
> assets, exported reports — and keep anything sensitive private behind a
> credential.
>
> Private objects are **not** merely awkward to fetch: an unlisted object answers
> \`404\` on the public route, so it is indistinguishable from one that does not
> exist.

You can also publish a whole bucket at once with the same endpoint and no \`key\`,
which sets every object in it.

## Organising with prefixes

Object keys are paths, so use \`/\` to create structure without creating buckets:

\`\`\`
avatars/user-1.png
avatars/user-2.png
exports/2026-09/report.csv
\`\`\`

This gives you filtering and folder-style deletes without spending bucket names
on categories.

### Keys are strict

A key must:

- have no leading slash
- have no \`.\` or \`..\` segments, and no empty segments (\`//\`)
- contain no control characters or NUL
- contain no backslash

Both spellings below are accepted and mean the same object:

\`\`\`
avatars/user-1.png
./avatars/user-1.png
\`\`\`

Both of these are **rejected**:

\`\`\`
../other-project/secrets.txt
avatars//user-1.png
\`\`\`

A key is rejected rather than silently normalised when it contains \`..\`, because
two different keys resolving to one object is more surprising than a clear error.
Maximum key length is **1024 characters**.

## Quota

**256 MB per project**, counted across all buckets — not per bucket. Two buckets
do not give you 512 MB.

Every response that touches storage reports both numbers so you can see where you
stand:

\`\`\`json
{ "storage_used_bytes": 10485760, "quota_bytes": 268435456 }
\`\`\`

If you need space back:

- **Delete objects.** The response to a delete includes \`freed_bytes\`.
- **Delete a whole prefix.** See [Object storage](/docs/object-storage#deleting).
- **Delete a bucket**, which removes every object in it. Confirm the count first
  — it is permanent.

A quota check happens against the declared \`Content-Length\` before a byte is
written, and again against the bytes actually received. Uploads for one project
are serialised so two concurrent large uploads cannot both see room for 100 MB and
together overrun the quota.

## Delete a bucket

\`\`\`bash
curl -X DELETE https://moogo.dev/buckets/$MOOGO_PROJECT_ID/$BUCKET_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

This removes the bucket **and every object in it**, permanently. The response
reports how many objects were deleted:

\`\`\`json
{ "deleted_objects": 42 }
\`\`\`

Check that count before you confirm the deletion in the UI.

## Next

- [Object storage](/docs/object-storage) — upload, download, list, delete
- [Credentials](/docs/credentials) — creating a storage credential
- [Limits](/docs/limits) — every quota in one table`,ti=`# Object storage

Files live under your project with a [storage credential](/docs/credentials) — not
the SQL project key. This page is the full reference.

## Routes

There are three mounts for the same handlers. They behave identically; pick
whichever fits your client.

| Route | Credential | Use it for |
|---|---|---|
| \`/p/{project_id}/bucket/*\` | Storage credential | **Your application.** This is the one to use. |
| \`/bucket/{project_id}/*\` | Storage credential | The original form, kept working. |
| \`/api/projects/{project_id}/bucket/*\` | Session cookie | The dashboard. Not for applications. |

The \`/p/\` form is recommended for new code because the project id is already in
the URL and you append only the object key.

## Authentication

Two headers, on every request:

\`\`\`
X-Moogo-Access-Key-Id: moogo_ak_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
Authorization: Bearer moogo_sk_3nQ8wRtZ2mK5xB9cV1yH4jL7pA0sD6fG2iO7uE
\`\`\`

\`\`\`bash
export ENDPOINT="https://moogo.dev/p/$MOOGO_PROJECT_ID/bucket"

curl "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

The project key does **not** work here, and a credential for one project does not
work against another's URL.

## Upload

\`\`\`bash
curl -X POST "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \\
  -H "Content-Type: image/png" \\
  --data-binary @kit.png
\`\`\`

To choose the bucket explicitly, add \`?bucket=avatars\`:

\`\`\`bash
curl -X POST "$ENDPOINT/kit.png?bucket=avatars" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \\
  -H "Content-Type: image/png" \\
  --data-binary @kit.png
\`\`\`

Response:

\`\`\`json
{
  "success": true,
  "object": {
    "id": "b21d9f04-77a3-4c58-9e0a-2f8c6d5b1e93",
    "bucket_id": "3f8a2c11-9d4e-4b7a-8f21-5e6c3d9a1b84",
    "bucket": "avatars",
    "key": "avatars/kit.png",
    "size_bytes": 24576,
    "content_type": "image/png",
    "is_public": false,
    "etag": "\\"a1b2c3d4\\"",
    "url": "https://moogo.dev/p/8f3c.../bucket/avatars/kit.png",
    "preview_url": "/api/projects/8f3c.../bucket/avatars/kit.png",
    "public_url": "",
    "created_at": "2026-10-01T09:20:11Z",
    "updated_at": "2026-10-01T09:20:11Z",
    "last_modified": "2026-10-01T09:20:11Z"
  },
  "storage_used_bytes": 10485760,
  "quota_bytes": 268435456
}
\`\`\`

### The three URL fields

This trips people up, so it is worth being explicit.

| Field | Route | Needs a credential? | Use it for |
|---|---|---|---|
| \`url\` | \`/p/{id}/bucket/{key}\` | **Yes** — storage credential | Your application fetching a private object. |
| \`preview_url\` | \`/api/projects/{id}/bucket/{key}\` | Session cookie | The dashboard rendering a preview. |
| \`public_url\` | \`/pub/{id}/{key}\` | **No** | Sharing a published object. |

\`url\` is the one your application uses. Do not put it in an \`<img>\` tag: a browser
tab does not carry a storage credential, so the image would break for every
private object. \`public_url\` is empty until the object is published — it is
absent rather than pointing at a route that would \`404\`.

### Upload limits

- **Per object:** the bucket's \`max_object_size_bytes\`, or the project ceiling if
  the bucket sets none.
- **Per project:** 256 MB total, across all buckets.
- **Per request:** the same object cap. The JSON endpoints are capped at 1 MB, but
  storage is not — a 1 MB cap on a 256 MB project would mean nobody could ever
  fill their bucket.

Failures are distinguishable:

| Code | Status | Means |
|---|---|---|
| \`object_too_large\` | 413 | Over **this bucket's** cap. \`detail\` names the limit. |
| \`quota_exceeded\` | 507 | The project total is full. \`detail\` reports usage and quota. |

## Download

\`\`\`bash
curl "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

\`GET\` returns the bytes with the object's \`Content-Type\`. \`HEAD\` returns the same
headers with no body — use it to check existence and size before downloading.

\`\`\`bash
curl -I "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

## Public download

\`\`\`bash
curl https://moogo.dev/pub/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0/avatars/kit.png
\`\`\`

No headers. Serves only objects that were published; anything else returns \`404\`,
so a private object is indistinguishable from a missing one.

## List objects

\`\`\`bash
curl "$ENDPOINT/?bucket=avatars&limit=50&order=created&dir=desc" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

| Query parameter | Notes |
|---|---|
| \`bucket\` | Limit to one bucket. |
| \`prefix\` | Only keys starting with this. This is how you list a "folder". |
| \`search\` | Substring match on the key. |
| \`order\` | \`key\`, \`size\`, \`created\`, \`updated\`, or \`contenttype\`. |
| \`dir\` | \`asc\` or \`desc\`. |
| \`limit\` | Page size. Defaults to 100. |
| \`offset\` | Skip this many, for paging. |

Response:

\`\`\`json
{
  "success": true,
  "bucket": { "id": "3f8a...", "name": "avatars", "object_count": 42, "size_bytes": 10485760 },
  "objects": [ /* … */ ],
  "total": 42,
  "limit": 50,
  "offset": 0,
  "storage_used_bytes": 10485760,
  "quota_bytes": 268435456
}
\`\`\`

\`total\` is the count of everything matching the filter, not the length of
\`objects\`, so you can compute the page count without a second request.

## Update an object

\`PATCH\` changes an object's metadata or key.

**Rename or move:**

\`\`\`json
{ "rename_to": "avatars/2026/kit.png" }
\`\`\`

**Publish or unpublish:**

\`\`\`json
{ "is_public": true }
\`\`\`

Renaming moves the file and updates its record atomically from the caller's point
of view; the object keeps its identity and \`id\`.

## Delete

**One object:**

\`\`\`bash
curl -X DELETE "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

\`\`\`json
{ "deleted": 1, "freed_bytes": 24576 }
\`\`\`

**Everything under a prefix** — this is the folder delete, and it is an explicit
opt-in because it is not obviously destructive from the URL alone:

\`\`\`bash
curl -X DELETE "$ENDPOINT/avatars/?prefix=true" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

\`?prefix=true\` is required. Without it the same URL deletes nothing, so a routine
"clear this folder" call cannot silently wipe it.

## Bucket catalog

\`\`\`bash
curl https://moogo.dev/buckets/$MOOGO_PROJECT_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

\`\`\`json
{
  "success": true,
  "buckets": [
    {
      "id": "3f8a...",
      "name": "avatars",
      "object_count": 42,
      "size_bytes": 10485760,
      "created_at": "2026-10-01T09:14:22Z",
      "is_public": false,
      "allowed_types": ["image"],
      "max_object_size_bytes": 2097152,
      "quota_bytes": 262144000
    }
  ],
  "storage_used_bytes": 10485760,
  "quota_bytes": 268435456
}
\`\`\`

| Method | Path | Purpose |
|---|---|---|
| \`GET\` | \`/buckets/{project_id}\` | List buckets with counts. |
| \`POST\` | \`/buckets/{project_id}\` | Create a bucket. |
| \`PATCH\` | \`/buckets/{project_id}/{bucket_id}\` | Update visibility, upload policy, and quota. |
| \`DELETE\` | \`/buckets/{project_id}/{bucket_id}\` | Delete a bucket and its objects. |
| \`POST\` | \`/buckets/{project_id}/{bucket_id}/public\` | Publish or unpublish the bucket. |

The catalog lives on its own \`/buckets\` prefix rather than under
\`/bucket/{bucket_id}/\`. Folding it in would have meant reserving the key \`bucket\`,
so you could never upload a file with that name — a silent restriction on what
you can store.

## Errors

| Code | Status | Meaning |
|---|---|---|
| \`missing_key\` | 400 | No object key in the path. |
| \`invalid_key\` | 400 | The key breaks the naming rules. |
| \`key_taken\` | 409 | An object with that key already exists in this project. |
| \`not_found\` | 404 | No such object or bucket. |
| \`object_too_large\` | 413 | Over the bucket's per-object cap. |
| \`quota_exceeded\` | 507 | The project storage total is full. |
| \`invalid_prefix\` | 400 | The prefix for a folder delete is not valid. |
| \`storage_error\` | 500 | The request could not be completed. |

All of them use the standard envelope:

\`\`\`json
{ "error": { "code": "object_too_large", "message": "the object is larger than this bucket accepts", "detail": "bucket limit is 2097152 bytes" } }
\`\`\`

## A small client

\`\`\`js
// storage.js
const root = \`\${process.env.MOOGO_BUCKET_ENDPOINT}/p/\${process.env.MOOGO_PROJECT_ID}/bucket\`;

const headers = {
  "X-Moogo-Access-Key-Id": process.env.MOOGO_BUCKET_ACCESS_KEY_ID,
  Authorization: \`Bearer \${process.env.MOOGO_BUCKET_SECRET_KEY}\`,
};

async function storage(path = "", init = {}) {
  const response = await fetch(\`\${root}/\${path}\`, { ...init, headers });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message ?? "storage request failed");
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

export const upload = (key, file, bucket) =>
  storage(\`\${encodeKey(key)}\${bucket ? \`?bucket=\${bucket}\` : ""}\`, {
    method: "POST",
    headers: { ...headers, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

export const download = (key) =>
  storage(key).then((result) => result); // returns the object metadata

export const list = (prefix) =>
  storage(\`?prefix=\${encodeURIComponent(prefix)}&limit=100\`);

// Slashes are meaningful in a key, so encode each segment and keep them.
const encodeKey = (key) =>
  key.split("/").map(encodeURIComponent).join("/");
\`\`\`

## Next

- [Create a bucket](/docs/create-bucket) — policies and public objects
- [Credentials](/docs/credentials) — storage credentials in detail
- [Security](/docs/security) — how public URLs and key validation work`,ni=`# Dashboard

The dashboard is a full studio for your database: browse and edit rows as a
spreadsheet, build tables without writing migrations, run SQL in a console, and
watch what every request did.

It needs **no project key**. Your session cookie authorises it, because you are
the owner. This is the one place worth understanding before you start clicking.

## Why the dashboard does not ask for your key

The principle is that a secret key in a browser leaks. Devtools, a screenshot, or
a browser extension is enough, and once it is out there you have no way to know
how many copies exist.

That principle has an obvious consequence: the dashboard must not receive the key.

But there is a catch worth being honest about. The server stores only a **hash**
of your key, and a hash cannot be turned back into the key. So the server
genuinely cannot proxy requests to the database on your behalf. The two positions
cannot both be satisfied.

Moogo takes the position that keeps the key out of the browser, which means the
dashboard talks to the data plane using **your session**, and the server
authorises each request by checking that you own the project.

### What this means practically

- The dashboard works even if you have never seen your project key.
- SQL run in the dashboard console goes through **the same sanitizer and the same
  read/write rules** as the public API. Behaviour you see here is behaviour your
  application gets.
- If you rotate the key, the dashboard keeps working. Nothing to update.

## Pages

| Path | What it is |
|---|---|
| \`/app\` | Overview: your projects, usage, and quick actions. |
| \`/app/projects\` | All projects. |
| \`/app/projects/{id}\` | The project page — database, bucket, settings. |
| \`/app/settings\` | Account settings. |

## The database tab

### Browse tables

Pick a table from the list and its rows appear as a spreadsheet. Sort, filter,
and page through them. This is the fastest way to check what your application
actually wrote.

For large tables, filtering by a prefix or a search string avoids loading
everything.

### Create a table

**Create table** opens a builder: name, columns, types, primary key, nullability,
and defaults. It generates the \`CREATE TABLE\` and runs it.

The same sanitizer applies, so a table or column name that trips a blocked keyword
is refused here too — the builder tells you what to change rather than failing
silently.

Use the builder rather than hand-writing DDL when you can: it produces
consistent naming and you cannot forget a comma.

### Edit rows

Add, edit, and delete rows directly in the spreadsheet. Each change runs as a
parameterised statement, so values are bound rather than interpolated.

Edits are **immediate** — there is no separate save step, and no transaction to
remember. That is convenient for exploration and risky for bulk work; take a
[backup](#download-a-backup) before a large edit.

### SQL console

Run any statement directly. The console shows results as a grid, and reports the
server-side duration.

- Reads go to \`/query\`, writes to \`/exec\`, chosen automatically.
- Rejections show the same error \`code\` and \`detail\` your application would get,
  which makes the console a good place to reproduce an error before fixing it.
- **Paste a whole script.** Several statements separated by \`;\` run one after
  another in order, each as its own request — the
  [one-statement rule](/docs/sql-api#one-statement-per-request) still applies per
  request. The batch stops at the first error; statements that already ran stay
  applied, because no transaction spans the batch.
- **Examples** below the editor load ready-made statements into the editor —
  schema, reads, writes, inspection. Nothing runs until you press Run.

## The bucket tab

Browse, upload, and organise files.

- **Upload** respects the bucket's policy, so a rejected file tells you why —
  wrong type or over the size cap.
- **Preview** renders images, video, audio, and text inline. Private files preview
  correctly because the dashboard uses its own session-scoped route rather than
  the credential-requiring URL.
- **Public** toggles whether an object is readable at a URL with no credential.
- **Credentials** manages [storage credentials](/docs/credentials) and shows each
  secret once on creation.

Renaming and deleting work on objects and on whole prefixes.

## Settings tab

Where [project management](/docs/create-project#managing-the-project) lives:
rotate key, pause, resume, delete, and download a backup.

### Download a backup

**Download backup** gives you the whole database as a \`.db\` file.

It uses your session, not a project key, so it works from the dashboard even if
you have lost the key.

Take one before anything destructive — a large edit through the spreadsheet, a
schema change, or a bulk delete. It is a full SQLite file, so you can open it with
any SQLite tooling.

## Activity log

Every request against your project is recorded with its method, path, status, and
duration. Use it to answer two questions: **what ran**, and **what it cost**.

A few things it is good for:

- Confirming a deployment is actually reaching the right project.
- Finding which query is slow, from the \`duration\` column.
- Spotting requests you do not recognise after rotating a key.
- Checking that a background job is still running.

It is kept for **7 days** and then pruned.

## Account settings

\`/app/settings\` shows your name, your email, and your plan, and lets you sign
out.

Your **email cannot be changed here**. It is how Moogo recognises you, and it has
to match the address on your Google account — if the two drifted apart, signing
in with Google would quietly create a second account.

**Password** depends on how you sign in:

- An email/password account gets a change form that asks for your current
  password before setting a new one. A stolen session cookie on its own cannot
  take the account over, because the cookie is not enough to replace the
  password.
- A Google-only account is told that its password lives at Google, with a link to
  Google account security. Moogo has never seen that password, so it cannot
  change or reset it, and it will not offer a form that would create a second
  credential Google does not know about.

Changing your password does not sign out your other sessions. The session cookie
is a signed token rather than a row in a table, so there is nothing to revoke;
if you think a session is compromised, change the password at the provider you
sign in with and sign out on the devices you still have.

**Plan** is read from your account, alongside what you are using against the
limits. There are no billing controls in this version — every account is on the
same plan — so **See plans** is there but inert.

## Access rules

Ownership is checked on **every request**, not once at sign-in.

A project belonging to another account returns \`404\`, not \`403\`. That is
deliberate: a \`403\` confirms the project exists, which would turn the id in a URL
into a way to discover other people's projects. \`404\` tells you nothing.

Pausing a project stops the dashboard too, not just the API. Otherwise pausing
would appear to work while files kept changing.

## Next

- [Create a project](/docs/create-project) — settings in more detail
- [SQL API](/docs/sql-api) — what the console is calling
- [Security](/docs/security) — the model behind all of this`,ri=`# Limits

Every limit below is enforced by the server. Most come back **in the response**, so
you find out from the API rather than from a hung tab or a surprise bill.

## Quotas

| Limit | Value | Enforced |
|---|---|---|
| Projects per account | **2** | Checked inside the transaction that creates a project. |
| Database size | **100 MB** per project | Before *and* after every write. |
| Storage | **256 MB** per project | On upload, against usage plus declared size. |
| Object size | Bucket's \`max_object_size_bytes\`, or 256 MB | On upload. |

### Projects per account

Two. \`POST /api/projects\` returns \`429 quota_exceeded\` for a third.

The check happens **inside the transaction** that creates the project, not before
it. Two simultaneous requests cannot both pass a check-then-create and leave you
with three projects.

### Database size

100 MB, measured as \`page_count * page_size\` — the real size on disk, not an
estimate.

The check runs **before** the write commits and again after. A write that would
cross the ceiling is refused; it is not partially applied and it is not silently
truncated.

\`\`\`json
{ "error": { "code": "database_too_large", "message": "the database has reached its size limit" } }
\`\`\`

Note that a database does not shrink on its own. Deleting rows frees space
*inside* the file for reuse, but the file does not get smaller. A database that
once grew past 100 MB stays large, and you will keep needing to delete.

### Storage

256 MB **per project**, summed across all buckets. Two buckets do not give you
512 MB.

Every storage response reports usage and quota:

\`\`\`json
{ "storage_used_bytes": 10485760, "quota_bytes": 268435456 }
\`\`\`

The quota is checked against the declared \`Content-Length\` before a byte is
written, and again against what actually arrived. Uploads for one project are
serialised, so two concurrent large uploads cannot both see room and together
overrun the quota.

## Request limits

| Limit | Value | Error code |
|---|---|---|
| Request body (JSON endpoints) | **1 MB** | \`body_too_large\` |
| Request body (storage uploads) | Bucket cap or 256 MB | \`object_too_large\` |
| Statement length | **64 KB** | \`sql_too_long\` |
| Statement duration | **15 seconds** | \`statement_timeout\` |
| Storage credentials per project | **5** | \`storage_credential_limit\` |
| Sign-in endpoints | **10 / minute / client address**, shared | \`rate_limited\` |
| Data plane | **300 / minute** — queries per project, storage per address | \`rate_limited\` |

The JSON and storage caps differ on purpose. They guard different things: a JSON
body is a statement or a settings object where anything past a megabyte is a
mistake, while an upload is a file. A shared 1 MB cap would mean a project with
256 MB of storage could never store an image.

The body limit stops the request **while reading it**, not after the whole body is
in memory.

A statement that passes 15 seconds is **cancelled in the engine**, not left to time
out at the HTTP layer, so the connection is not held open.

## Retention

| Data | Kept |
|---|---|
| Activity log | **7 days**, then pruned on a schedule |
| Secrets | Once. Only a hash and a short prefix are stored. |

## What is *not* limited

Worth knowing explicitly, because these are common assumptions:

- **No idle timeout.** A project does not pause after inactivity. No cold start.
- **No automatic backup schedule.** Download one from the project settings when
  you want it.

## If you hit a limit

| Error | What to do |
|---|---|
| \`quota_exceeded\` on project creation | Delete an unused project, or [pause](/docs/create-project#pausing) it if you only need to stop using it. Pausing does not free the slot — it is still a project. |
| \`database_too_large\` | Delete rows you no longer need. Remember the file itself will not shrink. If you genuinely need more, this is the ceiling to design around. |
| \`statement_timeout\` | Look at the query. Add an index, narrow the \`WHERE\`, or page the result. |
| \`sql_too_long\` | Generate fewer statements per request. One statement per request is the rule. |
| \`body_too_large\` | Send less in one call. Page a listing instead of requesting everything. |
| \`object_too_large\` | Lower the bucket's \`max_object_size_bytes\`, or compress the file. |
| \`storage_credential_limit\` | Revoke the credentials you no longer use — 5 is the cap. |

## Designed to be visible

A limit you cannot see is a limit you discover in production. So:

- Storage responses carry \`storage_used_bytes\` and \`quota_bytes\`.
- Writes carry \`size_bytes\`.
- Queries carry \`duration_ms\`, so you can watch a slow query get slower before it
  times out.
- Reads carry \`truncated\`, so you know a result set was capped rather than
  complete.

Track these rather than guessing where you stand.

## Next

- [Security](/docs/security) — why these limits exist
- [Errors](/docs/errors) — the full error code table`,ii=`# Security

This page explains how Moogo is built to fail safely, and — just as importantly —
what the model does **not** protect you from.

## Multi-tenancy

Each project maps to one SQLite file:

\`\`\`
/data/dbs/{project_id}.db
/data/buckets/{project_id}/{key}
\`\`\`

Isolation comes from the filesystem, not from a policy. There is no shared table
and no \`tenant_id\` column to forget in a \`WHERE\` clause, because there is no
shared table.

### The path is validated, not trusted

\`project_id\` comes from a URL, and a URL is untrusted input. It is validated as a
UUID before anything else happens, and the on-disk path is then **rebuilt from the
validated components** rather than assembled from the raw string.

That is the structural reason path traversal is impossible here: there is no code
path where raw input becomes a path.

A malformed id returns \`400 invalid_project_id\` before any lookup happens.

### Ownership is checked per request

Ownership is verified on **every** request, not once at sign-in.

Another account's project returns \`404\`, not \`403\`. A \`403\` would confirm the
project exists, which turns the id in a URL into a way to enumerate other people's
projects. \`404\` tells an attacker nothing.

## Statement validation

Because \`/exec\` accepts DDL, it could otherwise become a primitive for reading the
host filesystem. Every statement is **tokenized and inspected before it runs**.

### Checked on tokens, not on text

Matching happens after tokenization, not with a substring search. This matters:
a table called \`attachments\` does not contain the keyword \`ATTACH\` as far as the
checker is concerned, because \`ATTACH\` appears as part of a longer identifier
rather than as a standalone word.

A naive \`strings.Contains(text, "ATTACH")\` would reject \`SELECT * FROM
attachments\`. The token-based check does not.

The exception is the blocked **function names**, which are matched anywhere they
appear — including as a column name. A column literally named \`readfile\` is
refused. That is a deliberate trade: a confusingly-named column is a far smaller
cost than a readable \`/etc/passwd\`.

### What is refused

| Category | Items |
|---|---|
| File access | \`ATTACH\`, \`DETACH\` |
| Whole-file rewrites | \`VACUUM\`, \`REINDEX\`, \`ANALYZE\` |
| Transaction control | \`BEGIN\`, \`COMMIT\`, \`ROLLBACK\`, \`SAVEPOINT\`, \`RELEASE\` |
| Filesystem builtins | \`readfile\`, \`writefile\`, \`load_extension\`, \`edit\`, \`fts3_tokenizer\`, \`sqlite_compileoption_get\`, \`sqlite_compileoption_used\` |
| Triggers | \`CREATE TRIGGER\` |
| File-writing pragmas | Anything not on the [allowlist](/docs/sql-api#pragma) |

\`ATTACH\` is the important one: it opens an arbitrary path as a database, which
would turn the write endpoint into a file reader for the entire host.

\`PRAGMA\` is **allowlisted rather than blocked**, because many pragmas write to the
file (\`journal_mode\`, \`key\`, \`rekey\`, \`page_size\`, \`auto_vacuum\`,
\`synchronous\`) and a blocklist would have to anticipate all of them.

### Triggers are declined on purpose

A trigger body sits between \`BEGIN\` and \`END\` and contains semicolons, so
distinguishing its semicolons from a stacked statement needs a real parser that
tracks nesting. A hand-rolled approximation is exactly the kind of check that
fails open on input SQLite accepts but the code does not.

Triggers are declined rather than shipping a check that might be wrong. Write your
invariants in application code.

## Prepared statements only

Values are always bound parameters:

\`\`\`json
{ "query": "SELECT id FROM users WHERE email = ?", "args": ["ketut@example.com"] }
\`\`\`

The engine only ever sees a parameterised statement, so **a value can never become
syntax**. This is not "injection mostly prevented" — on this path it is
structurally impossible.

Unknown JSON fields are rejected rather than ignored. A client sending
\`{"argz": [...]}\` gets an error, not a success that silently did nothing.

## Secret storage

| Credential | Stored |
|---|---|
| Project key | SHA-256 hash + 8-character prefix |
| Storage secret | SHA-256 hash + 6-character preview |
| Password | Salted hash |

Plaintext appears in exactly one response — the create or rotate that issued it —
and is never recoverable afterwards.

Hash comparison is **constant-time**, so verification does not leak how many bytes
matched.

The practical test: a dump of the control plane database yields hashes, not
working credentials. Because the keys are not recoverable in the first place,
there is nothing for an attacker to reverse.

Unsalted SHA-256 is correct for these hashes specifically: the secret already has
256 bits of entropy from \`crypto/rand\`, so there is no guessing space for a salt
to close.

## Credentials are scoped

A project key runs SQL. A storage credential moves files. The dashboard uses a
session. **None of them works for the others.**

This is not bureaucracy. A key scoped to running \`SELECT\` should not be able to
overwrite every file in a project, and rotating the SQL key should not silently
break every running application.

## Public object URLs

A published object is readable at \`/pub/{project_id}/{key}\` with no credential, no
session, and no cookie.

A **private** object returns \`404\` there — not \`403\` — so it is indistinguishable
from one that does not exist. Someone guessing keys learns nothing from the
response.

Understand what publishing means before you do it: **a public URL is a bearer
token.** Anyone with the link has the file, and you cannot make it private again
without changing the URL.

## Response headers

Every response carries:

| Header | Value |
|---|---|
| \`Content-Security-Policy\` | \`default-src 'self'\`; no inline scripts, no external sources |
| \`X-Content-Type-Options\` | \`nosniff\` |
| \`X-Frame-Options\` | \`DENY\` |
| \`Referrer-Policy\` | \`strict-origin-when-cross-origin\` |
| \`Strict-Transport-Security\` | Over HTTPS only |
| \`Cache-Control\` | \`no-store\` on all API routes |

\`no-store\` matters because the dashboard shows secret material on create and
rotate. A cached response body would hand it to whoever asked next.

HSTS is only sent over HTTPS, so local development over plain HTTP does not leave
a browser refusing to reach the site afterwards.

## Error messages

Errors do not leak internals.

\`detail\` on a SQL error carries the driver's message, which can name tables and
columns — useful to you, and revealing nothing about the host. Internal failures
return a generic message, and a panic returns nothing useful at all.

## What this model does not protect

Being clear about this is more useful than a reassuring summary.

- **A leaked key works.** If your project key is compromised, the attacker has your
  database until you rotate. There is no IP allowlist, no per-IP rate limit at the
  application layer, and no way to restrict a key to an IP. Rotation is the
  mitigation, and it is fast.
- **Public URLs cannot be revoked.** Only the URL containing them can change.
- **Nothing is encrypted at rest.** The database file and stored objects are
  plaintext on disk. Protection here depends on host and disk-level access control.
- **There is no multi-factor authentication.** One email and a password is the
  whole account security model.
- **Rate limits are ceilings, not traffic shaping.** The data plane allows 300
  requests a minute — queries keyed per project, storage operations per client
  address — enough to stop a runaway client or a stolen key from saturating the
  host, not enough to shape ordinary use. The sign-in endpoints
  (\`/auth/login\`, \`/auth/register\`, \`/auth/forgot-password\`,
  \`/auth/reset-password\`, \`/auth/verify-email\`, \`/auth/resend-verification\`)
  share 10 attempts a minute per client address, because they are the ones an
  unauthenticated caller can hammer. A \`429\` carries a \`Retry-After\` header.
- **SQLite writes are serialised per project.** This is a property of the engine,
  not something Moogo configures away. High write concurrency will queue.

## Running behind a proxy

If the deployment sits behind a reverse proxy — Caddy, nginx, a load balancer —
then \`MOOGO_TRUSTED_PROXIES\` should list that proxy's address:

\`\`\`
MOOGO_TRUSTED_PROXIES=127.0.0.1,::1
\`\`\`

Without it, every request looks like it came from the proxy, so a per-client
limit would treat all visitors as one caller and a shared bucket would lock
everyone out at once.

It is a list of addresses, and it is trusted exactly as written. Moogo believes
\`X-Forwarded-For\`, \`X-Real-IP\` and \`True-Client-IP\` only from a proxy named
here; from anybody else those headers are ignored, so a client cannot pick its
own identity to slip past a limit or poison the access log. Do not list \`0.0.0.0\`
or \`::\` — that is the same as trusting everybody.

## Reporting a vulnerability

If you find something that looks wrong, please
[report it](/docs/feedback). Security reports are handled as priority, and you
will get an acknowledgement.`,ai=`# Errors and troubleshooting

Every error from the Moogo API has the same shape. Branch on \`code\`, not on
\`message\`.

## The error envelope

\`\`\`json
{
  "error": {
    "code": "sql_forbidden_keyword",
    "message": "this statement type is not allowed",
    "detail": "ATTACH"
  }
}
\`\`\`

| Field | Notes |
|---|---|
| \`code\` | Stable and machine-readable. Safe to branch on. |
| \`message\` | Human-readable. Safe to show a developer. |
| \`detail\` | Optional. For SQL errors, the offending token or the driver's message. |

There is exactly one shape across the whole API. You do not need to guess whether
a failure is \`{"error": "..."}\` or \`{"message": "..."}\`, so you do not need a
\`try/catch\` variant per endpoint.

## Handling errors

\`\`\`js
async function sql(query, args = []) {
  const response = await fetch(\`\${base}/query\`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, args }),
  });

  const body = await response.json();
  if (!response.ok) {
    // code is stable and safe to branch on.
    throw Object.assign(new Error(body.error.message), {
      code: body.error.code,
      detail: body.error.detail,
      status: response.status,
    });
  }
  return body;
}
\`\`\`

A useful rule: **retry only on \`429\` and \`5xx\`.** Everything else is a decision the
code already made, and retrying the same request will produce the same error.

## SQL validation errors

These mean the statement was refused **before** it touched the database. All are
\`400\`.

| Code | Meaning | Fix |
|---|---|---|
| \`sql_empty\` | No statement was sent. | Check that \`query\` is present and not an empty string. |
| \`sql_syntax_error\` | Could not be tokenized. | Usually an unterminated string literal or comment. \`detail\` gives the byte offset. |
| \`sql_multiple_statements\` | More than one statement. | Send one statement per request. Split them. |
| \`sql_forbidden_keyword\` | A blocked keyword or a trigger. | \`detail\` names it. See [what is rejected](/docs/sql-api#what-is-rejected). |
| \`sql_forbidden_function\` | A blocked function name. | Usually a column named \`readfile\` or \`edit\`. Rename it. |
| \`sql_forbidden_pragma\` | PRAGMA not on the allowlist. | Use one of the [allowed pragmas](/docs/sql-api#pragma). |
| \`sql_too_long\` | Statement over 64 KB. | Split it into several requests. |
| \`not_a_read\` | A write was sent to \`/query\`. | Send it to \`/exec\`. |
| \`not_a_write\` | A read was sent to \`/exec\`. | Send it to \`/query\`. |
| \`invalid_json\` | Body was not valid JSON. | Check quoting, especially around SQL that contains \`"\`. |

### A note on \`sql_too_long\`

A statement over 64 KB is refused. If you are generating SQL programmatically,
this usually means you are building one giant \`INSERT\`. Send batches instead:

\`\`\`js
const batch = 500;
for (let index = 0; index < rows.length; index += batch) {
  const slice = rows.slice(index, index + batch);
  const placeholders = slice.map(() => "(?, ?, ?)").join(", ");
  const values = slice.flatMap((row) => [row.id, row.email, row.plan]);
  await run(
    \`INSERT INTO users (id, email, plan) VALUES \${placeholders}\`,
    values,
  );
}
\`\`\`

## Runtime SQL errors

| Code | Status | Meaning |
|---|---|---|
| \`sql_error\` | 400 | SQLite rejected the statement. \`detail\` has the driver's message. |
| \`database_not_found\` | 404 | The project database does not exist. |
| \`statement_timeout\` | 504 | Passed 15 seconds and was cancelled. |
| \`database_too_large\` | 413 | The database is at its 100 MB ceiling. |

### \`sql_error\` — read \`detail\`

This is SQLite's own message and it is usually specific:

| \`detail\` contains | Cause |
|---|---|
| \`no such table\` | The table does not exist, or the name is wrong. |
| \`no such column\` | The column does not exist in this table. |
| \`UNIQUE constraint failed\` | A duplicate value in a unique column or primary key. |
| \`FOREIGN KEY constraint failed\` | The referenced row does not exist. Foreign keys are on. |
| \`datatype mismatch\` | A value's type does not fit the column. |
| \`NOT NULL constraint failed\` | A required column was omitted or null. |

SQLite reports these as one generic error, so \`detail\` is where the actual
explanation lives. Log it.

## Request errors

| Code | Status | Meaning |
|---|---|---|
| \`body_too_large\` | 413 | Request body over 1 MB. |
| \`invalid_project_id\` | 400 | The id in the URL is not a valid UUID. |
| \`invalid_body\` | 400 | Body was not a JSON object with the expected fields. |
| \`unsupported_media_type\` | 415 | \`Content-Type\` was not \`application/json\`. |
| \`not_found\` | 404 | No such endpoint. Check the path. |
| \`rate_limited\` | 429 | Too many requests from one client address. Comes with a \`Retry-After\` header. |

\`invalid_body\` usually means a **typo in a field name**. Unknown fields are
rejected rather than ignored, so \`{"is_pubic": true}\` is an error rather than a
success that did nothing.

## Authentication and authorization

| Code | Status | Meaning |
|---|---|---|
| \`unauthorized\` | 401 | Missing, malformed, wrong, or revoked key. |
| \`project_not_found\` | 404 | No such project, **or** it is not yours. |
| \`project_paused\` | 403 | The project is paused. Resume it. |
| \`project_not_ready\` | 403 | The project is still being created. |
| \`method_not_allowed\` | 405 | Wrong HTTP method for this route. |

### When you get \`rate_limited\`

Only the sign-in endpoints are limited: \`/auth/login\`, \`/auth/register\`,
\`/auth/forgot-password\`, \`/auth/verify-email\` and \`/auth/resend-verification\`,
at 10 attempts a minute per client address. The allowance is shared across all
five, so moving from one to the next does not reset it.

The \`429\` carries a \`Retry-After\` header in seconds. Honour it rather than
retrying immediately — the header says how long until a whole attempt is back,
not when a window resets, so waiting exactly that long is enough.

Two things worth knowing if you are seeing this when you did not expect it:

- Behind a reverse proxy, set \`MOOGO_TRUSTED_PROXIES\` to the proxy's address. See
  [running behind a proxy](/docs/security#running-behind-a-proxy). Without it
  every visitor shares one bucket, and the limit becomes a shared outage rather
  than a per-caller ceiling.
- The limiter is in memory and resets when the process restarts, and it keys on
  the address the request came from. It is a brake on casual guessing, not a
  substitute for one at the edge.

### When you get \`unauthorized\`

1. **Is it the right key?** Check \`secret_key_prefix\` in the dashboard against the
   start of your key.
2. **Is it the right scheme?** Only \`Bearer\` is accepted — not Basic, not a bare
   token.
3. **Did you rotate?** Rotation invalidates the old key immediately.
4. **Did you include the header on every request?** Some HTTP clients drop headers
   on redirects.

For storage, also check that you are sending **both** headers:
\`X-Moogo-Access-Key-Id\` and \`Authorization: Bearer\`.

### \`project_not_found\` when the project exists

This code covers two cases on purpose: the project does not exist, **or** it is
not yours. If you are certain the project is yours, check that the id in the URL
matches the one you expect — this is what a copy-paste of the wrong project id
looks like.

## Storage errors

| Code | Status | Meaning |
|---|---|---|
| \`missing_key\` | 400 | No object key in the path. |
| \`invalid_key\` | 400 | The key breaks the [naming rules](/docs/create-bucket#keys-are-strict). |
| \`invalid_prefix\` | 400 | The prefix for a folder delete is not valid. |
| \`key_taken\` | 409 | An object with that key already exists. |
| \`not_found\` | 404 | No such object or bucket. |
| \`object_too_large\` | 413 | Over the bucket's per-object cap. |
| \`quota_exceeded\` | 507 | The project storage total is full. |
| \`storage_error\` | 500 | The request could not be completed. |

### \`key_taken\`

Object keys are unique within a project. To overwrite, send to the same key with a
different operation — \`PATCH\` to change it, or delete first and upload again. A
plain \`POST\` to an existing key is refused rather than silently replacing the file.

## Common problems

### "Everything works in the dashboard but not in my app"

The dashboard uses your **session**, not a project key. So the SQL and the data
are fine, and the difference is the credential. Check:

- Is \`MOOGO_SECRET_KEY\` in the deployed environment, not just your shell?
- Did you restart after adding it?
- Is there a trailing newline or quotes in the value?
- Did a deploy rotate the key? Get the current prefix from the dashboard.

### "My query works but my insert says \`no such column\`"

A column name is case-sensitive in SQLite but not in the error message. Check the
exact spelling from \`PRAGMA table_info(your_table)\` rather than assuming.

### "The response says \`truncated: true\`"

A row cap was hit. The result is not the whole table — do not treat it as
complete. Page the query with \`LIMIT\` and \`OFFSET\`.

### "It suddenly started returning 403 project_paused"

Something paused the project, most likely a person. Check the project's Settings
tab, and note that pausing affects both the dashboard and the API.

### "Uploads succeed but \`<img>\` shows a broken image"

You are pointing an \`<img>\` at \`url\`, which needs a storage credential a browser
tab does not have. Use \`public_url\` after publishing the object, or \`preview_url\`
in the dashboard.

### "I get 401 on storage but SQL works"

You are probably sending the **project key** to a storage endpoint. Storage rejects
it by design. Create a [storage credential](/docs/credentials).

## Next

- [SQL API](/docs/sql-api) — the request and response reference
- [Limits](/docs/limits) — what causes the size and timeout errors
- [Feedback](/docs/feedback) — if something here is wrong or unclear`,oi=`# Feedback

Moogo is built in public and shaped by what people actually try to do with it.
Feedback is genuinely useful here — especially the parts that were unclear.

## Where to send it

### Bugs and feature requests

[Open an issue](https://github.com/moogodev/moogodev/issues/new/choose) on the
project's GitHub repository — the templates ask for exactly the fields listed
below. Issues are the fastest route, and everything is tracked publicly.

When reporting something, include:

- **What you did** — the request or the steps in the dashboard.
- **What you expected.**
- **What happened instead.**
- **The \`code\` from the error envelope**, if there was one. See
  [Errors](/docs/errors).
- **Which surface it happened on** — dashboard, SQL API, or storage API.

That last one matters, because the dashboard and the public API are separate
authorization paths over shared handlers. A difference between them is a real
signal, not noise.

Never paste a secret key into an issue. If you have already, rotate it first —
see [Credentials](/docs/credentials#if-a-credential-leaks).

### Security vulnerabilities

Please report security issues privately rather than in a public issue. The
channels are the project's
[security policy](https://github.com/moogodev/moogodev/security/policy):

- **Email** — [moogo.dev@gmail.com](mailto:moogo.dev@gmail.com), subject
  \`[SECURITY]\`.
- **GitHub Security Advisories** — a private report against the repository.

Include what is affected, how to reproduce it, and the impact you believe it
has. You will get an acknowledgement.

### Documentation problems

If a page here is wrong, out of date, or just confusing, that is a bug worth
reporting. Documentation corrections are credited, and "this step did not work as
written" is one of the most useful things you can send.

## What is genuinely useful

The most valuable reports are the ones that describe a **task you were trying to
complete**, not a feature you would like.

> "I tried to upload avatars from a Cloudflare Worker. The docs say to use
> \`url\`, but that needs a credential a browser cannot send, so I had to publish
> every avatar. What is the right pattern?"

That tells us something specific. "Add more file types" does not.

## What tends not to be actionable

- **"It's slow."** Duration is returned in every SQL response and shown in the
  console. The \`duration_ms\` value, the statement, and the row count are enough to
  start.
- **"Add support for X."** Genuinely considered when it fits the design, but much
  more useful with a description of what you would build with it.
- **Requests for more quota or a paid tier.** There is no billing in this version,
  so every account shares the same limits. Feedback here is noted.

## Things already decided, and why

So you do not have to ask, and so the reasoning is on the record:

| Request | Answer |
|---|---|
| Triggers | Declined. Detecting them needs a real parser, and a hand-rolled check fails open on valid SQLite. Write invariants in application code. |
| \`ATTACH\` | Declined. It would make the write endpoint a file reader for the whole host. |
| Idle auto-pause | Not a feature. Projects stay on, so there is no cold start. Pause deliberately if you want. |
| More storage credentials | Capped at 5 per project. Revoke unused ones. |
| The project key for storage | Deliberately refused. They guard different things. |
| Password reset | Supported — see [Register](/docs/register#forgotten-password). |

## Contributing

Moogo is MIT licensed and written in Go with a React frontend. Contributions are
welcome, especially:

- Documentation that is clearer than what is here.
- Bug reports with a reproduction.
- Frontend work — the dashboard is the most open area.

Keep changes small and focused, and describe the problem being solved rather than
only the mechanism.

## Roadmap

Roughly, in order:

1. **Self-hosting** — an installer and a Docker image, so you can run it yourself.
2. **More quota**, with billing behind it.
3. **Official SDKs** — JavaScript, Python, Go.
4. **Range requests and cache headers** on object downloads.
5. **Additional OAuth providers.**

Multi-node and cross-region replication are the biggest architectural changes
still ahead. The groundwork is in place — the control plane and data plane are
already separate, and the project id lives in the URL — so routing to another node
does not change the shape of the API. See [Why Moogo](/docs/why-moogo) for the
reasoning.

## Thank you

Every account, every issue, and every "this confused me" message has shaped this.
The [errors page](/docs/errors) in particular is built almost entirely from real
reports, and the distinction between \`object_too_large\` and \`quota_exceeded\` exists
because someone could not tell which one they had hit.

## Next

- [What is Moogo](/docs/what-is-moogo) — back to the beginning
- [Quickstart](/docs/quickstart) — make a query in two minutes`,si=`# AI Adoption Prompt

A self-contained reference to Moogo — a hosted SQLite database and object
storage over HTTP — written for AI coding agents. Save this page as \`moogo.md\`
in your project and point your agent at it, so it knows what Moogo is and how
to call it before it writes a line of code.

## What Moogo is

Moogo gives each project its own SQLite database and its own object storage,
both reached over plain HTTP. There is no connection string and no database
driver: SQL travels as JSON in a POST request, and files travel as raw request
bodies. One account can hold up to two projects.

Three surfaces, each with its own credential:

- **SQL** — \`POST {PROJECT_URL}/query\` for reads, \`POST {PROJECT_URL}/exec\`
  for writes, authorized with the project's secret key.
- **Object storage** — \`POST/GET/DELETE {PROJECT_URL}/bucket/{key}\`,
  authorized with a separate storage credential.
- **Dashboard** — \`/app\`, session cookie, for browsing tables, running queries
  by hand, and downloading backups. Not for applications.

The service is in development: usable for testing, not ready for production.
Read [Limits](/docs/limits) before designing around it.

## How it is used

1. Register at \`/register\` and confirm the email.
2. Create a project in the dashboard. The secret key is shown once, at creation
   and at each rotation — only a hash is stored, so put it in the environment
   immediately.
3. Put these in the project's environment:

\`\`\`bash
MOOGO_PROJECT_URL=https://moogo.dev/p/<project_id>
MOOGO_PROJECT_ID=<project_id>
MOOGO_SECRET_KEY=...             # SQL only
MOOGO_BUCKET_ACCESS_KEY_ID=...   # object storage only
MOOGO_BUCKET_SECRET_KEY=...      # object storage only
\`\`\`

4. Call the APIs. Every JSON request must send
   \`Content-Type: application/json\` — a body declared as anything else is
   refused with \`415 unsupported_media_type\`.

On moogo.dev the base is \`https://moogo.dev\`; a self-hosted deployment uses its
own public URL. Read credentials from the environment. Never ask the user to
paste them, and never print them.

## SQL API

| Endpoint | Accepts | Rejects |
|---|---|---|
| \`/query\` | Reads — \`SELECT\`, \`VALUES\`, \`PRAGMA\`, \`EXPLAIN\` | Writes, with \`not_a_read\` |
| \`/exec\` | Writes — \`INSERT\`, \`UPDATE\`, \`DELETE\`, \`CREATE\`, \`ALTER\`, \`DROP\` | Reads, with \`not_a_write\` |

Request, authorized with the SQL key:

\`\`\`bash
curl "$MOOGO_PROJECT_URL/query" \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "SELECT id, email FROM users WHERE plan = ?", "args": ["pro"]}'
\`\`\`

Response from \`/query\`:

\`\`\`json
{
  "success": true,
  "columns": ["id", "email"],
  "rows": [["7c1f", "ketut@example.com"]],
  "row_count": 1,
  "truncated": false,
  "duration_ms": 2
}
\`\`\`

\`rows\` are arrays aligned with \`columns\`, not objects. \`/exec\` answers
\`{"success": true, "rows_affected": 1, "row_count": 1, "duration_ms": 2}\`.
Every failure, on any endpoint, uses one envelope:

\`\`\`json
{ "error": { "code": "not_a_read", "message": "...", "detail": "..." } }
\`\`\`

Rules the engine enforces, not conventions:

- \`?\` placeholders with an \`args\` array — values are bound as
  prepared-statement arguments, never concatenated into SQL.
- One statement per request. Stacked statements (\`a; b\`) are rejected.
- File functions (\`readfile\`, \`writefile\`, \`load_extension\`) are rejected.
- Statements are capped at 64 KB and cancelled after 15 seconds.
- Results cap at 1000 rows; \`truncated: true\` means there is more to fetch.

## Object storage (buckets)

Storage takes its own credential. The two credential types are **not**
interchangeable — the SQL key on a bucket request gets 401, and the storage
credential on SQL gets 401. Two headers on every storage request:

\`\`\`
X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID
Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY
\`\`\`

With \`ENDPOINT=$MOOGO_PROJECT_URL/bucket\`:

| Action | Request |
|---|---|
| Upload | \`POST $ENDPOINT/{key}\` — the body is the file bytes and the \`Content-Type\` is the file's own type, **not** \`application/json\`. \`?bucket=NAME\` picks a bucket; no bucket means \`default\`. |
| Download | \`GET $ENDPOINT/{key}\` — returns the bytes with the object's \`Content-Type\`. |
| Delete | \`DELETE $ENDPOINT/{key}\` |
| List | \`GET $ENDPOINT/?limit=100&order=key&dir=asc\` — add \`?bucket=NAME\` to pick a bucket. |

Upload answers with the object — \`key\`, \`size_bytes\`, \`content_type\`,
\`storage_used_bytes\` and \`quota_bytes\` — and three URL fields: \`url\` for your
application (it needs the credential), \`preview_url\` for the dashboard, and
\`public_url\`, which stays empty until the object is published. A published
object is readable by anyone holding \`https://moogo.dev/pub/{project_id}/{key}\`;
treat publishing as permanent, because anyone who recorded the URL keeps it.

## Limits

Every limit is enforced by the server, and most come back in the response.

| What | Limit |
|---|---|
| Projects per account | 2 |
| Database size | 100 MB per project; the file never shrinks on its own |
| Storage | 256 MB per project, summed across all buckets |
| Object size | The bucket's \`max_object_size_bytes\`, or 256 MB |
| JSON request body | 1 MB (\`body_too_large\`) |
| Statement | 64 KB (\`sql_too_long\`), 15 seconds (\`statement_timeout\`) |
| Storage credentials | 5 per project (\`storage_credential_limit\`) |
| Sign-in endpoints | 10 requests/minute per client address, shared across them (\`rate_limited\`) |
| Data plane | 300 requests/minute — queries per project, storage per address (\`rate_limited\`) |
| Result rows | 1000 per response; \`truncated: true\` when the cap was hit |

Reads report \`truncated\` and \`duration_ms\`; storage reports
\`storage_used_bytes\` and \`quota_bytes\`. Check them instead of assuming.

## Do

- Read credentials from the environment; never ask the user to paste them.
- Bind every value through \`args\`; treat SQL strings as code to review.
- Keep the SQL key and the storage credential on their own endpoints.
- Branch on \`error.code\`, never on the message text.
- Send \`Content-Type: application/json\` on JSON requests — it is enforced.
- Page storage listings, and re-fetch when a read returns \`truncated: true\`.
- Use \`/query\` for reads and \`/exec\` for writes; each refuses the other.

## Don't

- Don't concatenate user input into SQL — the placeholder syntax exists for
  that.
- Don't send stacked statements, file functions, or statements over 64 KB.
- Don't send \`Content-Type: application/json\` on a file upload: the body is
  raw bytes with the file's own type.
- Don't put a private object's \`url\` in an \`<img>\` tag — a browser carries no
  storage credential.
- Don't assume a different error shape somewhere: it is always
  \`{"error": {"code", "message", "detail"}}\`.
- Don't paste the secret key, the bucket secret, or session cookies into chat,
  logs, or client-side code.
- Don't treat Moogo as production-ready; it is in development.

## Learn more

- [Quickstart](/docs/quickstart) — account to first query in two minutes
- [Credentials](/docs/credentials) — the two credential types and rotation
- [SQL API](/docs/sql-api) — the full reference for \`/query\` and \`/exec\`
- [Object storage](/docs/object-storage) — buckets, publishing, listing
- [Limits](/docs/limits) — quotas and request caps in detail
- [Errors](/docs/errors) — every error code and what to do about it
- [Security](/docs/security) — the threat model, stated plainly
`,ci=`# JavaScript / TypeScript (Vanilla)

Works in Node 18+, Deno, Bun, Cloudflare Workers, Vercel Edge, and modern browsers.

## Setup

\`\`\`bash
# No package needed — uses fetch (global in Node 18+, Deno, Bun, browsers)
\`\`\`

**Environment variables** (set in your deployment platform):

| Variable | Description |
|----------|-------------|
| \`MOOGO_PROJECT_URL\` | \`https://api.moogo.dev/p/<project-id>\` |
| \`MOOGO_SECRET_KEY\` | \`moogo_...\` (SQL auth) |
| \`MOOGO_BUCKET_ENDPOINT\` | \`https://api.moogo.dev/p/<project-id>/bucket\` |
| \`MOOGO_BUCKET_ACCESS_KEY_ID\` | \`moogo_ak_...\` |
| \`MOOGO_BUCKET_SECRET_KEY\` | \`moogo_sk_...\` |

Get them from **Project → Settings** in the dashboard. Each is shown **once** at creation/rotation — copy immediately.

## Client (\`lib/moogo.ts\`)

\`\`\`ts
// lib/moogo.ts
const PROJECT_URL = process.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = process.env.MOOGO_SECRET_KEY!;
const BUCKET_ENDPOINT = process.env.MOOGO_BUCKET_ENDPOINT!;
const BUCKET_ACCESS_KEY_ID = process.env.MOOGO_BUCKET_ACCESS_KEY_ID!;
const BUCKET_SECRET_KEY = process.env.MOOGO_BUCKET_SECRET_KEY!;

const SQL_HEADERS = {
  Authorization: \`Bearer \${SECRET_KEY}\`,
  "Content-Type": "application/json",
};

const STORAGE_HEADERS = {
  "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
  Authorization: \`Bearer \${BUCKET_SECRET_KEY}\`,
};

function isRead(sql: string): boolean {
  return /^\\s*(select|values|pragma|explain)\\b/i.test(sql.trim());
}

async function handle(res: Response) {
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error?.message ?? "request failed");
    (err as any).code = body.error?.code;
    (err as any).detail = body.error?.detail;
    (err as any).status = res.status;
    throw err;
  }
  return body;
}

// ── SQL ──────────────────────────────────────────────────────────────
export async function query(sql: string, args: any[] = []) {
  const res = await fetch(\`\${PROJECT_URL}/query\`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
  });
  return handle(res);
}

export async function exec(sql: string, args: any[] = []) {
  const res = await fetch(\`\${PROJECT_URL}/exec\`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
  });
  return handle(res);
}

export async function sql(sql: string, args: any[] = []) {
  return isRead(sql) ? query(sql, args) : exec(sql, args);
}

export function toObjects<T>(result: { columns: string[]; rows: any[][] }): T[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  ) as T[];
}

// ── Bucket (Object Storage) ─────────────────────────────────────────
export async function bucketUpload(
  key: string,
  body: BodyInit,
  contentType: string
) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    method: "POST",
    headers: { ...STORAGE_HEADERS, "Content-Type": contentType },
    body,
  });
  return handle(res);
}

export async function bucketDownload(key: string): Promise<Response> {
  return fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    headers: STORAGE_HEADERS,
  });
}

export async function bucketDelete(key: string) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    method: "DELETE",
    headers: STORAGE_HEADERS,
  });
  return handle(res);
}

export async function bucketList(prefix?: string) {
  const url = new URL(\`\${BUCKET_ENDPOINT}\`);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url, { headers: STORAGE_HEADERS });
  return handle(res);
}

// Public download (no auth needed for public objects)
export function bucketPublicUrl(key: string): string {
  return \`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`;
}
\`\`\`

## Usage — SQLite

\`\`\`ts
import { sql, toObjects } from "./lib/moogo";

// Create table (runs via /exec)
await sql(\`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  )
\`);

// Insert (write → /exec)
await sql(
  "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
  [crypto.randomUUID(), "ketut@example.com", "pro"]
);

// Query (read → /query)
const users = await toObjects(
  await sql("SELECT id, email, plan FROM users WHERE plan = ?", ["pro"])
);

console.log(users); // [{ id: "...", email: "ketut@example.com", plan: "pro" }, ...]
\`\`\`

## Usage — Bucket (Object Storage)

\`\`\`ts
import {
  bucketUpload,
  bucketDownload,
  bucketDelete,
  bucketList,
  bucketPublicUrl,
} from "./lib/moogo";

// Upload a file
const file = new File([await fetch("https://example.com/avatar.png").then(r => r.blob())], "avatar.png");
await bucketUpload("avatars/kit.png", file, file.type);

// Download (private — needs auth)
const res = await bucketDownload("avatars/kit.png");
const blob = await res.blob();

// List objects
const { objects } = await bucketList("avatars/");

// Public URL (for public objects — no auth)
const img = document.createElement("img");
img.src = bucketPublicUrl("public/logo.png");

// Delete
await bucketDelete("avatars/old.png");
\`\`\`

## Error handling

\`\`\`ts
try {
  await sql("SELECT * FROM nonexistent");
} catch (err: any) {
  if (err.code === "sql_error") {
    console.log("SQLite error:", err.detail);
  } else if (err.code === "database_too_large") {
    console.log("Project hit 100 MB limit");
  } else if (err.status === 401) {
    console.log("Invalid or rotated secret key");
  }
  throw err;
}
\`\`\`

## Next

- [Next.js guide](/docs/guides/nextjs) — App Router, RSC, Server Actions
- [Nuxt guide](/docs/guides/nuxt) — Server routes, composables
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)`,li=`# Next.js (App Router)

Works with Server Components, Server Actions, Route Handlers, and Edge Runtime.

## Setup

\`\`\`bash
# No extra packages needed (fetch is global in Next.js 13+)
\`\`\`

**Environment variables** (Vercel → Settings → Environment Variables, or \`.env.local\`):

\`\`\`env
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...
MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
\`\`\`

## Client (\`lib/moogo.ts\`)

\`\`\`ts
// lib/moogo.ts
const PROJECT_URL = process.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = process.env.MOOGO_SECRET_KEY!;
const BUCKET_ENDPOINT = process.env.MOOGO_BUCKET_ENDPOINT!;
const BUCKET_ACCESS_KEY_ID = process.env.MOOGO_BUCKET_ACCESS_KEY_ID!;
const BUCKET_SECRET_KEY = process.env.MOOGO_BUCKET_SECRET_KEY!;

const SQL_HEADERS = {
  Authorization: \`Bearer \${SECRET_KEY}\`,
  "Content-Type": "application/json",
};

const STORAGE_HEADERS = {
  "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
  Authorization: \`Bearer \${BUCKET_SECRET_KEY}\`,
};

function isRead(sql: string): boolean {
  return /^\\s*(select|values|pragma|explain)\\b/i.test(sql.trim());
}

async function handle(res: Response) {
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error?.message ?? "request failed");
    (err as any).code = body.error?.code;
    (err as any).detail = body.error?.detail;
    (err as any).status = res.status;
    throw err;
  }
  return body;
}

// ── SQL ──────────────────────────────────────────────────────────────
export async function query(sql: string, args: any[] = []) {
  const res = await fetch(\`\${PROJECT_URL}/query\`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
    // Next.js caches fetch by default; opt out for dynamic data:
    cache: "no-store",
  });
  return handle(res);
}

export async function exec(sql: string, args: any[] = []) {
  const res = await fetch(\`\${PROJECT_URL}/exec\`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
  });
  return handle(res);
}

export async function sql(sql: string, args: any[] = []) {
  return isRead(sql) ? query(sql, args) : exec(sql, args);
}

export function toObjects<T>(result: { columns: string[]; rows: any[][] }): T[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  ) as T[];
}

// ── Bucket ───────────────────────────────────────────────────────────
export async function bucketUpload(
  key: string,
  body: BodyInit,
  contentType: string
) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    method: "POST",
    headers: { ...STORAGE_HEADERS, "Content-Type": contentType },
    body,
  });
  return handle(res);
}

export async function bucketDownload(key: string) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    headers: STORAGE_HEADERS,
    cache: "no-store",
  });
  return res; // Return Response for streaming
}

export async function bucketDelete(key: string) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    method: "DELETE",
    headers: STORAGE_HEADERS,
  });
  return handle(res);
}

export async function bucketList(prefix?: string) {
  const url = new URL(\`\${BUCKET_ENDPOINT}\`);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url, { headers: STORAGE_HEADERS, cache: "no-store" });
  return handle(res);
}

export function bucketPublicUrl(key: string): string {
  return \`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`;
}
\`\`\`

## Server Components (RSC) — Reading data

\`\`\`tsx
// app/users/page.tsx
import { sql, toObjects } from "@/lib/moogo";

export default async function UsersPage() {
  const users = await toObjects(
    await sql("SELECT id, email, plan, created_at FROM users ORDER BY created_at DESC")
  );

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.email} — {u.plan} <small>({new Date(u.created_at).toLocaleDateString()})</small>
        </li>
      ))}
    </ul>
  );
}
\`\`\`

## Server Actions — Mutations

\`\`\`ts
// app/actions.ts
"use server";
import { sql } from "@/lib/moogo";
import { revalidatePath } from "next/cache";

export async function createUser(email: string, plan = "free") {
  const id = crypto.randomUUID();
  await sql(
    "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    [id, email, plan]
  );
  revalidatePath("/users");
  return { id };
}

export async function deleteUser(id: string) {
  await sql("DELETE FROM users WHERE id = ?", [id]);
  revalidatePath("/users");
}
\`\`\`

\`\`\`tsx
// app/users/page.tsx (with form)
import { createUser, deleteUser } from "@/app/actions";

export default async function UsersPage() {
  // ... fetch users as above

  return (
    <>
      <form action={async (formData: FormData) => {
        "use server";
        await createUser(formData.get("email") as string);
      }}>
        <input name="email" type="email" placeholder="Email" required />
        <button type="submit">Add user</button>
      </form>

      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.email}
            <form action={async () => { "use server"; await deleteUser(u.id); }}>
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
\`\`\`

## Route Handlers — Custom API endpoints

\`\`\`ts
// app/api/users/route.ts
import { sql, toObjects, bucketUpload } from "@/lib/moogo";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const users = await toObjects(
    await sql("SELECT id, email, plan FROM users")
  );
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { email, plan } = await req.json();
  const id = crypto.randomUUID();
  await sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [id, email, plan ?? "free"]);
  return NextResponse.json({ id }, { status: 201 });
}
\`\`\`

## Edge Runtime (optional)

\`\`\`ts
// lib/moogo.ts — add at top
export const runtime = "edge"; // Works in Edge Runtime (Vercel, Cloudflare)
\`\`\`

## Bucket usage in Next.js

\`\`\`tsx
// app/upload/page.tsx
"use client";
import { bucketUpload, bucketPublicUrl } from "@/lib/moogo";

export default function UploadPage() {
  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file") as File;
    await bucketUpload(\`uploads/\${file.name}\`, file, file.type);
    alert("Uploaded!");
  }

  return (
    <form onSubmit={handleUpload}>
      <input type="file" name="file" required />
      <button type="submit">Upload</button>
    </form>
  );
}
\`\`\`

\`\`\`tsx
// app/components/Avatar.tsx (public object)
import { bucketPublicUrl } from "@/lib/moogo";

export function Avatar({ key }: { key: string }) {
  return <img src={bucketPublicUrl(key)} alt="" />;
}
\`\`\`

## TypeScript types

\`\`\`ts
// types/moogo.d.ts
declare namespace Moogo {
  interface QueryResult {
    success: true;
    columns: string[];
    rows: any[][];
    row_count: number;
    truncated: boolean;
    duration_ms: number;
  }
  interface ExecResult {
    success: true;
    rows_affected: number;
    size_bytes: number;
    duration_ms: number;
  }
  interface ErrorResponse {
    error: { code: string; message: string; detail?: string };
  }
}
\`\`\`

## Next

- [Vanilla JS guide](/docs/guides/javascript-vanilla) — works everywhere
- [Nuxt guide](/docs/guides/nuxt) — Vue equivalent
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)`,ui=`# Nuxt 3

Works with Server Routes, Composables, and Nitro (Edge/Node).

## Setup

\`\`\`bash
# No extra packages needed (ofetch is built-in)
\`\`\`

**Environment variables** (\`.env\` or runtime config):

\`\`\`env
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...
MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
\`\`\`

\`\`\`ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    moogoProjectUrl: process.env.MOOGO_PROJECT_URL,
    moogoSecretKey: process.env.MOOGO_SECRET_KEY,
    moogoBucketEndpoint: process.env.MOOGO_BUCKET_ENDPOINT,
    moogoBucketAccessKeyId: process.env.MOOGO_BUCKET_ACCESS_KEY_ID,
    moogoBucketSecretKey: process.env.MOOGO_BUCKET_SECRET_KEY,
  },
});
\`\`\`

## Composable (\`composables/useMoogo.ts\`)

\`\`\`ts
// composables/useMoogo.ts
export const useMoogo = () => {
  const config = useRuntimeConfig();

  const PROJECT_URL = config.moogoProjectUrl as string;
  const SECRET_KEY = config.moogoSecretKey as string;
  const BUCKET_ENDPOINT = config.moogoBucketEndpoint as string;
  const BUCKET_ACCESS_KEY_ID = config.moogoBucketAccessKeyId as string;
  const BUCKET_SECRET_KEY = config.moogoBucketSecretKey as string;

  const SQL_HEADERS = {
    Authorization: \`Bearer \${SECRET_KEY}\`,
    "Content-Type": "application/json",
  };

  const STORAGE_HEADERS = {
    "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
    Authorization: \`Bearer \${BUCKET_SECRET_KEY}\`,
  };

  function isRead(sql: string): boolean {
    return /^\\s*(select|values|pragma|explain)\\b/i.test(sql.trim());
  }

  async function handle(res: Response) {
    const body = await res.json();
    if (!res.ok) {
      const err = new Error(body.error?.message ?? "request failed");
      (err as any).code = body.error?.code;
      (err as any).detail = body.error?.detail;
      (err as any).status = res.status;
      throw err;
    }
    return body;
  }

  // ── SQL ────────────────────────────────────────────────────────────
  async function query(sql: string, args: any[] = []) {
    const res = await $fetch(\`\${PROJECT_URL}/query\`, {
      method: "POST",
      headers: SQL_HEADERS,
      body: { query: sql, args },
    });
    return handle(res as any);
  }

  async function exec(sql: string, args: any[] = []) {
    const res = await $fetch(\`\${PROJECT_URL}/exec\`, {
      method: "POST",
      headers: SQL_HEADERS,
      body: { query: sql, args },
    });
    return handle(res as any);
  }

  async function sql(sql: string, args: any[] = []) {
    return isRead(sql) ? query(sql, args) : exec(sql, args);
  }

  function toObjects<T>(result: { columns: string[]; rows: any[][] }): T[] {
    return result.rows.map((row) =>
      Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
    ) as T[];
  }

  // ── Bucket ─────────────────────────────────────────────────────────
  async function bucketUpload(key: string, body: BodyInit, contentType: string) {
    const res = await $fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
      method: "POST",
      headers: { ...STORAGE_HEADERS, "Content-Type": contentType },
      body,
    });
    return handle(res as any);
  }

  async function bucketDownload(key: string) {
    return $fetch.raw(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
      headers: STORAGE_HEADERS,
      responseType: "blob",
    });
  }

  async function bucketDelete(key: string) {
    const res = await $fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
      method: "DELETE",
      headers: STORAGE_HEADERS,
    });
    return handle(res as any);
  }

  async function bucketList(prefix?: string) {
    const url = new URL(\`\${BUCKET_ENDPOINT}\`);
    if (prefix) url.searchParams.set("prefix", prefix);
    const res = await $fetch(url.toString(), { headers: STORAGE_HEADERS });
    return handle(res as any);
  }

  function bucketPublicUrl(key: string): string {
    return \`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`;
  }

  return {
    sql,
    query,
    exec,
    toObjects,
    bucketUpload,
    bucketDownload,
    bucketDelete,
    bucketList,
    bucketPublicUrl,
  };
};
\`\`\`

## Usage in components

\`\`\`vue
<!-- pages/users.vue -->
<script setup lang="ts">
const { sql, toObjects } = useMoogo();

const users = ref([]);

async function load() {
  users.value = await toObjects(await sql("SELECT id, email, plan FROM users"));
}

await load();
<\/script>

<template>
  <ul>
    <li v-for="u in users" :key="u.id">
      {{ u.email }} — {{ u.plan }}
    </li>
  </ul>
</template>
\`\`\`

## Server API routes

\`\`\`ts
// server/api/users.get.ts
export default defineEventHandler(async () => {
  const { sql, toObjects } = useMoogo();
  return toObjects(await sql("SELECT id, email, plan FROM users"));
});
\`\`\`

\`\`\`ts
// server/api/users.post.ts
export default defineEventHandler(async (event) => {
  const { sql } = useMoogo();
  const body = await readBody(event);
  const id = crypto.randomUUID();
  await sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [
    id,
    body.email,
    body.plan ?? "free",
  ]);
  return { id };
});
\`\`\`

## Bucket in Nuxt

\`\`\`vue
<!-- components/AvatarUpload.vue -->
<script setup lang="ts">
const { bucketUpload, bucketPublicUrl } = useMoogo();

const uploading = ref(false);

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.[0]) return;
  uploading.value = true;
  const file = input.files[0];
  await bucketUpload(\`avatars/\${file.name}\`, file, file.type);
  uploading.value = false;
}
<\/script>

<template>
  <input type="file" @change="onUpload" :disabled="uploading" />
  <p v-if="uploading">Uploading…</p>
</template>
\`\`\`

\`\`\`vue
<!-- components/Avatar.vue (public) -->
<script setup lang="ts">
const { bucketPublicUrl } = useMoogo();
const props = defineProps<{ key: string }>();
<\/script>

<template>
  <img :src="bucketPublicUrl(key)" alt="" />
</template>
\`\`\`

## Nitro / Edge deployment

\`\`\`ts
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: "vercel-edge", // or "cloudflare-pages", "netlify-edge"
  },
});
\`\`\`

The \`$fetch\`/\`ofetch\` client works in all Nitro presets.

## Next

- [Next.js guide](/docs/guides/nextjs) — React equivalent
- [Vue guide](/docs/guides/vue) — SPA without Nuxt
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)`,di=`# React (Vite / Create React App)

A guide for using Moogo from a **client-side React** app (Vite, CRA, Remix SPA mode, etc.).

> **Already using Next.js?** Use the [Next.js guide](/docs/guides/nextjs) instead — it supports Server Components, Server Actions, and keeps your SQL key on the server.

---

## The constraint: SQL key stays on the server

Moogo's **SQL endpoints** (\`/query\`, \`/exec\`) require the \`MOOGO_SECRET_KEY\` as a Bearer token.  
**Never put this key in client-side code** — it would be visible in the browser bundle.

**Bucket endpoints** (\`/bucket/*\`) use a separate credential (\`MOOGO_BUCKET_ACCESS_KEY_ID\` + \`MOOGO_BUCKET_SECRET_KEY\`).  
These **can** be used client-side for public uploads/downloads.

---

## Architecture options

| Approach | SQL | Bucket | When to use |
|----------|-----|--------|-------------|
| **Backend proxy (recommended)** | ✅ Via your API | ✅ Direct or via proxy | Most apps — keeps SQL key secret |
| **Bucket only** | ❌ | ✅ Direct | Static sites, upload-only widgets |
| **Next.js** | ✅ Server-side | ✅ Both | Full-stack React apps |

---

## Option 1: Backend proxy (recommended)

Create a tiny serverless function / API route that forwards SQL calls to Moogo. Your React app calls **your** API, never Moogo directly.

### 1. Proxy endpoint (Node/Express example)

\`\`\`js
// server/routes/moogo.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();
const MOOGO_URL = process.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = process.env.MOOGO_SECRET_KEY!;

function isRead(sql) {
  return /^\\s*(SELECT|VALUES|PRAGMA|EXPLAIN)\\b/i.test(sql.trim());
}

router.post("/sql", async (req, res) => {
  const { query, args } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });

  const endpoint = isRead(query) ? "query" : "exec";
  const moogoRes = await fetch(\`\${MOOGO_URL}/\${endpoint}\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${SECRET_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, args: args ?? [] }),
  });

  const data = await moogoRes.json();
  res.status(moogoRes.status).json(data);
});

export default router;
\`\`\`

### 2. React hook

\`\`\`tsx
// hooks/useMoogo.ts
import { useMutation, useQuery } from "@tanstack/react-query";

const API = "/api/moogo/sql"; // your proxy

export function useMoogoQuery(sql: string, args: any[] = []) {
  return useQuery({
    queryKey: ["moogo", sql, args],
    queryFn: async () => {
      const res = await fetch("/api/moogo/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql, args }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!sql,
  });
}

export function useMoogoExec() {
  return useMutation({
    mutationFn: async ({ sql, args }: { sql: string; args: any[] }) => {
      const res = await fetch("/api/moogo/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql, args }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}
\`\`\`

### 3. Usage in a component

\`\`\`tsx
// components/UserList.tsx
import { useMoogoQuery, useMoogoExec } from "../hooks/useMoogo";

export function UserList() {
  const { data, isLoading } = useMoogoQuery(
    "SELECT id, email, plan FROM users WHERE plan = ?",
    ["pro"]
  );

  const insert = useMoogoExec();

  async function addUser(email: string) {
    await insert.mutateAsync({
      sql: "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
      args: [crypto.randomUUID(), email, "free"],
    });
  }

  if (isLoading) return <p>Loading…</p>;

  return (
    <ul>
      {data?.rows?.map((row) => (
        <li key={row[0]}>{row[1]} — {row[2]}</li>
      ))}
    </ul>
  );
}
\`\`\`

---

## Option 2: Bucket direct from React (uploads, public assets)

Since bucket credentials are separate, you **can** use them directly in React for uploads and public downloads.

\`\`\`tsx
// hooks/useMoogoBucket.ts
const BUCKET_ENDPOINT = import.meta.env.VITE_MOOGO_BUCKET_ENDPOINT!;
const ACCESS_KEY = import.meta.env.VITE_MOOGO_BUCKET_ACCESS_KEY_ID!;
const SECRET_KEY = import.meta.env.VITE_MOOGO_BUCKET_SECRET_KEY!;

const headers = {
  "X-Moogo-Access-Key-Id": ACCESS_KEY,
  Authorization: \`Bearer \${SECRET_KEY}\`,
};

export async function uploadFile(key: string, file: File) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    method: "POST",
    headers: { ...headers, "Content-Type": file.type },
    body: file,
  });
  return res.json();
}

export function getPublicUrl(key: string) {
  return \`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`;
}

export async function listFiles(prefix?: string) {
  const url = new URL(BUCKET_ENDPOINT);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url, { headers });
  return res.json();
}
\`\`\`

\`\`\`tsx
// components/AvatarUpload.tsx
import { uploadFile, getPublicUrl } from "../hooks/useMoogoBucket";

export function AvatarUpload() {
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(\`avatars/\${file.name}\`, file);
    alert("Uploaded!");
  }

  return <input type="file" onChange={handleUpload} accept="image/*" />;
}
\`\`\`

\`\`\`tsx
// components/Avatar.tsx
import { getPublicUrl } from "../hooks/useMoogoBucket";

export function Avatar({ key }: { key: string }) {
  return <img src={getPublicUrl(key)} alt="" />;
}
\`\`\`

---

## Environment variables (\`.env\`)

\`\`\`env
# Backend (proxy) — keep secret!
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...

# Frontend (bucket only) — safe to expose
VITE_MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
VITE_MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
VITE_MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
\`\`\`

---

## Vite / CRA setup

\`\`\`bash
# Vite
npm create vite@latest my-app -- --template react-ts
cd my-app
npm i @tanstack/react-query  # recommended for data fetching
\`\`\`

\`\`\`bash
# CRA
npx create-react-app my-app --template typescript
cd my-app
npm i @tanstack/react-query
\`\`\`

Add a \`.env\` file with the variables above (prefix with \`VITE_\` for Vite, \`REACT_APP_\` for CRA).

---

## When to switch to Next.js

| Trigger | Why Next.js? |
|---------|--------------|
| SEO / SSR needed | \`getServerSideProps\`, \`generateStaticParams\` |
| Want Server Actions | Mutations stay on server, no proxy needed |
| Auth + SQL in same request | Cookies + DB in one Server Component |
| Edge / streaming | \`export const runtime = "edge"\` |

The [Next.js guide](/docs/guides/nextjs) covers Server Components, Server Actions, and the Moogo client pattern.

---

## Quick reference

| Task | Code |
|------|------|
| Read data | \`useMoogoQuery("SELECT * FROM users WHERE plan = ?", ["pro"])\` |
| Write data | \`insert.mutateAsync({ sql: "INSERT ...", args: [...] })\` |
| Upload file | \`uploadFile("avatars/me.png", file)\` |
| Public URL | \`getPublicUrl("avatars/me.png")\` |

---

## Next

- [Next.js guide](/docs/guides/nextjs) — full-stack React with Server Components
- [JavaScript vanilla](/docs/guides/javascript-vanilla) — no framework
- [Bucket API](/docs/object-storage) — full bucket reference`,fi=`# Vue 3 (SPA)

Works with Vite, Pinia, Vue Router — client-side only or with a backend proxy.

## Setup

\`\`\`bash
npm i ofetch  # or use built-in fetch (modern browsers)
\`\`\`

**Environment variables** (\`.env\` — only public bucket URL goes to client):

\`\`\`env
VITE_MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
VITE_MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
VITE_MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
\`\`\`

> ⚠️ **Never expose \`MOOGO_SECRET_KEY\` (SQL key) in client code.**  
> For SQL in a SPA, create a small backend proxy (see below) or use a Server Function (Netlify/Vercel Functions, Cloudflare Workers).

## Client-side Bucket only (\`composables/useMoogoBucket.ts\`)

\`\`\`ts
// composables/useMoogoBucket.ts
import { ofetch } from "ofetch";

const BUCKET_ENDPOINT = import.meta.env.VITE_MOOGO_BUCKET_ENDPOINT!;
const BUCKET_ACCESS_KEY_ID = import.meta.env.VITE_MOOGO_BUCKET_ACCESS_KEY_ID!;
const BUCKET_SECRET_KEY = import.meta.env.VITE_MOOGO_BUCKET_SECRET_KEY!;

const STORAGE_HEADERS = {
  "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
  Authorization: \`Bearer \${BUCKET_SECRET_KEY}\`,
};

export function useMoogoBucket() {
  async function upload(key: string, file: File) {
    return ofetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
      method: "POST",
      headers: { ...STORAGE_HEADERS, "Content-Type": file.type },
      body: file,
    });
  }

  async function download(key: string): Promise<Blob> {
    return ofetch.raw(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
      headers: STORAGE_HEADERS,
      responseType: "blob",
    });
  }

  async function remove(key: string) {
    return ofetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
      method: "DELETE",
      headers: STORAGE_HEADERS,
    });
  }

  async function list(prefix?: string) {
    const url = new URL(BUCKET_ENDPOINT);
    if (prefix) url.searchParams.set("prefix", prefix);
    return ofetch(url.toString(), { headers: STORAGE_HEADERS });
  }

  function publicUrl(key: string): string {
    return \`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`;
  }

  return { upload, download, remove, list, publicUrl };
}
\`\`\`

## Usage in component

\`\`\`vue
<!-- components/FileUpload.vue -->
<script setup lang="ts">
import { useMoogoBucket } from "@/composables/useMoogoBucket";

const { upload, publicUrl, list } = useMoogoBucket();
const files = ref<{ key: string; url: string }[]>([]);
const uploading = ref(false);

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  uploading.value = true;
  for (const file of input.files) {
    await upload(\`uploads/\${file.name}\`, file);
  }
  await refresh();
  uploading.value = false;
}

async function refresh() {
  const { objects } = await list("uploads/");
  files.value = objects.map((o) => ({ key: o.key, url: publicUrl(o.key) }));
}

onMounted(refresh);
<\/script>

<template>
  <input type="file" multiple @change="onUpload" :disabled="uploading" />
  <p v-if="uploading">Uploading…</p>

  <div v-for="f in files" :key="f.key" class="flex items-center gap-2">
    <img :src="f.url" width="40" height="40" />
    <span>{{ f.key }}</span>
  </div>
</template>
\`\`\`

## SQL via backend proxy (required for SPA)

Create a tiny serverless function (Netlify, Vercel, Cloudflare Workers):

\`\`\`ts
// netlify/functions/moogo-sql.ts
import type { Handler } from "@netlify/functions";

const PROJECT_URL = process.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = process.env.MOOGO_SECRET_KEY!;

const headers = {
  Authorization: \`Bearer \${SECRET_KEY}\`,
  "Content-Type": "application/json",
};

function isRead(sql: string) {
  return /^\\s*(select|values|pragma|explain)\\b/i.test(sql.trim());
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const { query, args } = JSON.parse(event.body ?? "{}");
  if (!query) return { statusCode: 400, body: "query required" };

  const endpoint = isRead(query) ? "query" : "exec";
  const res = await fetch(\`\${PROJECT_URL}/\${endpoint}\`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, args: args ?? [] }),
  });

  return { statusCode: res.status, body: await res.text() };
};
\`\`\`

\`\`\`ts
// composables/useMoogoSql.ts (calls your proxy)
import { ofetch } from "ofetch";

const PROXY_URL = "/.netlify/functions/moogo-sql"; // or your Vercel/Cloudflare URL

export function useMoogoSql() {
  async function sql(query: string, args: any[] = []) {
    return ofetch(PROXY_URL, { method: "POST", body: { query, args } });
  }

  function toObjects<T>(result: { columns: string[]; rows: any[][] }): T[] {
    return result.rows.map((row) =>
      Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
    ) as T[];
  }

  return { sql, toObjects };
}
\`\`\`

\`\`\`vue
<!-- components/UserList.vue -->
<script setup lang="ts">
import { useMoogoSql } from "@/composables/useMoogoSql";

const { sql, toObjects } = useMoogoSql();
const users = ref([]);

async function load() {
  users.value = await toObjects(await sql("SELECT id, email, plan FROM users"));
}

onMounted(load);
<\/script>

<template>
  <ul>
    <li v-for="u in users" :key="u.id">{{ u.email }} — {{ u.plan }}</li>
  </ul>
</template>
\`\`\`

## Alternative: Pinia store

\`\`\`ts
// stores/moogo.ts
import { defineStore } from "pinia";
import { useMoogoBucket } from "@/composables/useMoogoBucket";
import { useMoogoSql } from "@/composables/useMoogoSql";

export const useMoogoStore = defineStore("moogo", () => {
  const bucket = useMoogoBucket();
  const sql = useMoogoSql();

  return { bucket, sql };
});
\`\`\`

## Next

- [Nuxt guide](/docs/guides/nuxt) — SSR + SQL + Bucket without proxy
- [Vanilla JS guide](/docs/guides/javascript-vanilla) — same patterns
- [Object storage](/docs/object-storage)
- [Security](/docs/security) — why SQL key must stay server-side`,pi=`# Astro

Works with SSR, static generation, and server endpoints (API routes).

## Setup

\`\`\`bash
# No extra packages needed (fetch is global)
\`\`\`

**Environment variables** (\`.env\`):

\`\`\`env
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...
MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
\`\`\`

## Client (\`src/lib/moogo.ts\`)

\`\`\`ts
// src/lib/moogo.ts
const PROJECT_URL = import.meta.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = import.meta.env.MOOGO_SECRET_KEY!;
const BUCKET_ENDPOINT = import.meta.env.MOOGO_BUCKET_ENDPOINT!;
const BUCKET_ACCESS_KEY_ID = import.meta.env.MOOGO_BUCKET_ACCESS_KEY_ID!;
const BUCKET_SECRET_KEY = import.meta.env.MOOGO_BUCKET_SECRET_KEY!;

const SQL_HEADERS = {
  Authorization: \`Bearer \${SECRET_KEY}\`,
  "Content-Type": "application/json",
};

const STORAGE_HEADERS = {
  "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
  Authorization: \`Bearer \${BUCKET_SECRET_KEY}\`,
};

function isRead(sql: string): boolean {
  return /^\\s*(select|values|pragma|explain)\\b/i.test(sql.trim());
}

async function handle(res: Response) {
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error?.message ?? "request failed");
    (err as any).code = body.error?.code;
    (err as any).detail = body.error?.detail;
    (err as any).status = res.status;
    throw err;
  }
  return body;
}

// ── SQL ──────────────────────────────────────────────────────────────
export async function query(sql: string, args: any[] = []) {
  const res = await fetch(\`\${PROJECT_URL}/query\`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
  });
  return handle(res);
}

export async function exec(sql: string, args: any[] = []) {
  const res = await fetch(\`\${PROJECT_URL}/exec\`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
  });
  return handle(res);
}

export async function sql(sql: string, args: any[] = []) {
  return isRead(sql) ? query(sql, args) : exec(sql, args);
}

export function toObjects<T>(result: { columns: string[]; rows: any[][] }): T[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  ) as T[];
}

// ── Bucket ───────────────────────────────────────────────────────────
export async function bucketUpload(
  key: string,
  body: BodyInit,
  contentType: string
) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    method: "POST",
    headers: { ...STORAGE_HEADERS, "Content-Type": contentType },
    body,
  });
  return handle(res);
}

export async function bucketDownload(key: string) {
  return fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    headers: STORAGE_HEADERS,
  });
}

export async function bucketDelete(key: string) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`, {
    method: "DELETE",
    headers: STORAGE_HEADERS,
  });
  return handle(res);
}

export async function bucketList(prefix?: string) {
  const url = new URL(\`\${BUCKET_ENDPOINT}\`);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url, { headers: STORAGE_HEADERS });
  return handle(res);
}

export function bucketPublicUrl(key: string): string {
  return \`\${BUCKET_ENDPOINT}/\${encodeURIComponent(key)}\`;
}
\`\`\`

## SSR Pages (\`.astro\` with \`---\`)

\`\`\`astro
---
// src/pages/users.astro
import { sql, toObjects } from "@/lib/moogo";

const users = await toObjects(
  await sql("SELECT id, email, plan, created_at FROM users ORDER BY created_at DESC")
);
---

<ul>
  {users.map((u) => (
    <li>{u.email} — {u.plan} <small>{new Date(u.created_at).toLocaleDateString()}</small></li>
  ))}
</ul>
\`\`\`

## Server Endpoints (API routes)

\`\`\`ts
// src/pages/api/users.json.ts
import type { APIRoute } from "astro";
import { sql, toObjects } from "@/lib/moogo";

export const GET: APIRoute = async () => {
  const users = await toObjects(await sql("SELECT id, email, plan FROM users"));
  return new Response(JSON.stringify(users), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const { email, plan } = await request.json();
  const id = crypto.randomUUID();
  await sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [id, email, plan ?? "free"]);
  return new Response(JSON.stringify({ id }), { status: 201 });
};
\`\`\`

## Hybrid: Static generation with dynamic data

\`\`\`astro
---
// src/pages/blog/[slug].astro
import { sql, toObjects } from "@/lib/moogo";

export async function getStaticPaths() {
  const posts = await toObjects(
    await sql("SELECT slug FROM posts WHERE published = 1")
  );
  return posts.map((p) => ({ params: { slug: p.slug } }));
}

const { slug } = Astro.props;
const post = (await toObjects(
  await sql("SELECT * FROM posts WHERE slug = ?", [slug])
))[0];
---

<h1>{post.title}</h1>
<article set:html={post.content} />
\`\`\`

## Bucket in Astro

\`\`\`astro
---
// src/pages/upload.astro
import { bucketUpload } from "@/lib/moogo";

if (Astro.request.method === "POST") {
  const form = await Astro.request.formData();
  const file = form.get("file") as File;
  await bucketUpload(\`uploads/\${file.name}\`, file, file.type);
  return Astro.redirect("/upload?success=1");
}
---

<form method="POST" enctype="multipart/form-data">
  <input type="file" name="file" required />
  <button type="submit">Upload</button>
</form>

{ Astro.url.searchParams.has("success") && <p>Uploaded!</p> }
\`\`\`

\`\`\`astro
---
// src/components/Avatar.astro (public object)
import { bucketPublicUrl } from "@/lib/moogo";

const { key } = Astro.props;
---

<img src={bucketPublicUrl(key)} alt="" />
\`\`\`

## Edge/Static adapter

\`\`\`ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/edge"; // or netlify, cloudflare

export default defineConfig({
  output: "server", // or "hybrid"
  adapter: vercel(),
});
\`\`\`

The \`fetch\`-based client works in all Astro adapters (Node, Edge, Deno, Bun).

## Next

- [Next.js guide](/docs/guides/nextjs) — React equivalent
- [Nuxt guide](/docs/guides/nuxt) — Vue equivalent
- [Vanilla JS guide](/docs/guides/javascript-vanilla)
- [Object storage](/docs/object-storage)`,mi=`# Python (Vanilla)

Works with stdlib only (Python 3.11+). No dependencies.

## Setup

\`\`\`bash
# Nothing to install
\`\`\`

**Environment variables:**

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`moogo.py\`)

\`\`\`python
# moogo.py
import os
import json
import urllib.request
from typing import Any

PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]
BUCKET_ENDPOINT = os.environ["MOOGO_BUCKET_ENDPOINT"]
BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_BUCKET_ACCESS_KEY_ID"]
BUCKET_SECRET_KEY = os.environ["MOOGO_BUCKET_SECRET_KEY"]

SQL_HEADERS = {
    "Authorization": f"Bearer {SECRET_KEY}",
    "Content-Type": "application/json",
}

STORAGE_HEADERS = {
    "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
    "Authorization": f"Bearer {BUCKET_SECRET_KEY}",
}

def _post(path: str, query: str, args: list[Any] = None) -> dict:
    args = args or []
    data = json.dumps({"query": query, "args": args}).encode()
    req = urllib.request.Request(
        f"{PROJECT_URL}{path}", data=data, headers=SQL_HEADERS, method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        body = json.load(resp)
    if resp.status >= 400:
        raise MoogoError(body.get("error", {}))
    return body

class MoogoError(Exception):
    def __init__(self, error: dict):
        self.code = error.get("code")
        self.message = error.get("message")
        self.detail = error.get("detail")
        super().__init__(self.message)

def is_read(sql: str) -> bool:
    return sql.lstrip().upper().startswith(("SELECT", "VALUES", "PRAGMA", "EXPLAIN"))

def query(sql: str, args: list = None) -> dict:
    return _post("/query", sql, args)

def exec(sql: str, args: list = None) -> dict:
    return _post("/exec", sql, args)

def sql(sql: str, args: list = None) -> dict:
    return query(sql, args) if is_read(sql) else exec(sql, args)

def to_objects(result: dict) -> list[dict]:
    cols = result.get("columns", [])
    return [dict(zip(cols, row)) for row in result.get("rows", [])]

# ── Bucket ───────────────────────────────────────────────────────────
def _storage_request(method: str, path: str, body: bytes = None, headers: dict = None) -> dict:
    url = f"{BUCKET_ENDPOINT}{path}"
    h = {**STORAGE_HEADERS, **(headers or {})}
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(req) as resp:
        if resp.status == 204:
            return {}
        return json.load(resp)

def bucket_upload(key: str, data: bytes, content_type: str) -> dict:
    return _storage_request("POST", f"/{key}", body=data, headers={"Content-Type": content_type})

def bucket_download(key: str) -> bytes:
    url = f"{BUCKET_ENDPOINT}/{key}"
    req = urllib.request.Request(url, headers=STORAGE_HEADERS)
    with urllib.request.urlopen(req) as resp:
        return resp.read()

def bucket_delete(key: str) -> dict:
    return _storage_request("DELETE", f"/{key}")

def bucket_list(prefix: str = None) -> dict:
    url = BUCKET_ENDPOINT
    if prefix:
        url += f"?prefix={prefix}"
    req = urllib.request.Request(url, headers=STORAGE_HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)

def bucket_public_url(key: str) -> str:
    return f"{BUCKET_ENDPOINT}/{key}"
\`\`\`

## Usage — SQLite

\`\`\`python
from moogo import sql, to_objects

sql("""
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  )
""")

import uuid
sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    [str(uuid.uuid4()), "ketut@example.com", "pro"])

users = to_objects(sql("SELECT id, email, plan FROM users WHERE plan = ?", ["pro"]))
print(users)
# [{'id': '...', 'email': 'ketut@example.com', 'plan': 'pro'}, ...]
\`\`\`

## Usage — Bucket

\`\`\`python
from moogo import bucket_upload, bucket_download, bucket_delete, bucket_list, bucket_public_url

# Upload
with open("avatar.png", "rb") as f:
    bucket_upload("avatars/kit.png", f.read(), "image/png")

# Download (private)
content = bucket_download("avatars/kit.png")

# List
objects = bucket_list("avatars/")["objects"]

# Public URL
print(bucket_public_url("public/logo.png"))
\`\`\`

## Error handling

\`\`\`python
from moogo import sql, MoogoError

try:
    sql("SELECT * FROM nonexistent")
except MoogoError as e:
    if e.code == "sql_error":
        print("SQLite error:", e.detail)
    elif e.code == "database_too_large":
        print("Project hit 100 MB limit")
    elif hasattr(e, 'status') and e.status == 401:
        print("Invalid or rotated secret key")
    raise
\`\`\`

## Async version (aiohttp)

\`\`\`python
# moogo_async.py
import aiohttp
import os

PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]

HEADERS = {"Authorization": f"Bearer {SECRET_KEY}", "Content-Type": "application/json"}

async def sql(session: aiohttp.ClientSession, query: str, args: list = None) -> dict:
    args = args or []
    endpoint = "/query" if query.lstrip().upper().startswith(("SELECT", "VALUES", "PRAGMA", "EXPLAIN")) else "/exec"
    async with session.post(f"{PROJECT_URL}{endpoint}", headers=HEADERS, json={"query": query, "args": args}) as resp:
        body = await resp.json()
        if resp.status >= 400:
            raise MoogoError(body.get("error", {}))
        return body
\`\`\`

\`\`\`python
import asyncio
import aiohttp
from moogo_async import sql

async def main():
    async with aiohttp.ClientSession() as session:
        users = await sql(session, "SELECT id, email FROM users WHERE plan = ?", ["pro"])
        print(users)

asyncio.run(main())
\`\`\`

## Next

- [FastAPI guide](/docs/guides/fastapi)
- [Flask guide](/docs/guides/flask)
- [Django guide](/docs/guides/django)
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)`,hi=`# FastAPI

Modern, fast (Starlette + Pydantic), async-first.

## Setup

\`\`\`bash
pip install fastapi uvicorn httpx pydantic
\`\`\`

**Environment variables:**

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`moogo.py\`)

\`\`\`python
# moogo.py
import os
import httpx
from typing import Any

PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]
BUCKET_ENDPOINT = os.environ["MOOGO_BUCKET_ENDPOINT"]
BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_BUCKET_ACCESS_KEY_ID"]
BUCKET_SECRET_KEY = os.environ["MOOGO_BUCKET_SECRET_KEY"]

SQL_HEADERS = {"Authorization": f"Bearer {SECRET_KEY}", "Content-Type": "application/json"}
STORAGE_HEADERS = {"X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID, "Authorization": f"Bearer {BUCKET_SECRET_KEY}"}

client = httpx.AsyncClient(timeout=30.0)

def is_read(sql: str) -> bool:
    return sql.lstrip().upper().startswith(("SELECT", "VALUES", "PRAGMA", "EXPLAIN"))

async def _post(path: str, query: str, args: list[Any] = None) -> dict:
    args = args or []
    resp = await client.post(f"{PROJECT_URL}{path}", headers=SQL_HEADERS, json={"query": query, "args": args})
    body = resp.json()
    if resp.status_code >= 400:
        raise MoogoError(body.get("error", {}))
    return body

class MoogoError(Exception):
    def __init__(self, error: dict):
        self.code = error.get("code")
        self.message = error.get("message")
        self.detail = error.get("detail")
        super().__init__(self.message)

async def query(sql: str, args: list = None) -> dict:
    return await _post("/query", sql, args)

async def exec(sql: str, args: list = None) -> dict:
    return await _post("/exec", sql, args)

async def sql(sql: str, args: list = None) -> dict:
    return await query(sql, args) if is_read(sql) else await exec(sql, args)

def to_objects(result: dict) -> list[dict]:
    cols = result.get("columns", [])
    return [dict(zip(cols, row)) for row in result.get("rows", [])]

# ── Bucket ───────────────────────────────────────────────────────────
async def bucket_upload(key: str, content: bytes, content_type: str) -> dict:
    resp = await client.post(f"{BUCKET_ENDPOINT}/{key}", headers={**STORAGE_HEADERS, "Content-Type": content_type}, content=content)
    return resp.json()

async def bucket_download(key: str) -> bytes:
    resp = await client.get(f"{BUCKET_ENDPOINT}/{key}", headers=STORAGE_HEADERS)
    return resp.content

async def bucket_delete(key: str) -> dict:
    resp = await client.delete(f"{BUCKET_ENDPOINT}/{key}", headers=STORAGE_HEADERS)
    return resp.json()

async def bucket_list(prefix: str = None) -> dict:
    url = BUCKET_ENDPOINT
    if prefix:
        url += f"?prefix={prefix}"
    resp = await client.get(url, headers=STORAGE_HEADERS)
    return resp.json()

def bucket_public_url(key: str) -> str:
    return f"{BUCKET_ENDPOINT}/{key}"
\`\`\`

## FastAPI App (\`main.py\`)

\`\`\`python
# main.py
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from moogo import sql, to_objects, bucket_upload, bucket_public_url, MoogoError
import uuid

app = FastAPI(title "Moogo + FastAPI")

class UserIn(BaseModel):
    email: str
    plan: str = "free"

class UserOut(BaseModel):
    id: str
    email: str
    plan: str

@app.on_event("shutdown")
async def shutdown():
    await moogo.client.aclose()

@app.get("/users", response_model=list[UserOut])
async def list_users():
    return to_objects(await sql("SELECT id, email, plan FROM users"))

@app.post("/users", response_model=UserOut, status_code=201)
async def create_user(user: UserIn):
    try:
        user_id = str(uuid.uuid4())
        await sql(
            "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
            [user_id, user.email, user.plan]
        )
        return {"id": user_id, "email": user.email, "plan": user.plan}
    except MoogoError as e:
        raise HTTPException(400, detail=e.message)

@app.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: str):
    result = await to_objects(await sql("SELECT id, email, plan FROM users WHERE id = ?", [user_id]))
    if not result:
        raise HTTPException(404, "User not found")
    return result[0]

# ── Bucket endpoints ─────────────────────────────────────────────────
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    await bucket_upload(f"uploads/{file.filename}", content, file.content_type)
    return {"url": bucket_public_url(f"uploads/{file.filename}")}

@app.get("/files")
async def list_files():
    return (await bucket_list("uploads/")).get("objects", [])
\`\`\`

## Run

\`\`\`bash
uvicorn main:app --reload
# http://localhost:8000/docs — Swagger UI
\`\`\`

## Dependency Injection (cleaner)

\`\`\`python
# dependencies.py
from fastapi import Depends
from moogo import MoogoClient

async def get_moogo() -> MoogoClient:
    yield moogo_client  # global instance

# In routes:
@app.get("/users")
async def list_users(moogo: MoogoClient = Depends(get_moogo)):
    return moogo.to_objects(await moogo.sql("SELECT id, email, plan FROM users"))
\`\`\`

## Background tasks

\`\`\`python
from fastapi import BackgroundTasks

@app.post("/users/bulk")
async def bulk_create(emails: list[str], background: BackgroundTasks):
    async def create_all():
        for email in emails:
            await sql("INSERT INTO users (id, email) VALUES (?, ?)", [str(uuid.uuid4()), email])
    background.add_task(create_all)
    return {"status": "processing", "count": len(emails)}
\`\`\`

## Testing

\`\`\`python
# test_main.py
import pytest
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
async def test_create_user():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.post("/users", json={"email": "test@example.com"})
    assert resp.status_code == 201
    assert resp.json()["email"] == "test@example.com"
\`\`\`

## Next

- [Flask guide](/docs/guides/flask)
- [Django guide](/docs/guides/django)
- [Python vanilla guide](/docs/guides/python-vanilla)
- [SQL API reference](/docs/sql-api)`,gi=`# Flask

Lightweight, synchronous, great for small services.

## Setup

\`\`\`bash
pip install flask requests gunicorn
\`\`\`

**Environment variables:**

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`moogo.py\`)

\`\`\`python
# moogo.py
import os
import requests
from typing import Any

PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]
BUCKET_ENDPOINT = os.environ["MOOGO_BUCKET_ENDPOINT"]
BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_BUCKET_ACCESS_KEY_ID"]
BUCKET_SECRET_KEY = os.environ["MOOGO_BUCKET_SECRET_KEY"]

SQL_HEADERS = {"Authorization": f"Bearer {SECRET_KEY}", "Content-Type": "application/json"}
STORAGE_HEADERS = {"X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID, "Authorization": f"Bearer {BUCKET_SECRET_KEY}"}

session = requests.Session()

def is_read(sql: str) -> bool:
    return sql.lstrip().upper().startswith(("SELECT", "VALUES", "PRAGMA", "EXPLAIN"))

def _post(path: str, query: str, args: list[Any] = None) -> dict:
    args = args or []
    resp = session.post(f"{PROJECT_URL}{path}", headers=SQL_HEADERS, json={"query": query, "args": args})
    body = resp.json()
    if resp.status_code >= 400:
        raise MoogoError(body.get("error", {}))
    return body

class MoogoError(Exception):
    def __init__(self, error: dict):
        self.code = error.get("code")
        self.message = error.get("message")
        self.detail = error.get("detail")
        super().__init__(self.message)

def query(sql: str, args: list = None) -> dict:
    return _post("/query", sql, args)

def exec(sql: str, args: list = None) -> dict:
    return _post("/exec", sql, args)

def sql(sql: str, args: list = None) -> dict:
    return query(sql, args) if is_read(sql) else exec(sql, args)

def to_objects(result: dict) -> list[dict]:
    cols = result.get("columns", [])
    return [dict(zip(cols, row)) for row in result.get("rows", [])]

# ── Bucket ───────────────────────────────────────────────────────────
def bucket_upload(key: str, content: bytes, content_type: str) -> dict:
    resp = session.post(f"{BUCKET_ENDPOINT}/{key}", headers={**STORAGE_HEADERS, "Content-Type": content_type}, data=content)
    return resp.json()

def bucket_download(key: str) -> bytes:
    resp = session.get(f"{BUCKET_ENDPOINT}/{key}", headers=STORAGE_HEADERS)
    return resp.content

def bucket_delete(key: str) -> dict:
    resp = session.delete(f"{BUCKET_ENDPOINT}/{key}", headers=STORAGE_HEADERS)
    return resp.json()

def bucket_list(prefix: str = None) -> dict:
    url = BUCKET_ENDPOINT
    if prefix:
        url += f"?prefix={prefix}"
    resp = session.get(url, headers=STORAGE_HEADERS)
    return resp.json()

def bucket_public_url(key: str) -> str:
    return f"{BUCKET_ENDPOINT}/{key}"
\`\`\`

## Flask App (\`app.py\`)

\`\`\`python
# app.py
from flask import Flask, request, jsonify, send_file
from moogo import sql, to_objects, bucket_upload, bucket_download, bucket_public_url, MoogoError
import uuid
import io

app = Flask(__name__)

@app.route("/users")
def list_users():
    return jsonify(to_objects(sql("SELECT id, email, plan FROM users")))

@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    user_id = str(uuid.uuid4())
    try:
        sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [user_id, data["email"], data.get("plan", "free")])
    except MoogoError as e:
        return jsonify({"error": e.message}), 400
    return jsonify({"id": user_id, "email": data["email"]}), 201

@app.route("/users/<user_id>")
def get_user(user_id):
    result = to_objects(sql("SELECT id, email, plan FROM users WHERE id = ?", [user_id]))
    if not result:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result[0])

# ── Bucket ───────────────────────────────────────────────────────────
@app.route("/upload", methods=["POST"])
def upload_file():
    file = request.files["file"]
    bucket_upload(f"uploads/{file.filename}", file.read(), file.content_type)
    return jsonify({"url": bucket_public_url(f"uploads/{file.filename}")})

@app.route("/files")
def list_files():
    return jsonify(bucket_list("uploads/").get("objects", []))

@app.route("/download/<path:key>")
def download_file(key):
    content = bucket_download(key)
    return send_file(io.BytesIO(content), as_attachment=True, download_name=key.split("/")[-1])
\`\`\`

## Run

\`\`\`bash
flask --app app run --debug
# or production:
gunicorn -w 4 -b 0.0.0.0:8000 app:app
\`\`\`

## Blueprints (modular)

\`\`\`python
# moogo_bp.py
from flask import Blueprint, request, jsonify
from moogo import sql, to_objects, MoogoError
import uuid

bp = Blueprint("moogo", __name__)

@bp.route("/users")
def list_users():
    return jsonify(to_objects(sql("SELECT id, email, plan FROM users")))

@bp.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    user_id = str(uuid.uuid4())
    try:
        sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [user_id, data["email"], data.get("plan", "free")])
    except MoogoError as e:
        return jsonify({"error": e.message}), 400
    return jsonify({"id": user_id, "email": data["email"]}), 201
\`\`\`

\`\`\`python
# app.py
from flask import Flask
from moogo_bp import bp

app = Flask(__name__)
app.register_blueprint(bp, url_prefix="/api")
\`\`\`

## Error handling

\`\`\`python
@app.errorhandler(MoogoError)
def handle_moogo_error(e):
    if e.code == "database_too_large":
        return jsonify({"error": "Project quota exceeded"}), 413
    if e.code == "sql_forbidden_keyword":
        return jsonify({"error": "Invalid SQL"}), 400
    return jsonify({"error": e.message}), 500
\`\`\`

## Next

- [Django guide](/docs/guides/django)
- [FastAPI guide](/docs/guides/fastapi)
- [Python vanilla guide](/docs/guides/python-vanilla)
- [Object storage](/docs/object-storage)`,_i=`# Django

Batteries-included, ORM-style patterns, async support.

## Setup

\`\`\`bash
pip install django djangorestframework requests gunicorn
\`\`\`

**Environment variables** (\`.env\` or \`settings.py\`):

\`\`\`python
# settings.py
import os
MOOGO_PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
MOOGO_SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]
MOOGO_BUCKET_ENDPOINT = os.environ["MOOGO_BUCKET_ENDPOINT"]
MOOGO_BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_BUCKET_ACCESS_KEY_ID"]
MOOGO_BUCKET_SECRET_KEY = os.environ["MOOGO_BUCKET_SECRET_KEY"]
\`\`\`

## Client (\`moogo/client.py\`)

\`\`\`python
# moogo/client.py
import requests
from typing import Any
from django.conf import settings

class MoogoError(Exception):
    def __init__(self, error: dict):
        self.code = error.get("code")
        self.message = error.get("message")
        self.detail = error.get("detail")
        super().__init__(self.message)

class MoogoClient:
    def __init__(self):
        self.project_url = settings.MOOGO_PROJECT_URL
        self.secret_key = settings.MOOGO_SECRET_KEY
        self.bucket_endpoint = settings.MOOGO_BUCKET_ENDPOINT
        self.bucket_access_key_id = settings.MOOGO_BUCKET_ACCESS_KEY_ID
        self.bucket_secret_key = settings.MOOGO_BUCKET_SECRET_KEY

        self.sql_headers = {"Authorization": f"Bearer {self.secret_key}", "Content-Type": "application/json"}
        self.storage_headers = {"X-Moogo-Access-Key-Id": self.bucket_access_key_id, "Authorization": f"Bearer {self.bucket_secret_key}"}
        self.session = requests.Session()

    def _is_read(self, sql: str) -> bool:
        return sql.lstrip().upper().startswith(("SELECT", "VALUES", "PRAGMA", "EXPLAIN"))

    def _post(self, path: str, query: str, args: list[Any] = None) -> dict:
        args = args or []
        resp = self.session.post(f"{self.project_url}{path}", headers=self.sql_headers, json={"query": query, "args": args})
        body = resp.json()
        if resp.status_code >= 400:
            raise MoogoError(body.get("error", {}))
        return body

    def query(self, sql: str, args: list = None) -> dict:
        return self._post("/query", sql, args)

    def exec(self, sql: str, args: list = None) -> dict:
        return self._post("/exec", sql, args)

    def sql(self, sql: str, args: list = None) -> dict:
        return self.query(sql, args) if self._is_read(sql) else self.exec(sql, args)

    def to_objects(self, result: dict) -> list[dict]:
        cols = result.get("columns", [])
        return [dict(zip(cols, row)) for row in result.get("rows", [])]

    # ── Bucket ───────────────────────────────────────────────────────
    def bucket_upload(self, key: str, content: bytes, content_type: str) -> dict:
        resp = self.session.post(f"{self.bucket_endpoint}/{key}", headers={**self.storage_headers, "Content-Type": content_type}, data=content)
        return resp.json()

    def bucket_download(self, key: str) -> bytes:
        resp = self.session.get(f"{self.bucket_endpoint}/{key}", headers=self.storage_headers)
        return resp.content

    def bucket_delete(self, key: str) -> dict:
        resp = self.session.delete(f"{self.bucket_endpoint}/{key}", headers=self.storage_headers)
        return resp.json()

    def bucket_list(self, prefix: str = None) -> dict:
        url = self.bucket_endpoint
        if prefix:
            url += f"?prefix={prefix}"
        resp = self.session.get(url, headers=self.storage_headers)
        return resp.json()

    def bucket_public_url(self, key: str) -> str:
        return f"{self.bucket_endpoint}/{key}"
\`\`\`

## Singleton instance (\`moogo/__init__.py\`)

\`\`\`python
# moogo/__init__.py
from .client import MoogoClient

moogo_client = MoogoClient()
\`\`\`

## Views (\`views.py\`)

\`\`\`python
# users/views.py
from django.http import JsonResponse, HttpResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import json
import uuid
from moogo import moogo_client, MoogoError

@method_decorator(csrf_exempt, name="dispatch")
class UserListView(View):
    def get(self, request):
        users = moogo_client.to_objects(moogo_client.sql("SELECT id, email, plan FROM users"))
        return JsonResponse(users, safe=False)

    def post(self, request):
        data = json.loads(request.body)
        user_id = str(uuid.uuid4())
        try:
            moogo_client.sql(
                "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
                [user_id, data["email"], data.get("plan", "free")]
            )
        except MoogoError as e:
            return JsonResponse({"error": e.message}, status=400)
        return JsonResponse({"id": user_id, "email": data["email"]}, status=201)

@method_decorator(csrf_exempt, name="dispatch")
class UserDetailView(View):
    def get(self, request, user_id):
        result = moogo_client.to_objects(moogo_client.sql("SELECT id, email, plan FROM users WHERE id = ?", [user_id]))
        if not result:
            return JsonResponse({"error": "Not found"}, status=404)
        return JsonResponse(result[0])
\`\`\`

## Django REST Framework (DRF)

\`\`\`python
# users/serializers.py
from rest_framework import serializers

class UserSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    email = serializers.EmailField()
    plan = serializers.CharField(default="free")
\`\`\`

\`\`\`python
# users/views.py (DRF)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from moogo import moogo_client, MoogoError
from .serializers import UserSerializer
import uuid

class UserViewSet(APIView):
    def get(self, request):
        users = moogo_client.to_objects(moogo_client.sql("SELECT id, email, plan FROM users"))
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = str(uuid.uuid4())
        try:
            moogo_client.sql(
                "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
                [user_id, serializer.validated_data["email"], serializer.validated_data.get("plan", "free")]
            )
        except MoogoError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"id": user_id, **serializer.validated_data}, status=status.HTTP_201_CREATED)
\`\`\`

## Bucket Views

\`\`\`python
# storage/views.py
from django.http import JsonResponse, FileResponse, HttpResponseBadRequest
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from moogo import moogo_client
import io

@method_decorator(csrf_exempt, name="dispatch")
class UploadView(View):
    def post(self, request):
        file = request.FILES["file"]
        moogo_client.bucket_upload(f"uploads/{file.name}", file.read(), file.content_type)
        return JsonResponse({"url": moogo_client.bucket_public_url(f"uploads/{file.name}")})

class ListFilesView(View):
    def get(self, request):
        return JsonResponse(moogo_client.bucket_list("uploads/").get("objects", []), safe=False)

class DownloadView(View):
    def get(self, request, key):
        content = moogo_client.bucket_download(key)
        return FileResponse(io.BytesIO(content), as_attachment=True, filename=key.split("/")[-1])
\`\`\`

## URLs

\`\`\`python
# urls.py
from django.urls import path
from users.views import UserListView, UserDetailView
from storage.views import UploadView, ListFilesView, DownloadView

urlpatterns = [
    path("api/users/", UserListView.as_view()),
    path("api/users/<str:user_id>/", UserDetailView.as_view()),
    path("api/upload/", UploadView.as_view()),
    path("api/files/", ListFilesView.as_view()),
    path("api/download/<path:key>/", DownloadView.as_view()),
]
\`\`\`

## Async views (Django 4.1+)

\`\`\`python
# moogo/async_client.py
import aiohttp
from django.conf import settings

class AsyncMoogoClient:
    def __init__(self):
        self.project_url = settings.MOOGO_PROJECT_URL
        self.secret_key = settings.MOOGO_SECRET_KEY
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args):
        await self.session.close()

    async def sql(self, query: str, args: list = None):
        args = args or []
        endpoint = "/query" if query.lstrip().upper().startswith(("SELECT", "VALUES", "PRAGMA", "EXPLAIN")) else "/exec"
        async with self.session.post(f"{self.project_url}{endpoint}", headers={"Authorization": f"Bearer {self.secret_key}"}, json={"query": query, "args": args}) as resp:
            return await resp.json()
\`\`\`

\`\`\`python
# views.py (async)
from django.http import JsonResponse
from moogo.async_client import AsyncMoogoClient

async def list_users(request):
    async with AsyncMoogoClient() as moogo:
        result = await moogo.sql("SELECT id, email, plan FROM users")
        # convert to objects...
    return JsonResponse(users, safe=False)
\`\`\`

## Run

\`\`\`bash
python manage.py runserver
# Production:
gunicorn myproject.wsgi:application -w 4 -b 0.0.0.0:8000
\`\`\`

## Next

- [Flask guide](/docs/guides/flask)
- [FastAPI guide](/docs/guides/fastapi)
- [Python vanilla guide](/docs/guides/python-vanilla)
- [Object storage](/docs/object-storage)`,vi=`# PHP (Vanilla)

Works with PHP 8.1+, no framework required.

## Setup

\`\`\`bash
# PHP 8.1+ with curl extension (enabled by default)
\`\`\`

**Environment variables** (\`.env\` or server config):

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`moogo.php\`)

\`\`\`php
<?php
// moogo.php

$projectUrl = $_ENV['MOOGO_PROJECT_URL'] ?? getenv('MOOGO_PROJECT_URL');
$secretKey = $_ENV['MOOGO_SECRET_KEY'] ?? getenv('MOOGO_SECRET_KEY');
$bucketEndpoint = $_ENV['MOOGO_BUCKET_ENDPOINT'] ?? getenv('MOOGO_BUCKET_ENDPOINT');
$bucketAccessKeyId = $_ENV['MOOGO_BUCKET_ACCESS_KEY_ID'] ?? getenv('MOOGO_BUCKET_ACCESS_KEY_ID');
$bucketSecretKey = $_ENV['MOOGO_BUCKET_SECRET_KEY'] ?? getenv('MOOGO_BUCKET_SECRET_KEY');

function moogoRequest(string $path, string $sql, array $args = []): array {
    global $projectUrl, $secretKey;
    $ch = curl_init("{$projectUrl}{$path}");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$secretKey}",
            "Content-Type: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode(["query" => $sql, "args" => $args]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $body = json_decode($response, true);
    if ($httpCode >= 400) {
        throw new MoogoException($body['error'] ?? []);
    }
    return $body;
}

function isRead(string $sql): bool {
    return (bool) preg_match('/^\\s*(SELECT|VALUES|PRAGMA|EXPLAIN)\\b/i', $sql);
}

function query(string $sql, array $args = []): array {
    return moogoRequest("/query", $sql, $args);
}

function exec(string $sql, array $args = []): array {
    return moogoRequest("/exec", $sql, $args);
}

function sql(string $sql, array $args = []): array {
    return isRead($sql) ? query($sql, $args) : exec($sql, $args);
}

function toObjects(array $result): array {
    $cols = $result['columns'] ?? [];
    return array_map(fn($row) => array_combine($cols, $row), $result['rows'] ?? []);
}

// ── Bucket ───────────────────────────────────────────────────────────
function storageRequest(string $method, string $path, $body = null, array $extraHeaders = []): array|string {
    global $bucketEndpoint, $bucketAccessKeyId, $bucketSecretKey;
    $ch = curl_init("{$bucketEndpoint}{$path}");
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => array_merge([
            "X-Moogo-Access-Key-Id: {$bucketAccessKeyId}",
            "Authorization: Bearer {$bucketSecretKey}",
        ], $extraHeaders),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 400) {
        throw new MoogoException(json_decode($response, true)['error'] ?? []);
    }
    if ($httpCode === 204) return [];
    return $response;
}

function bucketUpload(string $key, string $content, string $contentType): array {
    return json_decode(storageRequest("POST", "/{$key}", $content, ["Content-Type: {$contentType}"]), true);
}

function bucketDownload(string $key): string {
    return storageRequest("GET", "/{$key}");
}

function bucketDelete(string $key): array {
    return json_decode(storageRequest("DELETE", "/{$key}"), true);
}

function bucketList(?string $prefix = null): array {
    $path = $prefix ? "?prefix={$prefix}" : "";
    return json_decode(storageRequest("GET", $path), true);
}

function bucketPublicUrl(string $key): string {
    global $bucketEndpoint;
    return "{$bucketEndpoint}/{$key}";
}

class MoogoException extends Exception {
    public string $code;
    public ?string $detail;
    public function __construct(array $error) {
        $this->code = $error['code'] ?? 'unknown';
        $this->detail = $error['detail'] ?? null;
        parent::__construct($error['message'] ?? 'Moogo request failed');
    }
}
\`\`\`

## Usage — SQLite

\`\`\`php
<?php
require 'moogo.php';

sql("
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  )
");

sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    [uniqid('u_', true), "ketut@example.com", "pro"]);

$users = toObjects(sql("SELECT id, email, plan FROM users WHERE plan = ?", ["pro"]));

foreach ($users as $user) {
    echo "{$user['email']} — {$user['plan']}\\n";
}
\`\`\`

## Usage — Bucket

\`\`\`php
<?php
require 'moogo.php';

$content = file_get_contents("avatar.png");
bucketUpload("avatars/kit.png", $content, "image/png");

$files = bucketList("avatars/");
foreach ($files['objects'] as $obj) {
    echo "{$obj['key']} — {$obj['size_bytes']} bytes\\n";
}

$download = bucketDownload("avatars/kit.png");
file_put_contents("kit-download.png", $download);

echo "Public URL: " . bucketPublicUrl("public/logo.png") . "\\n";
\`\`\`

## Error handling

\`\`\`php
try {
    sql("SELECT * FROM nonexistent");
} catch (MoogoException $e) {
    if ($e->code === 'sql_error') {
        echo "SQLite error: {$e->detail}\\n";
    } elseif ($e->code === 'database_too_large') {
        echo "Project hit 100 MB limit\\n";
    } elseif ($e->getCode() === 401) {
        echo "Invalid or rotated secret key\\n";
    }
    throw $e;
}
\`\`\`

## PSR-7 / PSR-18 compatible (for frameworks)

\`\`\`php
<?php
// moogo-psr.php
use Psr\\Http\\Client\\ClientInterface;
use Psr\\Http\\Message\\RequestFactoryInterface;
use Psr\\Http\\Message\\StreamFactoryInterface;

class MoogoClient {
    public function __construct(
        private ClientInterface $client,
        private RequestFactoryInterface $requestFactory,
        private StreamFactoryInterface $streamFactory,
        private string $projectUrl,
        private string $secretKey
    ) {}

    public function sql(string $sql, array $args = []): array {
        $endpoint = preg_match('/^\\s*(SELECT|VALUES|PRAGMA|EXPLAIN)\\b/i', $sql) ? '/query' : '/exec';
        $request = $this->requestFactory->createRequest('POST', $this->projectUrl . $endpoint)
            ->withHeader('Authorization', "Bearer {$this->secretKey}")
            ->withHeader('Content-Type', 'application/json')
            ->withBody($this->streamFactory->createStream(json_encode(['query' => $sql, 'args' => $args])));
        $response = $this->client->sendRequest($request);
        $body = json_decode((string)$response->getBody(), true);
        if ($response->getStatusCode() >= 400) {
            throw new MoogoException($body['error'] ?? []);
        }
        return $body;
    }
}
\`\`\`

## Next

- [Laravel guide](/docs/guides/laravel)
- [Vanilla JS guide](/docs/guides/javascript-vanilla)
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)`,yi=`# Laravel

Expressive, elegant, full-stack framework with built-in HTTP client.

## Setup

\`\`\`bash
composer require laravel/http-client
\`\`\`

**Environment variables** (\`.env\`):

\`\`\`env
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...
MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
\`\`\`

\`\`\`php
// config/services.php
return [
    'moogo' => [
        'project_url' => env('MOOGO_PROJECT_URL'),
        'secret_key' => env('MOOGO_SECRET_KEY'),
        'bucket_endpoint' => env('MOOGO_BUCKET_ENDPOINT'),
        'bucket_access_key_id' => env('MOOGO_BUCKET_ACCESS_KEY_ID'),
        'bucket_secret_key' => env('MOOGO_BUCKET_SECRET_KEY'),
    ],
];
\`\`\`

## Service (\`app/Services/Moogo.php\`)

\`\`\`php
<?php
// app/Services/Moogo.php

namespace App\\Services;

use Illuminate\\Support\\Facades\\Http;
use Illuminate\\Http\\Client\\Response;

class Moogo {
    public function __construct(
        private string $projectUrl = null,
        private string $secretKey = null,
        private string $bucketEndpoint = null,
        private string $bucketAccessKeyId = null,
        private string $bucketSecretKey = null
    ) {
        $this->projectUrl ??= config('services.moogo.project_url');
        $this->secretKey ??= config('services.moogo.secret_key');
        $this->bucketEndpoint ??= config('services.moogo.bucket_endpoint');
        $this->bucketAccessKeyId ??= config('services.moogo.bucket_access_key_id');
        $this->bucketSecretKey ??= config('services.moogo.bucket_secret_key');
    }

    private function sqlClient(): \\Illuminate\\Http\\Client\\PendingRequest {
        return Http::withHeaders([
            'Authorization' => "Bearer {$this->secretKey}",
            'Content-Type' => 'application/json',
        ])->baseUrl($this->projectUrl)->timeout(30);
    }

    private function storageClient(): \\Illuminate\\Http\\Client\\PendingRequest {
        return Http::withHeaders([
            'X-Moogo-Access-Key-Id' => $this->bucketAccessKeyId,
            'Authorization' => "Bearer {$this->bucketSecretKey}",
        ])->baseUrl($this->bucketEndpoint)->timeout(30);
    }

    private function isRead(string $sql): bool {
        return (bool) preg_match('/^\\s*(SELECT|VALUES|PRAGMA|EXPLAIN)\\b/i', $sql);
    }

    private function handleError(Response $response): void {
        if ($response->failed()) {
            $error = $response->json('error', []);
            throw new MoogoException($error);
        }
    }

    // ── SQL ────────────────────────────────────────────────────────────
    public function query(string $sql, array $args = []): array {
        $response = $this->sqlClient()->post('/query', ['query' => $sql, 'args' => $args]);
        $this->handleError($response);
        return $response->json();
    }

    public function exec(string $sql, array $args = []): array {
        $response = $this->sqlClient()->post('/exec', ['query' => $sql, 'args' => $args]);
        $this->handleError($response);
        return $response->json();
    }

    public function sql(string $sql, array $args = []): array {
        return $this->isRead($sql) ? $this->query($sql, $args) : $this->exec($sql, $args);
    }

    public function toObjects(array $result): array {
        $cols = $result['columns'] ?? [];
        return array_map(fn($row) => array_combine($cols, $row), $result['rows'] ?? []);
    }

    // ── Bucket ─────────────────────────────────────────────────────────
    public function bucketUpload(string $key, string $content, string $contentType): array {
        $response = $this->storageClient()
            ->withHeaders(['Content-Type' => $contentType])
            ->post("/{$key}", $content);
        $this->handleError($response);
        return $response->json();
    }

    public function bucketDownload(string $key): string {
        $response = $this->storageClient()->get("/{$key}");
        $this->handleError($response);
        return $response->body();
    }

    public function bucketDelete(string $key): array {
        $response = $this->storageClient()->delete("/{$key}");
        $this->handleError($response);
        return $response->json();
    }

    public function bucketList(?string $prefix = null): array {
        $url = $prefix ? "?prefix={$prefix}" : "";
        $response = $this->storageClient()->get($url);
        $this->handleError($response);
        return $response->json();
    }

    public function bucketPublicUrl(string $key): string {
        return "{$this->bucketEndpoint}/{$key}";
    }
}

class MoogoException extends \\Exception {
    public string $code;
    public ?string $detail;
    public function __construct(array $error) {
        $this->code = $error['code'] ?? 'unknown';
        $this->detail = $error['detail'] ?? null;
        parent::__construct($error['message'] ?? 'Moogo request failed');
    }
}
\`\`\`

## Register as singleton (\`app/Providers/AppServiceProvider.php\`)

\`\`\`php
// app/Providers/AppServiceProvider.php
public function register(): void {
    $this->app->singleton(\\App\\Services\\Moogo::class, fn() => new \\App\\Services\\Moogo());
}
\`\`\`

## Controller (\`app/Http/Controllers/UserController.php\`)

\`\`\`php
<?php
// app/Http/Controllers/UserController.php

namespace App\\Http\\Controllers;

use App\\Services\\Moogo;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class UserController extends Controller {
    public function __construct(private Moogo $moogo) {}

    public function index(): JsonResponse {
        return response()->json($this->moogo->toObjects(
            $this->moogo->sql("SELECT id, email, plan FROM users")
        ));
    }

    public function store(Request $request): JsonResponse {
        $request->validate(['email' => 'required|email', 'plan' => 'string']);
        try {
            $id = (string) \\Illuminate\\Support\\Str::uuid();
            $this->moogo->sql(
                "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
                [$id, $request->email, $request->plan ?? 'free']
            );
        } catch (\\App\\Services\\MoogoException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
        return response()->json(['id' => $id, 'email' => $request->email], 201);
    }

    public function show(string $id): JsonResponse {
        $user = $this->moogo->toObjects(
            $this->moogo->sql("SELECT id, email, plan FROM users WHERE id = ?", [$id])
        );
        if (!$user) return response()->json(['error' => 'Not found'], 404);
        return response()->json($user[0]);
    }
}
\`\`\`

## Bucket Controller (\`app/Http/Controllers/StorageController.php\`)

\`\`\`php
<?php
// app/Http/Controllers/StorageController.php

namespace App\\Http\\Controllers;

use App\\Services\\Moogo;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Support\\Facades\\Storage;

class StorageController extends Controller {
    public function __construct(private Moogo $moogo) {}

    public function upload(Request $request): JsonResponse {
        $request->validate(['file' => 'required|file|max:10240']);
        $file = $request->file('file');
        $path = "uploads/{$file->hashName()}";
        $this->moogo->bucketUpload($path, file_get_contents($file), $file->getMimeType());
        return response()->json(['url' => $this->moogo->bucketPublicUrl($path)]);
    }

    public function list(): JsonResponse {
        return response()->json($this->moogo->bucketList('uploads/')['objects'] ?? []);
    }

    public function download(string $key) {
        $content = $this->moogo->bucketDownload($key);
        return response($content)
            ->header('Content-Disposition', "attachment; filename=\\"{$key}\\"");
    }
}
\`\`\`

## Routes (\`routes/api.php\`)

\`\`\`php
use App\\Http\\Controllers\\UserController;
use App\\Http\\Controllers\\StorageController;

Route::apiResource('users', UserController::class)->only(['index', 'store', 'show']);
Route::post('storage/upload', [StorageController::class, 'upload']);
Route::get('storage/files', [StorageController::class, 'list']);
Route::get('storage/download/{key}', [StorageController::class, 'download'])->where('key', '.*');
\`\`\`

## Blade Components (for public objects)

\`\`\`blade
{{-- resources/views/components/moogo-avatar.blade.php --}}
@props(['key'])
<img src="{{ app(\\App\\Services\\Moogo::class)->bucketPublicUrl($key) }}" alt="" />
\`\`\`

\`\`\`blade
{{-- usage --}}
<x-moogo-avatar key="public/avatars/user.png" />
\`\`\`

## Queue Jobs (background processing)

\`\`\`php
<?php
// app/Jobs/ProcessUsers.php

namespace App\\Jobs;

use App\\Services\\Moogo;
use Illuminate\\Bus\\Queueable;
use Illuminate\\Contracts\\Queue\\ShouldQueue;
use Illuminate\\Foundation\\Bus\\Dispatchable;

class ProcessUsers implements ShouldQueue {
    use Dispatchable, Queueable;

    public function __construct(public array $emails) {}

    public function handle(Moogo $moogo): void {
        foreach ($this->emails as $email) {
            $moogo->sql("INSERT INTO users (id, email) VALUES (?, ?)", [
                (string) \\Illuminate\\Support\\Str::uuid(), $email
            ]);
        }
    }
}
\`\`\`

\`\`\`php
// Controller
ProcessUsers::dispatch($emails)->onQueue('moogo');
\`\`\`

## Testing

\`\`\`php
// tests/Feature/UserTest.php
public function test_create_user() {
    Http::fake([
        config('services.moogo.project_url') . '/*' => Http::response([
            'success' => true,
            'rows_affected' => 1,
        ], 200),
    ]);

    $response = $this->postJson('/api/users', ['email' => 'test@example.com']);
    $response->assertStatus(201)->assertJsonStructure(['id', 'email']);
}
\`\`\`

## Octane / Swoole (high performance)

\`\`\`bash
composer require laravel/octane
php artisan octane:install --server=swoole
php artisan octane:start
\`\`\`

The \`Http\` facade works natively with Octane/Swoole.

## Next

- [PHP vanilla guide](/docs/guides/php-vanilla)
- [FastAPI guide](/docs/guides/fastapi)
- [Django guide](/docs/guides/django)
- [Object storage](/docs/object-storage)`,bi=`# Go

Native HTTP client, zero dependencies, compiles to single binary.

## Setup

\`\`\`bash
# Go 1.21+ (stdlib only)
go mod init myapp
\`\`\`

**Environment variables:**

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`moogo/moogo.go\`)

\`\`\`go
// moogo/moogo.go
package moogo

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"regexp"
)

var (
	projectURL     = os.Getenv("MOOGO_PROJECT_URL")
	secretKey      = os.Getenv("MOOGO_SECRET_KEY")
	bucketEndpoint = os.Getenv("MOOGO_BUCKET_ENDPOINT")
	bucketAccessKeyID = os.Getenv("MOOGO_BUCKET_ACCESS_KEY_ID")
	bucketSecretKey = os.Getenv("MOOGO_BUCKET_SECRET_KEY")

	readRe = regexp.MustCompile(\`^\\s*(?i:SELECT|VALUES|PRAGMA|EXPLAIN)\\b\`)
	httpClient = &http.Client{Timeout: 30 * 1e9} // 30s
)

type Error struct {
	Code    string \`json:"code"\`
	Message string \`json:"message"\`
	Detail  string \`json:"detail"\`
	Status  int
}

func (e *Error) Error() string { return e.Message }

func do(method, url string, headers map[string]string, body any) (map[string]any, error) {
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, url, &buf)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode >= 400 {
		err := &Error{Status: resp.StatusCode}
		if e := result["error"].(map[string]any); e != nil {
			err.Code = e["code"].(string)
			err.Message = e["message"].(string)
			err.Detail = e["detail"].(string)
		}
		return nil, err
	}
	return result, nil
}

// ── SQL ──────────────────────────────────────────────────────────────
func Query(sql string, args ...any) (map[string]any, error) {
	return do("POST", projectURL+"/query", map[string]string{
		"Authorization": "Bearer " + secretKey,
	}, map[string]any{"query": sql, "args": args})
}

func Exec(sql string, args ...any) (map[string]any, error) {
	return do("POST", projectURL+"/exec", map[string]string{
		"Authorization": "Bearer " + secretKey,
	}, map[string]any{"query": sql, "args": args})
}

func SQL(sql string, args ...any) (map[string]any, error) {
	if readRe.MatchString(sql) {
		return Query(sql, args...)
	}
	return Exec(sql, args...)
}

func ToObjects(result map[string]any) []map[string]any {
	cols := result["columns"].([]any)
	rows := result["rows"].([]any)
	out := make([]map[string]any, len(rows))
	for i, row := range rows {
		rowArr := row.([]any)
		m := make(map[string]any, len(cols))
		for j, col := range cols {
			m[col.(string)] = rowArr[j]
		}
		out[i] = m
	}
	return out
}

// ── Bucket ───────────────────────────────────────────────────────────
func BucketUpload(key string, content []byte, contentType string) (map[string]any, error) {
	return do("POST", bucketEndpoint+"/"+key, map[string]string{
		"X-Moogo-Access-Key-Id": bucketAccessKeyID,
		"Authorization": "Bearer " + bucketSecretKey,
		"Content-Type": contentType,
	}, bytes.NewReader(content))
}

func BucketDownload(key string) ([]byte, error) {
	req, _ := http.NewRequest("GET", bucketEndpoint+"/"+key, nil)
	req.Header.Set("X-Moogo-Access-Key-Id", bucketAccessKeyID)
	req.Header.Set("Authorization", "Bearer "+bucketSecretKey)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func BucketDelete(key string) (map[string]any, error) {
	return do("DELETE", bucketEndpoint+"/"+key, map[string]string{
		"X-Moogo-Access-Key-Id": bucketAccessKeyID,
		"Authorization": "Bearer " + bucketSecretKey,
	}, nil)
}

func BucketList(prefix string) (map[string]any, error) {
	url := bucketEndpoint
	if prefix != "" {
		url += "?prefix=" + prefix
	}
	return do("GET", url, map[string]string{
		"X-Moogo-Access-Key-Id": bucketAccessKeyID,
		"Authorization": "Bearer " + bucketSecretKey,
	}, nil)
}

func BucketPublicUrl(key string) string {
	return bucketEndpoint + "/" + key
}
\`\`\`

## Usage

\`\`\`go
// main.go
package main

import (
	"fmt"
	"os"
	"your/module/moogo"
)

func main() {
	// Create table
	moogo.Must(moogo.SQL(\`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			plan TEXT DEFAULT 'free'
		)
	\`))

	// Insert
	moogo.Must(moogo.SQL("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
		"u1", "ketut@example.com", "pro"))

	// Query
	users := moogo.ToObjects(moogo.Must(moogo.SQL("SELECT id, email, plan FROM users WHERE plan = ?", "pro")))
	fmt.Println(users)

	// Bucket upload
	content, _ := os.ReadFile("avatar.png")
	moogo.Must(moogo.BucketUpload("avatars/kit.png", content, "image/png"))

	// Public URL
	fmt.Println(moogo.BucketPublicUrl("public/logo.png"))
}

// Helper for examples
func Must[T any](v T, err error) T {
	if err != nil {
		var e *moogo.Error
		if errors.As(err, &e) {
			fmt.Fprintf(os.Stderr, "Moogo error [%s]: %s\\n", e.Code, e.Message)
		} else {
			fmt.Fprintf(os.Stderr, "Error: %v\\n", err)
		}
		os.Exit(1)
	}
	return v
}
\`\`\`

## HTTP Server (stdlib)

\`\`\`go
// server.go
package main

import (
	"encoding/json"
	"net/http"
	"your/module/moogo"
)

func main() {
	http.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			users := moogo.ToObjects(moogo.Must(moogo.SQL("SELECT id, email, plan FROM users")))
			json.NewEncoder(w).Encode(users)
		case http.MethodPost:
			var in struct{ Email, Plan string }
			json.NewDecoder(r.Body).Decode(&in)
			id := "u_" + randomID()
			moogo.Must(moogo.SQL("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", id, in.Email, in.Plan))
			json.NewEncoder(w).Encode(map[string]string{"id": id})
		}
	})

	http.HandleFunc("/api/upload", func(w http.ResponseWriter, r *http.Request) {
		file, _, _ := r.FormFile("file")
		defer file.Close()
		content, _ := io.ReadAll(file)
		moogo.Must(moogo.BucketUpload("uploads/"+file.Filename, content, r.Header.Get("Content-Type")))
		json.NewEncoder(w).Encode(map[string]string{"url": moogo.BucketPublicUrl("uploads/" + file.Filename)})
	})

	http.ListenAndServe(":8080", nil)
}

func randomID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
\`\`\`

## Gin / Echo / Chi

\`\`\`go
// Gin example
import "github.com/gin-gonic/gin"

func main() {
	r := gin.Default()
	r.GET("/users", func(c *gin.Context) {
		users := moogo.ToObjects(moogo.Must(moogo.SQL("SELECT id, email, plan FROM users")))
		c.JSON(200, users)
	})
	r.Run()
}
\`\`\`

## Error handling

\`\`\`go
result, err := moogo.SQL("SELECT * FROM nonexistent")
var e *moogo.Error
if errors.As(err, &e) {
	switch e.Code {
	case "sql_error":
		log.Printf("SQLite: %s", e.Detail)
	case "database_too_large":
		log.Println("Quota exceeded")
	case "statement_timeout":
		log.Println("Query too slow")
	}
}
\`\`\`

## Testing

\`\`\`go
// moogo_test.go
func TestSQL(t *testing.T) {
	// Use httptest.Server to mock Moogo API
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		json.NewEncoder(w).Encode(map[string]any{
			"success": true, "columns": []string{"id"}, "rows": [][]any{{"u1"}}, "row_count": 1,
		})
	}))
	defer server.Close()

	os.Setenv("MOOGO_PROJECT_URL", server.URL)
	os.Setenv("MOOGO_SECRET_KEY", "test")

	users := moogo.ToObjects(moogo.Must(moogo.SQL("SELECT id FROM users")))
	assert.Equal(t, []map[string]any{{"id": "u1"}}, users)
}
\`\`\`

## Cross-compile

\`\`\`bash
GOOS=linux GOARCH=amd64 go build -o myapp-linux
GOOS=windows GOARCH=amd64 go build -o myapp.exe
\`\`\`

## Next

- [Python guide](/docs/guides/python-vanilla)
- [Java/Kotlin guide](/docs/guides/java-kotlin)
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)`,xi=`# Ruby / Rails

Works with Rails 7+, Sinatra, Hanami, or plain Ruby.

## Setup

\`\`\`bash
# Gemfile
gem 'httparty'  # or use Net::HTTP (stdlib)
\`\`\`

**Environment variables** (\`.env\` or Rails credentials):

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`lib/moogo.rb\`)

\`\`\`ruby
# lib/moogo.rb
require 'net/http'
require 'json'
require 'uri'

class Moogo
  PROJECT_URL = ENV['MOOGO_PROJECT_URL']
  SECRET_KEY  = ENV['MOOGO_SECRET_KEY']
  BUCKET_ENDPOINT = ENV['MOOGO_BUCKET_ENDPOINT']
  BUCKET_ACCESS_KEY_ID = ENV['MOOGO_BUCKET_ACCESS_KEY_ID']
  BUCKET_SECRET_KEY = ENV['MOOGO_BUCKET_SECRET_KEY']

  SQL_HEADERS = { 'Authorization' => "Bearer #{SECRET_KEY}", 'Content-Type' => 'application/json' }
  STORAGE_HEADERS = { 'X-Moogo-Access-Key-Id' => BUCKET_ACCESS_KEY_ID, 'Authorization' => "Bearer #{BUCKET_SECRET_KEY}" }

  class Error < StandardError
    attr_reader :code, :detail, :status
    def initialize(error, status = nil)
      @code = error['code']
      @detail = error['detail']
      @status = status
      super(error['message'])
    end
  end

  def self.request(method, path, body: nil, headers: SQL_HEADERS)
    uri = URI("#{PROJECT_URL}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = case method
          when :get then Net::HTTP::Get.new(uri)
          when :post then Net::HTTP::Post.new(uri)
          when :delete then Net::HTTP::Delete.new(uri)
          end
    headers.each { |k, v| req[k] = v }
    req.body = body.to_json if body

    res = http.request(req)
    body = JSON.parse(res.body)
    raise Error.new(body['error'], res.code.to_i) unless res.is_a?(Net::HTTPSuccess)
    body
  end

  def self.read?(sql)
    sql.strip.match?(/^(SELECT|VALUES|PRAGMA|EXPLAIN)\\b/i)
  end

  # ── SQL ────────────────────────────────────────────────────────────
  def self.query(sql, args = [])
    request(:post, '/query', body: { query: sql, args: args })
  end

  def self.exec(sql, args = [])
    request(:post, '/exec', body: { query: sql, args: args })
  end

  def self.sql(sql, args = [])
    read?(sql) ? query(sql, args) : exec(sql, args)
  end

  def self.to_objects(result)
    cols = result['columns'] || []
    (result['rows'] || []).map { |row| cols.zip(row).to_h }
  end

  # ── Bucket ─────────────────────────────────────────────────────────
  def self.bucket_request(method, path, body: nil, extra_headers: {})
    uri = URI("#{BUCKET_ENDPOINT}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = case method
          when :get then Net::HTTP::Get.new(uri)
          when :post then Net::HTTP::Post.new(uri)
          when :delete then Net::HTTP::Delete.new(uri)
          end
    STORAGE_HEADERS.merge(extra_headers).each { |k, v| req[k] = v }
    req.body = body if body

    res = http.request(req)
    return '' if res.code == '204'
    body = JSON.parse(res.body)
    raise Error.new(body['error'], res.code.to_i) unless res.is_a?(Net::HTTPSuccess)
    body
  end

  def self.bucket_upload(key, content, content_type)
    bucket_request(:post, "/#{key}", body: content, extra_headers: { 'Content-Type' => content_type })
  end

  def self.bucket_download(key)
    uri = URI("#{BUCKET_ENDPOINT}/#{key}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    req = Net::HTTP::Get.new(uri)
    STORAGE_HEADERS.each { |k, v| req[k] = v }
    res = http.request(req)
    raise Error.new({ 'code' => 'download_failed' }, res.code.to_i) unless res.is_a?(Net::HTTPSuccess)
    res.body
  end

  def self.bucket_delete(key)
    bucket_request(:delete, "/#{key}")
  end

  def self.bucket_list(prefix = nil)
    path = prefix ? "?prefix=#{prefix}" : ''
    bucket_request(:get, path)
  end

  def self.bucket_public_url(key)
    "#{BUCKET_ENDPOINT}/#{key}"
  end
end
\`\`\`

## Usage (Plain Ruby)

\`\`\`ruby
require_relative 'lib/moogo'

Moogo.sql(<<~SQL)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free'
  )
SQL

Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
          SecureRandom.uuid, "ketut@example.com", "pro")

users = Moogo.to_objects(Moogo.sql("SELECT id, email, plan FROM users WHERE plan = ?", ["pro"]))
puts users.inspect

# Bucket
content = File.read("avatar.png")
Moogo.bucket_upload("avatars/kit.png", content, "image/png")
puts Moogo.bucket_public_url("public/logo.png")
\`\`\`

---

## Rails Integration

### Service (\`app/services/moogo.rb\`)

\`\`\`ruby
# app/services/moogo.rb
class Moogo
  PROJECT_URL = Rails.application.credentials.moogo_project_url || ENV['MOOGO_PROJECT_URL']
  SECRET_KEY  = Rails.application.credentials.moogo_secret_key || ENV['MOOGO_SECRET_KEY']
  BUCKET_ENDPOINT = Rails.application.credentials.moogo_bucket_endpoint || ENV['MOOGO_BUCKET_ENDPOINT']
  BUCKET_ACCESS_KEY_ID = Rails.application.credentials.moogo_bucket_access_key_id || ENV['MOOGO_BUCKET_ACCESS_KEY_ID']
  BUCKET_SECRET_KEY = Rails.application.credentials.moogo_bucket_secret_key || ENV['MOOGO_BUCKET_SECRET_KEY']

  SQL_HEADERS = { 'Authorization' => "Bearer #{SECRET_KEY}", 'Content-Type' => 'application/json' }
  STORAGE_HEADERS = { 'X-Moogo-Access-Key-Id' => BUCKET_ACCESS_KEY_ID, 'Authorization' => "Bearer #{BUCKET_SECRET_KEY}" }

  class Error < StandardError
    attr_reader :code, :detail, :status
    def initialize(error, status = nil)
      @code = error['code']
      @detail = error['detail']
      @status = status
      super(error['message'])
    end
  end

  def self.client
    @@client ||= Faraday.new(PROJECT_URL) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end
  end

  def self.storage_client
    @@storage_client ||= Faraday.new(BUCKET_ENDPOINT) do |f|
      f.response :json
      f.adapter Faraday.default_adapter
    end
  end

  def self.read?(sql)
    sql.strip.match?(/^(SELECT|VALUES|PRAGMA|EXPLAIN)\\b/i)
  end

  # ── SQL ────────────────────────────────────────────────────────────
  def self.query(sql, args = [])
    res = client.post('/query') { |req| req.body = { query: sql, args: args }; req.headers.merge!(SQL_HEADERS) }
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.exec(sql, args = [])
    res = client.post('/exec') { |req| req.body = { query: sql, args: args }; req.headers.merge!(SQL_HEADERS) }
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.sql(sql, args = [])
    read?(sql) ? query(sql, args) : exec(sql, args)
  end

  def self.to_objects(result)
    cols = result['columns'] || []
    (result['rows'] || []).map { |row| cols.zip(row).to_h }
  end

  # ── Bucket ─────────────────────────────────────────────────────────
  def self.bucket_upload(key, content, content_type)
    res = storage_client.post("/#{key}") do |req|
      req.headers.merge!(STORAGE_HEADERS.merge('Content-Type' => content_type))
      req.body = content
    end
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.bucket_download(key)
    res = storage_client.get("/#{key}") { |req| req.headers.merge!(STORAGE_HEADERS) }
    raise Error.new({ 'code' => 'download_failed' }, res.status) unless res.success?
    res.body
  end

  def self.bucket_delete(key)
    res = storage_client.delete("/#{key}") { |req| req.headers.merge!(STORAGE_HEADERS) }
    raise Error.new(res.body['error'], res.status) unless res.success?
  end

  def self.bucket_list(prefix = nil)
    path = prefix ? "?prefix=#{prefix}" : ''
    res = storage_client.get(path) { |req| req.headers.merge!(STORAGE_HEADERS) }
    raise Error.new(res.body['error'], res.status) unless res.success?
    res.body
  end

  def self.bucket_public_url(key)
    "#{BUCKET_ENDPOINT}/#{key}"
  end
end
\`\`\`

### Controller (\`app/controllers/users_controller.rb\`)

\`\`\`ruby
class UsersController < ApplicationController
  def index
    users = Moogo.to_objects(Moogo.sql("SELECT id, email, plan FROM users"))
    render json: users
  end

  def create
    user_id = SecureRandom.uuid
    Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
              user_id, params[:email], params[:plan] || 'free')
    render json: { id: user_id, email: params[:email] }, status: :created
  rescue Moogo::Error => e
    render json: { error: e.message }, status: :bad_request
  end

  def show
    user = Moogo.to_objects(Moogo.sql("SELECT id, email, plan FROM users WHERE id = ?", [params[:id]])).first
    render json: user || { error: 'Not found' }, status: user ? :ok : :not_found
  end
end
\`\`\`

### Storage Controller (\`app/controllers/storage_controller.rb\`)

\`\`\`ruby
class StorageController < ApplicationController
  def upload
    file = params[:file]
    Moogo.bucket_upload("uploads/#{file.original_filename}", file.read, file.content_type)
    render json: { url: Moogo.bucket_public_url("uploads/#{file.original_filename}") }
  end

  def list
    render json: Moogo.bucket_list('uploads/')['objects'] || []
  end

  def download
    content = Moogo.bucket_download(params[:key])
    send_data content, filename: params[:key].split('/').last, disposition: 'attachment'
  rescue Moogo::Error => e
    render json: { error: e.message }, status: e.status || 500
  end
end
\`\`\`

### Routes (\`config/routes.rb\`)

\`\`\`ruby
Rails.application.routes.draw do
  resources :users, only: [:index, :create, :show]
  post 'storage/upload', to: 'storage#upload'
  get 'storage/files', to: 'storage#list'
  get 'storage/download/*key', to: 'storage#download'
end
\`\`\`

### View Helper (\`app/helpers/moogo_helper.rb\`)

\`\`\`ruby
module MoogoHelper
  def moogo_public_url(key)
    Moogo.bucket_public_url(key)
  end
end
\`\`\`

\`\`\`erb
<%# usage %>
<%= image_tag moogo_public_url('public/avatars/user.png') %>
\`\`\`

### ActiveJob (background)

\`\`\`ruby
# app/jobs/process_users_job.rb
class ProcessUsersJob < ApplicationJob
  queue_as :moogo

  def perform(emails)
    emails.each do |email|
      Moogo.sql("INSERT INTO users (id, email) VALUES (?, ?)", [SecureRandom.uuid, email])
    end
  end
end
\`\`\`

\`\`\`ruby
ProcessUsersJob.perform_later(emails)
\`\`\`

## Sinatra / Hanami

\`\`\`ruby
# Sinatra example
require 'sinatra'
require_relative 'lib/moogo'

get '/users' do
  content_type :json
  Moogo.to_objects(Moogo.sql("SELECT id, email, plan FROM users")).to_json
end

post '/users' do
  data = JSON.parse(request.body.read)
  id = SecureRandom.uuid
  Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [id, data['email'], data['plan'] || 'free'])
  { id: id, email: data['email'] }.to_json
end
\`\`\`

## Next

- [Python guide](/docs/guides/python-vanilla)
- [Go guide](/docs/guides/go)
- [Java/Kotlin guide](/docs/guides/java-kotlin)
- [Object storage](/docs/object-storage)`,Si=`# Java / Kotlin

Works with Java 17+ (HttpClient), Spring Boot, Quarkus, Micronaut, or Kotlin coroutines.

## Setup

\`\`\`xml
<!-- Maven -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.17.0</version>
</dependency>
<!-- Or Gradle: implementation("com.fasterxml.jackson.core:jackson-databind:2.17.0") -->
\`\`\`

**Environment variables:**

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Java Client (Vanilla)

\`\`\`java
// Moogo.java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import com.fasterxml.jackson.databind.ObjectMapper;

public class Moogo {
    private static final String PROJECT_URL = System.getenv("MOOGO_PROJECT_URL");
    private static final String SECRET_KEY = System.getenv("MOOGO_SECRET_KEY");
    private static final String BUCKET_ENDPOINT = System.getenv("MOOGO_BUCKET_ENDPOINT");
    private static final String BUCKET_ACCESS_KEY_ID = System.getenv("MOOGO_BUCKET_ACCESS_KEY_ID");
    private static final String BUCKET_SECRET_KEY = System.getenv("MOOGO_BUCKET_SECRET_KEY");

    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static CompletableFuture<Map<String, Object>> query(String sql, List<Object> args) {
        return request("/query", sql, args);
    }

    public static CompletableFuture<Map<String, Object>> exec(String sql, List<Object> args) {
        return request("/exec", sql, args);
    }

    public static CompletableFuture<Map<String, Object>> sql(String sql, List<Object> args) {
        if (sql.trim().matches("(?i)^(SELECT|VALUES|PRAGMA|EXPLAIN)\\\\b.*")) {
            return query(sql, args);
        }
        return exec(sql, args);
    }

    private static CompletableFuture<Map<String, Object>> request(String path, String sql, List<Object> args) {
        var body = Map.of("query", sql, "args", args);
        var json = MAPPER.writeValueAsString(body);

        var request = HttpRequest.newBuilder()
            .uri(URI.create(PROJECT_URL + path))
            .header("Authorization", "Bearer " + SECRET_KEY)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();

        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenApply(res -> {
                if (res.statusCode() >= 400) {
                    throw new MoogoException(res.body());
                }
                return MAPPER.readValue(res.body(), Map.class);
            });
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> toObjects(Map<String, Object> result) {
        List<String> cols = (List<String>) result.get("columns");
        List<List<Object>> rows = (List<List<Object>>) result.get("rows");
        return rows.stream().map(row -> {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            for (int i = 0; i < cols.size(); i++) map.put(cols.get(i), row.get(i));
            return map;
        }).toList();
    }

    // ── Bucket ─────────────────────────────────────────────────────────
    public static CompletableFuture<Map<String, Object>> bucketUpload(String key, byte[] content, String contentType) {
        var request = HttpRequest.newBuilder()
            .uri(URI.create(BUCKET_ENDPOINT + "/" + key))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer " + BUCKET_SECRET_KEY)
            .header("Content-Type", contentType)
            .POST(HttpRequest.BodyPublishers.ofByteArray(content))
            .build();
        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenApply(res -> {
                if (res.statusCode() >= 400) throw new MoogoException(res.body());
                return MAPPER.readValue(res.body(), Map.class);
            });
    }

    public static CompletableFuture<byte[]> bucketDownload(String key) {
        var request = HttpRequest.newBuilder()
            .uri(URI.create(BUCKET_ENDPOINT + "/" + key))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer " + BUCKET_SECRET_KEY)
            .GET()
            .build();
        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofByteArray())
            .thenApply(HttpResponse::body);
    }

    public static CompletableFuture<Map<String, Object>> bucketDelete(String key) {
        var request = HttpRequest.newBuilder()
            .uri(URI.create(BUCKET_ENDPOINT + "/" + key))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer " + BUCKET_SECRET_KEY)
            .DELETE()
            .build();
        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenApply(res -> {
                if (res.statusCode() >= 400) throw new MoogoException(res.body());
                return MAPPER.readValue(res.body(), Map.class);
            });
    }

    public static String bucketPublicUrl(String key) {
        return BUCKET_ENDPOINT + "/" + key;
    }
}

class MoogoException extends RuntimeException {
    public final String code, detail; public final int status;
    MoogoException(String json) { /* parse error json */ super(""); }
}
\`\`\`

## Usage (Java)

\`\`\`java
import java.util.*;
import java.util.concurrent.CompletableFuture;

public class Main {
    public static void main(String[] args) throws Exception {
        // Create table
        Moogo.sql("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                plan TEXT DEFAULT 'free'
            )
            """, List.of()).join();

        // Insert
        Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
            List.of(UUID.randomUUID().toString(), "ketut@example.com", "pro")).join();

        // Query
        var users = Moogo.toObjects(Moogo.sql("SELECT id, email, plan FROM users WHERE plan = ?", List.of("pro")).join());
        System.out.println(users);

        // Bucket
        byte[] content = Files.readAllBytes(Path.of("avatar.png"));
        Moogo.bucketUpload("avatars/kit.png", content, "image/png").join();
        System.out.println(Moogo.bucketPublicUrl("public/logo.png"));
    }
}
\`\`\`

---

## Spring Boot

### Configuration (\`application.yml\`)

\`\`\`yaml
moogo:
  project-url: \${MOOGO_PROJECT_URL}
  secret-key: \${MOOGO_SECRET_KEY}
  bucket-endpoint: \${MOOGO_BUCKET_ENDPOINT}
  bucket-access-key-id: \${MOOGO_BUCKET_ACCESS_KEY_ID}
  bucket-secret-key: \${MOOGO_BUCKET_SECRET_KEY}
\`\`\`

### Client Bean (\`MoogoClient.java\`)

\`\`\`java
@Component
public class MoogoClient {
    private final String projectUrl, secretKey, bucketEndpoint, bucketAccessKeyId, bucketSecretKey;
    private final WebClient webClient;

    public MoogoClient(@Value("\${moogo.project-url}") String projectUrl,
                       @Value("\${moogo.secret-key}") String secretKey,
                       @Value("\${moogo.bucket-endpoint}") String bucketEndpoint,
                       @Value("\${moogo.bucket-access-key-id}") String bucketAccessKeyId,
                       @Value("\${moogo.bucket-secret-key}") String bucketSecretKey,
                       WebClient.Builder builder) {
        this.projectUrl = projectUrl;
        this.secretKey = secretKey;
        this.bucketEndpoint = bucketEndpoint;
        this.bucketAccessKeyId = bucketAccessKeyId;
        this.bucketSecretKey = bucketSecretKey;
        this.webClient = builder.build();
    }

    public Mono<Map<String, Object>> sql(String sql, List<Object> args) {
        String path = sql.trim().matches("(?i)^(SELECT|VALUES|PRAGMA|EXPLAIN)\\\\b.*") ? "/query" : "/exec";
        return webClient.post()
            .uri(projectUrl + path)
            .header("Authorization", "Bearer " + secretKey)
            .bodyValue(Map.of("query", sql, "args", args))
            .retrieve()
            .onStatus(s -> s.is4xxClientError() || s.is5xxServerError(),
                res -> res.bodyToMono(String.class).map(MoogoException::new))
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    public Flux<Map<String, Object>> toObjects(Mono<Map<String, Object>> result) {
        return result.flatMapIterable(r -> {
            List<String> cols = (List<String>) r.get("columns");
            List<List<Object>> rows = (List<List<Object>>) r.get("rows");
            return rows.stream().map(row -> {
                Map<String, Object> map = new LinkedHashMap<>();
                for (int i = 0; i < cols.size(); i++) map.put(cols.get(i), row.get(i));
                return map;
            }).toList();
        });
    }

    // Bucket methods similar...
}
\`\`\`

### Controller

\`\`\`java
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final MoogoClient moogo;

    public UserController(MoogoClient moogo) { this.moogo = moogo; }

    @GetMapping
    public Flux<Map<String, Object>> list() {
        return moogo.toObjects(moogo.sql("SELECT id, email, plan FROM users", List.of()));
    }

    @PostMapping
    public Mono<Map<String, Object>> create(@RequestBody UserRequest req) {
        String id = UUID.randomUUID().toString();
        return moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
            List.of(id, req.email(), req.plan()))
            .map(r -> Map.of("id", id, "email", req.email(), "plan", req.plan()));
    }
}
\`\`\`

---

## Kotlin Coroutines

\`\`\`kotlin
// Moogo.kt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper

object Moogo {
    private val PROJECT_URL = System.getenv("MOOGO_PROJECT_URL")!!
    private val SECRET_KEY = System.getenv("MOOGO_SECRET_KEY")!!
    private val BUCKET_ENDPOINT = System.getenv("MOOGO_BUCKET_ENDPOINT")!!
    private val BUCKET_ACCESS_KEY_ID = System.getenv("MOOGO_BUCKET_ACCESS_KEY_ID")!!
    private val BUCKET_SECRET_KEY = System.getenv("MOOGO_BUCKET_SECRET_KEY")!!

    private val HTTP = HttpClient.newHttpClient()
    private val MAPPER = jacksonObjectMapper()

    private fun isRead(sql: String) = sql.trim().matches(Regex("(?i)^(SELECT|VALUES|PRAGMA|EXPLAIN)\\\\b.*"))

    suspend fun sql(sql: String, args: List<Any> = emptyList()): Map<String, Any> {
        val path = if (isRead(sql)) "/query" else "/exec"
        val body = mapOf("query" to sql, "args" to args)
        val json = MAPPER.writeValueAsString(body)

        val request = HttpRequest.newBuilder()
            .uri(URI.create(PROJECT_URL + path))
            .header("Authorization", "Bearer $SECRET_KEY")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build()

        val response = HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString()).await()
        if (response.statusCode() >= 400) throw MoogoException(response.body())
        return MAPPER.readValue(response.body())
    }

    fun toObjects(result: Map<String, Any>): List<Map<String, Any>> {
        val cols = result["columns"] as List<String>
        val rows = result["rows"] as List<List<Any>>
        return rows.map { row -> cols.zip(row).toMap() }
    }

    // Bucket
    suspend fun bucketUpload(key: String, content: ByteArray, contentType: String): Map<String, Any> {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$BUCKET_ENDPOINT/$key"))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer $BUCKET_SECRET_KEY")
            .header("Content-Type", contentType)
            .POST(HttpRequest.BodyPublishers.ofByteArray(content))
            .build()
        val response = HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString()).await()
        if (response.statusCode() >= 400) throw MoogoException(response.body())
        return MAPPER.readValue(response.body())
    }

    suspend fun bucketDownload(key: String): ByteArray {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$BUCKET_ENDPOINT/$key"))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer $BUCKET_SECRET_KEY")
            .GET()
            .build()
        val response = HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofByteArray()).await()
        return response.body()
    }

    fun bucketPublicUrl(key: String) = "$BUCKET_ENDPOINT/$key"
}

class MoogoException(json: String) : RuntimeException("Moogo error")
\`\`\`

### Usage (Kotlin)

\`\`\`kotlin
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    Moogo.sql("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            plan TEXT DEFAULT 'free'
        )
    """)

    Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
        listOf(UUID.randomUUID().toString(), "ketut@example.com", "pro"))

    val users = Moogo.toObjects(Moogo.sql("SELECT id, email, plan FROM users WHERE plan = ?", listOf("pro")))
    println(users)

    val content = File("avatar.png").readBytes()
    Moogo.bucketUpload("avatars/kit.png", content, "image/png")
    println(Moogo.bucketPublicUrl("public/logo.png"))
}
\`\`\`

## Quarkus / Micronaut

\`\`\`java
// Quarkus - use REST Client
@RegisterRestClient(configKey = "moogo")
public interface MoogoClient {
    @POST @Path("/query")
    CompletionStage<JsonNode> query(JsonNode body);

    @POST @Path("/exec")
    CompletionStage<JsonNode> exec(JsonNode body);
}

// application.properties
quarkus.rest-client.moogo.url=https://api.moogo.dev/p/<project-id>
quarkus.rest-client.moogo.scope=javax.inject.Singleton
\`\`\`

## Testing

\`\`\`java
// MockWebServer (OkHttp) for testing
try (MockWebServer server = new MockWebServer()) {
    server.enqueue(new MockResponse()
        .setResponseCode(200)
        .setBody("{\\"success\\":true,\\"columns\\":[\\"id\\"],\\"rows\\":[[\\"u1\\"]],\\"row_count\\":1}"));
    server.start();

    System.setProperty("MOOGO_PROJECT_URL", server.url("/").toString());
    // run tests...
}
\`\`\`

## GraalVM Native Image

\`\`\`bash
# Spring Boot 3+ / Quarkus / Micronaut support native compilation
./mvnw -Pnative native:compile
# or
./gradlew nativeCompile
\`\`\`

The \`java.net.http.HttpClient\` works in native images (since Java 17).

## Next

- [Go guide](/docs/guides/go)
- [Ruby/Rails guide](/docs/guides/ruby-rails)
- [Python guide](/docs/guides/python-vanilla)
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)`,Ci=`# Database Schema & Migrations

This guide covers how to create and evolve your database schema in Moogo, along with best practices for writing SQL.

---

## How Migrations Work in Moogo

Moogo doesn't have a built-in migration tool. Instead, you run DDL statements directly via the \`/exec\` endpoint. This gives you full control but requires discipline.

### The Migration Pattern

\`\`\`javascript
// Run DDL via /exec endpoint
await sql(\`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
\`);
\`\`\`

**Key points:**
- DDL runs through \`/exec\` (not \`/query\`)
- Use \`CREATE TABLE IF NOT EXISTS\` for idempotency
- Each migration = one or more \`exec\` calls
- Run migrations during deployment, before deploying app code

---

## Recommended Migration Workflow

### 1. Migration Files (Local)

\`\`\`
migrations/
  001_create_users.sql
  002_add_posts_table.sql
  003_add_indexes.sql
  004_add_foreign_keys.sql
\`\`\`

### 2. Migration Runner (Example)

\`\`\`javascript
// migrate.js
import fs from 'fs';
import path from 'path';
import { sql } from './lib/moogo';

const MIGRATIONS_DIR = './migrations';

async function runMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(\`Running migration: \${file}\`);
    const text = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    // Split on ';'. Correct as long as no statement keeps a semicolon
    // inside a string or comment — for those, split with a tokenizer
    // instead of a plain String.split.
    const statements = text.split(';').filter(s => s.trim());

    for (const stmt of statements) {
      await sql(stmt);
    }
    console.log(\`✓ \${file}\`);
  }
}
\`\`\`

### 3. Migration File Example

\`\`\`sql
-- 001_create_users.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
\`\`\`

---

## Schema Design Best Practices

### 1. Primary Keys: Use TEXT (UUID)

\`\`\`sql
-- ✅ Good - UUID as TEXT
id TEXT PRIMARY KEY

-- ❌ Avoid - AUTOINCREMENT integer
id INTEGER PRIMARY KEY AUTOINCREMENT
\`\`\`

**Why:** UUIDs work better in distributed systems, no sequence contention, globally unique.

### 2. Timestamps: Use TEXT with ISO8601

\`\`\`sql
created_at TEXT DEFAULT (datetime('now')),
updated_at TEXT DEFAULT (datetime('now'))
\`\`\`

**Why:** SQLite has no native datetime type. TEXT with ISO8601 (\`YYYY-MM-DD HH:MM:SS\`) sorts correctly lexicographically.

### 3. Booleans: Use INTEGER (0/1)

\`\`\`sql
is_active INTEGER DEFAULT 1,
is_deleted INTEGER DEFAULT 0
\`\`\`

**Why:** SQLite has no native BOOLEAN. INTEGER 0/1 is standard.

### 4. JSON: Store as TEXT

\`\`\`sql
metadata TEXT DEFAULT '{}'  -- JSON string
\`\`\`

**Why:** SQLite has JSON functions (\`json_extract\`, \`json_set\`), but storing as TEXT is simplest. Use \`json_extract(metadata, '$.key')\` to query.

### 5. Foreign Keys: Always Define Explicitly

\`\`\`sql
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
\`\`\`

**Why:** Enables CASCADE DELETE, prevents orphan rows, documents relationships.

### 6. Indexes: Create Strategically

\`\`\`sql
-- Query patterns drive indexes
CREATE INDEX idx_users_email ON users(email);           -- WHERE email = ?
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC); -- WHERE user_id = ? ORDER BY created_at
CREATE INDEX idx_posts_published ON posts(published, created_at DESC); -- WHERE published = 1 ORDER BY created_at
\`\`\`

**Rules:**
- Index columns used in \`WHERE\`, \`JOIN\`, \`ORDER BY\`
- Composite indexes: equality columns first, then range/order columns
- Don't over-index — each index slows writes

---

## SQL Writing Best Practices

### 1. Always Use Prepared Statements

\`\`\`javascript
// ✅ Correct - parameterized
await sql("SELECT * FROM users WHERE email = ?", [email]);

// ❌ NEVER - string interpolation (SQL injection: the value becomes syntax)
await sql(\`SELECT * FROM users WHERE email = '\${email}'\`);
\`\`\`

### 2. Use Explicit Column Lists

\`\`\`sql
-- ✅ Good
SELECT id, email, name FROM users WHERE id = ?

-- ❌ Avoid SELECT *
SELECT * FROM users WHERE id = ?
\`\`\`

### 3. Use CTEs for Complex Queries

\`\`\`sql
-- ✅ Readable, performant
WITH active_users AS (
  SELECT * FROM users WHERE is_active = 1
)
SELECT u.*, COUNT(p.id) as post_count
FROM active_users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id;
\`\`\`

### 4. Use \`UPSERT\` for Idempotent Writes

\`\`\`sql
-- SQLite UPSERT (ON CONFLICT)
INSERT INTO users (id, email, name)
VALUES (?, ?, ?)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  updated_at = datetime('now');
\`\`\`

### 5. Use \`RETURNING\` for Created Records

\`\`\`sql
INSERT INTO users (id, email, name)
VALUES (?, ?, ?)
RETURNING id, email, created_at;
\`\`\`

---

## Migration Checklist

Before running migrations in production:

- [ ] Test migrations on staging with production-like data
- [ ] Use \`IF NOT EXISTS\` / \`IF EXISTS\` for idempotency
- [ ] Run during low-traffic window
- [ ] Have rollback plan (backup before migrate)
- [ ] Run \`PRAGMA foreign_keys = ON\` (Moogo does this by default)
- [ ] Test rollback locally first

---

## Common Patterns

### Soft Delete

\`\`\`sql
-- Add deleted_at column
ALTER TABLE users ADD COLUMN deleted_at TEXT;

-- Query active only
SELECT * FROM users WHERE deleted_at IS NULL;

-- Soft delete
UPDATE users SET deleted_at = datetime('now') WHERE id = ?;
\`\`\`

### Optimistic Locking

\`\`\`sql
ALTER TABLE users ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE users SET name = ?, version = version + 1
WHERE id = ? AND version = ?;
-- Check rows affected == 1
\`\`\`

### Audit Trail

\`\`\`sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  old_data TEXT,         -- JSON
  new_data TEXT,         -- JSON
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
\`\`\`

---

## Dashboard Table Builder

For simple schemas, use the **Dashboard Table Builder** (\`/app/projects/{id}/database\` → Tables tab):

- Visual column definition
- Auto-generates \`CREATE TABLE\`
- Sets up indexes and foreign keys
- No hand-written DDL needed

> **Tip:** Use the builder for initial schema, then hand-write migrations for complex changes.

---

## Quick Reference

| Task | SQL |
|------|-----|
| Create table | \`CREATE TABLE IF NOT EXISTS ...\` |
| Add column | \`ALTER TABLE t ADD COLUMN c TEXT\` |
| Drop column | \`ALTER TABLE t DROP COLUMN c\` (SQLite 3.35+) |
| Rename column | \`ALTER TABLE t RENAME COLUMN a TO b\` (SQLite 3.25+) |
| Add index | \`CREATE INDEX IF NOT EXISTS idx ON t(c)\` |
| Drop index | \`DROP INDEX IF EXISTS idx\` |
| Add FK | Requires table recreate in SQLite |

---

## Related

- [SQL API](/docs/sql-api) - \`/exec\` endpoint details
- [Dashboard](/docs/dashboard) - Table builder
- [Security](/docs/security) - Prepared statements, sanitizer`;function wi(e,t){this.v=e,this.k=t}function Ti(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,r=Array(t);n<t;n++)r[n]=e[n];return r}function Ei(e){if(Array.isArray(e))return e}function Di(e,t){var n=e==null?null:typeof Symbol<`u`&&e[Symbol.iterator]||e[`@@iterator`];if(n!=null){var r,i,a,o,s=[],c=!0,l=!1;try{if(a=(n=n.call(e)).next,t===0){if(Object(n)!==n)return;c=!1}else for(;!(c=(r=a.call(n)).done)&&(s.push(r.value),s.length!==t);c=!0);}catch(e){l=!0,i=e}finally{try{if(!c&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(l)throw i}}return s}}function Oi(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function ki(e,t){return Ei(e)||Di(e,t)||Ai(e,t)||Oi()}function Ai(e,t){if(e){if(typeof e==`string`)return Ti(e,t);var n={}.toString.call(e).slice(8,-1);return n===`Object`&&e.constructor&&(n=e.constructor.name),n===`Map`||n===`Set`?Array.from(e):n===`Arguments`||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?Ti(e,t):void 0}}function ji(e){var t,n;function r(t,n){try{var a=e[t](n),o=a.value,s=o instanceof wi;Promise.resolve(s?o.v:o).then(function(n){if(s){var c=t===`return`&&o.k?t:`next`;if(!o.k||n.done)return r(c,n);n=e[c](n).value}i(!!a.done,n)},function(e){r(`throw`,e)})}catch(e){i(2,e)}}function i(e,i){e===2?t.reject(i):t.resolve({value:i,done:e}),(t=t.next)?r(t.key,t.arg):n=null}this._invoke=function(e,i){return new Promise(function(a,o){var s={key:e,arg:i,resolve:a,reject:o,next:null};n?n=n.next=s:(t=n=s,r(e,i))})},typeof e.return!=`function`&&(this.return=void 0)}ji.prototype[typeof Symbol==`function`&&Symbol.asyncIterator||`@@asyncIterator`]=function(){return this},ji.prototype.next=function(e){return this._invoke(`next`,e)},ji.prototype.throw=function(e){return this._invoke(`throw`,e)},ji.prototype.return=function(e){return this._invoke(`return`,e)};var Mi=Object.entries,Ni=Object.setPrototypeOf,Pi=Object.isFrozen,Fi=Object.getPrototypeOf,Ii=Object.getOwnPropertyDescriptor,Li=Object.freeze,Ri=Object.seal,zi=Object.create,Bi=typeof Reflect<`u`&&Reflect,Vi=Bi.apply,Hi=Bi.construct;Li||=function(e){return e},Ri||=function(e){return e},Vi||=function(e,t){var n=[...arguments].slice(2);return e.apply(t,n)},Hi||=function(e){return new e(...[...arguments].slice(1))};var Ui=ca(Array.prototype.forEach);Array.prototype.indexOf;var Wi=ca(Array.prototype.lastIndexOf),Gi=ca(Array.prototype.pop),Ki=ca(Array.prototype.push);Array.prototype.slice;var qi=ca(Array.prototype.splice),Ji=Array.isArray,Yi=ca(String.prototype.toLowerCase),Xi=ca(String.prototype.toString),Zi=ca(String.prototype.match),Qi=ca(String.prototype.replace),$i=ca(String.prototype.indexOf),ea=ca(String.prototype.trim),W=ca(Number.prototype.toString),ta=ca(Boolean.prototype.toString),na=typeof BigInt>`u`?null:ca(BigInt.prototype.toString),ra=typeof Symbol>`u`?null:ca(Symbol.prototype.toString),ia=ca(Object.prototype.hasOwnProperty),aa=ca(Object.prototype.toString),oa=ca(RegExp.prototype.test),sa=la(TypeError);function ca(e){return function(t){t instanceof RegExp&&(t.lastIndex=0);var n=[...arguments].slice(1);return Vi(e,t,n)}}function la(e){return function(){return Hi(e,[...arguments])}}function G(e,t){let n=arguments.length>2&&arguments[2]!==void 0?arguments[2]:Yi;if(Ni&&Ni(e,null),!Ji(t))return e;let r=t.length;for(;r--;){let i=t[r];if(typeof i==`string`){let e=n(i);e!==i&&(Pi(t)||(t[r]=e),i=e)}e[i]=!0}return e}function ua(e){for(let t=0;t<e.length;t++)ia(e,t)||(e[t]=null);return e}function da(e){let t=zi(null);for(let r of Mi(e)){var n=ki(r,2);let i=n[0],a=n[1];ia(e,i)&&(t[i]=Ji(a)?ua(a):a&&typeof a==`object`&&a.constructor===Object?da(a):a)}return t}function fa(e){switch(typeof e){case`string`:return e;case`number`:return W(e);case`boolean`:return ta(e);case`bigint`:return na?na(e):`0`;case`symbol`:return ra?ra(e):`Symbol()`;case`undefined`:return aa(e);case`function`:case`object`:{if(e===null)return aa(e);let t=e,n=pa(t,`toString`);if(typeof n==`function`){let e=n(t);return typeof e==`string`?e:aa(e)}return aa(e)}default:return aa(e)}}function pa(e,t){for(;e!==null;){let n=Ii(e,t);if(n){if(n.get)return ca(n.get);if(typeof n.value==`function`)return ca(n.value)}e=Fi(e)}function n(){return null}return n}function ma(e){try{return oa(e,``),!0}catch{return!1}}var ha=Li(`a.abbr.acronym.address.area.article.aside.audio.b.bdi.bdo.big.blink.blockquote.body.br.button.canvas.caption.center.cite.code.col.colgroup.content.data.datalist.dd.decorator.del.details.dfn.dialog.dir.div.dl.dt.element.em.fieldset.figcaption.figure.font.footer.form.h1.h2.h3.h4.h5.h6.head.header.hgroup.hr.html.i.img.input.ins.kbd.label.legend.li.main.map.mark.marquee.menu.menuitem.meter.nav.nobr.ol.optgroup.option.output.p.picture.pre.progress.q.rp.rt.ruby.s.samp.search.section.select.shadow.slot.small.source.spacer.span.strike.strong.style.sub.summary.sup.table.tbody.td.template.textarea.tfoot.th.thead.time.tr.track.tt.u.ul.var.video.wbr`.split(`.`)),ga=Li(`svg.a.altglyph.altglyphdef.altglyphitem.animatecolor.animatemotion.animatetransform.circle.clippath.defs.desc.ellipse.enterkeyhint.exportparts.filter.font.g.glyph.glyphref.hkern.image.inputmode.line.lineargradient.marker.mask.metadata.mpath.part.path.pattern.polygon.polyline.radialgradient.rect.stop.style.switch.symbol.text.textpath.title.tref.tspan.view.vkern`.split(`.`)),_a=Li([`feBlend`,`feColorMatrix`,`feComponentTransfer`,`feComposite`,`feConvolveMatrix`,`feDiffuseLighting`,`feDisplacementMap`,`feDistantLight`,`feDropShadow`,`feFlood`,`feFuncA`,`feFuncB`,`feFuncG`,`feFuncR`,`feGaussianBlur`,`feImage`,`feMerge`,`feMergeNode`,`feMorphology`,`feOffset`,`fePointLight`,`feSpecularLighting`,`feSpotLight`,`feTile`,`feTurbulence`]),va=Li([`animate`,`color-profile`,`cursor`,`discard`,`font-face`,`font-face-format`,`font-face-name`,`font-face-src`,`font-face-uri`,`foreignobject`,`hatch`,`hatchpath`,`mesh`,`meshgradient`,`meshpatch`,`meshrow`,`missing-glyph`,`script`,`set`,`solidcolor`,`unknown`,`use`]),ya=Li(`math.menclose.merror.mfenced.mfrac.mglyph.mi.mlabeledtr.mmultiscripts.mn.mo.mover.mpadded.mphantom.mroot.mrow.ms.mspace.msqrt.mstyle.msub.msup.msubsup.mtable.mtd.mtext.mtr.munder.munderover.mprescripts`.split(`.`)),ba=Li([`maction`,`maligngroup`,`malignmark`,`mlongdiv`,`mscarries`,`mscarry`,`msgroup`,`mstack`,`msline`,`msrow`,`semantics`,`annotation`,`annotation-xml`,`mprescripts`,`none`]),xa=Li([`#text`]),Sa=Li(`accept.action.align.alt.autocapitalize.autocomplete.autopictureinpicture.autoplay.background.bgcolor.border.capture.cellpadding.cellspacing.checked.cite.class.clear.color.cols.colspan.command.commandfor.controls.controlslist.coords.crossorigin.datetime.decoding.default.dir.disabled.disablepictureinpicture.disableremoteplayback.download.draggable.enctype.enterkeyhint.exportparts.face.for.headers.height.hidden.high.href.hreflang.id.inert.inputmode.integrity.ismap.kind.label.lang.list.loading.loop.low.max.maxlength.media.method.min.minlength.multiple.muted.name.nonce.noshade.novalidate.nowrap.open.optimum.part.pattern.placeholder.playsinline.popover.popovertarget.popovertargetaction.poster.preload.pubdate.radiogroup.readonly.rel.required.rev.reversed.role.rows.rowspan.spellcheck.scope.selected.shape.size.sizes.slot.span.srclang.start.src.srcset.step.style.summary.tabindex.title.translate.type.usemap.valign.value.width.wrap.xmlns`.split(`.`)),Ca=Li(`accent-height.accumulate.additive.alignment-baseline.amplitude.ascent.attributename.attributetype.azimuth.basefrequency.baseline-shift.begin.bias.by.class.clip.clippathunits.clip-path.clip-rule.color.color-interpolation.color-interpolation-filters.color-profile.color-rendering.cx.cy.d.dx.dy.diffuseconstant.direction.display.divisor.dominant-baseline.dur.edgemode.elevation.end.exponent.fill.fill-opacity.fill-rule.filter.filterunits.flood-color.flood-opacity.font-family.font-size.font-size-adjust.font-stretch.font-style.font-variant.font-weight.fx.fy.g1.g2.glyph-name.glyphref.gradientunits.gradienttransform.height.href.id.image-rendering.in.in2.intercept.k.k1.k2.k3.k4.kerning.keypoints.keysplines.keytimes.lang.lengthadjust.letter-spacing.kernelmatrix.kernelunitlength.lighting-color.local.marker-end.marker-mid.marker-start.markerheight.markerunits.markerwidth.maskcontentunits.maskunits.max.mask.mask-type.media.method.mode.min.name.numoctaves.offset.operator.opacity.order.orient.orientation.origin.overflow.paint-order.path.pathlength.patterncontentunits.patterntransform.patternunits.pointer-events.points.preservealpha.preserveaspectratio.primitiveunits.r.rx.ry.radius.refx.refy.repeatcount.repeatdur.restart.result.rotate.scale.seed.shape-rendering.slope.specularconstant.specularexponent.spreadmethod.startoffset.stddeviation.stitchtiles.stop-color.stop-opacity.stroke-dasharray.stroke-dashoffset.stroke-linecap.stroke-linejoin.stroke-miterlimit.stroke-opacity.stroke.stroke-width.style.surfacescale.systemlanguage.tabindex.tablevalues.targetx.targety.transform.transform-origin.text-anchor.text-decoration.text-orientation.text-rendering.textlength.type.u1.u2.unicode.values.vector-effect.viewbox.visibility.version.vert-adv-y.vert-origin-x.vert-origin-y.width.word-spacing.wrap.writing-mode.xchannelselector.ychannelselector.x.x1.x2.xmlns.y.y1.y2.z.zoomandpan`.split(`.`)),wa=Li(`accent.accentunder.align.bevelled.close.columnalign.columnlines.columnspacing.columnspan.denomalign.depth.dir.display.displaystyle.encoding.fence.frame.height.href.id.largeop.length.linethickness.lquote.lspace.mathbackground.mathcolor.mathsize.mathvariant.maxsize.minsize.movablelimits.notation.numalign.open.rowalign.rowlines.rowspacing.rowspan.rspace.rquote.scriptlevel.scriptminsize.scriptsizemultiplier.selection.separator.separators.stretchy.subscriptshift.supscriptshift.symmetric.voffset.width.xmlns`.split(`.`)),Ta=Li([`xlink:href`,`xml:id`,`xlink:title`,`xml:space`,`xmlns:xlink`]),Ea=Ri(/{{[\w\W]*|^[\w\W]*}}/g),Da=Ri(/<%[\w\W]*|^[\w\W]*%>/g),Oa=Ri(/\${[\w\W]*/g),ka=Ri(/^data-[\-\w.\u00B7-\uFFFF]+$/),Aa=Ri(/^aria-[\-\w]+$/),ja=Ri(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),Ma=Ri(/^(?:\w+script|data):/i),Na=Ri(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),Pa=Ri(/^html$/i),Fa=Ri(/^[a-z][.\w]*(-[.\w]+)+$/i),Ia=Ri(/<[/\w!]/g),La=Ri(/<[/\w]/g),Ra=Ri(/<\/no(script|embed|frames)/i),za=Ri(/\/>/i),Ba={element:1,attribute:2,text:3,cdataSection:4,entityReference:5,entityNode:6,processingInstruction:7,comment:8,document:9,documentType:10,documentFragment:11,notation:12},Va=[`style`,`script`,`xmp`,`iframe`,`noembed`,`noframes`,`plaintext`,`noscript`],Ha=Li(G({},Va)),Ua=function(){let e={};return Ui(Va,t=>{e[t]=Ri(RegExp(`</`+t+`(?=[\\t\\n\\f\\r />])`,`i`))}),Li(e)}(),Wa=function(){return typeof window>`u`?null:window},Ga=function(e,t){if(typeof e!=`object`||typeof e.createPolicy!=`function`)return null;let n=null,r=`data-tt-policy-suffix`;t&&t.hasAttribute(r)&&(n=t.getAttribute(r));let i=`dompurify`+(n?`#`+n:``);try{return e.createPolicy(i,{createHTML(e){return e},createScriptURL(e){return e}})}catch{return console.warn(`TrustedTypes policy `+i+` could not be created.`),null}},Ka=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},qa=function(e,t,n,r){return ia(e,t)&&Ji(e[t])?G(r.base?da(r.base):{},e[t],r.transform):n},Ja=function(e,t,n){let r=ia(e,t)?e[t]:void 0;return r&&typeof r==`object`?da(r):n()};function Ya(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:Wa(),t=e=>Ya(e);if(t.version=`3.4.16`,t.removed=[],!e||!e.document||e.document.nodeType!==Ba.document||!e.Element)return t.isSupported=!1,t;let n=e.document,r=n,i=r.currentScript;e.DocumentFragment;let a=e.HTMLTemplateElement,o=e.Node,s=e.Element,c=e.NodeFilter;e.NamedNodeMap===void 0&&(e.NamedNodeMap||e.MozNamedAttrMap),e.HTMLFormElement;let l=e.DOMParser,u=e.trustedTypes,d=s.prototype,f=pa(d,`cloneNode`),p=pa(d,`remove`),m=pa(d,`removeAttributeNode`),h=pa(d,`nextSibling`),g=pa(d,`childNodes`),_=pa(d,`parentNode`),v=pa(d,`shadowRoot`),y=pa(d,`attributes`),b=o&&o.prototype?pa(o.prototype,`nodeType`):null,x=o&&o.prototype?pa(o.prototype,`nodeName`):null,S=o&&o.prototype?pa(o.prototype,`ownerDocument`):null,C=function(e){return b?b(e):e.nodeType},w=function(e){return x?x(e):e.nodeName};if(typeof a==`function`){let e=n.createElement(`template`);e.content&&e.content.ownerDocument&&(n=e.content.ownerDocument)}let T,E=``,D,ee=!1,O=0,te=function(){if(O>0)throw sa(`A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.`)},k=function(e){te(),O++;try{return T.createHTML(e)}finally{O--}},A=function(e){te(),O++;try{return T.createScriptURL(e)}finally{O--}},ne=function(){return ee||=(D=Ga(u,i),!0),D},re=n,ie=re.implementation,ae=re.createNodeIterator,oe=re.createDocumentFragment,j=re.getElementsByTagName,M=r.importNode,N=Ka();t.isSupported=typeof Mi==`function`&&typeof _==`function`&&ie&&ie.createHTMLDocument!==void 0;let se=Ea,ce=Da,le=Oa,ue=ka,de=Aa,fe=Ma,pe=Na,me=Fa,P=ja,F=null,he=G({},[...ha,...ga,..._a,...ya,...xa]),ge=null,_e=G({},[...Sa,...Ca,...wa,...Ta]),ve=Object.seal(zi(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),ye=null,I=null,be=Object.seal(zi(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}})),xe=!0,Se=!0,Ce=!1,we=!0,Te=!1,Ee=!0,De=!1,Oe=!1,ke=null,Ae=null,je=!1,Me=!1,Ne=!1,Pe=!1,Fe=!0,Ie=!1,Le=`user-content-`,Re=!0,ze=!1,Be={},Ve=null,He=G({},`annotation-xml.audio.colgroup.desc.foreignobject.head.iframe.math.mi.mn.mo.ms.mtext.noembed.noframes.noscript.plaintext.script.selectedcontent.style.svg.template.thead.title.video.xmp`.split(`.`)),Ue=null,We=G({},[`audio`,`video`,`img`,`source`,`image`,`track`]),Ge=null,Ke=G({},[`alt`,`class`,`for`,`id`,`label`,`name`,`pattern`,`placeholder`,`role`,`summary`,`title`,`value`,`style`,`xmlns`]),qe=`http://www.w3.org/1998/Math/MathML`,Je=`http://www.w3.org/2000/svg`,Ye=`http://www.w3.org/1999/xhtml`,L=Ye,Xe=!1,Ze=null,Qe=G({},[qe,Je,Ye],Xi),$e=Li([`mi`,`mo`,`mn`,`ms`,`mtext`]),et=G({},$e),tt=Li([`annotation-xml`]),nt=G({},tt),rt=G({},[`title`,`style`,`font`,`a`,`script`]),it=null,at=[`application/xhtml+xml`,`text/html`],ot=null,st=null,ct=n.createElement(`form`),lt=function(e){return e instanceof RegExp||e instanceof Function},ut=function(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(st&&st===e)return;(!e||typeof e!=`object`)&&(e={}),e=da(e),it=at.indexOf(e.PARSER_MEDIA_TYPE)===-1?`text/html`:e.PARSER_MEDIA_TYPE,ot=it===`application/xhtml+xml`?Xi:Yi,F=qa(e,`ALLOWED_TAGS`,he,{transform:ot}),ge=qa(e,`ALLOWED_ATTR`,_e,{transform:ot}),Ze=qa(e,`ALLOWED_NAMESPACES`,Qe,{transform:Xi}),Ge=qa(e,`ADD_URI_SAFE_ATTR`,Ke,{transform:ot,base:Ke}),Ue=qa(e,`ADD_DATA_URI_TAGS`,We,{transform:ot,base:We}),Ve=qa(e,`FORBID_CONTENTS`,He,{transform:ot}),ye=qa(e,`FORBID_TAGS`,da({}),{transform:ot}),I=qa(e,`FORBID_ATTR`,da({}),{transform:ot}),Be=ia(e,`USE_PROFILES`)?e.USE_PROFILES&&typeof e.USE_PROFILES==`object`?da(e.USE_PROFILES):e.USE_PROFILES:!1,xe=e.ALLOW_ARIA_ATTR!==!1,Se=e.ALLOW_DATA_ATTR!==!1,Ce=e.ALLOW_UNKNOWN_PROTOCOLS||!1,we=e.ALLOW_SELF_CLOSE_IN_ATTR!==!1,Te=e.SAFE_FOR_TEMPLATES||!1,Ee=e.SAFE_FOR_XML!==!1,De=e.WHOLE_DOCUMENT||!1,Me=e.RETURN_DOM||!1,Ne=e.RETURN_DOM_FRAGMENT||!1,Pe=e.RETURN_TRUSTED_TYPE||!1,je=e.FORCE_BODY||!1,Fe=e.SANITIZE_DOM!==!1,Ie=e.SANITIZE_NAMED_PROPS||!1,Re=e.KEEP_CONTENT!==!1,ze=e.IN_PLACE||!1,P=ma(e.ALLOWED_URI_REGEXP)?e.ALLOWED_URI_REGEXP:ja,L=typeof e.NAMESPACE==`string`?e.NAMESPACE:Ye,et=Ja(e,`MATHML_TEXT_INTEGRATION_POINTS`,()=>G({},$e)),nt=Ja(e,`HTML_INTEGRATION_POINTS`,()=>G({},tt));let t=Ja(e,`CUSTOM_ELEMENT_HANDLING`,()=>zi(null));if(ve=zi(null),ia(t,`tagNameCheck`)&&lt(t.tagNameCheck)&&(ve.tagNameCheck=t.tagNameCheck),ia(t,`attributeNameCheck`)&&lt(t.attributeNameCheck)&&(ve.attributeNameCheck=t.attributeNameCheck),ia(t,`allowCustomizedBuiltInElements`)&&typeof t.allowCustomizedBuiltInElements==`boolean`&&(ve.allowCustomizedBuiltInElements=t.allowCustomizedBuiltInElements),Ri(ve),Te&&(Se=!1),Ne&&(Me=!0),Be&&(F=G({},xa),ge=zi(null),Be.html===!0&&(G(F,ha),G(ge,Sa)),Be.svg===!0&&(G(F,ga),G(ge,Ca),G(ge,Ta)),Be.svgFilters===!0&&(G(F,_a),G(ge,Ca),G(ge,Ta)),Be.mathMl===!0&&(G(F,ya),G(ge,wa),G(ge,Ta))),be.tagCheck=null,be.attributeCheck=null,ia(e,`ADD_TAGS`)&&(typeof e.ADD_TAGS==`function`?be.tagCheck=e.ADD_TAGS:Ji(e.ADD_TAGS)&&(F===he&&(F=da(F)),G(F,e.ADD_TAGS,ot))),ia(e,`ADD_ATTR`)&&(typeof e.ADD_ATTR==`function`?be.attributeCheck=e.ADD_ATTR:Ji(e.ADD_ATTR)&&(ge===_e&&(ge=da(ge)),G(ge,e.ADD_ATTR,ot))),ia(e,`ADD_FORBID_CONTENTS`)&&Ji(e.ADD_FORBID_CONTENTS)&&(Ve===He&&(Ve=da(Ve)),G(Ve,e.ADD_FORBID_CONTENTS,ot)),Re&&(F[`#text`]=!0),De&&G(F,[`html`,`head`,`body`]),F.table&&(G(F,[`tbody`]),delete ye.tbody),e.TRUSTED_TYPES_POLICY){if(typeof e.TRUSTED_TYPES_POLICY.createHTML!=`function`)throw sa(`TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.`);if(typeof e.TRUSTED_TYPES_POLICY.createScriptURL!=`function`)throw sa(`TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.`);let t=T;T=e.TRUSTED_TYPES_POLICY;try{E=k(``)}catch(e){throw T=t,e}}else e.TRUSTED_TYPES_POLICY===null?(T=void 0,E=``):(T===void 0&&(T=ne()),T&&typeof E==`string`&&(E=k(``)));Li&&Li(e),st=e},dt=G({},[...ga,..._a,...va]),ft=G({},[...ya,...ba]),pt=function(e,t,n){return t.namespaceURI===Ye?e===`svg`:t.namespaceURI===qe?e===`svg`&&(n===`annotation-xml`||et[n]):!!dt[e]},mt=function(e,t,n){return t.namespaceURI===Ye?e===`math`:t.namespaceURI===Je?e===`math`&&nt[n]:!!ft[e]},ht=function(e,t,n){return t.namespaceURI===Je&&!nt[n]||t.namespaceURI===qe&&!et[n]?!1:!ft[e]&&(rt[e]||!dt[e])},gt=function(e){let t=_(e);(!t||!t.tagName)&&(t={namespaceURI:L,tagName:`template`});let n=Yi(e.tagName),r=Yi(t.tagName);return Ze[e.namespaceURI]?e.namespaceURI===Je?pt(n,t,r):e.namespaceURI===qe?mt(n,t,r):e.namespaceURI===Ye?ht(n,t,r):!!(it===`application/xhtml+xml`&&Ze[e.namespaceURI]):!1},_t=function(e){Ki(t.removed,{element:e});try{_(e).removeChild(e)}catch{if(p(e),!_(e))throw sa(`a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place`)}},vt=function(e,t,n){try{m(e,t)}catch{try{e.removeAttribute(n)}catch{}}},yt=function(e){St(e);let t=g(e);if(t){let e=[];Ui(t,t=>{Ki(e,t)}),Ui(e,e=>{try{p(e)}catch{}})}let n=y(e);if(n)for(let t=n.length-1;t>=0;--t){let r=n[t],i=r&&r.name;typeof i==`string`&&vt(e,r,i)}},bt=function(e,n,r){if(!r)try{r=n.getAttributeNode(e)}catch{r=null}Ki(t.removed,{attribute:r||null,from:n});try{r?m(n,r):n.removeAttribute(e)}catch{try{n.removeAttribute(e)}catch{}}if(e===`is`){if(Me||Ne)try{_t(n)}catch{}else try{n.setAttribute(e,``)}catch{}}},xt=function(e){let t=y(e);if(t)for(let n=t.length-1;n>=0;--n){let r=t[n],i=r&&r.name;typeof i!=`string`||ge[ot(i)]||vt(e,r,i)}},St=function(e){let t=[e];for(;t.length>0;){let e=t.pop();C(e)===Ba.element&&xt(e);let n=g(e);if(n)for(let e=n.length-1;e>=0;--e)t.push(n[e])}},Ct=function(e,t){return Ee?e===`patchsrc`||e===`for`&&t!==`label`&&t!==`output`:!1},wt=function(e){if(!Ee)return;let t=[e];for(;t.length>0;){let e=t.pop(),n=C(e);if(n===Ba.processingInstruction||n===Ba.comment&&oa(La,e.data)){try{p(e)}catch{}continue}if(n===Ba.element){let t=e,n=ot(w(e));try{t.hasAttribute&&t.hasAttribute(`patchsrc`)&&t.removeAttribute(`patchsrc`),t.hasAttribute&&t.hasAttribute(`for`)&&Ct(`for`,n)&&t.removeAttribute(`for`)}catch{}}let r=g(e);if(r)for(let e=r.length-1;e>=0;--e)t.push(r[e])}},Tt=function(e){let t=null,r=null;if(je)e=`<remove></remove>`+e;else{let t=Zi(e,/^[\r\n\t ]+/);r=t&&t[0]}it===`application/xhtml+xml`&&L===Ye&&(e=`<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>`+e+`</body></html>`);let i=T?k(e):e;if(L===Ye)try{t=new l().parseFromString(i,it)}catch{}if(!t||!t.documentElement){t=ie.createDocument(L,`template`,null);try{t.documentElement.innerHTML=Xe?E:i}catch{}}let a=t.body||t.documentElement;return e&&r&&a.insertBefore(n.createTextNode(r),a.childNodes[0]||null),L===Ye?j.call(t,De?`html`:`body`)[0]:De?t.documentElement:a},Et=function(e){let t=S?S(e):e.ownerDocument;return ae.call(t||e,e,c.SHOW_ELEMENT|c.SHOW_COMMENT|c.SHOW_TEXT|c.SHOW_PROCESSING_INSTRUCTION|c.SHOW_CDATA_SECTION,null)},Dt=function(e){return e=Qi(e,se,` `),e=Qi(e,ce,` `),e=Qi(e,le,` `),e},Ot=function(e){e.normalize();let t=S?S(e):e.ownerDocument,n=ae.call(t||e,e,c.SHOW_TEXT|c.SHOW_COMMENT|c.SHOW_CDATA_SECTION|c.SHOW_PROCESSING_INSTRUCTION,null),r=n.nextNode();for(;r;)r.data=Dt(r.data),r=n.nextNode();let i=e.querySelectorAll?.call(e,`template`);i&&Ui(i,e=>{At(e.content)&&Ot(e.content)})},kt=function(e){let t=x?x(e):null;return typeof t!=`string`||ot(t)!==`form`?!1:typeof e.nodeName!=`string`||typeof e.textContent!=`string`||typeof e.removeChild!=`function`||e.attributes!==y(e)||typeof e.removeAttribute!=`function`||typeof e.removeAttributeNode!=`function`||typeof e.getAttributeNode!=`function`||typeof e.setAttribute!=`function`||typeof e.namespaceURI!=`string`||typeof e.insertBefore!=`function`||typeof e.hasChildNodes!=`function`||e.nodeType!==b(e)||e.childNodes!==g(e)},At=function(e){if(!b||typeof e!=`object`||!e)return!1;try{return b(e)===Ba.documentFragment}catch{return!1}},jt=function(e){if(!b||typeof e!=`object`||!e)return!1;try{return typeof b(e)==`number`}catch{return!1}};function Mt(e,n,r){e.length!==0&&Ui(e,e=>{e.call(t,n,r,st)})}let Nt=function(e,t){return!!(Ee&&e.hasChildNodes()&&!jt(e.firstElementChild)&&oa(Ia,e.textContent)&&oa(Ia,e.innerHTML)||Ee&&e.namespaceURI===Ye&&Ha[t]&&(jt(e.firstElementChild)||typeof e.textContent==`string`&&oa(Ua[t],e.textContent))||e.nodeType===Ba.processingInstruction||Ee&&e.nodeType===Ba.comment&&oa(La,e.data))},Pt=function(e,t){return e instanceof RegExp?oa(e,t):e instanceof Function&&!!e(t,...[...arguments].slice(2))},R=function(e,t,n){if(!ye[t]&&Bt(t)&&Pt(ve.tagNameCheck,t))return!1;if(Re&&!Ve[t]){let t=_(e),r=g(e);if(r&&t){let i=r.length;for(let a=i-1;a>=0;--a){let i=e===n?f(r[a],!0):r[a];t.insertBefore(i,h(e))}}}return _t(e),!0},Ft=function(e,t,n,r){return e.length===0?t:t===n||t===r?da(t):t},It=function(e,t){return e===t||_(e)!==null?!1:(ze&&St(e),!0)},Lt=function(e,n){if(Mt(N.beforeSanitizeElements,e,null),It(e,n))return!0;if(kt(e))return _t(e),!0;let r=ot(w(e));if(F=Ft(N.uponSanitizeElement,F,he,ke),Mt(N.uponSanitizeElement,e,{tagName:r,allowedTags:F}),It(e,n))return!0;if(Nt(e,r))return _t(e),!0;if(ye[r]||!(be.tagCheck instanceof Function&&be.tagCheck(r))&&!F[r]){let t=R(e,r,n);return t===!1&&(Mt(N.afterSanitizeElements,e,null),It(e,n))?!0:t}if(C(e)===Ba.element&&!gt(e)||(r===`noscript`||r===`noembed`||r===`noframes`)&&oa(Ra,e.innerHTML))return _t(e),!0;if(Te&&e.nodeType===Ba.text){let n=Dt(e.textContent);e.textContent!==n&&(Ki(t.removed,{element:e.cloneNode()}),e.textContent=n)}return Mt(N.afterSanitizeElements,e,null),It(e,n)},Rt=function(e,t,r){if(I[t]||Ct(t,e)||Fe&&(t===`id`||t===`name`)&&(r in n||r in ct))return!1;let i=ge[t]||be.attributeCheck instanceof Function&&be.attributeCheck(t,e);return Se&&oa(ue,t)||xe&&oa(de,t)?!0:i?Ge[t]||oa(P,Qi(r,pe,``))||(t===`src`||t===`xlink:href`||t===`href`)&&e!==`script`&&$i(r,`data:`)===0&&Ue[e]||Ce&&!oa(fe,Qi(r,pe,``))?!0:!r:Bt(e)&&Pt(ve.tagNameCheck,e)&&Pt(ve.attributeNameCheck,t,e)||t===`is`&&ve.allowCustomizedBuiltInElements&&Pt(ve.tagNameCheck,r)},zt=G({},[`annotation-xml`,`color-profile`,`font-face`,`font-face-format`,`font-face-name`,`font-face-src`,`font-face-uri`,`missing-glyph`]),Bt=function(e){return!zt[Yi(e)]&&oa(me,e)},Vt=function(e,t,n,r){if(T&&typeof u==`object`&&typeof u.getAttributeType==`function`&&!n)switch(u.getAttributeType(e,t)){case`TrustedHTML`:return k(r);case`TrustedScriptURL`:return A(r)}return r},Ht=function(e,t,n,r){try{return n?e.setAttributeNS(n,t,r):e.setAttribute(t,r),!kt(e)||(_t(e),!1)}catch{return bt(t,e),!1}},Ut=function(e,n){if(Mt(N.beforeSanitizeAttributes,e,null),It(e,n))return;let r=e.attributes;if(!r||kt(e))return;ge=Ft(N.uponSanitizeAttribute,ge,_e,Ae);let i={attrName:``,attrValue:``,keepAttr:!0,allowedAttributes:ge,forceKeepAttr:void 0},a=r.length,o=ot(e.nodeName);for(;a--;){let n=r[a],s=n.name,c=n.namespaceURI,l=n.value,u=ot(s),d=l,f=s===`value`?d:ea(d),p=!1;if(i.attrName=u,i.attrValue=f,i.keepAttr=!0,i.forceKeepAttr=void 0,Mt(N.uponSanitizeAttribute,e,i),f=i.attrValue,Ie&&(u===`id`||u===`name`)&&$i(f,Le)!==0&&(bt(s,e,n),f=Le+f,p=!0),Ee&&oa(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,f)){bt(s,e,n);continue}if(u===`attributename`&&Zi(f,`href`)){bt(s,e,n);continue}if(!i.forceKeepAttr){if(!i.keepAttr){bt(s,e,n);continue}if(!we&&oa(za,f)){bt(s,e,n);continue}if(Te&&(f=Dt(f)),!Rt(o,u,f)){bt(s,e,n);continue}f=Vt(o,u,c,f),f!==d&&Ht(e,s,c,f)&&p&&Gi(t.removed)}}Mt(N.afterSanitizeAttributes,e,null),It(e,n)},z=function(e){let t=null,n=Et(e);for(Mt(N.beforeSanitizeShadowDOM,e,null);t=n.nextNode();)if(Mt(N.uponSanitizeShadowNode,t,null),Lt(t,e),Ut(t,e),At(t.content)&&z(t.content),C(t)===Ba.element){let e=v(t);At(e)&&(Wt(e),z(e))}Mt(N.afterSanitizeShadowDOM,e,null)},Wt=function(e){let t=[{node:e,shadow:null}];for(;t.length>0;){let e=t.pop();if(e.shadow){z(e.shadow);continue}let n=e.node,r=C(n)===Ba.element,i=g(n);if(i)for(let e=i.length-1;e>=0;--e)t.push({node:i[e],shadow:null});if(r){let e=x?x(n):null;if(typeof e==`string`&&ot(e)===`template`){let e=n.content;At(e)&&t.push({node:e,shadow:null})}}if(r){let e=v(n);At(e)&&t.push({node:null,shadow:e},{node:e,shadow:null})}}};return t.sanitize=function(e){let n=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},i=null,a=null,o=null,s=null;if(Xe=!e,Xe&&(e=`<!-->`),typeof e!=`string`&&!jt(e)&&(e=fa(e),typeof e!=`string`))throw sa(`dirty is not a string, aborting`);if(!t.isSupported)return e;Oe?(F=ke,ge=Ae):ut(n),(N.uponSanitizeElement.length>0||N.uponSanitizeAttribute.length>0)&&(F=da(F)),N.uponSanitizeAttribute.length>0&&(ge=da(ge)),t.removed=[];let c=ze&&typeof e!=`string`&&jt(e);if(c){wt(e);let t=w(e);if(typeof t==`string`){let n=ot(t);if(!F[n]||ye[n])throw yt(e),sa(`root node is forbidden and cannot be sanitized in-place`)}if(kt(e))throw yt(e),sa(`root node is clobbered and cannot be sanitized in-place`);try{Wt(e)}catch(t){throw yt(e),t}}else if(jt(e))i=Tt(`<!---->`),a=i.ownerDocument.importNode(e,!0),a.nodeType===Ba.element&&a.nodeName===`BODY`||a.nodeName===`HTML`?i=a:i.appendChild(a),Wt(i);else{if(!Me&&!Te&&!De&&e.indexOf(`<`)===-1)return T&&Pe?k(e):e;if(i=Tt(e),!i)return Me?null:Pe?E:``}i&&je&&_t(i.firstChild);let l=c?e:i;try{let e=Et(l);for(;o=e.nextNode();)Lt(o,l),Ut(o,l),At(o.content)&&z(o.content)}catch(n){throw c&&(yt(e),Ui(t.removed,e=>{e.element&&St(e.element)})),n}if(c){let n=!1;if(Ui(t.removed,t=>{t.element&&(t.element===e&&(n=!0),St(t.element))}),n)throw sa(`a node selected for removal could not be safely returned; refusing to sanitize in place`);return Te&&Ot(e),e}if(Me){if(Te&&Ot(i),Ne)for(s=oe.call(i.ownerDocument);i.firstChild;)s.appendChild(i.firstChild);else s=i;return(ge.shadowroot||ge.shadowrootmode)&&(s=M.call(r,s,!0)),s}let u=De?i.outerHTML:i.innerHTML;return De&&F[`!doctype`]&&i.ownerDocument&&i.ownerDocument.doctype&&i.ownerDocument.doctype.name&&oa(Pa,i.ownerDocument.doctype.name)&&(u=`<!DOCTYPE `+i.ownerDocument.doctype.name+`>
`+u),Te&&(u=Dt(u)),T&&Pe?k(u):u},t.setConfig=function(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};ut(e),Oe=!0,ke=F,Ae=ge},t.clearConfig=function(){st=null,Oe=!1,ke=null,Ae=null,T=D,E=``},t.isValidAttribute=function(e,t,n){st||ut({});let r=ot(e),i=ot(t);return Rt(r,i,n)},t.addHook=function(e,t){typeof t==`function`&&ia(N,e)&&Ki(N[e],t)},t.removeHook=function(e,t){if(ia(N,e)){if(t!==void 0){let n=Wi(N[e],t);return n===-1?void 0:qi(N[e],n,1)[0]}return Gi(N[e])}},t.removeHooks=function(e){ia(N,e)&&(N[e]=[])},t.removeAllHooks=function(){N=Ka()},t}var Xa=Ya();function Za(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Qa=Za();function $a(e){Qa=e}var eo={exec:()=>null};function to(e){let t=[];return n=>{let r=Math.max(0,Math.min(3,n-1)),i=t[r];return i||(i=e(r),t[r]=i),i}}function K(e,t=``){let n=typeof e==`string`?e:e.source,r={replace:(e,t)=>{let i=typeof t==`string`?t:t.source;return i=i.replace(ro.caret,`$1`),n=n.replace(e,i),r},getRegex:()=>new RegExp(n,t)};return r}var no=((e=``)=>{try{return!!RegExp(`(?<=1)(?<!1)`+e)}catch{return!1}})(),ro={codeRemoveIndent:/^(?: {0,3}\t| {1,4})/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,endingSpaceTabChar:/[ \t]$/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,leadingSpaceTab:/^[ \t]+/,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,numericCharacterReference:/&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/g,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:to(e=>RegExp(`^ {0,${e}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),hrRegex:to(e=>RegExp(`^ {0,${e}}((?:-[ 	]*){3,}|(?:_[ 	]*){3,}|(?:\\*[ 	]*){3,})(?:\\n+|$)`)),fencesBeginRegex:to(e=>RegExp(`^ {0,${e}}(?:\`\`\`|~~~)`)),headingBeginRegex:to(e=>RegExp(`^ {0,${e}}#`)),htmlBeginRegex:to(e=>RegExp(`^ {0,${e}}(?:</?(?:${yo})(?: +|$|/?>)|<(?:script|pre|style|textarea|!--))`,`i`)),blockquoteBeginRegex:to(e=>RegExp(`^ {0,${e}}>`))},io=/^(?:[ \t]*(?:\n|$))+/,ao=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,oo=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,so=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,co=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,lo=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,uo=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,fo=K(uo).replace(/bull/g,lo).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}(?:\s|$)/).replace(/hr/g,/ {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,``).getRegex(),po=K(uo).replace(/bull/g,lo).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}(?:\s|$)/).replace(/hr/g,/ {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),mo=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/,ho=/^[^\n]+/,go=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,_o=K(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace(`label`,go).replace(`title`,/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),vo=K(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g,lo).getRegex(),yo=`address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul`,bo=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,xo=K(`^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))`,`i`).replace(`comment`,bo).replace(`tag`,yo).replace(`attribute`,/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),So=e=>K(mo).replace(`hr`,so).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`|lheading`,``).replace(`|table`,``).replace(`blockquote`,` {0,3}>`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace(`list`,e).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,yo).getRegex(),Co=So(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/),wo=So(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/),To={blockquote:K(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace(`paragraph`,wo).getRegex(),code:ao,def:_o,fences:oo,heading:co,hr:so,html:xo,lheading:fo,list:vo,newline:io,paragraph:Co,table:eo,text:ho},Eo=K(`^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)`).replace(`hr`,so).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`blockquote`,` {0,3}>`).replace(`code`,`(?: {4}| {0,3}	)[^\\n]`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace(`list`,` {0,3}(?:[*+-]|1[.)])[ \\t]`).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,yo).getRegex(),Do={...To,lheading:po,table:Eo,paragraph:K(mo).replace(`hr`,so).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`|lheading`,``).replace(`table`,Eo).replace(`blockquote`,` {0,3}>`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace(`list`,` {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]`).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,yo).getRegex()},Oo={...To,html:K(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace(`comment`,bo).replace(/tag/g,`(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b`).getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:eo,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:K(mo).replace(`hr`,so).replace(`heading`,` *#{1,6} *[^
]`).replace(`lheading`,fo).replace(`|table`,``).replace(`blockquote`,` {0,3}>`).replace(`|fences`,``).replace(`|list`,``).replace(`|html`,``).replace(`|tag`,``).getRegex()},ko=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,Ao=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,jo=/^( {2,}|\\)\n(?!\s*$)[ \t]*/,Mo=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,No=/[\p{P}\p{S}]/u,Po=/[\s\p{P}\p{S}]/u,Fo=/[^\s\p{P}\p{S}]/u,Io=K(/^((?![*_])punctSpace)/,`u`).replace(/punctSpace/g,Po).getRegex(),q=/[\p{Pi}\p{Ps}"']/u,Lo=/(?!~)[\p{P}\p{S}]/u,Ro=/(?!~)[\s\p{P}\p{S}]/u,zo=/(?:[^\s\p{P}\p{S}]|~)/u,Bo=K(/link|precode-code|html/,`g`).replace(`link`,/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace(`precode-`,no?"(?<!`)()":"(^^|[^`])").replace(`code`,/(?<b>`+)[^`]+\k<b>(?!`)/).replace(`html`,/<(?! )[^<>]*?>/).getRegex(),Vo=/^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,Ho=K(Vo,`u`).replace(/punct/g,No).getRegex(),Uo=K(Vo,`u`).replace(/punct/g,Lo).getRegex(),Wo=K(/^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/,`u`).replace(/openQuote/g,q).replace(/punct/g,No).getRegex(),Go=`^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)`,Ko=K(Go,`gu`).replace(/notPunctSpace/g,Fo).replace(/punctSpace/g,Po).replace(/punct/g,No).getRegex(),qo=K(Go,`gu`).replace(/notPunctSpace/g,zo).replace(/punctSpace/g,Ro).replace(/punct/g,Lo).getRegex(),Jo=K(`^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)`,`gu`).replace(/notPunctSpace/g,Fo).replace(/punctSpace/g,Po).replace(/punct/g,No).getRegex(),Yo=K(`^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)`,`gu`).replace(/notPunctSpace/g,Fo).replace(/punctSpace/g,Po).replace(/punct/g,No).getRegex(),Xo=K(`^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)`,`gu`).replace(/notPunctSpace/g,Fo).replace(/punctSpace/g,Po).replace(/punct/g,No).getRegex(),Zo=K(/^~~?(?:((?!~)punct)|[^\s~])/,`u`).replace(/punct/g,No).getRegex(),Qo=K(`^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)`,`gu`).replace(/notPunctSpace/g,Fo).replace(/punctSpace/g,Po).replace(/punct/g,No).getRegex(),$o=K(/\\(punct)/,`gu`).replace(/punct/g,No).getRegex(),es=K(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace(`scheme`,/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace(`email`,/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),ts=K(bo).replace(`(?:-->|$)`,`-->`).getRegex(),ns=K(`^comment|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>`).replace(`comment`,ts).replace(`attribute`,/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),rs=/\[(?:\\[\s\S]|[^\[\]\\])*\]/,is=K(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace(`brackets`,rs).getRegex(),as=K(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace(`label`,is).replace(`href`,/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace(`title`,/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),os=K(/^!?\[(label)\]\[(ref)\]/).replace(`label`,is).replace(`ref`,go).getRegex(),ss=K(/^!?\[(ref)\](?:\[\])?/).replace(`ref`,go).getRegex(),cs=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/,ls=K(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace(`brackets`,rs).getRegex(),us=K(`reflink|nolink(?!\\()`,`g`).replace(`reflink`,K(/^!?\[(label)\]\[(ref)\]/).replace(`label`,ls).replace(`ref`,cs).getRegex()).replace(`nolink`,K(/^!?\[(ref)\](?:\[\])?/).replace(`ref`,cs).getRegex()).getRegex(),ds=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,fs=K(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g,/[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(),ps={_backpedal:eo,anyPunctuation:$o,autolink:es,blockSkip:Bo,br:jo,code:Ao,del:eo,delLDelim:eo,delRDelim:eo,emStrongLDelim:Ho,emStrongRDelimAst:Ko,emStrongRDelimUnd:Yo,escape:ko,link:as,nolink:ss,punctuation:Io,reflink:os,reflinkSearch:us,tag:ns,text:Mo,url:eo},ms={...ps,emStrongLDelim:Wo,emStrongRDelimAst:Jo,emStrongRDelimUnd:Xo,link:K(/^!?\[(label)\]\((.*?)\)/).replace(`label`,is).getRegex(),reflink:K(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace(`label`,is).getRegex()},hs={...ps,emStrongRDelimAst:qo,emStrongLDelim:Uo,delLDelim:Zo,delRDelim:Qo,url:K(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace(`emailProtocol`,fs).replace(`protocol`,ds).replace(`email`,/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:K(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/).replace(`protocol`,ds).replace(/emailProtocol/g,/(?:mailto|xmpp):/).getRegex()},gs={...hs,br:K(jo).replace(`{2,}`,`*`).getRegex(),text:K(hs.text).replace(`\\b_`,`\\b_| {2,}\\n`).replace(/\{2,\}/g,`*`).getRegex()},_s={normal:To,gfm:Do,pedantic:Oo},vs={normal:ps,gfm:hs,breaks:gs,pedantic:ms},ys={"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`},bs=e=>ys[e];function xs(e,t){if(t){if(ro.escapeTest.test(e))return e.replace(ro.escapeReplace,bs)}else if(ro.escapeTestNoEncode.test(e))return e.replace(ro.escapeReplaceNoEncode,bs);return e}function Ss(e){return e.replace(ro.numericCharacterReference,(e,t,n)=>{let r=t===void 0?Number.parseInt(n,16):Number.parseInt(t,10);return r===0||r>1114111||r>=55296&&r<=57343?`�`:String.fromCodePoint(r)})}function Cs(e){try{e=encodeURI(e).replace(ro.percentDecode,`%`)}catch{return null}return e}function ws(e,t){let n=e.replace(ro.findPipe,(e,t,n)=>{let r=!1,i=t;for(;--i>=0&&n[i]===`\\`;)r=!r;return r?`|`:` |`}).split(ro.splitPipe),r=0;if(n[0].trim()||n.shift(),n.length>0&&!n.at(-1)?.trim()&&n.pop(),t){if(n.length>t)n.splice(t);else for(;n.length<t;)n.push(``)}for(;r<n.length;r++)n[r]=n[r].trim().replace(ro.slashPipe,`|`);return n}function Ts(e,t,n){let r=e.length;if(r===0)return``;let i=0;for(;i<r;){let a=e.charAt(r-i-1);if(a===t&&!n)i++;else if(a!==t&&n)i++;else break}return e.slice(0,r-i)}function Es(e){let t=e.split(`
`),n=t.length-1;for(;n>=0&&ro.blankLine.test(t[n]);)n--;return t.length-n<=2?e:t.slice(0,n+1).join(`
`)}function Ds(e){return e.trim().toLowerCase().toUpperCase().toLowerCase()}function Os(e,t){if(e.indexOf(t[1])===-1)return-1;let n=0;for(let r=0;r<e.length;r++)if(e[r]===`\\`)r++;else if(e[r]===t[0])n++;else if(e[r]===t[1]&&(n--,n<0))return r;return n>0?-2:-1}function ks(e,t=0){let n=t,r=``;for(let t of e)if(t===`	`){let e=4-n%4;r+=` `.repeat(e),n+=e}else r+=t,n++;return r}function As(e,t,n,r,i){let a=t.href,o=t.title||null,s=e[1].replace(i.other.outputLinkReplace,`$1`),c=e[0].charAt(0)===`!`;r.state.inLink=!0;let l=r.state.linkEmitted,u=r.state.inRawBlock;r.state.linkEmitted=!1;let d=r.inlineTokens(s),f=r.state.linkEmitted;if(r.state.linkEmitted=l,r.state.inLink=!1,!c){if(f){r.state.inRawBlock=u;return}r.state.linkEmitted=!0}return{type:c?`image`:`link`,raw:n,href:a,title:o,text:s,tokens:d}}function js(e,t,n){let r=e.match(n.other.indentCodeCompensation);if(r===null)return t;let i=r[1];return t.split(`
`).map(e=>{let t=e.match(n.other.beginningSpace);if(t===null)return e;let[r]=t;return e.slice(Math.min(r.length,i.length))}).join(`
`)}function Ms(e,t,n,r){if(!t.includes(`<`))return!1;for(let i=0;i<t.length;i++){if(t[i]===`\\`){i++;continue}if(t[i]==="`"){let e=r.inline.code.exec(t.slice(i));if(e){i+=e[0].length-1;continue}}if(t[i]!==`<`)continue;let a=e.slice(n+i),o=r.inline.tag.exec(a)||r.inline.autolink.exec(a);if(o){if(o[0].length>t.length-i)return!0;i+=o[0].length-1}}return!1}var Ns=class{options;rules;lexer;constructor(e){this.options=e||Qa}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:`space`,raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let e=this.options.pedantic?t[0]:Es(t[0]);return{type:`code`,raw:e,codeBlockStyle:`indented`,text:e.replace(this.rules.other.codeRemoveIndent,``)}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let e=t[0],n=js(e,t[3]||``,this.rules);return{type:`code`,raw:e,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,`$1`):t[2],text:n}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let e=t[2].trim();if(this.rules.other.endingHash.test(e)){let t=Ts(e,`#`);(this.options.pedantic||!t||this.rules.other.endingSpaceTabChar.test(t))&&(e=t.trim())}return{type:`heading`,raw:Ts(t[0],`
`),depth:t[1].length,text:e,tokens:this.lexer.inline(e)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:`hr`,raw:Ts(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let e=Ts(t[0],`
`).split(`
`),n=``,r=``,i=[];for(;e.length>0;){let t=!1,a=[],o=0;for(;o<e.length;o++)if(this.rules.other.blockquoteStart.test(e[o]))a.push(e[o]),t=!0;else if(!t)a.push(e[o]);else break;e=e.slice(o);let s=a.join(`
`),c=s.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,``);n=n?`${n}
${s}`:s,r=r?`${r}
${c}`:c;let l=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(c,i,!0),this.lexer.state.top=l,e.length===0)break;let u=i.at(-1);if(u?.type===`code`)break;if(u?.type===`blockquote`){let t=u,a=e.join(`
`),o=t.raw+`
`+a.replace(this.rules.other.blockquoteSetextReplace2,``),s=this.blockquote(o);i[i.length-1]=s;let c=o.substring(s.raw.length).replace(/^\n/,``),l=c?c.split(`
`).length:0,d=l?e.slice(0,-l):e;d.length>0&&(n=`${n}
${d.join(`
`)}`),r=r.substring(0,r.length-t.text.length)+s.text;break}if(u?.type===`list`){let t=u,a=t.raw+`
`+e.join(`
`),o=this.list(a);i[i.length-1]=o,n=n.substring(0,n.length-u.raw.length)+o.raw,r=r.substring(0,r.length-t.raw.length)+o.raw,e=a.substring(i.at(-1).raw.length).split(`
`);continue}}return{type:`blockquote`,raw:n,tokens:i,text:r}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim(),r=n.length>1,i={type:`list`,raw:``,ordered:r,start:r?+n.slice(0,-1):``,loose:!1,items:[]};n=r?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=r?n:`[*+-]`);let a=this.rules.other.listItemRegex(n),o=!1;for(;e;){let n=!1,r=``,s=``;if(!(t=a.exec(e))||this.rules.block.hr.test(e))break;r=t[0],e=e.substring(r.length);let c=t[2].split(`
`,1)[0],l=t[1].length,u=this.options.pedantic?ks(c,l):c.replace(this.rules.other.leadingSpaceTab,e=>ks(e,l)),d=e.split(`
`,1)[0],f=!u.trim(),p=0;if(this.options.pedantic?(p=2,s=u.trimStart()):f?p=l+1:(p=u.search(this.rules.other.nonSpaceChar),p=p>4?1:p,s=u.slice(p),p+=l),f&&this.rules.other.blankLine.test(d)&&(r+=d+`
`,e=e.substring(d.length+1),n=!0),!n){let t=this.rules.other.nextBulletRegex(p),n=this.rules.other.hrRegex(p),i=this.rules.other.fencesBeginRegex(p),a=this.rules.other.headingBeginRegex(p),o=this.rules.other.htmlBeginRegex(p),c=this.rules.other.blockquoteBeginRegex(p);for(;e;){let l=e.split(`
`,1)[0],m;if(d=l,this.options.pedantic?(d=d.replace(this.rules.other.listReplaceNesting,`  `),m=d):m=d.replace(this.rules.other.leadingSpaceTab,e=>e.replace(this.rules.other.tabCharGlobal,`    `)),i.test(d)||a.test(d)||o.test(d)||c.test(d)||t.test(d)||n.test(d))break;if(m.search(this.rules.other.nonSpaceChar)>=p||!d.trim())s+=`
`+m.slice(p);else{if(f||u.replace(this.rules.other.tabCharGlobal,`    `).search(this.rules.other.nonSpaceChar)>=4||i.test(u)||a.test(u)||n.test(u))break;s+=`
`+d}f=!d.trim(),r+=l+`
`,e=e.substring(l.length+1),u=m.slice(p)}}i.loose||(o?i.loose=!0:this.rules.other.doubleBlankLine.test(r)&&(o=!0)),i.items.push({type:`list_item`,raw:r,task:!!this.options.gfm&&this.rules.other.listIsTask.test(s),loose:!1,text:s,tokens:[]}),i.raw+=r}let s=i.items.at(-1);if(s)s.raw=s.raw.trimEnd(),s.text=s.text.trimEnd();else return;i.raw=i.raw.trimEnd();for(let e of i.items)if(this.lexer.state.top=!1,e.tokens=this.lexer.blockTokens(e.text,[]),!i.loose){let t=e.tokens.filter(e=>e.type===`space`);i.loose=t.length>0&&t.some(e=>this.rules.other.anyLine.test(e.raw))}for(let e of i.items){let t=e.tokens[0];if(e.task&&(t?.type===`text`||t?.type===`paragraph`)){e.text=e.text.replace(this.rules.other.listReplaceTask,``),t.raw=t.raw.replace(this.rules.other.listReplaceTask,``),t.text=t.text.replace(this.rules.other.listReplaceTask,``);for(let e=this.lexer.inlineQueue.length-1;e>=0;e--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[e].src)){this.lexer.inlineQueue[e].src=this.lexer.inlineQueue[e].src.replace(this.rules.other.listReplaceTask,``);break}let n=this.rules.other.listTaskCheckbox.exec(e.raw);if(n){let t={type:`checkbox`,raw:n[0]+` `,checked:n[0]!==`[ ]`};e.checked=t.checked,i.loose?e.tokens[0]&&[`paragraph`,`text`].includes(e.tokens[0].type)&&`tokens`in e.tokens[0]&&e.tokens[0].tokens?(e.tokens[0].raw=t.raw+e.tokens[0].raw,e.tokens[0].text=t.raw+e.tokens[0].text,e.tokens[0].tokens.unshift(t)):e.tokens.unshift({type:`paragraph`,raw:t.raw,text:t.raw,tokens:[t]}):e.tokens.unshift(t)}}else e.task&&=!1}if(i.loose)for(let e of i.items){e.loose=!0;for(let t of e.tokens)t.type===`text`&&(t.type=`paragraph`)}return i}}html(e){let t=this.rules.block.html.exec(e);if(t){let e=Es(t[0]);return{type:`html`,block:!0,raw:e,pre:t[1]===`pre`||t[1]===`script`||t[1]===`style`,text:e}}}def(e){let t=this.rules.block.def.exec(e);if(t){let e=Ds(t[1]).replace(this.rules.other.multipleSpaceGlobal,` `),n=t[2]?t[2].replace(this.rules.other.hrefBrackets,`$1`).replace(this.rules.inline.anyPunctuation,`$1`):``,r=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,`$1`):t[3];return{type:`def`,tag:e,raw:Ts(t[0],`
`),href:n,title:r}}}table(e){let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let n=ws(t[1]),r=t[2].replace(this.rules.other.tableAlignChars,``).split(`|`),i=t[3]?.trim()?t[3].replace(this.rules.other.tableRowBlankLine,``).split(`
`):[],a={type:`table`,raw:Ts(t[0],`
`),header:[],align:[],rows:[]};if(n.length===r.length){for(let e of r)this.rules.other.tableAlignRight.test(e)?a.align.push(`right`):this.rules.other.tableAlignCenter.test(e)?a.align.push(`center`):this.rules.other.tableAlignLeft.test(e)?a.align.push(`left`):a.align.push(null);for(let e=0;e<n.length;e++)a.header.push({text:n[e],tokens:this.lexer.inline(n[e]),header:!0,align:a.align[e]});for(let e of i)a.rows.push(ws(e,a.header.length).map((e,t)=>({text:e,tokens:this.lexer.inline(e),header:!1,align:a.align[t]})));return a}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t){let e=t[1].trim();return{type:`heading`,raw:Ts(t[0],`
`),depth:t[2].charAt(0)===`=`?1:2,text:e,tokens:this.lexer.inline(e)}}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let e=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:`paragraph`,raw:t[0],text:e,tokens:this.lexer.inline(e)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:`text`,raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:`escape`,raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:`html`,raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let n=t[0].charAt(0)===`!`?2:1;if(!this.options.pedantic&&Ms(e,t[1],n,this.rules))return;let r=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(r)){if(!this.rules.other.endAngleBracket.test(r))return;let e=Ts(r.slice(0,-1),`\\`);if((r.length-e.length)%2==0)return}else{let e=Os(t[2],`()`);if(e===-2)return;if(e>-1){let n=(t[0].indexOf(`!`)===0?5:4)+t[1].length+e;t[2]=t[2].substring(0,e),t[0]=t[0].substring(0,n).trim(),t[3]=``}}let i=t[2],a=``;if(this.options.pedantic){let e=this.rules.other.pedanticHrefTitle.exec(i);e&&(i=e[1],a=e[3])}else a=t[3]?t[3].slice(1,-1):``;return i=i.trim(),this.rules.other.startAngleBracket.test(i)&&(i=this.options.pedantic&&!this.rules.other.endAngleBracket.test(r)?i.slice(1):i.slice(1,-1)),As(t,{href:i&&i.replace(this.rules.inline.anyPunctuation,`$1`),title:a&&a.replace(this.rules.inline.anyPunctuation,`$1`)},t[0],this.lexer,this.rules)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){let r=n[0].charAt(0)===`!`?2:1;if(!this.options.pedantic&&Ms(e,n[1],r,this.rules))return;let i=t[Ds((n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal,` `))];if(!i){let e=n[0].charAt(0);return{type:`text`,raw:e,text:e}}return As(n,i,n[0],this.lexer,this.rules)}}emStrong(e,t,n=``){let r=this.rules.inline.emStrongLDelim.exec(e);if(!(!r||!r[1]&&!r[2]&&!r[3]&&!r[4]||r[4]&&n.match(this.rules.other.unicodeAlphaNumeric))&&(!(r[1]||r[3])||!n||this.rules.inline.punctuation.exec(n))){let i=[...r[0]].length-1,a,o,s=i,c=0,l=r[0][0],u=n===l,d=l===`*`?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(d.lastIndex=0,t=t.slice(-1*e.length+i);(r=d.exec(t))!==null;){if(a=r[1]||r[2]||r[3]||r[4]||r[5]||r[6],!a)continue;if(o=[...a].length,r[3]||r[4]){s+=o;continue}if(r[5]||r[6]){if(i%3&&!((i+o)%3)){c+=o;continue}if(u)break}if(s-=o,s>0)continue;o=Math.min(o,o+s+c);let t=[...r[0]][0].length,n=e.slice(0,i+r.index+t+o);if(Math.min(i,o)%2){let e=n.slice(1,-1);return{type:`em`,raw:n,text:e,tokens:this.lexer.inlineTokens(e)}}let l=n.slice(2,-2);return{type:`strong`,raw:n,text:l,tokens:this.lexer.inlineTokens(l)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let e=t[2].replace(this.rules.other.newLineCharGlobal,` `),n=this.rules.other.nonSpaceChar.test(e),r=this.rules.other.startingSpaceChar.test(e)&&this.rules.other.endingSpaceChar.test(e);return n&&r&&(e=e.substring(1,e.length-1)),{type:`codespan`,raw:t[0],text:e}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:`br`,raw:t[0]}}del(e,t,n=``){let r=this.rules.inline.delLDelim.exec(e);if(r&&(!r[1]||!n||this.rules.inline.punctuation.exec(n))){let n=[...r[0]].length-1,i,a,o=n,s=this.rules.inline.delRDelim;for(s.lastIndex=0,t=t.slice(-1*e.length+n);(r=s.exec(t))!==null;){if(i=r[1]||r[2]||r[3]||r[4]||r[5]||r[6],!i||(a=[...i].length,a!==n))continue;if(r[3]||r[4]){o+=a;continue}if(o-=a,o>0)continue;a=Math.min(a,a+o);let t=[...r[0]][0].length,s=e.slice(0,n+r.index+t+a),c=s.slice(n,-n);return{type:`del`,raw:s,text:c,tokens:this.lexer.inlineTokens(c)}}}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let e,n;return t[2]===`@`?(e=t[1],n=`mailto:`+e):(e=t[1],n=e),{type:`link`,raw:t[0],text:e,href:n,autolink:!0,tokens:[{type:`text`,raw:e,text:e}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let e,n;if(t[2]===`@`)e=t[0],n=`mailto:`+e;else{let r;do r=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??``;while(r!==t[0]);e=t[0],n=t[1]===`www.`?`http://`+t[0]:t[0]}return{type:`link`,raw:t[0],text:e,href:n,autolink:!0,tokens:[{type:`text`,raw:e,text:e}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let e=this.lexer.state.inRawBlock;return{type:`text`,raw:t[0],text:e?t[0]:Ss(t[0]),escaped:e}}}},Ps=class e{tokens;options;state;inlineQueue;tokenizer;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||Qa,this.options.tokenizer=this.options.tokenizer||new Ns,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,linkEmitted:!1,top:!0};let t={other:ro,block:_s.normal,inline:vs.normal};this.options.pedantic?(t.block=_s.pedantic,t.inline=vs.pedantic):this.options.gfm&&(t.block=_s.gfm,t.inline=this.options.breaks?vs.breaks:vs.gfm),this.tokenizer.rules=t}static get rules(){return{block:_s,inline:vs}}static lex(t,n){return new e(n).lex(t)}static lexInline(t,n){return new e(n).inlineTokens(t)}lex(e){e=e.replace(ro.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let e=0;e<this.inlineQueue.length;e++){let t=this.inlineQueue[e];this.inlineTokens(t.src,t.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],n=!1){this.tokenizer.lexer=this,this.options.pedantic&&(e=e.replace(ro.tabCharGlobal,`    `).replace(ro.spaceLine,``));let r=1/0;for(;e;){if(e.length<r)r=e.length;else{this.infiniteLoopError(e.charCodeAt(0));break}let i;if(this.options.extensions?.block?.some(n=>(i=n.call({lexer:this},e,t))?(e=e.substring(i.raw.length),t.push(i),!0):!1))continue;if(i=this.tokenizer.space(e)){e=e.substring(i.raw.length);let n=t.at(-1);i.raw.length===1&&n!==void 0?n.raw+=`
`:t.push(i);continue}if(i=this.tokenizer.code(e)){e=e.substring(i.raw.length);let n=t.at(-1);n?.type===`paragraph`||n?.type===`text`?(n.raw+=(n.raw.endsWith(`
`)?``:`
`)+i.raw,n.text+=`
`+i.text,this.inlineQueue.at(-1).src=n.text):t.push(i);continue}if(i=this.tokenizer.fences(e)){e=e.substring(i.raw.length),t.push(i);continue}if(i=this.tokenizer.heading(e)){e=e.substring(i.raw.length),t.push(i);continue}if(i=this.tokenizer.hr(e)){e=e.substring(i.raw.length),t.push(i);continue}if(i=this.tokenizer.blockquote(e)){e=e.substring(i.raw.length),t.push(i);continue}if(i=this.tokenizer.list(e)){e=e.substring(i.raw.length),t.push(i);continue}if(i=this.tokenizer.html(e)){e=e.substring(i.raw.length),t.push(i);continue}if(i=this.tokenizer.def(e)){e=e.substring(i.raw.length);let n=t.at(-1);n?.type===`paragraph`||n?.type===`text`?(n.raw+=(n.raw.endsWith(`
`)?``:`
`)+i.raw,n.text+=`
`+i.raw,this.inlineQueue.at(-1).src=n.text):this.tokens.links[i.tag]||(this.tokens.links[i.tag]={href:i.href,title:i.title},t.push(i));continue}if(i=this.tokenizer.table(e)){e=e.substring(i.raw.length),t.push(i);continue}if(i=this.tokenizer.lheading(e)){e=e.substring(i.raw.length),t.push(i);continue}let a=e;if(this.options.extensions?.startBlock){let t=1/0,n=e.slice(1),r;this.options.extensions.startBlock.forEach(e=>{r=e.call({lexer:this},n),typeof r==`number`&&r>=0&&(t=Math.min(t,r))}),t<1/0&&t>=0&&(a=e.substring(0,t+1))}if(this.state.top&&(i=this.tokenizer.paragraph(a))){let r=t.at(-1);n&&r?.type===`paragraph`?(r.raw+=(r.raw.endsWith(`
`)?``:`
`)+i.raw,r.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=r.text):t.push(i),n=a.length!==e.length,e=e.substring(i.raw.length);continue}if(i=this.tokenizer.text(e)){e=e.substring(i.raw.length);let n=t.at(-1);n?.type===`text`?(n.raw+=(n.raw.endsWith(`
`)?``:`
`)+i.raw,n.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=n.text):t.push(i);continue}if(e){this.infiniteLoopError(e.charCodeAt(0));break}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}linkInText(e){if(!e.includes(`[`))return!1;let t=this.tokenizer.rules.inline.link;for(let n of e.matchAll(this.tokenizer.rules.inline.blockSkip))if(t.test(n[0])&&e.charAt(n.index-1)!==`!`)return!0;for(let t of e.matchAll(this.tokenizer.rules.inline.reflinkSearch)){let e=t[0],n=e.lastIndexOf(`[`);if(e.charAt(0)!==`!`&&Object.hasOwn(this.tokens.links,Ds(e.slice(n+1,-1)))&&!(n>1&&this.linkInText(e.slice(1,n-1))))return!0}return!1}inlineTokens(e,t=[]){this.tokenizer.lexer=this;let n=e;if(this.tokens.links&&e.includes(`[`)){let e=this.tokenizer.rules.inline.reflinkSearch,t=n=>{let r=n.lastIndexOf(`[`);if(!Object.hasOwn(this.tokens.links,Ds(n.slice(r+1,-1))))return n;if(r>1&&n.charAt(0)!==`!`){let i=n.slice(1,r-1);if(this.linkInText(i))return`[`+i.replace(e,t)+`][`+`a`.repeat(n.length-r-2)+`]`}return`[`+`a`.repeat(n.length-2)+`]`};n=n.replace(e,t)}n=n.replace(this.tokenizer.rules.inline.anyPunctuation,e=>`+`.repeat(e.length)),n=n.replace(this.tokenizer.rules.inline.blockSkip,(e,t,n)=>{let r=n?n.length:0;return e.slice(0,r)+`[`+`a`.repeat(e.length-r-2)+`]`}),n=this.options.hooks?.emStrongMask?.call({lexer:this},n)??n;let r=!1,i=``,a=1/0;for(;e;){if(e.length<a)a=e.length;else{this.infiniteLoopError(e.charCodeAt(0));break}r||(i=``),r=!1;let o;if(this.options.extensions?.inline?.some(n=>(o=n.call({lexer:this},e,t))?(e=e.substring(o.raw.length),t.push(o),!0):!1))continue;if(o=this.tokenizer.escape(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.tag(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.link(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(o.raw.length);let n=t.at(-1);o.type===`text`&&n?.type===`text`?(n.raw+=o.raw,n.text+=o.text):t.push(o);continue}if(o=this.tokenizer.emStrong(e,n,i)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.codespan(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.br(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.del(e,n,i)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.autolink(e)){e=e.substring(o.raw.length),t.push(o);continue}if(!this.state.inLink&&(o=this.tokenizer.url(e))){e=e.substring(o.raw.length),t.push(o);continue}let s=e;if(this.options.extensions?.startInline){let t=1/0,n=e.slice(1),r;this.options.extensions.startInline.forEach(e=>{r=e.call({lexer:this},n),typeof r==`number`&&r>=0&&(t=Math.min(t,r))}),t<1/0&&t>=0&&(s=e.substring(0,t+1))}if(o=this.tokenizer.inlineText(s)){e=e.substring(o.raw.length),o.raw.slice(-1)!==`_`&&(i=o.raw.slice(-1)),r=!0;let n=t.at(-1);n?.type===`text`?(n.raw+=o.raw,n.text+=o.text):t.push(o);continue}if(e){this.infiniteLoopError(e.charCodeAt(0));break}}return t}infiniteLoopError(e){let t=`Infinite loop on byte: `+e;if(this.options.silent)console.error(t);else throw Error(t)}},Fs=class{options;parser;constructor(e){this.options=e||Qa}space(e){return``}code({text:e,lang:t,escaped:n}){let r=(t||``).match(ro.notSpaceStart)?.[0],i=e?e.replace(ro.endingNewline,``)+`
`:``;return r?`<pre><code class="language-`+xs(r)+`">`+(n?i:xs(i,!0))+`</code></pre>
`:`<pre><code>`+(n?i:xs(i,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return``}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,n=e.start,r=``;for(let t=0;t<e.items.length;t++){let n=e.items[t];r+=this.listitem(n)}let i=t?`ol`:`ul`,a=t&&n!==1?` start="`+n+`"`:``;return`<`+i+a+`>
`+r+`</`+i+`>
`}listitem(e){return`<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return`<input `+(e?`checked="" `:``)+`disabled="" type="checkbox"> `}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t=``,n=``;for(let t=0;t<e.header.length;t++)n+=this.tablecell(e.header[t]);t+=this.tablerow({text:n});let r=``;for(let t=0;t<e.rows.length;t++){let i=e.rows[t];n=``;for(let e=0;e<i.length;e++)n+=this.tablecell(i[e]);r+=this.tablerow({text:n})}return r&&=`<tbody>${r}</tbody>`,`<table>
<thead>
`+t+`</thead>
`+r+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),n=e.header?`th`:`td`;return(e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${xs(e,!0)}</code>`}br(e){return`<br>`}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,text:n,tokens:r,autolink:i}){let a=i?xs(n,!0):this.parser.parseInline(r),o=Cs(e);if(o===null)return a;e=xs(o,i);let s=`<a href="`+e+`"`;return t&&(s+=` title="`+xs(t)+`"`),s+=`>`+a+`</a>`,s}image({href:e,title:t,text:n,tokens:r}){r&&(n=this.parser.parseInline(r,this.parser.textRenderer));let i=Cs(e);if(i===null)return xs(n);e=i;let a=`<img src="${xs(e)}" alt="${xs(n)}"`;return t&&(a+=` title="${xs(t)}"`),a+=`>`,a}text(e){return`tokens`in e&&e.tokens?this.parser.parseInline(e.tokens):`escaped`in e&&e.escaped?e.text:xs(e.text)}},Is=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return``+e}image({text:e}){return``+e}br(){return``}checkbox({raw:e}){return e}},Ls=class e{options;renderer;textRenderer;constructor(e){this.options=e||Qa,this.options.renderer=this.options.renderer||new Fs,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new Is}static parse(t,n){return new e(n).parse(t)}static parseInline(t,n){return new e(n).parseInline(t)}parse(e){this.renderer.parser=this;let t=``;for(let n=0;n<e.length;n++){let r=e[n];if(this.options.extensions?.renderers?.[r.type]){let e=r,n=this.options.extensions.renderers[e.type].call({parser:this},e);if(n!==!1||![`space`,`hr`,`heading`,`code`,`table`,`blockquote`,`list`,`checkbox`,`html`,`def`,`paragraph`,`text`].includes(e.type)){t+=n||``;continue}}let i=r;switch(i.type){case`space`:t+=this.renderer.space(i);break;case`hr`:t+=this.renderer.hr(i);break;case`heading`:t+=this.renderer.heading(i);break;case`code`:t+=this.renderer.code(i);break;case`table`:t+=this.renderer.table(i);break;case`blockquote`:t+=this.renderer.blockquote(i);break;case`list`:t+=this.renderer.list(i);break;case`checkbox`:t+=this.renderer.checkbox(i);break;case`html`:t+=this.renderer.html(i);break;case`def`:t+=this.renderer.def(i);break;case`paragraph`:t+=this.renderer.paragraph(i);break;case`text`:t+=this.renderer.text(i);break;default:{let e=`Token with "`+i.type+`" type was not found.`;if(this.options.silent)return console.error(e),``;throw Error(e)}}}return t}parseInline(e,t=this.renderer){this.renderer.parser=this;let n=``;for(let r=0;r<e.length;r++){let i=e[r];if(this.options.extensions?.renderers?.[i.type]){let e=this.options.extensions.renderers[i.type].call({parser:this},i);if(e!==!1||![`escape`,`html`,`link`,`image`,`checkbox`,`strong`,`em`,`codespan`,`br`,`del`,`text`].includes(i.type)){n+=e||``;continue}}let a=i;switch(a.type){case`escape`:n+=t.text(a);break;case`html`:n+=t.html(a);break;case`link`:n+=t.link(a);break;case`image`:n+=t.image(a);break;case`checkbox`:n+=t.checkbox(a);break;case`strong`:n+=t.strong(a);break;case`em`:n+=t.em(a);break;case`codespan`:n+=t.codespan(a);break;case`br`:n+=t.br(a);break;case`del`:n+=t.del(a);break;case`text`:n+=t.text(a);break;default:{let e=`Token with "`+a.type+`" type was not found.`;if(this.options.silent)return console.error(e),``;throw Error(e)}}}return n}},Rs=class{options;block;constructor(e){this.options=e||Qa}static passThroughHooks=new Set([`preprocess`,`postprocess`,`processAllTokens`,`emStrongMask`]);static passThroughHooksRespectAsync=new Set([`preprocess`,`postprocess`,`processAllTokens`]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(e=this.block){return e?Ps.lex:Ps.lexInline}provideParser(e=this.block){return e?Ls.parse:Ls.parseInline}},zs=class{defaults=Za();options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=Ls;Renderer=Fs;TextRenderer=Is;Lexer=Ps;Tokenizer=Ns;Hooks=Rs;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(let r of e)switch(n=n.concat(t.call(this,r)),r.type){case`table`:{let e=r;for(let r of e.header)n=n.concat(this.walkTokens(r.tokens,t));for(let r of e.rows)for(let e of r)n=n.concat(this.walkTokens(e.tokens,t));break}case`list`:{let e=r;n=n.concat(this.walkTokens(e.items,t));break}default:{let e=r;this.defaults.extensions?.childTokens?.[e.type]?this.defaults.extensions.childTokens[e.type].forEach(r=>{let i=e[r].flat(1/0);n=n.concat(this.walkTokens(i,t))}):e.tokens&&(n=n.concat(this.walkTokens(e.tokens,t)))}}return n}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(e=>{let n={...e};if(n.async=this.defaults.async||n.async||!1,e.extensions&&(e.extensions.forEach(e=>{if(!e.name)throw Error(`extension name required`);if(`renderer`in e){let n=t.renderers[e.name];n?t.renderers[e.name]=function(...t){let r=e.renderer.apply(this,t);return r===!1&&(r=n.apply(this,t)),r}:t.renderers[e.name]=e.renderer}if(`tokenizer`in e){if(!e.level||e.level!==`block`&&e.level!==`inline`)throw Error(`extension level must be 'block' or 'inline'`);let n=t[e.level];n?n.unshift(e.tokenizer):t[e.level]=[e.tokenizer],e.start&&(e.level===`block`?t.startBlock?t.startBlock.push(e.start):t.startBlock=[e.start]:e.level===`inline`&&(t.startInline?t.startInline.push(e.start):t.startInline=[e.start]))}`childTokens`in e&&e.childTokens&&(t.childTokens[e.name]=e.childTokens)}),n.extensions=t),e.renderer){let t=this.defaults.renderer||new Fs(this.defaults);for(let n in e.renderer){if(!(n in t))throw Error(`renderer '${n}' does not exist`);if([`options`,`parser`].includes(n))continue;let r=n,i=e.renderer[r],a=t[r];t[r]=(...e)=>{let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n||``}}n.renderer=t}if(e.tokenizer){let t=this.defaults.tokenizer||new Ns(this.defaults);for(let n in e.tokenizer){if(!(n in t))throw Error(`tokenizer '${n}' does not exist`);if([`options`,`rules`,`lexer`].includes(n))continue;let r=n,i=e.tokenizer[r],a=t[r];t[r]=(...e)=>{let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n}}n.tokenizer=t}if(e.hooks){let t=this.defaults.hooks||new Rs;for(let n in e.hooks){if(!(n in t))throw Error(`hook '${n}' does not exist`);if([`options`,`block`].includes(n))continue;let r=n,i=e.hooks[r],a=t[r];t[r]=Rs.passThroughHooks.has(n)?e=>{if(this.defaults.async&&Rs.passThroughHooksRespectAsync.has(n))return(async()=>{let n=await i.call(t,e);return a.call(t,n)})();let r=i.call(t,e);return a.call(t,r)}:(...e)=>{if(this.defaults.async)return(async()=>{let n=await i.apply(t,e);return n===!1&&(n=await a.apply(t,e)),n})();let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n}}n.hooks=t}if(e.walkTokens){let t=this.defaults.walkTokens,r=e.walkTokens;n.walkTokens=function(e){let n=[];return n.push(r.call(this,e)),t&&(n=n.concat(t.call(this,e))),n}}this.defaults={...this.defaults,...n}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return Ps.lex(e,t??this.defaults)}parser(e,t){return Ls.parse(e,t??this.defaults)}parseMarkdown(e){return(t,n)=>{let r={...n},i={...this.defaults,...r},a=this.onError(!!i.silent,!!i.async);if(this.defaults.async===!0&&r.async===!1)return a(Error(`marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise.`));if(typeof t>`u`||t===null)return a(Error(`marked(): input parameter is undefined or null`));if(typeof t!=`string`)return a(Error(`marked(): input parameter is of type `+Object.prototype.toString.call(t)+`, string expected`));if(i.hooks&&(i.hooks.options=i,i.hooks.block=e),i.async)return(async()=>{let n=i.hooks?await i.hooks.preprocess(t):t,r=await(i.hooks?await i.hooks.provideLexer(e):e?Ps.lex:Ps.lexInline)(n,i),a=i.hooks?await i.hooks.processAllTokens(r):r;i.walkTokens&&await Promise.all(this.walkTokens(a,i.walkTokens));let o=await(i.hooks?await i.hooks.provideParser(e):e?Ls.parse:Ls.parseInline)(a,i);return i.hooks?await i.hooks.postprocess(o):o})().catch(a);try{i.hooks&&(t=i.hooks.preprocess(t));let n=(i.hooks?i.hooks.provideLexer(e):e?Ps.lex:Ps.lexInline)(t,i);i.hooks&&(n=i.hooks.processAllTokens(n)),i.walkTokens&&this.walkTokens(n,i.walkTokens);let r=(i.hooks?i.hooks.provideParser(e):e?Ls.parse:Ls.parseInline)(n,i);return i.hooks&&(r=i.hooks.postprocess(r)),r}catch(e){return a(e)}}}onError(e,t){return n=>{if(n.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let e=`<p>An error occurred:</p><pre>`+xs(n.message+``,!0)+`</pre>`;return t?Promise.resolve(e):e}if(t)return Promise.reject(n);throw n}}},Bs=new zs;function Vs(e,t){return Bs.parse(e,t)}Vs.options=Vs.setOptions=function(e){return Bs.setOptions(e),Vs.defaults=Bs.defaults,$a(Vs.defaults),Vs},Vs.getDefaults=Za,Vs.defaults=Qa;function Hs(...e){return Bs.use(...e),Vs.defaults=Bs.defaults,$a(Vs.defaults),Vs}Vs.use=Hs,Vs.walkTokens=function(e,t){return Bs.walkTokens(e,t)},Vs.parseInline=Bs.parseInline,Vs.Parser=Ls,Vs.parser=Ls.parse,Vs.Renderer=Fs,Vs.TextRenderer=Is,Vs.Lexer=Ps,Vs.lexer=Ps.lex,Vs.Tokenizer=Ns,Vs.Hooks=Rs,Vs.parse=Vs,Vs.options,Vs.setOptions,Vs.walkTokens,Vs.parseInline,Ls.parse,Ps.lex;var Us=Object.assign({"/src/content/docs/00-quickstart.md":Kr,"/src/content/docs/01-what-is-moogo.md":qr,"/src/content/docs/02-why-moogo.md":Jr,"/src/content/docs/03-comparison.md":Yr,"/src/content/docs/04-register.md":Xr,"/src/content/docs/05-create-project.md":Zr,"/src/content/docs/06-credentials.md":Qr,"/src/content/docs/07-sql-api.md":$r,"/src/content/docs/08-create-bucket.md":ei,"/src/content/docs/09-object-storage.md":ti,"/src/content/docs/10-dashboard.md":ni,"/src/content/docs/11-limits.md":ri,"/src/content/docs/12-security.md":ii,"/src/content/docs/13-errors.md":ai,"/src/content/docs/14-feedback.md":oi,"/src/content/docs/15-ai-adoption-prompt.md":si,"/src/content/docs/guides/00-javascript-vanilla.md":ci,"/src/content/docs/guides/01-nextjs.md":li,"/src/content/docs/guides/02-nuxt.md":ui,"/src/content/docs/guides/03-react.md":di,"/src/content/docs/guides/03-vue.md":fi,"/src/content/docs/guides/04-astro.md":pi,"/src/content/docs/guides/05-python-vanilla.md":mi,"/src/content/docs/guides/06-fastapi.md":hi,"/src/content/docs/guides/07-flask.md":gi,"/src/content/docs/guides/08-django.md":_i,"/src/content/docs/guides/09-php-vanilla.md":vi,"/src/content/docs/guides/10-laravel.md":yi,"/src/content/docs/guides/11-go.md":bi,"/src/content/docs/guides/12-ruby-rails.md":xi,"/src/content/docs/guides/13-java-kotlin.md":Si,"/src/content/docs/guides/14-schema-best-practices.md":Ci}),Ws=[{group:`Getting started`,slugs:[`quickstart`,`what-is-moogo`,`why-moogo`,`comparison`,`register`,`ai-adoption-prompt`]},{group:`Using Moogo`,slugs:[`create-project`,`credentials`,`sql-api`,`create-bucket`,`object-storage`,`dashboard`]},{group:`Language Guides`,slugs:[`javascript-vanilla`,`react`,`nextjs`,`nuxt`,`vue`,`astro`,`python-vanilla`,`fastapi`,`flask`,`django`,`php-vanilla`,`laravel`,`go`,`ruby-rails`,`java-kotlin`]},{group:`Database`,slugs:[`schema-best-practices`]},{group:`Reference`,slugs:[`limits`,`security`,`errors`,`feedback`]}];function Gs(e){return(e.split(`/`).pop()??``).replace(/\.md$/,``).replace(/^\d+-/,``)}function Ks(e){let t=Object.keys(Us).find(t=>Gs(t)===e);return t?Us[t]:void 0}function qs(e){return e.toLowerCase().replace(/[`*_~]/g,``).replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)}var Js=class{seen=new Map;slug(e){let t=qs(e)||`section`,n=this.seen.get(t)??0;return this.seen.set(t,n+1),n===0?t:`${t}-${n}`}},Ys=e=>e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`);function Xs(e){return e.map(e=>`tokens`in e?Xs(e.tokens):`text`in e?String(e.text):``).join(``)}function Zs(e){return e.type===`heading`}function Qs(e){let t=new Js,n=[];for(let r of e){if(!Zs(r)||r.depth<2||r.depth>3)continue;let e=Xs(r.tokens).trim();e&&n.push({depth:r.depth,text:e,id:t.slug(e)})}return n}var $s=[],ec=new zs({gfm:!0,breaks:!1,renderer:{heading({tokens:e,depth:t}){if(t===1)return``;let n=Xs(e),r=$s.shift()??qs(n);return`<h${t} id="${r}">${n}${t===2?`<a class="heading-anchor" href="#${r}" aria-label="Link to ${Ys(n)}">#</a>`:``}</h${t}>\n`},code({text:e,lang:t}){let n=(t??``).trim().split(/\s+/)[0],r=n?`<span class="code-lang">${Ys(n)}</span>`:``;return`<div class="code-block"${n?` data-lang="${Ys(n)}"`:``}>`+r+`<button type="button" class="code-copy" aria-label="Copy code to clipboard"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="7" width="9" height="9" rx="2" /><path d="M13 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h.5" /></svg><span>Copy</span></button><pre><code>${Ys(e)}</code></pre></div>\n`},link({href:e,title:t,tokens:n}){let r=Xs(n),i=t?` title="${Ys(t)}"`:``;return/^https?:\/\//i.test(e)?`<a href="${Ys(e)}"${i} target="_blank" rel="noopener noreferrer">${r}</a>`:`<a href="${Ys(e)}"${i}>${r}</a>`}}});function tc(e){for(let t of e){if(t.type!==`paragraph`)continue;let e=Xs(t.tokens).trim();if(e)return e}return``}function nc(e,t){let n=e.findIndex(e=>e.type===`paragraph`);if(n<0)return e;let r=e[n];return Xs(r.tokens).trim()===t?[...e.slice(0,n),...e.slice(n+1)]:e}var rc=new Map;function ic(e){let t=rc.get(e);if(t)return t;let n=Ks(e);if(n===void 0)return;let r=ec.lexer(n),i=r.filter(Zs),a=i.length?Xs(i[0].tokens).trim():e,o=tc(r),s=Qs(r),c=o?nc(r,o):r;$s=Qs(r).map(e=>e.id);let l=ec.parser(c),u={title:a,description:o,headings:s,html:Xa.sanitize(l,{ADD_ATTR:[`target`,`rel`,`id`],USE_PROFILES:{html:!0}})};return rc.set(e,u),u}function ac(){let e=new Map;for(let t of Object.keys(Us)){let n=Gs(t),r=ic(n);r&&e.set(n,{title:r.title,description:r.description})}let t=[],n=new Set;for(let{group:r,slugs:i}of Ws)for(let a of i)e.has(a)&&!n.has(a)&&(t.push({slug:a,group:r}),n.add(a));for(let r of e.keys())n.has(r)||t.push({slug:r,group:`Reference`});return t.map(({slug:n,group:r},i)=>{let a=e.get(n),o=rc.get(n),s=n=>{let r=t[i+n];if(!r)return null;let a=e.get(r.slug);return{slug:r.slug,title:a.title,description:a.description,group:r.group,previous:null,next:null,headings:[]}};return{slug:n,title:a.title,description:a.description,group:r,previous:s(-1),next:s(1),headings:o?.headings??[]}})}var oc=ac(),sc=new Map(oc.map(e=>[e.slug,e]));function cc(){return oc}function lc(){let e=[];for(let t of oc){let n=e.find(e=>e.group===t.group);n?n.pages.push(t):e.push({group:t.group,pages:[t]})}return e}function uc(e){if(e)return sc.get(e)}function dc(e){return ic(e)?.html??``}function fc(e){return Ks(e)}var pc=`quickstart`,mc=96,hc=`ai-adoption-prompt`;function gc(){let{slug:e}=dt(),t=st(),n=uc(e)??uc(pc),[r,i]=(0,h.useState)(!1),[a,o]=(0,h.useState)(``),[s,c]=(0,h.useState)(``),l=window.location.hash.slice(1),u=()=>{i(!1),o(``)};(0,h.useEffect)(()=>{if(l){let e=requestAnimationFrame(()=>{document.getElementById(l)?.scrollIntoView({block:`start`})});return()=>cancelAnimationFrame(e)}window.scrollTo({top:0})},[n.slug,l]),(0,h.useEffect)(()=>{if(n.headings.length===0)return;let e=0,t=()=>{e=0;let t=n.headings[0].id;for(let e of n.headings){let n=document.getElementById(e.id);if(n){if(n.getBoundingClientRect().top<=mc)t=e.id;else break}}c(t)},r=()=>{e||=requestAnimationFrame(t)};return t(),window.addEventListener(`scroll`,r,{passive:!0}),window.addEventListener(`resize`,r),()=>{e&&cancelAnimationFrame(e),window.removeEventListener(`scroll`,r),window.removeEventListener(`resize`,r)}},[n.headings]);let d=(0,h.useMemo)(()=>dc(n.slug),[n.slug]);return(0,V.jsx)(Pr,{children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1400px] px-6 pt-10 pb-6 lg:pt-14 lg:pb-8`,children:[(0,V.jsx)(`div`,{className:`lg:hidden`,children:(0,V.jsxs)(`button`,{type:`button`,onClick:()=>i(e=>!e),"aria-expanded":r,className:`mb-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edge px-3.5 py-2 text-[0.88rem] font-medium text-muted transition-colors hover:text-foreground`,children:[(0,V.jsx)(`svg`,{viewBox:`0 0 20 20`,"aria-hidden":`true`,className:`h-4 w-4 stroke-current`,fill:`none`,strokeWidth:`1.7`,children:(0,V.jsx)(`path`,{d:`M3 5h14M3 10h14M3 15h14`,strokeLinecap:`round`})}),r?`Hide contents`:`Contents`]})}),(0,V.jsxs)(`div`,{className:`grid gap-10 pb-20 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_212px]`,children:[(0,V.jsx)(bc,{open:r,query:a,onQuery:o,onNavigate:u,activeSlug:n.slug}),(0,V.jsxs)(`main`,{className:`min-w-0`,children:[(0,V.jsxs)(`article`,{children:[n.slug===hc&&(0,V.jsx)(_c,{slug:n.slug}),(0,V.jsxs)(`header`,{className:`mb-8`,children:[(0,V.jsx)(`p`,{className:`mb-2 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:n.group}),(0,V.jsx)(`h1`,{className:`mb-4 text-[clamp(1.9rem,3.6vw,2.5rem)] font-semibold tracking-tight`,children:n.title}),n.description&&(0,V.jsx)(`p`,{className:`max-w-[52em] text-[1.02rem] leading-relaxed text-muted`,children:n.description})]}),(0,V.jsx)(`div`,{className:`docs-prose`,onClick:e=>vc(e,t,u),dangerouslySetInnerHTML:{__html:d}})]}),(0,V.jsx)(Sc,{page:n,onNavigate:u})]}),(0,V.jsx)(xc,{page:n,activeId:s})]})]})})}function _c({slug:e}){let[t,n]=(0,h.useState)(!1),r=fc(e);return r===void 0?null:(0,V.jsxs)(`div`,{className:`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge bg-background-alt px-4 py-3`,children:[(0,V.jsxs)(`p`,{className:`text-[0.88rem] font-medium text-muted`,children:[`Take this page with you — as`,` `,(0,V.jsx)(`code`,{className:`rounded bg-panel px-1.5 py-0.5 font-mono text-[0.82rem] text-foreground`,children:`moogo.md`}),` `,`in your project, for your agent to read.`]}),(0,V.jsxs)(`div`,{className:`flex shrink-0 gap-2`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:async()=>{try{await navigator.clipboard.writeText(r),n(!0),window.setTimeout(()=>n(!1),2e3)}catch{}},className:`cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent`,children:t?`✓ Copied`:`Copy moogo.md`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>{let e=URL.createObjectURL(new Blob([r],{type:`text/markdown`})),t=document.createElement(`a`);t.href=e,t.download=`moogo.md`,t.click(),URL.revokeObjectURL(e)},className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`Download`})]})]})}function vc(e,t,n){let r=e.target,i=r.closest(`.code-copy`);if(i){e.preventDefault();let t=i.closest(`.code-block`)?.querySelector(`code`);t&&yc(t.textContent??``,i);return}let a=r.closest(`a`);if(!a)return;let o=a.getAttribute(`href`)??``;if(!(/^https?:/i.test(o)||a.target===`_blank`)&&!o.startsWith(`#`)){if((o===`/app`||o.startsWith(`/app/`))&&Hn()!==window.location.origin){a.setAttribute(`href`,Hn()+o);return}e.preventDefault(),n(),t(o)}}async function yc(e,t){let n=t.querySelector(`span`),r=n?.textContent??`Copy`;try{await navigator.clipboard.writeText(e),n&&(n.textContent=`Copied`),t.setAttribute(`data-copied`,`true`)}catch{n&&(n.textContent=`Failed`)}window.setTimeout(()=>{n&&(n.textContent=r),t.removeAttribute(`data-copied`)},1600)}function bc({open:e,query:t,onQuery:n,onNavigate:r,activeSlug:i}){let a=lc(),o=t.trim().toLowerCase(),s=e=>o===``||e.title.toLowerCase().includes(o)||e.description.toLowerCase().includes(o),c=a.map(e=>({...e,pages:e.pages.filter(s)})).filter(e=>e.pages.length>0),l=c.length===0;return(0,V.jsx)(`nav`,{"aria-label":`Documentation`,className:`${e?`block`:`hidden`} lg:sticky lg:top-[90px] lg:block lg:self-start`,children:(0,V.jsxs)(`div`,{className:`lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-2`,children:[(0,V.jsxs)(`div`,{className:`relative mb-5`,children:[(0,V.jsxs)(`svg`,{viewBox:`0 0 20 20`,"aria-hidden":`true`,className:`pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 stroke-current text-faint`,fill:`none`,strokeWidth:`1.7`,children:[(0,V.jsx)(`circle`,{cx:`9`,cy:`9`,r:`5.5`}),(0,V.jsx)(`path`,{d:`M13.5 13.5 17 17`,strokeLinecap:`round`})]}),(0,V.jsx)(`input`,{type:`search`,value:t,onChange:e=>n(e.target.value),placeholder:`Search docs`,"aria-label":`Search documentation`,className:`w-full rounded-lg border border-edge bg-background py-2 pr-3 pl-8.5 text-[0.88rem] text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20`})]}),l?(0,V.jsxs)(`p`,{className:`px-1 text-[0.85rem] text-faint`,children:[`No page matches “`,t,`”.`]}):c.map(e=>(0,V.jsxs)(`div`,{className:`mb-6`,children:[(0,V.jsx)(`p`,{className:`mb-2 px-3 text-[0.72rem] font-semibold uppercase tracking-[0.11em] text-faint`,children:e.group}),(0,V.jsx)(`ul`,{className:`flex flex-col gap-0.5`,children:e.pages.map(e=>{let t=e.slug===i;return(0,V.jsx)(`li`,{children:(0,V.jsx)(B,{to:`/docs/${e.slug}`,onClick:r,"aria-current":t?`page`:void 0,className:`block rounded-lg px-3 py-1.5 text-[0.89rem] leading-snug transition-colors ${t?`bg-background-alt font-medium text-foreground`:`text-muted hover:bg-hover-bg hover:text-foreground`}`,children:e.title})},e.slug)})})]},e.group)),(0,V.jsxs)(`p`,{className:`mt-2 px-3 text-[0.78rem] text-faint`,children:[cc().length,` pages`]})]})})}function xc({page:e,activeId:t}){return e.headings.length===0?null:(0,V.jsxs)(`aside`,{className:`hidden xl:sticky xl:top-[90px] xl:block xl:self-start`,children:[(0,V.jsx)(`p`,{className:`mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.11em] text-faint`,children:`On this page`}),(0,V.jsx)(`ul`,{className:`flex flex-col gap-1 border-l border-edge`,children:e.headings.map(e=>(0,V.jsx)(`li`,{children:(0,V.jsx)(`a`,{href:`#${e.id}`,className:`-ml-px block border-l py-1 text-[0.83rem] leading-snug transition-colors ${e.depth===3?`pl-6`:`pl-3`} ${t===e.id?`border-accent-strong font-medium text-foreground`:`border-transparent text-faint hover:border-edge-strong hover:text-muted`}`,children:e.text})},e.id))})]})}function Sc({page:e,onNavigate:t}){return!e.previous&&!e.next?null:(0,V.jsxs)(`nav`,{"aria-label":`Documentation pages`,className:`docs-pager mt-14 grid gap-3 sm:grid-cols-2`,children:[e.previous?(0,V.jsxs)(B,{to:`/docs/${e.previous.slug}`,onClick:t,className:`text-left`,children:[(0,V.jsx)(`span`,{className:`pager-direction`,children:`Previous`}),(0,V.jsxs)(`span`,{className:`pager-title`,children:[`← `,e.previous.title]})]}):(0,V.jsx)(`span`,{}),e.next&&(0,V.jsxs)(B,{to:`/docs/${e.next.slug}`,onClick:t,className:`text-right sm:col-start-2`,children:[(0,V.jsx)(`span`,{className:`pager-direction`,children:`Next`}),(0,V.jsxs)(`span`,{className:`pager-title`,children:[e.next.title,` →`]})]})]})}function Cc(){let[e,t]=(0,h.useState)(``),[n,r]=(0,h.useState)(!1),[i,a]=(0,h.useState)(null),[o,s]=(0,h.useState)(null);async function c(t){if(t.preventDefault(),!e.trim()){s(`Enter the email you signed up with.`);return}r(!0),s(null);try{let t=await U.forgotPassword(e.trim());a(t.message)}catch(e){s(e instanceof ar?e.message:`Could not start the reset. Please try again.`)}finally{r(!1)}}return(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[440px] px-6`,children:[(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6 sm:p-8`,children:[(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`Reset your password`}),i?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`p`,{className:`mb-5 text-muted`,children:i}),(0,V.jsx)(`div`,{className:`rounded-lg border border-edge bg-background px-4 py-4 text-[0.9rem] text-muted`,children:`Check your inbox. The link expires soon and can only be used once. If nothing arrives, the email may not be registered.`})]}):(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`p`,{className:`mb-5 text-muted`,children:`Enter your email and we'll send you a link to choose a new password.`}),o&&(0,V.jsx)(`div`,{role:`alert`,className:`mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber`,children:o}),(0,V.jsxs)(`form`,{onSubmit:c,className:`space-y-4`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:`email`,className:`mb-1.5 block text-sm font-medium text-muted`,children:`Email`}),(0,V.jsx)(`input`,{type:`email`,id:`email`,name:`email`,autoComplete:`email`,value:e,onChange:e=>t(e.target.value),className:`w-full rounded-lg border border-edge bg-background px-4 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20`,placeholder:`you@example.com`})]}),(0,V.jsx)(`button`,{type:`submit`,disabled:n,className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:n?`Sending…`:`Send reset link`})]})]}),(0,V.jsxs)(`p`,{className:`mt-6 text-center text-[0.9rem] text-muted`,children:[`Remembered it after all?`,` `,(0,V.jsx)(B,{to:`/login`,className:`text-accent hover:text-accent-strong`,children:`Sign in`})]})]}),(0,V.jsx)(`p`,{className:`mt-6 text-center`,children:(0,V.jsx)(Gn,{className:`text-[0.9rem] text-faint hover:text-foreground`,children:`← Back to the landing page`})})]})})})}var wc=[{id:`query`,label:`Query`,code:`POST $MOOGO_PROJECT_URL/query
Authorization: Bearer $MOOGO_SECRET_KEY
Content-Type: application/json

{
  "query": "SELECT id, email FROM users WHERE plan = ?",
  "args": ["pro"]
}`},{id:`exec`,label:`Exec`,code:`POST $MOOGO_PROJECT_URL/exec
Authorization: Bearer $MOOGO_SECRET_KEY
Content-Type: application/json

{
  "query": "INSERT INTO users (email) VALUES (?)",
  "args": ["ketut@example.com"]
}`},{id:`curl`,label:`cURL`,code:`curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -d '{"query":"SELECT count(*) FROM users"}'`}];function Tc(){let[e,t]=(0,h.useState)(wc[0].id),[n,r]=(0,h.useState)(!1),i=wc.find(t=>t.id===e)??wc[0];async function a(){try{await navigator.clipboard.writeText(i.code),r(!0),window.setTimeout(()=>r(!1),1600)}catch{}}return(0,V.jsxs)(`div`,{className:`relative`,children:[(0,V.jsxs)(`div`,{className:`overflow-hidden rounded-xl border border-edge bg-panel`,children:[(0,V.jsxs)(`div`,{className:`flex items-center gap-4 border-b border-edge bg-panel-raised px-3.5 py-3`,children:[(0,V.jsxs)(`div`,{className:`flex gap-1.5`,"aria-hidden":`true`,children:[(0,V.jsx)(`span`,{className:`h-2.5 w-2.5 rounded-full bg-edge-strong`}),(0,V.jsx)(`span`,{className:`h-2.5 w-2.5 rounded-full bg-edge-strong`}),(0,V.jsx)(`span`,{className:`h-2.5 w-2.5 rounded-full bg-edge-strong`})]}),(0,V.jsx)(`div`,{role:`tablist`,"aria-label":`API examples`,className:`ml-1.5 flex gap-1`,children:wc.map(n=>(0,V.jsx)(`button`,{role:`tab`,type:`button`,"aria-selected":e===n.id,onClick:()=>t(n.id),className:`cursor-pointer rounded-md px-2.5 py-1 text-[0.84rem] ${e===n.id?`bg-accent-strong/15 text-accent`:`text-faint hover:text-muted`}`,children:n.label},n.id))})]}),(0,V.jsx)(`div`,{className:`min-h-[268px] overflow-x-auto px-5 py-4`,children:(0,V.jsx)(`pre`,{className:`font-mono text-[0.82rem] leading-relaxed text-foreground`,children:(0,V.jsx)(`code`,{children:i.code})})}),(0,V.jsxs)(`div`,{className:`flex items-center gap-2.5 overflow-hidden border-t border-edge bg-panel-raised px-4 py-2.5 text-[0.79rem] text-faint`,children:[(0,V.jsx)(`span`,{className:`h-[7px] w-[7px] flex-none rounded-full bg-accent-strong`}),(0,V.jsx)(`span`,{children:`Response`}),(0,V.jsx)(`code`,{className:`overflow-hidden text-ellipsis whitespace-nowrap font-mono text-muted`,children:`{"success":true,"rows":[["7c1f…","ketut@example.com"]],"row_count":1}`})]})]}),(0,V.jsxs)(`button`,{type:`button`,onClick:a,className:`absolute right-3.5 top-3.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-edge-strong bg-panel/90 px-2.5 py-1.5 text-[0.79rem] text-muted hover:border-hover-edge hover:text-foreground`,children:[(0,V.jsxs)(`svg`,{viewBox:`0 0 20 20`,"aria-hidden":`true`,className:`h-3.5 w-3.5 fill-none stroke-current stroke-[1.6]`,children:[(0,V.jsx)(`rect`,{x:`7`,y:`7`,width:`9`,height:`9`,rx:`2`}),(0,V.jsx)(`path`,{d:`M13 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h.5`})]}),(0,V.jsx)(`span`,{children:n?`Copied`:`Copy`})]})]})}var Ec=[{label:`Database`,accent:!0,items:[{title:`One file per project`,body:`Every project is a separate SQLite file on disk. There is no shared table and no tenant_id column to forget in a WHERE clause, so isolation is a property of the filesystem rather than a policy somebody has to keep writing.`},{title:`Prepared statements only`,body:`Values travel in args and are bound by the engine. A value can never become syntax, so injection is not reduced on this path — it has nowhere to happen.`},{title:`Every statement is parsed first`,body:`ATTACH, readfile, writefile, extension loading and stacked statements are rejected before a statement runs. The check runs on tokens, so a table called attachments is not mistaken for ATTACH.`},{title:`WAL, foreign keys, one connection each`,body:`Reads never block the writer, writes are serialised per project, and foreign keys are enforced. Concurrency is handled so you do not have to think about SQLITE_BUSY.`}]},{label:`Storage`,accent:!1,items:[{title:`256 MB of files per project`,body:`Organise with buckets and prefixes, upload with a plain PUT. Storage has its own credential, so a key scoped to running SELECT cannot overwrite your files.`},{title:`Public URLs without ceremony`,body:`Publish an object and it is readable at a stable URL with no header, no cookie and no session. Private objects answer 404, so an unlisted file is indistinguishable from one that does not exist.`},{title:`Policies enforced server-side`,body:`Restrict a bucket to images or video and cap the size of a single object. The rule is checked on every write, not only in the file picker.`}]},{label:`Dashboard`,accent:!1,items:[{title:`Tables as a spreadsheet`,body:`Browse, sort, filter and edit rows without writing a query. Build tables with a form instead of remembering the exact DDL.`},{title:`A console that tells you why`,body:`The console runs the same sanitizer and the same read/write rules as the public API, and reports the same error code you would get in production.`},{title:`It never sees your key`,body:`The dashboard authorises with your session, not your secret key. That is the point: a key in a browser leaks through devtools, a screenshot, or an extension.`}]}],Dc=[{title:`Create a project`,body:`You get a URL, an id, and a key. The key is shown once, because only a hash of it is ever stored.`},{title:`Put three values in your env`,body:`No driver, no connection string, no pool. If it runs on HTTP, it can talk to Moogo.`},{title:`Query it like SQL`,body:`One POST with a statement and its arguments. Reads go to /query, writes to /exec.`}],Oc=[{title:`Table builder`,body:`Create and alter tables from a form. It writes the DDL you would have had to get right by hand.`},{title:`Spreadsheet editor`,body:`Add, edit and delete rows directly. Each change is a parameterised statement, not a string you assembled.`},{title:`SQL console`,body:`Run anything and read the same error codes your application will see.`},{title:`Activity log`,body:`Every request with its method, status and duration, kept for seven days. Answers what ran and what it cost.`},{title:`Backups`,body:`Download the whole database as a .db file. It is a real SQLite file, so your own tooling opens it.`},{title:`Key rotation`,body:`Issue a new key in one click. The old one stops working immediately.`}],kc=[{lead:`The key is stored hashed.`,body:`A leaked database dump does not hand over working credentials, because there is nothing recoverable to hand over.`},{lead:`The project id lives in the path.`,body:`One source of truth, so authorisation cannot disagree with routing.`},{lead:`Ownership is checked per request.`,body:`Another account's project answers 404, not 403, so ids cannot be probed for existence.`},{lead:`Every statement is parsed first.`,body:`No file access, no extension loading, no stacked statements.`},{lead:`Errors do not leak internals.`,body:`A failed statement reports the table it wanted. A panic reports nothing at all.`},{lead:`The limits come back in the response.`,body:`Usage, size and duration are reported, so you find out from the API instead of from a hung tab.`}],Ac=[{q:`Why SQLite and not Postgres?`,a:`Because most applications do not need Postgres, and the operational cost of it is real. A function that runs to completion would otherwise have to manage a connection, a pool, or a proxy. SQLite over HTTP removes that work, and one file per project removes the shared-tenant question entirely.`},{q:`Is it just a thin wrapper over something else?`,a:`No. Your database is a SQLite file on disk, and you can download it as a .db file and open it with the official SQLite tooling. What Moogo adds is the hosted API, the per-project isolation, and the statement validation.`},{q:`What happens if my key leaks?`,a:`Rotate it. The new key works immediately and the old one stops working immediately. Because only a hash is stored, a dump of the control plane does not contain working keys, and rotation is the whole remediation.`},{q:`Can I write arbitrary SQL?`,a:`Yes, within limits that exist for safety rather than convenience. ATTACH, file access, extension loading, stacked statements and triggers are refused. PRAGMA is restricted to read-only introspection. Every one of these is listed in the security documentation with the reason.`},{q:`Does it pause when I am not using it?`,a:`No. There is no idle timeout, so there is no cold start to design around. If you want to stop using a project, you pause it deliberately, and that is reversible.`},{q:`What if I outgrow 100 MB?`,a:`Then you have outgrown it, and you should know that now rather than after building on it. Two projects per account, 100 MB each, is the current free tier. The limits are enforced before a write commits, never silently.`},{q:`Is there really no billing?`,a:`Not in this version. Every account is on the same plan, which also means nothing on this page can quietly expire. The data model already has the columns billing would need.`},{q:`Does it work from a Cloudflare Worker?`,a:`Yes. It is HTTP with a bearer token and no sockets to hold open, which is the shape serverless runtimes handle well. Storage uses a separate credential so you can scope it independently of the SQL key.`}],jc=[{name:`JavaScript`,doc:`javascript-vanilla`,icon:`javascript`},{name:`TypeScript`,doc:`javascript-vanilla`,icon:`typescript`},{name:`React`,doc:`react`,icon:`react`},{name:`Node.js`,doc:`javascript-vanilla`,icon:`nodedotjs`},{name:`Next.js`,doc:`nextjs`,icon:`nextdotjs`},{name:`Nuxt`,doc:`nuxt`,icon:`nuxt`},{name:`Vue`,doc:`vue`,icon:`vuedotjs`},{name:`Astro`,doc:`astro`,icon:`astro`},{name:`Python`,doc:`python-vanilla`,icon:`python`},{name:`FastAPI`,doc:`fastapi`,icon:`fastapi`},{name:`Flask`,doc:`flask`,icon:`flask`},{name:`Django`,doc:`django`,icon:`django`},{name:`PHP`,doc:`php-vanilla`,icon:`php`},{name:`Laravel`,doc:`laravel`,icon:`laravel`},{name:`Go`,doc:`go`,icon:`go`},{name:`Rails`,doc:`ruby-rails`,icon:`rubyonrails`},{name:`Kotlin`,doc:`java-kotlin`,icon:`kotlin`}],Mc=`https://cdn.jsdelivr.net/npm/simple-icons@v14/icons`;function Nc(){return(0,V.jsx)(`section`,{className:`hero-grid`,children:(0,V.jsxs)(`div`,{className:`relative mx-auto w-full max-w-[1120px] px-6 py-16 lg:py-20 text-center`,children:[(0,V.jsx)(`p`,{className:`mb-4 inline-block text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`SQLite over HTTP`}),(0,V.jsx)(`h1`,{className:`mb-5 text-[clamp(2.4rem,5.2vw,3.6rem)] font-semibold leading-tight tracking-tight`,children:`A True Database for Serverless Apps`}),(0,V.jsxs)(`p`,{className:`mb-10 max-w-[42em] mx-auto text-lg text-muted`,children:[`Built with Go for serverless apps. Each project gets its own SQLite file and key — SQL over HTTP, no connection string, no driver. A`,(0,V.jsx)(B,{to:`/docs/ai-adoption-prompt`,title:`The Moogo reference for AI agents — copy it as moogo.md`,className:`rounded bg-panel-raised px-1.5 font-mono text-[0.87em] text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent`,children:`moogo.md`}),`lets AI use your DB directly. No pause, no cold starts, no credit card.`]}),(0,V.jsxs)(`div`,{className:`mb-12 flex flex-wrap justify-center gap-3`,children:[(0,V.jsx)(B,{to:`/register`,className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Start free`}),(0,V.jsx)(B,{to:`/docs/quickstart`,className:`inline-flex items-center justify-center rounded-lg border border-edge-strong px-5 py-3 font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Read the docs`})]}),(0,V.jsxs)(`dl`,{className:`flex flex-wrap justify-center gap-x-8 gap-y-4 border-t border-edge pt-7`,children:[(0,V.jsx)(Pc,{value:`100 MB`,label:`SQLite / project`}),(0,V.jsx)(Pc,{value:`2`,label:`projects / user`}),(0,V.jsx)(Pc,{value:`256 MB`,label:`bucket / project`}),(0,V.jsx)(Pc,{value:`No pause`,label:`always on`}),(0,V.jsx)(Pc,{value:`No credit`,label:`free forever`})]})]})})}function Pc({value:e,label:t}){return(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`dt`,{className:`text-2xl font-semibold tracking-tight`,children:e}),(0,V.jsx)(`dd`,{className:`mt-0.5 text-[0.84rem] text-faint`,children:t})]})}function Fc(){return(0,V.jsx)(Pr,{children:(0,V.jsxs)(`div`,{className:`relative mx-auto w-full max-w-[1280px] border-x border-edge`,children:[(0,V.jsx)(Nc,{}),(0,V.jsx)(Bc,{}),(0,V.jsx)(Lc,{}),(0,V.jsx)(Rc,{}),(0,V.jsx)(zc,{}),(0,V.jsx)(Hc,{}),(0,V.jsx)(Uc,{}),(0,V.jsx)(Wc,{}),(0,V.jsx)(Gc,{}),(0,V.jsx)(Kc,{}),(0,V.jsx)(qc,{})]})})}function Ic(){return(0,V.jsx)(`hr`,{className:`divider`})}function Lc(){return(0,V.jsx)(`section`,{className:`dot-grid py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:[(0,V.jsx)(`h2`,{className:`mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`The database should be the part you do not run.`}),(0,V.jsx)(`p`,{className:`mb-10 max-w-[46em] text-muted`,children:`Most of the work in shipping a small application is not the application. It is the database underneath it.`}),(0,V.jsx)(`div`,{className:`grid gap-4 md:grid-cols-3`,children:[{title:`Connections are your problem now`,body:`A serverless function has no long-lived process, so every cold start means a new connection. You end up writing a pool, or putting a proxy in front, or paying for a driver that manages sockets for you.`},{title:`Shared databases share risk`,body:`Isolating tenants with row-level policies is powerful, and it works right up until a policy is written one WHERE clause short. It is the most common multi-tenant data leak in the ecosystem.`},{title:`You probably do not need Postgres`,body:`Most applications are a few tables, a few queries, and a few megabytes. What they need is to not think about the database at all — which is exactly what a mature embedded engine is good at.`}].map((e,t)=>(0,V.jsxs)(`article`,{className:`surface card-hover p-6`,children:[(0,V.jsx)(`span`,{className:`mb-4 block font-mono text-[0.78rem] font-semibold text-faint`,children:String(t+1).padStart(2,`0`)}),(0,V.jsx)(`h3`,{className:`mb-2 text-[1.02rem] font-semibold tracking-tight`,children:e.title}),(0,V.jsx)(`p`,{className:`text-[0.93rem] leading-relaxed text-muted`,children:e.body})]},e.title))})]})})}function Rc(){return(0,V.jsxs)(`section`,{className:`py-16 sm:py-20`,children:[(0,V.jsx)(Ic,{}),(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6 pt-16 sm:pt-20`,children:[(0,V.jsx)(`h2`,{className:`mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`Three steps, then it is yours.`}),(0,V.jsx)(`p`,{className:`mb-10 max-w-[46em] text-muted`,children:`There is no migration to write, no client library to install, and no connection to keep alive.`}),(0,V.jsx)(`ol`,{className:`steps-rail grid gap-4 md:grid-cols-3`,children:Dc.map((e,t)=>(0,V.jsxs)(`li`,{className:`surface card-hover p-6`,children:[(0,V.jsx)(`span`,{className:`step-marker mb-4`,children:t+1}),(0,V.jsx)(`h3`,{className:`mb-2 text-[1.02rem] font-semibold tracking-tight`,children:e.title}),(0,V.jsx)(`p`,{className:`text-[0.93rem] leading-relaxed text-muted`,children:e.body})]},e.title))})]})]})}function zc(){return(0,V.jsx)(`section`,{className:`section-glow border-y border-edge bg-background-alt py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:[(0,V.jsxs)(`div`,{className:`mb-9 text-center`,children:[(0,V.jsx)(`p`,{className:`mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`The integration`}),(0,V.jsx)(`h2`,{className:`mb-3 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`That is the entire integration.`}),(0,V.jsx)(`p`,{className:`mx-auto max-w-[46em] text-muted`,children:`A URL and a key. No SDK, no ORM, no connection string. Copy the request and paste it into your own project.`})]}),(0,V.jsx)(Tc,{})]})})}function Bc(){let e=jc.slice(0,8),t=jc.slice(8);return(0,V.jsxs)(`section`,{className:`py-16 sm:py-20`,children:[(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:[(0,V.jsx)(`p`,{className:`mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`Works with your stack`}),(0,V.jsx)(`h2`,{className:`mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`If it speaks HTTP, it speaks Moogo.`}),(0,V.jsx)(`p`,{className:`mb-10 max-w-[46em] text-muted`,children:`Each logo opens a setup-to-usage guide for SQLite and bucket storage in that language or framework.`})]}),(0,V.jsx)(`div`,{className:`stack-marquee`,"aria-label":`Supported stacks, row one`,children:(0,V.jsx)(`div`,{className:`stack-track stack-track-right`,children:[,,,].fill(e).flat().map((e,t)=>(0,V.jsx)(Vc,{stack:e},`${e.name}-top-${t}`))})}),(0,V.jsx)(`div`,{className:`stack-marquee`,"aria-label":`Supported stacks, row two`,children:(0,V.jsx)(`div`,{className:`stack-track stack-track-left`,children:[,,,].fill(t).flat().map((e,t)=>(0,V.jsx)(Vc,{stack:e},`${e.name}-bottom-${t}`))})}),(0,V.jsx)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:(0,V.jsxs)(`p`,{className:`mt-8 text-center text-[0.9rem] text-muted`,children:[`Stack guides:`,` `,jc.map((e,t)=>(0,V.jsxs)(`span`,{children:[t>0&&` · `,(0,V.jsx)(B,{to:`/docs/${e.doc}`,className:`text-accent-strong hover:underline`,children:e.name})]},e.name))]})})]})}function Vc({stack:e}){return(0,V.jsx)(B,{to:`/docs/${e.doc}`,title:`${e.name} guide`,"aria-label":`${e.name} guide`,className:`stack-logo`,children:(0,V.jsx)(`img`,{src:`${Mc}/${e.icon}.svg`,alt:`${e.name} logo`,loading:`lazy`,width:36,height:36})})}function Hc(){return(0,V.jsx)(`section`,{id:`features`,className:`dot-grid py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:[(0,V.jsx)(`h2`,{className:`mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`What you actually get`}),(0,V.jsx)(`p`,{className:`mb-10 max-w-[46em] text-muted`,children:`Three things, described plainly. Everything below works today, not on the roadmap.`}),(0,V.jsx)(`div`,{className:`grid gap-8 lg:grid-cols-3`,children:Ec.map(e=>(0,V.jsxs)(`div`,{children:[(0,V.jsxs)(`div`,{className:`mb-4 flex items-center gap-2.5 border-b border-edge pb-3`,children:[(0,V.jsx)(`span`,{"aria-hidden":`true`,className:`h-1.5 w-1.5 rounded-full ${e.accent?`bg-accent-strong`:`bg-edge-strong`}`}),(0,V.jsx)(`h3`,{className:`text-[0.76rem] font-semibold uppercase tracking-[0.13em] ${e.accent?`text-accent-strong`:`text-muted`}`,children:e.label})]}),(0,V.jsx)(`ul`,{className:`flex flex-col gap-3`,children:e.items.map(e=>(0,V.jsxs)(`li`,{className:`surface card-hover p-5`,children:[(0,V.jsx)(`h4`,{className:`mb-1.5 text-[0.98rem] font-semibold tracking-tight`,children:e.title}),(0,V.jsx)(`p`,{className:`text-[0.91rem] leading-relaxed text-muted`,children:e.body})]},e.title))})]},e.label))})]})})}function Uc(){return(0,V.jsx)(`section`,{className:`border-y border-edge bg-background-alt py-16 sm:py-20`,children:(0,V.jsx)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:(0,V.jsxs)(`div`,{className:`grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-14`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`p`,{className:`mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`Dashboard`}),(0,V.jsx)(`h2`,{className:`mb-3 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`A studio that never asks for your key`}),(0,V.jsx)(`p`,{className:`mb-5 text-muted`,children:`The dashboard browses your data as a spreadsheet, builds tables, runs SQL, and keeps an audit trail — without your secret key ever entering the browser.`}),(0,V.jsx)(`p`,{className:`mb-7 text-[0.93rem] leading-relaxed text-muted`,children:`That is deliberate. A key in a browser leaks through devtools, a screenshot or an extension, and once it is out there you cannot know how many copies exist. So the dashboard authorises with your session instead, and runs the same validation your application does.`}),(0,V.jsxs)(B,{to:`/docs/dashboard`,className:`inline-flex items-center gap-1.5 font-semibold text-accent-strong transition-colors hover:text-accent`,children:[`Tour the dashboard`,(0,V.jsx)(`span`,{"aria-hidden":`true`,children:`→`})]})]}),(0,V.jsx)(`ul`,{className:`grid gap-3 sm:grid-cols-2`,children:Oc.map((e,t)=>(0,V.jsxs)(`li`,{className:`surface card-hover p-5`,children:[(0,V.jsx)(`span`,{className:`icon-tile mb-3.5`,children:(0,V.jsx)(`svg`,{viewBox:`0 0 20 20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.7`,"aria-hidden":`true`,children:t===0?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`rect`,{x:`3`,y:`3.5`,width:`14`,height:`13`,rx:`2`}),(0,V.jsx)(`path`,{d:`M3 8h14M8 8v8.5`,strokeLinecap:`round`})]}):t===1?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`rect`,{x:`3`,y:`4`,width:`14`,height:`12`,rx:`2`}),(0,V.jsx)(`path`,{d:`m6.5 10 2 2 4-4.5`,strokeLinecap:`round`,strokeLinejoin:`round`})]}):t===2?(0,V.jsx)(V.Fragment,{children:(0,V.jsx)(`path`,{d:`m7 6-3.5 4L7 14M13 6l3.5 4L13 14`,strokeLinecap:`round`,strokeLinejoin:`round`})}):t===3?(0,V.jsx)(V.Fragment,{children:(0,V.jsx)(`path`,{d:`M4 14.5h12M4 10.5h12M4 6.5h7`,strokeLinecap:`round`})}):t===4?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`path`,{d:`M10 3.5v9`,strokeLinecap:`round`}),(0,V.jsx)(`path`,{d:`M7 9.5v2.5a3 3 0 0 0 6 0V9.5`,strokeLinecap:`round`}),(0,V.jsx)(`path`,{d:`M6.5 15.5h7`,strokeLinecap:`round`})]}):(0,V.jsx)(`path`,{d:`M15.5 10a5.5 5.5 0 1 1-1.9-4.2M15.5 3.5V7H12`,strokeLinecap:`round`,strokeLinejoin:`round`})})}),(0,V.jsx)(`h3`,{className:`mb-1 text-[0.95rem] font-semibold tracking-tight`,children:e.title}),(0,V.jsx)(`p`,{className:`text-[0.89rem] leading-relaxed text-muted`,children:e.body})]},e.title))})]})})})}function Wc(){return(0,V.jsx)(`section`,{id:`security`,className:`border-y border-edge bg-background-alt py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[760px] px-6`,children:[(0,V.jsx)(`p`,{className:`mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`Security`}),(0,V.jsx)(`h2`,{className:`mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`Assume the stranger has your key`}),(0,V.jsx)(`p`,{className:`mb-9 text-muted`,children:`That is the threat model. These are the properties that hold when they do.`}),(0,V.jsx)(`ul`,{className:`border-t border-edge`,children:kc.map(e=>(0,V.jsxs)(`li`,{className:`relative border-b border-edge py-4 pl-8.5 text-muted transition-colors hover:bg-background`,children:[(0,V.jsx)(`span`,{"aria-hidden":`true`,className:`absolute top-[1.4rem] left-1 h-2 w-2 rounded-sm bg-accent-strong`}),(0,V.jsx)(`strong`,{className:`text-foreground`,children:e.lead}),` `,e.body]},e.lead))}),(0,V.jsxs)(`p`,{className:`mt-6 text-[0.9rem] text-faint`,children:[`What this model does not cover is documented too:`,` `,(0,V.jsx)(B,{to:`/docs/security`,className:`text-accent-strong hover:underline`,children:`the security page`}),` `,`has a section on it, because a list of strengths is not a threat model.`]})]})})}function Gc(){return(0,V.jsx)(`section`,{id:`pricing`,className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[560px] px-6`,children:[(0,V.jsx)(`p`,{className:`mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`Pricing`}),(0,V.jsx)(`h2`,{className:`mb-2 text-center text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`Free, and it stays free`}),(0,V.jsx)(`p`,{className:`mb-8 text-center text-muted`,children:`One plan. No card, no trial that expires, no feature held back.`}),(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-8`,children:[(0,V.jsxs)(`div`,{className:`mb-6 flex items-baseline justify-between border-b border-edge pb-6`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`p`,{className:`text-[0.8rem] font-semibold uppercase tracking-[0.11em] text-accent-strong`,children:`Free`}),(0,V.jsx)(`p`,{className:`mt-1 text-[2.6rem] font-semibold tracking-tight`,children:`$0`})]}),(0,V.jsxs)(`p`,{className:`text-right text-[0.86rem] leading-snug text-faint`,children:[`Forever, for as long`,(0,V.jsx)(`br`,{}),`as it is in use`]})]}),(0,V.jsx)(`ul`,{className:`mb-8 flex flex-col gap-2.5`,children:[`2 projects, 100 MB of SQLite each`,`256 MB of object storage per project`,`The full dashboard and SQL console`,`No idle pause and no cold start`].map(e=>(0,V.jsxs)(`li`,{className:`flex items-start gap-2.5 text-[0.93rem] text-muted`,children:[(0,V.jsx)(`svg`,{viewBox:`0 0 20 20`,"aria-hidden":`true`,className:`mt-1 h-3.5 w-3.5 flex-none stroke-accent-strong`,fill:`none`,strokeWidth:`2.2`,children:(0,V.jsx)(`path`,{d:`m4 10.5 4 4 8-9`,strokeLinecap:`round`,strokeLinejoin:`round`})}),e]},e))}),(0,V.jsx)(B,{to:`/register`,className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Create an account`}),(0,V.jsxs)(`p`,{className:`mt-4 text-center text-[0.85rem] text-faint`,children:[`Already have one?`,` `,(0,V.jsx)(B,{to:`/login`,className:`text-accent-strong hover:underline`,children:`Sign in`})]})]})]})})}function Kc(){return(0,V.jsx)(`section`,{id:`faq`,className:`border-t border-edge py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[760px] px-6`,children:[(0,V.jsx)(`p`,{className:`mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`FAQ`}),(0,V.jsx)(`h2`,{className:`mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`Questions worth asking first`}),(0,V.jsx)(`p`,{className:`mb-9 text-muted`,children:`The ones that come up before anyone hands over their data.`}),(0,V.jsx)(`div`,{className:`flex flex-col gap-3`,children:Ac.map(e=>(0,V.jsxs)(`details`,{className:`faq-item surface card-hover px-5 py-4`,children:[(0,V.jsxs)(`summary`,{className:`flex items-start font-semibold tracking-tight`,children:[(0,V.jsx)(`span`,{className:`faq-chevron`,"aria-hidden":`true`}),e.q]}),(0,V.jsx)(`p`,{className:`faq-answer text-[0.93rem] leading-relaxed text-muted`,children:e.a})]},e.q))})]})})}function qc(){return(0,V.jsx)(`section`,{className:`closing-glow border-t border-edge py-24 text-center`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:[(0,V.jsx)(`h2`,{className:`mb-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-semibold tracking-tight`,children:`Ship the thing that uses the data.`}),(0,V.jsx)(`p`,{className:`mb-8 text-lg text-muted`,children:`Not the database.`}),(0,V.jsxs)(`div`,{className:`flex flex-wrap justify-center gap-3`,children:[(0,V.jsx)(B,{to:`/register`,className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Create a project`}),(0,V.jsx)(B,{to:`/docs/quickstart`,className:`inline-flex items-center justify-center rounded-lg border border-edge-strong px-5 py-3 font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Read the docs`})]})]})})}function Jc(){return(0,V.jsxs)(`svg`,{viewBox:`0 0 24 24`,"aria-hidden":`true`,className:`h-4 w-4 flex-none fill-white`,children:[(0,V.jsx)(`path`,{d:`M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.1 14.7 2 12 2 6.9 2 2.8 6.2 2.8 11.3S6.9 20.6 12 20.6c5.6 0 9.3-3.9 9.3-9.4 0-.6-.07-1.1-.2-1.6H12z`}),(0,V.jsx)(`path`,{d:`M5.3 12c0-.7.12-1.4.3-2H2.6A12.9 12.9 0 0 0 2 12c0 1.9.45 3.7 1.25 5.3l3.35-2.6c-.2-.65-.3-1.35-.3-2.1z`}),(0,V.jsx)(`path`,{d:`M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.2v2.6A12 12 0 0 0 12 22z`}),(0,V.jsx)(`path`,{d:`M6.4 14.1A7.2 7.2 0 0 1 6.1 12c0-.7.12-1.4.3-2L3.15 7.3A9.9 9.9 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l3.3-2.3z`})]})}function Yc({configured:e}){return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsxs)(`a`,{href:e?`/auth/google`:`/auth/setup`,className:`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-strong px-5 py-3 font-semibold text-white transition-colors hover:bg-accent`,children:[(0,V.jsx)(Jc,{}),`Continue with Google`]}),!e&&(0,V.jsx)(`p`,{className:`mt-2 text-center text-[0.82rem] text-faint`,children:`Google sign-in is not enabled on this deployment yet.`})]})}function Xc({id:e,value:t,onChange:n,name:r,autoComplete:i,placeholder:a}){let[o,s]=(0,h.useState)(!1);return(0,V.jsxs)(`div`,{className:`relative`,children:[(0,V.jsx)(`input`,{id:e,type:o?`text`:`password`,name:r,autoComplete:i,value:t,onChange:e=>n(e.target.value),placeholder:a,className:`w-full rounded-lg border border-edge bg-background px-4 py-2.5 pr-11 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>s(e=>!e),"aria-label":o?`Hide password`:`Show password`,"aria-pressed":o,className:`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:text-foreground`,children:o?(0,V.jsx)(Qc,{}):(0,V.jsx)(Zc,{})})]})}function Zc(){return(0,V.jsxs)(`svg`,{width:`18`,height:`18`,viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,V.jsx)(`path`,{d:`M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z`}),(0,V.jsx)(`circle`,{cx:`12`,cy:`12`,r:`3`})]})}function Qc(){return(0,V.jsxs)(`svg`,{width:`18`,height:`18`,viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,V.jsx)(`path`,{d:`M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24`}),(0,V.jsx)(`line`,{x1:`1`,y1:`1`,x2:`23`,y2:`23`})]})}var $c={denied:`Google sign-in was cancelled. Nothing was changed.`,invalid_request:`Google sent an incomplete response. Please try again.`,failed:`Sign-in could not be completed. Please try again.`};function el(){let[e]=On(),t=Nr(),n=t.status===`loading`,r=t.status===`unknown`,i=t.oauthConfigured,[a,o]=(0,h.useState)(``),[s,c]=(0,h.useState)(``),[l,u]=(0,h.useState)(!1),[d,f]=(0,h.useState)(null),[p,m]=(0,h.useState)(!1),[g,_]=(0,h.useState)(!1),v=e.get(`error`),y=v?$c[v]??$c.failed:null,b=p?null:y??d??(r?`Cannot reach the server. Check that it is running, then try again.`:null);(0,h.useEffect)(()=>{t.status===`authenticated`&&window.location.assign(Hn()+`/app`)},[t.status]);async function x(e){if(e.preventDefault(),!a.trim()||!s){f(`Enter your email and password.`);return}u(!0),f(null);try{await U.login(a.trim(),s),window.location.assign(Hn()+`/app`)}catch(e){if(e instanceof ar&&e.code===`email_not_verified`){m(!0);return}f(e instanceof ar?e.message:`Could not sign in. Please try again.`)}finally{u(!1)}}async function S(){_(!0);try{await U.resendVerification(a.trim())}catch{}finally{_(!1)}}return n?(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsx)(`div`,{className:`mx-auto w-full max-w-[720px] px-6 text-center`,children:(0,V.jsxs)(`div`,{className:`inline-flex items-center justify-center gap-2 text-muted`,children:[(0,V.jsx)(tl,{}),(0,V.jsx)(`span`,{children:`Checking session…`})]})})})}):(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[440px] px-6`,children:[(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6 sm:p-8`,children:[(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:p?`Confirm your email`:`Sign in`}),(0,V.jsx)(`p`,{className:`mb-6 text-muted`,children:p?`Your password was right, but this address has not been confirmed yet.`:`Use Google, or sign in with your email and password.`}),p&&(0,V.jsxs)(`div`,{className:`rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber`,children:[`We sent a confirmation link to`,` `,(0,V.jsx)(`strong`,{children:a.trim()}),`. Follow it and you can sign in.`]}),b&&(0,V.jsx)(`div`,{role:`alert`,className:`mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber`,children:b}),!p&&(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(Yc,{configured:i}),(0,V.jsxs)(`div`,{className:`relative my-6`,children:[(0,V.jsx)(`div`,{className:`absolute inset-0 flex items-center`,children:(0,V.jsx)(`span`,{className:`w-full border-t border-edge`})}),(0,V.jsx)(`div`,{className:`relative flex justify-center text-xs`,children:(0,V.jsx)(`span`,{className:`bg-background px-2 text-faint`,children:`or`})})]})]}),p?(0,V.jsxs)(`div`,{className:`mt-6 space-y-4`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:S,disabled:g,className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:g?`Sending…`:`Send a new link`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>{m(!1),f(null)},className:`inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-edge-strong px-5 py-3 font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Use a different account`})]}):(0,V.jsxs)(`form`,{onSubmit:x,className:`space-y-4`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:`email`,className:`mb-1.5 block text-sm font-medium text-muted`,children:`Email`}),(0,V.jsx)(`input`,{type:`email`,id:`email`,name:`email`,autoComplete:`email`,value:a,onChange:e=>o(e.target.value),className:`w-full rounded-lg border border-edge bg-background px-4 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20`,placeholder:`you@example.com`})]}),(0,V.jsxs)(`div`,{children:[(0,V.jsxs)(`div`,{className:`mb-1.5 flex items-center justify-between`,children:[(0,V.jsx)(`label`,{htmlFor:`password`,className:`text-sm font-medium text-muted`,children:`Password`}),(0,V.jsx)(B,{to:`/forgot-password`,className:`text-[0.82rem] text-accent hover:text-accent-strong`,children:`Forgot password?`})]}),(0,V.jsx)(Xc,{id:`password`,name:`password`,autoComplete:`current-password`,value:s,onChange:c,placeholder:`••••••••`})]}),(0,V.jsx)(`button`,{type:`submit`,disabled:l,className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:l?`Signing in…`:`Sign in`})]}),(0,V.jsxs)(`p`,{className:`mt-6 text-center text-[0.9rem] text-muted`,children:[`Don't have an account?`,` `,(0,V.jsx)(B,{to:`/register`,className:`text-accent hover:text-accent-strong`,children:`Create one`})]})]}),(0,V.jsx)(`p`,{className:`mt-6 text-center`,children:(0,V.jsx)(Gn,{className:`text-[0.9rem] text-faint hover:text-foreground`,children:`← Back to the landing page`})})]})})})}function tl(){return(0,V.jsxs)(`svg`,{className:`animate-spin h-6 w-6 text-accent-strong`,xmlns:`http://www.w3.org/2000/svg`,fill:`none`,viewBox:`0 0 24 24`,"aria-hidden":`true`,children:[(0,V.jsx)(`circle`,{className:`opacity-25`,cx:`12`,cy:`12`,r:`10`,stroke:`currentColor`,strokeWidth:`4`}),(0,V.jsx)(`path`,{className:`opacity-75`,fill:`currentColor`,d:`M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z`})]})}function nl(){return(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-24 text-center`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[720px] px-6`,children:[(0,V.jsx)(`p`,{className:`mb-3 font-mono text-[0.85rem] tracking-[0.2em] text-faint`,children:`404`}),(0,V.jsx)(`h1`,{className:`mb-3 text-[clamp(1.8rem,3.4vw,2.4rem)] font-semibold tracking-tight`,children:`That page does not exist.`}),(0,V.jsx)(`p`,{className:`mb-7 text-muted`,children:`The link may be old, or the address may have a typo.`}),(0,V.jsx)(Gn,{className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Back to the landing page`})]})})})}function rl(){let e=st(),[t,n]=(0,h.useState)(!0),[r,i]=(0,h.useState)(!1);return(0,h.useEffect)(()=>{let e=!1;return U.oauthSetup().then(t=>{e||(i(t.configured),n(!1))}).catch(()=>{e||(i(!1),n(!1))}),()=>{e=!0}},[]),(0,h.useEffect)(()=>{!t&&r&&e(`/login`,{replace:!0})},[t,r,e]),t?(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsx)(`div`,{className:`mx-auto w-full max-w-[720px] px-6 text-center`,children:(0,V.jsxs)(`div`,{className:`inline-flex items-center justify-center gap-2 text-muted`,children:[(0,V.jsxs)(`svg`,{className:`animate-spin h-6 w-6 text-accent-strong`,xmlns:`http://www.w3.org/2000/svg`,fill:`none`,viewBox:`0 0 24 24`,children:[(0,V.jsx)(`circle`,{className:`opacity-25`,cx:`12`,cy:`12`,r:`10`,stroke:`currentColor`,strokeWidth:`4`}),(0,V.jsx)(`path`,{className:`opacity-75`,fill:`currentColor`,d:`M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z`})]}),(0,V.jsx)(`span`,{children:`Checking OAuth configuration…`})]})})})}):r?null:(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[720px] px-6`,children:[(0,V.jsxs)(`div`,{className:`mb-8 text-center`,children:[(0,V.jsx)(`h1`,{className:`mb-3 text-[clamp(2rem,4vw,2.6rem)] font-semibold tracking-tight`,children:`Google OAuth Not Configured`}),(0,V.jsx)(`p`,{className:`max-w-[46em] mx-auto text-muted`,children:`Moogo requires Google OAuth credentials to sign in. Please configure the following environment variables on the server:`})]}),(0,V.jsxs)(`div`,{className:`surface rounded-xl p-6 space-y-6`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`h3`,{className:`mb-3 text-lg font-semibold`,children:`Required Environment Variables`}),(0,V.jsxs)(`dl`,{className:`space-y-4 font-mono text-sm`,children:[(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-background p-4`,children:[(0,V.jsx)(`dt`,{className:`text-faint`,children:`MOOGO_GOOGLE_CLIENT_ID`}),(0,V.jsx)(`dd`,{className:`mt-1 text-foreground`,children:`Your Google OAuth 2.0 Client ID from the Google Cloud Console.`})]}),(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-background p-4`,children:[(0,V.jsx)(`dt`,{className:`text-faint`,children:`MOOGO_GOOGLE_CLIENT_SECRET`}),(0,V.jsx)(`dd`,{className:`mt-1 text-foreground`,children:`Your Google OAuth 2.0 Client Secret from the Google Cloud Console.`})]})]})]}),(0,V.jsxs)(`div`,{className:`border-t border-edge pt-6`,children:[(0,V.jsx)(`h3`,{className:`mb-3 text-lg font-semibold`,children:`How to Create Credentials`}),(0,V.jsxs)(`ol`,{className:`space-y-3 text-sm text-muted list-decimal list-inside`,children:[(0,V.jsxs)(`li`,{children:[`Go to the `,(0,V.jsx)(`a`,{href:`https://console.cloud.google.com/apis/credentials`,target:`_blank`,rel:`noopener noreferrer`,className:`text-accent-strong hover:underline`,children:`Google Cloud Console → APIs & Services → Credentials`}),`.`]}),(0,V.jsxs)(`li`,{children:[`Click `,(0,V.jsx)(`strong`,{children:`Create Credentials`}),` → `,(0,V.jsx)(`strong`,{children:`OAuth client ID`}),`.`]}),(0,V.jsxs)(`li`,{children:[`Select `,(0,V.jsx)(`strong`,{children:`Web application`}),` as the application type.`]}),(0,V.jsxs)(`li`,{children:[`Under `,(0,V.jsx)(`strong`,{children:`Authorized redirect URIs`}),`, add:`,(0,V.jsx)(`code`,{className:`rounded bg-panel-raised px-1.5 font-mono text-[0.87em] text-accent block mt-1`,children:`${Hn()}/auth/google/callback`})]}),(0,V.jsxs)(`li`,{children:[`Click `,(0,V.jsx)(`strong`,{children:`Create`}),`. Copy the Client ID and Client Secret.`]}),(0,V.jsx)(`li`,{children:`Set them as environment variables on your server and restart Moogo.`})]})]}),(0,V.jsxs)(`div`,{className:`border-t border-edge pt-6`,children:[(0,V.jsx)(`h3`,{className:`mb-3 text-lg font-semibold`,children:`Other Required Variables`}),(0,V.jsxs)(`dl`,{className:`space-y-2 font-mono text-sm`,children:[(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-background p-3 flex justify-between`,children:[(0,V.jsx)(`dt`,{className:`text-faint`,children:`MOOGO_SESSION_SECRET`}),(0,V.jsxs)(`dd`,{className:`text-foreground`,children:[`A random string (min 32 chars) for signing session cookies.`,(0,V.jsx)(`br`,{}),(0,V.jsx)(`code`,{className:`text-[0.8em] text-muted`,children:`openssl rand -base64 32`})]})]}),(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-background p-3 flex justify-between`,children:[(0,V.jsx)(`dt`,{className:`text-faint`,children:`MOOGO_DATABASE_URL`}),(0,V.jsx)(`dd`,{className:`text-foreground`,children:`PostgreSQL connection string for the control plane.`})]})]})]}),(0,V.jsx)(`p`,{className:`mt-6 text-sm text-faint`,children:`After setting all variables, restart the server. This page will automatically redirect to the sign-in page.`})]})]})})})}function il(e){return e*10}function al(e,t){return t===`yearly`?il(e.monthlyPrice):e.monthlyPrice}var ol=[{id:`free`,name:`Free`,monthlyPrice:0,tagline:`Everything Moogo does, with no card and no expiry.`,quotas:[{label:`Projects`,value:`2`},{label:`SQLite per project`,value:`100 MB`},{label:`Object storage per project`,value:`256 MB`}],features:[`The full dashboard, SQL console and bucket browser`,`No idle pause and no cold start`,`Backups from the dashboard`,`No credit card, ever`],available:!0},{id:`startup`,name:`Startup`,monthlyPrice:5,tagline:`For the first version of something with real users.`,quotas:[{label:`Projects`,value:`5`},{label:`SQLite per project`,value:`1 GB`},{label:`Object storage per project`,value:`2 GB`}],features:[`Everything in Free`,`Room for a staging project alongside production`,`Larger files and bigger databases`],available:!1,unavailableNote:`Not available yet — no billing is connected.`},{id:`pro`,name:`Pro`,monthlyPrice:10,tagline:`For a product where the database is the product.`,quotas:[{label:`Projects`,value:`10`},{label:`SQLite per project`,value:`2 GB`},{label:`Object storage per project`,value:`5 GB`}],features:[`Everything in Startup`,`Databases large enough to hold a real content catalog`,`Storage measured in gigabytes, not megabytes`],available:!1,unavailableNote:`Not available yet — no billing is connected.`}];function sl(){let e=Nr().status===`authenticated`,[t,n]=(0,h.useState)(`monthly`);return(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[1120px] px-6`,children:[(0,V.jsx)(`p`,{className:`mb-3 text-center text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong`,children:`Pricing`}),(0,V.jsx)(`h1`,{className:`mb-3 text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tight`,children:`Free is the whole product`}),(0,V.jsx)(`p`,{className:`mx-auto mb-9 max-w-[46em] text-center text-muted`,children:`One plan you can use today, and two that are not ready yet. The numbers on every card are the quotas the server actually enforces, so what you read here is what you will hit.`}),(0,V.jsx)(`div`,{className:`mb-9 flex justify-center`,children:(0,V.jsx)(cl,{period:t,onChange:n})}),(0,V.jsx)(`div`,{className:`grid gap-5 lg:grid-cols-3`,children:ol.map(n=>(0,V.jsx)(ll,{plan:n,period:t,signedIn:e},n.id))}),(0,V.jsxs)(`p`,{className:`mt-10 text-center text-[0.9rem] text-faint`,children:[`Quotas are per project and are enforced before the work commits.`,` `,(0,V.jsx)(B,{to:`/docs/limits`,className:`text-accent-strong hover:underline`,children:`How the limits are enforced`}),`.`]})]})})})}function cl({period:e,onChange:t}){return(0,V.jsx)(`div`,{role:`group`,"aria-label":`Billing period`,className:`inline-flex items-center gap-1 rounded-lg border border-edge-strong p-1`,children:[{id:`monthly`,label:`Monthly`},{id:`yearly`,label:`Yearly`,note:`2 months free`}].map(n=>{let r=n.id===e;return(0,V.jsxs)(`button`,{type:`button`,onClick:()=>t(n.id),"aria-pressed":r,className:`cursor-pointer rounded-md px-4 py-2 text-[0.88rem] font-semibold transition-colors ${r?`bg-accent-strong text-accent-ink`:`text-muted hover:text-foreground`}`,children:[n.label,n.note&&(0,V.jsx)(`span`,{className:`ml-2 text-[0.75rem] font-normal ${r?`text-accent-ink/80`:`text-faint`}`,children:n.note})]},n.id)})})}function ll({plan:e,period:t,signedIn:n}){let r=!e.available,i=al(e,t),a=e.monthlyPrice>0;return(0,V.jsxs)(`div`,{className:`surface flex flex-col rounded-2xl p-6 ${r?`opacity-70`:``}`,children:[(0,V.jsxs)(`div`,{className:`mb-5 border-b border-edge pb-5`,children:[(0,V.jsxs)(`div`,{className:`flex items-center justify-between gap-3`,children:[(0,V.jsx)(`p`,{className:`text-[0.8rem] font-semibold uppercase tracking-[0.11em] text-accent-strong`,children:e.name}),e.available?(0,V.jsx)(`span`,{className:`rounded-full border border-accent/40 px-2 py-0.5 text-[0.7rem] font-semibold text-accent-strong`,children:`Available`}):(0,V.jsx)(`span`,{className:`rounded-full border border-edge-strong px-2 py-0.5 text-[0.7rem] font-semibold text-faint`,children:`Coming soon`})]}),(0,V.jsxs)(`p`,{className:`mt-2 text-[2.4rem] font-semibold tracking-tight`,children:[`$`,i,a&&(0,V.jsx)(`span`,{className:`ml-1 align-middle text-[0.95rem] font-normal text-muted`,children:t===`yearly`?`/year`:`/month`})]}),(0,V.jsx)(`p`,{className:`mt-2 text-[0.9rem] leading-relaxed text-muted`,children:a?t===`yearly`?`Billed once a year. 2 months free, which is ${2*e.monthlyPrice} less than twelve monthly payments.`:`Billed monthly. Switch to yearly for 2 months free.`:e.tagline})]}),(0,V.jsx)(`dl`,{className:`mb-6 flex flex-col gap-3`,children:e.quotas.map(e=>(0,V.jsxs)(`div`,{className:`flex items-baseline justify-between gap-3 border-b border-edge pb-3 last:border-0 last:pb-0`,children:[(0,V.jsx)(`dt`,{className:`text-[0.88rem] text-muted`,children:e.label}),(0,V.jsx)(`dd`,{className:`text-[0.95rem] font-semibold text-foreground`,children:e.value})]},e.label))}),(0,V.jsx)(`ul`,{className:`mb-6 flex flex-1 flex-col gap-2.5`,children:e.features.map(e=>(0,V.jsxs)(`li`,{className:`flex items-start gap-2.5 text-[0.9rem] text-muted`,children:[(0,V.jsx)(`svg`,{viewBox:`0 0 20 20`,"aria-hidden":`true`,className:`mt-1 h-3.5 w-3.5 flex-none stroke-accent-strong`,fill:`none`,strokeWidth:`2.2`,children:(0,V.jsx)(`path`,{d:`m4 10.5 4 4 8-9`,strokeLinecap:`round`,strokeLinejoin:`round`})}),e]},e))}),e.available?n?(0,V.jsx)(Or,{className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Open dashboard`}):(0,V.jsx)(B,{to:`/register`,className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Create an account`}):(0,V.jsx)(`button`,{type:`button`,disabled:!0,className:`inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-edge-strong px-5 py-3 font-semibold text-faint`,children:`Not available yet`}),e.unavailableNote&&(0,V.jsx)(`p`,{className:`mt-3 text-center text-[0.82rem] text-faint`,children:e.unavailableNote})]})}function ul(e){let t=[],n=``,r=0,i=()=>{dl(n)&&t.push(n.trim()),n=``};for(;r<e.length;){let t=e[r],a=e[r+1];if(t===`-`&&a===`-`){let t=e.indexOf(`
`,r),i=t===-1?e.length:t;n+=e.slice(r,i),r=i;continue}if(t===`/`&&a===`*`){let t=e.indexOf(`*/`,r+2),i=t===-1?e.length:t+2;n+=e.slice(r,i),r=i;continue}if(t===`'`||t===`"`||t==="`"){let i=r+1;for(;i<e.length;){if(e[i]===t){if(e[i+1]===t){i+=2;continue}i+=1;break}i+=1}n+=e.slice(r,i),r=i;continue}if(t===`;`){i(),r+=1;continue}n+=t,r+=1}return i(),t}function dl(e){let t=0;for(;t<e.length;){let n=e[t];if(n===`-`&&e[t+1]===`-`){let n=e.indexOf(`
`,t);t=n===-1?e.length:n+1;continue}if(n===`/`&&e[t+1]===`*`){let n=e.indexOf(`*/`,t+2);t=n===-1?e.length:n+2;continue}if(/\S/.test(n))return!0;t+=1}return!1}var fl=[{id:`create-table`,title:`Create a table`,category:`Schema`,description:`A new table with an auto-incrementing primary key.`,sql:`CREATE TABLE "jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL
);`},{id:`relation`,title:`Two tables, one relation`,category:`Schema`,description:`A child table pointing at its parent — runs as two statements.`,sql:`-- Table parent
CREATE TABLE "jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL
);

-- Table child (one-to-many to jobs)
CREATE TABLE "jobdesks" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "job_id" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE
);`},{id:`select`,title:`Query rows`,category:`Read`,description:`Filter, order and cap the result set.`,sql:`SELECT id, title, company
FROM jobs
WHERE company LIKE '% Ltd%'
ORDER BY id DESC
LIMIT 20;`},{id:`join`,title:`Join two tables`,category:`Read`,description:`Parent rows with their children, one row per relation.`,sql:`SELECT jobs.title, jobdesks.description
FROM jobs
JOIN jobdesks ON jobdesks.job_id = jobs.id
ORDER BY jobs.id;`},{id:`insert`,title:`Insert rows`,category:`Write`,description:`Several rows in one statement.`,sql:`INSERT INTO jobs (title, company) VALUES
  ('Backend Engineer', 'Acme'),
  ('Data Analyst', 'Globex'),
  ('Site Reliability Engineer', 'Initech');`},{id:`update`,title:`Update rows`,category:`Write`,description:`Change the rows a WHERE clause selects.`,sql:`UPDATE jobs
SET company = 'Initech'
WHERE company = 'Globex';`},{id:`delete`,title:`Delete rows`,category:`Write`,description:`Remove matching rows; the child table's ON DELETE CASCADE follows.`,sql:`DELETE FROM jobs
WHERE id = 1;`},{id:`alter`,title:`Add a column`,category:`Schema`,description:`Extend an existing table without recreating it.`,sql:`ALTER TABLE jobs
ADD COLUMN location TEXT DEFAULT 'Remote';`},{id:`index`,title:`Index a column`,category:`Schema`,description:`Keep WHERE and JOIN fast as the table grows.`,sql:`CREATE INDEX idx_jobs_company
ON jobs (company);`},{id:`inspect`,title:`Inspect the schema`,category:`Inspect`,description:`Column definitions and every table SQLite holds.`,sql:`PRAGMA table_info(jobs);

SELECT name, sql
FROM sqlite_master
WHERE type = 'table';`}];function pl({onClose:e,title:t,description:n,size:r=`md`,children:i,actions:a}){let o=(0,h.useRef)(null);return(0,h.useEffect)(()=>{function t(t){t.key===`Escape`&&e()}document.addEventListener(`keydown`,t);let n=document.body.style.overflow;return document.body.style.overflow=`hidden`,o.current?.focus(),()=>{document.removeEventListener(`keydown`,t),document.body.style.overflow=n}},[e]),(0,V.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm`,onClick:e,children:(0,V.jsxs)(`div`,{ref:o,role:`dialog`,"aria-modal":`true`,"aria-label":t,tabIndex:-1,onClick:e=>e.stopPropagation(),className:`my-4 w-full ${ml[r]} surface-raised outline-none`,children:[(0,V.jsxs)(`div`,{className:`border-b border-edge px-5 py-4`,children:[(0,V.jsx)(`h2`,{className:`text-lg font-semibold text-foreground`,children:t}),n?(0,V.jsx)(`div`,{className:`mt-1 text-sm text-muted`,children:n}):null]}),i?(0,V.jsx)(`div`,{className:`px-5 py-4`,children:i}):null,a?(0,V.jsx)(`div`,{className:`flex justify-end gap-2 border-t border-edge px-5 py-4`,children:a}):null]})})}var ml={sm:`max-w-sm`,md:`max-w-lg`,lg:`max-w-2xl`,xl:`max-w-3xl`,full:`max-w-5xl`};function hl({open:e,title:t,description:n,detail:r,confirmLabel:i=`Confirm`,tone:a=`danger`,busy:o=!1,onConfirm:s,onCancel:c}){return e?(0,V.jsx)(pl,{onClose:c,title:t,size:`sm`,actions:(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`button`,{type:`button`,onClick:c,disabled:o,className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:opacity-50`,children:`Cancel`}),(0,V.jsx)(`button`,{type:`button`,onClick:s,disabled:o,className:`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${a===`danger`?`bg-red`:`bg-accent-strong`}`,children:o?`Working…`:i})]}),children:(0,V.jsxs)(`div`,{className:`space-y-3`,children:[(0,V.jsx)(`p`,{className:`text-sm text-muted`,children:n}),r?(0,V.jsx)(`p`,{className:`rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-[0.82rem] text-foreground`,children:r}):null]})}):null}function gl({projectId:e,onExecuted:t}){let[n,r]=(0,h.useState)(``),[i,a]=(0,h.useState)({kind:`idle`}),[o,s]=(0,h.useState)(null),c=(0,h.useRef)(null),l=ul(n),u=(0,h.useCallback)(async()=>{let r=ul(n);if(r.length===0)return;a({kind:`running`,step:1,total:r.length});let i=[],o=0,s=!1;for(let t of r){a({kind:`running`,step:o+1,total:r.length}),o+=1;let n=gr(t);try{let r=n?await U.consoleQuery(e,t):await U.consoleExec(e,t);i.push({sql:t,ok:!0,read:n,response:r}),n||(s=!0)}catch(e){e instanceof ar?i.push({sql:t,ok:!1,code:e.code,message:e.message,detail:e.detail||void 0}):i.push({sql:t,ok:!1,code:`network`,message:`Could not reach the database.`});break}}a({kind:`batch`,results:i,skipped:r.length-o}),s&&t?.()},[n,e,t]);function d(e){(e.metaKey||e.ctrlKey)&&e.key===`Enter`&&(e.preventDefault(),u())}let f=e=>{if(n.trim()){s(e);return}p(e)},p=e=>{r(e.sql),a({kind:`idle`}),s(null),c.current?.focus()},m=i.kind===`running`,g=l.length>1?`${l.length} statements · runs in order`:gr(n.trim())?`read · /query`:`write · /exec`;return(0,V.jsxs)(`div`,{children:[(0,V.jsxs)(`div`,{className:`mb-2 flex items-center justify-between gap-3`,children:[(0,V.jsx)(`label`,{htmlFor:`sql`,className:`text-[0.82rem] font-bold uppercase tracking-wider text-faint`,children:`SQL`}),(0,V.jsx)(`span`,{className:`text-[0.78rem] text-faint`,children:g})]}),(0,V.jsx)(`textarea`,{id:`sql`,ref:c,value:n,onChange:e=>r(e.target.value),onKeyDown:d,rows:6,spellCheck:!1,placeholder:`SELECT * FROM users LIMIT 10

-- Several statements at once are fine:
-- each one runs in order, split on ;`,className:`w-full resize-y rounded-lg border border-edge-strong bg-background px-3 py-2.5 font-mono text-[0.88rem] leading-relaxed text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none`}),(0,V.jsxs)(`div`,{className:`mt-2.5 flex items-center gap-2`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>void u(),disabled:m||l.length===0,className:`cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.88rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:m?i.kind===`running`&&i.total>1?`Running ${i.step}/${i.total}…`:`Running…`:l.length>1?`Run ${l.length} statements`:`Run`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>{r(``),a({kind:`idle`}),c.current?.focus()},className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-[0.88rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Clear`}),(0,V.jsxs)(`span`,{className:`ml-auto text-[0.76rem] text-faint`,children:[`Run with `,(0,V.jsx)(`kbd`,{className:`rounded bg-panel-raised px-1.5 py-0.5 font-mono text-[0.72rem]`,children:`⌘/Ctrl + Enter`})]})]}),(0,V.jsx)(`div`,{className:`mt-4`,children:(0,V.jsx)(vl,{outcome:i})}),(0,V.jsxs)(`section`,{className:`mt-8 border-t border-edge pt-5`,children:[(0,V.jsx)(`h2`,{className:`text-[0.82rem] font-bold uppercase tracking-wider text-faint`,children:`Examples`}),(0,V.jsx)(`p`,{className:`mt-1 text-[0.8rem] text-muted`,children:`Click an example to load it into the editor — nothing runs until you press Run.`}),(0,V.jsx)(`div`,{className:`mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3`,children:fl.map(e=>(0,V.jsxs)(`button`,{type:`button`,onClick:()=>f(e),className:`cursor-pointer rounded-lg border border-edge bg-panel p-3 text-left transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:[(0,V.jsxs)(`div`,{className:`flex items-start justify-between gap-2`,children:[(0,V.jsx)(`span`,{className:`text-[0.86rem] font-semibold text-foreground`,children:e.title}),(0,V.jsx)(_l,{category:e.category})]}),(0,V.jsx)(`p`,{className:`mt-0.5 text-[0.76rem] text-muted`,children:e.description}),(0,V.jsx)(`pre`,{className:`mt-2 max-h-36 overflow-auto rounded bg-background px-2.5 py-2 text-left font-mono text-[0.72rem] leading-relaxed text-muted`,children:e.sql})]},e.id))})]}),(0,V.jsx)(hl,{open:o!==null,title:`Replace the SQL in the editor?`,description:`The text currently in the editor will be replaced with this example.`,detail:o?.title,confirmLabel:`Replace`,tone:`accent`,onConfirm:()=>{o&&p(o)},onCancel:()=>s(null)})]})}function _l({category:e}){return(0,V.jsx)(`span`,{className:`shrink-0 rounded bg-panel-raised px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide ${e===`Schema`?`text-blue`:e===`Read`?`text-accent-strong`:e===`Write`?`text-amber`:`text-violet`}`,children:e})}function vl({outcome:e}){switch(e.kind){case`idle`:return(0,V.jsx)(`p`,{className:`py-10 text-center text-[0.88rem] text-faint`,children:`Results appear here.`});case`running`:return(0,V.jsxs)(`p`,{className:`rounded-lg border border-edge bg-panel px-4 py-6 text-center text-[0.88rem] text-muted`,children:[`Running…`,e.total>1&&(0,V.jsxs)(`span`,{className:`ml-1 text-faint`,children:[`statement `,e.step,` of `,e.total]})]});case`batch`:return(0,V.jsx)(yl,{results:e.results,skipped:e.skipped})}}function yl({results:e,skipped:t}){let n=e.filter(e=>e.ok).length,r=e.length-n,i=e.length>1||t>0;return(0,V.jsxs)(`div`,{className:`space-y-4`,children:[i&&(0,V.jsxs)(`div`,{className:`flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.82rem]`,children:[(0,V.jsxs)(`span`,{className:`font-semibold text-accent`,children:[n,` of `,e.length+t,` statement`,e.length+t===1?``:`s`,` succeeded`]}),r>0&&(0,V.jsxs)(`span`,{className:`text-amber`,children:[r,` failed`]}),t>0&&(0,V.jsxs)(`span`,{className:`text-faint`,children:[t,` not run — statements execute one at a time, not in a transaction, so those that succeeded stay applied.`]})]}),e.map((t,n)=>(0,V.jsxs)(`div`,{className:i?`rounded-lg border border-edge bg-panel p-3`:``,children:[i&&(0,V.jsxs)(`div`,{className:`mb-2 flex items-center gap-2`,children:[(0,V.jsx)(`span`,{className:`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${t.ok?`bg-accent/15 text-accent`:`bg-amber/15 text-amber`}`,"aria-hidden":`true`,children:t.ok?`✓`:`✗`}),(0,V.jsx)(`code`,{className:`min-w-0 flex-1 truncate font-mono text-[0.76rem] text-muted`,children:bl(t.sql)}),t.ok&&(0,V.jsxs)(`span`,{className:`shrink-0 text-[0.72rem] text-faint`,children:[t.read?`${t.response.row_count??t.response.rows?.length??0} rows`:`${t.response.rows_affected??0} affected`,typeof t.response.duration_ms==`number`&&` · ${t.response.duration_ms} ms`]})]}),t.ok?t.read?(0,V.jsx)(xl,{response:t.response}):(0,V.jsx)(Sl,{response:t.response}):(0,V.jsxs)(`div`,{role:`alert`,className:`rounded-lg border border-amber/40 bg-amber/10 px-4 py-3`,children:[(0,V.jsx)(`p`,{className:`text-[0.92rem] font-semibold text-amber`,children:t.message}),t.detail&&(0,V.jsx)(`p`,{className:`mt-1 font-mono text-[0.8rem] text-amber/80`,children:t.detail}),i&&(0,V.jsxs)(`p`,{className:`mt-1 text-[0.75rem] text-amber/70`,children:[`Statement `,n+1,` of `,e.length,` failed.`]})]})]},n))]})}function bl(e){let t=e.replace(/\s+/g,` `).trim();return t.length>96?`${t.slice(0,96)}…`:t}function xl({response:e}){let t=e.columns??[],n=e.rows??[];return t.length===0?(0,V.jsx)(`p`,{className:`rounded-lg border border-edge bg-panel px-4 py-3 text-[0.88rem] text-muted`,children:`No columns returned.`}):(0,V.jsxs)(`div`,{children:[(0,V.jsxs)(`div`,{className:`mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-faint`,children:[(0,V.jsxs)(`span`,{children:[e.row_count??n.length,` row`,n.length===1?``:`s`]}),typeof e.duration_ms==`number`&&(0,V.jsxs)(`span`,{children:[e.duration_ms,` ms`]}),e.truncated&&(0,V.jsx)(`span`,{className:`text-amber`,children:`truncated — result cap reached`})]}),(0,V.jsx)(`div`,{className:`overflow-x-auto rounded-lg border border-edge`,children:(0,V.jsxs)(`table`,{className:`w-full border-collapse text-left text-[0.85rem]`,children:[(0,V.jsx)(`thead`,{className:`bg-panel-raised`,children:(0,V.jsx)(`tr`,{children:t.map((e,t)=>(0,V.jsx)(`th`,{scope:`col`,className:`whitespace-nowrap border-b border-edge px-3 py-2 font-semibold text-foreground`,children:e},t))})}),(0,V.jsx)(`tbody`,{children:n.length===0?(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:t.length,className:`px-3 py-4 text-center text-muted`,children:`No rows.`})}):n.map((e,t)=>(0,V.jsx)(`tr`,{className:`odd:bg-panel even:bg-background`,children:e.map((e,t)=>(0,V.jsx)(`td`,{className:`whitespace-nowrap px-3 py-1.5 font-mono text-[0.82rem] text-muted`,children:Cl(e)},t))},t))})]})})]})}function Sl({response:e}){return(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-panel px-4 py-3 text-[0.9rem] text-muted`,children:[(0,V.jsx)(`span`,{className:`font-semibold text-accent`,children:e.rows_affected??0}),` `,`row`,(e.rows_affected??0)===1?``:`s`,` affected`,typeof e.duration_ms==`number`&&(0,V.jsxs)(`span`,{className:`ml-3 text-[0.82rem] text-faint`,children:[e.duration_ms,` ms`]}),typeof e.size_bytes==`number`&&(0,V.jsxs)(`span`,{className:`ml-3 text-[0.82rem] text-faint`,children:[`db `,wl(e.size_bytes)]})]})}function Cl(e){if(e==null)return`NULL`;if(typeof e==`object`)try{return JSON.stringify(e)}catch{return String(e)}return String(e)}function wl(e){return e>=1048576?`${(e/1048576).toFixed(1)} MB`:`${Math.round(e/1024)} KB`}var Tl=[`INTEGER`,`REAL`,`TEXT`,`BLOB`,`NUMERIC`,`BOOLEAN`,`DATE`,`DATETIME`,`VARCHAR(255)`,`DECIMAL(10,5)`];function El(e){return{id:e,name:``,type:`TEXT`,primaryKey:!1,autoIncrement:!1,notNull:!1,defaultValue:``}}function J(e){return`"${e.replace(/"/g,`""`)}"`}var Dl=new Set([`NULL`,`CURRENT_TIMESTAMP`,`CURRENT_DATE`,`CURRENT_TIME`,`TRUE`,`FALSE`]);function Ol(e){let t=e.toUpperCase();return Dl.has(t)?t:/^[+-]?(\d+\.?\d*|\.\d+)$/.test(e)||e.startsWith(`'`)&&e.endsWith(`'`)&&e.length>=2?e:`'${e.replace(/'/g,`''`)}'`}function kl(e){let t=[J(e.name.trim())];e.primaryKey&&e.autoIncrement?t.push(`INTEGER PRIMARY KEY AUTOINCREMENT`):(t.push(e.type),e.primaryKey&&t.push(`PRIMARY KEY`)),e.notNull&&!(e.primaryKey&&e.autoIncrement)&&t.push(`NOT NULL`);let n=e.defaultValue.trim();return n&&t.push(`DEFAULT ${Ol(n)}`),t.join(` `)}function Al(e,t){let n=e.trim();if(!n)return null;let r=t.filter(e=>e.name.trim());if(r.length===0)return null;let i=r.map(kl);return`CREATE TABLE ${J(n)} (\n  ${i.join(`,
  `)}\n);`}function jl(e,t){return t.name.trim()?`ALTER TABLE ${J(e)} ADD COLUMN ${kl({...t,primaryKey:!1,autoIncrement:!1})};`:null}function Ml(e){return`DROP TABLE ${J(e)};`}function Nl(e,t){return t.trim()?`ALTER TABLE ${J(e)} RENAME TO ${J(t.trim())};`:null}function Pl(e,t,n){return n.trim()?`ALTER TABLE ${J(e)} RENAME COLUMN ${J(t)} TO ${J(n.trim())};`:null}function Fl(e,t){return`ALTER TABLE ${J(e)} DROP COLUMN ${J(t)};`}function Il(e,t,n,r){let i=e.trim();if(!i)return null;let a=n.filter(e=>e.trim());return a.length===0?null:`${r?`CREATE UNIQUE INDEX`:`CREATE INDEX`} ${J(i)} ON ${J(t)} (${a.map(e=>J(e.trim())).join(`, `)});`}function Ll(e){return`DROP INDEX ${J(e)};`}function Rl(e){if(!e)return{withoutRowid:!1,strict:!1};let t=e.lastIndexOf(`)`),n=t>=0?e.slice(t):``;return{withoutRowid:/\bWITHOUT\s+ROWID\b/i.test(n),strict:/\bSTRICT\b/i.test(n)}}var zl=`__moogo_name__`,Bl=`__moogo_type__`,Vl=`__moogo_table__`,Hl=`__moogo_sql__`;function Ul(){return`SELECT name AS ${J(zl)}, type AS ${J(Bl)}, tbl_name AS ${J(Vl)}, sql AS ${J(Hl)} FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'view' THEN 1 WHEN 'index' THEN 2 ELSE 3 END, name;`}function Wl(e){return`PRAGMA table_xinfo(${J(e)});`}function Gl(e){return`PRAGMA index_list(${J(e)});`}function Kl(e){return`PRAGMA index_info(${J(e)});`}function ql(e){return`PRAGMA foreign_key_list(${J(e)});`}var Jl=`__moogo_counted__`,Yl=`__moogo_count__`;function Xl(e){return`'${e.replace(/'/g,`''`)}'`}function Zl(e){return e.length===0?null:`${e.map(e=>`SELECT ${Xl(e)} AS ${J(Jl)}, COUNT(*) AS ${J(Yl)} FROM ${J(e)}`).join(` UNION ALL `)};`}function Ql(e,t){let n=t.map(J).join(`, `),r=t.map(()=>`?`).join(`, `);return`INSERT INTO ${J(e)} (${n}) VALUES (${r});`}function $l(e,t,n){let r=t.map(e=>`${J(e)} = ?`).join(`, `);return`UPDATE ${J(e)} SET ${r} WHERE ${J(n)} = ?;`}function eu(e,t){return`DELETE FROM ${J(e)} WHERE ${J(t)} = ?;`}var Y=`__moogo_rowid__`;function tu(e){let t=e.identifyByRowid?`SELECT rowid AS ${J(Y)}, * FROM ${J(e.table)}`:`SELECT * FROM ${J(e.table)}`,n=[];e.sortColumn&&n.push(`ORDER BY ${J(e.sortColumn)} ${e.sortDirection===`desc`?`DESC`:`ASC`}`);let r=`LIMIT ${e.limit}`;return e.offset&&e.offset>0?n.push(`${r} OFFSET ${e.offset}`):n.push(r),`${t} ${n.join(` `)};`}function nu(e){return`SELECT COUNT(*) AS ${J(`__moogo_count__`)} FROM ${J(e)};`}function ru(e,t){if(e===``)return null;let n=t.toUpperCase();if(/INT|REAL|NUMERIC|DECIMAL|DOUBLE|FLOAT|BOOL/.test(n)){let t=Number(e);if(!Number.isNaN(t))return t}return e}function iu({columns:e,onChange:t,allowPrimaryKey:n=!0,showAddRow:r=!0,label:i=`Columns`,compact:a=!1}){let o=a?`border-b border-edge/60 px-2 py-1`:`border-b border-edge/60 px-3 py-2`,s=a?`rounded border border-edge-strong bg-background px-2 py-1 font-mono text-[0.78rem] text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none`:`rounded border border-edge-strong bg-background px-2 py-1.5 font-mono text-[0.8rem] text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none`,c=(0,h.useId)();function l(){let n=e.reduce((e,t)=>Math.max(e,t.id),0)+1;t([...e,El(n)])}function u(n){let r=e.filter(e=>e.id!==n);t(r.length>0?r:[El(Date.now())])}function d(n,r){t(e.map(e=>{if(e.id!==n)return r.primaryKey?{...e,primaryKey:!1,autoIncrement:!1}:e;let t={...e,...r};return t.primaryKey&&t.autoIncrement&&(t.type=`INTEGER`),t.primaryKey||(t.autoIncrement=!1),t}))}return(0,V.jsx)(`div`,{className:`overflow-x-auto rounded-lg border border-edge`,children:(0,V.jsxs)(`table`,{className:`w-full border-collapse text-left text-[0.85rem]`,"aria-label":i,children:[(0,V.jsx)(`thead`,{className:`bg-panel-raised`,children:(0,V.jsxs)(`tr`,{children:[(0,V.jsx)(`th`,{scope:`col`,className:`${o} font-semibold text-foreground`,children:`Name`}),(0,V.jsx)(`th`,{scope:`col`,className:`${o} font-semibold text-foreground`,children:`Type`}),(0,V.jsx)(`th`,{scope:`col`,className:`${o} font-semibold text-foreground`,children:`Default`}),n?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`th`,{scope:`col`,className:`${o} font-semibold text-foreground`,children:`PK`}),(0,V.jsx)(`th`,{scope:`col`,className:`${o} text-center font-semibold text-foreground`,title:`AUTOINCREMENT — only valid on an INTEGER primary key`,children:`AI`})]}):null,(0,V.jsx)(`th`,{scope:`col`,className:`${o} text-center font-semibold text-foreground`,title:`NOT NULL`,children:`NN`}),(0,V.jsx)(`th`,{scope:`col`,className:o})]})}),(0,V.jsxs)(`tbody`,{children:[e.map(e=>(0,V.jsxs)(`tr`,{children:[(0,V.jsx)(`td`,{className:o,children:(0,V.jsx)(`input`,{value:e.name,onChange:t=>d(e.id,{name:t.target.value}),placeholder:`column_name`,spellCheck:!1,"aria-label":`Column name`,className:`${s} w-36`})}),(0,V.jsx)(`td`,{className:o,children:(0,V.jsx)(`select`,{value:e.type,onChange:t=>d(e.id,{type:t.target.value}),disabled:e.primaryKey&&e.autoIncrement,"aria-label":`Type for ${e.name||`new column`}`,className:`${s} w-32 disabled:opacity-50`,children:Tl.map(e=>(0,V.jsx)(`option`,{value:e,children:e},e))})}),(0,V.jsx)(`td`,{className:o,children:(0,V.jsx)(`input`,{value:e.defaultValue,onChange:t=>d(e.id,{defaultValue:t.target.value}),placeholder:`NULL`,spellCheck:!1,"aria-label":`Default for ${e.name||`new column`}`,className:`${s} w-28`})}),n?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`td`,{className:`${o} text-center`,children:(0,V.jsx)(`input`,{type:`radio`,name:c,checked:e.primaryKey,onChange:()=>d(e.id,{primaryKey:!0}),"aria-label":`Make ${e.name||`new column`} the primary key`,className:`cursor-pointer accent-accent-strong`})}),(0,V.jsx)(`td`,{className:`${o} text-center`,children:(0,V.jsx)(`input`,{type:`checkbox`,checked:e.autoIncrement,disabled:!e.primaryKey,onChange:t=>d(e.id,{autoIncrement:t.target.checked}),"aria-label":`Autoincrement ${e.name||`new column`}`,className:`cursor-pointer accent-accent-strong disabled:cursor-not-allowed disabled:opacity-40`})})]}):null,(0,V.jsx)(`td`,{className:`${o} text-center`,children:(0,V.jsx)(`input`,{type:`checkbox`,checked:e.notNull,onChange:t=>d(e.id,{notNull:t.target.checked}),"aria-label":`Not null for ${e.name||`new column`}`,className:`cursor-pointer accent-accent-strong`})}),(0,V.jsx)(`td`,{className:`${o} text-right`,children:(0,V.jsx)(`button`,{type:`button`,onClick:()=>u(e.id),"aria-label":`Remove ${e.name||`new column`}`,className:`cursor-pointer rounded px-2 py-1 text-[0.75rem] text-amber transition-colors hover:bg-amber/20`,children:`Remove`})})]},e.id)),r&&(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:n?7:5,className:`p-0`,children:(0,V.jsx)(`button`,{type:`button`,onClick:l,className:`w-full cursor-pointer px-3 py-2 text-left text-[0.8rem] text-muted transition-colors hover:bg-hover-bg hover:text-foreground`,children:`+ Add column`})})})]})]})})}function au({label:e,action:t,onAction:n}){return(0,V.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,V.jsx)(`h3`,{className:`text-[0.78rem] font-bold uppercase tracking-wider text-faint`,children:e}),(0,V.jsx)(`button`,{type:`button`,onClick:n,className:`cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-[0.78rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:t})]})}function ou({isOpen:e,onClose:t,projectId:n,onCreated:r}){let[i,a]=(0,h.useState)(``),[o,s]=(0,h.useState)([El(1)]),[c,l]=(0,h.useState)(!1),[u,d]=(0,h.useState)(null);(0,h.useEffect)(()=>{e&&(a(``),s([El(1)]),d(null),l(!1))},[e]);let f=Al(i,o),p=(0,h.useCallback)(async e=>{if(e.preventDefault(),!f){d(`Give the table a name and at least one named column.`);return}l(!0),d(null);try{await U.consoleExec(n,f),r(i.trim())}catch(e){d(e instanceof ar?`${e.message}${e.detail?` — ${e.detail}`:``}`:`Could not create the table.`),l(!1)}},[f,n,i,r]);return e?(0,V.jsx)(pl,{onClose:t,title:`Create table`,description:`Define columns the way a SQLite viewer does. One column may be the primary key, optionally AUTOINCREMENT.`,size:`xl`,actions:(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`button`,{type:`button`,onClick:t,className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`Cancel`}),(0,V.jsx)(`button`,{type:`button`,onClick:e=>{let t=e.currentTarget.form;t&&t.requestSubmit()},disabled:c||!f,className:`cursor-pointer rounded-lg bg-accent-strong px-5 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:c?`Creating…`:`Create table`})]}),children:(0,V.jsxs)(`form`,{onSubmit:p,children:[(0,V.jsxs)(`label`,{className:`mb-5 flex flex-col gap-2`,children:[(0,V.jsx)(`span`,{className:`text-sm text-muted`,children:`Table name`}),(0,V.jsx)(`input`,{type:`text`,value:i,onChange:e=>a(e.target.value),placeholder:`users`,spellCheck:!1,className:`rounded-lg border border-edge-strong bg-panel px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none`})]}),(0,V.jsx)(au,{label:`Columns (${o.filter(e=>e.name.trim()).length})`,action:`+ Add column`,onAction:()=>s(e=>{let t=e.reduce((e,t)=>Math.max(e,t.id),0)+1;return[...e,El(t)]})}),(0,V.jsx)(iu,{columns:o,onChange:s,label:`Columns`}),(0,V.jsxs)(`div`,{className:`mt-5`,children:[(0,V.jsx)(`p`,{className:`mb-2 text-[0.82rem] font-bold uppercase tracking-wider text-faint`,children:`Preview`}),(0,V.jsx)(`pre`,{className:`overflow-x-auto rounded-lg border border-edge bg-panel px-3 py-2.5 font-mono text-[0.8rem] text-muted`,children:f??`-- name the table and its columns`})]}),u&&(0,V.jsx)(`p`,{role:`alert`,className:`mt-4 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber`,children:u})]})}):null}function su({projectId:e,table:t,columns:n,identity:r,refreshKey:i,onChanged:a}){let[o,s]=(0,h.useState)(null),[c,l]=(0,h.useState)(null),[u,d]=(0,h.useState)(0),[f,p]=(0,h.useState)({column:null,direction:`asc`}),[m,g]=(0,h.useState)(!0),[_,v]=(0,h.useState)(null),[y,b]=(0,h.useState)(null),[x,S]=(0,h.useState)(!1),[C,w]=(0,h.useState)(null),T=u*25,E=r!==null;(0,h.useEffect)(()=>{let n=!1;async function i(){g(!0),v(null);try{let i=await U.consoleQuery(e,tu({table:t,identifyByRowid:r?.kind===`rowid`,limit:25,offset:T,sortColumn:f.column,sortDirection:f.direction}));if(n)return;s(i);try{let r=await U.consoleQuery(e,nu(t));if(n)return;let i=Number(r.rows?.[0]?.[0]);l(Number.isFinite(i)?i:null)}catch{n||l(null)}}catch(e){n||v(e instanceof ar?e.message:`Could not load the table.`)}finally{n||g(!1)}}return i(),()=>{n=!0}},[e,t,i,T,f.column,f.direction,r?.kind]);let D=r?.kind===`column`?n.findIndex(e=>e.name===r.name):-1,ee=+(r?.kind===`rowid`),[O,te]=(0,h.useState)([]),[k,A]=(0,h.useState)(null),[ne,re]=(0,h.useState)(null),ie=(0,h.useRef)(!1),ae=(0,h.useRef)(null),oe=(0,h.useRef)(null);(0,h.useEffect)(()=>{let e=o?.rows??[];te(e.map((e,t)=>({id:r?r.kind===`rowid`?e[0]:e[D]:`#${t}`,cells:n.map((t,n)=>{let r=e[n+ee];return r==null?null:String(r)})})))},[o,n,r,D,ee]),(0,h.useEffect)(()=>{ae.current=ne},[ne]);let j=(0,h.useCallback)(async(t,n,r)=>{S(!0),b(null);try{await U.consoleExec(e,t,n),r?.(),a()}catch(e){b(e instanceof ar?`${e.message}${e.detail?` — ${e.detail}`:``}`:`The statement could not be executed.`)}finally{S(!1)}},[e,a]),M=(e,i,a)=>{let o=O[e],s=n[i];if(!o||!s||!r)return;let c=a===``?null:a;o.cells[i]!==c&&(te(t=>t.map((t,n)=>n===e?{...t,cells:t.cells.map((e,t)=>t===i?c:e)}:t)),j($l(t,[s.name],r.name),[ru(a,s.type),o.id]))},N=()=>{let e=ae.current;if(!e)return;let r=n.map((t,n)=>ru(e[n]??``,t.type));if(r.every(e=>e===null)){re(null);return}j(Ql(t,n.map(e=>e.name)),r,()=>re(null))},se=(0,h.useCallback)(()=>{let e=C;e&&r&&(w(null),j(eu(t,r.name),[e.id]))},[C,r,j,t]);function ce(e){d(0),p(t=>t.column===e?t.direction===`asc`?{column:e,direction:`desc`}:{column:null,direction:`asc`}:{column:e,direction:`asc`})}let le=c===null?null:Math.max(1,Math.ceil(c/25)),ue=f.column===`__moogo_rowid__`?null:f.column;return(0,V.jsxs)(`div`,{children:[(0,V.jsxs)(`div`,{className:`mb-2 flex flex-wrap items-center justify-between gap-2`,children:[(0,V.jsx)(`p`,{className:`text-[0.78rem] text-faint`,children:m?`Loading rows…`:c===null?`${O.length} row${O.length===1?``:`s`}`:c===0?`No rows`:`${c.toLocaleString()} row${c===1?``:`s`}`}),(0,V.jsxs)(`div`,{className:`flex items-center gap-1.5`,children:[!E&&(0,V.jsx)(`span`,{className:`text-[0.75rem] text-faint`,children:`Read-only`}),ue&&(0,V.jsx)(`button`,{type:`button`,onClick:()=>{d(0),p({column:null,direction:`asc`})},className:`cursor-pointer rounded-md px-2 py-1 text-[0.75rem] text-muted transition-colors hover:bg-hover-bg hover:text-foreground`,children:`Clear sort`})]})]}),y&&(0,V.jsx)(`p`,{role:`alert`,className:`mb-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber`,children:y}),(0,V.jsx)(`div`,{className:`max-h-[62vh] overflow-auto rounded-lg border border-edge`,children:(0,V.jsxs)(`table`,{className:`w-full border-collapse text-left text-[0.82rem]`,children:[(0,V.jsxs)(`caption`,{className:`sr-only`,children:[`Rows from `,t,`. Click a cell to edit it.`]}),(0,V.jsx)(`thead`,{className:`sticky top-0 z-10 bg-panel-raised`,children:(0,V.jsxs)(`tr`,{children:[(0,V.jsx)(`th`,{scope:`col`,title:`Position of this row on the current page`,className:`w-14 border-b border-edge px-2 py-1.5 text-right font-mono text-[0.72rem] font-normal text-faint`,children:`#`}),n.map(e=>(0,V.jsx)(lu,{column:e,sortColumn:ue,direction:f.direction,onSort:()=>ce(e.name)},e.name)),E&&(0,V.jsx)(`th`,{scope:`col`,className:`w-16 border-b border-l border-edge px-2 py-1.5`,children:(0,V.jsx)(`span`,{className:`sr-only`,children:`Actions`})})]})}),(0,V.jsxs)(`tbody`,{children:[_&&(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:n.length+2,className:`px-3 py-6 text-center text-amber`,children:_})}),!_&&!m&&O.length===0&&(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:n.length+2,className:`px-3 py-10 text-center text-faint`,children:`No rows yet.`})}),O.map((e,t)=>(0,V.jsxs)(`tr`,{className:`border-b border-edge/50 last:border-b-0 hover:bg-panel-raised/40`,children:[(0,V.jsx)(`td`,{className:`px-2 py-0 text-right font-mono text-[0.72rem] text-faint`,children:T+t+1}),n.map((n,r)=>{let i=k?.rowIndex===t&&k?.columnIndex===r,a=e.cells[r],o=!E||n.generated;return(0,V.jsx)(`td`,{className:`border-l border-edge/50 p-0`,children:i?(0,V.jsx)(`input`,{autoFocus:!0,defaultValue:a??``,spellCheck:!1,onKeyDown:e=>{e.key===`Enter`?(e.preventDefault(),e.currentTarget.blur()):e.key===`Escape`&&(e.preventDefault(),ie.current=!0,e.currentTarget.blur())},onBlur:e=>{if(ie.current){ie.current=!1,A(null);return}M(t,r,e.currentTarget.value),A(null)},className:`w-full bg-background px-3 py-1 font-mono text-[0.82rem] text-foreground outline-none ring-2 ring-inset ring-accent-strong`}):(0,V.jsx)(`button`,{type:`button`,onClick:()=>!o&&A({rowIndex:t,columnIndex:r}),disabled:o,title:o&&n.generated?`Generated column`:void 0,className:`block w-full px-3 py-1 text-left font-mono text-[0.82rem] ${o?`cursor-default bg-panel/50 text-muted`:`cursor-text text-foreground/90`}`,children:a===null?(0,V.jsx)(`span`,{className:`text-[0.75rem] italic text-faint/70`,children:`null`}):a===``?(0,V.jsx)(`span`,{className:`text-faint/50`,children:`\xA0`}):a})},n.name)}),E&&(0,V.jsx)(`td`,{className:`border-l border-edge/50 p-0 text-right`,children:(0,V.jsx)(`button`,{type:`button`,onClick:()=>w(e),disabled:x,className:`cursor-pointer px-2 py-1 text-[0.72rem] text-amber transition-colors hover:bg-amber/20 disabled:opacity-40`,children:`Delete`})})]},String(e.id))),E&&ne&&(0,V.jsxs)(`tr`,{ref:oe,className:`bg-accent-strong/5`,children:[(0,V.jsx)(`td`,{className:`px-2 py-0 text-right font-mono text-[0.72rem] text-accent`,children:`+`}),n.map((e,t)=>(0,V.jsx)(`td`,{className:`border-l border-edge/50 p-0`,children:(0,V.jsx)(`input`,{value:ne[t]??``,onChange:e=>re(n=>n&&n.map((n,r)=>r===t?e.target.value:n)),placeholder:e.defaultValue??`null`,spellCheck:!1,"aria-label":`Value for ${e.name}`,onKeyDown:e=>{e.key===`Enter`?(e.preventDefault(),e.currentTarget.blur()):e.key===`Escape`&&(e.preventDefault(),re(null))},onBlur:()=>{window.setTimeout(()=>{let e=oe.current;(!e||!e.contains(document.activeElement))&&N()},0)},className:`w-full bg-background px-3 py-1 font-mono text-[0.82rem] text-foreground placeholder:italic placeholder:text-faint outline-none ring-2 ring-inset ring-accent-strong/40 focus:ring-accent-strong`})},e.name)),(0,V.jsx)(`td`,{className:`border-l border-edge/50 p-0`})]}),E&&!ne&&(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:n.length+2,className:`p-0`,children:(0,V.jsx)(`button`,{type:`button`,onClick:()=>re(n.map(()=>null)),className:`w-full cursor-pointer px-3 py-2 text-left text-[0.82rem] text-faint transition-colors hover:bg-panel-raised/60 hover:text-foreground`,children:`+ Insert row`})})})]})]})}),(0,V.jsxs)(`div`,{className:`mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.78rem] text-faint`,children:[(0,V.jsx)(`span`,{children:c===null||c===0?` `:`Showing ${(T+1).toLocaleString()}–${Math.min(T+O.length,c).toLocaleString()} of ${c.toLocaleString()}`}),le!==null&&le>1&&(0,V.jsxs)(`div`,{className:`flex items-center gap-1`,children:[(0,V.jsx)(uu,{onClick:()=>d(e=>Math.max(0,e-1)),disabled:u===0,children:`Previous`}),(0,V.jsxs)(`span`,{className:`px-2 tabular-nums`,children:[`Page `,u+1,` of `,le]}),(0,V.jsx)(uu,{onClick:()=>d(e=>e+1),disabled:T+25>=(c??0),children:`Next`})]})]}),(0,V.jsx)(hl,{open:C!==null,title:`Delete row`,description:`This cannot be undone. The row is removed from the table.`,detail:C?cu(n,r,C):void 0,confirmLabel:`Delete row`,busy:x,onConfirm:se,onCancel:()=>w(null)})]})}function cu(e,t,n){if(!t)return``;if(t.kind===`rowid`)return`rowid = ${n.id===null?`NULL`:String(n.id)}`;let r=e.findIndex(e=>e.name===t.name),i=r>=0?n.cells[r]:n.id;return`${t.name} = ${i===null?`NULL`:i??``}`}function lu({column:e,sortColumn:t,direction:n,onSort:r}){let i=t===e.name;return(0,V.jsx)(`th`,{scope:`col`,"aria-sort":i?n===`asc`?`ascending`:`descending`:`none`,className:`min-w-[9rem] border-b border-l border-edge px-3 py-1.5 align-top`,children:(0,V.jsxs)(`button`,{type:`button`,onClick:r,title:`Sort by ${e.name}`,className:`group flex w-full cursor-pointer flex-col gap-0.5 text-left`,children:[(0,V.jsxs)(`span`,{className:`flex items-center gap-1 font-semibold text-foreground`,children:[e.name,e.primaryKey&&(0,V.jsx)(`span`,{title:`Primary key`,className:`rounded bg-accent-strong/15 px-1 text-[0.65rem] font-semibold uppercase text-accent`,children:`PK`}),e.generated&&(0,V.jsx)(`span`,{title:`Generated column`,className:`rounded bg-violet/15 px-1 text-[0.65rem] font-semibold uppercase text-violet`,children:`GEN`}),(0,V.jsx)(`span`,{"aria-hidden":`true`,className:`text-[0.7rem] transition-opacity ${i?`opacity-100`:`opacity-0 group-hover:opacity-40`}`,children:i&&n===`desc`?`▼`:`▲`})]}),(0,V.jsxs)(`span`,{className:`font-mono text-[0.7rem] font-normal text-faint`,children:[e.type||`ANY`,e.notNull?` · not null`:``]})]})})}function uu({onClick:e,disabled:t,children:n}){return(0,V.jsx)(`button`,{type:`button`,onClick:e,disabled:t,className:`cursor-pointer rounded-md px-2.5 py-1 font-semibold text-muted transition-colors hover:bg-panel-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40`,children:n})}function du(e){return(e?.rows??[]).map(e=>{let t=Number(e[6])||0;return{name:String(e[1]),type:String(e[2]??``),notNull:Number(e[3])===1,defaultValue:e[4]===null||e[4]===void 0?null:String(e[4]),primaryKey:Number(e[5])>0,generated:t===2||t===3,hidden:t!==0}})}function fu(e,t){let n=e.filter(e=>e.primaryKey);return n.length===1?{kind:`column`,name:n[0].name}:t?{kind:`rowid`,name:`rowid`}:null}var pu={c:`CREATE INDEX`,u:`UNIQUE constraint`,pk:`PRIMARY KEY`};function mu(e,t){return(e?.rows??[]).map(e=>{let n=String(e[1]),r=String(e[3]??`c`);return{name:n,unique:Number(e[2])===1,origin:r,partial:Number(e[4])===1,columns:(t[n]??[]).map(e=>e===``?`(rowid)`:e)}})}function hu(e){let t=new Map;for(let n of e?.rows??[]){let e=String(n[0]),r=String(n[3]),i=n[4]===null||n[4]===void 0?``:String(n[4]),a=t.get(e);if(a){a.columns.push(r),a.referencesColumns.push(i);continue}t.set(e,{id:e,columns:[r],referencesTable:String(n[2]),referencesColumns:[i],onUpdate:String(n[5]??`NO ACTION`),onDelete:String(n[6]??`NO ACTION`)})}return[...t.values()]}function gu(e){return(e?.rows??[]).map(e=>({type:String(e[1]),name:String(e[0]),table:String(e[2]??``),sql:e[3]===null||e[3]===void 0?null:String(e[3])}))}function _u(e){let t={};for(let n of e?.rows??[]){let e=Number(n[1]);t[String(n[0])]=Number.isFinite(e)?e:0}return t}function vu({table:e,columns:t,indexes:n,foreignKeys:r,triggers:i,readOnly:a=!1,busy:o,runStatement:s}){let[c,l]=(0,h.useState)(null),[u,d]=(0,h.useState)(null),[f,p]=(0,h.useState)(null),[m,g]=(0,h.useState)(null),[_,v]=(0,h.useState)(``),[y,b]=(0,h.useState)(!1),[x,S]=(0,h.useState)(()=>El(1)),[C,w]=(0,h.useState)(!1),[T,E]=(0,h.useState)({name:``,column:``,unique:!1}),D=y?jl(e,x):null,ee=C?Il(T.name,e,T.column?[T.column]:[],T.unique):null;function O(){b(!1),S(El(1))}let te=(0,h.useCallback)(()=>{let t=jl(e,x);if(!t){l(`Give the new column a name.`);return}l(null),s(t,()=>{b(!1),S(El(1))})},[e,x,s]),k=t=>{let n=Pl(e,t,_);n&&s(n,()=>{g(null),v(``)})};function A(){let e=ee;if(!e){l(`Name the index and pick the column it covers.`);return}l(null),s(e,()=>{w(!1),E({name:``,column:``,unique:!1})})}return(0,V.jsxs)(`div`,{className:`space-y-8`,children:[c&&(0,V.jsx)(`p`,{role:`alert`,className:`rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber`,children:c}),(0,V.jsxs)(`section`,{children:[(0,V.jsx)(yu,{count:t.length,children:`Columns`}),!a&&(0,V.jsx)(`button`,{type:`button`,onClick:()=>{b(e=>!e),l(null)},className:`mb-2 cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-[0.78rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:y?`Close`:`+ Add column`}),(0,V.jsx)(`div`,{className:`overflow-x-auto rounded-lg border border-edge`,children:(0,V.jsxs)(`table`,{className:`w-full border-collapse text-left text-[0.85rem]`,children:[(0,V.jsx)(`thead`,{className:`bg-panel-raised`,children:(0,V.jsxs)(`tr`,{children:[(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Name`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Type`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Not null`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Default`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Key`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2`,children:(0,V.jsx)(`span`,{className:`sr-only`,children:`Actions`})})]})}),(0,V.jsx)(`tbody`,{children:t.length===0?(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:6,className:`px-3 py-3 text-center text-muted`,children:`No columns.`})}):t.map(e=>(0,V.jsxs)(`tr`,{className:`odd:bg-panel even:bg-panel/40`,children:[(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 font-mono text-foreground`,children:m===e.name?(0,V.jsx)(`input`,{value:_,onChange:e=>v(e.target.value),autoFocus:!0,spellCheck:!1,"aria-label":`Rename ${e.name}`,className:`w-36 rounded border border-edge-strong bg-background px-2 py-1 font-mono text-[0.8rem] text-foreground focus:border-accent-strong focus:outline-none`}):(0,V.jsxs)(`span`,{className:`flex items-center gap-1.5`,children:[e.name,e.hidden&&(0,V.jsx)(`span`,{title:`Generated or hidden — SQLite computes this value, so it cannot be edited`,className:`rounded bg-violet/15 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase text-violet`,children:`Gen`})]})}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 font-mono text-muted`,children:e.type||`ANY`}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 text-muted`,children:e.notNull?`yes`:`no`}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 font-mono text-muted`,children:e.defaultValue??`—`}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5`,children:e.primaryKey&&(0,V.jsx)(`span`,{className:`rounded bg-accent-strong/15 px-1.5 py-0.5 text-[0.72rem] font-semibold uppercase text-accent`,children:`PK`})}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 text-right`,children:m===e.name?(0,V.jsxs)(`div`,{className:`flex justify-end gap-1`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>k(e.name),disabled:o||!_.trim(),className:`cursor-pointer rounded px-2 py-1 text-[0.75rem] font-semibold text-accent transition-colors hover:bg-hover-bg disabled:opacity-50`,children:`Save`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>g(null),className:`cursor-pointer rounded px-2 py-1 text-[0.75rem] text-muted transition-colors hover:bg-hover-bg`,children:`Cancel`})]}):a?(0,V.jsx)(`span`,{className:`px-2 py-1 text-[0.72rem] text-faint`,children:`—`}):(0,V.jsxs)(`div`,{className:`flex justify-end gap-1`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>{g(e.name),v(e.name)},className:`cursor-pointer rounded px-2 py-1 text-[0.75rem] text-muted transition-colors hover:bg-hover-bg hover:text-foreground`,children:`Rename`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>d(e.name),disabled:o,className:`cursor-pointer rounded px-2 py-1 text-[0.75rem] text-amber transition-colors hover:bg-amber/20 disabled:opacity-50`,children:`Drop`})]})})]},e.name))})]})}),y&&(0,V.jsxs)(`div`,{className:`mt-3 rounded-lg border border-edge bg-panel p-3`,children:[(0,V.jsx)(iu,{columns:[x],onChange:e=>S(e[0]??El(Date.now())),allowPrimaryKey:!1,showAddRow:!1,compact:!0,label:`New column`}),D&&(0,V.jsx)(`pre`,{className:`mt-3 overflow-x-auto rounded-lg border border-edge bg-background px-3 py-2 font-mono text-[0.78rem] text-muted`,children:D}),(0,V.jsxs)(`div`,{className:`mt-3 flex items-center justify-end gap-2`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:O,className:`cursor-pointer rounded-lg border border-edge-strong px-3 py-1.5 text-[0.8rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Cancel`}),(0,V.jsx)(`button`,{type:`button`,onClick:te,disabled:o||!x.name.trim(),className:`cursor-pointer rounded-lg bg-accent-strong px-4 py-1.5 text-[0.8rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:`Add column`})]}),(0,V.jsx)(`p`,{className:`mt-2 text-[0.75rem] text-faint`,children:`SQLite can add a column to an existing table, but not a primary key or an autoincrementing one.`})]})]}),(0,V.jsxs)(`section`,{children:[(0,V.jsx)(yu,{count:n.length,children:`Indexes`}),!a&&(0,V.jsx)(`button`,{type:`button`,onClick:()=>{w(e=>!e),l(null)},className:`mb-2 cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-[0.78rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:C?`Close`:`+ Add index`}),(0,V.jsx)(`div`,{className:`overflow-x-auto rounded-lg border border-edge`,children:(0,V.jsxs)(`table`,{className:`w-full border-collapse text-left text-[0.85rem]`,children:[(0,V.jsx)(`thead`,{className:`bg-panel-raised`,children:(0,V.jsxs)(`tr`,{children:[(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Name`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Columns`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Unique`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Created by`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2`,children:(0,V.jsx)(`span`,{className:`sr-only`,children:`Actions`})})]})}),(0,V.jsx)(`tbody`,{children:n.length===0?(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:5,className:`px-3 py-3 text-center text-muted`,children:`No indexes.`})}):n.map(e=>(0,V.jsxs)(`tr`,{className:`odd:bg-panel even:bg-panel/40`,children:[(0,V.jsxs)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 font-mono text-foreground`,children:[e.name,e.partial&&(0,V.jsx)(`span`,{title:`Partial index — its WHERE clause limits which rows it covers`,className:`ml-1.5 rounded bg-blue/15 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase text-blue`,children:`Partial`})]}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 font-mono text-muted`,children:e.columns.length>0?e.columns.join(`, `):`—`}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 text-muted`,children:e.unique?`yes`:`no`}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 text-muted`,children:pu[e.origin]??e.origin}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 text-right`,children:a?(0,V.jsx)(`span`,{className:`px-2 py-1 text-[0.72rem] text-faint`,children:`—`}):e.origin===`c`?(0,V.jsx)(`button`,{type:`button`,onClick:()=>p(e.name),disabled:o,className:`cursor-pointer rounded px-2 py-1 text-[0.75rem] text-amber transition-colors hover:bg-amber/20 disabled:opacity-50`,children:`Drop`}):(0,V.jsx)(`span`,{className:`px-2 py-1 text-[0.72rem] text-faint`,children:`part of the table definition`})})]},e.name))})]})}),C&&(0,V.jsxs)(`div`,{className:`mt-3 rounded-lg border border-edge bg-panel p-3`,children:[(0,V.jsxs)(`div`,{className:`flex flex-wrap items-end gap-3`,children:[(0,V.jsxs)(`label`,{className:`flex flex-col gap-1`,children:[(0,V.jsx)(`span`,{className:`text-[0.72rem] font-bold uppercase tracking-wider text-faint`,children:`Index name`}),(0,V.jsx)(`input`,{value:T.name,onChange:e=>E({...T,name:e.target.value}),placeholder:`idx_orders_user`,spellCheck:!1,className:`w-44 rounded border border-edge-strong bg-background px-2 py-1.5 font-mono text-[0.8rem] text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none`})]}),(0,V.jsxs)(`label`,{className:`flex flex-col gap-1`,children:[(0,V.jsx)(`span`,{className:`text-[0.72rem] font-bold uppercase tracking-wider text-faint`,children:`Column`}),(0,V.jsxs)(`select`,{value:T.column,onChange:e=>E({...T,column:e.target.value}),className:`rounded border border-edge-strong bg-background px-2 py-1.5 font-mono text-[0.8rem] text-foreground focus:border-accent-strong focus:outline-none`,children:[(0,V.jsx)(`option`,{value:``,children:`Choose a column`}),t.map(e=>(0,V.jsx)(`option`,{value:e.name,children:e.name},e.name))]})]}),(0,V.jsxs)(`label`,{className:`flex items-center gap-2 pb-2 text-[0.8rem] text-muted`,children:[(0,V.jsx)(`input`,{type:`checkbox`,checked:T.unique,onChange:e=>E({...T,unique:e.target.checked}),className:`cursor-pointer accent-accent-strong`}),`Unique`]}),(0,V.jsx)(`button`,{type:`button`,onClick:A,disabled:o||!ee,className:`cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.8rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:`Create index`})]}),ee&&(0,V.jsx)(`pre`,{className:`mt-3 overflow-x-auto rounded-lg border border-edge bg-background px-3 py-2 font-mono text-[0.78rem] text-muted`,children:ee}),(0,V.jsx)(`p`,{className:`mt-2 text-[0.75rem] text-faint`,children:`A UNIQUE index refuses a second row with the same value in that column.`})]})]}),(0,V.jsxs)(`section`,{children:[(0,V.jsx)(yu,{count:r.length,children:`Foreign keys`}),(0,V.jsx)(`div`,{className:`overflow-x-auto rounded-lg border border-edge`,children:(0,V.jsxs)(`table`,{className:`w-full border-collapse text-left text-[0.85rem]`,children:[(0,V.jsx)(`thead`,{className:`bg-panel-raised`,children:(0,V.jsxs)(`tr`,{children:[(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`Columns`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`References`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`On update`}),(0,V.jsx)(`th`,{scope:`col`,className:`border-b border-edge px-3 py-2 font-semibold text-foreground`,children:`On delete`})]})}),(0,V.jsx)(`tbody`,{children:r.length===0?(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:4,className:`px-3 py-3 text-center text-muted`,children:`No foreign keys.`})}):r.map(e=>(0,V.jsxs)(`tr`,{className:`odd:bg-panel even:bg-panel/40`,children:[(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 font-mono text-foreground`,children:e.columns.join(`, `)}),(0,V.jsxs)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 font-mono text-muted`,children:[J(e.referencesTable),e.referencesColumns.some(Boolean)?` (${e.referencesColumns.filter(Boolean).join(`, `)})`:``]}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 text-muted`,children:e.onUpdate}),(0,V.jsx)(`td`,{className:`border-b border-edge/60 px-3 py-1.5 text-muted`,children:e.onDelete})]},e.id))})]})}),r.length>0&&(0,V.jsx)(`p`,{className:`mt-2 text-[0.75rem] text-faint`,children:`Foreign keys are enforced on this project's connections, so a write that breaks one is refused rather than quietly ignored.`})]}),(0,V.jsxs)(`section`,{children:[(0,V.jsx)(yu,{count:i.length,children:`Triggers`}),i.length===0?(0,V.jsx)(`p`,{className:`rounded-lg border border-dashed border-edge-strong px-3 py-4 text-center text-[0.82rem] text-faint`,children:`No triggers.`}):(0,V.jsx)(`div`,{className:`space-y-2`,children:i.map(e=>(0,V.jsxs)(`details`,{className:`rounded-lg border border-edge bg-panel px-3 py-2`,children:[(0,V.jsx)(`summary`,{className:`cursor-pointer font-mono text-[0.85rem] text-foreground`,children:e.name}),(0,V.jsx)(`pre`,{className:`mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[0.78rem] text-muted`,children:e.sql??`—`})]},e.name))})]}),(0,V.jsx)(hl,{open:u!==null,title:`Drop column`,description:`Every row loses this column and the values in it. This cannot be undone.`,detail:u??void 0,confirmLabel:`Drop column`,busy:o,onConfirm:()=>{let t=u;d(null),t&&s(Fl(e,t))},onCancel:()=>d(null)}),(0,V.jsx)(hl,{open:f!==null,title:`Drop index`,description:`The index is removed. The data it covered is untouched, and queries that relied on it get slower.`,detail:f??void 0,confirmLabel:`Drop index`,busy:o,onConfirm:()=>{let e=f;p(null),e&&s(Ll(e))},onCancel:()=>p(null)})]})}function yu({count:e,children:t}){return(0,V.jsxs)(`h3`,{className:`mb-2 text-[0.78rem] font-bold uppercase tracking-wider text-faint`,children:[t,` (`,e,`)`]})}function bu({projectId:e,refreshKey:t}){let[n,r]=(0,h.useState)(null),[i,a]=(0,h.useState)(null),[o,s]=(0,h.useState)(null),[c,l]=(0,h.useState)(!1),[u,d]=(0,h.useState)(``),[f,p]=(0,h.useState)(0),[m,g]=(0,h.useState)(0),_=(0,h.useCallback)(async()=>{a(null);try{let t=gu(await U.consoleQuery(e,Ul())),n=Zl(t.filter(e=>e.type===`table`).map(e=>e.name)),i={};if(n)try{i=_u(await U.consoleQuery(e,n))}catch{i={}}r({objects:t,counts:i})}catch(e){a(e instanceof ar?e.message:`Could not list the schema.`)}},[e]);(0,h.useEffect)(()=>{_()},[_,t,f]);let v=(0,h.useCallback)(()=>{p(e=>e+1),g(e=>e+1)},[]),y=(0,h.useCallback)(e=>{l(!1),s(e),v()},[v]),b=(0,h.useMemo)(()=>(n?.objects??[]).filter(e=>e.type===`table`),[n]),x=(0,h.useMemo)(()=>(n?.objects??[]).filter(e=>e.type===`view`),[n]),S=n?.objects.find(e=>e.name===o&&(e.type===`table`||e.type===`view`))??null,C=u.trim().toLowerCase(),w=e=>e.toLowerCase().includes(C);return(0,V.jsxs)(`div`,{children:[(0,V.jsxs)(`div`,{className:`grid gap-5 lg:grid-cols-[228px_1fr]`,children:[(0,V.jsx)(`aside`,{className:`min-w-0`,children:(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-panel`,children:[(0,V.jsxs)(`div`,{className:`flex items-center justify-between gap-2 border-b border-edge px-3 py-2`,children:[(0,V.jsx)(`h2`,{className:`text-[0.82rem] font-bold uppercase tracking-wider text-faint`,children:`Schema`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>l(!0),className:`cursor-pointer rounded-md bg-accent-strong px-2 py-1 text-[0.75rem] font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`+ New table`})]}),(b.length>0||x.length>0)&&(0,V.jsx)(`div`,{className:`border-b border-edge p-2`,children:(0,V.jsx)(`input`,{type:`search`,value:u,onChange:e=>d(e.target.value),placeholder:`Filter`,"aria-label":`Filter tables and views`,className:`w-full cursor-text rounded-md bg-background px-2.5 py-1.5 text-[0.82rem] text-foreground placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent-strong`})}),(0,V.jsxs)(`nav`,{"aria-label":`Tables and views`,className:`max-h-[52vh] overflow-y-auto p-1.5`,children:[i&&(0,V.jsx)(`p`,{role:`alert`,className:`m-1.5 rounded-md border border-amber/40 bg-amber/10 px-2.5 py-2 text-[0.8rem] text-amber`,children:i}),!i&&!n&&(0,V.jsx)(`p`,{className:`px-2 py-3 text-center text-[0.82rem] text-muted`,children:`Loading…`}),!i&&n&&b.length===0&&x.length===0&&(0,V.jsxs)(`div`,{className:`px-2 py-4 text-center`,children:[(0,V.jsx)(`p`,{className:`text-[0.82rem] text-faint`,children:`No tables yet.`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>l(!0),className:`mt-2 cursor-pointer text-[0.82rem] font-semibold text-accent-strong hover:underline`,children:`Create the first one`})]}),(0,V.jsx)(xu,{label:`Tables`,count:b.length,hidden:b.filter(e=>w(e.name)).length,children:b.filter(e=>w(e.name)).map(e=>(0,V.jsx)(Su,{object:e,active:e.name===S?.name,count:n?.counts[e.name],onSelect:()=>s(e.name)},e.name))}),(0,V.jsx)(xu,{label:`Views`,count:x.length,hidden:x.filter(e=>w(e.name)).length,children:x.filter(e=>w(e.name)).map(e=>(0,V.jsx)(Su,{object:e,active:e.name===S?.name,onSelect:()=>s(e.name)},e.name))})]})]})}),(0,V.jsx)(`section`,{className:`min-w-0`,children:S?(0,V.jsx)(Cu,{projectId:e,object:S,siblings:n?.objects??[],refreshKey:m,onChanged:v,onGone:()=>{s(null),v()},onRenamed:e=>{s(e),v()}},S.name):(0,V.jsxs)(`div`,{className:`rounded-lg border border-dashed border-edge-strong px-6 py-16 text-center`,children:[(0,V.jsx)(`p`,{className:`text-[0.9rem] font-semibold text-foreground`,children:b.length===0&&x.length===0?`This database has no tables yet`:`Select a table to read it`}),(0,V.jsx)(`p`,{className:`mx-auto mt-1 max-w-[34em] text-[0.85rem] text-muted`,children:b.length===0&&x.length===0?`Create one to start storing rows. The file itself is a single SQLite database.`:`Its rows, its columns, its indexes and the SQL SQLite stored for it are all read from the file.`}),b.length===0&&(0,V.jsx)(`button`,{type:`button`,onClick:()=>l(!0),className:`mt-5 cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`New table`})]})})]}),(0,V.jsx)(ou,{isOpen:c,onClose:()=>l(!1),projectId:e,onCreated:y})]})}function xu({label:e,count:t,hidden:n,children:r}){return t===0||n===0?null:(0,V.jsxs)(`div`,{className:`mb-1.5 last:mb-0`,children:[(0,V.jsxs)(`p`,{className:`px-2 pb-1 pt-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-faint`,children:[e,` (`,t,`)`]}),(0,V.jsx)(`ul`,{className:`flex flex-col`,children:r})]})}function Su({object:e,active:t,count:n,onSelect:r}){return(0,V.jsx)(`li`,{children:(0,V.jsxs)(`button`,{type:`button`,onClick:r,"aria-current":t?`page`:void 0,className:`flex w-full cursor-pointer items-center gap-2 rounded-md border-l-2 py-1.5 pl-2.5 pr-2 text-left font-mono text-[0.82rem] transition-colors ${t?`border-accent-strong bg-panel-raised font-semibold text-foreground`:`border-transparent text-muted hover:bg-panel-raised/60 hover:text-foreground`}`,children:[(0,V.jsx)(`span`,{className:`min-w-0 flex-1 truncate`,children:e.name}),e.type===`view`?(0,V.jsx)(`span`,{className:`shrink-0 text-[0.68rem] font-semibold uppercase text-violet`,children:`view`}):n===void 0?null:(0,V.jsx)(`span`,{className:`shrink-0 text-[0.7rem] tabular-nums text-faint`,children:n.toLocaleString()})]})})}function Cu({projectId:e,object:t,siblings:n,refreshKey:r,onChanged:i,onGone:a,onRenamed:o}){let[s,c]=(0,h.useState)(`rows`),[l,u]=(0,h.useState)([]),[d,f]=(0,h.useState)([]),[p,m]=(0,h.useState)([]),[g,_]=(0,h.useState)(!0),[v,y]=(0,h.useState)(null),[b,x]=(0,h.useState)(null),[S,C]=(0,h.useState)(!1),[w,T]=(0,h.useState)(!1),[E,D]=(0,h.useState)(t.name),[ee,O]=(0,h.useState)(!1),te=(0,h.useRef)([]),k=(0,h.useId)(),A=t.type===`view`,ne=Rl(t.sql),re=n.filter(e=>e.type===`trigger`&&e.table===t.name);(0,h.useEffect)(()=>{let n=!1;async function r(){_(!0),y(null);try{let r=await U.consoleQuery(e,Wl(t.name));if(n)return;if(u(du(r)),A){f([]),m([]);return}let[i,a]=await Promise.all([U.consoleQuery(e,Gl(t.name)),U.consoleQuery(e,ql(t.name))]);if(n)return;let o=i?.rows??[],s={};if(await Promise.all(o.map(async t=>{let n=String(t[1]);try{let t=await U.consoleQuery(e,Kl(n));s[n]=(t?.rows??[]).map(e=>e[2]===null||e[2]===void 0?``:String(e[2]))}catch{s[n]=[]}})),n)return;f(mu(i,s)),m(hu(a))}catch(e){n||y(e instanceof ar?e.message:`Could not read the schema.`)}finally{n||_(!1)}}return r(),()=>{n=!0}},[e,t.name,A,r]);let ie=(0,h.useMemo)(()=>A?null:fu(l,!ne.withoutRowid),[l,A,ne.withoutRowid]),ae=(0,h.useCallback)(async(t,n)=>{C(!0),x(null);try{await U.consoleExec(e,t),n?.(),i()}catch(e){x(e instanceof ar?`${e.message}${e.detail?` — ${e.detail}`:``}`:`The statement could not be executed.`)}finally{C(!1)}},[e,i]),oe=()=>{let e=E.trim(),n=Nl(t.name,e);n&&ae(n,()=>{T(!1),o(e)})},j=[...A?[]:[{id:`rows`,label:`Rows`}],{id:`structure`,label:`Structure`},{id:`sql`,label:`SQL`}],M=j.some(e=>e.id===s)?s:j[0].id;function N(e,t){if(e.key!==`ArrowRight`&&e.key!==`ArrowLeft`)return;e.preventDefault();let n=(t+(e.key===`ArrowRight`?1:-1)+j.length)%j.length,r=j[n];c(r.id),te.current[n]?.focus()}return g?(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-panel px-4 py-10 text-center text-[0.88rem] text-muted`,children:[`Reading `,t.name,`…`]}):v?(0,V.jsx)(`p`,{role:`alert`,className:`rounded-lg border border-amber/40 bg-amber/10 px-4 py-4 text-[0.9rem] text-amber`,children:v}):(0,V.jsxs)(`div`,{children:[(0,V.jsxs)(`header`,{className:`mb-4`,children:[(0,V.jsx)(`div`,{className:`flex flex-wrap items-center gap-x-2.5 gap-y-1`,children:w?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`input`,{value:E,onChange:e=>D(e.target.value),spellCheck:!1,"aria-label":`New table name`,className:`rounded-md border border-edge-strong bg-background px-2 py-1 font-mono text-[0.95rem] text-foreground focus:border-accent-strong focus:outline-none`}),(0,V.jsx)(`button`,{type:`button`,onClick:oe,disabled:S||!E.trim(),className:`cursor-pointer rounded-md bg-accent-strong px-2.5 py-1 text-[0.78rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:opacity-50`,children:`Save`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>{T(!1),D(t.name)},className:`cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-[0.78rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Cancel`})]}):(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`h2`,{className:`font-mono text-[1.05rem] font-semibold text-foreground`,children:t.name}),A&&(0,V.jsx)(Tu,{tone:`violet`,children:`View`}),ne.strict&&(0,V.jsx)(Tu,{tone:`blue`,children:`Strict`}),ne.withoutRowid&&(0,V.jsx)(Tu,{tone:`amber`,children:`No rowid`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>{T(!0),D(t.name)},className:`cursor-pointer rounded-md px-2 py-1 text-[0.78rem] text-muted transition-colors hover:bg-hover-bg hover:text-foreground`,children:`Rename`}),(0,V.jsxs)(`button`,{type:`button`,onClick:()=>O(!0),disabled:S,className:`cursor-pointer rounded-md px-2 py-1 text-[0.78rem] text-amber transition-colors hover:bg-amber/20 disabled:opacity-50`,children:[`Drop `,A?`view`:`table`]})]})}),(0,V.jsx)(`p`,{className:`mt-1 text-[0.8rem] text-faint`,children:A?`A view is a stored query. It has no rows of its own and cannot be edited.`:`${l.length} column${l.length===1?``:`s`}, ${d.length} index${d.length===1?``:`es`}, ${p.length} foreign key${p.length===1?``:`s`}`})]}),(0,V.jsx)(`div`,{role:`tablist`,"aria-label":`Views of ${t.name}`,className:`mb-4 flex gap-1 border-b border-edge`,children:j.map((e,t)=>(0,V.jsx)(`button`,{ref:e=>{te.current[t]=e},role:`tab`,id:`${k}-tab-${e.id}`,"aria-selected":e.id===M,"aria-controls":`${k}-panel-${e.id}`,tabIndex:e.id===M?0:-1,onClick:()=>c(e.id),onKeyDown:e=>N(e,t),className:`-mb-px cursor-pointer border-b-2 px-3 py-2 text-[0.85rem] font-semibold transition-colors ${e.id===M?`border-accent-strong text-foreground`:`border-transparent text-muted hover:text-foreground`}`,children:e.label},e.id))}),b&&(0,V.jsx)(`p`,{role:`alert`,className:`mb-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber`,children:b}),(0,V.jsx)(`div`,{role:`tabpanel`,id:`${k}-panel-${M}`,"aria-labelledby":`${k}-tab-${M}`,children:M===`rows`?(0,V.jsx)(su,{projectId:e,table:t.name,columns:l,identity:ie,refreshKey:r,onChanged:i}):M===`structure`?(0,V.jsx)(vu,{table:t.name,columns:l,indexes:d,foreignKeys:p,triggers:re.map(e=>({name:e.name,sql:e.sql})),readOnly:A,busy:S,runStatement:(e,t)=>ae(e,t)}):(0,V.jsx)(wu,{object:t,indexes:d,triggers:re})}),(0,V.jsx)(hl,{open:ee,title:A?`Drop view`:`Drop table`,description:A?`The stored query is removed. No data is affected, because a view holds none.`:`Every row in the table is deleted along with its indexes and triggers. This cannot be undone.`,detail:J(t.name),confirmLabel:A?`Drop view`:`Drop table`,busy:S,onConfirm:()=>{O(!1),ae(Ml(t.name),a)},onCancel:()=>O(!1)})]})}function wu({object:e,indexes:t,triggers:n}){let r=[];e.sql&&r.push({label:e.type===`view`?`CREATE VIEW`:`CREATE TABLE`,sql:e.sql});let i=t.filter(e=>e.origin===`c`);i.length>0?r.push({label:`Indexes (${i.length})`,sql:i.map(t=>`${t.unique?`CREATE UNIQUE INDEX`:`CREATE INDEX`} ${J(t.name)} ON ${J(e.name)} (${t.columns.map(J).join(`, `)});`).join(`
`)}):t.length>0&&r.push({label:`Indexes`,sql:`${t.length} index${t.length===1?``:`es`} exist for this table, ${i.length===0?`all`:`some`} created by its UNIQUE and PRIMARY KEY constraints rather than by CREATE INDEX.`});for(let e of n)e.sql&&r.push({label:e.name,sql:e.sql});return(0,V.jsxs)(`div`,{className:`space-y-4`,children:[(0,V.jsxs)(`p`,{className:`text-[0.8rem] text-faint`,children:[`The text SQLite recorded when this `,e.type===`view`?`view`:`table`,` was created. Editing it here is not possible; run a statement in the SQL Editor tab beside this one.`]}),r.length===0?(0,V.jsxs)(`p`,{className:`rounded-lg border border-dashed border-edge-strong px-3 py-6 text-center text-[0.85rem] text-faint`,children:[`SQLite holds no SQL for this `,e.type,`.`]}):r.map(e=>(0,V.jsxs)(`section`,{children:[(0,V.jsx)(`h3`,{className:`mb-1.5 text-[0.78rem] font-bold uppercase tracking-wider text-faint`,children:e.label}),(0,V.jsx)(`pre`,{className:`overflow-x-auto whitespace-pre-wrap rounded-lg border border-edge bg-background px-3 py-2.5 font-mono text-[0.8rem] text-muted`,children:e.sql})]},e.label))]})}function Tu({tone:e,children:t}){return(0,V.jsx)(`span`,{className:`rounded px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase ${{violet:`bg-violet/15 text-violet`,blue:`bg-blue/15 text-blue`,amber:`bg-amber/15 text-amber`}[e]}`,children:t})}var Eu=240,Du=26,Ou=28;function ku(e){return e===null?21:41+e*Du+Du/2}function Au(e){return 42+e*Du}function ju(e){let t=new Set(e.map(e=>e.name)),n=new Map(e.map(e=>[e.name,0]));for(let r=0;r<=e.length;r++){let r=!1;for(let i of e)if(i.kind!==`view`)for(let e of i.foreignKeys){if(e.referencesTable===i.name||!t.has(e.referencesTable))continue;let a=(n.get(e.referencesTable)??0)+1;a>(n.get(i.name)??0)&&(n.set(i.name,a),r=!0)}if(!r)break}let r=e.reduce((e,t)=>t.kind===`table`?Math.max(e,n.get(t.name)??0):e,0);for(let t of e)t.kind===`view`&&n.set(t.name,r+1);let i=new Map;for(let t of e){let e=n.get(t.name)??0,r=i.get(e);r?r.push(t):i.set(e,[t])}let a=[];return[...i.keys()].sort((e,t)=>e-t).forEach((e,t)=>{let n=0;for(let r of i.get(e)??[]){let e=new Map(r.columns.map((e,t)=>[e.name,t]));a.push({table:r,x:t*312,y:n,rowIndex:e}),n+=Au(r.columns.length)+Ou}}),a}function Mu(e,t,n){let r=n.columns[0]??``,i=n.referencesColumns[0]??``;return{fromY:ku(e.rowIndex.get(r)??null),toY:ku(t.rowIndex.get(i)??null)}}function Nu(e,t,n,r){let i=e.y+n,a=t.y+r,o=e.x===t.x&&e.y===t.y,s=o||t.x>=e.x,c=s?e.x+Eu:e.x,l=s?t.x:t.x+Eu,u=o&&Math.abs(a-i)<1?a+24:a,d=Math.max(56,Math.abs(l-c)/2),f=s?c+d:c-d,p=s?l-d:l+d;return{path:`M ${c} ${i} C ${f} ${i}, ${p} ${u}, ${l} ${u}`,labelX:(c+3*f+3*p+l)/8,labelY:(i+3*i+3*u+u)/8}}function Pu({projectId:e,refreshKey:t}){let[n,r]=(0,h.useState)(null),[i,a]=(0,h.useState)(null),[o,s]=(0,h.useState)(0),[c,l]=(0,h.useState)(``),[u,d]=(0,h.useState)(null),[f,p]=(0,h.useState)({}),[m,g]=(0,h.useState)({x:48,y:40,k:1}),_=(0,h.useRef)(null),v=(0,h.useRef)(null);(0,h.useEffect)(()=>{let t=!1;async function n(){a(null);try{let n=gu(await U.consoleQuery(e,Ul())).filter(e=>e.type===`table`||e.type===`view`),i=await Promise.all(n.map(async t=>{let n=du(await U.consoleQuery(e,Wl(t.name)));if(t.type===`view`)return{name:t.name,kind:`view`,columns:n,foreignKeys:[]};let r=await U.consoleQuery(e,ql(t.name));return{name:t.name,kind:`table`,columns:n,foreignKeys:hu(r)}}));if(t)return;r(i)}catch(e){if(t)return;r(null),a(e instanceof ar?e.message:`Could not read the schema.`)}}return n(),()=>{t=!0}},[e,t,o]);let y=(0,h.useMemo)(()=>ju(n??[]),[n]);(0,h.useEffect)(()=>{let e={};for(let t of y)e[t.table.name]={x:t.x,y:t.y};p(e),d(null),g({x:48,y:40,k:1})},[y]);let b=(0,h.useMemo)(()=>{let e=1600,t=900;for(let n of y)e=Math.max(e,n.x+Eu+800),t=Math.max(t,n.y+Au(n.table.columns.length)+500);return{width:e,height:t}},[y]),x=(0,h.useMemo)(()=>{let e=new Map;for(let t of y)e.set(t.table.name,t);return e},[y]),S=(0,h.useMemo)(()=>{let e=[];for(let t of y)for(let n of t.table.foreignKeys){let r=x.get(n.referencesTable);if(!r)continue;let{fromY:i,toY:a}=Mu(t,r,n),o=n.columns[0]??``,s=n.referencesColumns[0]||`rowid`;e.push({key:`${t.table.name}.${o}->${n.referencesTable}.${s}`,from:t.table.name,to:n.referencesTable,fromY:i,toY:a,label:`${o} → ${s}`})}return e},[y,x]);(0,h.useEffect)(()=>{let e=_.current;if(!e)return;let t=t=>{t.preventDefault();let n=e.getBoundingClientRect(),r=t.clientX-n.left,i=t.clientY-n.top;g(e=>{let n=Math.min(2.4,Math.max(.3,e.k*Math.exp(-t.deltaY*.0015))),a=n/e.k;return{k:n,x:r-(r-e.x)*a,y:i-(i-e.y)*a}})};return e.addEventListener(`wheel`,t,{passive:!1}),()=>e.removeEventListener(`wheel`,t)},[]);let C=()=>{let e=_.current;if(!e||y.length===0)return;let t=1/0,n=1/0,r=-1/0,i=-1/0;for(let e of y){let a=f[e.table.name]??{x:e.x,y:e.y};t=Math.min(t,a.x),n=Math.min(n,a.y),r=Math.max(r,a.x+Eu),i=Math.max(i,a.y+Au(e.table.columns.length))}let a=r-t,o=i-n,s=Math.min(1.6,Math.max(.3,Math.min((e.clientWidth-96)/a,(e.clientHeight-96)/o)));g({k:s,x:(e.clientWidth-a*s)/2-t*s,y:(e.clientHeight-o*s)/2-n*s})},w=e=>{let t=_.current,n=t?t.clientWidth/2:0,r=t?t.clientHeight/2:0;g(t=>{let i=Math.min(2.4,Math.max(.3,t.k*e)),a=i/t.k;return{k:i,x:n-(n-t.x)*a,y:r-(r-t.y)*a}})},T=()=>{let e={};for(let t of y)e[t.table.name]={x:t.x,y:t.y};p(e),d(null),g({x:48,y:40,k:1})},E=e=>{_.current?.setPointerCapture(e.pointerId),v.current={mode:`pan`,startX:e.clientX,startY:e.clientY,originX:m.x,originY:m.y}},D=(e,t)=>{e.stopPropagation();let n=f[t];n&&(_.current?.setPointerCapture(e.pointerId),v.current={mode:`card`,name:t,startX:e.clientX,startY:e.clientY,originX:n.x,originY:n.y,moved:0})},ee=e=>{let t=v.current;if(!t)return;let n=e.clientX-t.startX,r=e.clientY-t.startY;if(t.mode===`pan`){g(e=>({...e,x:t.originX+n,y:t.originY+r}));return}t.moved=Math.max(t.moved,Math.hypot(n,r)),p(e=>({...e,[t.name]:{x:t.originX+n/m.k,y:t.originY+r/m.k}}))},O=()=>{let e=v.current;v.current=null,e?.mode===`card`&&e.moved<4&&d(t=>t===e.name?null:e.name)},te=c.trim().toLowerCase(),k=e=>te===``||e.toLowerCase().includes(te);if(i&&!n)return(0,V.jsxs)(`div`,{className:`rounded-xl border border-edge bg-panel px-6 py-12 text-center`,children:[(0,V.jsx)(`p`,{className:`text-sm text-muted`,children:i}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>s(e=>e+1),className:`mt-4 cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`Try again`})]});if(!n)return(0,V.jsx)(`div`,{className:`grid h-[420px] place-items-center rounded-xl border border-edge bg-panel`,children:(0,V.jsx)(`span`,{className:`h-6 w-6 animate-spin rounded-full border-2 border-accent-strong border-t-transparent`})});if(n.length===0)return(0,V.jsx)(`div`,{className:`grid h-[420px] place-items-center rounded-xl border border-dashed border-edge-strong bg-panel px-6 text-center`,children:(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`p`,{className:`text-lg font-semibold text-foreground`,children:`No tables yet`}),(0,V.jsx)(`p`,{className:`mx-auto mt-1 max-w-[36em] text-sm text-muted`,children:`Create one from the Tables tab or run a CREATE TABLE in the SQL Editor, and it will appear here with its columns and its relations.`})]})});let A=n.filter(e=>e.kind===`table`).length,ne=n.length-A;return(0,V.jsxs)(`div`,{className:`overflow-hidden rounded-xl border border-edge bg-panel`,children:[(0,V.jsxs)(`div`,{className:`flex flex-wrap items-center gap-3 border-b border-edge px-4 py-2.5`,children:[(0,V.jsx)(`input`,{type:`search`,value:c,onChange:e=>l(e.target.value),placeholder:`Find a table…`,"aria-label":`Find a table`,className:`w-44 rounded-lg border border-edge bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none`}),(0,V.jsxs)(`p`,{className:`text-[0.78rem] text-faint`,children:[A,` table`,A===1?``:`s`,ne>0&&` · ${ne} view${ne===1?``:`s`}`]}),(0,V.jsxs)(`div`,{className:`ml-auto flex items-center gap-1`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>w(1/1.25),"aria-label":`Zoom out`,className:`cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`−`}),(0,V.jsxs)(`span`,{className:`w-11 text-center font-mono text-[0.72rem] text-faint`,children:[Math.round(m.k*100),`%`]}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>w(1.25),"aria-label":`Zoom in`,className:`cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`+`}),(0,V.jsx)(`button`,{type:`button`,onClick:C,className:`ml-1 cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`Fit`}),(0,V.jsx)(`button`,{type:`button`,onClick:T,className:`cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`Reset`})]})]}),(0,V.jsxs)(`div`,{ref:_,onPointerDown:E,onPointerMove:ee,onPointerUp:O,onPointerCancel:O,className:`relative h-[600px] cursor-grab touch-none select-none overflow-hidden bg-background active:cursor-grabbing`,children:[(0,V.jsxs)(`div`,{className:`absolute left-0 top-0`,style:{width:b.width,height:b.height,transform:`translate(${m.x}px, ${m.y}px) scale(${m.k})`,transformOrigin:`0 0`},children:[(0,V.jsx)(`div`,{"aria-hidden":`true`,className:`absolute inset-0 opacity-60`,style:{backgroundImage:`linear-gradient(var(--color-edge) 1px, transparent 1px), linear-gradient(90deg, var(--color-edge) 1px, transparent 1px)`,backgroundSize:`40px 40px`}}),(0,V.jsx)(`svg`,{"aria-hidden":`true`,width:b.width,height:b.height,className:`absolute left-0 top-0 overflow-visible`,children:S.map(e=>{let t=f[e.from],n=f[e.to];if(!t||!n)return null;let r=Nu(t,n,e.fromY,e.toY),i=u===null||u===e.from||u===e.to;return(0,V.jsx)(`path`,{d:r.path,fill:`none`,className:u!==null&&i?`stroke-accent-strong stroke-2`:`stroke-edge-strong stroke-[1.5]`,opacity:i?1:.3},e.key)})}),u!==null&&S.filter(e=>e.from===u||e.to===u).map(e=>{let t=f[e.from],n=f[e.to];if(!t||!n)return null;let r=Nu(t,n,e.fromY,e.toY);return(0,V.jsx)(`div`,{className:`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-accent-strong px-1.5 py-0.5 font-mono text-[0.66rem] font-medium text-accent-ink`,style:{left:r.labelX,top:r.labelY},children:e.label},`label-${e.key}`)}),y.map(e=>{let t=e.table.name,n=f[t]??{x:e.x,y:e.y},r=u===null||u===t||S.some(e=>(e.from===u||e.to===u)&&(e.from===t||e.to===t)),i=!k(t)||!r,a=e.table.kind===`view`,o=new Set(e.table.foreignKeys.flatMap(e=>e.columns));return(0,V.jsxs)(`div`,{onPointerDown:e=>D(e,t),style:{left:n.x,top:n.y,width:Eu},className:`absolute cursor-grab rounded-lg border bg-panel shadow-sm active:cursor-grabbing ${a?`border-dashed border-edge-strong`:`border-edge`} ${u===t?`ring-2 ring-accent-strong`:``} ${i?`opacity-30`:`opacity-100`} transition-opacity`,children:[(0,V.jsxs)(`div`,{className:`flex h-10 items-center gap-2 border-b border-edge px-3`,children:[(0,V.jsx)(`span`,{className:`min-w-0 flex-1 truncate text-[0.83rem] font-semibold text-foreground`,children:t}),a&&(0,V.jsx)(`span`,{className:`rounded bg-panel-raised px-1.5 py-0.5 text-[0.64rem] font-medium uppercase tracking-wide text-muted`,children:`view`}),(0,V.jsx)(`span`,{className:`text-[0.68rem] text-faint`,children:e.table.columns.length})]}),(0,V.jsxs)(`div`,{className:`overflow-hidden rounded-b-lg`,children:[e.table.columns.map(e=>(0,V.jsxs)(`div`,{className:`flex h-[26px] items-center gap-1.5 px-3`,children:[e.primaryKey&&(0,V.jsx)(`span`,{className:`shrink-0 rounded bg-amber/15 px-1 text-[0.6rem] font-bold text-amber`,children:`PK`}),o.has(e.name)&&(0,V.jsx)(`span`,{className:`shrink-0 rounded bg-blue/15 px-1 text-[0.6rem] font-bold text-blue`,children:`FK`}),(0,V.jsx)(`span`,{className:`min-w-0 flex-1 truncate text-[0.76rem] text-foreground`,children:e.name}),e.type&&(0,V.jsx)(`span`,{className:`shrink-0 font-mono text-[0.64rem] text-faint`,children:e.type})]},e.name)),e.table.columns.length===0&&(0,V.jsx)(`div`,{className:`flex h-[26px] items-center px-3 text-[0.72rem] text-faint`,children:`no columns`})]})]},t)})]}),te!==``&&!n.some(e=>k(e.name))&&(0,V.jsx)(`div`,{className:`pointer-events-none absolute inset-x-0 bottom-4 flex justify-center`,children:(0,V.jsxs)(`span`,{className:`rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-muted`,children:[`No table named “`,c.trim(),`”`]})})]}),(0,V.jsx)(`div`,{className:`border-t border-edge px-4 py-2 text-[0.75rem] text-faint`,children:`Drag the background to pan, a card to move it, the wheel to zoom. Click a table to highlight its relations. Read-only — schema edits belong to the Tables tab.`})]})}var Fu=[{id:`any`,label:`Any file`,hint:`No restriction. This is the default for a new bucket.`},{id:`image`,label:`Images`,hint:`PNG, JPEG, GIF, WebP, SVG, and anything else sent as image/*.`},{id:`video`,label:`Videos`,hint:`MP4, WebM, QuickTime, and anything else sent as video/*.`},{id:`audio`,label:`Audio`,hint:`MP3, WAV, Ogg, FLAC, and anything else sent as audio/*.`},{id:`document`,label:`Documents`,hint:`PDF, Word, Excel, PowerPoint, OpenDocument, plain text.`},{id:`archive`,label:`Archives`,hint:`Zip, Gzip, Tar, 7z, Rar, Bzip2, Xz.`},{id:`file`,label:`Other files`,hint:`Everything the categories above do not cover: binaries, fonts, and the like.`}],Iu=new Set([`application/pdf`,`application/rtf`,`application/epub+zip`,`text/rtf`,`application/msword`,`application/vnd.openxmlformats-officedocument.wordprocessingml.document`,`application/vnd.ms-excel`,`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,`application/vnd.ms-powerpoint`,`application/vnd.openxmlformats-officedocument.presentationml.presentation`,`application/vnd.oasis.opendocument.text`,`application/vnd.oasis.opendocument.spreadsheet`,`application/vnd.oasis.opendocument.presentation`]),Lu=new Set([`application/zip`,`application/x-zip-compressed`,`application/gzip`,`application/x-gzip`,`application/x-tar`,`application/x-7z-compressed`,`application/x-rar-compressed`,`application/x-bzip2`,`application/x-xz`]);function Ru(e){let t=e.split(`;`)[0]?.trim().toLowerCase()??``;return t.startsWith(`image/`)?`image`:t.startsWith(`video/`)?`video`:t.startsWith(`audio/`)?`audio`:Iu.has(t)||t.startsWith(`text/`)?`document`:Lu.has(t)?`archive`:`file`}function zu(e,t){return e.length===0||e.includes(`any`)?!0:e.includes(Ru(t))}function Bu(e){if(e.length===0||e.includes(`any`)||e.includes(`file`))return;let t=[];return e.includes(`image`)&&t.push(`image/*`),e.includes(`video`)&&t.push(`video/*`),e.includes(`audio`)&&t.push(`audio/*`),e.includes(`document`)&&t.push(`text/*`,`application/pdf`,`application/msword`,`application/rtf`),e.includes(`archive`)&&t.push(`application/zip`,`application/gzip`,`application/x-tar`),t.length>0?t.join(`,`):void 0}function Vu(e){return e.length===0||e.includes(`any`)?`any file`:e.map(e=>Hu(e)).join(`, `)}function Hu(e){return Fu.find(t=>t.id===e)?.label??e}var Uu={KB:1024,MB:1048576};function Wu(e){return e>=Uu.MB&&e%Uu.MB===0?{amount:String(e/Uu.MB),unit:`MB`}:e>=Uu.MB?{amount:(e/Uu.MB).toFixed(2).replace(/\.?0+$/,``),unit:`MB`}:e>=Uu.KB&&e%Uu.KB===0?{amount:String(e/Uu.KB),unit:`KB`}:{amount:String(Math.round(e/Uu.KB)),unit:`KB`}}function Gu(e){let t=e.amount.trim();if(t===``)return 0;let n=Number(t);return!Number.isFinite(n)||n<0?null:Math.round(n*Uu[e.unit])}function Ku(e){if(e<=0)return`No limit`;let t=Wu(e),n=Number(t.amount);return`${Number.isInteger(n)?n:n.toFixed(2)} ${t.unit}`}function qu({object:e,onClose:t,onOpenPublic:n}){let[r,i]=(0,h.useState)(null),[a,o]=(0,h.useState)(null),s=Ju(e.content_type);return(0,h.useEffect)(()=>{function e(e){e.key===`Escape`&&t()}return window.addEventListener(`keydown`,e),()=>window.removeEventListener(`keydown`,e)},[t]),(0,h.useEffect)(()=>{if(s!==`text`){i(null),o(null);return}let t=new AbortController;return i(null),o(null),fetch(e.preview_url,{credentials:`same-origin`,signal:t.signal}).then(async e=>{if(!e.ok)throw Error(`the server answered ${e.status}`);let t=await e.text();i(t.slice(0,Xu))}).catch(e=>{e instanceof DOMException&&e.name===`AbortError`||o(e instanceof Error?e.message:`the file could not be loaded`)}),()=>t.abort()},[s,e.preview_url]),(0,V.jsx)(`div`,{role:`dialog`,"aria-modal":`true`,"aria-label":e.key,className:`fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-8`,onClick:t,children:(0,V.jsxs)(`div`,{className:`surface-raised flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl`,onClick:e=>e.stopPropagation(),children:[(0,V.jsxs)(`header`,{className:`flex items-start justify-between gap-4 border-b border-edge px-5 py-4`,children:[(0,V.jsxs)(`div`,{className:`min-w-0`,children:[(0,V.jsx)(`p`,{className:`truncate font-mono text-sm font-semibold text-foreground`,children:e.key}),(0,V.jsxs)(`p`,{className:`mt-1 text-xs text-muted`,children:[e.content_type,` · `,lr(e.size_bytes),e.is_public?` · public`:` · private`]})]}),(0,V.jsxs)(`div`,{className:`flex shrink-0 items-center gap-2`,children:[(0,V.jsx)(`a`,{href:e.preview_url,target:`_blank`,rel:`noopener noreferrer`,className:`rounded-md border border-edge-strong px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-panel-raised`,children:`Open`}),(0,V.jsx)(`a`,{href:e.preview_url,download:Z(e.key),className:`rounded-md border border-edge-strong px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-panel-raised`,children:`Download`}),(0,V.jsx)(`button`,{type:`button`,onClick:t,"aria-label":`Close preview`,className:`cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-panel-raised hover:text-foreground`,children:`Close`})]})]}),(0,V.jsxs)(`div`,{className:`grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_18rem]`,children:[(0,V.jsx)(`div`,{className:`flex min-h-64 items-center justify-center bg-panel-raised p-4`,children:(0,V.jsx)(Yu,{object:e,kind:s,text:r,error:a})}),(0,V.jsxs)(`dl`,{className:`space-y-4 border-t border-edge p-5 text-sm md:border-l md:border-t-0`,children:[(0,V.jsx)(X,{label:`Bucket`,children:e.bucket||`—`}),(0,V.jsx)(X,{label:`Uploaded`,children:new Date(e.created_at).toLocaleString()}),(0,V.jsx)(X,{label:`Modified`,children:new Date(e.updated_at).toLocaleString()}),(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`dt`,{className:`text-xs font-medium uppercase tracking-wide text-faint`,children:`Public URL`}),(0,V.jsx)(`dd`,{className:`mt-1.5`,children:e.is_public?(0,V.jsxs)(`button`,{type:`button`,onClick:n,className:`w-full cursor-pointer break-all rounded-md bg-panel-raised px-2.5 py-2 text-left font-mono text-xs text-accent-strong transition-colors hover:bg-hover-bg`,children:[e.public_url,(0,V.jsx)(`span`,{className:`mt-1 block text-[0.7rem] text-muted`,children:`click to open in a new tab`})]}):(0,V.jsx)(`p`,{className:`text-xs text-muted`,children:`This object is private. Publish it to get a link you can use on your own site.`})})]}),(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`dt`,{className:`text-xs font-medium uppercase tracking-wide text-faint`,children:`ETag`}),(0,V.jsx)(`dd`,{className:`mt-1 break-all font-mono text-xs text-muted`,children:e.etag})]})]})]})]})})}function Ju(e){let t=e.split(`;`)[0].trim().toLowerCase();return t===`image/svg+xml`?`none`:t.startsWith(`image/`)?`image`:t.startsWith(`video/`)?`video`:t.startsWith(`audio/`)?`audio`:t===`application/json`||t===`text/plain`||t===`text/markdown`||t===`text/csv`?`text`:`none`}function Yu({object:e,kind:t,text:n,error:r}){return t===`image`?(0,V.jsx)(`img`,{src:e.preview_url,alt:e.key,className:`max-h-[70vh] max-w-full rounded-md object-contain`}):t===`video`?(0,V.jsx)(`video`,{src:e.preview_url,controls:!0,className:`max-h-[70vh] max-w-full rounded-md`}):t===`audio`?(0,V.jsx)(`audio`,{src:e.preview_url,controls:!0,className:`w-full`}):t===`text`?r?(0,V.jsx)(`p`,{className:`text-sm text-amber`,children:r}):n===null?(0,V.jsx)(`p`,{className:`text-sm text-muted`,children:`Loading…`}):(0,V.jsx)(`pre`,{className:`max-h-[70vh] w-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-panel p-4 text-left font-mono text-xs text-foreground`,children:n}):(0,V.jsxs)(`div`,{className:`text-center`,children:[(0,V.jsxs)(`p`,{className:`text-sm text-muted`,children:[e.content_type,` cannot be shown here.`]}),(0,V.jsx)(`a`,{href:e.preview_url,className:`mt-3 inline-block rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-panel-raised`,children:`Download it instead`})]})}function X({label:e,children:t}){return(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`dt`,{className:`text-xs font-medium uppercase tracking-wide text-faint`,children:e}),(0,V.jsx)(`dd`,{className:`mt-1 text-foreground`,children:t})]})}var Xu=2e5;function Z(e){let t=e.split(`/`).filter(Boolean);return t[t.length-1]||e}var Q=100,Zu=[{id:`key`,label:`Name`},{id:`size`,label:`Size`},{id:`created`,label:`Uploaded`},{id:`updated`,label:`Modified`}],Qu={objects:[],total:0,used:0,quota:0};function $u(e){return e instanceof ar?e.message:`Something went wrong.`}function ed(e,t){if(!zu(t.allowed_types,e.type))return`“${e.name}” is not one of the ${Vu(t.allowed_types)} this bucket accepts.`;let n=t.max_object_size_bytes;if(n>0&&e.size>n)return`“${e.name}” is ${lr(e.size)}, over this bucket’s ${Ku(n)} limit.`;let r=t.quota_bytes-t.size_bytes;return r>0&&e.size>r?`“${e.name}” is ${lr(e.size)}, and this bucket has only ${lr(r)} left.`:null}function td({projectId:e,refreshKey:t,onRefresh:n}){let[r,i]=(0,h.useState)(null),[a,o]=(0,h.useState)(null),[s,c]=(0,h.useState)(``),[l,u]=(0,h.useState)(`key`),[d,f]=(0,h.useState)(`asc`),[p,m]=(0,h.useState)(0),[g,_]=(0,h.useState)(Qu),[v,y]=(0,h.useState)(null),[b,x]=(0,h.useState)(!0),[S,C]=(0,h.useState)(null),[w,T]=(0,h.useState)(null),[E,D]=(0,h.useState)(null),[ee,O]=(0,h.useState)(``),[te,k]=(0,h.useState)(!1),[A,ne]=(0,h.useState)(null),[re,ie]=(0,h.useState)(null),ae=(0,h.useRef)(null),oe=(0,h.useRef)(0),j=(0,h.useCallback)(async()=>{try{let t=await U.dashboardBuckets(e);i(t.buckets),o(e=>e&&t.buckets.some(t=>t.name===e)?e:t.buckets[0]?.name??null),y(null)}catch(e){i([]),y($u(e))}},[e]);(0,h.useEffect)(()=>{j()},[j,t]);let M=(0,h.useMemo)(()=>r?.find(e=>e.name===a)??null,[r,a]),N=(0,h.useMemo)(()=>({bucket:a??void 0,search:s.trim()||void 0,order:l,dir:d,limit:Q,offset:p*Q}),[a,s,l,d,p]),se=(0,h.useCallback)(async()=>{if(!a){_(Qu),x(!1);return}x(!0);try{let t=await U.dashboardBucketList(e,N);_({objects:t.objects,total:t.total,used:t.storage_used_bytes,quota:t.quota_bytes}),y(null)}catch(e){_({...Qu}),y($u(e))}finally{x(!1)}},[e,N,a]);(0,h.useEffect)(()=>{se()},[se]),(0,h.useEffect)(()=>{m(0)},[a,s,l,d]);let ce=(0,h.useCallback)(e=>{T(e),window.setTimeout(()=>T(null),2500)},[]),le=(0,h.useCallback)(async()=>{await Promise.all([j(),se()]),n()},[j,se,n]),ue=(0,h.useCallback)(async(t,n)=>{let r=t.filter(e=>ed(e,n)),i=t.filter(e=>!ed(e,n));if(i.length===0){ce(ed(t[0],n)??`That file cannot be uploaded here.`);return}r.length>0&&ce(`Skipped ${r.length} ${r.length===1?`file`:`files`}: ${ed(r[0],n)}`),C(`upload`);let a=0,o=``;for(let t of i)try{await U.dashboardBucketUpload(e,t.name,t,t.type||`application/octet-stream`,n.name)}catch(e){a+=1,o=$u(e)}C(null),a>0?ce(a===i.length?o:`Uploaded ${i.length-a}, ${a} failed. ${o}`):r.length===0&&ce(`Uploaded ${i.length} ${i.length===1?`file`:`files`}.`),await le()},[ce,e,le]),de=(0,h.useCallback)(async t=>{C(t.id);try{let n=await U.dashboardSetObjectPublic(e,t.key,!t.is_public);D(e=>e&&e.id===t.id?n.object:e),_(e=>({...e,objects:e.objects.map(e=>e.id===t.id?n.object:e)})),ce(n.object.is_public?`Published.`:`Made private.`),await j()}catch(e){ce($u(e))}finally{C(null)}},[ce,j,e]),fe=(0,h.useCallback)(async t=>{let n=window.prompt(`New key`,t.key);if(n!==null&&n.trim()!==``&&n!==t.key){C(t.id);try{await U.dashboardRenameObject(e,t.key,n.trim()),ce(`Renamed to ${n.trim()}.`),await le()}catch(e){ce($u(e))}finally{C(null)}}},[ce,e,le]),pe=(0,h.useCallback)(e=>{ne(e)},[]),me=(0,h.useCallback)(async t=>{C(t.id);try{await U.dashboardBucketDelete(e,t.key),ce(`Deleted ${t.key}.`),await le()}catch(e){ce($u(e))}finally{C(null),ne(null)}},[ce,e,le]),P=(0,h.useCallback)(async t=>{C(`bucket`);try{let n=await U.dashboardCreateBucket(e,t);O(``),await j(),o(n.bucket.name),ce(`Created bucket "${n.bucket.name}".`)}catch(e){ce($u(e))}finally{C(null)}},[ce,j,e]),F=(0,h.useCallback)(e=>{ie(e)},[]),he=(0,h.useCallback)(async t=>{C(`bucket`);try{await U.dashboardDeleteBucket(e,t.id),await j(),ce(`Deleted bucket "${t.name}".`)}catch(e){ce($u(e))}finally{C(null),ie(null)}},[ce,j,e]),ge=(0,h.useCallback)(async(e,t)=>{try{await navigator.clipboard.writeText(t),ce(`${e} copied.`)}catch{window.prompt(`Copy this:`,t)}},[ce]),_e=(0,h.useCallback)(e=>{e.preventDefault(),oe.current=0,k(!1);let t=Array.from(e.dataTransfer.files);t.length>0&&M&&ue(t,M)},[M,ue]),ve=Math.max(1,Math.ceil(g.total/Q));return(0,V.jsxs)(`div`,{className:`grid grid-cols-1 gap-4 lg:grid-cols-[15rem_1fr]`,onDragEnter:e=>{e.preventDefault(),oe.current+=1,k(!0)},onDragOver:e=>e.preventDefault(),onDragLeave:()=>{--oe.current,oe.current<=0&&(oe.current=0,k(!1))},onDrop:_e,children:[(0,V.jsx)(nd,{buckets:r,selected:a,busy:S===`bucket`,onSelect:o,onCreate:P,onDelete:F,newBucket:ee,setNewBucket:O}),(0,V.jsxs)(`div`,{className:`min-w-0`,children:[(0,V.jsxs)(`div`,{className:`mb-4 flex flex-wrap items-center justify-between gap-3`,children:[(0,V.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>ae.current?.click(),disabled:!a||S===`upload`,className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-faint hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50`,children:S===`upload`?`Uploading…`:`Upload files`}),(0,V.jsx)(`input`,{ref:ae,type:`file`,multiple:!0,accept:M?Bu(M.allowed_types):void 0,className:`sr-only`,onChange:e=>{let t=Array.from(e.target.files??[]);t.length>0&&M&&ue(t,M),e.target.value=``}}),(0,V.jsx)(B,{to:`/app/projects/${e}/bucket/settings${M?`?bucket=${encodeURIComponent(M.name)}`:``}`,"aria-disabled":!M,className:`rounded-lg border border-edge-strong px-4 py-2 text-sm text-muted transition-colors hover:border-faint hover:bg-panel ${M?`cursor-pointer`:`pointer-events-none opacity-50`}`,children:`Bucket settings`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>void le(),className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm text-muted transition-colors hover:border-faint hover:bg-panel`,children:`Refresh`})]}),(0,V.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,V.jsx)(`input`,{type:`search`,value:s,onChange:e=>c(e.target.value),placeholder:`Search by name`,"aria-label":`Search objects`,className:`w-44 rounded-lg border border-edge-strong bg-panel px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-accent-strong`}),(0,V.jsxs)(`select`,{value:`${l}:${d}`,onChange:e=>{let[t,n]=e.target.value.split(`:`);u(t),f(n)},"aria-label":`Sort objects`,className:`cursor-pointer rounded-lg border border-edge-strong bg-panel px-2.5 py-2 text-sm text-foreground`,children:[Zu.map(e=>(0,V.jsxs)(`option`,{value:`${e.id}:asc`,children:[e.label,` ↑`]},e.id)),Zu.map(e=>(0,V.jsxs)(`option`,{value:`${e.id}:desc`,children:[e.label,` ↓`]},`${e.id}-desc`))]})]})]}),M&&(0,V.jsxs)(`p`,{className:`mt-1.5 text-xs text-faint`,children:[`Accepts `,Vu(M.allowed_types),M.max_object_size_bytes>0&&(0,V.jsxs)(V.Fragment,{children:[` · up to `,Ku(M.max_object_size_bytes),` per file`]}),M.is_public&&(0,V.jsx)(V.Fragment,{children:` · new uploads are public`})]}),w&&(0,V.jsx)(`p`,{role:`status`,className:`mb-4 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-foreground`,children:w}),te&&(0,V.jsxs)(`div`,{className:`mb-4 rounded-xl border-2 border-dashed border-accent-strong bg-panel px-4 py-8 text-center text-sm font-medium text-accent-strong`,children:[`Drop the files to upload them to “`,a,`”`]}),v&&(0,V.jsx)(`p`,{role:`alert`,className:`rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber`,children:v}),!v&&b&&(0,V.jsx)(`div`,{className:`rounded-lg border border-edge bg-panel p-8 text-center text-muted`,children:`Loading…`}),!v&&!b&&g.objects.length===0&&(0,V.jsxs)(`div`,{className:`rounded-xl border border-dashed border-edge px-6 py-12 text-center`,children:[(0,V.jsxs)(`svg`,{className:`mx-auto mb-4 h-12 w-12 text-muted`,viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.5`,children:[(0,V.jsx)(`path`,{d:`M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-2.5l-1 1h-5l-1-1H4a2 2 0 01-2-2V6z`}),(0,V.jsx)(`path`,{d:`M6 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z`})]}),(0,V.jsx)(`p`,{className:`text-lg font-semibold`,children:s?`Nothing matches that search`:`No objects yet`}),(0,V.jsx)(`p`,{className:`mt-1 text-muted`,children:s?`Try a shorter search, or clear it to see everything.`:`Drag files here, or use Upload files.`})]}),!v&&g.objects.length>0&&(0,V.jsx)(rd,{objects:g.objects,busy:S,onPreview:D,onTogglePublic:de,onRename:fe,onDelete:pe,onCopy:ge}),g.total>Q&&(0,V.jsxs)(`div`,{className:`mt-4 flex items-center justify-between text-sm text-muted`,children:[(0,V.jsxs)(`span`,{children:[(p*Q+1).toLocaleString(),`–`,Math.min((p+1)*Q,g.total).toLocaleString(),` of`,` `,g.total.toLocaleString()]}),(0,V.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>m(e=>Math.max(0,e-1)),disabled:p===0,className:`cursor-pointer rounded-md border border-edge px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40`,children:`Previous`}),(0,V.jsxs)(`span`,{children:[p+1,` / `,ve]}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>m(e=>e+1),disabled:p+1>=ve,className:`cursor-pointer rounded-md border border-edge px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40`,children:`Next`})]})]})]}),(0,V.jsx)(hl,{open:A!==null,title:`Delete this object?`,description:`This cannot be undone.`,detail:A?.key,confirmLabel:`Delete`,busy:S===A?.id,onConfirm:()=>{A&&me(A)},onCancel:()=>ne(null)}),(0,V.jsx)(hl,{open:re!==null,title:`Delete this bucket?`,description:re?re.object_count>0?`Delete this bucket and its ${re.object_count===1?`1 object`:`${re.object_count} objects`}? This cannot be undone.`:`Delete this empty bucket?`:``,detail:re?.name,confirmLabel:`Delete bucket`,busy:S===`bucket`,onConfirm:()=>{re&&he(re)},onCancel:()=>ie(null)}),E&&(0,V.jsx)(qu,{object:E,onClose:()=>D(null),onOpenPublic:()=>E.public_url&&window.open(E.public_url,`_blank`)})]})}function nd({buckets:e,selected:t,busy:n,onSelect:r,onCreate:i,onDelete:a,newBucket:o,setNewBucket:s}){return(0,V.jsxs)(`aside`,{className:`rounded-xl border border-edge bg-panel p-3`,children:[(0,V.jsxs)(`div`,{className:`mb-3 flex items-center justify-between`,children:[(0,V.jsx)(`h3`,{className:`text-xs font-semibold uppercase tracking-wide text-faint`,children:`Buckets`}),(0,V.jsx)(`span`,{className:`text-xs text-faint`,children:e?.length??0})]}),e===null&&(0,V.jsx)(`p`,{className:`px-2 py-3 text-sm text-muted`,children:`Loading…`}),e!==null&&e.length===0&&(0,V.jsx)(`p`,{className:`px-2 py-3 text-sm text-muted`,children:`No buckets yet.`}),(0,V.jsx)(`ul`,{className:`space-y-0.5`,children:e?.map(e=>(0,V.jsx)(`li`,{children:(0,V.jsxs)(`div`,{className:`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors ${e.name===t?`bg-panel-raised text-foreground`:`text-muted hover:bg-panel-raised`}`,children:[(0,V.jsxs)(`button`,{type:`button`,onClick:()=>r(e.name),className:`min-w-0 flex-1 cursor-pointer text-left`,children:[(0,V.jsx)(`span`,{className:`block truncate text-sm font-medium`,children:e.name}),(0,V.jsxs)(`span`,{className:`block text-xs text-faint`,children:[e.object_count,` `,e.object_count===1?`object`:`objects`,` · `,lr(e.size_bytes)]})]}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>a(e),"aria-label":`Delete bucket ${e.name}`,disabled:n,className:`shrink-0 cursor-pointer rounded px-1.5 py-1 text-xs text-faint opacity-0 transition-opacity hover:text-amber focus-visible:opacity-100 disabled:opacity-40 group-hover:opacity-100`,children:`✕`})]})},e.id))}),(0,V.jsxs)(`form`,{className:`mt-3 border-t border-edge pt-3`,onSubmit:e=>{e.preventDefault(),o.trim()&&i(o.trim())},children:[(0,V.jsx)(`input`,{value:o,onChange:e=>s(e.target.value),placeholder:`New bucket name`,"aria-label":`New bucket name`,className:`w-full rounded-md border border-edge-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground placeholder:text-faint focus:border-accent-strong`}),(0,V.jsx)(`button`,{type:`submit`,disabled:n||o.trim()===``,className:`mt-2 w-full cursor-pointer rounded-md border border-edge-strong px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-panel-raised disabled:cursor-not-allowed disabled:opacity-50`,children:`Create bucket`})]})]})}function rd({objects:e,busy:t,onPreview:n,onTogglePublic:r,onRename:i,onDelete:a,onCopy:o}){return(0,V.jsx)(`div`,{className:`overflow-x-auto rounded-xl border border-edge`,children:(0,V.jsxs)(`table`,{className:`w-full border-collapse text-left text-sm`,children:[(0,V.jsx)(`thead`,{className:`bg-panel-raised`,children:(0,V.jsxs)(`tr`,{children:[(0,V.jsx)(`th`,{className:`whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground`,children:`Name`}),(0,V.jsx)(`th`,{className:`whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground`,children:`Size`}),(0,V.jsx)(`th`,{className:`whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground`,children:`Visibility`}),(0,V.jsx)(`th`,{className:`whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground`,children:`Uploaded`}),(0,V.jsx)(`th`,{className:`whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground`,children:`Actions`})]})}),(0,V.jsx)(`tbody`,{children:e.map(e=>(0,V.jsxs)(`tr`,{className:`odd:bg-panel even:bg-panel/40 border-b border-edge/60`,children:[(0,V.jsx)(`td`,{className:`px-4 py-3`,children:(0,V.jsxs)(`button`,{type:`button`,onClick:()=>n(e),className:`flex cursor-pointer items-center gap-2.5 text-left`,children:[(0,V.jsx)(`span`,{className:`shrink-0 rounded border border-edge bg-panel-raised px-1.5 py-0.5 font-mono text-[0.65rem] text-muted`,children:cr(e)}),(0,V.jsx)(`span`,{className:`truncate font-mono text-foreground`,children:e.key})]})}),(0,V.jsx)(`td`,{className:`whitespace-nowrap px-4 py-3 text-muted`,children:lr(e.size_bytes)}),(0,V.jsx)(`td`,{className:`whitespace-nowrap px-4 py-3`,children:(0,V.jsx)(`button`,{type:`button`,onClick:()=>r(e),disabled:t===e.id,title:e.is_public?`Reachable without a credential`:`Only reachable with a credential`,className:`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${e.is_public?`border-accent/40 bg-accent/10 text-accent-strong hover:bg-accent/20`:`border-edge text-muted hover:bg-panel-raised`}`,children:e.is_public?`Public`:`Private`})}),(0,V.jsx)(`td`,{className:`whitespace-nowrap px-4 py-3 text-muted`,children:new Date(e.created_at).toLocaleDateString()}),(0,V.jsx)(`td`,{className:`whitespace-nowrap px-4 py-3`,children:(0,V.jsxs)(`div`,{className:`flex items-center gap-1`,children:[e.is_public&&(0,V.jsx)(id,{label:`Copy URL`,onClick:()=>o(`Public URL`,e.public_url)}),(0,V.jsx)(id,{label:`Copy key`,onClick:()=>o(`Key`,or(e.key))}),(0,V.jsx)(id,{label:`Rename`,onClick:()=>i(e),disabled:t===e.id}),(0,V.jsx)(id,{label:`Delete`,onClick:()=>a(e),disabled:t===e.id,tone:`warn`})]})})]},e.id))})]})})}function id({label:e,onClick:t,disabled:n,tone:r}){return(0,V.jsx)(`button`,{type:`button`,onClick:t,disabled:n,className:`cursor-pointer rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-panel-raised disabled:cursor-not-allowed disabled:opacity-50 ${r===`warn`?`text-amber`:`text-muted`} hover:text-foreground`,children:e})}function ad(e){return{isPublic:e.is_public,allowed:e.allowed_types.length===0?[`any`]:[...e.allowed_types],maxSize:Wu(e.max_object_size_bytes)}}function od({projectId:e}){let[t,n]=On(),[r,i]=(0,h.useState)(null),[a,o]=(0,h.useState)(null),[s,c]=(0,h.useState)(null),[l,u]=(0,h.useState)(null),[d,f]=(0,h.useState)(!1),[p,m]=(0,h.useState)(!1),g=t.get(`bucket`),_=(0,h.useMemo)(()=>r?.find(e=>e.name===g)??r?.[0]??null,[r,g]),v=(0,h.useCallback)(async()=>{try{let t=await U.dashboardBuckets(e);i(t.buckets),o(null)}catch(e){i([]),o(ud(e))}},[e]);(0,h.useEffect)(()=>{v()},[v]),(0,h.useEffect)(()=>{c(_?ad(_):null),u(null)},[_]);let y=(0,h.useCallback)(e=>{m(!1),u(null),n({bucket:e},{replace:!0})},[n]),b=(0,h.useCallback)(e=>{m(!1),c(t=>{if(t===null)return t;if(e===`any`)return{...t,allowed:t.allowed.includes(`any`)?[]:[`any`]};let n=t.allowed.includes(e),r=t.allowed.filter(e=>e!==`any`);return n?{...t,allowed:r.filter(t=>t!==e)}:{...t,allowed:[...r,e]}})},[]),x=(0,h.useCallback)((e,t,n)=>{m(!1),u(null),c(r=>r===null?r:{...r,[e]:{...r[e],[t]:n}})},[]),S=(0,h.useCallback)(e=>{m(!1),c(t=>t===null?t:{...t,isPublic:e})},[]),C=(0,h.useCallback)(async()=>{if(_===null||s===null)return;if(s.allowed.length===0){u(`Pick at least one file type, or choose “Any file”.`);return}let t=Gu(s.maxSize);if(t===null){u(`That size has to be a number.`);return}f(!0),u(null);try{let n=await U.dashboardUpdateBucketSettings(e,_.id,{allowed_types:s.allowed,max_object_size_bytes:t,is_public:s.isPublic});i(e=>e?.map(e=>e.id===n.bucket.id?n.bucket:e)??e),m(!0)}catch(e){u(ud(e))}finally{f(!1)}},[_,s,e]);if(a)return(0,V.jsx)(`p`,{role:`alert`,className:`rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber`,children:a});if(r===null)return(0,V.jsx)(`p`,{className:`text-muted`,children:`Loading buckets…`});if(r.length===0)return(0,V.jsxs)(`div`,{className:`rounded-xl border border-dashed border-edge px-6 py-12 text-center`,children:[(0,V.jsx)(`p`,{className:`text-lg font-semibold`,children:`No buckets yet`}),(0,V.jsx)(`p`,{className:`mt-1 text-muted`,children:`Create one on the Bucket tab first.`}),(0,V.jsx)(B,{to:`/app/projects/${e}/bucket`,className:`mt-5 inline-block cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Go to Bucket`})]});if(_===null||s===null)return(0,V.jsx)(`p`,{className:`text-muted`,children:`Loading buckets…`});let w=Gu(s.maxSize),T=w===0?`No per-file limit. An upload is bounded by the bucket quota instead.`:w===null?`That has to be a number.`:`Files over ${Ku(w)} are refused.`;return(0,V.jsxs)(`div`,{className:`space-y-5`,children:[(0,V.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-3`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`h2`,{className:`text-lg font-semibold tracking-tight`,children:`Bucket settings`}),(0,V.jsxs)(`p`,{className:`mt-0.5 text-sm text-muted`,children:[`These apply to `,(0,V.jsx)(`span`,{className:`font-mono text-foreground`,children:_.name}),` and are enforced on every upload, not just the ones from this dashboard.`]})]}),(0,V.jsx)(`select`,{value:_.name,onChange:e=>y(e.target.value),"aria-label":`Bucket to edit`,className:`cursor-pointer rounded-lg border border-edge-strong bg-panel px-3 py-2 text-sm text-foreground`,children:r.map(e=>(0,V.jsx)(`option`,{value:e.name,children:e.name},e.id))})]}),(0,V.jsxs)(`section`,{className:`rounded-xl border border-edge bg-panel p-5`,children:[(0,V.jsx)(ld,{children:`Visibility`}),(0,V.jsx)(`p`,{className:`mt-2 max-w-[68ch] text-[0.82rem] font-medium leading-relaxed text-muted`,children:`This is the default for new uploads. Turning a bucket off makes the objects already in it private as well — each file can then be published again on its own from the Bucket tab. Replacing an existing file never changes its visibility either way.`}),(0,V.jsxs)(`div`,{className:`mt-4 grid gap-2 sm:grid-cols-2`,children:[(0,V.jsx)(cd,{chosen:s.isPublic,onChoose:()=>S(!0),title:`Public`,detail:`New uploads are reachable by their URL without a credential.`}),(0,V.jsx)(cd,{chosen:!s.isPublic,onChoose:()=>S(!1),title:`Private`,detail:`New uploads need the bucket credential to read.`})]})]}),(0,V.jsxs)(`section`,{className:`rounded-xl border border-edge bg-panel p-5`,children:[(0,V.jsx)(ld,{children:`Allowed file types`}),(0,V.jsxs)(`p`,{className:`mt-2 max-w-[68ch] text-[0.82rem] font-medium leading-relaxed text-muted`,children:[`Check every kind of file this bucket should take. Anything outside the selection is refused at upload time. Currently accepts `,Vu(s.allowed),`.`]}),(0,V.jsx)(`div`,{className:`mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3`,children:Fu.map(e=>{let t=s.allowed.includes(e.id);return(0,V.jsxs)(`button`,{type:`button`,onClick:()=>b(e.id),className:`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors text-left w-full ${t?`border-accent-strong bg-accent-strong/5`:`border-edge hover:border-edge-strong hover:bg-hover-bg`}`,children:[(0,V.jsx)(`span`,{className:`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${t?`border-accent-strong bg-accent-strong text-accent-ink`:`border-edge-strong bg-transparent text-transparent`}`,children:t&&(0,V.jsx)(`svg`,{viewBox:`0 0 16 16`,fill:`none`,stroke:`currentColor`,strokeWidth:`2.5`,className:`h-3 w-3`,children:(0,V.jsx)(`path`,{d:`M3 8l3 3 7-7`,strokeLinecap:`round`,strokeLinejoin:`round`})})}),(0,V.jsxs)(`span`,{className:`min-w-0`,children:[(0,V.jsx)(`span`,{className:`block text-sm font-semibold text-foreground`,children:e.label}),(0,V.jsx)(`span`,{className:`mt-0.5 block text-xs font-medium leading-relaxed text-muted`,children:e.hint})]})]},e.id)})})]}),(0,V.jsxs)(`section`,{className:`rounded-xl border border-edge bg-panel p-5`,children:[(0,V.jsx)(ld,{children:`Limits`}),(0,V.jsxs)(`div`,{className:`mt-4 flex items-end gap-4 flex-wrap`,children:[(0,V.jsx)(sd,{label:`Maximum file size`,parts:s.maxSize,onChange:(e,t)=>x(`maxSize`,e,t),hint:T}),(0,V.jsxs)(`div`,{className:`flex-1 min-w-[240px] flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted rounded-lg bg-background border border-edge`,children:[(0,V.jsx)(`span`,{children:`Every bucket shares the project-wide storage limit from your plan.`}),(0,V.jsx)(`a`,{href:`/plan`,className:`ml-auto cursor-pointer rounded-lg bg-accent-strong px-3 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent whitespace-nowrap`,children:`See our pricing`})]})]})]}),l&&(0,V.jsx)(`p`,{role:`alert`,className:`rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber`,children:l}),(0,V.jsxs)(`div`,{className:`flex flex-wrap items-center gap-3`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>void C(),disabled:d,className:`cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:d?`Saving…`:`Save settings`}),(0,V.jsx)(B,{to:`/app/projects/${e}/bucket`,className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`Back to Bucket`}),p&&(0,V.jsx)(`span`,{role:`status`,className:`text-sm font-medium text-muted`,children:`Saved.`})]})]})}function sd({label:e,parts:t,onChange:n,hint:r}){return(0,V.jsxs)(`div`,{className:`max-w-[280px]`,children:[(0,V.jsx)(`label`,{className:`block text-sm font-semibold text-foreground`,children:e}),(0,V.jsxs)(`div`,{className:`mt-2 flex items-stretch`,children:[(0,V.jsx)(`input`,{type:`number`,min:0,step:1,value:t.amount,onChange:e=>n(`amount`,e.target.value),placeholder:`0`,"aria-label":e,className:`w-[90px] min-w-0 rounded-l-lg border border-edge-strong bg-background px-3 py-2 text-sm text-foreground focus:border-accent-strong`}),(0,V.jsxs)(`select`,{value:t.unit,onChange:e=>n(`unit`,e.target.value),"aria-label":`${e} unit`,className:`cursor-pointer w-[70px] rounded-r-lg border border-l-0 border-edge-strong bg-panel px-2 py-2 text-sm text-foreground`,children:[(0,V.jsx)(`option`,{value:`KB`,children:`KB`}),(0,V.jsx)(`option`,{value:`MB`,children:`MB`})]})]}),(0,V.jsx)(`p`,{className:`mt-1.5 text-xs font-medium leading-relaxed text-muted`,children:r})]})}function cd({chosen:e,onChoose:t,title:n,detail:r}){return(0,V.jsxs)(`label`,{className:`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${e?`border-accent-strong bg-accent-strong/5`:`border-edge hover:border-edge-strong hover:bg-hover-bg`}`,children:[(0,V.jsx)(`input`,{type:`radio`,checked:e,onChange:t,"aria-label":n,className:`mt-1 h-4 w-4 shrink-0 accent-[var(--accent-strong)]`}),(0,V.jsxs)(`span`,{className:`min-w-0`,children:[(0,V.jsx)(`span`,{className:`block text-sm font-semibold text-foreground`,children:n}),(0,V.jsx)(`span`,{className:`mt-0.5 block text-xs font-medium leading-relaxed text-muted`,children:r})]})]})}function ld({children:e}){return(0,V.jsx)(`h3`,{className:`text-xs font-bold uppercase tracking-wider text-faint`,children:e})}function ud(e){return e instanceof ar?e.message:`Something went wrong.`}function dd({projectId:e}){let[t,n]=(0,h.useState)([]),[r,i]=(0,h.useState)(5),[a,o]=(0,h.useState)(!0),[s,c]=(0,h.useState)(null),[l,u]=(0,h.useState)(null),[d,f]=(0,h.useState)(null),[p,m]=(0,h.useState)(!1),[g,_]=(0,h.useState)(null),v=(0,h.useCallback)(async()=>{o(!0),u(null);try{let t=await U.storageCredentials(e);n(t.credentials),i(t.limit)}catch(e){u(e instanceof ar?e.message:`Could not load credentials.`)}finally{o(!1)}},[e]);(0,h.useEffect)(()=>{v()},[v]);let y=(0,h.useCallback)(async()=>{c(`new`),u(null);try{f(await U.createStorageCredential(e,``)),await v()}catch(e){u(e instanceof ar?e.message:`Could not create a credential.`)}finally{c(null)}},[e,v]),b=(0,h.useCallback)(e=>{_({action:`rotate`,credential:e})},[]),x=(0,h.useCallback)(async t=>{c(t.id),u(null);try{f(await U.rotateStorageCredential(e,t.id)),await v()}catch(e){u(e instanceof ar?e.message:`Could not rotate the secret.`)}finally{c(null),_(null)}},[e,v]),S=(0,h.useCallback)(e=>{_({action:`revoke`,credential:e})},[]),C=(0,h.useCallback)(async t=>{c(t.id),u(null);try{await U.revokeStorageCredential(e,t.id),await v()}catch(e){u(e instanceof ar?e.message:`Could not revoke the credential.`)}finally{c(null),_(null)}},[e,v]),w=(0,h.useCallback)(async()=>{if(!d)return;let{MOOGO_BUCKET_ENDPOINT:e,MOOGO_BUCKET_ACCESS_KEY_ID:t,MOOGO_BUCKET_SECRET_KEY:n}=d.env,r=[`MOOGO_BUCKET_ENDPOINT=${e}`,`MOOGO_BUCKET_ACCESS_KEY_ID=${t}`,`MOOGO_BUCKET_SECRET_KEY=${n}`].join(`
`);try{await navigator.clipboard.writeText(r),m(!0),setTimeout(()=>m(!1),2e3)}catch{}},[d]),T=t.filter(e=>e.active).length;return(0,V.jsxs)(`div`,{className:`space-y-4`,children:[(0,V.jsx)(`p`,{className:`text-[0.8rem] font-medium leading-relaxed text-muted`,children:`A credential authorizes object storage only. Create one per application — a web deploy, a mobile build, a backup job — so you can revoke one without touching the others or your SQL key. The secret is shown once, at creation and at each rotation.`}),d&&(0,V.jsxs)(`div`,{className:`rounded-lg border border-accent-strong/40 bg-accent-strong/10 p-4`,children:[(0,V.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-wider text-accent`,children:`New storage credential`}),(0,V.jsx)(`p`,{className:`mt-2 text-[0.8rem] font-medium text-muted`,children:`Put these in your application's environment now. The secret will not be shown again — rotate if you lose it.`}),(0,V.jsx)(`div`,{className:`mt-3 space-y-2`,children:Object.entries(d.env).map(([e,t])=>(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-background px-4 py-3`,children:[(0,V.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-wider text-muted`,children:e}),(0,V.jsx)(`code`,{className:`mt-1 block break-all font-mono text-sm font-medium text-foreground`,children:t})]},e))}),(0,V.jsxs)(`div`,{className:`mt-3 flex gap-2`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:w,className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-hover-edge`,children:p?`Copied`:`Copy all three`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>f(null),className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`I have saved it`})]})]}),a?(0,V.jsx)(`p`,{className:`text-sm text-muted`,children:`Loading credentials…`}):t.length===0?(0,V.jsx)(`p`,{className:`rounded-lg border border-dashed border-edge-strong px-4 py-6 text-center text-sm font-medium text-muted`,children:`No storage credentials yet. Without one, applications cannot reach your bucket.`}):(0,V.jsx)(`ul`,{className:`space-y-2`,children:t.map(e=>(0,V.jsxs)(`li`,{className:`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-2.5 ${e.active?`border-edge bg-background`:`border-edge bg-panel-raised opacity-60`}`,children:[(0,V.jsx)(`code`,{className:`min-w-0 flex-1 truncate font-mono text-sm text-foreground`,children:e.access_key_id}),(0,V.jsxs)(`span`,{className:`text-xs text-faint`,children:[`secret `,e.secret_key_preview,`… ·`,` `,e.revoked_at?`revoked ${new Date(e.revoked_at).toLocaleDateString()}`:e.rotated_at?`rotated ${new Date(e.rotated_at).toLocaleDateString()}`:`created ${new Date(e.created_at).toLocaleDateString()}`]}),e.active?(0,V.jsxs)(`div`,{className:`flex shrink-0 gap-1.5`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>b(e),disabled:s===e.id,title:`Issue a new secret. The access key id stays the same.`,className:`cursor-pointer rounded-md border border-edge px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50`,children:s===e.id?`…`:`Rotate`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>S(e),disabled:s===e.id,title:`Stop working immediately. Your SQL key is unaffected.`,className:`cursor-pointer rounded-md border border-amber/40 px-2.5 py-1 text-xs font-semibold text-amber transition-colors hover:border-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-50`,children:`Revoke`})]}):(0,V.jsx)(`span`,{className:`shrink-0 rounded-md bg-panel-raised px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-muted`,children:`revoked`})]},e.id))}),(0,V.jsx)(`button`,{type:`button`,onClick:y,disabled:s!==null||T>=r,className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50`,children:s===`new`?`Creating…`:T>=r?`Limit reached (${T}/${r}) — revoke one first`:`New credential`}),l&&(0,V.jsx)(`p`,{role:`alert`,className:`rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-medium text-amber`,children:l}),(0,V.jsx)(hl,{open:g?.action===`rotate`,title:`Rotate the secret?`,description:`The access key id stays the same, but the current secret stops working immediately.`,detail:g?.credential.access_key_id,confirmLabel:`Rotate secret`,busy:s!==null&&s===g?.credential.id,onConfirm:()=>{g&&x(g.credential)},onCancel:()=>_(null)}),(0,V.jsx)(hl,{open:g?.action===`revoke`,title:`Revoke this credential?`,description:`Anything still using it will lose storage access immediately. Your SQL key is not affected.`,detail:g?.credential.access_key_id,confirmLabel:`Revoke`,busy:s!==null&&s===g?.credential.id,onConfirm:()=>{g&&C(g.credential)},onCancel:()=>_(null)})]})}function fd({project:e,onProjectUpdated:t,onProjectDeleted:n}){let[r,i]=(0,h.useState)(!1),[a,o]=(0,h.useState)(!1),[s,c]=(0,h.useState)(!1),[l,u]=(0,h.useState)(!1),[d,f]=(0,h.useState)(!1),[p,m]=(0,h.useState)(null),[g,_]=(0,h.useState)(null),[v,y]=(0,h.useState)(!1),[b,x]=(0,h.useState)(null),S=`${Vn()}/p/${e.id}`,C=e.status===`paused`,w=[{name:`MOOGO_PROJECT_URL`,value:S},{name:`MOOGO_PROJECT_ID`,value:e.id},{name:`MOOGO_BUCKET_ENDPOINT`,value:`${S}/bucket`}],T=(0,h.useCallback)(()=>`You are helping me build with Moogo — a service that gives each project a SQLite database and object storage over HTTP. This is the Moogo project I am working on:

PROJECT_URL: ${S}
PROJECT_ID: ${e.id}

These live in my project's environment already:
  MOOGO_PROJECT_URL=${S}
  MOOGO_PROJECT_ID=${e.id}
  MOOGO_SECRET_KEY=... (SQL only; read it from the environment, never ask me to paste it, never print it)
  MOOGO_BUCKET_ACCESS_KEY_ID=... (object storage only)
  MOOGO_BUCKET_SECRET_KEY=... (object storage only)

SQL — endpoints relative to PROJECT_URL, authorized with MOOGO_SECRET_KEY:
  POST ${S}/query  — reads only (SELECT, PRAGMA, EXPLAIN). Returns rows.
  POST ${S}/exec   — writes only (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP). Returns rows_affected.
    Headers: Authorization: Bearer $MOOGO_SECRET_KEY
    Body:    {"query": "<SQL with ? for parameters>", "args": [<values>]}

Object storage — endpoints relative to MOOGO_BUCKET_ENDPOINT, which is
${S}/bucket, authorized with the bucket credential, NOT the SQL key:
  POST   {MOOGO_BUCKET_ENDPOINT}/{key}   — upload
  GET    {MOOGO_BUCKET_ENDPOINT}/{key}   — download
  DELETE {MOOGO_BUCKET_ENDPOINT}/{key}   — delete
  GET    {MOOGO_BUCKET_ENDPOINT}         — list objects
    Headers: X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID
             Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY

Rules:
  - The two credentials are not interchangeable. Using MOOGO_SECRET_KEY on a bucket
    request gets 401, and using the bucket credential on SQL gets 401.
  - Parameters are bound as prepared-statement arguments, never concatenated into SQL.
  - /query accepts read statements only; /exec accepts writes only.
  - Stacked statements (a; b) are rejected.
  - File access (readfile, writefile, load_extension) is rejected.
  - Read the credentials from the environment. Do not ask me to paste them.

Response format:
  query: {"success": true, "columns": [...], "rows": [[...]], "row_count": N, "truncated": bool, "duration_ms": N}
  exec:  {"success": true, "rows_affected": N, "row_count": N, "duration_ms": N}
  error: {"error": {"code": "...", "message": "...", "detail": "..."}}

What I want to do:`,[e.id,S]),E=(0,h.useCallback)(async()=>{let e=T();try{await navigator.clipboard.writeText(e),i(!0),setTimeout(()=>i(!1),3e3)}catch{alert(`Could not copy to clipboard. Copy the prompt manually:

`+e)}},[T]),D=(0,h.useCallback)(async()=>{if(g)try{await navigator.clipboard.writeText(g),y(!0),setTimeout(()=>y(!1),2e3)}catch{}},[g]),ee=(0,h.useCallback)(async()=>{o(!0),m(null);try{await U.pauseProject(e.id),t({...e,status:`paused`})}catch(e){m(e instanceof Error?e.message:`Could not pause project.`)}finally{o(!1)}},[e,t]),O=(0,h.useCallback)(async()=>{c(!0),m(null);try{t(await U.resumeProject(e.id))}catch(e){m(e instanceof Error?e.message:`Could not resume project.`)}finally{c(!1)}},[e,t]),te=(0,h.useCallback)(()=>{x(`rotate-key`)},[]),k=(0,h.useCallback)(async()=>{u(!0),m(null);try{let n=await U.rotateKey(e.id);_(n.secret_key),y(!1),t({...e,secret_key_prefix:n.secret_key_prefix})}catch(e){m(e instanceof Error?e.message:`Could not rotate the key.`)}finally{u(!1),x(null)}},[e,t]),A=(0,h.useCallback)(()=>{x(`delete`)},[]),ne=(0,h.useCallback)(async()=>{f(!0),m(null);try{await U.deleteProject(e.id),n()}catch(e){m(e instanceof Error?e.message:`Could not delete the project.`)}finally{f(!1),x(null)}},[e,n]);return(0,V.jsxs)(`div`,{className:`space-y-12`,children:[(0,V.jsxs)(`section`,{children:[(0,V.jsx)(pd,{children:`Your environment`}),(0,V.jsx)(`p`,{className:`mt-2 text-[0.8rem] font-medium text-muted`,children:`Put these in your own project so it can reach this database. The secret key is shown once at creation and once per rotation — it is never stored here.`}),(0,V.jsxs)(`div`,{className:`mt-3 space-y-3`,children:[w.map(e=>(0,V.jsx)(hd,{label:e.name,value:e.value},e.name)),(0,V.jsx)(hd,{label:`MOOGO_SECRET_KEY`,value:e.secret_key_prefix,masked:!0})]})]}),g&&(0,V.jsxs)(`section`,{className:`rounded-lg border border-accent-strong/40 bg-accent-strong/10 p-4`,children:[(0,V.jsx)(pd,{accent:!0,children:`New secret key`}),(0,V.jsxs)(`p`,{className:`mt-2 text-[0.8rem] font-medium text-muted`,children:[`Put this in your project as `,(0,V.jsx)(`code`,{children:`MOOGO_SECRET_KEY`}),` now. It will not be shown again — if you lose it, rotate once more.`]}),(0,V.jsxs)(`div`,{className:`mt-3 flex items-center gap-2`,children:[(0,V.jsx)(`code`,{className:`min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-edge bg-background px-3 py-2 font-mono text-sm text-foreground`,children:g}),(0,V.jsx)(`button`,{type:`button`,onClick:D,className:`shrink-0 cursor-pointer rounded-md border border-edge-strong px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:v?`Copied`:`Copy`})]}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>_(null),className:`mt-3 cursor-pointer text-xs font-semibold text-muted underline decoration-2 underline-offset-2 hover:text-foreground`,children:`I have saved it, hide it`})]}),(0,V.jsxs)(`section`,{children:[(0,V.jsx)(pd,{children:`Backup`}),(0,V.jsx)(`p`,{className:`mt-2 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted`,children:`Download a copy of this project's database as a single SQLite file. It is a consistent snapshot taken at the moment you click, so it can be opened with any SQLite tool or restored into another project.`}),(0,V.jsx)(`div`,{className:`mt-3`,children:(0,V.jsx)(`a`,{href:U.databaseBackupUrl(e.id),className:`inline-block cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,download:!0,children:`Download database`})})]}),(0,V.jsxs)(`section`,{children:[(0,V.jsx)(pd,{children:`Storage credentials`}),(0,V.jsx)(`div`,{className:`mt-3`,children:(0,V.jsx)(dd,{projectId:e.id})})]}),(0,V.jsxs)(`section`,{children:[(0,V.jsx)(pd,{children:`Hand it to an AI`}),(0,V.jsx)(`div`,{className:`mt-3 flex flex-wrap items-center gap-2`,children:(0,V.jsx)(`button`,{type:`button`,onClick:E,className:`cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:r?`✓ Prompt copied`:`Use prompt for AI`})}),(0,V.jsx)(`p`,{className:`mt-2 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted`,children:`Copies a prompt describing the endpoints, the request format, and the environment variables. It points the assistant at your environment instead of carrying the secret key, so the key never leaves your machine.`})]}),(0,V.jsxs)(`section`,{children:[(0,V.jsx)(pd,{children:`Project actions`}),(0,V.jsxs)(`div`,{className:`mt-3 flex flex-wrap items-center gap-2`,children:[C?(0,V.jsx)(md,{onClick:O,busy:s,label:s?`Resuming…`:`Resume`}):(0,V.jsx)(md,{onClick:ee,busy:a,disabled:e.status!==`ready`,label:a?`Pausing…`:`Pause`}),(0,V.jsx)(md,{onClick:te,busy:l,label:l?`Rotating…`:`Rotate secret key`}),(0,V.jsx)(md,{onClick:A,busy:d,danger:!0,label:d?`Deleting…`:`Delete project`})]}),(0,V.jsx)(`p`,{className:`mt-3 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted`,children:`Pausing keeps the data but rejects every query and bucket request until you resume. Rotating shows a new secret key once. Deleting removes the database and its files for good.`})]}),p&&(0,V.jsx)(`div`,{role:`alert`,className:`rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber`,children:p}),(0,V.jsx)(hl,{open:b===`rotate-key`,title:`Rotate the secret key?`,description:`The previous key is invalidated immediately. Anything still using it will stop working.`,confirmLabel:`Rotate key`,busy:l,onConfirm:k,onCancel:()=>x(null)}),(0,V.jsx)(hl,{open:b===`delete`,title:`Delete this project?`,description:`Its database and every file in it are removed. This cannot be undone.`,detail:e.name,confirmLabel:`Delete project`,busy:d,onConfirm:ne,onCancel:()=>x(null)})]})}function pd({children:e,accent:t}){return(0,V.jsx)(`h2`,{className:`text-xs font-bold uppercase tracking-wider ${t?`text-accent`:`text-faint`}`,children:e})}function md({onClick:e,busy:t,disabled:n,danger:r,label:i}){return(0,V.jsx)(`button`,{type:`button`,onClick:e,disabled:t||n,className:`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${r?`border-amber/40 text-amber hover:border-amber hover:bg-amber/20`:`border-edge-strong text-muted hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`}`,children:i})}function hd({label:e,value:t,masked:n}){let[r,i]=(0,h.useState)(!1),a=(0,h.useCallback)(async()=>{try{await navigator.clipboard.writeText(t),i(!0),setTimeout(()=>i(!1),2e3)}catch{}},[t]);return(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`p`,{className:`mb-1 text-xs font-bold uppercase tracking-wider text-muted`,children:e}),(0,V.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,V.jsxs)(`code`,{className:`min-w-0 flex-1 overflow-hidden rounded-lg border border-edge bg-background px-3 py-2 font-mono text-sm font-medium text-foreground`,children:[t,n&&(0,V.jsx)(`span`,{className:`ml-2 not-italic text-faint`,children:`(not stored)`})]}),(0,V.jsx)(`button`,{type:`button`,onClick:a,disabled:n,className:`shrink-0 cursor-pointer rounded-md border border-edge-strong px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40`,"aria-label":`Copy ${e} to clipboard`,children:r?`Copied`:`Copy`})]})]})}function gd(e){let t=e.get(`tab`);return t===`visual`?`visual`:t===`tables`?`tables`:`sql`}function _d(){let{id:e}=dt(),t=it(),[n,r]=(0,h.useState)(null),[i,a]=(0,h.useState)(!0),[o,s]=(0,h.useState)(null),[c,l]=On(),[u,d]=(0,h.useState)(()=>gd(c)),[f,p]=(0,h.useState)(0),m=st();(0,h.useEffect)(()=>{d(gd(c))},[c]);let g=(0,h.useCallback)(e=>{d(e),l(e===`sql`?{}:{tab:e},{replace:!0})},[l]);(0,h.useEffect)(()=>{if(!e)return;let t=e,n=!1;async function i(){a(!0),s(null);try{let e=(await U.projects()).projects.find(e=>e.id===t)??null;if(n)return;r(e)}catch(e){n||s(e instanceof ar?e.message:`Could not load the project.`)}finally{n||a(!1)}}return i(),()=>{n=!0}},[e]);let _=n?.status===`paused`,v=t.pathname.endsWith(`/bucket/settings`),y=v||t.pathname.endsWith(`/bucket`)?`bucket`:t.pathname.endsWith(`/settings`)?`settings`:`database`,b=(0,h.useCallback)(t=>{m(`/app/projects/${e}/${t}`)},[e,m]),x=(0,h.useCallback)(e=>{r(e)},[]),S=(0,h.useCallback)(()=>{m(`/app`)},[m]);return!i&&n&&t.pathname===`/app/projects/${e}`?(0,V.jsx)(Nt,{to:`/app/projects/${e}/database`,replace:!0}):(0,V.jsxs)(`div`,{className:`page-shell`,children:[i&&(0,V.jsx)(`p`,{className:`text-muted`,children:`Loading project…`}),!i&&o&&(0,V.jsx)(`div`,{role:`alert`,className:`mb-6 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber`,children:o}),!i&&!o&&!n&&(0,V.jsxs)(`div`,{className:`rounded-xl border border-edge bg-panel px-6 py-10 text-center`,children:[(0,V.jsx)(`p`,{className:`text-lg font-semibold text-foreground`,children:`Project not found`}),(0,V.jsx)(`p`,{className:`mt-1 text-sm text-muted`,children:`It may have been deleted, or the link is wrong.`}),(0,V.jsx)(B,{to:`/app`,className:`mt-5 inline-block cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Back to projects`})]}),!i&&n&&(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`nav`,{"aria-label":`Breadcrumb`,className:`mb-4`,children:(0,V.jsxs)(`ol`,{className:`flex flex-wrap items-center gap-1.5 text-[0.82rem] font-medium text-muted`,children:[(0,V.jsx)(`li`,{children:(0,V.jsx)(B,{to:`/app`,className:`rounded transition-colors hover:text-foreground`,children:`Moogo`})}),(0,V.jsx)(`li`,{"aria-hidden":`true`,className:`select-none text-faint`,children:`/`}),(0,V.jsx)(`li`,{children:(0,V.jsx)(B,{to:`/app/projects`,className:`rounded transition-colors hover:text-foreground`,children:`Projects`})}),(0,V.jsx)(`li`,{"aria-hidden":`true`,className:`select-none text-faint`,children:`/`}),(0,V.jsx)(`li`,{"aria-current":`page`,className:`max-w-[32ch] truncate text-foreground`,children:n.name})]})}),(0,V.jsxs)(`div`,{className:`mb-5 flex flex-wrap items-center gap-x-3 gap-y-2`,children:[(0,V.jsx)(`h1`,{className:`text-2xl font-semibold tracking-tight`,children:n.name}),(0,V.jsx)(bd,{status:n.status}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>b(`settings`),className:`ml-auto cursor-pointer rounded-lg border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:`Settings`})]}),(0,V.jsxs)(`div`,{role:`tablist`,"aria-label":`Project sections`,className:`mb-5 mt-5 flex gap-1 border-b border-edge`,children:[(0,V.jsx)(vd,{active:y===`database`,onClick:()=>b(`database`),children:`Database`}),(0,V.jsx)(vd,{active:y===`bucket`,onClick:()=>b(`bucket`),children:`Bucket`}),(0,V.jsx)(vd,{active:y===`settings`,onClick:()=>b(`settings`),children:`Settings`})]}),y===`settings`?(0,V.jsx)(`div`,{className:`rounded-xl border border-edge bg-panel p-6`,children:(0,V.jsx)(fd,{project:n,onProjectUpdated:x,onProjectDeleted:S})}):_?(0,V.jsxs)(`div`,{className:`rounded-xl border border-dashed border-edge-strong px-6 py-12 text-center`,children:[(0,V.jsx)(`p`,{className:`text-lg font-semibold text-foreground`,children:`This project is paused`}),(0,V.jsx)(`p`,{className:`mx-auto mt-1 max-w-[38em] text-sm text-muted`,children:`Queries and bucket operations are refused while it is paused. The data is untouched — resume it to pick up where you left off.`}),(0,V.jsx)(`button`,{type:`button`,onClick:()=>b(`settings`),className:`mt-5 cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Resume in Settings`})]}):y===`database`?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsxs)(`div`,{className:`mb-5 inline-flex rounded-lg bg-panel-raised p-1`,children:[(0,V.jsx)(yd,{active:u===`sql`,onClick:()=>g(`sql`),children:`SQL Editor`}),(0,V.jsx)(yd,{active:u===`tables`,onClick:()=>g(`tables`),children:`Tables`}),(0,V.jsx)(yd,{active:u===`visual`,onClick:()=>g(`visual`),children:`Visual`})]}),u===`visual`?(0,V.jsx)(Pu,{projectId:n.id,refreshKey:f}):u===`sql`?(0,V.jsx)(gl,{projectId:n.id,onExecuted:()=>p(e=>e+1)}):(0,V.jsx)(bu,{projectId:n.id,refreshKey:f})]}):v?(0,V.jsx)(od,{projectId:n.id}):(0,V.jsx)(td,{projectId:n.id,refreshKey:f,onRefresh:()=>p(e=>e+1)})]})]})}function vd({active:e,onClick:t,children:n}){return(0,V.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":e,onClick:t,className:`-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${e?`border-accent-strong text-foreground`:`border-transparent text-muted hover:text-foreground`}`,children:n})}function yd({active:e,onClick:t,children:n}){return(0,V.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":e,onClick:t,className:`cursor-pointer rounded-md border px-4 py-1.5 text-sm font-semibold transition-colors ${e?`border-accent/45 bg-background text-foreground`:`border-transparent text-muted hover:bg-hover-bg hover:text-foreground`}`,children:n})}function bd({status:e}){return(0,V.jsxs)(`span`,{className:`inline-flex items-center gap-1.5 text-sm font-medium text-muted`,children:[(0,V.jsx)(`span`,{className:`h-2 w-2 rounded-full ${e===`ready`?`bg-accent`:e===`failed`?`bg-amber`:e===`paused`?`bg-red`:`bg-faint`}`}),e]})}function xd({isOpen:e,onClose:t,onCreated:n,disabled:r,maxProjects:i,currentCount:a}){let[o,s]=(0,h.useState)(`form`),[c,l]=(0,h.useState)(``),[u,d]=(0,h.useState)(!1),[f,p]=(0,h.useState)(null),[m,g]=(0,h.useState)(null),[_,v]=(0,h.useState)(null);(0,h.useEffect)(()=>{e&&(s(`form`),l(``),p(null),g(null),v(null))},[e]);let y=(0,h.useCallback)(async e=>{if(e.preventDefault(),!c.trim()){p(`Give the project a name.`);return}d(!0),p(null);try{let e=await U.createProject(c.trim());n(e),v(e),g(e.secret_key??null),s(`key`)}catch(e){p(e instanceof ar?e.message:`Could not create the project.`)}finally{d(!1)}},[c,n]),b=(0,h.useCallback)(()=>{t()},[t]);return e?(0,V.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4`,onClick:t,children:(0,V.jsx)(`div`,{className:`w-full surface-raised p-6 ${o===`form`?`max-w-md`:`max-w-3xl`}`,onClick:e=>e.stopPropagation(),children:o===`form`?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`h2`,{className:`mb-1 text-lg font-semibold`,children:`Create project`}),(0,V.jsxs)(`p`,{className:`mb-6 text-sm text-muted`,children:[a,` of `,i,` projects used`]}),(0,V.jsxs)(`form`,{onSubmit:y,children:[r&&(0,V.jsxs)(`p`,{className:`mb-4 text-sm text-amber`,children:[`You have reached the free limit (`,i,` projects). Delete a project to create another.`]}),f&&(0,V.jsx)(`p`,{className:`mb-4 text-sm text-amber`,role:`alert`,children:f}),(0,V.jsxs)(`label`,{className:`flex flex-col gap-2`,children:[(0,V.jsx)(`span`,{className:`text-sm text-muted`,children:`Project name`}),(0,V.jsx)(`input`,{type:`text`,value:c,onChange:e=>l(e.target.value),placeholder:`my-side-project`,disabled:r||u,className:`rounded-lg border border-edge-strong bg-panel px-3 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none disabled:opacity-50`,autoFocus:!0})]}),(0,V.jsxs)(`div`,{className:`mt-6 flex gap-3`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:t,className:`flex-1 cursor-pointer rounded-lg border border-edge-strong px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Cancel`}),(0,V.jsx)(`button`,{type:`submit`,disabled:r||u||!c.trim(),className:`flex-1 cursor-pointer rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:u?`Creating…`:`Create project`})]})]})]}):(0,V.jsxs)(V.Fragment,{children:[(0,V.jsxs)(`div`,{className:`mb-6 text-center`,children:[(0,V.jsx)(`div`,{className:`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-strong/15`,children:(0,V.jsx)(`svg`,{className:`h-6 w-6 text-accent`,viewBox:`0 0 20 20`,fill:`currentColor`,children:(0,V.jsx)(`path`,{fillRule:`evenodd`,d:`M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z`,clipRule:`evenodd`})})}),(0,V.jsx)(`h2`,{className:`mb-2 text-lg font-semibold`,children:`Project created`}),(0,V.jsxs)(`p`,{className:`text-sm leading-relaxed text-muted`,children:[`Put these three values in your own project's environment, then point your app at `,(0,V.jsx)(`code`,{className:`font-mono text-foreground`,children:`$MOOGO_PROJECT_URL/query`}),`. The dashboard does not need them — it reaches your database as the owner.`]})]}),m&&(0,V.jsxs)(`div`,{className:`mb-6 rounded-lg border border-accent-strong/40 bg-accent-strong/10 p-5`,children:[(0,V.jsx)(`p`,{className:`mb-4 text-sm leading-relaxed text-accent`,children:`The secret key is shown only once and cannot be retrieved again. If you lose it, rotate it from Settings.`}),(0,V.jsxs)(`div`,{className:`space-y-3`,children:[(0,V.jsx)(Sd,{name:`MOOGO_PROJECT_URL`,value:`${Vn()}/p/${_?.id??``}`}),(0,V.jsx)(Sd,{name:`MOOGO_PROJECT_ID`,value:_?.id??``}),(0,V.jsx)(Sd,{name:`MOOGO_SECRET_KEY`,value:m,highlight:!0})]})]}),(0,V.jsx)(`button`,{onClick:b,className:`w-full cursor-pointer rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Open the project`})]})})}):null}function Sd({name:e,value:t,highlight:n}){let[r,i]=(0,h.useState)(!1),a=(0,h.useCallback)(async()=>{try{await navigator.clipboard.writeText(`${e}=${t}`),i(!0),setTimeout(()=>i(!1),2e3)}catch{}},[e,t]);return(0,V.jsxs)(`div`,{className:`flex items-center gap-3 rounded-lg border bg-background px-4 py-3 ${n?`border-accent-strong/50`:`border-edge`}`,children:[(0,V.jsxs)(`div`,{className:`min-w-0 flex-1`,children:[(0,V.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-wider text-faint`,children:e}),(0,V.jsx)(`code`,{className:`mt-1 block break-all font-mono text-sm text-foreground`,children:t})]}),(0,V.jsx)(`button`,{type:`button`,onClick:a,className:`shrink-0 cursor-pointer rounded-md border border-edge-strong px-4 py-2 text-sm text-foreground transition-colors hover:border-hover-edge`,children:r?`Copied`:`Copy`})]})}var Cd=268435456;function wd(){let[e,t]=(0,h.useState)(null),[n,r]=(0,h.useState)([]),[i,a]=(0,h.useState)(!0),[o,s]=(0,h.useState)(null),[c,l]=(0,h.useState)(!1),u=(0,h.useCallback)(async()=>{s(null);try{let[e,n]=await Promise.all([U.me(),U.projects()]);t(e),r(n.projects)}catch(e){s(e instanceof ar?e.message:`Could not load your projects.`)}finally{a(!1)}},[]);(0,h.useEffect)(()=>{u()},[u]);let d=(0,h.useCallback)(e=>{r(t=>[e,...t]),t(e=>e&&{...e,usage:{...e.usage,project_count:e.usage.project_count+1}})},[]),f=e!==null&&e.usage.project_count>=e.max_projects,p=n.reduce((e,t)=>e+t.database_bytes,0),m=n.reduce((e,t)=>e+(t.storage_bytes??0),0),g=e?.max_db_bytes??0,_=Cd*Math.max(1,n.length),v=n.filter(e=>e.status===`paused`).length,y=e?.usage.project_count??0,b=e?.max_projects??2,x=Ed(y/(b||1)),S=g*Math.max(1,n.length),C=S?p/S:0,w=_?m/_:0,T=Ed(C),E=Ed(w);return(0,V.jsxs)(`div`,{className:`page-shell`,children:[(0,V.jsxs)(`div`,{className:`mb-6 flex flex-wrap items-start justify-between gap-4`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`h1`,{className:`text-xl font-semibold tracking-tight`,children:`Projects`}),(0,V.jsx)(`p`,{className:`mt-0.5 text-[0.85rem] text-muted`,children:`Each project gets its own SQLite database and object storage.`})]}),(0,V.jsx)(`button`,{onClick:()=>l(!0),disabled:f,className:`cursor-pointer rounded-md bg-accent-strong px-3.5 py-2 text-[0.82rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:`New project`})]}),f&&(0,V.jsxs)(`p`,{className:`mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.85rem] font-medium text-amber`,children:[`You are on the free plan and have used all `,e?.max_projects,` project slots. Delete one to make room for another.`]}),(0,V.jsxs)(`dl`,{className:`mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-edge bg-edge sm:grid-cols-3`,children:[(0,V.jsx)(Dd,{label:`Projects`,value:`${y} / ${b}`,percent:x,left:`${Math.max(0,b-y)} left`,hint:v>0?`${v} paused`:void 0,ratio:y/(b||1)}),(0,V.jsx)(Dd,{label:`Database`,value:lr(p),percent:T,left:`${lr(Math.max(0,g*Math.max(1,n.length)-p))} left`,hint:`${lr(g)} × ${n.length||0} project${n.length===1?``:`s`}`,ratio:C}),(0,V.jsx)(Dd,{label:`Bucket`,value:lr(m),percent:E,left:`${lr(Math.max(0,_-m))} left`,hint:`256 MB × ${n.length||0} project${n.length===1?``:`s`}`,ratio:w})]}),o&&(0,V.jsx)(`div`,{role:`alert`,className:`mb-4 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber`,children:o}),i?(0,V.jsx)(`p`,{className:`py-16 text-center text-[0.88rem] text-faint`,children:`Loading…`}):n.length===0?(0,V.jsx)(jd,{onCreate:()=>l(!0)}):(0,V.jsx)(`ul`,{className:`grid gap-4 sm:grid-cols-2`,children:n.map(e=>(0,V.jsx)(Od,{project:e,maxDbBytes:g},e.id))}),(0,V.jsx)(xd,{isOpen:c,onClose:()=>l(!1),onCreated:d,disabled:f,maxProjects:e?.max_projects??2,currentCount:e?.usage.project_count??0})]})}function Td(e){let t=[`w-0`,`w-[5%]`,`w-[10%]`,`w-[15%]`,`w-[20%]`,`w-[25%]`,`w-[30%]`,`w-[35%]`,`w-[40%]`,`w-[45%]`,`w-[50%]`,`w-[55%]`,`w-[60%]`,`w-[65%]`,`w-[70%]`,`w-[75%]`,`w-[80%]`,`w-[85%]`,`w-[90%]`,`w-[95%]`,`w-full`];return t[Math.round(Math.max(0,Math.min(1,e))*(t.length-1))]}function Ed(e){let t=Math.max(0,Math.min(1,e))*100;return t>0&&t<1?`<1%`:t<10?`${t.toFixed(1)}%`:`${Math.round(t)}%`}function Dd({label:e,value:t,hint:n,percent:r,left:i,note:a,ratio:o}){return(0,V.jsxs)(`div`,{className:`bg-background px-4 py-3`,children:[(0,V.jsx)(`dt`,{className:`text-[0.72rem] font-bold uppercase tracking-wider text-faint`,children:e}),(0,V.jsxs)(`dd`,{className:`mt-1 flex flex-wrap items-baseline gap-x-2 text-[1.05rem] font-semibold text-foreground`,children:[t,r&&(0,V.jsxs)(`span`,{className:`text-[0.8rem] font-medium text-muted`,children:[r,` used`]})]}),(0,V.jsxs)(`div`,{className:`mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem]`,children:[n&&(0,V.jsx)(`span`,{className:`text-muted`,children:n}),i&&(0,V.jsx)(`span`,{className:`font-medium text-foreground`,children:i})]}),a&&(0,V.jsx)(`p`,{className:`mt-0.5 text-[0.75rem] text-faint`,children:a}),o!==void 0&&(0,V.jsx)(`div`,{className:`mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel-raised`,role:`presentation`,children:(0,V.jsx)(`div`,{className:`h-full rounded-full ${o>=.9?`bg-amber`:`bg-accent`} ${Td(o)}`})})]})}function Od({project:e,maxDbBytes:t}){let[n,r]=(0,h.useState)(!1),i=e.status===`paused`,a=t?e.database_bytes/t:0,o=e.storage_bytes?e.storage_bytes/Cd:0,s=(0,h.useCallback)(async()=>{try{await navigator.clipboard.writeText(e.id),r(!0),setTimeout(()=>r(!1),2e3)}catch{}},[e.id]);return(0,V.jsxs)(`li`,{className:`group relative flex flex-col rounded-xl border bg-background transition-colors hover:border-hover-edge ${i?`border-red/40`:`border-edge`}`,children:[(0,V.jsx)(B,{to:`/app/projects/${e.id}/database`,className:`absolute inset-0 z-0 rounded-xl focus-visible:outline-none`,"aria-label":`Open ${e.name}`}),(0,V.jsxs)(`div`,{className:`pointer-events-none relative z-[1] flex flex-1 flex-col p-5`,children:[(0,V.jsxs)(`div`,{className:`flex items-start justify-between gap-3`,children:[(0,V.jsx)(`span`,{className:`min-w-0 text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-accent`,children:(0,V.jsx)(`span`,{className:`block truncate`,children:e.name})}),(0,V.jsx)(Ad,{status:e.status})]}),i&&(0,V.jsx)(`p`,{className:`mt-3 rounded-md bg-red/10 px-2.5 py-1.5 text-[0.78rem] font-medium text-red`,children:`Queries and uploads are refused while paused.`}),(0,V.jsxs)(`div`,{className:`mt-5 grid grid-cols-2 gap-4`,children:[(0,V.jsx)(kd,{label:`Database`,used:lr(e.database_bytes),quota:lr(t),ratio:a}),(0,V.jsx)(kd,{label:`Bucket`,used:lr(e.storage_bytes??0),quota:lr(Cd),ratio:o})]}),(0,V.jsxs)(`div`,{className:`mt-auto flex items-center justify-between gap-3 border-t border-edge pt-4`,children:[(0,V.jsxs)(`div`,{className:`flex min-w-0 items-center gap-2`,children:[(0,V.jsxs)(`code`,{className:`min-w-0 truncate font-mono text-[0.72rem] text-muted`,children:[e.secret_key_prefix,`…`]}),(0,V.jsx)(`button`,{type:`button`,onClick:s,title:`Copy project id`,className:`pointer-events-auto relative z-10 shrink-0 cursor-pointer rounded border border-edge px-1.5 py-0.5 text-[0.68rem] font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground`,children:n?`Copied`:`Copy id`})]}),(0,V.jsx)(`span`,{className:`shrink-0 text-[0.72rem] text-faint`,children:Md(e.updated_at)})]})]})]})}function kd({label:e,used:t,quota:n,ratio:r}){return(0,V.jsxs)(`div`,{className:`min-w-0`,children:[(0,V.jsxs)(`div`,{className:`flex items-baseline justify-between gap-2`,children:[(0,V.jsx)(`span`,{className:`text-[0.7rem] font-bold uppercase tracking-wider text-faint`,children:e}),r>0&&(0,V.jsxs)(`span`,{className:`text-[0.7rem] font-semibold text-muted`,children:[Ed(r),` used`]})]}),(0,V.jsx)(`p`,{className:`mt-1 truncate text-[0.9rem] font-semibold text-foreground`,children:t}),(0,V.jsx)(`div`,{className:`mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel-raised`,children:(0,V.jsx)(`div`,{className:`h-full rounded-full ${r>=.9?`bg-amber`:`bg-accent`} ${Td(r)}`})}),(0,V.jsxs)(`p`,{className:`mt-1 truncate text-[0.7rem] text-faint`,children:[`of `,n]})]})}function Ad({status:e}){return(0,V.jsxs)(`span`,{className:`inline-flex shrink-0 items-center gap-1.5 text-[0.75rem] font-semibold capitalize text-muted`,children:[(0,V.jsx)(`span`,{className:`h-1.5 w-1.5 rounded-full ${e===`ready`?`bg-accent`:e===`failed`?`bg-amber`:e===`paused`?`bg-red`:`bg-faint`}`}),e]})}function jd({onCreate:e}){return(0,V.jsxs)(`div`,{className:`rounded-xl border border-dashed border-edge-strong px-6 py-16 text-center`,children:[(0,V.jsx)(`p`,{className:`text-[0.95rem] font-semibold text-foreground`,children:`No projects yet`}),(0,V.jsx)(`p`,{className:`mx-auto mt-1 max-w-[42ch] text-[0.85rem] text-muted`,children:`A project gives you a SQLite database and a bucket, reachable over HTTP with a key you keep in your own environment.`}),(0,V.jsx)(`button`,{onClick:e,className:`mt-5 cursor-pointer rounded-md bg-accent-strong px-3.5 py-2 text-[0.82rem] font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`New project`})]})}function Md(e){let t=new Date(e).getTime();if(Number.isNaN(t))return`—`;let n=Math.round((Date.now()-t)/1e3);if(n<60)return`just now`;let r=Math.round(n/60);if(r<60)return`${r}m ago`;let i=Math.round(r/60);if(i<24)return`${i}h ago`;let a=Math.round(i/24);return a<30?`${a}d ago`:new Date(e).toLocaleDateString()}function Nd(){let[e,t]=(0,h.useState)(``),[n,r]=(0,h.useState)(``),[i,a]=(0,h.useState)(``),[o,s]=(0,h.useState)(``),[c,l]=(0,h.useState)(!1),[u,d]=(0,h.useState)(null),f=Nr(),p=f.oauthConfigured,[m,g]=(0,h.useState)(null);(0,h.useEffect)(()=>{f.status===`authenticated`&&window.location.assign(Hn()+`/app`)},[f.status]);async function _(t){if(t.preventDefault(),!n.trim()||!i){d(`Enter your email and password.`);return}if(i.length<8){d(`The password must be at least 8 characters.`);return}if(i!==o){d(`The passwords do not match.`);return}l(!0),d(null);try{let t=await U.register(n.trim(),e.trim(),i);g(t.email)}catch(e){d(e instanceof ar?e.message:`Could not create the account. Please try again.`)}finally{l(!1)}}return m?(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[440px] px-6`,children:[(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6 sm:p-8`,children:[(0,V.jsx)(`div`,{className:`mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent-strong/12`,children:(0,V.jsxs)(`svg`,{viewBox:`0 0 20 20`,"aria-hidden":`true`,className:`h-5 w-5 stroke-accent-strong`,fill:`none`,strokeWidth:`2`,children:[(0,V.jsx)(`rect`,{x:`2.5`,y:`4.5`,width:`15`,height:`11`,rx:`2`}),(0,V.jsx)(`path`,{d:`m3 6 7 5 7-5`,strokeLinecap:`round`,strokeLinejoin:`round`})]})}),(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`Check your email`}),(0,V.jsxs)(`p`,{className:`mb-6 text-muted`,children:[`We sent a confirmation link to`,` `,(0,V.jsx)(`strong`,{className:`text-foreground`,children:m}),`. Follow it and you can sign in — the account cannot be used until you do.`]}),(0,V.jsx)(`div`,{className:`rounded-lg border border-edge px-4 py-3 text-[0.9rem] text-muted`,children:`Nothing arrived? Check the spam folder, or request another link from the page you land on after signing in.`}),(0,V.jsx)(B,{to:`/login`,className:`mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Go to sign in`})]}),(0,V.jsx)(`p`,{className:`mt-6 text-center`,children:(0,V.jsx)(Gn,{className:`text-[0.9rem] text-faint hover:text-foreground`,children:`← Back to the landing page`})})]})})}):(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[440px] px-6`,children:[(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6 sm:p-8`,children:[(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`Create your account`}),(0,V.jsx)(`p`,{className:`mb-6 text-muted`,children:`One email is one Moogo account. Pick a password you can remember.`}),u&&(0,V.jsx)(`div`,{role:`alert`,className:`mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber`,children:u}),(0,V.jsx)(Yc,{configured:p}),(0,V.jsxs)(`div`,{className:`relative my-6`,children:[(0,V.jsx)(`div`,{className:`absolute inset-0 flex items-center`,children:(0,V.jsx)(`span`,{className:`w-full border-t border-edge`})}),(0,V.jsx)(`div`,{className:`relative flex justify-center text-xs`,children:(0,V.jsx)(`span`,{className:`bg-background px-2 text-faint`,children:`or`})})]}),(0,V.jsxs)(`form`,{onSubmit:_,className:`space-y-4`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsxs)(`label`,{htmlFor:`name`,className:`mb-1.5 block text-sm font-medium text-muted`,children:[`Name `,(0,V.jsx)(`span`,{className:`text-faint`,children:`(optional)`})]}),(0,V.jsx)(`input`,{type:`text`,id:`name`,name:`name`,autoComplete:`name`,value:e,onChange:e=>t(e.target.value),className:`w-full rounded-lg border border-edge bg-background px-4 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20`,placeholder:`Your name`})]}),(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:`email`,className:`mb-1.5 block text-sm font-medium text-muted`,children:`Email`}),(0,V.jsx)(`input`,{type:`email`,id:`email`,name:`email`,autoComplete:`email`,value:n,onChange:e=>r(e.target.value),className:`w-full rounded-lg border border-edge bg-background px-4 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20`,placeholder:`you@example.com`})]}),(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:`password`,className:`mb-1.5 block text-sm font-medium text-muted`,children:`Password`}),(0,V.jsx)(Xc,{id:`password`,name:`new-password`,autoComplete:`new-password`,value:i,onChange:a,placeholder:`At least 8 characters`})]}),(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:`confirm`,className:`mb-1.5 block text-sm font-medium text-muted`,children:`Confirm password`}),(0,V.jsx)(Xc,{id:`confirm`,name:`confirm-password`,autoComplete:`new-password`,value:o,onChange:s,placeholder:`Repeat the password`})]}),(0,V.jsx)(`button`,{type:`submit`,disabled:c,className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:c?`Creating account…`:`Create account`})]}),(0,V.jsxs)(`p`,{className:`mt-6 text-center text-[0.9rem] text-muted`,children:[`Already have an account?`,` `,(0,V.jsx)(B,{to:`/login`,className:`text-accent hover:text-accent-strong`,children:`Sign in`})]})]}),(0,V.jsx)(`p`,{className:`mt-6 text-center`,children:(0,V.jsx)(Gn,{className:`text-[0.9rem] text-faint hover:text-foreground`,children:`← Back to the landing page`})})]})})})}function Pd(){let[e]=On(),t=e.get(`token`)??``,[n,r]=(0,h.useState)(``),[i,a]=(0,h.useState)(``),[o,s]=(0,h.useState)(!1),[c,l]=(0,h.useState)(!1),[u,d]=(0,h.useState)(null);async function f(e){if(e.preventDefault(),n.length<8){d(`The password must be at least 8 characters.`);return}if(n!==i){d(`The passwords do not match.`);return}s(!0),d(null);try{await U.resetPassword(t,n),l(!0)}catch(e){d(e instanceof ar?e.message:`Could not update the password. Please try again.`)}finally{s(!1)}}return t?c?(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsx)(`div`,{className:`mx-auto w-full max-w-[440px] px-6`,children:(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6 text-center sm:p-8`,children:[(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`Password updated`}),(0,V.jsx)(`p`,{className:`mb-6 text-muted`,children:`Your password has been changed. Sign in with your new password.`}),(0,V.jsx)(B,{to:`/login`,className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Go to sign in`})]})})})}):(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[440px] px-6`,children:[(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6 sm:p-8`,children:[(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`Choose a new password`}),(0,V.jsx)(`p`,{className:`mb-5 text-muted`,children:`Enter a new password. It must be at least 8 characters.`}),u&&(0,V.jsx)(`div`,{role:`alert`,className:`mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber`,children:u}),(0,V.jsxs)(`form`,{onSubmit:f,className:`space-y-4`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:`password`,className:`mb-1.5 block text-sm font-medium text-muted`,children:`New password`}),(0,V.jsx)(Xc,{id:`password`,name:`new-password`,autoComplete:`new-password`,value:n,onChange:r,placeholder:`At least 8 characters`})]}),(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:`confirm`,className:`mb-1.5 block text-sm font-medium text-muted`,children:`Confirm new password`}),(0,V.jsx)(Xc,{id:`confirm`,name:`confirm-password`,autoComplete:`new-password`,value:i,onChange:a,placeholder:`Repeat the password`})]}),(0,V.jsx)(`button`,{type:`submit`,disabled:o,className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:o?`Updating…`:`Update password`})]})]}),(0,V.jsx)(`p`,{className:`mt-6 text-center`,children:(0,V.jsx)(Gn,{className:`text-[0.9rem] text-faint hover:text-foreground`,children:`← Back to the landing page`})})]})})}):(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsx)(`div`,{className:`mx-auto w-full max-w-[440px] px-6`,children:(0,V.jsxs)(`div`,{className:`surface rounded-2xl p-6 text-center sm:p-8`,children:[(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`Link missing`}),(0,V.jsx)(`p`,{className:`mb-6 text-muted`,children:`This reset link is incomplete. Request a new one from the sign-in page.`}),(0,V.jsx)(B,{to:`/forgot-password`,className:`inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Request a new link`})]})})})})}function Fd(){let[e,t]=(0,h.useState)(null),[n,r]=(0,h.useState)(!0),[i,a]=(0,h.useState)(null);(0,h.useEffect)(()=>{let e=!1;return U.me().then(n=>{e||t(n)}).catch(t=>{e||a(t instanceof ar?t.message:`Could not load your account.`)}).finally(()=>{e||r(!1)}),()=>{e=!0}},[]);async function o(){try{await U.logout()}finally{window.location.assign(`/`)}}return(0,V.jsxs)(`div`,{className:`page-shell`,children:[(0,V.jsxs)(`header`,{className:`mb-10`,children:[(0,V.jsx)(`h1`,{className:`text-xl font-semibold tracking-tight`,children:`Settings`}),(0,V.jsx)(`p`,{className:`mt-1 text-[0.85rem] text-muted`,children:`Your account and plan.`})]}),i&&(0,V.jsx)(`div`,{role:`alert`,className:`mb-6 mx-auto max-w-3xl rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-[0.85rem] text-amber`,children:i}),(0,V.jsxs)(`main`,{className:`space-y-10`,children:[(0,V.jsx)(Id,{me:e,loading:n,onRefresh:()=>U.me().then(t).catch(()=>{})}),e?.has_password===!1?(0,V.jsx)(Ld,{}):(0,V.jsx)(Rd,{}),(0,V.jsx)(zd,{me:e,loading:n}),(0,V.jsx)(Bd,{onSignOut:o})]})]})}function Id({me:e,loading:t,onRefresh:n}){let[r,i]=(0,h.useState)(!1),[a,o]=(0,h.useState)(e?.user.name??``),[s,c]=(0,h.useState)(!1),[l,u]=(0,h.useState)(null),d=()=>{o(e?.user.name??``),i(!0),u(null)},f=()=>{i(!1),u(null)},p=(0,h.useCallback)(async()=>{c(!0),u(null);try{await U.updateProfile({name:a.trim()}),await n(),i(!1)}catch(e){u(e instanceof ar?e.message:`Could not update name.`)}finally{c(!1)}},[a,n]);return(0,V.jsxs)(`section`,{className:`mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5`,children:[(0,V.jsx)(`h2`,{className:`mb-4 text-[0.95rem] font-semibold text-foreground`,children:`Account`}),(0,V.jsxs)(`dl`,{className:`space-y-1 text-[0.86rem]`,children:[(0,V.jsx)(Ud,{label:`Name`,value:t?`…`:e?.user.name??`—`,readOnly:!0,action:r?(0,V.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,V.jsx)(`input`,{type:`text`,value:a,onChange:e=>o(e.target.value),onKeyDown:e=>e.key===`Enter`&&p(),onBlur:f,autoFocus:!0,className:`flex-1 min-w-[120px] rounded-lg border border-edge bg-background px-3 py-1.5 text-[0.86rem] font-medium text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20`}),(0,V.jsx)(`button`,{type:`button`,onClick:p,disabled:s||a.trim()===``,className:`cursor-pointer rounded-lg bg-accent-strong px-3 py-1.5 text-[0.8rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:s?`Saving…`:`Save`}),(0,V.jsx)(`button`,{type:`button`,onClick:f,disabled:s,className:`cursor-pointer rounded-lg border border-edge-strong px-3 py-1.5 text-[0.8rem] font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50`,children:`Cancel`})]}):(0,V.jsx)(`button`,{type:`button`,onClick:d,className:`cursor-pointer text-[0.75rem] font-medium text-muted hover:text-foreground transition-colors`,children:`Edit`})}),(0,V.jsx)(Ud,{label:`Email`,value:t?`…`:e?.user.email??`—`,readOnly:!0})]}),l&&(0,V.jsx)(`p`,{role:`alert`,className:`mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.82rem] text-amber`,children:l}),(0,V.jsx)(`p`,{className:`mt-4 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted`,children:`The email is how Moogo recognises you, so it is shown for reference and cannot be changed here. It has to match the address on your Google account, otherwise signing in with Google would create a second account.`})]})}function Ld(){return(0,V.jsxs)(`section`,{className:`mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5`,children:[(0,V.jsx)(`h2`,{className:`mb-4 text-[0.95rem] font-semibold text-foreground`,children:`Password`}),(0,V.jsxs)(`div`,{className:`space-y-3`,children:[(0,V.jsx)(`p`,{className:`text-[0.86rem] font-semibold`,children:`Your password is managed by Google`}),(0,V.jsx)(`p`,{className:`max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted`,children:`This account signs in with Google, so Moogo has never seen a password for it and cannot change one. To change or reset it, use your Google account — the same password you use for Gmail.`}),(0,V.jsx)(`a`,{href:`https://myaccount.google.com/security`,target:`_blank`,rel:`noreferrer noopener`,className:`inline-flex items-center gap-2 cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-[0.85rem] font-semibold text-foreground transition-colors hover:border-hover-edge hover:bg-hover-bg`,children:`Open Google account security`})]})]})}function Rd(){let[e,t]=(0,h.useState)(``),[n,r]=(0,h.useState)(``),[i,a]=(0,h.useState)(``),[o,s]=(0,h.useState)(!1),[c,l]=(0,h.useState)(null),[u,d]=(0,h.useState)(!1),f=(0,h.useCallback)(()=>{t(``),r(``),a(``)},[]),p=(0,h.useCallback)(async()=>{if(n!==i){l(`The two new passwords do not match.`);return}s(!0),l(null),d(!1);try{await U.changePassword({current_password:e,new_password:n}),f(),d(!0)}catch(e){l(e instanceof ar?e.message:`Could not update the password.`)}finally{s(!1)}},[i,e,n,f]);return(0,V.jsxs)(`section`,{className:`mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5`,children:[(0,V.jsx)(`h2`,{className:`mb-4 text-[0.95rem] font-semibold text-foreground`,children:`Password`}),(0,V.jsxs)(`div`,{className:`max-w-[26rem] space-y-4`,children:[(0,V.jsx)(Hd,{label:`Current password`,id:`current-password`,children:(0,V.jsx)(Xc,{id:`current-password`,value:e,onChange:t,autoComplete:`current-password`})}),(0,V.jsx)(Hd,{label:`New password`,id:`new-password`,children:(0,V.jsx)(Xc,{id:`new-password`,value:n,onChange:r,autoComplete:`new-password`})}),(0,V.jsx)(Hd,{label:`Confirm new password`,id:`confirm-password`,children:(0,V.jsx)(Xc,{id:`confirm-password`,value:i,onChange:a,autoComplete:`new-password`})})]}),(0,V.jsx)(`p`,{className:`mt-3 text-[0.8rem] font-medium text-muted`,children:`At least 8 characters. Your other sessions stay signed in.`}),(0,V.jsxs)(`div`,{className:`mt-4 flex items-center gap-3`,children:[(0,V.jsx)(`button`,{type:`button`,onClick:()=>void p(),disabled:o||e===``||n===``,className:`cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.85rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:o?`Saving…`:`Change password`}),u&&(0,V.jsx)(`span`,{role:`status`,className:`text-[0.82rem] font-medium text-muted`,children:`Password updated.`})]}),c&&(0,V.jsx)(`p`,{role:`alert`,className:`mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.82rem] text-amber`,children:c})]})}function zd({me:e,loading:t}){return(0,V.jsxs)(`section`,{className:`mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5`,children:[(0,V.jsx)(`h2`,{className:`mb-4 text-[0.95rem] font-semibold text-foreground`,children:`Plan`}),(0,V.jsxs)(`dl`,{className:`space-y-1 text-[0.86rem] mb-5`,children:[(0,V.jsx)(Ud,{label:`Plan`,value:t?`…`:Vd(e?.plan)}),(0,V.jsx)(Ud,{label:`Projects`,value:t?`…`:`${e?.usage.project_count??0} of ${e?.max_projects??2}`}),(0,V.jsx)(Ud,{label:`Database limit`,value:t?`…`:`${lr(e?.max_db_bytes??0)} per project`}),(0,V.jsx)(Ud,{label:`Bucket limit`,value:`256 MB per project`})]}),(0,V.jsxs)(`div`,{className:`rounded-lg border border-edge bg-background p-4`,children:[(0,V.jsx)(`p`,{className:`text-[0.86rem] font-semibold`,children:`Need more than the free plan?`}),(0,V.jsx)(`p`,{className:`mt-1 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted`,children:`Bigger project limits and more storage are coming. Nothing is charged today — every account is on the free plan.`}),(0,V.jsx)(`a`,{href:`/plan`,className:`mt-3 inline-block cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.85rem] font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`See plans`})]})]})}function Bd({onSignOut:e}){return(0,V.jsxs)(`section`,{className:`mx-auto max-w-3xl rounded-lg border border-edge bg-panel p-5`,children:[(0,V.jsx)(`h2`,{className:`mb-4 text-[0.95rem] font-semibold text-foreground`,children:`Session`}),(0,V.jsx)(`button`,{type:`button`,onClick:e,className:`cursor-pointer rounded-lg border border-error/30 bg-error/5 px-4 py-2 text-[0.85rem] font-medium text-error transition-colors hover:bg-error/10 hover:border-error`,children:`Sign out`})]})}function Vd(e){return e?e.charAt(0).toUpperCase()+e.slice(1):`—`}function Hd({label:e,id:t,children:n}){return(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:t,className:`mb-1.5 block text-[0.8rem] font-semibold text-foreground`,children:e}),n]})}function Ud({label:e,value:t,readOnly:n,action:r}){return(0,V.jsxs)(`div`,{className:`flex items-center justify-between gap-4 border-b border-edge py-3`,children:[(0,V.jsx)(`dt`,{className:`text-muted`,children:e}),(0,V.jsxs)(`dd`,{className:`min-w-0 truncate font-medium flex items-center gap-3`,children:[n?(0,V.jsx)(`span`,{title:`${e} cannot be changed here`,className:`block truncate`,children:t}):t,r]})]})}function Wd(){let[e]=On(),t=e.get(`token`)??``,[n,r]=(0,h.useState)(()=>t?`checking`:`failed`),[i,a]=(0,h.useState)(()=>t?null:`This link is missing its confirmation code. Request a new one.`),[o,s]=(0,h.useState)(``),[c,l]=(0,h.useState)(!1),u=(0,h.useRef)(!1);(0,h.useEffect)(()=>{if(!t||u.current)return;u.current=!0;let e=!1;return U.verifyEmail(t).then(t=>{e||(r(`done`),a(t.message))}).catch(t=>{e||(r(`failed`),a(t instanceof ar?t.message:`Could not confirm the address. Try again, or request a new link.`))}),()=>{e=!0}},[t]),(0,h.useEffect)(()=>{n!==`checking`&&window.history.replaceState(null,``,`/verify-email`)},[n]);async function d(e){if(e.preventDefault(),o.trim()){l(!0);try{await U.resendVerification(o.trim()),a(`If that account needs confirming, a new link is on its way.`)}catch{a(`Could not send a new link. Try again in a moment.`)}finally{l(!1)}}}return(0,V.jsx)(Pr,{children:(0,V.jsx)(`section`,{className:`py-16 sm:py-20`,children:(0,V.jsxs)(`div`,{className:`mx-auto w-full max-w-[440px] px-6`,children:[(0,V.jsx)(`div`,{className:`surface rounded-2xl p-6 sm:p-8`,children:n===`checking`?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`Confirming your email`}),(0,V.jsxs)(`div`,{className:`mt-5 inline-flex items-center gap-2 text-muted`,children:[(0,V.jsx)(Gd,{}),(0,V.jsx)(`span`,{children:`One moment…`})]})]}):n===`done`?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`div`,{className:`mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent-strong/12`,children:(0,V.jsx)(`svg`,{viewBox:`0 0 20 20`,"aria-hidden":`true`,className:`h-5 w-5 stroke-accent-strong`,fill:`none`,strokeWidth:`2.2`,children:(0,V.jsx)(`path`,{d:`m4 10.5 4 4 8-9`,strokeLinecap:`round`,strokeLinejoin:`round`})})}),(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`Email confirmed`}),(0,V.jsx)(`p`,{className:`mb-6 text-muted`,children:i??`Your address is confirmed.`}),(0,V.jsx)(B,{to:`/login`,className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent`,children:`Sign in`})]}):(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`h1`,{className:`mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight`,children:`This link did not work`}),(0,V.jsx)(`p`,{className:`mb-6 text-muted`,children:i??`The confirmation link is invalid or has expired.`}),(0,V.jsxs)(`form`,{onSubmit:d,className:`space-y-4`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{htmlFor:`resend-email`,className:`mb-1.5 block text-sm font-medium text-muted`,children:`Email address`}),(0,V.jsx)(`input`,{type:`email`,id:`resend-email`,name:`resend-email`,autoComplete:`email`,value:o,onChange:e=>s(e.target.value),placeholder:`you@example.com`,className:`w-full rounded-lg border border-edge bg-background px-4 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20`}),(0,V.jsx)(`p`,{className:`mt-2 text-[0.85rem] text-faint`,children:`We will send a fresh link to the address on the account.`})]}),(0,V.jsx)(`button`,{type:`submit`,disabled:c||!o.trim(),className:`inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`,children:c?`Sending…`:`Send a new link`})]}),(0,V.jsxs)(`p`,{className:`mt-6 text-center text-[0.9rem] text-muted`,children:[`Already confirmed?`,` `,(0,V.jsx)(B,{to:`/login`,className:`text-accent hover:text-accent-strong`,children:`Sign in`})]})]})}),(0,V.jsx)(`p`,{className:`mt-6 text-center`,children:(0,V.jsx)(Gn,{className:`text-[0.9rem] text-faint hover:text-foreground`,children:`← Back to the landing page`})})]})})})}function Gd(){return(0,V.jsxs)(`svg`,{className:`h-4 w-4 animate-spin text-accent-strong`,xmlns:`http://www.w3.org/2000/svg`,fill:`none`,viewBox:`0 0 24 24`,"aria-hidden":`true`,children:[(0,V.jsx)(`circle`,{className:`opacity-25`,cx:`12`,cy:`12`,r:`10`,stroke:`currentColor`,strokeWidth:`4`}),(0,V.jsx)(`path`,{className:`opacity-75`,fill:`currentColor`,d:`M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z`})]})}$n(),(0,zn.createRoot)(document.getElementById(`root`)).render((0,V.jsx)(h.StrictMode,{children:(0,V.jsx)(Sn,{children:(0,V.jsxs)(It,{children:[(0,V.jsx)(R,{path:`/`,element:(0,V.jsx)(Fc,{})}),(0,V.jsx)(R,{path:`/login`,element:(0,V.jsx)(el,{})}),(0,V.jsx)(R,{path:`/register`,element:(0,V.jsx)(Nd,{})}),(0,V.jsx)(R,{path:`/forgot-password`,element:(0,V.jsx)(Cc,{})}),(0,V.jsx)(R,{path:`/reset-password`,element:(0,V.jsx)(Pd,{})}),(0,V.jsx)(R,{path:`/verify-email`,element:(0,V.jsx)(Wd,{})}),(0,V.jsx)(R,{path:`/auth/setup`,element:(0,V.jsx)(rl,{})}),(0,V.jsx)(R,{path:`/plan`,element:(0,V.jsx)(sl,{})}),(0,V.jsx)(R,{path:`/announcement`,element:(0,V.jsx)(Vr,{})}),(0,V.jsx)(R,{path:`/annoucement`,element:(0,V.jsx)(Vr,{})}),(0,V.jsx)(R,{path:`/docs`,element:(0,V.jsx)(gc,{})}),(0,V.jsx)(R,{path:`/docs/:slug`,element:(0,V.jsx)(gc,{})}),(0,V.jsx)(R,{path:`/docs/guides/:slug`,element:(0,V.jsx)(gc,{})}),(0,V.jsxs)(R,{element:(0,V.jsx)(_r,{}),children:[(0,V.jsx)(R,{path:`/app`,element:(0,V.jsx)(Wr,{})}),(0,V.jsx)(R,{path:`/app/projects`,element:(0,V.jsx)(wd,{})}),(0,V.jsx)(R,{path:`/app/settings`,element:(0,V.jsx)(Fd,{})}),(0,V.jsx)(R,{path:`/app/projects/:id`,element:(0,V.jsx)(_d,{})}),(0,V.jsx)(R,{path:`/app/projects/:id/database`,element:(0,V.jsx)(_d,{})}),(0,V.jsx)(R,{path:`/app/projects/:id/bucket`,element:(0,V.jsx)(_d,{})}),(0,V.jsx)(R,{path:`/app/projects/:id/bucket/settings`,element:(0,V.jsx)(_d,{})}),(0,V.jsx)(R,{path:`/app/projects/:id/settings`,element:(0,V.jsx)(_d,{})})]}),(0,V.jsx)(R,{path:`*`,element:(0,V.jsx)(nl,{})})]})})}));