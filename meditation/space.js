'use strict';

/* ---------- 宇宙背景：每个地方一段 WebGL 着色器，在显卡上逐像素实时绘制 ---------- */

const GLSL_HEAD = `
precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uB; uniform float uR;
uniform vec2 uShift; uniform float uZoom; uniform vec4 uCat; uniform float uLink;
uniform vec4 uEv; uniform vec4 uSun; uniform vec4 uMk;
#define PI 3.14159265
float sq(float x){return x*x;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 h22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float h13(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),u.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x),u.y);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);vec3 u=f*f*(3.-2.*f);
 return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),u.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),u.x),u.y),
            mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),u.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),u.x),u.y),u.z);}
const mat2 M2=mat2(1.6,1.2,-1.2,1.6);
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n2(p);p=M2*p;a*=.5;}return v;}
float fbm4(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n2(p);p=M2*p;a*=.5;}return v;}
float fbm3(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}
// 一层星星。每颗星有自己的闪烁节奏（慢的呼吸感加上快的闪动），亮星闪到最亮时会冒出小十字光芒
vec3 starL(vec2 p,float sc,float dens,float seed){
  vec2 g=p*sc,id=floor(g),f=fract(g)-.5;
  float h=h12(id+seed);
  if(h>dens)return vec3(0.);
  vec2 d=f-(h22(id+seed*1.3)-.5)*.55;
  float px=sc/uRes.y;
  float b=pow(h12(id+seed+7.),9.)*5.+.2;
  float r=abs(uR);
  float sl=.5+.5*sin(r*(.35+h*1.6)+h*60.);
  float fl=n2(vec2(r*(2.2+h*5.),h*97.+seed));
  float tw=.12+1.75*sl*sl*(.35+.9*fl*fl);
  float l=length(d);
  float c=exp(-l*l/(px*px*.8))+.06*px/(l+px)*smoothstep(.5,.1,l)*b;
  float pk=smoothstep(1.,1.6,tw)*step(1.2,b);
  c+=pk*(exp(-abs(d.x)/(px*.6))*exp(-abs(d.y)/(px*5.))+exp(-abs(d.y)/(px*.6))*exp(-abs(d.x)/(px*5.)))*.5;
  vec3 col=mix(vec3(.62,.74,1.),vec3(1.,.8,.62),h12(id+seed+3.));
  return col*c*b*tw;
}
// 一道流星：从 s0 沿 dir 飞出，k 是这道流星自己的进度 0→1
vec3 streak(vec2 p,vec2 s0,vec2 dir,float k,float travel){
  vec2 hd=s0+dir*k*travel;
  vec2 v=p-hd;
  float al=dot(v,-dir), pe=dot(v,vec2(-dir.y,dir.x));
  float len=.015+.11*sin(PI*min(k*1.4,1.));
  float w=1.3/uRes.y;
  float tail=step(0.,al)*exp(-al/len*3.)*exp(-pe*pe/(w*w));
  return vec3(.75,.88,1.)*(tail*1.6+exp(-dot(v,v)/(w*w*3.))*2.)*sin(PI*k);
}
// 偶尔划过的流星：两条时间线各自随机出现
vec3 meteors(vec2 p){
  vec3 c=vec3(0.);
  if(uR<0.)return c;
  for(int i=0;i<2;i++){
    float fi=float(i), per=11.+fi*6.;
    float tt=uR/per+fi*.37, id=floor(tt), ph=fract(tt)*per;
    if(h12(vec2(id,fi*7.+1.))>.55)continue;
    float dur=.6+.5*h12(vec2(id,fi+3.));
    if(ph>dur)continue;
    float a=-.35-h12(vec2(id,fi+8.))*.7; float sg=h12(vec2(id,fi+9.))>.5?1.:-1.;
    vec2 s0=vec2(h12(vec2(id,fi+5.))*.9-.45,.12+h12(vec2(id,fi+6.))*.3);
    c+=streak(p,s0,vec2(cos(a)*sg,sin(a)),ph/dur,.3);
  }
  return c;
}
// 整片星空绕着画面上方很远的天极缓慢转动
// 跟呼吸联动：吸气时星光向小猫聚拢、变亮，呼气时慢慢散开
vec3 stars(vec2 p){
  vec2 cc=(uCat.xy+vec2(0.,uCat.z*.9)-uShift)/uZoom;
  float br=uLink*(uB-.5);
  vec2 pb=cc+(p-cc)*(1.+br*.07);
  vec2 q=rot(uT*.0015)*(pb-vec2(.3,1.4))+vec2(.3,1.4);
  vec3 s=starL(q,190.,.1,1.)*.3+starL(q,75.,.1,2.)*.55+starL(q,28.,.12,3.)*.9;
  return s*(1.+br*.7)+meteors(p);
}
vec3 spikeStar(vec2 d,float s){float l=length(d);
  float c=exp(-l*l*90000./(s*s))*4.+.0016*s/(l+.0015);
  c+=(exp(-abs(d.x)*1400./s)*exp(-abs(d.y)*22./s)+exp(-abs(d.y)*1400./s)*exp(-abs(d.x)*22./s))*.9;
  return vec3(c);}
// 稀有天象：1 彗星，2 流星雨，3 超新星（4 日食画在各自的场景里）。uEv.y 进度，uEv.z 随机种子
// 用屏幕坐标画，保证在手机画面里的位置和大小合适
vec3 sightFx(vec2 uv){
  float ty=uEv.x, pr=uEv.y, sd=uEv.z;
  vec3 c=vec3(0.);
  float fade=smoothstep(0.,.12,pr)*smoothstep(1.,.85,pr);
  if(ty<1.5){
    vec2 hd=mix(vec2(-.2+.08*sd,.37),vec2(.06+.1*sd,.24),pr);
    vec2 v=uv-hd;
    vec2 T=normalize(vec2(-.55,.85)), N=vec2(-T.y,T.x);
    float al=dot(v,T), pe=dot(v,N);
    float px=1./uRes.y;
    float wd=.004+max(al,0.)*.1;
    float dust=step(0.,al)*exp(-al/.16)*exp(-sq((pe+al*al*.9)/wd));
    float wi=.0015+max(al,0.)*.012;
    float ion=step(0.,al)*exp(-al/.32)*exp(-sq(pe/wi))*(.7+.5*n2(vec2(al*40.-uR*.6,pe*300.)));
    float coma=exp(-dot(v,v)/(.009*.009))*1.1+exp(-dot(v,v)/(px*px*2.))*3.;
    c=vec3(1.,.88,.68)*dust*.9+vec3(.45,.7,1.)*ion*.8+vec3(.75,1.,.88)*coma;
    c*=fade;
  } else if(ty<2.5){
    vec2 rd=vec2(-.14+.28*sd,.4);
    for(int i=0;i<16;i++){
      float fi=float(i);
      float ti=(fi+.5)/16.*.9+.05+(h12(vec2(fi,sd*31.))-.5)*.04;
      float k=(pr-ti)/.022;
      if(k<0.||k>1.)continue;
      float a=-PI*.5+(h12(vec2(fi,7.+sd))-.5)*2.6;
      vec2 dir=vec2(cos(a),sin(a));
      c+=streak(uv,rd+dir*(.04+.14*h12(vec2(fi,3.+sd))),dir,k,.16);
    }
    c+=vec3(.5,.6,1.)*exp(-length(uv-rd)*60.)*.06*fade;
  } else {
    vec2 sp=vec2(-.18+.12*sd,.26+.08*fract(sd*7.));
    vec2 d=uv-sp;
    float b=smoothstep(0.,.07,pr)*exp(-max(pr-.07,0.)*2.6);
    vec3 col=mix(vec3(.8,.9,1.),vec3(1.,.62,.42),smoothstep(.1,.7,pr));
    c=spikeStar(d,.35+1.1*b)*col*b*1.1;
    float rr=.008+pr*.07;
    c+=vec3(.6,.75,1.)*exp(-sq((length(d)-rr)/.004))*(1.-pr)*.25*smoothstep(.05,.15,pr);
  }
  return c;
}
`;
const SCENES = {
  moon: { q: .62, ground: -0.07, shadow: 1, fs: `
float crater(vec2 q,float sc,float seed,float dens){
  vec2 g=q*sc,id=floor(g),f=fract(g);float h=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 n=vec2(float(i),float(j));
    float hh=h12(id+n+seed);
    if(hh>dens)continue;
    vec2 o=h22(id+n+seed*1.7);
    float s=.16+.3*h12(id+n+seed+4.);
    float x=length(f-n-o)/s;
    float pr=x<1.?mix(-.6,.28,x*x*x):.28*exp(-(x-1.)*3.5);
    h+=pr*s;
  }
  return h/sc;
}
float moonH(vec2 q){return fbm4(q*2.5)*.05+n2(q*14.)*.012+crater(q,.7,1.,.4)*.75+crater(q,2.2,7.,.55)*.8+crater(q,7.,3.,.6)*.7;}
// 月面地面：远处只用平均亮度，省掉最贵的环形山计算
vec3 moonGround(vec2 uv,float yh){
    vec3 Lg=normalize(vec3(-.8,.3,.5));
    vec3 gf=vec3(1.,.96,.9)*.13*Lg.y*3.6;
    float dy=max(yh-uv.y,.0012);
    float z=.5/dy;
    if(z>26.)return gf;
    vec2 q=vec2(uv.x*z,z)*4.;
    float e=.006+.002*z;
    float h0=moonH(q),hx=moonH(q+vec2(e,0.)),hz=moonH(q+vec2(0.,e));
    vec3 n=normalize(vec3(-(hx-h0)/e,1.,-(hz-h0)/e));
    float dif=max(dot(n,Lg),0.);
    float alb=.09+.07*fbm4(q*.25+9.)+.03*n2(q*30.);
    vec3 g=vec3(1.,.96,.9)*alb*dif*3.4+.0015;
    // 阳光照到细小的玻璃珠时一闪一闪
    vec2 gq=q*9.; vec2 gi=floor(gq);
    float gh=h12(gi+31.);
    float gl=step(.93,gh)*pow(max(sin(uR*(1.+gh*3.)+gh*80.),0.),14.)*exp(-dot(fract(gq)-.5,fract(gq)-.5)*40.);
    g+=vec3(1.,.97,.9)*gl*dif*.7*smoothstep(14.,3.,z);
    return mix(g,gf,smoothstep(5.,26.,z));
}
vec3 scene(vec2 uv){
  float yh=-.07-.22*uv.x*uv.x+.004*fbm4(vec2(uv.x*14.,1.));
  float py=1./uRes.y;
  // 完全在地面以下的像素不用再画星空和地球
  if(uv.y<yh-py)return moonGround(uv,yh);
  vec3 col=stars(uv)*.9;
  vec3 L=uSun.w>.5?normalize(uSun.xyz):normalize(vec3(-.9,.28,.4));
  vec2 c=vec2(.11,.15+.008*sin(uT*.05)); float R=.095;
  vec2 d=(uv-c)/R; float rr=length(d);
  float pw=1./(R*uRes.y);
  float sideLit=clamp(dot(normalize(d+1e-4),normalize(L.xy))*.8+.35,.22,1.);
  col+=vec3(.12,.32,1.)*exp(-(rr-1.)*7.)*step(1.,rr)*.35*sideLit*(.8+.4*uB);
  if(rr<1.){
    vec3 n=vec3(d,sqrt(1.-rr*rr));
    vec3 p=n; p.yz=rot(.35)*p.yz; p.xz=rot(uSun.w>.5?uMk.w:uT*.03)*p.xz;
    float land=fbm3(p*2.3+3.);
    float isL=smoothstep(.52,.545,land);
    vec3 ocean=mix(vec3(.002,.012,.05),vec3(.006,.04,.12),fbm3(p*7.));
    vec3 grd=mix(vec3(.03,.06,.018),vec3(.2,.13,.06),smoothstep(.56,.66,land+.1*fbm3(p*9.)));
    grd*=.7+.6*fbm3(p*20.);
    vec3 surf=mix(ocean,grd,isL);
    surf=mix(surf,vec3(.75),smoothstep(.8,.9,abs(p.y)+.1*fbm3(p*12.)));
    vec3 pc=p; pc.xz=rot(uT*.012)*pc.xz;
    float cl=fbm3(pc*3.2+vec3(0.,0.,uT*.02))+.35*fbm3(pc*13.+vec3(uT*.03,0.,0.))-.18;
    cl=smoothstep(.36,.7,cl);
    float nl=dot(n,L), dif=max(nl,0.);
    vec3 hv=normalize(L+vec3(0.,0.,1.));
    float spec=pow(max(dot(n,hv),0.),70.)*(1.-isL)*(1.-cl)*1.6;
    vec3 lit=surf*dif*2.6+spec*vec3(1.,.85,.7);
    lit=mix(lit,vec3(.85,.88,.95)*dif*1.7,cl);
    float term=smoothstep(-.12,.3,nl);
    lit+=vec3(.12,.35,1.)*pow(1.-n.z,2.5)*(term*1.3+.3);
    // 夜面不是全黑：一点被月光和星光照到的海陆轮廓，加上城市灯火
    float night=1.-smoothstep(-.15,.05,nl);
    lit+=(surf*.12+vec3(.003,.006,.016))*night*(1.-cl*.6)+vec3(.007,.009,.013)*cl*night;
    float city=smoothstep(.74,.86,n3(p*70.))*smoothstep(.7,.85,n3(p*9.)+.3)*isL*night;
    lit+=vec3(1.,.6,.25)*city*(.5+.15*sin(uR*.8+p.x*40.));
    // 你所在的地方：一盏暖色的小灯，一圈圈向外荡开
    if(uSun.w>.5){
      vec3 dm=n-uMk.xyz; float md=dot(dm,dm);
      float rg=fract(abs(uR)*.3);
      lit+=vec3(1.,.8,.5)*(exp(-md*1800.)*2.2+exp(-md*160.)*.18*(.7+.3*sin(abs(uR)*2.)))*(.5+.8*night)*step(0.,uMk.z);
      lit+=vec3(1.,.8,.5)*exp(-sq((sqrt(md)-rg*.14)*80.))*(1.-rg)*.3*step(0.,uMk.z);
    }
    // 夜面云层里偶尔一闪的闪电
    float ls=floor(uR*1.7), lf=fract(uR*1.7);
    vec3 lp=normalize(vec3(h12(vec2(ls,1.))-.5,h12(vec2(ls,2.))-.5,.2+h12(vec2(ls,3.))*.4));
    lit+=vec3(.7,.8,1.)*exp(-dot(n-lp,n-lp)*900.)*cl*step(.55,h12(vec2(ls,4.)))*(1.-lf)*(1.-smoothstep(-.1,.05,nl))*1.2;
    col=mix(col,lit,smoothstep(1.,1.-pw*1.5,rr));
  }
  // 月平线上一层被太阳照亮的浮尘辉光，缓缓起伏
  float ah=uv.y-yh;
  col+=vec3(.55,.6,.75)*exp(-max(ah,0.)*40.)*(.02+.018*sin(uR*.25+uv.x*3.))*smoothstep(.5,-.3,uv.x);
  // 远处偶尔有小陨石撞击：一闪，然后一团尘埃慢慢升起散开
  float it=uR/13., iid=floor(it), ip=fract(it)*13.;
  if(h12(vec2(iid,21.))<.6&&ip<6.){
    float ix=h12(vec2(iid,22.))*.8-.4;
    vec2 ic=vec2(ix,-.07-.22*ix*ix+.003);
    vec2 di=uv-ic;
    col+=vec3(1.,.95,.85)*exp(-dot(di,di)*2e5)*exp(-ip*5.)*3.;
    col+=vec3(1.,.9,.8)*exp(-dot(di,di)*1e4)*exp(-ip*3.)*.5;
    float pr=.004+ip*.004;
    float pl=exp(-sq(length(di*vec2(1.,1.4))/pr))*step(0.,di.y+.002)*(1.-ip/6.)*(.6+.4*n2(di*600.));
    col+=vec3(.55,.53,.5)*pl*.35;
  }
  if(uv.y<yh+py){
    vec3 g=moonGround(uv,yh);
    col=mix(col,g,smoothstep(yh+py,yh-py,uv.y));
  }
  return col;
}` },

  mars: { q: .85, ground: -0.02, shadow: 1, fs: `
vec3 scene(vec2 uv){
  vec2 sp=vec2(-.15,.06+.008*sin(uT*.04));
  vec3 sky=mix(vec3(.32,.13,.05),vec3(.012,.008,.01),smoothstep(-.04,.42,uv.y));
  sky=mix(sky,vec3(.45,.22,.09),smoothstep(.02,-.06,uv.y));
  vec2 ds=(uv-sp)*vec2(1.,1.45); float dsun=length(ds);
  sky*=1.-.65*exp(-dsun*4.5);
  sky+=vec3(.16,.42,1.)*(exp(-dsun*6.5)*.9+exp(-dsun*20.)*1.6)*(.85+.3*uB);
  float ls=length(uv-sp);
  sky+=vec3(1.,1.,1.05)*(smoothstep(.0105,.0085,ls)*6.+exp(-ls*110.)*2.5);
  // 日食：火卫一从太阳前面走过
  if(uEv.x>3.5){
    vec2 ec=sp+vec2(mix(-.03,.03,uEv.y),.0022);
    float cov=smoothstep(.017,0.,length(ec-sp));
    sky*=1.-.4*cov;
    vec2 ed=(uv-ec)/vec2(.0085,.0068);
    if(dot(ed,ed)<1.)sky=vec3(.01,.007,.006)+vec3(.04,.03,.025)*smoothstep(-.2,.8,-ed.x);
  }
  float hz=fbm4(vec2(uv.x*2.5-uT*.008,uv.y*16.));
  sky+=vec3(.16,.07,.03)*hz*smoothstep(.28,-.02,uv.y)*.8;
  sky+=stars(uv)*smoothstep(.12,.35,uv.y)*.55;
  // 高空的薄云，慢慢飘
  float cl=fbm4(vec2(uv.x*2.6-uT*.012,uv.y*11.+uT*.004));
  sky+=vec3(.55,.6,.7)*pow(cl,3.5)*smoothstep(.06,.18,uv.y)*smoothstep(.42,.22,uv.y)*.45;
  // 远处沙丘上游走的尘卷风
  for(int j=0;j<2;j++){
    float fj=float(j);
    float dx=fract(uT*.004+fj*.5)*.9-.45+.02*sin(uT*.3+fj);
    float hy=uv.y+.03;
    if(hy>0.&&hy<.16){
      float wdt=.008+hy*.16;
      float sw=.015*sin(hy*24.-uT*1.2+fj*3.);
      float dd=abs(uv.x-dx-sw)/wdt;
      float tw=fbm4(vec2((uv.x-dx)*60.+hy*50.-uT*3.,hy*24.-uT*.8));
      float dv=exp(-dd*dd*2.5)*(.35+.9*tw)*smoothstep(.15,.03,hy)*smoothstep(0.,.025,hy);
      vec3 dcol=mix(vec3(.3,.15,.07),vec3(.62,.36,.2),smoothstep(-.5,.5,(uv.x-dx)*sign(sp.x-dx)/wdt));
      sky=mix(sky,dcol,clamp(dv*.6,0.,1.)*(.65+.35*sin(uT*.07+fj*2.)));
    }
  }
  vec2 pp=vec2(mod(uT*.003+.2,.8)-.4,.34); vec2 dp=(uv-pp)/vec2(.011,.0085);
  if(dot(dp,dp)<1.)sky=vec3(.006,.004,.004)+vec3(.05,.04,.035)*smoothstep(-.2,.8,-dp.x)*(.7+.3*n2(dp*4.));
  vec3 col=sky;
  for(int i=0;i<4;i++){
    float fi=float(i);
    float base=-.01-fi*.075;
    float x=uv.x*(1.+fi*.7)+fi*3.7+uT*.0015*(fi+1.);
    float y=base+.04*(fbm4(vec2(x*2.2,fi*4.))-.5)*(1.+fi*.6)+.012*sin(x*5.+fi*2.);
    if(uv.y<y){
      float depth=1.-fi/3.;
      float dd=y-uv.y;
      vec3 dune=mix(vec3(.022,.007,.003),vec3(.13,.05,.02),depth);
      float rip=fbm4(vec2(x*55.+dd*90.,dd*26.+fi));
      dune*=.75+.5*rip*(1.-depth*.6);
      float rim=exp(-dd*(150.-fi*25.))*exp(-abs(uv.x-sp.x)*2.5);
      dune+=vec3(.75,.38,.18)*rim*(.35+.2*(1.-depth));
      dune=mix(dune,sky*.55,depth*.5);
      col=mix(col,dune,smoothstep(0.,1.5/uRes.y,dd));
    }
  }
  // 贴着地面被风吹过的细沙
  float sd=uv.y<-.03?fbm4(vec2(uv.x*7.-uT*.5,uv.y*55.+uT*.1)):0.;
  col+=vec3(.55,.3,.16)*pow(sd,4.)*smoothstep(-.03,-.3,uv.y)*.55;
  vec2 dg=uv*vec2(26.,14.)+vec2(-uT*.25,0.);
  vec2 id=floor(dg); vec2 f=fract(dg)-.5-(h22(id)-.5)*.6;
  col+=vec3(.9,.55,.35)*exp(-dot(f,f)*400.)*step(.7,h12(id))*.25*smoothstep(.1,-.2,uv.y);
  return col;
}` },

  saturn: { q: .9, hero: [0, 0.17], fs: `
float ringD(float k){
  if(k<1.24||k>2.28)return 0.;
  float d=smoothstep(1.24,1.5,k)*.28;
  d+=smoothstep(1.52,1.56,k)*smoothstep(1.955,1.94,k)*.72;
  d+=smoothstep(2.025,2.04,k)*smoothstep(2.28,2.26,k)*.62;
  d*=1.-.9*smoothstep(.006,0.,abs(k-2.215));
  d*=.72+.28*n2(vec2(k*190.,1.));
  d*=.85+.15*sin(k*520.);
  return clamp(d,0.,1.);
}
vec3 ringC(float k){return mix(vec3(.42,.33,.22),vec3(.62,.55,.44),n2(vec2(k*35.,3.)))*(1.-.35*smoothstep(1.5,1.24,k));}
vec3 scene(vec2 uv){
  vec3 col=stars(uv);
  vec3 rd=normalize(vec3(uv-vec2(0.,.17),-2.2));
  vec3 C=vec3(0.,0.,-19.); float R=1.;
  vec3 N=normalize(vec3(-.28+.02*sin(uT*.02),1.,.34));
  vec3 L=normalize(vec3(-.9,.35,.6));
  float b=dot(C,rd), cc=dot(C,C)-R*R, disc=b*b-cc;
  float ts=disc>0.?b-sqrt(disc):1e9;
  float dn=dot(rd,N);
  float tr=dot(C,N)/dn;
  vec3 H=rd*tr; float k=length(H-C)/R;
  float rden=tr>0.?ringD(k):0.;
  // 环的颜色：光照面 / 背光面，土星在环上的影子
  vec3 rcol=vec3(0.);
  if(rden>0.){
    vec3 oc=H-C; float bb=dot(oc,L); float c2=dot(oc,oc)-R*R;
    float sh=(bb<0.&&bb*bb-c2>0.)?.04:1.;
    float sameSide=sign(dot(N,L))*sign(dot(N,-rd));
    float lit=sameSide>0.?abs(dot(N,L))*2.4:(1.-rden)*1.4+.1;
    rcol=ringC(k)*lit*sh;
    // B 环上的“辐条”：一道道淡淡的放射状暗纹，跟着环慢慢转
    vec3 ru=normalize(cross(N,vec3(0.,0.,1.))), rv=cross(N,ru);
    float ra=atan(dot(oc,rv),dot(oc,ru));
    float spk=smoothstep(.55,.85,n2(vec2(ra*7.-uT*.025,k*2.5)))*smoothstep(1.56,1.65,k)*smoothstep(1.92,1.8,k);
    rcol*=1.-.4*spk*(.6+.4*sin(uT*.05+ra*3.));
  }
  if(ts<1e8){
    vec3 P=rd*ts; vec3 n=normalize(P-C);
    float lat=dot(n,N);
    vec3 tng=normalize(cross(N,vec3(0.,0.,1.)));
    float lon=atan(dot(n,cross(N,tng)),dot(n,tng));
    float w=fbm(vec2(lon*3.+uT*.004,lat*24.))*.06;
    float bnd=n2(vec2((lat+w)*16.,0.))*.6+n2(vec2((lat+w)*46.,3.))*.4;
    vec3 base=mix(vec3(.5,.34,.16),vec3(.78,.64,.4),bnd);
    base=mix(base,vec3(.3,.34,.36),smoothstep(.72,.95,abs(lat)));
    float dif=max(dot(n,L),0.);
    vec3 pc=base*dif*2.1*(.65+.35*pow(max(dot(n,-rd),0.),.4));
    float tl=dot(C-P,N)/dot(L,N);
    if(tl>0.){ float kk=length(P+L*tl-C)/R; pc*=1.-.85*ringD(kk); }
    pc+=vec3(.25,.2,.12)*pow(1.-max(dot(n,-rd),0.),3.)*dif*.6;
    // 北极的极光环，亮度和形状一直在变
    float au=exp(-sq((lat-.9)*30.))*(.45+.55*n2(vec2(lon*5.+uT*.25,uR*.3)));
    pc+=vec3(.35,.6,1.)*au*.35*(.7+.3*sin(uR*.4));
    float pw=2./uRes.y*19./2.2;
    float edge=smoothstep(0.,pw,b-sqrt(max(cc-0.,0.))*0.+sqrt(max(disc,0.)));
    col=mix(col,pc,clamp(sqrt(max(disc,0.))/pw,0.,1.));
    if(rden>0.&&tr<ts) col=mix(col,rcol,rden*.92);
  } else if(rden>0.){
    col=mix(col,rcol,rden*.92);
  }
  col+=vec3(.5,.42,.3)*exp(-length((uv-vec2(0.,.17))*vec2(1.,1.4))*7.)*.05*(.6+.8*uB);
  // 一颗小卫星沿着环面的轨道绕行，转到土星背后时被挡住
  {
    vec3 ru=normalize(cross(N,vec3(0.,0.,1.))), rv=cross(N,ru);
    float ma=uT*.025+1.;
    vec3 M=C+(ru*cos(ma)+rv*sin(ma))*3.1;
    vec2 mp=M.xy/(-M.z)*2.2+vec2(0.,.17);
    float mr=.11*2.2/(-M.z);
    vec2 md=(uv-mp)/mr; float m2=dot(md,md);
    bool behind=M.z<C.z&&length(mp-vec2(0.,.17))<2.2/19.;
    if(m2<1.&&!behind){
      vec3 mn=vec3(md,sqrt(1.-m2));
      float mdif=max(dot(mn,L),0.);
      vec3 mc=vec3(.82,.8,.78)*(.75+.35*n2(md*5.))*mdif*1.8;
      col=mix(col,mc,smoothstep(1.,.8,m2));
    }
  }
  vec2 g=uv*5.+vec2(uT*.012,uT*.004); vec2 id=floor(g);
  vec2 f=fract(g)-.5-(h22(id+4.)-.5)*.5;
  float hb=h12(id+9.);
  col+=vec3(.75,.8,.9)*smoothstep(.09,.05,length(f))*step(.82,hb)*.05*smoothstep(.1,-.3,uv.y);
  return col;
}` },

  orion: { q: .75, hero: [0, 0.15], fs: `
vec3 trap(vec2 p,vec2 s,float k){return spikeStar(p-s,k)*vec3(.82,.9,1.)*(.7+.45*uB)*(.75+.45*n2(vec2(abs(uR)*2.3,k*37.)));}
vec3 scene(vec2 uv){
  vec2 p=uv-vec2(0.,.15);
  float t=uT*.02;
  vec2 q=vec2(fbm(p*2.2+vec2(0.,t)),fbm(p*2.2+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p*2.2+3.5*q+vec2(1.7,9.2)+t*.6),fbm(p*2.2+3.5*q+vec2(8.3,2.8)));
  float f=fbm(p*2.2+3.*r);
  float cg=exp(-length(p*vec2(1.,1.25))*3.);
  float dens=pow(f,2.3)*(cg*3.+.35);
  vec3 c=mix(vec3(.85,.08,.16),vec3(1.,.55,.22),smoothstep(.3,.9,q.x)*clamp(cg*2.2,0.,1.));
  c=mix(c,vec3(.06,.5,.58),smoothstep(.45,.8,r.y)*(1.-cg)*.95);
  c=mix(c,vec3(.15,.25,.85),smoothstep(.6,.9,q.y)*.35);
  // 电离气体的亮度像呼吸一样，一波一波在云里传开
  vec3 col=c*dens*1.7*(1.+.18*sin(uR*.45-length(p)*14.+f*6.));
  col+=vec3(1.,.82,.65)*(exp(-length(p)*13.)*1.1+exp(-length(p)*40.)*1.5)*(.75+.5*uB);
  float dust=smoothstep(.46,.72,fbm(p*3.+vec2(-2.,4.)+r*.7));
  col*=1.-dust*.88;
  col+=stars(uv)*(1.-dust*.8);
  // 藏在云里刚诞生的原恒星，忽明忽暗
  for(int i=0;i<5;i++){float fi=float(i);
    vec2 ps=vec2(h12(vec2(fi,4.))-.5,h12(vec2(fi,5.))-.5)*vec2(.5,.36);
    float fl=pow(.5+.5*sin(uR*(.6+fi*.37)+fi*2.),3.);
    col+=vec3(1.,.75,.6)*spikeStar(p-ps,.35+.25*fl)*(.15+.6*fl);}
  col+=trap(p,vec2(-.006,.004),1.2)+trap(p,vec2(.008,.01),1.)+trap(p,vec2(.004,-.008),.9)+trap(p,vec2(.014,-.002),.7);
  return col;
}` },

  pleiades: { q: .8, hero: [0, 0.17], fs: `
vec3 st(vec2 p,vec2 s,float k,inout float g){vec2 d=p-s;g+=k*exp(-length(d)*9.);
  float fl=.7+.5*n2(vec2(abs(uR)*(1.6+k),s.x*91.+s.y*37.));
  return spikeStar(d,k*(.85+.25*fl))*vec3(.7,.82,1.)*(.75+.4*uB)*fl;}
vec3 scene(vec2 uv){
  vec2 p=(uv-vec2(.0,.17))*1.;
  float g=0.; vec3 s=vec3(0.);
  s+=st(p,vec2(.0,.0),1.6,g); s+=st(p,vec2(-.115,.012),1.3,g); s+=st(p,vec2(-.122,.04),.8,g);
  s+=st(p,vec2(.095,.03),1.3,g); s+=st(p,vec2(.062,.07),1.2,g); s+=st(p,vec2(.06,-.035),1.15,g);
  s+=st(p,vec2(.085,.105),1.,g);
  vec2 rs=rot(.45)*p;
  float w=fbm(p*5.+uT*.012);
  float neb=fbm(vec2(rs.x*3.,rs.y*16.)+vec2(uT*.015,0.)+w*1.6);
  neb=pow(neb,2.6)*2.4;
  float fine=fbm(vec2(rs.x*9.,rs.y*44.)+w*2.);
  vec3 col=vec3(.002,.004,.012)+stars(uv)*.85;
  col+=vec3(.12,.3,1.)*neb*(g*.8+.08)*(.7+.6*fine)*(.85+.3*uB);
  col+=s;
  return col;
}` },

  trappist: { q: .85, ground: -0.02, shadow: -1, fs: `
vec3 planet(vec2 uv,vec2 c,float R,vec3 sp,vec3 base,inout float hit){
  vec2 d=(uv-c)/R; float rr=length(d);
  if(rr>1.)return vec3(0.);
  vec3 n=vec3(d,sqrt(1.-rr*rr));
  vec3 L=normalize(vec3(sp.xy-c,.25));
  float tx=fbm(n.xy*4.+c*20.);
  float dif=max(dot(n,L),0.);
  vec3 col=base*(.6+.7*tx)*dif*2.+vec3(1.,.35,.2)*pow(1.-n.z,3.)*smoothstep(-.2,.4,dot(n,L))*.6;
  hit=smoothstep(1.,1.-2./(R*uRes.y),rr);
  return col;
}
vec3 scene(vec2 uv){
  vec2 sp=vec2(.15,.08);
  vec3 col=mix(vec3(.07,.012,.008),vec3(.004,.001,.003),smoothstep(-.05,.45,uv.y));
  col+=stars(uv)*.6*smoothstep(.0,.3,uv.y);
  float ls=length(uv-sp);
  // 红矮星的耀斑：隔一阵猛地一亮，再慢慢退下去，边上甩出一道日珥
  float ft=uR/15., fid=floor(ft), fp=fract(ft)*15.;
  float fon=step(h12(vec2(fid,41.)),.65);
  float flare=fon*(1.-exp(-fp*6.))*exp(-fp*.55);
  col+=vec3(1.,.22,.06)*(exp(-ls*9.)*.5+exp(-ls*28.)*.7)*(.85+.3*uB)*(1.+flare*1.6);
  float sR=.045;
  float fa=h12(vec2(fid,42.))*6.28;
  vec2 fd=uv-sp; float fr=length(fd)/sR, fang=atan(fd.y,fd.x);
  float arc=exp(-sq((fr-1.-.35*sin(clamp((fang-fa)*2.2+1.57,0.,3.14)))*9.))*smoothstep(.75,.0,abs(fang-fa));
  col+=vec3(1.,.4,.15)*arc*flare*(.6+.6*fbm(fd*80.-uR*.5))*1.4*step(1.,fr);
  if(ls<sR){vec2 d=(uv-sp)/sR; float mu=sqrt(1.-dot(d,d));
    float gran=fbm(d*9.+uT*.06);
    col=vec3(1.,.28,.08)*(1.6+1.2*gran)*(.4+.6*mu)+vec3(1.,.5,.2)*pow(mu,3.);
    vec2 fs=vec2(cos(fa),sin(fa))*.82;
    col+=vec3(1.,.8,.5)*exp(-dot(d-fs,d-fs)*30.)*flare*2.5;}
  // 凌星：一颗行星的剪影从红矮星前面走过
  if(uEv.x>3.5){
    vec2 ec=sp+vec2(mix(-.08,.08,uEv.y),-.007);
    float er=length(uv-ec);
    if(er<.021)col=vec3(.012,.005,.005)+vec3(1.,.3,.1)*exp(-(.021-er)*900.)*.5*step(ls,sR+.003);
  }
  float hit=0.; vec3 pc;
  float dr=sin(uT*.006)*.06;
  pc=planet(uv,vec2(-.13+dr*.3,.29),.034,vec3(sp,0.),vec3(.25,.35,.42),hit); col=mix(col,pc,hit); hit=0.;
  pc=planet(uv,vec2(.0+dr*.2,.35),.018,vec3(sp,0.),vec3(.4,.3,.22),hit); col=mix(col,pc,hit); hit=0.;
  pc=planet(uv,vec2(.15+dr*.1,.24),.011,vec3(sp,0.),vec3(.35,.3,.3),hit); col=mix(col,pc,hit); hit=0.;
  pc=planet(uv,vec2(-.05,.4),.008,vec3(sp,0.),vec3(.3,.32,.35),hit); col=mix(col,pc,hit);
  float yh=-.02+.025*(fbm4(vec2(uv.x*4.,2.))-.5)+.012*fbm(vec2(uv.x*18.,5.));
  if(uv.y<yh){
    float dy=yh-uv.y, z=.4/max(dy,.001);
    vec2 q=vec2(uv.x*z,z);
    float ice=fbm(q*vec2(2.,.6));
    vec3 g=vec3(.035,.02,.025)*(.6+.8*ice);
    float refl=exp(-abs(uv.x-sp.x)*(18.+dy*60.))*(.5+.8*fbm(vec2(uv.x*60.,z*3.)));
    g+=vec3(1.,.25,.08)*refl*.45*smoothstep(.0,.05,dy)*(.85+.3*uB);
    g+=vec3(.9,.2,.08)*exp(-dy*120.)*.15*(1.+flare);
    vec2 gq=q*vec2(30.,8.); vec2 gi=floor(gq); float gh=h12(gi+5.);
    g+=vec3(1.,.4,.2)*step(.94,gh)*pow(max(sin(uR*(1.3+gh*2.)+gh*70.),0.),16.)*exp(-dot(fract(gq)-.5,fract(gq)-.5)*30.)*.6*smoothstep(.0,.04,dy);
    col=mix(col,g,smoothstep(0.,1.5/uRes.y,dy));
  }
  return col;
}` },

  pillars: { q: .75, hero: [0, 0.12], fs: `
float pil(vec2 p,float x0,float top,float w0,float lean){
  float cx=x0+lean*(p.y-top);
  float w=w0*(1.+(top-p.y)*1.1);
  float d=abs(p.x-cx)-w;
  if(p.y>top)d=length(vec2(p.x-cx,(p.y-top)*1.25))-w0*1.05;
  return d;
}
float pd3(vec2 q){return min(min(pil(q,-.105,.22,.045,.09),pil(q,.085,.07,.034,-.06)),pil(q,.2,-.06,.028,-.03));}
vec2 warpP(vec2 p){return p+(vec2(fbm(p*4.),fbm(p*4.+5.))-.5)*.09+(vec2(fbm4(p*17.+2.),fbm4(p*17.+7.))-.5)*.028;}
vec3 scene(vec2 uv){
  vec2 p=uv;
  float t=uT*.006;
  float h1=fbm(p*2.2+vec2(t,0.)),h2=fbm(p*4.5+vec2(0.,-t)+h1*1.5);
  vec3 col=mix(vec3(.01,.045,.06),vec3(.12,.3,.3),smoothstep(.25,.85,h2)*smoothstep(-.45,.35,p.y));
  col+=vec3(.5,.36,.14)*pow(h1,2.5)*1.4*smoothstep(-.05,.45,p.y);
  col+=vec3(.45,.6,.55)*exp(-length(p-vec2(.05,.6))*2.6)*.4;
  col+=stars(uv)*.5;
  vec2 pd=warpP(p);
  float d=pd3(pd);
  float dUp=pd3(warpP(p+vec2(0.,.008)));
  float lit=clamp((dUp-d)/.008*.8+.25,0.,1.);
  float tex=fbm(pd*11.);
  float wisp=fbm4(vec2(p.x*26.,p.y*9.-uT*.06));
  if(d<.004){
    float depth=clamp(-d*22.,0.,1.);
    vec3 inner=mix(vec3(.018,.008,.0035),vec3(.002,.001,.0006),depth)*(.3+1.4*tex*tex);
    inner+=vec3(1.,.58,.24)*exp(d*160.)*lit*lit*(.2+1.3*tex)*1.6;
    col=mix(col,inner,smoothstep(.004,-.004,d));
  }
  col+=vec3(.9,.65,.35)*exp(-max(d,0.)*45.)*step(0.,d)*wisp*wisp*lit*.6;
  float tw1=.7+.5*n2(vec2(abs(uR)*1.8,3.)), tw2=.7+.5*n2(vec2(abs(uR)*2.1,9.));
  col+=spikeStar(p-vec2(-.105,.27),.8*tw1)*vec3(1.,.9,.75)*(.35+.7*uB)*tw1;
  col+=spikeStar(p-vec2(.085,.108),.55*tw2)*vec3(1.,.9,.8)*(.35+.6*uB)*tw2;
  // 柱顶被星光蒸发出的气流，一缕缕往上飘
  float ev=fbm4(vec2(p.x*14.,p.y*5.-uT*.08));
  col+=vec3(.6,.75,.7)*pow(ev,3.)*exp(-max(d,0.)*30.)*step(0.,d)*lit*.5*smoothstep(-.2,.2,p.y);
  return col;
}` },

  crab: { q: .8, hero: [0, 0.15], fs: `
vec3 scene(vec2 uv){
  vec2 c=vec2(0.,.15);
  vec2 p=rot(.5)*(uv-c); p*=vec2(1.,1.35);
  float r=length(p),a=atan(p.y,p.x);
  vec2 ca=vec2(cos(a),sin(a));
  float env=smoothstep(.29,.13,r+.06*fbm(ca*3.+uT*.004));
  float warp=fbm(ca*2.5+vec2(r*6.,-uT*.01));
  float fil=pow(1.-abs(2.*n2(ca*9.+vec2(warp*5.,r*7.))-1.),7.);
  float fil2=pow(1.-abs(2.*n2(ca*22.+vec2(warp*8.,r*16.+5.))-1.),12.);
  vec3 col=stars(uv)*.8;
  vec3 fc=mix(vec3(1.,.18,.06),vec3(1.,.62,.32),fbm(p*10.));
  col+=fc*(fil*.9+fil2*.7)*env*smoothstep(.02,.12,r)*1.3*(.85+.3*sin(uR*.6-r*30.));
  col+=vec3(.22,.38,1.)*exp(-r*8.)*(.4+fbm(p*7.+uT*.006))*1.3*(.8+.4*uB);
  vec2 pp=uv-c; float pr=length(pp), ang=atan(pp.y,pp.x);
  float beam=pow(abs(cos(ang-uT*.35)),500.);
  col+=vec3(.55,.72,1.)*beam*exp(-pr*4.5)*(.35+.9*uB)*smoothstep(0.,.01,pr);
  col+=vec3(.85,.9,1.)*(exp(-pr*pr*60000.)*5.+.003/(pr+.003)*.35)*(.5+.9*uB);
  for(int i=0;i<3;i++){float ph=fract(uT/10.+float(i)/3.);col+=vec3(.5,.6,1.)*exp(-abs(r-ph*.45)*90.)*(1.-ph)*.12;}
  return col;
}` },

  blackhole: { q: .6, hero: [0, 0.15], fs: `
vec3 bg(vec3 d){vec2 s=vec2(atan(d.x,d.z),asin(clamp(d.y,-1.,1.)));
  float mw=exp(-abs(s.y+s.x*.3-.1)*5.)*fbm(s*4.);
  return starL(s*.6,190.,.06,1.)*.35+starL(s*.6,70.,.06,2.)*.6+vec3(.12,.08,.05)*mw*.6;}
vec3 scene(vec2 uv){
  vec2 sc=uv-vec2(0.,.15);
  vec3 ro=vec3(0.,2.6,-26.);
  vec3 fw=normalize(-ro), rt=normalize(cross(vec3(0.,1.,0.),fw)), up=cross(fw,rt);
  vec3 v=normalize(fw*.62+rt*sc.x+up*sc.y);
  vec3 p=ro; vec3 hc=cross(p,v); float h2=dot(hc,hc);
  vec3 acc=vec3(0.); float al=0.;
  for(int i=0;i<120;i++){
    float r=length(p);
    float dt=clamp(.09*r,.05,1.3);
    v=normalize(v-1.5*h2*p/pow(r,5.)*dt);
    vec3 pn=p+v*dt;
    if(p.y*pn.y<0.){
      vec3 hp=mix(p,pn,p.y/(p.y-pn.y)); float hr=length(hp.xz);
      if(hr>2.6&&hr<12.){
        vec2 q=rot(-uT*1.1/pow(hr,1.5))*hp.xz;
        float tex=fbm(q*.9+vec2(hr*2.,0.))*.7+n2(vec2(hr*22.,0.))*.45;
        // 跟着盘一起绕转的几团热斑
        float qa=atan(q.y,q.x);
        tex+=exp(-sq((hr-4.)*2.5))*pow(max(cos(qa-1.),0.),30.)*2.;
        tex+=exp(-sq((hr-6.5)*2.))*pow(max(cos(qa+2.),0.),24.)*1.4;
        float temp=pow(2.6/hr,1.2);
        vec3 dc=mix(vec3(1.,.28,.07),vec3(1.,.86,.62),temp)*temp*3.;
        float dop=1.+.6*dot(normalize(vec3(-hp.z,0.,hp.x)),-v);
        dc*=pow(dop,3.)*.55*(.85+.3*uB);
        float a=clamp(tex*1.5-.1,0.,1.)*smoothstep(2.6,3.1,hr)*smoothstep(12.,6.5,hr);
        acc+=(1.-al)*dc*a; al+=(1.-al)*a;
      }
    }
    p=pn;
    if(dot(p,p)<1.){al=1.;break;}
    if(r>40.)break;
    if(al>.98)break;
  }
  acc+=(1.-al)*bg(v);
  // 两极方向淡淡的喷流，里面的亮结一点点往外走
  float jy=abs(sc.y), jw=.004+jy*.05;
  float knots=.5+.7*fbm(vec2(jy*30.-uT*.6,sign(sc.y)*3.));
  acc+=vec3(.45,.6,1.)*exp(-sq(sc.x/jw))*smoothstep(.04,.1,jy)*exp(-jy*12.)*knots*.22*(.8+.4*uB)*(1.-al*.9);
  return acc;
}` },

  andromeda: { q: .8, hero: [0, 0.17], fs: `
vec3 scene(vec2 uv){
  vec2 p=uv-vec2(0.,.17);
  p=rot(.62)*p;
  vec2 g=p/vec2(1.,.3);
  float r=length(g), th=atan(g.y,g.x)-uT*.008;
  float sp=2.*(th-log(r+.002)*2.3);
  float arm=pow(.5+.5*cos(sp),2.);
  float disk=exp(-r*8.);
  float n=fbm(g*16.+vec2(uT*.002,0.));
  float dens=disk*(.3+.95*arm*(.55+.7*n));
  vec3 col=stars(uv);
  vec3 gc=mix(vec3(1.,.82,.6),vec3(.5,.62,1.),smoothstep(.05,.25,r)*arm);
  col+=gc*dens*2.4;
  float lane=pow(.5+.5*cos(sp+1.3),6.)*smoothstep(.03,.09,r)*exp(-r*4.5);
  col*=1.-clamp(lane*(.5+.7*fbm(g*28.))*1.3*(p.y<0.?1.:.55),0.,.88);
  vec2 kg=g*55.; vec2 id=floor(kg);
  if(h12(id)>.9){vec2 f=fract(kg)-.5-(h22(id)-.5)*.6;
    col+=mix(vec3(.55,.68,1.),vec3(1.,.5,.6),step(.96,h12(id+1.)))*exp(-dot(f,f)*50.)*arm*disk*5.*(.6+.8*pow(.5+.5*sin(uR*(.5+h12(id+2.))+h12(id)*50.),2.));}
  vec2 bp=p/vec2(1.,.62); float br=length(bp);
  col+=vec3(1.,.84,.6)*(exp(-br*42.)*2.6+exp(-br*13.)*.55)*(.85+.3*uB);
  col+=vec3(1.,.9,.75)*exp(-length(uv-vec2(.06,.085))*95.)*.8;
  col+=vec3(1.,.9,.8)*exp(-length((uv-vec2(-.12,.31))*vec2(1.,1.7))*45.)*.3;
  return col;
}` },

  deepfield: { q: .8, hero: [0, 0.1], fs: `
vec3 gal(vec2 p,float sc,float seed){
  vec2 g=p*sc,id=floor(g),f=fract(g)-.5;
  float h=h12(id+seed); if(h>.5)return vec3(0.);
  vec2 d=f-(h22(id+seed)-.5)*.45;
  d=rot(h12(id+seed+2.)*6.28)*d;
  d.y/=.25+.75*h12(id+seed+3.);
  float size=.05+.13*pow(h12(id+seed+4.),2.);
  float l=length(d)/size, ty=h12(id+seed+5.);
  vec3 c;
  if(ty<.4){float th=atan(d.y,d.x);float arm=.5+.5*cos(2.*th-log(l+.01)*4.);
    c=mix(vec3(1.,.82,.58),vec3(.5,.65,1.),smoothstep(.2,1.,l))*(exp(-l*3.)*(.4+arm*.9)+exp(-l*12.)*2.);}
  else if(ty<.85){c=vec3(1.,.74,.48)*exp(-l*l*2.5)*1.4;}
  else{c=vec3(1.,.32,.18)*exp(-l*l*3.)*1.2;}
  return c*.7;
}
vec3 scene(vec2 uv){
  vec3 col=vec3(.002,.002,.005);
  float s=fract(uT*.006);
  for(int i=0;i<4;i++){
    float z=(float(i)+1.-s)/4.;
    float sc=2.5*pow(2.,z*5.);
    float w=smoothstep(0.,.3,z)*smoothstep(1.,.75,z);
    col+=gal(uv+vec2(float(i)*.37,float(i)*.19),sc,float(i)*13.)*w;
  }
  float t1=.7+.5*n2(vec2(abs(uR)*1.7,1.)), t2=.7+.5*n2(vec2(abs(uR)*2.2,5.));
  col+=spikeStar(uv-vec2(-.09,.27),1.1*t1)*vec3(1.,.95,.85)*(.6+.4*uB)*t1;
  col+=spikeStar(uv-vec2(.13,.05),.7*t2)*vec3(.9,.95,1.)*(.6+.4*uB)*t2;
  col+=stars(uv)*.25;
  return col;
}` },

  cmb: { q: .75, hero: [0, 0.19], fs: `
vec3 ramp(float f){
  vec3 c=mix(vec3(.01,.03,.22),vec3(.15,.45,1.),smoothstep(.3,.44,f));
  c=mix(c,vec3(1.,.95,.85),smoothstep(.44,.52,f));
  c=mix(c,vec3(1.,.5,.12),smoothstep(.52,.6,f));
  c=mix(c,vec3(.6,.06,.03),smoothstep(.6,.72,f));
  return c;
}
vec3 scene(vec2 uv){
  vec2 c=vec2(0.,.19);
  vec2 d=(uv-c)/vec2(.15,.15);
  float rr=dot(d,d);
  vec3 col=stars(uv)*.7;
  float halo=exp(-max(sqrt(rr)-1.,0.)*3.);
  col+=vec3(.9,.6,.4)*halo*.1*(.7+.6*uB);
  if(rr<1.){
    vec3 n=vec3(d,sqrt(1.-rr));
    n.xz=rot(uT*.01)*n.xz;
    float f=fbm3(n*3.)*.55+fbm3(n*8.+4.)*.3+n3(n*30.)*.15;
    f+=(uB-.5)*.08+.03*sin(uR*.35+f*20.);
    vec3 sh=ramp(f)*(.2+.8*pow(1.-rr,.35))*.9;
    col=mix(col,sh,smoothstep(1.,.99,rr));
    col+=vec3(1.,.8,.6)*pow(rr,6.)*.25;
  }
  return col;
}` },
};
const GLSL_MAIN = `
uniform float uDim; uniform float uGround; uniform float uImp; uniform float uHz; uniform float uStir;
uniform vec2 uCon[12]; uniform float uConN; uniform vec4 uConBox;
void main(){
  vec2 sp=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 suv=(sp-uShift)/uZoom;
  vec3 c=max(scene(suv),0.);
  if(uEv.x>.5&&uEv.x<3.5) c+=sightFx(sp)*(uGround>.5?smoothstep(uHz,uHz+.04,suv.y):1.);
  // 小猫和地面接触：影子、压出的浅坑、被挤起的一圈土；在太空里则是一圈柔光
  if(uCat.z>0.){
    vec2 cd=(sp-uCat.xy)/vec2(uCat.z,uCat.z*.26);
    float r=length(cd);
    if(uGround>.5){
      vec2 sd=(sp-uCat.xy-vec2(uCat.z*.5*uCat.w,uCat.z*.02))/vec2(uCat.z*1.4,uCat.z*.3);
      c*=1.-.62*exp(-dot(sd,sd)*1.6);
      float grain=n2(sp*uRes.y*.3)*.6+n2(sp*uRes.y*.08)*.4;
      float rim=exp(-sq((r-1.05)*3.6))*uImp;
      c*=1.+rim*(.15+.9*grain);
      c*=1.-.35*smoothstep(1.,.55,r)*uImp;
      float clod=step(.82,n2(sp*uRes.y*.12))*exp(-sq((r-1.35)*2.2))*uImp;
      c*=1.-clod*.35;
    } else {
      c+=vec3(.45,.55,1.)*exp(-r*r*1.3)*.1;
      c+=vec3(.7,.8,1.)*exp(-sq((r-1.)*5.))*.05*(.6+.6*uB);
    }
  }
  // 我的星座：每次潜修点亮一颗，按顺序连起来
  if(uConN>.5){
    vec2 bp=(sp-uConBox.xy)/uConBox.zw;
    if(bp.x>-.4&&bp.x<1.4&&bp.y>-.4&&bp.y<1.4){
      float px=1./(uRes.y*uConBox.w);
      vec3 cc=vec3(0.);
      for(int i=0;i<12;i++){
        float fi=float(i);
        if(fi>=uConN)break;
        vec2 a=uCon[i], d=bp-a;
        float tw=.75+.25*sin(abs(uR)*(1.+fi*.3)+fi*2.)+step(uConN-1.5,fi)*(.4+.4*sin(abs(uR)*2.4));
        cc+=vec3(1.,.88,.62)*(exp(-dot(d,d)/(px*px*2.5))*1.5+exp(-dot(d,d)/(px*px*28.))*.14)*tw;
        if(i>0){
          vec2 b=uCon[i-1], ab=a-b;
          float hh=clamp(dot(bp-b,ab)/max(dot(ab,ab),1e-6),0.,1.);
          float dl=length(bp-b-ab*hh);
          cc+=vec3(.95,.82,.6)*exp(-dl*dl/(px*px*.5))*.12*smoothstep(0.,.08,hh*length(ab))*smoothstep(0.,.08,(1.-hh)*length(ab));
        }
      }
      c+=cc*(.8+.2*uB);
    }
  }
  c=1.-exp(-c*1.15);
  c=pow(c,vec3(.4545));
  // 被打扰时画面褪色，再慢慢恢复
  c=mix(c,vec3(dot(c,vec3(.299,.587,.114)))*.92,uStir*.9);
  c*=1.-.35*pow(length(sp*vec2(1.6,1.)),2.2);
  c*=uDim;
  c+=(h12(gl_FragCoord.xy+fract(uT)*91.)-.5)/180.;
  gl_FragColor=vec4(c,1.);
}`;

// 各页面下背景的状态：速度、亮度、帧率、缩放
const SPACE_MODES = {
  home: { speed: 1, dim: 1, fps: 30, zoom: 0.6, gzoom: 0.7, link: 0.35 },
  session: { speed: 0.5, dim: 0.8, fps: 20, zoom: 0.72, gzoom: 1, link: 1 },
  done: { speed: 0.6, dim: 0.75, fps: 24, zoom: 0.65, gzoom: 0.8, link: 0.5 },
  page: { speed: 0.4, dim: 0.3, fps: 10, zoom: 0.6, gzoom: 0.7, link: 0.2 },
};

// 灰尘的样子：月面在真空里沿抛物线飞、落得慢；火星有稀薄的风；太空里是一点点星尘
const DUST_STYLES = {
  moon: { color: '196,192,184', g: 70, drag: 0, wind: 0, n: 70 },
  mars: { color: '205,135,92', g: 140, drag: 1.2, wind: 22, n: 60 },
  trappist: { color: '120,78,74', g: 160, drag: 0.4, wind: 0, n: 50 },
  sky: { color: '190,210,255', g: -14, drag: 0.8, wind: 0, n: 26 },
};

const Space = (() => {
  let canvas, overlay, gl, o2, buf;
  let w = 0, h = 0, dpr = 1, gdpr = 1, scale = 0, quality = 1;
  let cur = null, warp = null, last = 0, lastRaf = 0, slow = 0, running = false;
  let t = 20, rt = 3, mode = SPACE_MODES.home, dim = 1, zoom = mode.zoom, breath = null;
  let shift = null, catEl = null, cat = [0, 0, 0, 1], imprint = 1, link = mode.link;
  let stirOn = false, stirV = 0;
  let ev = [0, 0, 0, 0], sun = [0, 0, 0, 0], mark = [0, 0, 0, 0];
  const con = new Float32Array(24);
  let conN = 0;
  let progs = {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const streaks = Array.from({ length: 160 }, () => ({ a: Math.random() * 7, d: Math.random() }));

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function prog(id) {
    if (progs[id]) return progs[id];
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, GLSL_HEAD + SCENES[id].fs + GLSL_MAIN));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = n => gl.getUniformLocation(p, n);
    return (progs[id] = {
      p, a: gl.getAttribLocation(p, 'a'), res: u('uRes'), t: u('uT'), r: u('uR'), b: u('uB'), shift: u('uShift'), zoom: u('uZoom'),
      dim: u('uDim'), cat: u('uCat'), ground: u('uGround'), imp: u('uImp'), hz: u('uHz'), link: u('uLink'),
      ev: u('uEv'), stir: u('uStir'), sun: u('uSun'), mk: u('uMk'), con: u('uCon'), conN: u('uConN'), conBox: u('uConBox'),
    });
  }

  function setupGL() {
    progs = {};
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    gdpr = Math.min(dpr, 1.25);
    w = innerWidth; h = innerHeight; scale = 0;
    overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr);
  }

  // 小猫脚底在画面里的位置（以屏幕高度为 1，中心为原点，向上为正）
  function catSpot() {
    if (!catEl) return null;
    const r = catEl.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: (r.left + r.width / 2 - w / 2) / h,
      y: (h / 2 - (r.top + r.height * 192 / 210)) / h,
      top: (h / 2 - r.top) / h,
      height: r.height / h,
      r: r.width * 0.36 / h,
    };
  }

  // 地面场景：地平线放在小猫脚后方，让小猫坐在地上；太空场景：主角放在小猫右上方，不挡住
  function targetShift(S, spot, z) {
    if (S.ground !== undefined) {
      const horizon = spot ? spot.y + spot.height * 0.4 : 0.08;
      return [0, horizon - S.ground * z];
    }
    const hx = spot ? spot.x + 0.1 : 0.1, hy = spot ? Math.min(spot.top + 0.09, 0.37) : 0.25;
    return [hx - S.hero[0] * z, hy - S.hero[1] * z];
  }

  function layout() {
    const S = SCENES[cur], spot = catSpot();
    const target = targetShift(S, spot, zoom);
    if (!shift) shift = target;
    const k = warp ? 1 : 0.18;
    shift = [shift[0] + (target[0] - shift[0]) * k, shift[1] + (target[1] - shift[1]) * k];
    cat = spot ? [spot.x, spot.y, spot.r, S.shadow || 1] : [0, 0, 0, 1];
  }

  // 4 秒吸、6 秒呼；呼吸模式下改用练习里的真实节奏
  function breathNow(now) {
    if (breath !== null) return breath;
    const c = (now / 1000) % 10;
    return c < 4 ? (1 - Math.cos(c / 4 * Math.PI)) / 2 : (1 + Math.cos((c - 4) / 6 * Math.PI)) / 2;
  }

  // o：生成明信片时临时换一套构图
  function draw(id, b, o) {
    const s = gdpr * SCENES[id].q * quality;
    if (!o && Math.abs(s - scale) > 1e-3) { scale = s; canvas.width = Math.round(w * s); canvas.height = Math.round(h * s); }
    const v = o || { shift, zoom, cat, dim, imp: imprint };
    const P = prog(id);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(P.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(P.a);
    gl.vertexAttribPointer(P.a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(P.res, canvas.width, canvas.height);
    gl.uniform1f(P.t, t);
    gl.uniform1f(P.r, reduce ? -1 : rt);
    gl.uniform1f(P.b, b);
    gl.uniform2f(P.shift, v.shift[0], v.shift[1]);
    gl.uniform1f(P.zoom, v.zoom);
    gl.uniform1f(P.dim, v.dim);
    gl.uniform4f(P.cat, v.cat[0], v.cat[1], v.cat[2], v.cat[3]);
    gl.uniform1f(P.ground, SCENES[id].ground !== undefined ? 1 : 0);
    gl.uniform1f(P.hz, SCENES[id].ground !== undefined ? SCENES[id].ground : -1);
    gl.uniform1f(P.imp, v.imp);
    gl.uniform1f(P.link, link);
    gl.uniform1f(P.stir, o ? 0 : stirV);
    gl.uniform4f(P.ev, ev[0], ev[1], ev[2], ev[3]);
    gl.uniform4f(P.sun, sun[0], sun[1], sun[2], sun[3]);
    gl.uniform4f(P.mk, mark[0], mark[1], mark[2], mark[3]);
    // 星座放在左上角一小块
    const aspect = canvas.width / canvas.height, box = 0.1;
    gl.uniform4f(P.conBox, -aspect / 2 + 0.035, 0.37 - box, box, box);
    gl.uniform2fv(P.con, con);
    gl.uniform1f(P.conN, conN);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    // 显卡跟不上时（帧间隔持续偏长）自动降低分辨率
    if (lastRaf && !document.hidden) {
      const gap = now - lastRaf;
      slow = gap > 45 && gap < 500 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 20 && quality > 0.5) { quality *= 0.85; slow = 0; }
    }
    lastRaf = now;
    if (document.hidden || now - last < 1000 / mode.fps - 4) return;
    const dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    if (!reduce) { t = (t + dt * mode.speed) % 3600; rt = (rt + dt) % 3600; }
    const k = Math.min(1, dt * 3);
    dim += (mode.dim - dim) * k;
    link += (mode.link - link) * k;
    stirV = stirOn ? Math.min(1, stirV + dt * 6) : Math.max(0, stirV - dt / 8);
    const zt = cur && SCENES[cur].ground !== undefined ? mode.gzoom : mode.zoom;
    zoom += (zt - zoom) * k;
    if (!w) size();
    const b = breathNow(now);
    try {
      o2.setTransform(dpr, 0, 0, dpr, 0, 0);
      o2.clearRect(0, 0, w, h);
      if (!warp) { layout(); draw(cur, b); return; }
      const p = (now - warp.start) / 1300;
      if (p >= 0.5 && cur !== warp.to) { cur = warp.to; layout(); if (warp.onMid) warp.onMid(); }
      layout();
      draw(cur, b);
      const kk = p < 0.5 ? p / 0.5 : Math.max(0, 1 - (p - 0.5) / 0.5);
      o2.fillStyle = `rgba(2,3,8,${Math.min(1, kk * 1.25)})`;
      o2.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.32;
      o2.lineCap = 'round';
      for (const s of streaks) {
        const r0 = (s.d * 0.4 + kk * 0.3) * h, len = kk * kk * h * 0.35 * (0.4 + s.d);
        o2.strokeStyle = `rgba(200,220,255,${kk * (0.3 + s.d * 0.6)})`;
        o2.lineWidth = 0.6 + s.d;
        o2.beginPath();
        o2.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0);
        o2.lineTo(cx + Math.cos(s.a) * (r0 + len), cy + Math.sin(s.a) * (r0 + len));
        o2.stroke();
      }
      if (p >= 1) warp = null;
    } catch (e) {
      fail(e);
    }
  }

  function fail(e) {
    console.error('space background off:', e);
    running = false;
    document.body.classList.remove('space-on');
  }

  /* ---------- 灰尘粒子：画在最上层的一张透明画布上 ---------- */

  let dustCanvas = null, dctx = null, motes = [], dustLast = 0;

  function dustFrame(now) {
    const dt = Math.min(0.05, (now - dustLast) / 1000 || 0.016);
    dustLast = now;
    const W = innerWidth, H = innerHeight, d = Math.min(devicePixelRatio || 1, 2);
    if (dustCanvas.width !== Math.round(W * d)) { dustCanvas.width = Math.round(W * d); dustCanvas.height = Math.round(H * d); }
    dctx.setTransform(d, 0, 0, d, 0, 0);
    dctx.clearRect(0, 0, W, H);
    motes = motes.filter(m => m.life > 0);
    for (const m of motes) {
      if (!m.landed) {
        m.vx += (m.st.wind - m.vx) * m.st.drag * dt;
        m.vy += m.st.g * dt - m.vy * m.st.drag * dt * 0.5;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.st.g > 0 && m.vy > 0 && m.y >= m.floor) { m.y = m.floor; m.landed = true; }
      }
      m.life -= dt * (m.landed ? 1.6 : m.fade);
      const a = Math.max(0, Math.min(1, m.life)) * m.a;
      dctx.fillStyle = `rgba(${m.st.color},${a})`;
      dctx.beginPath();
      dctx.arc(m.x, m.y, m.s, 0, 7);
      dctx.fill();
    }
    if (motes.length) requestAnimationFrame(dustFrame);
    else dctx.clearRect(0, 0, W, H);
  }

  function puff(kind) {
    if (!running || !catEl || reduce) return;
    const r = catEl.getBoundingClientRect();
    if (!r.width) return;
    if (!dustCanvas) {
      dustCanvas = document.createElement('canvas');
      dustCanvas.className = 'dust';
      document.body.appendChild(dustCanvas);
      dctx = dustCanvas.getContext('2d');
    }
    const ground = SCENES[cur].ground !== undefined;
    const st = DUST_STYLES[ground ? cur : 'sky'] || DUST_STYLES.moon;
    const fx = r.left + r.width / 2, fy = r.top + r.height * 192 / 210, half = r.width * 0.3;
    const n = Math.round(st.n * (kind === 'stand' ? 0.6 : 1));
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = fx + side * half * (0.4 + Math.random() * 0.75);
      const sp = ground ? 30 + Math.random() * 90 : 6 + Math.random() * 20;
      const ang = ground ? (0.15 + Math.random() * 0.9) : Math.random() * Math.PI;
      motes.push({
        x, y: fy - Math.random() * 3, st,
        vx: ground ? side * Math.cos(ang) * sp : Math.cos(ang) * sp,
        vy: ground ? -Math.sin(ang) * sp : -Math.abs(Math.sin(ang)) * sp,
        floor: fy + Math.random() * 7,
        s: 0.6 + Math.random() * (ground ? 1.7 : 1.4),
        a: ground ? 0.35 + Math.random() * 0.5 : 0.4 + Math.random() * 0.5,
        life: 1, fade: ground ? 0.25 : 0.45, landed: false,
      });
    }
    dustLast = performance.now();
    requestAnimationFrame(dustFrame);
  }

  return {
    // 成功返回 true；手机不支持 WebGL 时返回 false，界面退回原来的极光背景
    start(id) {
      if (running) { cur = id; return true; }
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'space';
        overlay = document.createElement('canvas');
        overlay.className = 'space space-warp';
        document.body.prepend(canvas, overlay);
        gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
        o2 = overlay.getContext('2d');
        if (!gl) return false;
        setupGL();
        // 显卡资源被系统收回时先露出极光背景，恢复后再切回来，不留黑屏
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); document.body.classList.remove('space-on'); });
        canvas.addEventListener('webglcontextrestored', () => {
          setupGL(); scale = 0;
          if (running) document.body.classList.add('space-on');
        });
        addEventListener('resize', () => { w = 0; });
      }
      if (!gl) return false;
      cur = id;
      try { prog(id); } catch (e) { fail(e); return false; }
      running = true;
      document.body.classList.add('space-on');
      requestAnimationFrame(frame);
      return true;
    },
    stop() {
      running = false;
      document.body.classList.remove('space-on');
    },
    go(id, onMid) {
      if (!running || (id === cur && !warp)) { if (onMid) onMid(); return; }
      try { prog(id); } catch (e) { fail(e); if (onMid) onMid(); return; }
      warp = { start: performance.now(), to: id, onMid };
    },
    mode(name, el) {
      mode = SPACE_MODES[name] || SPACE_MODES.home;
      if (name === 'page') dim = mode.dim;
      catEl = el || null;
      if (name !== 'session') imprint = 1;
    },
    breath(b) { breath = b; },
    stir(on) { stirOn = on; },
    // 地上被坐出的印子：0 还没坐下，1 坐实了（起身后印子保留）
    imprint(v) { imprint = v; },
    puff,
    // 稀有天象：type 0 表示没有
    event(type, progress, seed) { ev = [type, progress || 0, seed || 0, 0]; },
    // 真实地球：太阳方向（决定地相）、你所在位置的方向、地球转角
    sky(o) { sun = o ? [...o.sun, 1] : [0, 0, 0, 0]; mark = o ? [...o.mark, o.spin] : [0, 0, 0, 0]; },
    // 我的星座：最多 12 个点，坐标在 0–1 的小方框里
    constellation(points) {
      con.fill(0);
      points.slice(0, 12).forEach((p, i) => { con[i * 2] = p[0]; con[i * 2 + 1] = p[1]; });
      conN = Math.min(12, points.length);
    },
    // 按明信片的构图在显卡上画一帧，拷到普通画布上返回
    snapshot(W, H, spot) {
      if (!running || !gl) return null;
      const S = SCENES[cur], z = S.ground !== undefined ? SPACE_MODES.done.gzoom : SPACE_MODES.done.zoom;
      try {
        canvas.width = W; canvas.height = H; scale = -1;
        draw(cur, breathNow(performance.now()), {
          shift: targetShift(S, spot, z), zoom: z, cat: [spot.x, spot.y, spot.r, S.shadow || 1], dim: 1, imp: 1,
        });
        const out = document.createElement('canvas');
        out.width = W; out.height = H;
        out.getContext('2d').drawImage(canvas, 0, 0);
        return out;
      } catch (e) {
        console.error(e);
        return null;
      }
    },
    get place() { return cur; },
    get on() { return running; },
  };
})();
