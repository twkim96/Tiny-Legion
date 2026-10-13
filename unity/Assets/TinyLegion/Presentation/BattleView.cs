using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Combat;
using UnityEngine;
namespace TinyLegion.Unity
{
    // Scene objects are projections of simulation state; they never decide combat.
    public sealed class BattleView : MonoBehaviour
    {
        sealed class Actor { public SpriteRenderer Sprite,Health,Shield;public SpriteRenderer[] Status; public Transform Root; }
        sealed class Flash { public SpriteRenderer Sprite;public double Start,Duration;public float Radius;public string Kind; }
        IGameController game;UiKit ui;Camera battleCamera;BattleEngine current;
        readonly HashSet<int> visible=new HashSet<int>(),activeShots=new HashSet<int>();
        readonly List<int> removals=new List<int>();
        readonly Stack<Actor> actorPool=new Stack<Actor>();
        readonly Stack<SpriteRenderer> shotPool=new Stack<SpriteRenderer>();
        readonly Dictionary<int,Actor> actors=new Dictionary<int,Actor>();readonly Dictionary<int,SpriteRenderer> shots=new Dictionary<int,SpriteRenderer>();readonly List<Flash> flashes=new List<Flash>();
        Sprite white;Material material;Transform sceneRoot;SpriteRenderer terrain,leftCastle,rightCastle,background;
        SpriteRenderer playerHealth,enemyHealth;string scenery;
        public void Initialize(IGameController controller,UiKit kit)
        {
            game=controller;ui=kit;battleCamera=Camera.main;if(!battleCamera){battleCamera=new GameObject("Main Camera").AddComponent<Camera>();battleCamera.gameObject.AddComponent<AudioListener>();}battleCamera.orthographic=true;battleCamera.transform.position=new Vector3(0,1,-10);battleCamera.backgroundColor=new Color32(219,232,203,255);
            var texture=new Texture2D(1,1);texture.SetPixel(0,0,Color.white);texture.Apply();white=Sprite.Create(texture,new Rect(0,0,1,1),new Vector2(.5f,.5f),1);
            material=new Material(Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default")??Shader.Find("Sprites/Default"));
            sceneRoot=new GameObject("Battlefield").transform;sceneRoot.SetParent(transform);
            background=Rectangle("Background",new Vector3(0,1,0),new Vector2(16,9),Color.white,-200);
            terrain=Rectangle("Ground",new Vector3(0,-3,0),new Vector2(30,5),new Color32(143,161,105,255),-100);
            leftCastle=Rectangle("Player castle",new Vector3(-5.2f,.5f,0),new Vector2(.8f,1.5f),new Color32(230,215,176,255),-10);
            rightCastle=Rectangle("Enemy castle",new Vector3(5.2f,.5f,0),new Vector2(.8f,1.5f),new Color32(135,124,102,255),-10);
            leftCastle.sprite=Scenery("player-castle");rightCastle.sprite=Scenery("enemy-castle");leftCastle.color=rightCastle.color=Color.white;
            leftCastle.transform.localScale=rightCastle.transform.localScale=new Vector3(1.4f,1.8f,1);
            leftCastle.transform.localPosition=new Vector3(-5.2f,.35f,0);rightCastle.transform.localPosition=new Vector3(5.2f,.35f,0);
            playerHealth=Rectangle("Player castle health",new Vector3(-5.2f,1.45f,0),new Vector2(1.2f,.07f),new Color32(88,123,70,255),20);
            enemyHealth=Rectangle("Enemy castle health",new Vector3(5.2f,1.45f,0),new Vector2(1.2f,.07f),new Color32(156,113,74,255),20);
            game.BattleEvent+=OnEvent;
        }
        SpriteRenderer Rectangle(string name,Vector3 position,Vector2 size,Color color,int order)
        {var obj=new GameObject(name);obj.transform.SetParent(sceneRoot);obj.transform.localPosition=position;obj.transform.localScale=size;var sprite=obj.AddComponent<SpriteRenderer>();sprite.sprite=white;sprite.sharedMaterial=material;sprite.color=color;sprite.sortingOrder=order;return sprite;}
        readonly Dictionary<string,Sprite> sceneryAssets=new Dictionary<string,Sprite>();
        Sprite Scenery(string name){if(!sceneryAssets.TryGetValue(name,out var sprite)){var texture=Resources.Load<Texture2D>("Scenery/"+name);if(texture)sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),texture.width);sceneryAssets[name]=sprite;}return sprite;}
        Actor MakeActor(BattleUnit unit)
        {
            if(actorPool.Count>0){var cached=actorPool.Pop();cached.Root.gameObject.SetActive(true);cached.Sprite.sprite=ui.Art(unit.Id)??ui.Art(unit.ArtId);cached.Sprite.sortingOrder=10+unit.Uid%9;return cached;}
            var root=new GameObject(unit.SourceUid).transform;root.SetParent(sceneRoot);var sprite=new GameObject("Character").AddComponent<SpriteRenderer>();sprite.transform.SetParent(root,false);sprite.sprite=ui.Art(unit.Id)??ui.Art(unit.ArtId);sprite.sharedMaterial=material;sprite.sortingOrder=10+unit.Uid%9;
            var health=Rectangle("Health",Vector3.zero,new Vector2(.65f,.045f),new Color32(89,124,72,255),30);health.transform.SetParent(root,false);
            var shield=Rectangle("Shield",Vector3.zero,new Vector2(.7f,.06f),new Color32(120,183,194,255),29);shield.transform.SetParent(root,false);
            var statuses=new SpriteRenderer[4];for(int i=0;i<4;i++){statuses[i]=Rectangle("Status",Vector3.zero,new Vector2(.08f,.08f),Color.white,35);statuses[i].transform.SetParent(root,false);}
            return new Actor{Root=root,Sprite=sprite,Health=health,Shield=shield,Status=statuses};
        }
        float WorldX(double x)=>(float)((x/1200-.5)*battleCamera.orthographicSize*2*battleCamera.aspect);
        static float F(JToken obj,string key,float fallback=0)=>(float?)obj?[key]??fallback;
        void LateUpdate()
        {
            if(game==null)return;battleCamera.orthographicSize=Mathf.Max(3.9f,6.6f/battleCamera.aspect);
            if(current!=game.Battle){ClearActors();current=game.Battle;}
            var state=current?.State;
            float worldHeight=battleCamera.orthographicSize*2,worldWidth=worldHeight*battleCamera.aspect,ground=1-worldHeight*.24f;
            float castleSize=Mathf.Min(115f/Screen.height*worldHeight,.37f*worldHeight,.105f*worldWidth);
            leftCastle.transform.localPosition=new Vector3(WorldX((double)game.Catalog.Raw["constants"]["battlefield"]["PLAYER_CASTLE_X"]),ground+castleSize*.63f,0);rightCastle.transform.localPosition=new Vector3(WorldX((double)game.Catalog.Raw["constants"]["battlefield"]["ENEMY_CASTLE_X"]),ground+castleSize*.63f,0);
            leftCastle.transform.localScale=rightCastle.transform.localScale=new Vector3(castleSize*1.23f,castleSize*1.23f,1);
            playerHealth.transform.localPosition=new Vector3(WorldX((double)game.Catalog.Raw["constants"]["battlefield"]["PLAYER_CASTLE_X"]),ground+castleSize*1.35f,0);enemyHealth.transform.localPosition=new Vector3(WorldX((double)game.Catalog.Raw["constants"]["battlefield"]["ENEMY_CASTLE_X"]),ground+castleSize*1.35f,0);
            if(state==null)return;
            var scene=(string)state.Scene;
            if(scenery!=scene||!background.sprite||background.sprite==white){scenery=scene;background.sprite=Scenery("background-"+(scene??"normal"));terrain.gameObject.SetActive(false);}
            background.transform.localScale=new Vector3(battleCamera.orthographicSize*battleCamera.aspect*2,battleCamera.orthographicSize*2/(background.sprite?background.sprite.bounds.size.y:1),1);
            playerHealth.transform.localScale=new Vector3(1.2f*(float)(state.PlayerHp/Math.Max(1,state.PlayerMaxHp)),.07f,1);enemyHealth.transform.localScale=new Vector3(1.2f*(float)(state.EnemyHp/Math.Max(1,state.EnemyMaxHp)),.07f,1);
            battleCamera.backgroundColor=scene=="moonlight"?new Color32(80,93,120,255):scene=="sunset"?new Color32(224,181,153,255):scene=="quarry"?new Color32(195,203,203,255):new Color32(219,232,203,255);
            visible.Clear();
            foreach(var unit in state.Units)
            {
                visible.Add(unit.Uid);if(!actors.TryGetValue(unit.Uid,out var actor)){actor=MakeActor(unit);actors.Add(unit.Uid,actor);}
                float t=(float)state.Time,phase=0;foreach(char c in unit.SourceUid)phase=(phase*31+c)%6283;phase/=1000;
                float gait=unit.Moving?Mathf.Sin(t*11+phase):0;float bob=unit.Id=="cloud"?Mathf.Sin(t*2.3f+phase)*.035f:unit.Moving?Mathf.Abs(gait)*.028f:Mathf.Sin(t*2.8f+phase)*.008f;
                float x=0,y=bob,rotation=gait*.025f*unit.Facing,sx=1,sy=1,alpha=1;
                if(unit.Dead){alpha=Mathf.Clamp01((float)(unit.DeathTime/.32));y+=(1-alpha)*.12f;sy=1-(1-alpha)*.16f;rotation=(1-alpha)*.16f;}
                else if(unit.HitStun>0){float strength=Mathf.Clamp01((float)(unit.HitStun/Math.Max(.001,unit.HitStunDuration)));x=(float)unit.HitDirection*.14f*strength;y+=.035f*strength;rotation=(float)unit.HitDirection*unit.Facing*.2f*strength;sx=1+.035f*strength;sy=1-.1f*strength;}
                else if(unit.Action!=null){float p=Mathf.Clamp01((float)(unit.ActionElapsed/Math.Max(.001,unit.Action.Duration)));float smooth=p*p*(3-2*p);float strength=unit.ActionPhase=="windup"?.2f+smooth*.8f:1-smooth;var pose=game.Catalog.Raw["animationPoses"]?[unit.Id]?[unit.ActionPhase];x=F(pose,"offsetX")*unit.Facing*strength;y+=(F(pose,"offsetY")-(unit.Id=="cloud"?0:0))*strength;rotation=F(pose,"rotation")*strength;sx=1+(F(pose,"scaleX",1)-1)*strength;sy=1+(F(pose,"scaleY",1)-1)*strength;}
                float baseSize=Mathf.Min(82f/Screen.height*worldHeight,.29f*worldHeight,.078f*worldWidth);
                float size=baseSize*(float)unit.SizeScale*(unit.ArtId=="bear"?1.35f:unit.ArtId=="boar"?1.2f:unit.ArtId=="sheep"?1.07f:1);
                actor.Root.localPosition=new Vector3(WorldX(unit.X),ground+unit.Uid%7*.015f,0);
                actor.Sprite.transform.localPosition=new Vector3(x*size,-y*size,0);actor.Sprite.transform.localScale=new Vector3(sx*size,sy*size,1);actor.Sprite.transform.localRotation=Quaternion.Euler(0,0,rotation*Mathf.Rad2Deg);actor.Sprite.flipX=unit.Facing<0;
                actor.Sprite.color=new Color(1,unit.HitFlash>0?.65f:1,unit.HitFlash>0?.55f:1,alpha);
                actor.Health.gameObject.SetActive(!unit.Dead&&unit.Hp<unit.MaxHp);actor.Health.transform.localPosition=new Vector3(0,.9f*size,0);actor.Health.transform.localScale=new Vector3(.65f*(float)(unit.Hp/unit.MaxHp),.045f,1);
                actor.Shield.gameObject.SetActive(!unit.Dead&&unit.Shield>0);actor.Shield.transform.localPosition=new Vector3(0,.97f*size,0);actor.Shield.transform.localScale=new Vector3(.7f*(float)(unit.Shield/Math.Max(1,unit.MaxShield)),.06f,1);
                int statusIndex=0;foreach(string type in new[]{"regeneration","slow","healingSuppression","poison"}){var marker=actor.Status[statusIndex];bool active=type=="regeneration"?CombatEffectService.EffectOf(unit,type)!=null&&CombatEffectService.Matches(CombatEffectService.EffectOf(unit,type),unit.Subject()):CombatEffectService.RemainingEffect(unit,type)>0;marker.gameObject.SetActive(!unit.Dead&&active);if(ColorUtility.TryParseHtmlString((string)game.Catalog.Raw["effects"][type]["color"],out var tint))marker.color=tint;marker.transform.localPosition=new Vector3((statusIndex-1.5f)*.12f,.82f*size,0);statusIndex++;}
            }
            removals.Clear();foreach(int id in actors.Keys)if(!visible.Contains(id))removals.Add(id);
            foreach(int id in removals){var actor=actors[id];actor.Root.gameObject.SetActive(false);actorPool.Push(actor);actors.Remove(id);}
            activeShots.Clear();foreach(var shot in state.Projectiles){activeShots.Add(shot.Uid);if(!shots.TryGetValue(shot.Uid,out var sprite)){sprite=shotPool.Count>0?shotPool.Pop():Rectangle("Projectile",Vector3.zero,new Vector2(.12f,.12f),new Color32(220,170,65,255),50);sprite.gameObject.SetActive(true);shots.Add(shot.Uid,sprite);}sprite.transform.localPosition=new Vector3(WorldX(shot.X),ground+.6f,0);}
            removals.Clear();foreach(int id in shots.Keys)if(!activeShots.Contains(id))removals.Add(id);
            foreach(int id in removals){var sprite=shots[id];sprite.gameObject.SetActive(false);shotPool.Push(sprite);shots.Remove(id);}
            for(int i=flashes.Count-1;i>=0;i--){var flash=flashes[i];float p=(float)((state.Time-flash.Start)/flash.Duration);if(p>=1){Destroy(flash.Sprite.gameObject);flashes.RemoveAt(i);continue;}flash.Sprite.transform.localScale=new Vector3(flash.Radius*(flash.Kind=="repel-warning"?1:.2f+p),flash.Kind=="repel-warning"?.045f:.04f+flash.Radius*p*.3f,1);var color=flash.Sprite.color;color.a=1-p;flash.Sprite.color=color;}
        }
        void OnEvent(JObject evt)
        {string type=(string)evt["type"];if(type=="summon"||type=="spawn")return;if(flashes.Count>=96){Destroy(flashes[0].Sprite.gameObject);flashes.RemoveAt(0);}float x=WorldX(F(evt,"x",600));var color=type=="heal"?new Color32(120,196,123,255):type=="repel-warning"?new Color32(240,167,67,255):new Color32(231,192,104,255);var sprite=Rectangle(type,new Vector3(x,1-battleCamera.orthographicSize*.48f+.3f,0),Vector2.one,color,60);flashes.Add(new Flash{Sprite=sprite,Start=(double?)evt["time"]??game.Battle?.State.Time??0,Kind=type,Duration=type=="repel-warning"?Math.Max(.033,F(evt,"duration",.35f)):.3,Radius=Mathf.Max(.15f,F(evt,"range",F(evt,"radius",35))/100)});}
        void ClearActors(){foreach(var actor in actors.Values){actor.Root.gameObject.SetActive(false);actorPool.Push(actor);}actors.Clear();foreach(var sprite in shots.Values){sprite.gameObject.SetActive(false);shotPool.Push(sprite);}shots.Clear();foreach(var flash in flashes)Destroy(flash.Sprite.gameObject);flashes.Clear();}
        void OnDestroy(){if(game!=null)game.BattleEvent-=OnEvent;ClearActors();while(actorPool.Count>0)Destroy(actorPool.Pop().Root.gameObject);while(shotPool.Count>0)Destroy(shotPool.Pop().gameObject);if(material)Destroy(material);foreach(var asset in sceneryAssets.Values)if(asset)Destroy(asset);if(white){Destroy(white.texture);Destroy(white);}}
    }
}
