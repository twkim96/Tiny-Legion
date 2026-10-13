// Compile against actual installed Unity assemblies when Editor licensing is unavailable.
// This does not replace Editor package import, play mode or a Web build.
import {mkdir,writeFile,readdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const editor=process.env.TINY_LEGION_UNITY_EDITOR??'/Applications/Unity/Hub/Editor/6000.3.26f1/Unity.app';
const dotnet=process.env.TINY_LEGION_DOTNET??'/Users/twkim/.local/share/tiny-legion-dotnet/dotnet';
const managed=resolve(editor,'Contents/Resources/Scripting/Managed');
const cache=resolve(editor,'Contents/Resources/PackageManager/ProjectTemplates/libcache/com.unity.template.2d-cross-platform-2d-6.1.6/ScriptAssemblies');
const output=resolve(root,'.sites-local/unity-source-check');await mkdir(output,{recursive:true});
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const files=[resolve(managed,'UnityEngine.dll'),resolve(managed,'UnityEditor.dll'),resolve(managed,'Newtonsoft.Json.dll')];
for(const name of await readdir(resolve(managed,'UnityEngine')))if(name.endsWith('.dll'))files.push(resolve(managed,'UnityEngine',name));
for(const name of ['UnityEngine.UI.dll','Unity.RenderPipelines.Core.Runtime.dll','Unity.RenderPipelines.Core.Runtime.Shared.dll','Unity.RenderPipelines.Universal.Runtime.dll','Unity.RenderPipelines.Universal.2D.Runtime.dll','Unity.RenderPipelines.Universal.Editor.dll'])files.push(resolve(cache,name));
await writeFile(resolve(output,'Check.csproj'),`<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9.0</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><DefineConstants>${process.argv.includes("--web")?"UNITY_WEBGL":"UNITY_EDITOR;UNITY_STANDALONE_OSX"}</DefineConstants></PropertyGroup><ItemGroup><Compile Include="${escape(resolve(root,'unity/Assets/TinyLegion'))}/**/*.cs"/>${files.map(file=>`<Reference Include="${escape(basename(file,'.dll'))}"><HintPath>${escape(file)}</HintPath></Reference>`).join('')}</ItemGroup></Project>`);
const result=spawnSync(dotnet,['build',resolve(output,'Check.csproj'),'--nologo'],{stdio:'inherit',env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});if(result.error)throw result.error;process.exitCode=result.status;
