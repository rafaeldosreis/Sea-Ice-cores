#!/usr/bin/env python3
"""Aggregate 1 cm Core 16 physical properties into geochemical intervals."""
from __future__ import annotations
import argparse,json,re,unicodedata
from pathlib import Path
import numpy as np
import pandas as pd
DEPTH_MAX=163.0
SEGMENTS=[('A1',0,20),('A2',20,40),('B1',40,60),('B2',60,80),('C1',80,100),('C2',100,120),('D1',120,140),('E',140,163)]
def norm(s): return re.sub(r'(^_|_$)','',re.sub(r'[^a-z0-9]+','_',unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower()))
def col(df,*patterns):
 normalized={c:norm(c) for c in df.columns}
 for p in patterns:
  for c,n in normalized.items():
   if n==p: return c
 for p in patterns:
  for c,n in normalized.items():
   if n.startswith(p+'_') or n.endswith('_'+p): return c
 for p in patterns:
  for c,n in normalized.items():
   if p in n: return c
 return None
def numbers(s): return pd.to_numeric(s.astype(str).str.strip().str.replace(',','.',regex=False),errors='coerce')
def chem_intervals(df):
 t=col(df,'depth_top','top_depth','from_cm','top_cm','depth_from'); b=col(df,'depth_bottom','bottom_depth','to_cm','bottom_cm','depth_to'); d=col(df,'depth_cm','depth','profundidade')
 out=df.copy(); n=len(out)
 if t and b: top,bottom=numbers(out[t]),numbers(out[b])
 elif d:
  mid=numbers(out[d]); top=(mid-2.5).clip(lower=0); bottom=(mid+2.5).clip(upper=DEPTH_MAX)
 else:
  top=pd.Series([i*5 if i<31 else 155 for i in range(n)],dtype=float); bottom=pd.Series([min((i+1)*5,155) if i<31 else 163 for i in range(n)],dtype=float)
 if n and abs(top.iloc[-1]-155)<3: bottom.iloc[-1]=163
 out.insert(0,'depth_top_cm',top); out.insert(1,'depth_bottom_cm',bottom); out.insert(2,'depth_mid_cm',(top+bottom)/2); return out
def physical_layers(df):
 d=col(df,'depth_cm','depth','profundidade','cm'); work=df.copy(); dep=numbers(work[d]) if d else pd.Series(np.arange(len(work)),dtype=float); mn=dep.min()
 if pd.notna(mn) and .25<=mn<.75: top,bottom,convention=dep-.5,dep+.5,'center'
 elif pd.notna(mn) and .75<=mn<=1.25: top,bottom,convention=dep-1,dep,'bottom'
 else: top,bottom,convention=dep,dep+1,'top'
 work['_top']=top.clip(lower=0);work['_bottom']=bottom.clip(upper=DEPTH_MAX);work['_mid']=(top+bottom)/2
 cols={'brine':col(work,'brine'),'porosity':col(work,'porosity','porosidade','pore','void'),'density':col(work,'density','densidade','rho','bulk')}
 for key,c in cols.items(): work[key]=numbers(work[c]) if c else np.nan
 return work,cols,convention
def weighted(df,top,bottom,key):
 overlap=np.maximum(0,np.minimum(bottom,df['_bottom'])-np.maximum(top,df['_top'])); valid=df[key].notna()&(overlap>0); w=overlap[valid]
 if not valid.any() or w.sum()==0:return np.nan,np.nan,0.0,0
 vals=df.loc[valid,key];return np.average(vals,weights=w),vals.std(ddof=1) if len(vals)>1 else np.nan,float(w.sum()/(bottom-top)),int(valid.sum())
def segment(d):
 return next((s for s,t,b in SEGMENTS if t<=d<(b+.001 if b==163 else b)),'E')
def main():
 p=argparse.ArgumentParser();p.add_argument('--physical',default='Core16_Density.csv');p.add_argument('--chemistry',default='ICP_data.csv');p.add_argument('--models',default='geochemistry_model_data.csv');p.add_argument('--output',default='aligned_profile.csv');p.add_argument('--meta',default='profile_metadata.json');a=p.parse_args()
 physical_raw=pd.read_csv(a.physical);chem_raw=pd.read_csv(a.chemistry);models=pd.read_csv(a.models) if Path(a.models).exists() else pd.DataFrame();phys,cols,conv=physical_layers(physical_raw);chem=chem_intervals(chem_raw);sid=col(chem_raw,'sample_id','sample','amostra','id')
 rows=[]
 for i,r in chem.iterrows():
  top,bottom=float(r.depth_top_cm),float(r.depth_bottom_cm); row={'sample_id':r[sid] if sid else f'S{i+1:02d}','depth_top_cm':top,'depth_bottom_cm':bottom,'depth_mid_cm':(top+bottom)/2,'interval_cm':bottom-top,'segment':segment((top+bottom)/2)};cover=[]
  for key in ('brine','porosity','density'):
   mean,sd,cov,n=weighted(phys,top,bottom,key);row.update({f'{key}_mean':mean,f'{key}_sd':sd,f'{key}_n':n});cover.append(cov)
  available=[c for key,c in zip(('brine','porosity','density'),cover) if cols[key]]
  row['coverage_fraction']=min(available) if available else 0.0;rows.append(row)
 aligned=pd.DataFrame(rows);chem_export=chem_raw.add_prefix('chem_');model_export=models.add_prefix('model_').reindex(range(len(aligned)));result=pd.concat([aligned,chem_export.reset_index(drop=True),model_export.reset_index(drop=True)],axis=1);result.to_csv(a.output,index=False)
 meta={'profile_depth_cm':[0,163],'physical_rows':len(physical_raw),'chemical_intervals':len(chem_raw),'model_rows':len(models),'physical_depth_convention':conv,'physical_columns':cols,'segments':[{'id':s,'top_cm':t,'bottom_cm':b} for s,t,b in SEGMENTS],'last_interval_cm':[float(chem.iloc[-1].depth_top_cm),float(chem.iloc[-1].depth_bottom_cm)] if len(chem) else None};Path(a.meta).write_text(json.dumps(meta,indent=2),encoding='utf-8')
if __name__=='__main__':main()
