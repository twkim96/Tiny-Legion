// Fast compile against installed Unity APIs, preserving the project's asmdef boundaries.
// Editor package import, Play Mode and IL2CPP/Web execution remain separate gates.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const editor = process.env.TINY_LEGION_UNITY_EDITOR ?? '/Applications/Unity/Hub/Editor/6000.3.26f1/Unity.app';
const dotnet = process.env.TINY_LEGION_DOTNET ?? '/Users/twkim/.local/share/tiny-legion-dotnet/dotnet';
const web = process.argv.includes('--web');
const managed = resolve(editor, 'Contents/Resources/Scripting/Managed');
const cache = resolve(editor, 'Contents/Resources/PackageManager/ProjectTemplates/libcache/com.unity.template.2d-cross-platform-2d-6.1.6/ScriptAssemblies');
const output = resolve(root, '.sites-local/unity-source-check');
await mkdir(output, { recursive: true });
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const engine = [resolve(managed, 'UnityEngine.dll')];
for (const name of await readdir(resolve(managed, 'UnityEngine'))) if (name.startsWith('UnityEngine.') && name.endsWith('.dll')) engine.push(resolve(managed, 'UnityEngine', name));
const external = Object.fromEntries(['UnityEngine.UI', 'Unity.RenderPipelines.Core.Runtime', 'Unity.RenderPipelines.Core.Runtime.Shared',
  'Unity.RenderPipelines.Universal.Runtime', 'Unity.RenderPipelines.Universal.2D.Runtime', 'Unity.RenderPipelines.Universal.Editor']
  .map(name => [name, resolve(cache, name + '.dll')]));
const assemblies = [];
for (const folder of ['Domain', 'Presentation', 'Runtime', 'Editor']) {
  const directory = resolve(root, 'unity/Assets/TinyLegion', folder);
  const definition = JSON.parse(await readFile(resolve(directory, `TinyLegion.${folder}.asmdef`), 'utf8'));
  if (web && definition.includePlatforms?.includes('Editor')) continue;
  assemblies.push({ directory, definition });
}
const names = new Set(assemblies.map(({ definition }) => definition.name));
for (const { directory, definition } of assemblies) {
  const references = definition.noEngineReferences ? [] : [...engine];
  if (!web && !definition.noEngineReferences) for (const file of await readdir(resolve(managed, 'UnityEngine'))) if (file.startsWith('UnityEditor.') && file.endsWith('.dll')) references.push(resolve(managed, 'UnityEngine', file));
  for (const file of definition.precompiledReferences ?? []) references.push(resolve(managed, file));
  const projects = [];
  for (const name of definition.references ?? []) {
    if (names.has(name)) projects.push(resolve(output, name, 'Check.csproj'));
    else if (external[name]) references.push(external[name]);
    else throw new Error(`Unresolved asmdef reference ${definition.name} -> ${name}`);
  }
  const project = `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9.0</LangVersion><AssemblyName>${escape(definition.name)}</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><DefineConstants>${web ? 'UNITY_WEBGL' : 'UNITY_EDITOR;UNITY_STANDALONE_OSX'}</DefineConstants></PropertyGroup><ItemGroup><Compile Include="${escape(directory)}/**/*.cs"/>${references.map(file => `<Reference Include="${escape(basename(file, '.dll'))}"><HintPath>${escape(file)}</HintPath></Reference>`).join('')}${projects.map(file => `<ProjectReference Include="${escape(file)}"/>`).join('')}</ItemGroup></Project>`;
  await mkdir(resolve(output, definition.name), { recursive: true });
  await writeFile(resolve(output, definition.name, 'Check.csproj'), project);
}
const entry = resolve(output, web ? 'TinyLegion.Runtime' : 'TinyLegion.Editor', 'Check.csproj');
const result = spawnSync(dotnet, ['build', entry, '--nologo'], { stdio: 'inherit', env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1' } });
if (result.error) throw result.error;
process.exitCode = result.status;
