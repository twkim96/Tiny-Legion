using UnityEngine;
using UnityEngine.UI;
namespace TinyLegion.Unity
{
    [RequireComponent(typeof(GridLayoutGroup))]
    public sealed class ResponsiveGrid : MonoBehaviour
    {
        public int Columns=5;
        public float Height=60;
        public bool FitHeight;
        GridLayoutGroup grid;RectTransform rect;
        void Awake(){grid=GetComponent<GridLayoutGroup>();rect=(RectTransform)transform;}
        void OnEnable(){Resize();}
        void OnRectTransformDimensionsChange(){Resize();}
        void Resize()
        {
            if(!grid)grid=GetComponent<GridLayoutGroup>();if(!rect)rect=(RectTransform)transform;
            if(!grid||!rect||rect.rect.width<=0)return;
            int columns=Mathf.Max(1,Columns);int rows=Mathf.Max(1,Mathf.CeilToInt(transform.childCount/(float)columns));
            float width=(rect.rect.width-grid.padding.horizontal-grid.spacing.x*(columns-1))/columns;
            float height=FitHeight?(rect.rect.height-grid.padding.vertical-grid.spacing.y*(rows-1))/rows:Height;
            var next=new Vector2(Mathf.Max(25,width),Mathf.Max(25,height));if(grid.cellSize!=next)grid.cellSize=next;
            grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=columns;
        }
        void LateUpdate(){Resize();} // Child count changes after a receipt or lineup edit.
    }
}
