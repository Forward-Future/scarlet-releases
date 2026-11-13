const { spawn }=require('node:child_process');
const { writeFileSync, readFileSync }=require('node:fs');
const { join }=require('node:path');
const root=process.env.RUNNER_TEMP;
const keys=['SystemRoot','WINDIR','SystemDrive','COMSPEC','ProgramData','ProgramFiles','ALLUSERSPROFILE','PSModulePath','PATHEXT','USERPROFILE','LOCALAPPDATA','APPDATA'];
if(process.argv[2]==='snapshot'){
  const env={HOME:process.env.HOME??root,PATH:`${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`,TEMP:root,TMP:root,SCARLET_TELEMETRY_ENABLED:'false'};
  for(const k of keys) if(process.env[k])env[k]=process.env[k];
  writeFileSync(join(root,process.argv[3]+'-allowlist.json'),JSON.stringify(env));
} else {
  const bash=JSON.parse(readFileSync(join(root,'bash-allowlist.json'))),ps=JSON.parse(readFileSync(join(root,'pwsh-allowlist.json')));
  const diff=Object.keys({...bash,...ps}).filter(k=>bash[k]!==ps[k]);
  console.log('Different whitelisted keys:',diff.join(', '));
  const path=join(ps.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
  const cases=[['bash',bash],['pwsh',ps],...diff.map(k=>['bash with native '+k,{...bash,[k]:ps[k]}]),['bash first system modules',{...bash,PSModulePath:join(ps.SystemRoot,'System32','WindowsPowerShell','v1.0','Modules')+';'+bash.PSModulePath}]];
  async function measure(label,env){
    const t=Date.now();
    const child=spawn(path,['-NoProfile','-NonInteractive','-Command',"$id=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object System.Security.AccessControl.DirectorySecurity; $acl.SetOwner($id); [void] [System.IO.Directory]::GetAccessControl($env:TEMP)"],{env,cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe']});
    const limit=setTimeout(()=>child.kill(),45000);
    await new Promise(resolve=>child.on('close',(c,s)=>{clearTimeout(limit);console.log(label,Date.now()-t,'ms exit',c,s);resolve();}));
  }
  (async()=>{ for(let i=0;i<cases.length;i+=2) await Promise.all(cases.slice(i,i+2).map(args=>measure(...args))); })();
}
