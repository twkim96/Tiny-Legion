import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const cli=process.env.TINY_LEGION_UNITY_CLI??'/Users/twkim/.local/share/tiny-legion-unity-cli/bin/unity';
for(const script of ["export-catalog.mjs","export-art.mjs","export-scenery.mjs","export-platform.mjs","generate-meta.mjs"]){const prepare=spawnSync(process.execPath,[resolve("scripts/unity",script)],{stdio:"inherit"});if(prepare.error)throw prepare.error;if(prepare.status!==0)process.exit(prepare.status);}
const result=spawnSync(cli,['run',resolve('unity'),'--log-file',resolve('.sites-local/unity-web-build.log'),'--no-tail','--','-executeMethod','TinyLegion.Editor.ProjectSetup.BuildWeb'],{stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status;
