import express from 'express'; import {promises as fs} from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {randomUUID} from 'node:crypto'; import type {ProjectFile,ClassMeta,TypeRef,SymbolManifest} from '../../runtime-contract/src/index.js'; import {classesFromManifest,compileBrowserProject,compileBrowserSnippet} from './browser-compiler.js';
const root=process.cwd(); const app=express(); app.use(express.json({limit:'32mb'})); type S={dir:string;generation?:string;files:ProjectFile[];resourcePaths:string[];lastActivity:number}; const sessions=new Map<string,S>(); const SESSION_IDLE_MS=30*60*1000;
app.use((_req,res,next)=>{res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');next();});
let shuttingDown=false;
async function shutdown(){if(shuttingDown)return;shuttingDown=true;await Promise.all(Array.from(sessions.values(),async session=>{await fs.rm(session.dir,{recursive:true,force:true}).catch(()=>undefined)}));process.exit(0)}
process.once('SIGINT',()=>{void shutdown()}); process.once('SIGTERM',()=>{void shutdown()});
async function closeSession(id:string,s:S){if(sessions.get(id)!==s)return;sessions.delete(id);await fs.rm(s.dir,{recursive:true,force:true}).catch(()=>undefined)}
const sessionReaper=setInterval(()=>{const now=Date.now();for(const [id,s] of sessions)if(now-s.lastActivity>SESSION_IDLE_MS)void closeSession(id,s)},60_000);sessionReaper.unref();
const asyncRoute=(handler:any)=>(req:any,res:any,next:any)=>{Promise.resolve(handler(req,res,next)).catch(next)};
const tr=(s:string):TypeRef=>{let display=s.trim().replace(/\s+/g,' ');const nullable=display.endsWith('?');if(nullable)display=display.slice(0,-1).trim();let projection:TypeRef['projection'];if(display==='*')return{classifier:'*',arguments:[],nullable:false,displayName:s.trim(),projection:'star'};const projected=display.match(/^(in|out)\s+(.+)$/);if(projected){projection=projected[1] as 'in'|'out';display=projected[2].trim()}const open=display.indexOf('<');let classifier=display;let argumentsList:TypeRef[]=[];if(open>=0&&display.endsWith('>')){classifier=display.slice(0,open).trim();argumentsList=splitKotlinParameters(display.slice(open+1,-1)).map(tr)}else classifier=display.replace(/\s*\(.*$/,'').trim();return{classifier,arguments:argumentsList,nullable,displayName:s.trim(),...(projection?{projection}:{})}};
function meta(files:ProjectFile[]):ClassMeta[]{const result:any[]=[];for(const f of files){if(f.kind!=='class')continue;const m=f.source.match(/\b(class|interface|abstract\s+class)\s+(\w+)(?:\s*<([^>]+)>)?\s*(?::\s*([^\{]+))?/);if(!m)continue;const n=m[2];const ps=(s:string)=>s.split(',').map(x=>x.trim()).filter(Boolean).map((x,i)=>{const q=x.match(/(?:val|var)?\s*(\w+)\s*:\s*([^=]+)/);return{name:q?.[1]||`arg${i}`,type:tr(q?.[2]||'Any'),hasDefault:x.includes('=')}});const c=f.source.match(new RegExp('\\b'+n+'\\s*\\(([^)]*)\\)'));const methods:any[]=[];for(const x of f.source.matchAll(/\b(public\s+|private\s+|protected\s+)?(?:override\s+)?fun\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\{=]+))?/g)){if((x[1]||'').trim()==='private')continue;methods.push({id:`${n}::${x[2]}`,name:x[2],declaringType:n,parameters:ps(x[3]),returnType:tr(x[4]||'Unit'),visibility:'public'})}result.push({id:n,name:n,kind:m[1].includes('interface')?'interface':'class',constructors:m[1].includes('interface')?[]:[{id:`${n}::ctor`,parameters:ps(c?.[1]||'')}],methods,properties:[],supertypes:(m[4]||'').split(',').filter(Boolean).map(tr),typeParameters:(m[3]||'').split(',').map(x=>x.trim()).filter(Boolean)})}return result}
const exampleDirectory = (name: string) => name === 'basic' ? path.join(root, 'examples') : path.join(root, 'examples', name);
function packageNameForBrowser(files: ProjectFile[]): string { const main=files.find(file=>file.fileName==='Main.kt')||files.find(file=>/\bfun\s+main\s*\(/.test(file.source)); return main?.source.match(/^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/m)?.[1]||files.map(file=>file.source.match(/^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/m)?.[1]).find(Boolean)||''; }
const readExample = async (name: string): Promise<ProjectFile[]> => {
    if (name === 'ausgebuext') {
        const framework: ProjectFile[] = await readExample('blueplay');
        const frameworkFiles = framework.filter(file => ['Actor.kt', 'BluePlayFunctions.kt', 'Image.kt', 'World.kt'].includes(file.fileName));
        return [...frameworkFiles,
            { id: 'Ausreisser.kt', fileName: 'Ausreisser.kt', kind: 'class', revision: 1, source: `class Ausreisser : Actor() {
    init {
        image = Image("figure.png")
    }

    override fun act() {
        if (isClicked) {
            world.removeObject(this)
        } else {
            move(1)
        }
    }
}
` },
            { id: 'Spielfeld.kt', fileName: 'Spielfeld.kt', kind: 'class', revision: 1, source: `class Spielfeld : World(600, 400, 1) {
    private var schritte = 0

    init {
        addObject(Ausreisser(), 100, 100)
        addObject(Ausreisser(), 250, 200)
        addObject(Ausreisser(), 400, 300)
    }

    override fun act() {
        schritte++
        if (numberOfObjects == 0) {
            showText("Schritte: $schritte", 100, 50)
            stop()
        }
    }
}
` },
            { id: 'Main.kt', fileName: 'Main.kt', kind: 'functions', revision: 1, source: `fun main() {
    val welt = Spielfeld()
    welt.show()
}
` }
        ];
    }
    const directory = exampleDirectory(['blueplay-stress', 'blueplay-input'].includes(name) ? 'blueplay' : name);
    const names = (await fs.readdir(directory)).filter(fileName => fileName.endsWith('.kt')).sort();
    return Promise.all(names.map(async fileName => ({
        id: fileName,
        fileName,
        kind: fileName === 'Helpers.kt' || fileName === 'Main.kt' || fileName === 'Console.kt' || fileName === 'BluePlayFunctions.kt' ? 'functions' : 'class',
        source: name === 'blueplay-stress' && fileName === 'Figure.kt' ? `class Figure : Actor() {
    override fun act() {
        move(1)
        if (x >= 590) turn(180)
        if (x <= 10) turn(180)
    }
}
` : name === 'blueplay-stress' && fileName === 'Main.kt' ? `fun main() {
    val world = MyWorld()
    repeat(50) { index ->
        val figure = Figure()
        world.addObject(figure, (index % 10) * 50 + 20, (index / 10) * 50 + 20)
    }
    world.show()
}
` : name === 'blueplay-input' && fileName === 'Figure.kt' ? `class Figure : Actor() {
    init { image = Image("figure.png") }
    override fun act() {
        if (isClicked) { turn(15); move(10) }
        if (isKeyDown("right")) move(1)
        if (isKeyDown("left")) move(-1)
    }
}
` : await fs.readFile(path.join(directory, fileName), 'utf8'),
        revision: 1
    })));
};
const readExampleResources = async (name: string) => {
    const directory = exampleDirectory(['blueplay-stress', 'blueplay-input', 'ausgebuext'].includes(name) ? 'blueplay' : name);
    const resources: { path: string; data: string }[] = [];
    for (const folder of ['images', 'sounds']) {
        const resourceDirectory = path.join(directory, folder);
        const names = await fs.readdir(resourceDirectory).catch(() => [] as string[]);
        for (const fileName of names.sort()) {
            const filePath = path.join(resourceDirectory, fileName);
            const data = await fs.readFile(filePath);
            const mime = folder === 'images' ? 'image/png' : 'audio/wav';
            resources.push({ path: `${folder}/${fileName}`, data: `data:${mime};base64,${data.toString('base64')}` });
        }
    }
    return resources;
};
app.get('/api/examples', asyncRoute(async (_: any, r: any) => r.json({ files: [], resources: [] })));
app.get('/api/examples/:name', asyncRoute(async (req: any, r: any) => {
    if (!['ausgebuext', 'basic', 'blueplay', 'blueplay-stress', 'blueplay-input', 'krokoalarm', 'snap', 'student-smoke'].includes(req.params.name)) return r.sendStatus(404);
    r.json({ files: await readExample(req.params.name), resources: await readExampleResources(req.params.name) });
}));
app.use('/api/session/:id',(req,_r,next)=>{const s=sessions.get(req.params.id);if(s)s.lastActivity=Date.now();next()});
app.post('/api/session',asyncRoute(async(_:any,r:any)=>{const d=await fs.mkdtemp(path.join(os.tmpdir(),'bluek-'));const id=randomUUID();const session={dir:d,files:[],resourcePaths:[],lastActivity:Date.now()};sessions.set(id,session);r.json({sessionId:id})}));
app.use('/api/session/:id/browser',(req:any,r:any,next:any)=>{const s=sessions.get(req.params.id);if(!s)return r.sendStatus(404);express.static(path.join(s.dir,'browser','dist'))(req,r,next)});
app.post('/api/session/:id/compile',asyncRoute(async(req:any,r:any)=>{
    const s=sessions.get(req.params.id); if(!s)return r.sendStatus(404);
    const files=req.body.files as ProjectFile[];
    if(!Array.isArray(files)||files.some(f=>!f||typeof f.fileName!=='string'||!/^[A-Za-z0-9_.-]+\.kt$/.test(f.fileName)||typeof f.source!=='string'))return r.status(400).json({message:'Invalid Kotlin project files'});
    if(new Set(files.map(f=>f.fileName)).size!==files.length)return r.status(400).json({message:'Duplicate Kotlin file name'});
    s.generation=undefined; s.files=[]; await fs.mkdir(path.join(s.dir,'project'),{recursive:true});
    for(const oldPath of s.resourcePaths)await fs.rm(path.join(s.dir,'project',oldPath),{force:true}).catch(()=>undefined);
    const nextResources=new Set<string>();
    for(const f of files)await fs.writeFile(path.join(s.dir,'project',f.fileName),f.source);
    for(const resource of (req.body.resources||[]) as {path:string;data:string}[]){
        const resourcePath=path.posix.normalize(String(resource.path||''));
        if(!resourcePath||resourcePath.startsWith('/')||resourcePath.split('/').includes('..'))return r.status(400).json({message:'Invalid resource path'});
        if(nextResources.has(resourcePath))return r.status(400).json({message:'Duplicate resource path'});
        const match=String(resource.data||'').match(/^data:[^;]+;base64,(.*)$/s); if(!match)return r.status(400).json({message:`Invalid resource data for ${resourcePath}`});
        const target=path.join(s.dir,'project',resourcePath); await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(target,Buffer.from(match[1],'base64')); nextResources.add(resourcePath);
    }
    s.resourcePaths=[...nextResources];
    const ruleDiagnostics=projectRuleDiagnostics(files); const gid=randomUUID();
    let browserRuntime: {entry:string;packageName:string}|undefined; let browserDiagnostics=''; let manifest:SymbolManifest|undefined;
    if(!ruleDiagnostics.length){const browser=await compileBrowserProject(root,s.dir,files); if(browser.ok){browserRuntime={entry:'bluek-browser-runtime.js',packageName:packageNameForBrowser(files)};manifest=browser.manifest;s.files=files;s.generation=gid;} else browserDiagnostics=browser.diagnostics;}
    const diagnostics=ruleDiagnostics.length?ruleDiagnostics:browserDiagnostics?[{fileName:'browser-runtime',line:1,column:1,message:`Browser Kotlin/JS compilation failed:\n${browserDiagnostics}`,severity:'error'}]:[];
    const manifestClasses=manifest?classesFromManifest(manifest):[];
    const compilerClasses=manifest ? manifestClasses : addCompanionMethods(enrichMethods(addPropertyMethods(finalizeMeta(metaImproved(files),files),files)),files);
    r.json({generationId:gid,sourceRevision:req.body.revision||1,classes:compilerClasses,manifest,diagnostics,browserRuntime,browserRuntimeError:browserDiagnostics||undefined});
}));
app.get('/api/session/:id/status',asyncRoute(async(req:any,r:any)=>{const s=sessions.get(req.params.id);if(!s)return r.sendStatus(404);r.json({workerAlive:false,generationId:s.generation||null,available:false,error:'BlueK runs project code only in the browser worker.'})}));
app.post('/api/session/:id/close',asyncRoute(async(req:any,r:any)=>{const s=sessions.get(req.params.id);if(!s)return r.sendStatus(404);await closeSession(req.params.id,s);r.sendStatus(204)}));
app.post('/api/session/:id/codepad',asyncRoute(async(req:any,r:any)=>{const s=sessions.get(req.params.id);if(!s?.generation)return r.status(409).json({message:'Compile the project first'});if(req.body.generationId&&req.body.generationId!==s.generation)return r.status(409).json({message:'This action belongs to an older runtime generation'});const source=typeof req.body.source==='string'?req.body.source:'';const bindings=Array.isArray(req.body.bindings)?req.body.bindings.filter((value:any)=>typeof value==='string'&&/^[A-Za-z_]\w*$/.test(value)||value&&typeof value.name==='string'&&/^[A-Za-z_]\w*$/.test(value.name)&&typeof value.type==='string'&&/^[A-Za-z_][\w.?<>, ]*$/.test(value.type)).map((value:any)=>typeof value==='string'?value:{name:value.name,type:value.type,mutable:value.mutable===true}):[];if(!source.trim()||source.length>100000)return r.status(400).json({message:'Invalid Codepad source'});const result=await compileBrowserSnippet(root,s.dir,source,randomUUID(),bindings);if(!result.ok)return r.status(422).json({message:result.diagnostics||'Codepad compilation failed'});r.json({entry:result.entry})}));
app.use((error:any,_req:any,res:any,_next:any)=>{console.error(error);if(!res.headersSent)res.status(500).json({message:'BlueK server error'})});
app.use(express.static(path.join(root,'frontend/dist')));
const port=Number(process.env.BLUEK_PORT||process.env.PORT||5173);
const ipv4Server=app.listen(port,'127.0.0.1',()=>console.log(`BlueK: http://localhost:${port}`));
ipv4Server.on('error',(error:any)=>{console.error(`BlueK could not listen on IPv4 port ${port}: ${error.message}`);process.exitCode=1;});
const ipv6Server=app.listen({port,host:'::1',ipv6Only:true});
ipv6Server.on('error',(error:any)=>{
    // IPv4 is the authoritative local listener. IPv6 may already be held by
    // another local process or be unavailable on the host; neither case
    // should crash an otherwise healthy BlueK server.
    if(error?.code!=='EADDRINUSE'&&error?.code!=='EAFNOSUPPORT')console.error(`BlueK IPv6 listener unavailable: ${error.message}`);
});
function splitKotlinParameters(source:string):string[]{const result:string[]=[];let start=0,angle=0,round=0,square=0,curly=0,quote='',escaped=false;for(let i=0;i<source.length;i++){const char=source[i];if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue}if(char==='"'||char==="'"){quote=char;continue}if(char==='<')angle++;else if(char==='>')angle=Math.max(0,angle-1);else if(char==='(')round++;else if(char===')')round=Math.max(0,round-1);else if(char==='[')square++;else if(char===']')square=Math.max(0,square-1);else if(char==='{')curly++;else if(char==='}')curly=Math.max(0,curly-1);else if(char===','&&!angle&&!round&&!square&&!curly){result.push(source.slice(start,i).trim());start=i+1}}const last=source.slice(start).trim();if(last)result.push(last);return result}
function kotlinFunctions(source:string):string[][]{const result:string[][]=[];const pattern=/\bfun\s*(?:<([^>{}]*)>\s*)?([A-Za-z_]\w*)\s*\(/g;let match:RegExpExecArray|null;while((match=pattern.exec(source))){const openings:number[]=[];for(let position=0;position<match.index;position++){if(source[position]==='{')openings.push(position);else if(source[position]==='}')openings.pop()}const nearest=openings[openings.length-1];const inCompanion=nearest!==undefined&&/\bcompanion\s+object\s*$/.test(source.slice(Math.max(0,nearest-40),nearest));if(openings.length>1&&!inCompanion)continue;const open=source.indexOf('(',match.index);let depth=0;let close=-1;for(let index=open;index<source.length;index++){if(source[index]==='(')depth++;else if(source[index]===')'&&!--depth){close=index;break}}if(close<0)continue;const lineStart=Math.max(source.lastIndexOf('\n',match.index)+1,0);const visibility=source.slice(lineStart,match.index).match(/\b(private|protected|internal)\b/)?.[1]||'';const tail=source.slice(close+1);const returnType=tail.match(/^\s*:\s*([^={\n;]+)/)?.[1]?.trim()||'';result.push([match[0],visibility,match[2],source.slice(open+1,close),returnType,String(match.index),match[1]||''])}return result}
function balancedParameters(source:string,open:number):string|undefined{if(source[open]!=='(')return undefined;let depth=0;let quote='';let escaped=false;for(let i=open;i<source.length;i++){const char=source[i];if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue}if(char==='"'||char==="'"){quote=char;continue}if(char==='(')depth++;else if(char===')'&&!--depth)return source.slice(open+1,i)}return undefined}
function hasTopLevelColon(source:string):boolean{let angle=0;for(const char of source){if(char==='<')angle++;else if(char==='>')angle=Math.max(0,angle-1);else if(char===':'&&!angle)return true}return false}
function primaryConstructorParameters(source:string,name:string):string|undefined{const declaration=source.search(new RegExp(`\\b(class|interface|object)\\s+${name}\\b`));if(declaration<0)return undefined;const open=source.indexOf('(',declaration+name.length);const brace=source.indexOf('{',declaration);const between=open<0?'':source.slice(declaration+name.length,open);return open>=0&&!hasTopLevelColon(between)&&(brace<0||open<brace)?balancedParameters(source,open):undefined}
function metaImproved(files:ProjectFile[]):ClassMeta[]{const result:any[]=[];for(const file of files){if(file.kind!=='class'&&file.kind!=='functions')continue;const synthetic=file.kind==='functions';const source=synthetic?`class ${file.fileName.replace(/\.kt$/,'')} {\n${file.source}\n}`:file.source;const structure=maskKotlinNonCode(source);const header=structure.match(/\b(class|interface|object)\s+(\w+)(?:\s*<([^>{]+)>)?\s*(?:\(([^)]*)\))?\s*(?::\s*([^\{]+))?/);if(!header)continue;const name=header[2];const params=(source:string)=>splitKotlinParameters(source).map((part,index)=>{const match=part.match(/(?:val|var|vararg|noinline|crossinline)?\s*(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.*))?$/);return{name:match?.[1]||`arg${index}`,type:tr(match?.[2]||'Any'),hasDefault:Boolean(match?.[3])}});const constructors:any[]=synthetic||header[1]==='interface'||header[1]==='object'?[]:[];if(!synthetic&&header[1]!=='interface'&&header[1]!=='object'){const primary=primaryConstructorParameters(structure,name);const primaryHidden=new RegExp(`\\b${name}\\s+(?:private|protected|internal)\\s+constructor\\b`).test(structure);const secondaryConstructors=Array.from(structure.matchAll(/\bconstructor\s*/g));if(primary!==undefined&&!primaryHidden)constructors.push({id:`${name}::primary`,parameters:params(primary)});for(const match of secondaryConstructors){const open=structure.indexOf('(',match.index!+match[0].length);const lineStart=Math.max(source.lastIndexOf('\n',match.index!)+1,0);const visibility=structure.slice(lineStart,match.index!).match(/\b(private|protected|internal)\b/)?.[1]||'';const parameters=open>=0?balancedParameters(source,open):undefined;if(parameters!==undefined&&!visibility)constructors.push({id:`${name}::secondary::${constructors.length}`,parameters:params(parameters)});}if(!constructors.length&&primary===undefined&&secondaryConstructors.length===0)constructors.push({id:`${name}::default`,parameters:[]})}const methods:any[]=[];for(const match of kotlinFunctions(structure)){if(hiddenKotlinMember(structure,Number(match[5]||0))||['private','protected','internal'].includes((match[1]||'').trim()))continue;methods.push({id:`${name}::${match[2]}::${methods.length}`,name:match[2],declaringType:name,parameters:params(match[3]),returnType:tr(match[4]||'Unit'),visibility:'public',typeParameters:(match[6]||'').split(',').map(part=>part.trim()).filter(Boolean)})}result.push({id:name,name,kind:synthetic?'functions':header[1]==='interface'?'interface':header[1]==='object'?'object':'class',constructors,methods,properties:[],supertypes:synthetic||header[1]==='object'?[]:(header[5]||'').split(',').map(part=>part.trim()).filter(Boolean).map(tr),typeParameters:synthetic||header[1]==='object'?[]:(header[3]||'').split(',').map(part=>part.trim()).filter(Boolean)})}return result}
function finalizeMeta(classes:ClassMeta[],files:ProjectFile[]):ClassMeta[]{const abstractNames=new Set(files.filter(file=>/\babstract\s+class\s+\w+/.test(maskKotlinNonCode(file.source))).map(file=>maskKotlinNonCode(file.source).match(/\babstract\s+class\s+(\w+)/)?.[1]).filter(Boolean));return classes.map(value=>{const source=files.find(file=>file.fileName.replace(/\.kt$/,'')===value.name)?.source||'';const structure=maskKotlinNonCode(source);const kind=abstractNames.has(value.name)?'abstract':new RegExp(`\\benum\\s+class\\s+${value.name}\\b`).test(structure)?'enum':new RegExp(`\\bannotation\\s+class\\s+${value.name}\\b`).test(structure)?'annotation':value.kind;return kind==='abstract'||kind==='enum'||kind==='annotation'?{...value,kind,constructors:[]}:{...value,kind}})}
function inferredPropertyType(initializer:string|undefined):string{const value=(initializer||'').trim();if(/^[-+]?\d+$/.test(value))return 'Int';if(/^[-+]?(?:\d+\.\d*|\d*\.\d+)(?:[eE][-+]?\d+)?[fF]?$/.test(value))return value.endsWith('f')||value.endsWith('F')?'Float':'Double';if(/^(true|false)$/.test(value))return 'Boolean';if(/^"(?:[^"\\]|\\.)*"$/.test(value))return 'String';if(/^'(?:[^'\\]|\\.)'$/.test(value))return 'Char';return 'Any'}
function enrichProperties(classes:ClassMeta[],files:ProjectFile[]):ClassMeta[]{return classes.map(value=>{if(value.kind!=='class')return value;const file=files.find(item=>item.fileName.replace(/\.kt$/,'')===value.name);if(!file)return value;const source=maskKotlinNonCode(file.source);const originalSource=file.source;const declaration=source.search(new RegExp(`\\b(class|abstract\\s+class)\\s+${value.name}\\b`));const bodyStart=declaration<0?-1:source.indexOf('{',declaration);const headerEnd=declaration<0?-1:source.indexOf(')',declaration);const depthAt=(index:number)=>{let depth=0;for(let position=0;position<index;position++){if(source[position]==='{')depth++;else if(source[position]==='}')depth=Math.max(0,depth-1)}return depth};const properties:any[]=[];const seen=new Set<string>();for(const match of source.matchAll(/\b(public|private|protected|internal)?\s*(val|var)\s+(\w+)(?:\s*:\s*([^=\n;,\)]+))?(?:\s*=\s*([^\n;]+))?/g)){const index=match.index||0;const inPrimaryHeader=index>declaration&&((bodyStart>=0&&index<bodyStart)||(bodyStart<0&&index<headerEnd));const isMember=bodyStart>=0&&index>bodyStart&&depthAt(index)===1;if(!inPrimaryHeader&&!isMember)continue;const visibility=(match[1]||'public').trim();if(hiddenKotlinMember(source,index)||visibility!=='public'||seen.has(match[3]))continue;seen.add(match[3]);const originalLine=originalSource.slice(index,originalSource.indexOf('\n',index)<0?originalSource.length:originalSource.indexOf('\n',index));const originalInitializer=originalLine.match(/\s=\s*(.*?)(?:\s+(?:get|set)\b|$)/)?.[1];const propertyType=(match[4]||inferredPropertyType(originalInitializer||match[5])).trim().replace(/\s+(?:get|set)\s*\(.*$/,'').trim();properties.push({id:`${value.name}::property::${match[3]}`,name:match[3],type:tr(propertyType),mutable:match[2]==='var',visibility})}return {...value,properties}})}
function addPropertyMethods(classes:ClassMeta[],files:ProjectFile[]):ClassMeta[]{return enrichProperties(classes,files).map(value=>{if(value.kind!=='class')return value;const existing=new Set(value.methods.map(method=>method.name));const accessors=value.properties.flatMap(property=>{const booleanIsProperty=property.type.classifier==='Boolean'&&property.name.startsWith('is');const stem=property.name.charAt(0).toUpperCase()+property.name.slice(1);const getterName=booleanIsProperty?property.name:`get${stem}`;const methods:any[]=[];if(!existing.has(getterName))methods.push({id:`${value.name}::property-getter::${property.name}`,name:getterName,declaringType:value.name,parameters:[],returnType:property.type,visibility:'public',autoGenerated:true,propertyName:property.name});if(property.mutable){const setterName=`set${booleanIsProperty?property.name.slice(2):stem}`;if(!existing.has(setterName))methods.push({id:`${value.name}::property-setter::${property.name}`,name:setterName,declaringType:value.name,parameters:[{name:'value',type:property.type,hasDefault:false}],returnType:{classifier:'Unit',displayName:'Unit'},visibility:'public',autoGenerated:true,propertyName:property.name})}return methods});return {...value,methods:[...value.methods,...accessors]}})}
function addCompanionMethods(classes:ClassMeta[],files:ProjectFile[]):ClassMeta[]{return addPropertyMethods(classes,files).map(value=>{if(value.kind!=='class')return value;const file=files.find(item=>item.fileName.replace(/\.kt$/,'')===value.name);const body=maskKotlinNonCode(file?.source||'').match(/\bcompanion\s+object\s*\{([\s\S]*?)\}/)?.[1]||'';const names=new Set(Array.from(body.matchAll(/\bfun\s+(\w+)\s*\(/g),match=>match[1]));const companionMethods=value.methods.filter(method=>names.has(method.name)).map(method=>({...method,companion:true}));return {...value,methods:value.methods.filter(method=>!names.has(method.name)),companionMethods}})}

function maskKotlinNonCode(source:string):string{let result='';let lineComment=false;let blockDepth=0;let quote='';let escaped=false;for(let i=0;i<source.length;i++){const char=source[i],next=source[i+1];if(lineComment){result+=char==='\n'?'\n':' ';if(char==='\n')lineComment=false;continue}if(blockDepth){if(char==='/'&&next==='*'){result+='  ';i++;blockDepth++;continue}if(char==='*'&&next==='/'){result+='  ';i++;blockDepth--;continue}result+=char==='\n'?'\n':' ';continue}if(quote){if(quote==='"""'){if(source.slice(i,i+3)==='"""'){result+='   ';i+=2;quote=''}else result+=char==='\n'?'\n':' ';continue}result+=char==='\n'?'\n':' ';if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue}if(char==='/'&&next==='/'){result+='  ';i++;lineComment=true;continue}if(char==='/'&&next==='*'){result+='  ';i++;blockDepth=1;continue}if(char==='"'&&source.slice(i,i+3)==='"""'){result+='   ';i+=2;quote='"""';continue}if(char==='"'||char==="'"){result+=' ';quote=char;continue}result+=char}return result}
function hiddenKotlinMember(source:string,index:number):boolean{const preceding=source.slice(Math.max(0,index-160),index).split('\n').slice(-3).join('\n');return /@(?:get:|set:)?JvmSynthetic\b/.test(preceding)}

function projectRuleDiagnostics(files:ProjectFile[]):any[]{const diagnostics:any[]=[];for(const file of files){if(file.fileName==='BluePlayFunctions.kt')continue;const source=maskKotlinNonCode(file.source);const declarations:Array<{kind:string;index:number;name:string}>=[];for(let index=0,depth=0,round=0;index<source.length;index++){const char=source[index];if(char==='{'){depth++;continue}if(char==='}'){depth=Math.max(0,depth-1);continue}if(char==='('){round++;continue}if(char===')'){round=Math.max(0,round-1);continue}if(depth!==0||round!==0||index>0&&/[A-Za-z0-9_]/.test(source[index-1]))continue;const match=source.slice(index).match(/^(class|interface|object|fun|val|var)\b/);if(match){const declaredName=source.slice(index+match[0].length).match(/^\s*([A-Za-z_]\w*)/)?.[1]||'';declarations.push({kind:match[1],index,name:declaredName})}}const types=declarations.filter(value=>['class','interface','object'].includes(value.kind));const members=declarations.filter(value=>['fun','val','var'].includes(value.kind));const position=(index:number)=>{const before=file.source.slice(0,index);return{line:before.split('\n').length,column:index-before.lastIndexOf('\n')}};const report=(index:number,message:string)=>diagnostics.push({fileName:file.fileName,...position(index),message,severity:'error'});if(file.kind==='class'&&(types.length!==1||types[0]?.name!==file.fileName.replace(/\.kt$/,'')||members.some(value=>value.kind==='fun'||value.kind==='val'||value.kind==='var'))){if(types.length===0)report(0,'BlueK class files must contain exactly one top-level class, interface, or object declaration.');else if(types.length>1)report(types[1].index,'BlueK class files may contain exactly one top-level class, interface, or object declaration.');else if(types[0].name!==file.fileName.replace(/\.kt$/,''))report(types[0].index,'BlueK class file names must match their top-level type name.');else report(members[0]?.index??0,'BlueK class files may not contain top-level functions or properties.')}if(file.kind==='functions'&&(types.length>0||members.some(value=>value.kind!=='fun'))){if(types.length>0)report(types[0].index,'BlueK function files may contain top-level functions only, not classes or objects.');else report(members.find(value=>value.kind!=='fun')?.index??0,'BlueK function files may contain top-level functions only.')}}return diagnostics}
function enrichMethods(classes:ClassMeta[]):ClassMeta[]{const byName=new Map(classes.map(value=>[value.name,value]));const key=(method:any)=>`${method.name}(${(method.parameters||[]).map((parameter:any)=>parameter.type.displayName).join(',')})`;return classes.map(original=>{const methods=[...original.methods];const seen=new Set(methods.map(key));const visit=(type:string,trail:Set<string>)=>{if(trail.has(type))return;const parent=byName.get(type);if(!parent)return;const next=new Set(trail);next.add(type);for(const method of parent.methods){if(seen.has(key(method)))continue;seen.add(key(method));methods.push({...method,id:`${original.name}::inherited::${method.id}`,inheritedFrom:method.declaringType});}for(const supertype of parent.supertypes)visit(supertype.classifier,next)};for(const supertype of original.supertypes)visit(supertype.classifier,new Set([original.name]));if(original.kind!=='interface'){const anyMethods=[{name:'toString',parameters:[],returnType:tr('String')},{name:'hashCode',parameters:[],returnType:tr('Int')},{name:'equals',parameters:[{name:'other',type:tr('Any?'),hasDefault:false}],returnType:tr('Boolean')}];for(const method of anyMethods){if(seen.has(key(method)))continue;seen.add(key(method));methods.push({...method,declaringType:'Any',inheritedFrom:'Any',visibility:'public',id:`${original.name}::inherited::Any::${method.name}`})}}return {...original,methods:methods.map((method,index)=>({...method,id:`${original.name}::${key(method)}::${index}`}))}})}
function compilerDiagnostics(text:string){const parsed=text.split(/\r?\n/).flatMap(line=>{const match=line.match(/^(.*?):(\d+):(\d+):\s+(?:error|warning):\s+(.*)$/);return match?[{fileName:match[1].replace(/^project\//,''),line:Number(match[2]),column:Number(match[3]),message:match[4],severity:line.includes(': warning:')?'warning':'error'}]:[]});return parsed.length?parsed:[{fileName:'project',line:1,column:1,message:text.trim()||'Compilation failed',severity:'error'}]}
import type { ServerResponse } from 'node:http';
