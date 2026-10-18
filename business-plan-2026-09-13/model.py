from pathlib import Path
import json, csv, math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

ROOT=Path(__file__).resolve().parent
(ROOT/'assets').mkdir(exist_ok=True)
BASE_ADDS=[0,0,3,5,7,9,11,13,15,17,19,21]+[25]*12+[40]*12
ARPA=59*.40+129*.45+299*.15
CAPITAL=175000
OPEX=[{'product':4000,'founder':3000,'marketing':1500,'general':1000}, {'product':7000,'founder':4000,'marketing':3000,'general':1500}, {'product':10000,'founder':5000,'marketing':5000,'general':2000}]

def project(multiplier=1,churn=.02,arpa=ARPA):
    rows=[]; end=0; cash=CAPITAL; ytd=0
    for m,base in enumerate(BASE_ADDS,1):
        year=(m-1)//12
        opening=end; lost=opening*churn; adds=base*multiplier; end=opening-lost+adds
        billed=opening-lost+adds/2
        gross=billed*arpa; refunds=gross*.01; revenue=gross-refunds
        fees=gross*.036+billed*.30
        delivery=billed*15; onboarding=adds*60
        cogs=fees+delivery+onboarding; profit=revenue-cogs
        expense=sum(OPEX[year].values()); launch=10000 if m==1 else 5000 if m==2 else 0
        operating=profit-expense-launch; ytd+=operating
        tax=max(ytd,0)*.25 if m%12==0 else 0
        net=operating-tax; cash+=net
        rows.append(dict(month=m,year=year+1,opening=opening,churned=lost,adds=adds,ending=end,billed=billed,gross_sales=gross,refunds=refunds,revenue=revenue,fees=fees,delivery=delivery,onboarding=onboarding,cogs=cogs,gross_profit=profit,**OPEX[year],opex=expense,launch=launch,operating_profit=operating,tax=tax,net_income=net,ending_cash=cash,mrr=end*arpa,arr=end*arpa*12))
        if m%12==0:ytd=0
    annual=[]
    for y in range(1,4):
        rr=[r for r in rows if r['year']==y]
        sums={k:sum(r[k] for r in rr) for k in ['adds','churned','gross_sales','refunds','revenue','fees','delivery','onboarding','cogs','gross_profit','product','founder','marketing','general','opex','launch','operating_profit','tax','net_income']}
        sums.update(year=y,ending=rr[-1]['ending'],mrr=rr[-1]['mrr'],arr=rr[-1]['arr'],cash=rr[-1]['ending_cash'],gross_margin=sums['gross_profit']/sums['revenue'])
        annual.append(sums)
    positive=next((r['month'] for i,r in enumerate(rows) if r['operating_profit']>0 and all(q['operating_profit']>0 for q in rows[i:])),None)
    return dict(rows=rows,annual=annual,low_cash=min(r['ending_cash'] for r in rows),low_month=min(rows,key=lambda r:r['ending_cash'])['month'],first_sustained_positive=positive,capital_required=CAPITAL-min(r['ending_cash'] for r in rows)+30000)

cases={'Base':project(),'Downside':project(.6,.035,ARPA*.9),'Upside':project(1.4,.015,ARPA)}
payload=dict(arpa=ARPA,capital=CAPITAL,base_adds=BASE_ADDS,opex=OPEX,cases=cases)
(ROOT/'financial-model.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
with (ROOT/'OverHead-Monthly-Financial-Model.csv').open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.DictWriter(f,fieldnames=cases['Base']['rows'][0].keys());writer.writeheader();writer.writerows(cases['Base']['rows'])

plt.rcParams.update({'font.family':'Arial','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,'axes.edgecolor':'#ced8df','text.color':'#162c3d','axes.labelcolor':'#526474','xtick.color':'#526474','ytick.color':'#526474','svg.fonttype':'none'})
colors=['#087f8c','#bb7550','#8395a5']
def save(fig,name):
    fig.tight_layout(pad=1.2);fig.savefig(ROOT/'assets'/name,format='svg',bbox_inches='tight',facecolor='white');plt.close(fig)
annual=cases['Base']['annual']
fig,ax=plt.subplots(figsize=(7.2,2.7))
xx=list(range(3));ax.bar([x-.18 for x in xx],[a['revenue']/1000 for a in annual],.36,color=colors[0],label='Net revenue')
ax.bar([x+.18 for x in xx],[a['operating_profit']/1000 for a in annual],.36,color=colors[1],label='Operating profit / (loss)')
ax.axhline(0,color='#adbcc6',lw=.7);ax.set_xticks(xx,['Year 1','Year 2','Year 3']);ax.set_ylabel('USD, thousands');ax.legend(frameon=False,loc='upper left');save(fig,'financial-outlook.svg')
fig,ax=plt.subplots(figsize=(7.2,2.8))
for (label,case),color in zip(cases.items(),colors):ax.plot([r['month'] for r in case['rows']],[r['ending_cash']/1000 for r in case['rows']],label=label,color=color,lw=2.3)
ax.axhline(30,color='#aebcc5',ls='--',label='$30k minimum reserve');ax.axhline(0,color='#aebcc5',lw=.8);ax.set(xlabel='Planning month',ylabel='Cash, USD thousands',xlim=(1,36));ax.legend(frameon=False,ncol=2,fontsize=8);save(fig,'cash-scenarios.svg')
fig,ax=plt.subplots(figsize=(7.2,2.6))
labels=['Reaching customers / growing sales','Paying operating expenses','Uneven cash flow'];values=[57,54,50]
ax.barh(labels[::-1],values[::-1],color=['#9cadb9','#bb7550','#087f8c']);ax.set_xlim(0,70);ax.set_xlabel('Share of surveyed small employer firms (%)')
for i,v in enumerate(values[::-1]):ax.text(v+1,i,f'{v}%',va='center',fontweight='bold')
save(fig,'market-challenges.svg')
for case in cases.values():
    for r in case['rows']:assert abs(r['revenue']-r['cogs']-r['opex']-r['launch']-r['tax']-r['net_income'])<1e-7
    assert abs(CAPITAL+sum(a['net_income'] for a in case['annual'])-case['annual'][-1]['cash'])<1e-6
print(json.dumps({name:{'annual':c['annual'],'low_cash':c['low_cash'],'low_month':c['low_month'],'sustained_positive':c['first_sustained_positive'],'capital_with_reserve':c['capital_required']} for name,c in cases.items()},indent=2))
