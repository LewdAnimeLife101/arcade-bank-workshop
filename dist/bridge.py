"""Browser bridge; validated Python states remain opaque to JavaScript."""
import json,base64,uuid,copy,dataclasses,re
from pathlib import Path
from importlib import import_module
from arcade_editor.registry import PROFILES,get_profile,suggest
from zwl_editor.fixed import parse_fixed,format_fixed

sessions={}

def construct(pid,raw,name,player,author):
    if not all(re.fullmatch(r'[0-9]+-S2-[0-9]+-[0-9]+', value) for value in (player,author)):
        raise ValueError('Both original account handles are required.')
    p=get_profile(pid);path=Path('/local')/player/'Banks'/author/name
    kw={} if pid=='unity' else {'player':player}
    if pid in ('reign','fallen','mineralz_evolution_258'):kw['author']=author
    bank=import_module(p.package+'.core').Bank(raw,path,**kw)
    if bank.errors:raise ValueError('; '.join(bank.errors))
    if pid=='unity' and bank.root.find('Signature') is not None and bank.signature_status()!='Verified':
        raise ValueError('Original native signature does not match these account handles.')
    return bank

def render(s,target):
    kw={}
    if s['profile']=='reign':kw={'hero_levels':s['levels'],'hero_evolutions':s['evos']}
    result=s['bank'].render(target,**kw)
    raw=result[0];effective=result[1] if s['profile']=='unity' else target
    fresh=construct(s['profile'],raw,s['name'],s['player'],s['author'])
    if fresh.state!=effective:raise ValueError('Output state did not pass read-back verification.')
    return raw,effective,result[-1]

def field(s,path,label,group='Progress',kind='int',minimum=0,maximum=None,description='',options=None,readonly=False):
    obj=s['work']
    for key in path:obj=getattr(obj,key) if dataclasses.is_dataclass(obj) else obj[key]
    value=format_fixed(obj) if kind=='fixed' else obj=='1' if kind=='bit' else obj
    key=json.dumps(path,separators=(',',':'))
    return {'id':key,'label':label,'group':group,'kind':kind,'value':value,'min':minimum,'max':maximum,'description':description,'options':options,'readonly':readonly,'path':path}

def describe(s):
    b=s['bank'];p=b.profile;t=s['work'];pid=s['profile'];rows=[]
    def add(*a,**k):rows.append(field(s,*a,**k))
    if pid=='unity':
        add(['tp'],'Talent points',maximum=65000);add(['wave'],'Highest wave',maximum=2147483647)
        for category in ['talents','kills','wins','evolutions']:
            for spec in p[category]:
                key=spec['bankkey']
                add([category,key],spec.get('label',key),category.title(),minimum=spec.get('min',0),maximum=spec.get('max',2147483647),description=spec.get('description',''))
    elif pid=='liberty':
        for key,label,cap in [('kills','Kill balance',2147483647),('dust','Soul dust',2147483647//13),('best_solo','Best solo difficulty',30)]:
            difficulty=p.get('solo_difficulties',{})
            source=difficulty.get('choices',[]) if isinstance(difficulty,dict) else difficulty
            opts=[{'value':x.get('id',x.get('value')),'label':x.get('label',x.get('name'))} for x in source] if key=='best_solo' else None
            add([key],label,maximum=cap,options=opts)
        for h in p['heroes']:
            n=h['id'];group='Hero · '+h['label'];v=t.heroes[n]
            for key,label,kind,low,cap in [('purchased','Unlocked','bool',0,None),('level','Level','int',1,20+10*v.ascensions.count('1')),('xp','Current-level XP','int',0,524287),('prestige','Prestige','int',0,h['prestige_max'])]:add(['heroes',n,key],label,group,kind,low,cap)
            for a in h['ascensions']:
                if a.get('available'):add(['heroes',n,'ascensions',a['position']-1],a['label'],group,'bit',description=a.get('description',''))
        for n in t.challenges:add(['challenges',n],f'Challenge {n}','Challenges','bool')
        souls=b.souls_profile
        for n,v in t.souls.items():
            group=f'Soul jewel {n}';cap=next((x['stats2_to5_cap'] for x in souls['tiers'] if x['code']==v.type),0)
            add(['souls',n,'type'],'Jewel tier',group,maximum=15,options=[{'value':0,'label':'Empty slot'}]+[{'value':x['code'],'label':f'Tier {x["code"]}'} for x in souls['tiers']])
            labels=['Starting minerals','Damage (%)','Life and shields (%)','Armor (%)','Movement speed (raw)','First unique effect','Enhancement count','Second unique effect']
            for i,label in enumerate(labels):add(['souls',n,'stats',i],label,group,'fixed',0,cap*(10 if i==0 else 1) if i<5 else 14 if i in (5,7) else 524287,description='Tier limits are enforced again at export. Movement speed displays as raw / 200.' if i<5 else 'Effect IDs 0–14; enhancement count is preserved by Max jewel stats.')
        for key,v in t.settings.items():add(['settings',key],key,'Settings','bool' if isinstance(v,bool) else 'int')
    elif pid in ('mineralz','reign','fallen','mineralz_evolution_258'):
        profile=p
        if pid=='reign':
            from zrc_editor.guidance import enriched_profile
            profile=enriched_profile(p)
        for spec in profile['fields']:
            key=(spec['section'],spec['key']) if pid=='reign' else spec['key']
            if key not in t.values:continue
            path=['values',key];kind=spec.get('type','string' if isinstance(t.values[key],str) else 'int');kind='bool' if kind=='flag' else kind
            if pid=='reign' and spec.get('unit_key'):continue
            add(path,spec['label'],spec.get('group',spec.get('category','Progress')),kind,spec.get('min',0),spec.get('max'),spec.get('description',spec.get('help','')),readonly=not spec.get('editable',True))
        if pid=='mineralz':
            for i in range(108):
                rows.append({'id':f'achievement:{i}','label':f'Achievement {i+1}','group':'Achievements','kind':'bool','value':t.achievements[i]!=p['achievements_codec']['base_string'][i],'min':0,'max':None,'description':'Saved achievement flag. Reserved positions are preserved.','readonly':False})
        if pid=='fallen':
            for i,page in enumerate(p['trophy_pages']):
                for j,tr in enumerate(page['trophies']):add(['trophies',i,j],tr['label'],'Trophies','bit',description=tr.get('description',''),readonly=tr.get('restricted',False))
            for h in p['heroes']:
                if h.get('xp_index') is not None:add(['hero_xp',h['xp_index']],h['label']+' XP','Heroes',maximum=h.get('max_xp',159510),description=h.get('description',''))
                add(['hero_tiers',h['tier_index']],h['label']+' evolution','Heroes',minimum=1,maximum=h.get('editable_max_tier',h['max_tier']),description=h.get('evolution_description',''),readonly=h.get('editable_max_tier',h['max_tier'])<=1)
            for i in range(7):add(['skill_tiers',i],f'Tier {i+1} rank','Skills',maximum=4)
        if pid=='reign':
            from zrc_editor.levels import level_for_xp
            for spec in p['fields']:
                if spec.get('unit_key'):
                    rows.append({'id':f'level:{spec["hero"]}','label':spec['label'].replace('XP','level'),'group':'Hero levels','kind':'int','value':level_for_xp(t.values[spec['section'],spec['key']]),'min':1,'max':105,'options':[{'value':i,'label':f'Level {i}'} for i in range(1,106)],'description':'Synchronizes hero XP, enhancement cap and current-version migration markers.','readonly':False})
    # JSON cannot represent tuple keys; descriptor paths stay private in Python.
    s['fields']={r['id']:r for r in rows}
    return [{k:v for k,v in r.items() if k!='path'} for r in rows]

def set_path(obj,path,value):
    if not path:return value
    key=path[0]
    if dataclasses.is_dataclass(obj):setattr(obj,key,set_path(getattr(obj,key),path[1:],value));return obj
    if isinstance(obj,(tuple,str)):
        xs=list(obj);xs[key]=set_path(xs[key],path[1:],value)
        return ''.join(xs) if isinstance(obj,str) else tuple(xs)
    obj[key]=set_path(obj[key],path[1:],value);return obj

def apply_edits(s,edits):
    describe(s)
    for key,value in edits.items():
        spec=s['fields'].get(key)
        if not spec or spec.get('readonly'):raise ValueError('Unsupported or read-only field.')
        kind=spec['kind']
        if kind in ('bool','bit'):
            if type(value)!=bool:raise ValueError(spec['label']+': expected a checkbox value.')
            parsed=('1' if value else '0') if kind=='bit' else value
        elif kind=='fixed':parsed=parse_fixed(str(value))
        elif kind in ('string','text'):parsed=str(value)
        else:
            from zwl_editor.common import integer
            parsed=integer(value,spec['label'],spec.get('min',0),spec.get('max') if spec.get('max') is not None else 2147483647)
        if key.startswith('achievement:'):
            n=int(key.split(':')[1]);base=s['bank'].profile['achievements_codec']['base_string'];v=list(s['work'].achievements);v[n]=str(int(base[n])+int(value));s['work'].achievements=''.join(v)
        elif key.startswith('level:'):
            from zrc_editor.levels import xp_for_level,required_enhancement
            hero=int(key.split(':')[1]);sp=next(x for x in s['bank'].profile['fields'] if x.get('unit_key') and x['hero']==hero)
            s['work'].values[sp['section'],sp['key']]=xp_for_level(parsed);s['work'].values['Perks','PRank52']=max(s['work'].values['Perks','PRank52'],required_enhancement(parsed));s['levels'][hero]=parsed
        else:set_path(s['work'],spec['path'],parsed)
    if s['profile']=='mineralz' and '["values","v10"]' in edits:
        s['work'].values['v11']=s['work'].values['v10']*4096

def result(s):
    out={'session':s['id'],'profile':s['profile'],'name':s['name'],'player':s['player'],'author':s['author'],'demo':s['demo'],'fields':describe(s),'warnings':s['bank'].warnings,'dirty':s['work']!=s['bank'].state}
    if s['profile']=='liberty':out['soulCaps']={str(x['code']):x['stats2_to5_cap'] for x in s['bank'].souls_profile['tiers']}
    return out

def dispatch(req):
    op=req['op']
    if op=='profiles':return [{'id':p.id,'label':p.label,'map':p.map_id,'filename':p.bank_name+'.SC2Bank','description':p.description} for p in PROFILES]
    if op=='open':
        pid=req['profile'];p=get_profile(pid);player=req.get('player','');author=req.get('author','');name=req.get('name',p.bank_name+'.SC2Bank')
        if Path(name).name!=name or '/' in name or '\\' in name:raise ValueError('Invalid bank filename.')
        if req.get('demo'):
            module=import_module(p.package+'.demo');raw=module.demo_bytes();player='1-S2-1-1234567';author='1-S2-1-7654321'
            if pid=='unity':
                from zwu_editor.core import Bank,Identity,signature_for
                import xml.etree.ElementTree as ET
                root=ET.fromstring(raw);sig=root.find('Signature')
                if sig is None:sig=ET.SubElement(root,'Signature')
                sig.set('value',signature_for(root,Identity(author,player),Path(name).stem));raw=ET.tostring(root)
        else:raw=base64.b64decode(req['raw'],validate=True)
        if len(raw)>4*1024*1024:raise ValueError('Maximum bank size is 4 MB.')
        matches=suggest(raw)
        if len(matches)!=1 or matches[0].id!=pid:raise ValueError('This bank does not uniquely match the selected map.')
        bank=construct(pid,raw,name,player,author)
        s={'id':uuid.uuid4().hex,'profile':pid,'bank':bank,'work':bank.state.clone(),'name':name,'player':player,'author':author,'demo':bool(req.get('demo')),'levels':{},'evos':{},'undo':[]}
        sessions[s['id']]=s;return result(s)
    s=sessions[req['session']]
    if op=='funded_skills':
        if s['profile']!='fallen':raise ValueError('This preset is only available for Fallen World.')
        from fwls_editor.skill_preset import funded,render_companion
        import io,zipfile
        companion=base64.b64decode(req['companion'],validate=True)
        if len(companion)>4*1024*1024:raise ValueError('Companion exceeds 4 MB.')
        # Build a separate export plan. Never silently change a session's main bank.
        plan=dict(s);plan['work']=s['work'].clone();plan['levels']=dict(s['levels']);plan['evos']=dict(s['evos'])
        apply_edits(plan,req.get('edits',{}))
        target,loadout,notes=funded(plan['work'],s['bank'].profile,req.get('priority','Income & experience'))
        main,_,_=render(plan,target)
        other=render_companion(companion,int(req['slot']),loadout,auto=True)
        package=io.BytesIO()
        with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED) as archive:
            prefix='demo-' if s['demo'] else ''
            archive.writestr(prefix+'FWLSBank.SC2Bank',main)
            archive.writestr(prefix+'FWLSBank2.SC2Bank',other)
            archive.writestr('READ-ME.txt','Fallen World funded skills export\n\n'+notes+'\n\nBack up both original files outside your SC2 bank folders. Exit every match before installing BOTH files together in the same player and map-author folder. This website did not replace either original. Synthetic examples must not be installed. Account ownership is unchanged. Offline validation does not guarantee acceptance by an updated map.\n')
        return {'archive':base64.b64encode(package.getvalue()).decode(),'notes':notes}
    if op=='undo':
        if s['undo']:s['work'],s['levels'],s['evos']=s['undo'].pop()
        return result(s)
    if op=='reset':s['work']=s['bank'].state.clone();s['levels']={};s['evos']={};s['undo']=[];return result(s)
    before=(s['work'].clone(),dict(s['levels']),dict(s['evos']))
    try:
        apply_edits(s,req.get('edits',{}));notes=[]
        if op=='preset':
            action=req['action']
            if s['profile']=='fallen' and action=='unlock':
                from fwls_editor.presets import maximize
                s['work'],notes=maximize(s['work'],s['bank'].profile)
            elif s['profile']=='reign' and action in ('unlock','loadouts','statistics'):
                module=import_module('zrc_editor.'+{'unlock':'presets','loadouts':'loadouts','statistics':'statistics'}[action]);plan=module.build_plan(s['bank'],s['work'],levels=s['levels'],hero_evolutions=s['evos'])
                s['work']=plan.state;s['levels']=plan.levels;s['evos']=getattr(plan,'evolutions',getattr(plan,'hero_evolutions',{}));notes=plan.notes
            elif s['profile']=='liberty' and action.startswith('soul:'):
                soul=s['work'].souls[int(action.split(':')[1])]
                if not soul.type:raise ValueError('Choose a jewel tier before maximizing this slot.')
                cap=next(x['stats2_to5_cap'] for x in s['bank'].souls_profile['tiers'] if x['code']==soul.type)
                soul.stats[:5]=[cap*4096*x for x in [10,1,1,1,1]]
            else:raise ValueError('No audited preset for this action.')
        raw,effective,render_notes=render(s,s['work']);s['work']=effective
        if before[0]!=s['work']:s['undo'].append(before)
        out=result(s);out['notes']=notes+render_notes;out['output']=base64.b64encode(raw).decode();out['original']=base64.b64encode(s['bank'].raw).decode();return out
    except Exception:
        s['work'],s['levels'],s['evos']=before
        raise

def handle(text):
    try:return json.dumps({'ok':True,'data':dispatch(json.loads(text))})
    except Exception as exc:return json.dumps({'ok':False,'error':str(exc)})
