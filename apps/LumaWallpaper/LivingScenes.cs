using System;
using System.Globalization;
using System.Windows;
using System.Windows.Media;

namespace LumaWallpaper {
    internal partial class Art {
        private MazeGame maze;
        private int mazeCycle=-1;
        private DrawingGroup mazeWalls;
        private static readonly Brush[] fishBodies=FishBrushes();
        private static readonly Brush water=WaterBrush();
        private static readonly Geometry tail=Path(new[]{new Point(-23,0),new Point(-46,-15),new Point(-42,0),new Point(-46,15)},true);
        private static Brush WaterBrush() {
            var b=new LinearGradientBrush(Color.FromArgb(20,0,210,230),Color.FromArgb(28,5,20,90),90);b.Freeze();return b;
        }
        private static Brush[] FishBrushes() {
            var result=new Brush[8];
            for(int i=0;i<8;i++) {
                var b=new LinearGradientBrush();b.StartPoint=new Point(0.2,0);b.EndPoint=new Point(0.7,1);
                b.GradientStops.Add(new GradientStop(Colors.White,0));b.GradientStops.Add(new GradientStop(colors[i].Color,0.35));
                Color c=colors[i].Color;b.GradientStops.Add(new GradientStop(Color.FromRgb((byte)(c.R*0.4),(byte)(c.G*0.4),(byte)(c.B*0.6)),1));
                b.Freeze();result[i]=b;
            }
            return result;
        }
        private bool RenderLiving(DrawingContext dc,double w,double h,double t) {
            if(Settings.Scene!="Aquarium"&&Settings.Scene!="Pac-Man arcade")return false;
            dc.PushOpacity(Settings.Opacity);if(Settings.QuietCenter)dc.PushOpacityMask(quietMask);
            if(Settings.Scene=="Aquarium")Aquarium(dc,w,h,t);else Arcade(dc,w,h,t);
            if(Settings.QuietCenter)dc.Pop();dc.Pop();return true;
        }
        private void Aquarium(DrawingContext dc,double w,double h,double t) {
            dc.DrawRectangle(water,null,new Rect(0,0,w,h));
            for(int i=0;i<5;i++) {
                double x=w*(i+0.25)/5+Math.Sin(t*0.15+i)*w*0.035;
                dc.DrawGeometry(Tint(3,0.035),null,Path(new[]{new Point(x-15,0),new Point(x+20,0),new Point(x+w*0.17,h*0.8),new Point(x+w*0.05,h*0.8)},true));
            }
            Glow(dc,w*0.12,h*0.24,h*0.48,3,0.18);Glow(dc,w*0.87,h*0.73,h*0.4,4,0.12);
            // Plants sit along the floor; each stalk and leaf sways at a different phase.
            for(int i=0;i<17;i++) {
                double x=Scatter(i,45)*w,height=h*(0.08+Scatter(i,46)*0.22),sway=Math.Sin(t*0.55+i)*height*0.14;
                var stalk=new Point[12];for(int k=0;k<12;k++){double p=k/11.0;stalk[k]=new Point(x+Math.Sin(p*2+i+t*0.55)*sway*p,h-p*height);}
                dc.DrawGeometry(null,Stroke(i%3==0?0:4,3,0.65),Path(stalk,false));
                for(int leaf=2;leaf<11;leaf+=2) {
                    Point start=stalk[leaf];double side=leaf%4==0?-1:1;
                    dc.DrawGeometry(Tint(i%3==0?0:4,0.45),null,Path(new[]{start,new Point(start.X+side*height*0.15,start.Y-height*0.18),new Point(start.X+side*height*0.23,start.Y-height*0.10)},true));
                }
            }
            for(int i=0;i<48;i++) {
                double x=Scatter(i,47)*w,y=h*(0.96+Scatter(i,48)*0.035);
                dc.DrawEllipse(Tint(i%2==0?3:6,0.24),null,new Point(x,y),3+Scatter(i,49)*9,2+Scatter(i,50)*4);
            }
            for(int i=0;i<40*Settings.Density;i++) {
                double size=2+Scatter(i,51)*5;
                double x=Scatter(i,52)*w+Math.Sin(t+i)*9,y=(1-Frac(Scatter(i,53)+t*(0.018+Scatter(i,54)*0.035)))*h;
                dc.DrawEllipse(null,Stroke(3,1.0,0.35),new Point(x,y),size,size);
                dc.DrawEllipse(Tint(3,0.6),null,new Point(x-size*0.3,y-size*0.35),size*0.18,size*0.18);
            }
            int count=(int)(9+Settings.Density*9);
            for(int i=0;i<count;i++) {
                int direction=i%2==0?1:-1;
                double scale=(0.65+Scatter(i,55)*0.95)*Math.Max(0.65,h/720);
                double speed=(22+Scatter(i,56)*35)*Math.Max(0.65,w/1280);
                double x=Frac(Scatter(i,57)+direction*t*speed/(w+180))*(w+180)-90;
                double y=h*(0.12+Scatter(i,58)*0.66)+Math.Sin(t*0.6+i)*h*0.025;
                DrawFish(dc,x,y,scale,direction,i,t);
            }
        }
        private void DrawFish(DrawingContext dc,double x,double y,double scale,int direction,int i,double t) {
            int kind=i%3,color=kind==0?7:(kind==1?3:i%8);
            dc.PushTransform(new TranslateTransform(x,y));dc.PushTransform(new ScaleTransform(direction*scale,scale));
            dc.PushTransform(new RotateTransform(Math.Sin(t*0.7+i)*5));
            dc.PushTransform(new ScaleTransform(1,0.75+0.25*Math.Sin(t*5+i),-24,0));
            dc.DrawGeometry(fishBodies[color],Stroke(color,1.0,0.5),tail);dc.Pop();
            double tall=kind==2?20:13;
            var body=new EllipseGeometry(new Point(0,0),28,tall);body.Freeze();
            dc.DrawGeometry(Tint(color,0.7),null,Path(new[]{new Point(-14,-tall*0.6),new Point(-2,-tall*(kind==2?2.0:1.6)),new Point(15,-tall*0.5)},true));
            dc.DrawGeometry(Tint(color,0.65),null,Path(new[]{new Point(-8,tall*0.6),new Point(2,tall*1.7),new Point(15,tall*0.4)},true));
            dc.DrawGeometry(fishBodies[color],Stroke(color,1.0,0.8),body);
            dc.PushClip(body);
            if(kind==0)for(int stripe=0;stripe<3;stripe++) {
                double sx=-17+stripe*15;dc.DrawLine(new Pen(Brushes.WhiteSmoke,5),new Point(sx,-20),new Point(sx-4,20));
            }
            else if(kind==1)dc.DrawLine(Stroke(0,4,0.9),new Point(-25,2),new Point(25,2));
            else for(int stripe=0;stripe<3;stripe++)dc.DrawLine(new Pen(new SolidColorBrush(Color.FromArgb(150,9,20,45)),3),new Point(-14+stripe*12,-25),new Point(-18+stripe*12,25));
            dc.Pop();
            dc.PushTransform(new RotateTransform(Math.Sin(t*5+i)*18,2,2));
            dc.DrawGeometry(Tint(color,0.6),Stroke(color,0.8,0.5),Path(new[]{new Point(2,0),new Point(-8,16),new Point(12,7)},true));dc.Pop();
            dc.DrawEllipse(Brushes.WhiteSmoke,null,new Point(19,-3),4,4);dc.DrawEllipse(Brushes.Black,null,new Point(20,-3),2.2,2.2);
            dc.DrawLine(Stroke(color,1.0,0.6),new Point(24,5),new Point(27,3));
            dc.Pop();dc.Pop();dc.Pop();
        }
        private void EnsureMaze(double time) {
            // Bound catch-up when a scene is first selected after hours in another scene.
            int cycle=(int)(time/240);int desired=(int)((time%240)/MazeGame.TickSeconds)+1;
            if(maze==null||mazeCycle!=cycle||desired<maze.Ticks){maze=new MazeGame();mazeCycle=cycle;mazeWalls=null;}
            while(maze.Ticks<desired)maze.Step();
            if(mazeWalls==null) {
                mazeWalls=new DrawingGroup();
                using(var dc=mazeWalls.Open())for(int y=0;y<MazeGame.Height;y++)for(int x=0;x<MazeGame.Width;x++)if(maze.Walls[y*MazeGame.Width+x]) {
                    // Only boundaries facing a corridor are drawn; adjacent blocks join into walls.
                    if(y>0&&!maze.Walls[(y-1)*MazeGame.Width+x])dc.DrawLine(Stroke(2,0.10,0.8),new Point(x,y),new Point(x+1,y));
                    if(y<MazeGame.Height-1&&!maze.Walls[(y+1)*MazeGame.Width+x])dc.DrawLine(Stroke(2,0.10,0.8),new Point(x,y+1),new Point(x+1,y+1));
                    if(x>0&&!maze.Walls[y*MazeGame.Width+x-1])dc.DrawLine(Stroke(2,0.10,0.8),new Point(x,y),new Point(x,y+1));
                    if(x<MazeGame.Width-1&&!maze.Walls[y*MazeGame.Width+x+1])dc.DrawLine(Stroke(2,0.10,0.8),new Point(x+1,y),new Point(x+1,y+1));
                }
                mazeWalls.Freeze();
            }
        }
        private void Arcade(DrawingContext dc,double w,double h,double t) {
            EnsureMaze(t);double cell=Math.Min(w*0.88/MazeGame.Width,h*0.82/MazeGame.Height);
            double left=(w-cell*MazeGame.Width)/2,top=(h-cell*MazeGame.Height)/2+12;
            double progress=Frac(t/MazeGame.TickSeconds);
            // Ambient sparks respond to density without altering maze rules or actor count.
            for(int i=0;i<18*Settings.Density;i++) {
                double x=Scatter(i,61)*w,y=Frac(Scatter(i,62)-t*0.015)*h;
                if(x<left-10||x>left+cell*MazeGame.Width+10)dc.DrawEllipse(Tint(i%8,0.4),null,new Point(x,y),2,2);
            }
            var label=new FormattedText("AUTO PLAY   SCORE "+maze.Score.ToString("00000")+"   LV "+maze.Level+"   LIVES "+maze.Lives,CultureInfo.InvariantCulture,FlowDirection.LeftToRight,mono,Math.Max(10,cell*0.55),Brushes.Gold,1.0);
            dc.DrawText(label,new Point(left,top-cell*1.0));
            dc.PushTransform(new TranslateTransform(left,top));dc.PushTransform(new ScaleTransform(cell,cell));
            dc.DrawRoundedRectangle(new SolidColorBrush(Color.FromArgb(65,5,4,25)),null,new Rect(0,0,MazeGame.Width,MazeGame.Height),0.5,0.5);
            dc.DrawDrawing(mazeWalls);
            for(int n=0;n<maze.Pellets.Length;n++)if(maze.Pellets[n]) {
                double r=maze.Power[n]?0.19+0.04*Math.Sin(t*3):0.055;
                dc.DrawEllipse(Brushes.Wheat,null,new Point(n%MazeGame.Width+0.5,n/MazeGame.Width+0.5),r,r);
            }
            Point pac=ActorPosition(maze.PlayerFrom,maze.Player,progress);
            double angle=Math.Atan2(maze.Player/MazeGame.Width-maze.PlayerFrom/MazeGame.Width,maze.Player%MazeGame.Width-maze.PlayerFrom%MazeGame.Width)*180/Math.PI;
            dc.PushTransform(new RotateTransform(angle,pac.X,pac.Y));
            double mouth=0.13+0.65*(1+Math.Sin(t*18))/2,radius=0.4;
            var shape=new StreamGeometry();using(var c=shape.Open()) {
                c.BeginFigure(pac,true,true);c.LineTo(Polar(pac.X,pac.Y,radius,mouth),true,false);
                c.ArcTo(Polar(pac.X,pac.Y,radius,Math.PI*2-mouth),new Size(radius,radius),0,true,SweepDirection.Clockwise,true,false);
            }
            shape.Freeze();dc.DrawGeometry(Brushes.Gold,null,shape);dc.Pop();
            for(int g=0;g<4;g++)DrawGhost(dc,ActorPosition(maze.GhostFrom[g],maze.Ghosts[g],progress),g,maze.Frightened>0,t);
            dc.Pop();dc.Pop();
            string hint=maze.Frightened>0?"POWER MODE / THE GHOSTS ARE RUNNING":"PELLETS / CHASES / POWER UPS / AUTO RESTART";
            dc.DrawText(new FormattedText(hint,CultureInfo.InvariantCulture,FlowDirection.LeftToRight,mono,Math.Max(9,cell*0.45),colors[3],1.0),new Point(left,top+cell*(MazeGame.Height+0.3)));
        }
        private static Point ActorPosition(int from,int to,double p) {return new Point((from%MazeGame.Width)*(1-p)+(to%MazeGame.Width)*p+0.5,(from/MazeGame.Width)*(1-p)+(to/MazeGame.Width)*p+0.5);}
        private void DrawGhost(DrawingContext dc,Point pos,int index,bool scared,double t) {
            dc.PushTransform(new TranslateTransform(pos.X,pos.Y));
            var shape=new StreamGeometry();using(var c=shape.Open()) {
                c.BeginFigure(new Point(-0.38,0.36),true,true);c.LineTo(new Point(-0.38,0),true,false);
                c.BezierTo(new Point(-0.38,-0.53),new Point(0.38,-0.53),new Point(0.38,0),true,false);
                c.LineTo(new Point(0.38,0.36),true,false);
                for(int k=0;k<5;k++)c.LineTo(new Point(0.38-k*0.19,k%2==0?0.36:0.23+0.04*Math.Sin(t*8+index)),true,false);
            }
            shape.Freeze();dc.DrawGeometry(scared?colors[2]:colors[new[]{7,0,3,6}[index]],null,shape);
            foreach(double x in new[]{-0.15,0.15}) {dc.DrawEllipse(Brushes.White,null,new Point(x,-0.04),0.105,0.14);dc.DrawEllipse(Brushes.DarkBlue,null,new Point(x+0.025,-0.03),0.05,0.07);}
            dc.Pop();
        }
    }
}
