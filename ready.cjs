const {spawn, execFileSync} = require('node:child_process');
const {mkdirSync, mkdtempSync, readdirSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {createInterface} = require('node:readline');
const keys = ['SystemRoot','WINDIR','SystemDrive','COMSPEC','ProgramData','ProgramFiles','ALLUSERSPROFILE','PSModulePath','PATHEXT','USERPROFILE','LOCALAPPDATA','APPDATA'];
const root = mkdtempSync(join(tmpdir(), 'scarlet-smoke-'));
const shell = process.argv[2];
const engine = join(process.env.RUNNER_TEMP, 'ready-resource', 'scarlet-engine.exe');
const work = join(root,'work'), data=join(root,'data');
mkdirSync(work); mkdirSync(data);
const env = {SCARLET_TELEMETRY_ENABLED:'false', HOME:process.env.HOME ?? root};
for (const k of keys) if (process.env[k]) env[k] = process.env[k];
env.PATH = `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`;
env.TEMP = root; env.TMP = root;
console.log(shell, 'MSYSTEM',process.env.MSYSTEM, 'HOME', env.HOME, 'SystemRoot',env.SystemRoot,'PSModulePath',env.PSModulePath,'available OS keys',Object.keys(env).join(','));
const t=Date.now();
const child=spawn(engine,['serve','--solo','--data',data,'--port','0'],{cwd:work,env,stdio:['pipe','pipe','pipe'],windowsHide:true});
const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
const sample=setInterval(()=>{
  console.log(shell, Date.now()-t, 'library entries',readdirSync(data).join(','));
  try {console.log(shell,'direct children',execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process -Filter 'ParentProcessId=${child.pid}' | ForEach-Object {$_.Name}`],{timeout:4000,encoding:'utf8',windowsHide:true}).trim());} catch(e){console.log('process sample unavail',e.code);}
},10000);
let ready=false;
const limit=setTimeout(()=>{console.log(shell,'startup exceeded 75s');child.kill();},75000);
function msg(where,line){console.log(shell,Date.now()-t,where,line.replace(/sct_[a-z0-9]+/gi,'[redacted]').slice(0,400));}
createInterface({input:child.stderr}).on('line',line=>msg('stderr',line));
createInterface({input:child.stdout}).on('line',line=>{
  if (line.startsWith('SCARLET_READY ')){ready=true;console.log(shell,'READY after',Date.now()-t,'ms');child.stdin.end();}
  else msg('stdout',line);
});
child.on('error',e=>console.log(shell,'spawn error',e.message));
child.on('close',(c,s)=>{clearTimeout(limit);clearInterval(sample);console.log(shell,'closed',c,s,'ready',ready);});
